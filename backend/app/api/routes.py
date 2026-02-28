"""
API Routes - REST endpoints for the Scam Shield pipeline.

Endpoints:
- POST /intake               - Submit scam intake, get fact sheet
- POST /verify               - Verify fact sheet
- POST /generate             - Generate video package
- POST /chat/factsheet       - Chat about fact sheet (auto-updates)
- POST /chat/video-package   - Chat about video package (auto-updates)
- GET  /avatars              - List available avatars
- GET  /config               - Get video format constraints
- GET  /news                 - Fetch trending scam news via Serper
- GET  /debug/sessions       - List active sessions
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal, Tuple
from datetime import datetime
from pathlib import Path
import asyncio
import base64
import json
import logging
import re
import os
import time
import aiohttp

logger = logging.getLogger(__name__)

from google import genai
from google.genai import types
from google.genai.errors import ServerError, ClientError

from ..models import (
    IntakeInput,
    FactSheet,
    CreatorConfig,
    InputSource,
    Language,
    Tone,
    TargetAudience,
    AvatarConfig,
    TRUSTED_AVATARS,
    VIDEO_FORMAT_CONSTRAINTS,
    MAX_SCENE_DURATION,
    MultiLanguageVideoPackage,
    PipelineState,
    DirectorOutput,
    VisualAudioPipelineState,
    RecommendAvatarsRequest,
    RecommendAvatarsResponse,
    PreviewFrame,
    PreviewState,
    RefinementEntry,
    GeneratePreviewFramesRequest,
    GeneratePreviewFramesResponse,
    ChatPreviewFramesRequest,
    ChatPreviewFramesResponse,
    SceneCharacterAssignment,
    SocialOfficerOutput,
)
from ..pipeline import create_pipeline, PipelineOrchestrator
from ..config import get_settings


router = APIRouter(tags=["pipeline"])

# In-memory session storage (replace with Redis/DB in production)
_sessions: Dict[str, PipelineOrchestrator] = {}


# ==================== REQUEST/RESPONSE SCHEMAS ====================

class IntakeRequest(BaseModel):
    """Request schema for intake submission."""
    source_type: InputSource
    content: str = Field(..., min_length=10, description="Scam description, URL, or report text")
    additional_context: Optional[str] = None
    officer_id: Optional[str] = None
    use_deep_research: Optional[bool] = Field(None, description="Override Deep Research setting (None = use server default)")


class IntakeResponse(BaseModel):
    """Response schema for intake submission."""
    session_id: str
    fact_sheet: FactSheet
    message: str = "Fact sheet generated. Please verify before proceeding."


class VerifyRequest(BaseModel):
    """Request schema for fact sheet verification."""
    session_id: str
    officer_id: str
    notes: Optional[str] = None
    corrections: Optional[Dict[str, Any]] = None


class VerifyResponse(BaseModel):
    """Response schema for verification."""
    session_id: str
    fact_sheet: FactSheet
    verified: bool
    message: str


class GenerateRequest(BaseModel):
    """Request schema for video package generation."""
    session_id: str
    target_groups: List[TargetAudience]
    languages: List[Language]
    tone: Tone
    avatar_id: str = Field(..., description="Avatar ID from /avatars endpoint")
    video_format: str = Field("reel", pattern="^(reel|story|post)$")
    director_instructions: Optional[str] = None


class GenerateResponse(BaseModel):
    """Response schema for video package generation."""
    session_id: str
    status: str
    video_package: Optional[Dict[str, Any]] = None
    message: str
    recommended_characters: Optional[List[str]] = Field(
        default_factory=list,
        description="Recommended characters for the video (minimum 2 characters, consistent across all scenes)"
    )
    character_descriptions: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Character descriptions with role, type, description, and base64 image data"
    )


class VideoAssetsRequest(BaseModel):
    """Request schema for visual/audio asset generation."""
    session_id: str
    language_code: str = Field("en", description="Language version to generate (e.g. 'bm', 'en', 'zh', 'ta')")
    stop_after: Optional[Literal["story", "script", "characters", "char_refs", "clip_refs"]] = Field(
        None, description="Stop after this stage (None = run all stages including Veo)"
    )
    output_dir: Optional[str] = Field(None, description="Custom output directory")


class VideoAssetsResponse(BaseModel):
    """Response schema for visual/audio asset generation."""
    session_id: str
    status: str
    language_code: str
    visual_audio_state: Optional[Dict[str, Any]] = None
    message: str


# Chat-related schemas (frontend-managed history, auto-updates)
class ChatMessage(BaseModel):
    """A single chat message."""
    role: Literal["user", "assistant"]
    content: str


class ChatFactSheetRequest(BaseModel):
    """Request schema for fact sheet chat."""
    session_id: str
    message: str = Field(..., min_length=1, description="User's question or request")
    chat_history: List[ChatMessage] = Field(default_factory=list, description="Previous messages (frontend-managed)")


class ChatFactSheetResponse(BaseModel):
    """Response schema for fact sheet chat."""
    session_id: str
    response: str = Field(..., description="AI response")
    fact_sheet: FactSheet = Field(..., description="Current fact sheet (updated if changes applied)")
    updated: bool = Field(default=False, description="Whether changes were applied")
    changes_applied: Optional[Dict[str, Any]] = Field(None, description="Fields that were updated")


class ChatVideoPackageRequest(BaseModel):
    """Request schema for video package chat."""
    session_id: str
    message: str = Field(..., min_length=1, description="User's question or request")
    chat_history: List[ChatMessage] = Field(default_factory=list, description="Previous messages (frontend-managed)")


class ChatVideoPackageResponse(BaseModel):
    """Response schema for video package chat."""
    session_id: str
    response: str = Field(..., description="AI response")
    director_output: Optional[DirectorOutput] = Field(None, description="Current director output (updated if changes applied)")
    video_package: Optional[Dict[str, Any]] = Field(None, description="Current video package if available")
    updated: bool = Field(default=False, description="Whether changes were applied")
    changes_applied: Optional[Dict[str, Any]] = Field(None, description="Fields/scenes that were updated")


class AvatarResponse(BaseModel):
    """Response schema for avatar list."""
    avatars: List[AvatarConfig]


class ConfigResponse(BaseModel):
    """Response schema for video format constraints."""
    formats: Dict[str, Dict[str, int]]
    max_scene_duration: int
    supported_languages: List[Dict[str, str]]
    supported_tones: List[str]
    supported_audiences: List[str]


# ==================== HELPER FUNCTIONS ====================

def _extract_json_from_response(text: str) -> Optional[Dict[str, Any]]:
    """Extract JSON block from LLM response."""
    # Try to find JSON in code blocks first
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to find raw JSON object with "updates" key
    json_match = re.search(r'\{\s*"updates"\s*:\s*\{[^}]*\}\s*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    
    return None


def _enum_or_str(value: Any) -> str:
    """Return Enum.value if given an Enum instance, otherwise the raw string."""
    if hasattr(value, "value"):
        return getattr(value, "value")
    return str(value)


async def _recommend_avatars(
    fact_sheet: FactSheet,
    target_audience: Optional[TargetAudience] = None,
    language: Optional[Language] = None,
    tone: Optional[Tone] = None,
) -> List[str]:
    """
    Use LLM to recommend avatars based on fact sheet and optionally user's configuration choices.
    
    This can be called:
    - During navigation from Briefing to Casting & Vibe (fact sheet only, optional params)
    - When user clicks "Change Avatar" button (with optional target_audience, language, tone)
    - When user clicks "Generate Script" (with all params from user selections)
    
    Returns list of ALL recommended avatar IDs (user can see all options).
    """
    settings = get_settings()
    api_key = settings.google_api_key
    if not api_key:
        logger.warning("[AVATAR-RECOMMEND] No API key, returning default avatars")
        return ["officer_malay_male_01"]  # Default fallback
    
    client = genai.Client(api_key=api_key)
    
    # Build available avatars list
    available_avatars = "\n".join([
        f"- {avatar.id}: {avatar.name} ({avatar.ethnicity}, {avatar.gender})"
        for avatar in TRUSTED_AVATARS
    ])
    
    # Build user configuration section (only include if provided)
    user_config_lines = []
    if target_audience:
        user_config_lines.append(f"- Target Audience: {target_audience.value}")
    if language:
        user_config_lines.append(f"- Language: {language.value}")
    if tone:
        user_config_lines.append(f"- Tone: {tone.value}")
    
    user_config_section = "\n".join(user_config_lines) if user_config_lines else "Not specified (will use fact sheet context only)"
    
    prompt = f"""You are helping a Malaysian police officer choose the best avatar(s) for an anti-scam awareness video.

FACT SHEET:
- Scam Name: {fact_sheet.scam_name}
- Category: {_enum_or_str(fact_sheet.category)}
- Story: {fact_sheet.story_hook}
- Red Flag: {fact_sheet.red_flag}
- The Fix: {fact_sheet.the_fix}

USER CONFIGURATION:
{user_config_section}

AVAILABLE AVATARS:
{available_avatars}

TASK:
Recommend ALL avatar IDs that would be effective for this scam awareness video. Consider:
1. **Cultural relevance**: Which ethnicity matches the target audience and language (if provided)?
2. **Trust factor**: Which avatar would build the most trust and authority for this audience?
3. **Demographics**: Consider typical victim profiles for this scam category
4. **Language alignment**: Match avatar ethnicity to language (e.g., Malay avatar for Bahasa Melayu) if language is provided
5. **Tone appropriateness**: Consider if gender affects tone perception if tone is provided

IMPORTANT:
- Return ONLY a JSON array of avatar IDs
- Include ALL suitable avatars (typically 2-4 avatars)
- Do NOT include any explanation or text outside the JSON
- If user configuration is not provided, base recommendations primarily on fact sheet context

JSON Response:"""
    
    try:
        response = await client.aio.models.generate_content(
            model=settings.default_director_model,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=256,
            ),
        )
        
        response_text = response.text.strip()
        logger.debug(f"[AVATAR-RECOMMEND] Raw LLM response: {response_text}")
        
        # Try multiple parsing strategies
        avatar_ids = None
        
        # Strategy 1: Try to parse as direct JSON array
        try:
            avatar_ids = json.loads(response_text)
            if isinstance(avatar_ids, list):
                logger.debug("[AVATAR-RECOMMEND] Parsed as direct JSON array")
        except json.JSONDecodeError:
            pass
        
        # Strategy 2: Extract JSON array using regex
        if avatar_ids is None:
            json_match = re.search(r'\[.*?\]', response_text, re.DOTALL)
            if json_match:
                try:
                    avatar_ids = json.loads(json_match.group(0))
                    logger.debug("[AVATAR-RECOMMEND] Parsed JSON array from regex match")
                except json.JSONDecodeError:
                    pass
        
        # Strategy 3: Try to find JSON in code blocks
        if avatar_ids is None:
            code_block_match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', response_text, re.DOTALL)
            if code_block_match:
                try:
                    avatar_ids = json.loads(code_block_match.group(1))
                    logger.debug("[AVATAR-RECOMMEND] Parsed JSON array from code block")
                except json.JSONDecodeError:
                    pass
        
        # Strategy 4: Try to extract quoted strings that look like avatar IDs
        if avatar_ids is None:
            # Look for patterns like "officer_malay_male_01" or 'officer_malay_male_01'
            avatar_id_pattern = r'["\']?(officer_(?:malay|chinese|indian)_(?:male|female)_\d{2})["\']?'
            matches = re.findall(avatar_id_pattern, response_text)
            if matches:
                avatar_ids = list(set(matches))  # Remove duplicates
                logger.debug(f"[AVATAR-RECOMMEND] Extracted avatar IDs using pattern matching: {avatar_ids}")
        
        # Validate and return
        if avatar_ids and isinstance(avatar_ids, list):
            # Validate avatar IDs exist
            valid_avatars = [aid for aid in avatar_ids if any(a.id == aid for a in TRUSTED_AVATARS)]
            if valid_avatars:
                logger.info(f"[AVATAR-RECOMMEND] Recommended {len(valid_avatars)} avatars: {valid_avatars}")
                return valid_avatars
            else:
                logger.warning(f"[AVATAR-RECOMMEND] No valid avatars found in parsed list: {avatar_ids}")
        
        # Fallback if parsing fails
        logger.warning(f"[AVATAR-RECOMMEND] Failed to parse LLM response. Response was: {response_text[:200]}...")
        return ["officer_malay_male_01", "officer_malay_female_01"]  # Return 2 defaults for minimum requirement
        
    except Exception as e:
        logger.error(f"[AVATAR-RECOMMEND] Error: {e}", exc_info=True)
        return ["officer_malay_male_01"]  # Default fallback


async def _call_chat_llm_with_updates(
    system_prompt: str, 
    user_message: str, 
    chat_history: List[ChatMessage] = None
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    Call Gemini for chat responses that may include structured updates.
    Chat history is managed by frontend and passed with each request.
    Uses proper system_instruction to separate system prompt from conversation.
    
    Returns:
        Tuple of (response_text, updates_dict or None)
    """
    settings = get_settings()
    api_key = settings.google_api_key
    if not api_key:
        raise ValueError("No API key configured. Set GOOGLE_API_KEY in .env file.")
    
    client = genai.Client(api_key=api_key)
    
    # Detect user language and build explicit language directive
    def _detect_language(text: str) -> str:
        """Simple heuristic: if mostly ASCII, treat as English."""
        ascii_chars = sum(1 for c in text if ord(c) < 128)
        ratio = ascii_chars / max(len(text), 1)
        # Check for common Malay markers
        malay_markers = ["saya", "apa", "ini", "itu", "dan", "untuk", "tidak", "boleh", "dengan", "ada", "yang"]
        lower = text.lower()
        has_malay = any(f" {m} " in f" {lower} " for m in malay_markers)
        if has_malay and ratio > 0.8:
            return "Bahasa Melayu"
        if ratio > 0.8:
            return "English"
        # Check for Chinese characters
        if any('\u4e00' <= c <= '\u9fff' for c in text):
            return "Chinese"
        # Check for Tamil characters
        if any('\u0b80' <= c <= '\u0bff' for c in text):
            return "Tamil"
        return "English"
    
    detected_lang = _detect_language(user_message)
    
    # Build multi-turn conversation as proper Content objects
    contents = []
    
    if chat_history:
        for msg in chat_history[-10:]:  # Keep last 10 messages
            role = "user" if msg.role == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.content)]))
    
    # Prefix user message with an explicit language directive (strongest signal)
    augmented_message = f"[RESPOND ENTIRELY IN {detected_lang.upper()}. THIS IS MANDATORY.]\n\n{user_message}"
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=augmented_message)]))
    
    response = await client.aio.models.generate_content(
        model=settings.default_director_model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
            max_output_tokens=2048,
        ),
    )
    
    response_text = response.text
    updates = _extract_json_from_response(response_text)
    
    # Clean response text by removing JSON block if present
    clean_response = re.sub(r'```(?:json)?\s*\{.*?\}\s*```', '', response_text, flags=re.DOTALL).strip()
    
    return clean_response, updates


# ==================== ENDPOINTS ====================

@router.post("/intake", response_model=IntakeResponse)
async def submit_intake(request: IntakeRequest):
    """
    Submit scam intake and generate fact sheet.
    
    This is Stage 1 of the pipeline. The Research Agent will analyze
    the input and generate a Fact Sheet for officer verification.
    """
    try:
        logger.info("[INTAKE] Starting intake processing (source_type=%s, deep_research=%s)", request.source_type, request.use_deep_research)
        t0 = time.time()
        pipeline = create_pipeline()
        
        # Override Deep Research setting if explicitly provided by the client
        if request.use_deep_research is not None:
            pipeline.research_agent.use_deep_research = request.use_deep_research
        
        intake = IntakeInput(
            source_type=request.source_type,
            content=request.content,
            additional_context=request.additional_context,
            officer_id=request.officer_id,
        )
        
        logger.info("[INTAKE] Calling Research Agent (deep_research=%s)...", pipeline.research_agent.use_deep_research)
        fact_sheet = await pipeline.process_intake(intake)
        
        # Store session
        session_id = pipeline.state.session_id
        _sessions[session_id] = pipeline
        
        elapsed = time.time() - t0
        logger.info("[INTAKE] Completed in %.1fs — session=%s, scam=%s", elapsed, session_id, fact_sheet.scam_name)
        
        return IntakeResponse(
            session_id=session_id,
            fact_sheet=fact_sheet,
            message="Fact sheet generated. Please verify before proceeding.",
        )
        
    except Exception as e:
        logger.error("[INTAKE] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/intake/stream")
async def submit_intake_stream(request: IntakeRequest):
    """
    Submit scam intake with SSE streaming for Deep Research thought process.
    
    Returns Server-Sent Events:
    - event: thought   → Deep Research thinking updates
    - event: result    → Final fact sheet JSON
    - event: error     → Error message
    
    Falls back to standard (non-streamed) processing when Deep Research is off.
    """
    async def event_generator():
        try:
            use_deep_research = request.use_deep_research
            if use_deep_research is None:
                from ..config import get_settings
                use_deep_research = get_settings().use_deep_research

            logger.info("[INTAKE/STREAM] Starting (source_type=%s, deep_research=%s)",
                        request.source_type, use_deep_research)
            t0 = time.time()
            pipeline = create_pipeline()

            if request.use_deep_research is not None:
                pipeline.research_agent.use_deep_research = request.use_deep_research

            intake = IntakeInput(
                source_type=request.source_type,
                content=request.content,
                additional_context=request.additional_context,
                officer_id=request.officer_id,
            )

            # Thought callback — sends SSE events
            thought_queue = asyncio.Queue()

            async def on_thought(text: str):
                await thought_queue.put(text)

            # Run the research in a background task so we can yield thoughts
            result_holder = {}

            async def run_research():
                try:
                    fact_sheet = await pipeline.process_intake(intake, on_thought=on_thought)
                    result_holder["fact_sheet"] = fact_sheet
                    result_holder["session_id"] = pipeline.state.session_id
                except Exception as exc:
                    result_holder["error"] = str(exc)
                finally:
                    await thought_queue.put(None)  # Sentinel

            task = asyncio.create_task(run_research())

            # Yield thought events as they arrive
            while True:
                thought = await thought_queue.get()
                if thought is None:
                    break
                yield f"event: thought\ndata: {json.dumps({'thought': thought})}\n\n"

            await task  # Ensure task is done

            if "error" in result_holder:
                yield f"event: error\ndata: {json.dumps({'error': result_holder['error']})}\n\n"
                return

            fact_sheet = result_holder["fact_sheet"]
            session_id = result_holder["session_id"]
            _sessions[session_id] = pipeline

            elapsed = time.time() - t0
            logger.info("[INTAKE/STREAM] Completed in %.1fs — session=%s", elapsed, session_id)

            response_data = {
                "session_id": session_id,
                "fact_sheet": fact_sheet.model_dump(mode="json"),
                "message": "Fact sheet generated. Please verify before proceeding.",
            }
            yield f"event: result\ndata: {json.dumps(response_data)}\n\n"

        except Exception as e:
            logger.error("[INTAKE/STREAM] Failed: %s", e, exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify_fact_sheet(request: VerifyRequest):
    """
    Verify (and optionally correct) the fact sheet.
    
    This is a REQUIRED step before video generation.
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not pipeline.state.fact_sheet:
        raise HTTPException(status_code=400, detail="No fact sheet to verify")
    
    try:
        logger.info("[VERIFY] Verifying fact sheet for session=%s, officer=%s", request.session_id, request.officer_id)
        verified = pipeline.verify_fact_sheet(
            pipeline.state.fact_sheet,
            officer_id=request.officer_id,
            notes=request.notes,
            corrections=request.corrections,
        )
        
        logger.info("[VERIFY] Fact sheet verified successfully (corrections=%s)", bool(request.corrections))
        return VerifyResponse(
            session_id=request.session_id,
            fact_sheet=verified,
            verified=True,
            message="Fact sheet verified. Ready for video generation.",
        )
        
    except Exception as e:
        logger.error("[VERIFY] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommend-avatars", response_model=RecommendAvatarsResponse)
async def recommend_avatars(request: RecommendAvatarsRequest):
    """
    Generate avatar recommendations based on fact sheet (and optionally target audience, language, tone).
    
    This endpoint can be called:
    - During navigation from Briefing to Casting & Vibe (fact sheet only, optional params)
    - When user clicks "Change Avatar" button (with optional target_audience, language, tone)
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not pipeline.state.fact_sheet:
        raise HTTPException(status_code=400, detail="No fact sheet available for session")
    
    try:
        logger.info("[RECOMMEND-AVATARS] Generating recommendations for session=%s", request.session_id)
        
        recommended_avatars = await _recommend_avatars(
            fact_sheet=pipeline.state.fact_sheet,
            target_audience=request.target_audience,
            language=request.language,
            tone=request.tone
        )
        
        logger.info("[RECOMMEND-AVATARS] Recommended %d avatars: %s", len(recommended_avatars), recommended_avatars)
        
        return RecommendAvatarsResponse(
            recommended_avatars=recommended_avatars,
            message="Avatar recommendations generated successfully"
        )
        
    except Exception as e:
        logger.error("[RECOMMEND-AVATARS] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate avatar recommendations")


@router.post("/generate", response_model=GenerateResponse)
async def generate_video_package(request: GenerateRequest):
    """
    Generate the complete video package.
    
    This runs Stages 3-6:
    - Director Agent: Script + scenes
    - Linguistic Agent: Translations
    - Sensitivity Check: 3R compliance
    - Package Assembly: Final output
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    fact_sheet = pipeline.state.fact_sheet
    if not fact_sheet or not fact_sheet.verified_by_officer:
        raise HTTPException(status_code=400, detail="Fact sheet must be verified first")
    
    # Find avatar by ID
    avatar = next((a for a in TRUSTED_AVATARS if a.id == request.avatar_id), None)
    if not avatar:
        raise HTTPException(status_code=400, detail=f"Invalid avatar_id: {request.avatar_id}")
    
    try:
        t0 = time.time()
        logger.info("[GENERATE] === Starting video package generation ===")
        logger.info("[GENERATE] Session=%s | Languages=%s | Tone=%s | Avatar=%s | Format=%s",
                    request.session_id, [l.value for l in request.languages], request.tone,
                    request.avatar_id, request.video_format)

        # Generate avatar recommendations with full context (fact sheet + user config)
        logger.info("[GENERATE] Generating avatar recommendations with user configuration...")
        recommended_avatars = await _recommend_avatars(
            fact_sheet=fact_sheet,
            target_audience=request.target_groups[0],  # Use first target group
            language=request.languages[0],  # Use first language
            tone=request.tone
        )
        
        # Auto-select first recommended avatar if current selection is not in recommendations
        if recommended_avatars and request.avatar_id not in recommended_avatars:
            logger.info(f"[GENERATE] Auto-selecting first recommended avatar: {recommended_avatars[0]}")
            avatar = next((a for a in TRUSTED_AVATARS if a.id == recommended_avatars[0]), avatar)

        config = CreatorConfig(
            target_groups=request.target_groups,
            languages=request.languages,
            tone=request.tone,
            avatar=avatar,
            video_format=request.video_format,
            director_instructions=request.director_instructions,
        )
        
        # Step 1: Generate script
        t1 = time.time()
        logger.info("[GENERATE] Step 1/4 — Director Agent: generating script...")
        director_output = await pipeline.generate_script(fact_sheet, config)
        logger.info("[GENERATE] Step 1/4 — Director Agent done (%.1fs) — %d scenes, project=%s",
                    time.time() - t1, len(director_output.scene_breakdown), director_output.project_id)
        
        # Step 2: Generate translations
        t2 = time.time()
        logger.info("[GENERATE] Step 2/4 — Linguistic Agent: translating to %d languages...", len(config.languages))
        linguistic_output = await pipeline.generate_translations(
            director_output,
            config.languages,
        )
        logger.info("[GENERATE] Step 2/4 — Linguistic Agent done (%.1fs) — languages: %s",
                    time.time() - t2, list(linguistic_output.translations.keys()))
        
        # Step 3: Sensitivity check
        t3 = time.time()
        logger.info("[GENERATE] Step 3/4 — Sensitivity Agent: checking compliance...")
        sensitivity_output = await pipeline.check_sensitivity(
            director_output,
            linguistic_output,
            director_output.project_id,
        )
        status_str = "PASSED" if sensitivity_output.passed else "FAILED"
        logger.info("[GENERATE] Step 3/4 — Sensitivity Agent done (%.1fs) — result=%s, flags=%d",
                    time.time() - t3, status_str, len(sensitivity_output.flags))
        
        # Step 4: Assemble package
        t4 = time.time()
        logger.info("[GENERATE] Step 4/4 — Assembling video package...")
        package = pipeline.assemble_video_package(
            fact_sheet,
            config,
            director_output,
            linguistic_output,
            sensitivity_output,
        )
        logger.info("[GENERATE] Step 4/4 — Package assembled (%.1fs) — %d language versions",
                    time.time() - t4, len(package.video_inputs))

        # Step 5: Generate character descriptions + reference images (VA stages 1-4)
        # These are generated early so the Character page can display them.
        # The same images will be reused by /video-assets and /preview-frames later
        # (the stepwise pipeline skips completed stages automatically).
        t5 = time.time()
        logger.info("[GENERATE] Step 5 — Visual/Audio Agent stages 1-4: character descriptions + images...")
        character_descriptions_data = None
        recommended_characters = []
        try:
            # Pick the first language version from the assembled package
            first_lang_code = next(iter(package.video_inputs))
            first_video_input = package.video_inputs[first_lang_code]
            
            # Run VA pipeline up to char_refs (stages 1-4)
            va_state = await pipeline.generate_video_assets_stepwise(
                video_input=first_video_input,
                output_dir=None,
                stop_after="char_refs",
            )
            
            # Extract character role names
            if va_state.character_descriptions:
                recommended_characters = [c.role for c in va_state.character_descriptions.characters]
            
            # Build character descriptions with base64-encoded images
            character_descriptions_data = []
            char_ref_by_role = {r.role: r for r in va_state.character_ref_images}
            
            if va_state.character_descriptions:
                for char in va_state.character_descriptions.characters:
                    char_entry: Dict[str, Any] = {
                        "role": char.role,
                        "type": char.type,
                        "description": char.description_for_image_generation,
                        "image_url": None,
                        "image_base64": None,
                    }
                    ref = char_ref_by_role.get(char.role)
                    if ref and ref.path and Path(ref.path).exists():
                        try:
                            with open(ref.path, "rb") as f:
                                b64 = base64.b64encode(f.read()).decode("utf-8")
                                char_entry["image_base64"] = f"data:image/png;base64,{b64}"
                        except Exception as img_err:
                            logger.warning("[GENERATE] Failed to encode char image %s: %s", ref.path, img_err)
                    
                    character_descriptions_data.append(char_entry)
            
            logger.info("[GENERATE] Step 5 — Character generation done (%.1fs) — %d characters, %d images",
                        time.time() - t5, len(recommended_characters), len(va_state.character_ref_images))
        except Exception as e:
            logger.error("[GENERATE] Step 5 — Character generation failed: %s", e, exc_info=True)
            # Fallback: return empty character data (character page will show pending state)
            recommended_characters = []
            character_descriptions_data = None

        total = time.time() - t0
        logger.info("[GENERATE] === Video package generation completed in %.1fs ===", total)
        
        return GenerateResponse(
            session_id=request.session_id,
            status="completed",
            video_package=package.model_dump(mode="json"),
            message="Video package generated successfully.",
            recommended_characters=recommended_characters,
            character_descriptions=character_descriptions_data,
        )
        
    except Exception as e:
        logger.error("[GENERATE] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== VISUAL/AUDIO ENDPOINTS ====================

@router.post("/video-assets", response_model=VideoAssetsResponse)
async def generate_video_assets(request: VideoAssetsRequest, background_tasks: BackgroundTasks):
    """
    Generate visual/audio assets (character refs, clip refs, Veo clips) from the video package.
    
    This runs the Visual/Audio Agent pipeline:
    1. Expand pipeline output → full ObfuscatedScamStory
    2. Convert scenes → Veo-structured script (veo_prompts + characters_involved)
    3. Generate character descriptions for image generation
    4. Generate character reference images (2×2 grids via Nano Banana)
    5. Generate clip reference frames (start/end per segment)
    6. Generate Veo video clips (8s per segment, interpolation)
    
    Use `stop_after` to run partial pipeline (e.g. "characters" to stop before image generation).
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not pipeline.state.video_package:
        raise HTTPException(
            status_code=400,
            detail="No video package available. Call /generate first."
        )
    
    video_inputs = pipeline.state.video_package.video_inputs
    if request.language_code not in video_inputs:
        available = list(video_inputs.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Language '{request.language_code}' not in package. Available: {available}"
        )
    
    video_input = video_inputs[request.language_code]
    
    try:
        t0 = time.time()
        logger.info("[VIDEO-ASSETS] === Starting visual/audio asset generation ===")
        logger.info("[VIDEO-ASSETS] Session=%s | Language=%s | StopAfter=%s",
                    request.session_id, request.language_code, request.stop_after or "all")

        va_state = await pipeline.generate_video_assets_stepwise(
            video_input=video_input,
            output_dir=request.output_dir,
            stop_after=request.stop_after,
        )
        
        stopped = request.stop_after or "veo_clips"
        total = time.time() - t0
        logger.info("[VIDEO-ASSETS] === Completed through '%s' in %.1fs ===", stopped, total)

        return VideoAssetsResponse(
            session_id=request.session_id,
            status="completed" if not request.stop_after else f"completed_through_{stopped}",
            language_code=request.language_code,
            visual_audio_state=va_state.model_dump(mode="json"),
            message=f"Visual/Audio assets generated through stage: {stopped}",
        )
    except Exception as e:
        logger.error("[VIDEO-ASSETS] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Visual/Audio Agent error: {str(e)}")


@router.post("/preview-frames", response_model=GeneratePreviewFramesResponse)
async def generate_preview_frames(request: GeneratePreviewFramesRequest):
    """
    Generate preview frames (start/end) for each scene in the video package.
    
    This runs the Visual/Audio Agent pipeline up to the clip_refs stage and
    maps the results into a lightweight PreviewState that the frontend can
    display on the Preview page.
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not pipeline.state.video_package:
        raise HTTPException(
            status_code=400,
            detail="Video package not available. Generate script first."
        )
    
    video_inputs = pipeline.state.video_package.video_inputs
    if request.language_code not in video_inputs:
        available = list(video_inputs.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Language '{request.language_code}' not in package. Available: {available}"
        )
    
    video_input = video_inputs[request.language_code]
    
    try:
        t0 = time.time()
        logger.info("[PREVIEW-FRAMES] === Starting preview frame generation ===")
        logger.info(
            "[PREVIEW-FRAMES] Session=%s | Language=%s",
            request.session_id,
            request.language_code,
        )

        # Run Visual/Audio pipeline up to clip reference frames
        va_state = await pipeline.generate_video_assets_stepwise(
            video_input=video_input,
            output_dir=None,
            stop_after="clip_refs",
        )

        # Build lookup for prompts by segment and frame type
        prompt_index: Dict[int, Dict[str, str]] = {}
        for entry in va_state.clip_ref_prompts:
            seg_idx = entry.get("segment_index")
            if seg_idx is None:
                continue
            prompt_index[seg_idx] = {
                "start": entry.get("start_frame_prompt", ""),
                "end": entry.get("end_frame_prompt", ""),
            }

        frames: List[PreviewFrame] = []
        for entry in va_state.clip_ref_images:
            frame_type = "start" if entry.frame == "start" else "end"
            prompts = prompt_index.get(entry.segment_index, {})
            visual_prompt = prompts.get(frame_type, "")

            image_data: Optional[str] = None
            try:
                if entry.path and Path(entry.path).exists():
                    with open(entry.path, "rb") as f:
                        image_bytes = f.read()
                        b64 = base64.b64encode(image_bytes).decode("utf-8")
                        # Assume PNG; underlying generator uses PNG for clip refs
                        image_data = f"data:image/png;base64,{b64}"
            except Exception as img_err:
                logger.error("[PREVIEW-FRAMES] Failed to encode image %s: %s", entry.path, img_err)

            frames.append(
                PreviewFrame(
                    scene_id=entry.segment_index,
                    frame_type=frame_type,  # type: ignore[arg-type]
                    image_url=None,
                    image_data=image_data,
                    visual_prompt=visual_prompt,
                )
            )

        preview_state = PreviewState(
            session_id=request.session_id,
            frames=frames,
            generation_status="completed",
            generated_at=datetime.utcnow(),
            refinement_history=[],
        )

        elapsed = time.time() - t0
        logger.info(
            "[PREVIEW-FRAMES] Generated %d frames in %.1fs",
            len(frames),
            elapsed,
        )

        return GeneratePreviewFramesResponse(
            preview_state=preview_state,
            message="Preview frames generated successfully",
        )
    except ServerError as e:
        # Google API server errors (503, 500, etc.)
        error_msg = str(e)
        if "503" in error_msg or "UNAVAILABLE" in error_msg or "high demand" in error_msg.lower():
            logger.warning("[PREVIEW-FRAMES] Google API temporarily unavailable: %s", e)
            raise HTTPException(
                status_code=503,
                detail="The AI service is currently experiencing high demand. This is usually temporary. Please try again in a few moments."
            )
        else:
            logger.error("[PREVIEW-FRAMES] Google API server error: %s", e, exc_info=True)
            raise HTTPException(
                status_code=503,
                detail=f"AI service error: {error_msg}. Please try again later."
            )
    except ClientError as e:
        # Google API client errors (429, 400, etc.)
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "quota" in error_msg.lower():
            logger.warning("[PREVIEW-FRAMES] Google API quota exceeded: %s", e)
            raise HTTPException(
                status_code=429,
                detail="API quota exceeded. Please check your Google API plan and billing details."
            )
        else:
            logger.error("[PREVIEW-FRAMES] Google API client error: %s", e, exc_info=True)
            raise HTTPException(
                status_code=400,
                detail=f"API request error: {error_msg}"
            )
    except Exception as e:
        logger.error("[PREVIEW-FRAMES] Failed: %s", e, exc_info=True)
        # Check if it's a Google API error that wasn't caught above
        error_str = str(e).lower()
        if "503" in error_str or "unavailable" in error_str or "high demand" in error_str:
            raise HTTPException(
                status_code=503,
                detail="The AI service is currently experiencing high demand. Please try again in a few moments."
            )
        raise HTTPException(status_code=500, detail=f"Failed to generate preview frames: {str(e)}")


@router.post("/chat/preview-frames", response_model=ChatPreviewFramesResponse)
async def chat_preview_frames(request: ChatPreviewFramesRequest):
    """
    Chat with AI to refine preview frames.
    
    NOTE: This implementation currently returns conversational guidance only and does not
    yet apply structured updates to preview frames. The API contract is in place so the
    frontend chat UX can be wired end-to-end.
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Require that preview frames have been generated at least once
    if not pipeline.state.video_package:
        raise HTTPException(
            status_code=400,
            detail="Preview frames not available. Generate preview frames first.",
        )
    
    system_prompt = """
You are an AI assistant helping a Malaysian police officer refine PREVIEW FRAMES for a scam awareness video.

CONTEXT:
- Preview frames are START and END still images for each scene.
- They are used to validate visual style, composition, and mood BEFORE full video generation.

YOUR ROLE:
1. Respond conversationally to the officer's request.
2. Suggest concrete visual changes they could make to START and/or END frames.
3. Focus on camera angle, composition, lighting, mood, and character positioning.

IMPORTANT:
- DO NOT promise that frames have already been regenerated.
- Clearly describe what will change in future regenerated frames instead.
"""
    try:
        # Convert frontend chat history format to ChatMessage objects
        chat_history_objects: List[ChatMessage] = []
        if request.chat_history:
            for msg in request.chat_history:
                # Handle both dict format (from frontend) and ChatMessage objects
                if isinstance(msg, dict):
                    chat_history_objects.append(ChatMessage(
                        role=msg.get("role", "user"),  # type: ignore
                        content=msg.get("content", "")
                    ))
                else:
                    chat_history_objects.append(msg)
        
        response_text, _updates = await _call_chat_llm_with_updates(
            system_prompt=system_prompt.strip(),
            user_message=request.message,
            chat_history=chat_history_objects,
        )
        # For now, we do not mutate preview frames; just return guidance text.
        return ChatPreviewFramesResponse(
            response=response_text,
            updated_frames=None,
            updated=False,
        )
    except Exception as e:
        logger.error("[CHAT-PREVIEW-FRAMES] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process chat message")


@router.get("/video-assets/{session_id}")
async def get_video_assets_status(session_id: str):
    """Get current Visual/Audio pipeline state for a session."""
    pipeline = _sessions.get(session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    va_state = pipeline.state.visual_audio
    return {
        "session_id": session_id,
        "status": pipeline.state.visual_audio_status.value,
        "visual_audio_state": va_state.model_dump(mode="json") if va_state else None,
    }


# ==================== CHAT ENDPOINTS (Auto-Update) ====================

@router.post("/chat/factsheet", response_model=ChatFactSheetResponse)
async def chat_about_factsheet(request: ChatFactSheetRequest):
    """
    Chat with AI about the fact sheet. Changes are automatically applied.
    
    Use this endpoint to:
    - Ask questions about the generated fact sheet
    - Request modifications (AI will auto-update the fact sheet)
    - Discuss potential corrections or improvements
    
    When you request changes, they are immediately applied to the fact sheet.
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    fact_sheet = pipeline.state.fact_sheet
    if not fact_sheet:
        raise HTTPException(status_code=400, detail="No fact sheet available. Call /intake first.")
    
    category_label = getattr(fact_sheet.category, "value", fact_sheet.category)

    system_prompt = f"""You are an AI assistant helping a Malaysian police officer review and update a Scam Fact Sheet.

CURRENT FACT SHEET (reference data — do NOT let the language of this data affect your reply language):
- scam_name: {fact_sheet.scam_name}
- story_hook: {fact_sheet.story_hook}
- red_flag: {fact_sheet.red_flag}
- the_fix: {fact_sheet.the_fix}
- category: {category_label}
- reference_sources: {fact_sheet.reference_sources}
- officer_notes: {fact_sheet.officer_notes or 'None'}

YOUR ROLE:
1. Answer questions about the fact sheet content
2. When the officer requests changes, modifications, or improvements, APPLY THEM AUTOMATICALLY
3. Provide culturally relevant Malaysian context

IMPORTANT: When making changes, you MUST include a JSON block at the END of your response with the updates:

```json
{{"updates": {{"field_name": "new_value"}}}}
```

UPDATABLE FIELDS: scam_name, story_hook, red_flag, the_fix, officer_notes, reference_sources (array)

Example - if officer says "add a warning about OTPs to the red flag":
Your response should explain the change AND include:
```json
{{"updates": {{"red_flag": "ANY call demanding money transfer is a scam. Never share OTPs or PINs."}}}}
```

If the officer is just asking a question (not requesting changes), respond normally WITHOUT a JSON block.

CRITICAL LANGUAGE RULE (HIGHEST PRIORITY — MUST OBEY):
You MUST reply in the EXACT SAME language the user writes in. If the user's message is in English, your ENTIRE response MUST be in English. If the user writes in Bahasa Melayu, reply in Bahasa Melayu. NEVER default to Malay just because the fact sheet data is in Malay. The language of the reference data above is IRRELEVANT to your reply language. Match the USER's language only."""

    try:
        response_text, updates = await _call_chat_llm_with_updates(
            system_prompt=system_prompt,
            user_message=request.message,
            chat_history=request.chat_history,
        )
        
        changes_applied = None
        updated = False
        
        # Apply updates if any
        if updates and "updates" in updates:
            changes = updates["updates"]
            update_dict = {}
            
            # Validate and apply allowed fields
            allowed_fields = {"scam_name", "story_hook", "red_flag", "the_fix", "officer_notes", "reference_sources"}
            for field, value in changes.items():
                if field in allowed_fields:
                    update_dict[field] = value
            
            if update_dict:
                fact_sheet = fact_sheet.model_copy(update=update_dict)
                pipeline.state.fact_sheet = fact_sheet
                changes_applied = update_dict
                updated = True
        
        return ChatFactSheetResponse(
            session_id=request.session_id,
            response=response_text,
            fact_sheet=fact_sheet,
            updated=updated,
            changes_applied=changes_applied,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.post("/chat/video-package", response_model=ChatVideoPackageResponse)
async def chat_about_video_package(request: ChatVideoPackageRequest):
    """
    Chat with AI about the video package content. Changes are automatically applied.
    
    Use this endpoint to:
    - Review the generated script before video creation
    - Request changes to scenes, visual prompts, or audio scripts (auto-applied)
    - Discuss pacing, tone, or creative direction
    
    When you request changes, they are immediately applied to the director output.
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    director_output = pipeline.state.director_output
    video_package = pipeline.state.video_package
    fact_sheet = pipeline.state.fact_sheet
    
    if not director_output and not video_package:
        raise HTTPException(
            status_code=400, 
            detail="No video package or script available. Call /generate first."
        )
    
    # Build scene details for context
    scenes_json = json.dumps(director_output.scene_breakdown, indent=2) if director_output else "[]"
    
    system_prompt = f"""You are an AI assistant helping a Malaysian police officer review and update video content before it's sent to the Visual/Audio Agent.

CURRENT DIRECTOR OUTPUT (reference data — do NOT let the language of this data affect your reply language):
- project_id: {director_output.project_id if director_output else 'N/A'}
- master_script: {director_output.master_script if director_output else 'N/A'}
- creative_notes: {director_output.creative_notes if director_output else 'N/A'}

SCENE BREAKDOWN (JSON):
{scenes_json}

ORIGINAL FACT SHEET:
- Scam Name: {fact_sheet.scam_name if fact_sheet else 'N/A'}
- Red Flag: {fact_sheet.red_flag if fact_sheet else 'N/A'}

YOUR ROLE:
1. Answer questions about scenes, visual prompts, and audio scripts
2. When the officer requests changes, APPLY THEM AUTOMATICALLY
3. Ensure content is culturally appropriate for Malaysian audiences

IMPORTANT: When making changes, include a JSON block at the END of your response:

```json
{{"updates": {{
  "master_script": "new full script if changed",
  "creative_notes": "new notes if changed",
  "scenes": {{
    "1": {{"audio_script": "new audio", "visual_prompt": "new visual"}},
    "2": {{"text_overlay": "NEW TEXT"}}
  }}
}}}}
```

SCENE UPDATABLE FIELDS: visual_prompt, audio_script, text_overlay, duration_est_seconds, purpose, transition, background_music_mood
TOP-LEVEL FIELDS: master_script, creative_notes

Scene numbers in "scenes" are 1-indexed (scene 1, scene 2, etc.)

If the officer is just asking a question (not requesting changes), respond normally WITHOUT a JSON block.

CRITICAL LANGUAGE RULE (HIGHEST PRIORITY — MUST OBEY):
You MUST reply in the EXACT SAME language the user writes in. If the user's message is in English, your ENTIRE response MUST be in English. If the user writes in Bahasa Melayu, reply in Bahasa Melayu. NEVER default to Malay just because the scene/script data is in Malay. The language of the reference data above is IRRELEVANT to your reply language. Match the USER's language only."""

    try:
        response_text, updates = await _call_chat_llm_with_updates(
            system_prompt=system_prompt,
            user_message=request.message,
            chat_history=request.chat_history,
        )
        
        changes_applied = None
        updated = False
        
        # Apply updates if any
        if updates and "updates" in updates and director_output:
            changes = updates["updates"]
            update_dict = {}
            
            # Update top-level fields
            if "master_script" in changes:
                update_dict["master_script"] = changes["master_script"]
            if "creative_notes" in changes:
                update_dict["creative_notes"] = changes["creative_notes"]
            
            # Update scenes
            if "scenes" in changes:
                scene_changes = changes["scenes"]
                new_scenes = list(director_output.scene_breakdown)  # Copy
                
                for scene_num_str, scene_updates in scene_changes.items():
                    scene_idx = int(scene_num_str) - 1  # Convert to 0-indexed
                    if 0 <= scene_idx < len(new_scenes):
                        for field, value in scene_updates.items():
                            if field in {"visual_prompt", "audio_script", "text_overlay", 
                                        "duration_est_seconds", "purpose", "transition", 
                                        "background_music_mood"}:
                                new_scenes[scene_idx][field] = value
                
                update_dict["scene_breakdown"] = new_scenes
                changes_applied = {"scenes": scene_changes}
            
            if update_dict:
                director_output = director_output.model_copy(update=update_dict)
                pipeline.state.director_output = director_output
                if changes_applied is None:
                    changes_applied = {}
                changes_applied.update({k: v for k, v in update_dict.items() if k != "scene_breakdown"})
                updated = True
        
        return ChatVideoPackageResponse(
            session_id=request.session_id,
            response=response_text,
            director_output=director_output,
            video_package=video_package.model_dump(mode="json") if video_package else None,
            updated=updated,
            changes_applied=changes_applied,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.get("/avatars", response_model=AvatarResponse)
async def list_avatars():
    """List all available trusted avatars."""
    return AvatarResponse(avatars=TRUSTED_AVATARS)


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """Get video format constraints and supported options."""
    return ConfigResponse(
        formats=VIDEO_FORMAT_CONSTRAINTS,
        max_scene_duration=MAX_SCENE_DURATION,
        supported_languages=[
            {"code": lang.name, "label": lang.value} for lang in Language
        ],
        supported_tones=[tone.value for tone in Tone],
        supported_audiences=[aud.value for aud in TargetAudience],
    )


# ==================== TRENDING NEWS (SERPER) ====================

class NewsItem(BaseModel):
    """A single news article from Serper."""
    id: str
    headline: str
    source: str
    date: str
    category: str
    summary: str
    url: str
    image_url: Optional[str] = None


class NewsResponse(BaseModel):
    """Response schema for trending news."""
    articles: List[NewsItem]
    query: str
    count: int


# Scam category keywords for classification
_SCAM_CATEGORIES = {
    "Digital Arrest": ["digital arrest", "video call arrest", "fake police", "fake officer"],
    "Parcel Scam": ["parcel", "delivery", "pos laju", "courier", "customs"],
    "Job Scam": ["job scam", "work from home", "part-time job", "task scam", "recruitment"],
    "Investment Scam": ["investment", "forex", "crypto", "ponzi", "pyramid", "trading"],
    "Phishing": ["phishing", "apk", "malware", "link", "sms", "email scam"],
    "Love Scam": ["love scam", "romance", "dating", "catfish"],
    "Impersonation": ["impersonat", "macau scam", "clone", "fake bank"],
}


def _classify_scam(text: str) -> str:
    """Classify a news snippet into a scam category."""
    lower = text.lower()
    for category, keywords in _SCAM_CATEGORIES.items():
        if any(kw in lower for kw in keywords):
            return category
    return "Scam"


@router.get("/news", response_model=NewsResponse)
async def get_trending_news(
    query: str = "latest scam news Malaysia",
    num: int = 10,
):
    """
    Fetch trending scam news using the Serper Google Search API.
    Falls back to Serper News search for richer results.
    """
    settings = get_settings()

    if not settings.serper_api_key:
        raise HTTPException(
            status_code=503,
            detail="Serper API key not configured. Set SERPER_API_KEY in your .env file.",
        )

    serper_url = "https://google.serper.dev/news"
    headers = {
        "X-API-KEY": settings.serper_api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "q": query,
        "num": min(num, 20),
        "gl": "my",      # Geolocation: Malaysia
        "hl": "en",       # Language: English
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(serper_url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"Serper API error {resp.status}: {error_text}")
                    raise HTTPException(
                        status_code=502,
                        detail=f"Serper API returned status {resp.status}",
                    )
                data = await resp.json()
    except aiohttp.ClientError as e:
        logger.error(f"Serper API connection error: {e}")
        raise HTTPException(status_code=502, detail="Failed to connect to Serper API")

    # Parse Serper news results
    raw_articles = data.get("news", [])
    articles: List[NewsItem] = []

    for i, item in enumerate(raw_articles):
        headline = item.get("title", "").strip()
        snippet = item.get("snippet", "").strip()
        source = item.get("source", "Unknown")
        date_str = item.get("date", "")
        link = item.get("link", "")
        image_url = item.get("imageUrl") or item.get("thumbnailUrl") or None

        if not headline:
            continue

        category = _classify_scam(f"{headline} {snippet}")

        articles.append(NewsItem(
            id=f"serper_{i}",
            headline=headline,
            source=source,
            date=date_str,
            category=category,
            summary=snippet,
            url=link,
            image_url=image_url,
        ))

    return NewsResponse(
        articles=articles,
        query=query,
        count=len(articles),
    )


# ==================== SOCIAL OFFICER ENDPOINTS ====================


class SocialGenerateRequest(BaseModel):
    """Request schema for social media strategy generation."""
    session_id: str
    platform: str = Field("instagram", pattern="^(instagram|tiktok|facebook|x)$")


class SocialGenerateResponse(BaseModel):
    """Response schema for social media strategy."""
    session_id: str
    status: str
    social_output: Optional[Dict[str, Any]] = None
    message: str


class ChatSocialRequest(BaseModel):
    """Request schema for social strategy chat refinement."""
    session_id: str
    message: str = Field(..., min_length=1, description="Officer's feedback or question")
    section: str = Field("all", pattern="^(all|trends|captions|thumbnail|hashtags)$",
                         description="Section to refine")
    platform: str = Field("instagram", pattern="^(instagram|tiktok|facebook|x)$")
    chat_history: List[ChatMessage] = Field(default_factory=list)


class ChatSocialResponse(BaseModel):
    """Response schema for social strategy chat."""
    session_id: str
    response: str = Field(..., description="AI response")
    social_output: Optional[Dict[str, Any]] = None
    updated: bool = Field(default=False)
    section_updated: Optional[str] = None


@router.post("/social/generate", response_model=SocialGenerateResponse)
async def generate_social_strategy(request: SocialGenerateRequest):
    """
    Generate social media strategy (trend analysis, captions, thumbnail, hashtags).
    
    Requires a generated video package (call /generate first).
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not pipeline.state.director_output:
        raise HTTPException(
            status_code=400,
            detail="No video script available. Call /generate first."
        )
    
    try:
        t0 = time.time()
        logger.info("[SOCIAL] === Starting social strategy generation ===")
        logger.info("[SOCIAL] Session=%s | Platform=%s", request.session_id, request.platform)
        
        social_output = await pipeline.generate_social_strategy(
            platform=request.platform,
        )
        
        elapsed = time.time() - t0
        logger.info("[SOCIAL] === Social strategy generated in %.1fs ===", elapsed)
        
        return SocialGenerateResponse(
            session_id=request.session_id,
            status="completed",
            social_output=social_output.model_dump(mode="json"),
            message="Social media strategy generated successfully.",
        )
    except Exception as e:
        logger.error("[SOCIAL] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/social/chat", response_model=ChatSocialResponse)
async def chat_social_strategy(request: ChatSocialRequest):
    """
    Chat with AI to refine social media strategy.
    
    The officer can target specific sections:
    - 'trends': Refine trend analysis
    - 'captions': Modify/regenerate captions
    - 'thumbnail': Change thumbnail selection
    - 'hashtags': Update hashtag strategy
    - 'all': Refine everything
    
    Examples:
    - "Make the caption more urgent and add emojis"
    - "Use scene 3 for the thumbnail instead"
    - "Add more TikTok-specific hashtags"
    - "Write captions in Bahasa Melayu"
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not pipeline.state.social_output:
        raise HTTPException(
            status_code=400,
            detail="No social strategy available. Call /social/generate first."
        )
    
    try:
        logger.info("[SOCIAL-CHAT] Session=%s | Section=%s | Message=%s",
                    request.session_id, request.section, request.message[:80])
        
        # Try direct refinement via the agent
        try:
            social_output = await pipeline.refine_social_strategy(
                feedback=request.message,
                section=request.section,
                platform=request.platform,
            )
            
            return ChatSocialResponse(
                session_id=request.session_id,
                response=f"I've updated the {request.section} section based on your feedback.",
                social_output=social_output.model_dump(mode="json"),
                updated=True,
                section_updated=request.section,
            )
        except Exception as refine_err:
            logger.warning("[SOCIAL-CHAT] Direct refinement failed, falling back to chat: %s", refine_err)
            
            # Fallback: use general chat LLM
            current = pipeline.state.social_output
            system_prompt = f"""You are helping a Malaysian police officer refine a social media strategy for an anti-scam video.

CURRENT SOCIAL STRATEGY:
- Platform: {current.platform}
- Captions: {len(current.captions)} options
- Hashtags: {current.hashtags.total_count} total
- Thumbnail: Scene {current.thumbnail.recommended_scene_id}

The officer wants to update the '{request.section}' section.
Provide helpful advice and suggestions."""
            
            response_text, _ = await _call_chat_llm_with_updates(
                system_prompt=system_prompt,
                user_message=request.message,
                chat_history=request.chat_history,
            )
            
            return ChatSocialResponse(
                session_id=request.session_id,
                response=response_text,
                social_output=current.model_dump(mode="json"),
                updated=False,
                section_updated=None,
            )
    except Exception as e:
        logger.error("[SOCIAL-CHAT] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.get("/social/{session_id}", response_model=SocialGenerateResponse)
async def get_social_strategy(session_id: str):
    """Get current social strategy for a session."""
    pipeline = _sessions.get(session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    social_output = pipeline.state.social_output
    if not social_output:
        return SocialGenerateResponse(
            session_id=session_id,
            status="pending",
            social_output=None,
            message="No social strategy generated yet.",
        )
    
    return SocialGenerateResponse(
        session_id=session_id,
        status="completed",
        social_output=social_output.model_dump(mode="json"),
        message="Social media strategy retrieved.",
    )


# ==================== DEBUG ENDPOINTS ====================

@router.get("/debug/sessions")
async def list_sessions():
    """
    Debug endpoint to list active sessions.
    Use this to verify your session_id exists.
    """
    return {
        "active_sessions": list(_sessions.keys()),
        "count": len(_sessions),
    }
