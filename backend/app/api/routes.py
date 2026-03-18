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
    video_format: str = Field("reel", pattern="^(reel|story|post|landscape)$")
    video_duration_seconds: Optional[int] = Field(None, ge=8, le=180, description="Video duration in seconds")
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
    character_descriptions: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Updated character descriptions and reference images when character roster changes",
    )
    updated: bool = Field(default=False, description="Whether changes were applied")
    changes_applied: Optional[Dict[str, Any]] = Field(None, description="Fields/scenes that were updated")


class ChatCharacterRequest(BaseModel):
    """Request schema for character refinement chat."""
    session_id: str
    message: str = Field(..., min_length=1, description="User's question or request about characters")
    chat_history: List[ChatMessage] = Field(default_factory=list, description="Previous messages (frontend-managed)")


class ChatCharacterResponse(BaseModel):
    """Response schema for character refinement chat."""
    session_id: str
    response: str = Field(..., description="AI response")
    updated_characters: Optional[List[Dict[str, Any]]] = Field(None, description="Updated character list if changes applied")
    updated: bool = Field(default=False, description="Whether characters were updated")


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
            video_duration_seconds=request.video_duration_seconds,
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
        # Reset prior VA state for fresh /generate runs in the same session.
        # Otherwise stale character/script artifacts can leak into the new script.
        if pipeline.state:
            pipeline.state.visual_audio = None

        t5 = time.time()
        logger.info("[GENERATE] Step 5 — Visual/Audio Agent stages 1-4: character descriptions + images...")
        character_descriptions_data = None
        recommended_characters = list(director_output.recommended_characters or [])
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
            # Track the initial language so /video-assets can detect language switches
            if pipeline.state.visual_audio:
                pipeline.state.visual_audio.current_language = first_lang_code
            
            # Build character descriptions with base64-encoded images
            character_descriptions_data = []
            char_ref_by_role = {r.role: r for r in va_state.character_ref_images}
            
            if va_state.character_descriptions:
                # Keep canonical Director role order to stay in sync with Studio scenes.
                canonical_roles = recommended_characters or [c.role for c in va_state.character_descriptions.characters]
                desc_by_role = {c.role: c for c in va_state.character_descriptions.characters}
                for role in canonical_roles:
                    char = desc_by_role.get(role)
                    if not char:
                        continue
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
            
            logger.info("[GENERATE] Step 5 — Character generation done (%.1fs) — %d canonical characters, %d images",
                        time.time() - t5, len(recommended_characters), len(va_state.character_ref_images))
        except Exception as e:
            logger.error("[GENERATE] Step 5 — Character generation failed: %s", e, exc_info=True)
            character_descriptions_data = None

        # Final fallback: ensure we always have Director Agent character names from script.
        if not recommended_characters and director_output.recommended_characters:
            logger.info("[GENERATE] Step 5 — Using Director Agent character names as canonical list (%d chars)",
                        len(director_output.recommended_characters))
            recommended_characters = list(director_output.recommended_characters)

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
    requested_language = request.language_code
    available = list(video_inputs.keys())

    effective_language_code = requested_language
    target_language: str | None = None

    if requested_language in video_inputs:
        video_input = video_inputs[requested_language]
    else:
        # If a VeoScript already exists, support on-demand language switching by
        # translating dialogue only, while reusing existing character/scene assets.
        if pipeline.state.visual_audio and pipeline.state.visual_audio.veo_script:
            base_language = pipeline.state.visual_audio.current_language or "en"
            if base_language not in video_inputs:
                base_language = "en" if "en" in video_inputs else available[0]
            video_input = video_inputs[base_language]
            effective_language_code = base_language
            target_language = requested_language
            logger.info(
                "[VIDEO-ASSETS] Requested language '%s' not in package. Using base '%s' with dialogue-only translation. Available=%s",
                requested_language,
                base_language,
                available,
            )
        elif "en" in video_inputs:
            logger.warning(
                "[VIDEO-ASSETS] Requested language '%s' not in package and no existing VeoScript. Falling back to 'en'. Available=%s",
                requested_language,
                available,
            )
            effective_language_code = "en"
            video_input = video_inputs[effective_language_code]
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Language '{requested_language}' not in package. Available: {available}"
            )
    
    # Detect language switch for languages that already exist in the package.
    # (For missing languages, target_language is already set above.)
    if target_language is None and pipeline.state.visual_audio and pipeline.state.visual_audio.veo_script:
        prev_lang = pipeline.state.visual_audio.current_language
        if prev_lang and prev_lang != requested_language:
            target_language = requested_language
    
    try:
        t0 = time.time()
        logger.info("[VIDEO-ASSETS] === Starting visual/audio asset generation ===")
        logger.info("[VIDEO-ASSETS] Session=%s | Language=%s | StopAfter=%s | TranslateDialogue=%s",
                    request.session_id, request.language_code, request.stop_after or "all",
                    target_language or "no")

        va_state = await pipeline.generate_video_assets_stepwise(
            video_input=video_input,
            output_dir=request.output_dir,
            stop_after=request.stop_after,
            target_language=target_language,
        )
        
        # Encode Veo clips as base64 so the browser can play them
        for clip in va_state.veo_clips:
            if clip.path and Path(clip.path).exists() and not clip.video_base64:
                try:
                    with open(clip.path, "rb") as f:
                        b64 = base64.b64encode(f.read()).decode("utf-8")
                        clip.video_base64 = f"data:video/mp4;base64,{b64}"
                except Exception as enc_err:
                    logger.warning("[VIDEO-ASSETS] Failed to encode clip %s: %s", clip.path, enc_err)
        
        stopped = request.stop_after or "veo_clips"
        total = time.time() - t0
        logger.info("[VIDEO-ASSETS] === Completed through '%s' in %.1fs ===", stopped, total)

        return VideoAssetsResponse(
            session_id=request.session_id,
            status="completed" if not request.stop_after else f"completed_through_{stopped}",
            language_code=(target_language or effective_language_code),
            visual_audio_state=va_state.model_dump(mode="json"),
            message=(
                f"Visual/Audio assets generated through stage: {stopped}"
                if target_language or effective_language_code == request.language_code
                else f"Requested language '{request.language_code}' unavailable; generated using '{effective_language_code}' package through stage: {stopped}"
            ),
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

    When the officer requests changes, the AI updates the scene visual_prompt
    in the director output so the next preview-frame generation reflects them.
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")

    if not pipeline.state.video_package:
        raise HTTPException(
            status_code=400,
            detail="Preview frames not available. Generate preview frames first.",
        )

    director_output = pipeline.state.director_output
    scenes_json = json.dumps(director_output.scene_breakdown, indent=2) if director_output else "[]"

    system_prompt = f"""You are an AI assistant helping a Malaysian police officer refine PREVIEW FRAMES for a scam awareness video.

CURRENT SCENES (reference data):
{scenes_json}

YOUR ROLE:
1. Respond conversationally to the officer's request about visual changes.
2. When the officer asks to change a scene's visuals, APPLY THE CHANGES to the visual_prompt.

IMPORTANT: When making changes, include a JSON block at the END of your response:

```json
{{"updates": {{
  "scenes": {{
    "1": {{"visual_prompt": "Updated visual description for scene 1..."}},
    "2": {{"visual_prompt": "Updated visual description for scene 2..."}}
  }}
}}}}
```

Scene numbers are 1-indexed. Only include scenes that changed.
Updatable fields: visual_prompt, audio_script, background_music_mood

If the officer is just asking a question, respond normally WITHOUT a JSON block.

CRITICAL LANGUAGE RULE:
Reply in the EXACT SAME language the user writes in."""

    try:
        chat_history_objects: List[ChatMessage] = []
        if request.chat_history:
            for msg in request.chat_history:
                if isinstance(msg, dict):
                    chat_history_objects.append(ChatMessage(
                        role=msg.get("role", "user"),
                        content=msg.get("content", "")
                    ))
                else:
                    chat_history_objects.append(msg)

        response_text, updates = await _call_chat_llm_with_updates(
            system_prompt=system_prompt.strip(),
            user_message=request.message,
            chat_history=chat_history_objects,
        )

        updated = False
        updated_frames = None

        # Apply scene visual_prompt updates to director_output
        if updates and "updates" in updates and "scenes" in updates["updates"] and director_output:
            scene_changes = updates["updates"]["scenes"]
            new_scenes = list(director_output.scene_breakdown)

            for scene_num_str, scene_updates in scene_changes.items():
                scene_idx = int(scene_num_str) - 1
                if 0 <= scene_idx < len(new_scenes):
                    for field, value in scene_updates.items():
                        if field in {"visual_prompt", "audio_script", "background_music_mood"}:
                            new_scenes[scene_idx][field] = value

            director_output = director_output.model_copy(update={"scene_breakdown": new_scenes})
            pipeline.state.director_output = director_output
            updated = True

            # Re-assemble video_package so all language versions reflect the updated scenes
            if (pipeline.state.fact_sheet and pipeline.state.creator_config
                    and pipeline.state.linguistic_output and pipeline.state.sensitivity_output):
                pipeline.assemble_video_package(
                    pipeline.state.fact_sheet,
                    pipeline.state.creator_config,
                    director_output,
                    pipeline.state.linguistic_output,
                    pipeline.state.sensitivity_output,
                )

            # Selectively clear VA caches only for changed segments
            if pipeline.state.visual_audio:
                va = pipeline.state.visual_audio
                changed_seg_ids = {int(s) for s in scene_changes}
                va.veo_script = None  # cheap LLM call to regenerate
                va.clip_ref_images = [
                    e for e in va.clip_ref_images
                    if e.segment_index not in changed_seg_ids
                ]
                va.clip_ref_prompts = [
                    p for p in va.clip_ref_prompts
                    if p.get("segment_index") not in changed_seg_ids
                ]

        return ChatPreviewFramesResponse(
            response=response_text,
            updated_frames=None,  # Frontend should re-trigger /preview-frames to get new images
            updated=updated,
        )
    except Exception as e:
        logger.error("[CHAT-PREVIEW-FRAMES] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process chat message")


@router.post("/chat/characters", response_model=ChatCharacterResponse)
async def chat_about_characters(request: ChatCharacterRequest):
    """
    Chat with AI to refine character descriptions. Changes are automatically applied.

    Use this endpoint to:
    - Ask questions about specific characters
    - Request changes to character roles, types, or descriptions
    - Adjust character visuals for cultural appropriateness
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get current characters from visual/audio state or director output
    va_state = pipeline.state.visual_audio
    director_output = pipeline.state.director_output

    current_chars = []
    if va_state and va_state.character_descriptions:
        for c in va_state.character_descriptions.characters:
            current_chars.append({
                "role": c.role,
                "type": c.type,
                "description": c.description_for_image_generation,
            })
    elif director_output and director_output.recommended_characters:
        for role in director_output.recommended_characters:
            lower = role.lower()
            is_person = any(k in lower for k in [
                "victim", "retiree", "narrator", "officer", "inspektor",
                "inspector", "police", "parent", "elderly", "teacher", "student",
            ])
            current_chars.append({
                "role": role,
                "type": "person" if is_person else "scammer",
                "description": "",
            })

    if not current_chars:
        raise HTTPException(
            status_code=400,
            detail="No characters available. Generate scenes in The Studio first.",
        )

    chars_json = json.dumps(current_chars, indent=2)

    # Get configured language from pipeline state
    configured_language = "English"
    if pipeline.state.creator_config and pipeline.state.creator_config.languages:
        configured_language = getattr(
            pipeline.state.creator_config.languages[0], "value",
            pipeline.state.creator_config.languages[0],
        )

    system_prompt = f"""You are an AI assistant helping a Malaysian police officer refine CHARACTER DESCRIPTIONS for a scam awareness video.

CURRENT CHARACTERS:
{chars_json}

VIDEO LANGUAGE: {configured_language}

YOUR ROLE:
1. Answer questions about characters (role, visual description, type)
2. When the officer requests changes, APPLY THEM AUTOMATICALLY
3. Characters of type "person" are real people (victims, officers, narrators)
4. Characters of type "scammer" are always anonymous/featureless silhouettes

IMPORTANT: When making changes, include a JSON block at the END of your response:

```json
{{"updates": {{
  "characters": [
    {{"role": "Character Name", "type": "person", "description": "Updated full-body description..."}},
    ...
  ]
}}}}
```

Rules:
- Include ALL characters in the update (not just changed ones)
- "type" must be "person" or "scammer"
- "description" should be a full-body visual description for image generation
- Scammers: always featureless silhouettes, never real faces
- Persons: Malaysian ethnicity, age, attire — full body head to toe

If the officer is just asking a question (not requesting changes), respond normally WITHOUT a JSON block.

CRITICAL LANGUAGE RULE (HIGHEST PRIORITY — MUST OBEY):
You MUST reply in the EXACT SAME language the user writes in."""

    try:
        response_text, updates = await _call_chat_llm_with_updates(
            system_prompt=system_prompt,
            user_message=request.message,
            chat_history=request.chat_history,
        )

        updated = False
        updated_characters = None

        if updates and "updates" in updates and "characters" in updates["updates"]:
            raw_chars = updates["updates"]["characters"]
            updated_characters = []
            for c in raw_chars:
                updated_characters.append({
                    "role": c.get("role", "Unknown"),
                    "type": c.get("type", "person"),
                    "description": c.get("description", ""),
                    "image_url": None,
                    "image_base64": None,
                })
            updated = True

            # Update the VA state character descriptions
            from ..models.schemas import CharacterDescription, CharacterDescriptions
            new_descs = [
                CharacterDescription(
                    role=c["role"],
                    type=c["type"],
                    description_for_image_generation=c["description"],
                )
                for c in updated_characters
            ]
            new_char_descs = CharacterDescriptions(characters=new_descs)

            if va_state:
                # Diff old vs new to find which roles actually changed
                old_chars_by_role = {}
                if va_state.character_descriptions:
                    old_chars_by_role = {
                        c.role: (c.type, c.description_for_image_generation)
                        for c in va_state.character_descriptions.characters
                    }
                roles_to_regenerate = set()
                for c in updated_characters:
                    old_entry = old_chars_by_role.get(c["role"])
                    if old_entry is None or old_entry != (c["type"], c["description"]):
                        roles_to_regenerate.add(c["role"])

                va_state.character_descriptions = new_char_descs

                # Selectively clear clip refs only for segments involving changed characters
                if roles_to_regenerate and va_state.veo_script:
                    affected_segments = {
                        seg.segment_index
                        for seg in va_state.veo_script.segments
                        if roles_to_regenerate & set(seg.characters_involved)
                    }
                    if affected_segments:
                        va_state.clip_ref_images = [
                            e for e in va_state.clip_ref_images
                            if e.segment_index not in affected_segments
                        ]
                        va_state.clip_ref_prompts = [
                            p for p in va_state.clip_ref_prompts
                            if p.get("segment_index") not in affected_segments
                        ]
                    else:
                        # Role mapping could be stale (rename/restructure); safest is full clear
                        va_state.clip_ref_images = []
                        va_state.clip_ref_prompts = []
                elif roles_to_regenerate:
                    # No veo_script to determine segments — clear all clip refs (safe fallback)
                    va_state.clip_ref_images = []
                    va_state.clip_ref_prompts = []
            else:
                roles_to_regenerate = None  # full regeneration
            
            # Regenerate character reference images (selective if possible)
            try:
                va_agent = pipeline.visual_audio_agent
                va_agent._ensure_client()

                # Sync agent internal state from pipeline so selective
                # regeneration can find existing images to preserve
                if va_state and va_state.character_ref_images:
                    va_agent._state.character_ref_images = va_state.character_ref_images
                if va_state and va_state.character_descriptions:
                    va_agent._state.character_descriptions = va_state.character_descriptions

                output_dir = Path(va_agent._state.output_dir or "output") / "character_refs"
                if roles_to_regenerate is not None and len(roles_to_regenerate) == 0:
                    # No effective character changes; keep existing refs to avoid unnecessary regeneration cost.
                    char_refs = va_state.character_ref_images if va_state else va_agent._state.character_ref_images
                else:
                    char_refs = await va_agent.generate_character_ref_images(
                        new_char_descs,
                        output_dir,
                        roles_to_regenerate=roles_to_regenerate,
                    )
                
                if va_state:
                    va_state.character_ref_images = char_refs
                
                # Encode generated images as base64 and attach to response
                char_ref_by_role = {r.role: r for r in char_refs}
                for char_entry in updated_characters:
                    ref = char_ref_by_role.get(char_entry["role"])
                    if ref and ref.path and Path(ref.path).exists():
                        try:
                            with open(ref.path, "rb") as f:
                                b64 = base64.b64encode(f.read()).decode("utf-8")
                                char_entry["image_base64"] = f"data:image/png;base64,{b64}"
                        except Exception as img_err:
                            logger.warning("[CHAT-CHARACTERS] Failed to encode image %s: %s", ref.path, img_err)
                
                logger.info("[CHAT-CHARACTERS] Regenerated %d character images", len(char_refs))
            except Exception as img_err:
                logger.warning("[CHAT-CHARACTERS] Image regeneration failed (non-fatal): %s", img_err)

        return ChatCharacterResponse(
            session_id=request.session_id,
            response=response_text,
            updated_characters=updated_characters,
            updated=updated,
        )
    except Exception as e:
        logger.error("[CHAT-CHARACTERS] Failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


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


@router.get("/captions/{session_id}")
async def get_captions(session_id: str):
    """
    Return caption/dialogue texts per segment per language from the video package.
    
    Response format:
    {
      "session_id": "...",
      "captions": {
        "en": [{"segment_id": 1, "text": "Hello?"},...],
        "bm": [{"segment_id": 1, "text": "Hello?"},...]
      }
    }
    """
    pipeline = _sessions.get(session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")
    
    vp = pipeline.state.video_package
    if not vp or not vp.video_inputs:
        raise HTTPException(status_code=400, detail="No video package available.")
    
    def _extract_quoted_dialogue_lines(text: str) -> List[str]:
        import re
        lines: List[str] = []
        for m in re.finditer(r'"([^"]+)"|\'([^\']+)\'', text or ""):
            value = (m.group(1) or m.group(2) or "").strip()
            if value:
                lines.append(value)
        return lines

    def _normalize_caption_text(text: str) -> str:
        quoted = _extract_quoted_dialogue_lines(text or "")
        if quoted:
            return "\n".join(quoted)
        return (text or "").strip()

    captions: Dict[str, List[Dict[str, Any]]] = {}
    for lang_code, vi in vp.video_inputs.items():
        lang_captions = []
        for scene in vi.scenes:
            lang_captions.append({
                "segment_id": scene.scene_id,
                "text": _normalize_caption_text(scene.audio_script or ""),
            })
        captions[lang_code] = lang_captions

    # Also expose captions for the currently generated on-demand language
    # (when it may not exist in video_package.video_inputs).
    va_state = pipeline.state.visual_audio
    if va_state and va_state.veo_script and va_state.current_language:
        if va_state.current_language not in captions:
            captions[va_state.current_language] = [
                {
                    "segment_id": seg.segment_index,
                    "text": "\n".join(_extract_quoted_dialogue_lines(seg.veo_prompt)),
                }
                for seg in va_state.veo_script.segments
            ]
    
    return {"session_id": session_id, "captions": captions}


# ==================== VIDEO EXPORT ====================

class ExportVideoRequest(BaseModel):
    """Request schema for stitched video export."""
    session_id: str
    caption_languages: List[str] = Field(
        default_factory=list,
        description="Language codes for caption overlays (e.g. ['en','bm']). Empty = no captions."
    )


@router.post("/export/video")
async def export_stitched_video(request: ExportVideoRequest):
    """
    Concatenate all Veo clips into a single MP4 file and stream it back.
    Optionally burns in caption overlays in selected languages.
    """
    pipeline = _sessions.get(request.session_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Session not found")

    va_state = pipeline.state.visual_audio
    if not va_state or not va_state.veo_clips:
        raise HTTPException(status_code=400, detail="No video clips available. Generate clips first.")

    # Collect clip file paths in segment order
    clip_paths = []
    for clip in sorted(va_state.veo_clips, key=lambda c: c.segment_index):
        p = Path(clip.path)
        if not p.exists():
            raise HTTPException(status_code=400, detail=f"Clip file missing: {clip.filename}")
        clip_paths.append(str(p))

    if not clip_paths:
        raise HTTPException(status_code=400, detail="No clip files found on disk.")

    def _extract_quoted_dialogue_lines(text: str) -> List[str]:
        """Extract dialogue enclosed in single/double quotes from a prompt."""
        import re
        lines: List[str] = []
        for m in re.finditer(r'"([^"]+)"|\'([^\']+)\'', text or ""):
            value = (m.group(1) or m.group(2) or "").strip()
            if value:
                lines.append(value)
        return lines

    def _normalize_caption_text(text: str) -> str:
        quoted = _extract_quoted_dialogue_lines(text or "")
        if quoted:
            return "\n".join(quoted)
        return (text or "").strip()

    # Build caption texts per segment if requested
    caption_texts: List[str] = []
    if request.caption_languages:
        vp = pipeline.state.video_package
        if vp:
            for clip in sorted(va_state.veo_clips, key=lambda c: c.segment_index):
                seg_idx = clip.segment_index
                parts = []
                for lang_code in request.caption_languages:
                    vi = vp.video_inputs.get(lang_code)
                    if vi:
                        for scene in vi.scenes:
                            if scene.scene_id == seg_idx:
                                parts.append(_normalize_caption_text(scene.audio_script))
                                break
                    elif (
                        va_state.veo_script
                        and va_state.current_language
                        and lang_code == va_state.current_language
                    ):
                        seg = next(
                            (s for s in va_state.veo_script.segments if s.segment_index == seg_idx),
                            None,
                        )
                        if seg:
                            parts.extend(_extract_quoted_dialogue_lines(seg.veo_prompt))
                caption_texts.append("\n".join(parts) if parts else "")
        else:
            caption_texts = [""] * len(clip_paths)

    try:
        import shutil
        import subprocess
        import tempfile

        ffmpeg_bin: Optional[str] = None
        try:
            import imageio_ffmpeg
            ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg_bin = None

        if not ffmpeg_bin:
            # Fallback: resolve ffmpeg from a python interpreter that has imageio_ffmpeg installed.
            # This avoids hard dependency on the uvicorn interpreter site-packages.
            for py_cmd in ["python", "py -3.11"]:
                try:
                    out = subprocess.check_output(
                        f"{py_cmd} -c \"import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())\"",
                        shell=True,
                        text=True,
                    ).strip()
                    if out and Path(out).exists():
                        ffmpeg_bin = out
                        break
                except Exception:
                    continue

        if not ffmpeg_bin:
            ffmpeg_bin = shutil.which("ffmpeg")

        if not ffmpeg_bin:
            raise HTTPException(
                status_code=500,
                detail=(
                    "FFmpeg runtime is not available. Install imageio-ffmpeg in the backend interpreter "
                    "or install ffmpeg on PATH."
                ),
            )

        def _ff_path(p: str) -> str:
            return p.replace("\\", "/").replace("'", "'\\''")

        # Concat using ffmpeg concat demuxer
        concat_file = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8")
        concat_path = concat_file.name
        try:
            for cp in clip_paths:
                concat_file.write(f"file '{_ff_path(cp)}'\n")
        finally:
            concat_file.close()

        stitched_tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        stitched_path = stitched_tmp.name
        stitched_tmp.close()

        concat_cmd = [
            ffmpeg_bin,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_path,
            "-c",
            "copy",
            stitched_path,
        ]

        concat_stderr = ""
        try:
            subprocess.run(concat_cmd, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as concat_err:
            concat_stderr = concat_err.stderr or ""
            logger.warning("[EXPORT] Fast concat failed, retrying with re-encode: %s", concat_err)
            concat_reencode_cmd = [
                ffmpeg_bin,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                concat_path,
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                stitched_path,
            ]
            try:
                subprocess.run(concat_reencode_cmd, check=True, capture_output=True, text=True)
            except subprocess.CalledProcessError as reenc_err:
                # Final fallback: concat filter with explicit inputs (avoids concat demuxer/path issues on Windows).
                reenc_stderr = reenc_err.stderr or ""
                logger.warning("[EXPORT] Re-encode concat failed, retrying with concat-filter fallback: %s", reenc_err)

                has_audio_flags: List[bool] = []
                for cp in clip_paths:
                    probe = subprocess.run(
                        [ffmpeg_bin, "-i", cp, "-f", "null", "-"],
                        capture_output=True,
                        text=True,
                    )
                    stderr_txt = (probe.stderr or "")
                    has_audio_flags.append("Audio:" in stderr_txt)

                all_have_audio = all(has_audio_flags) if has_audio_flags else False
                filter_inputs: List[str] = []
                for i in range(len(clip_paths)):
                    filter_inputs.append(f"[{i}:v:0]")
                    if all_have_audio:
                        filter_inputs.append(f"[{i}:a:0]")

                if all_have_audio:
                    filter_complex = f"{''.join(filter_inputs)}concat=n={len(clip_paths)}:v=1:a=1[v][a]"
                else:
                    filter_complex = f"{''.join(filter_inputs)}concat=n={len(clip_paths)}:v=1:a=0[v]"

                concat_filter_cmd: List[str] = [ffmpeg_bin, "-y"]
                for cp in clip_paths:
                    concat_filter_cmd.extend(["-i", cp])
                concat_filter_cmd.extend([
                    "-filter_complex", filter_complex,
                    "-map", "[v]",
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart",
                ])
                if all_have_audio:
                    concat_filter_cmd.extend(["-map", "[a]", "-c:a", "aac"])
                concat_filter_cmd.append(stitched_path)

                try:
                    subprocess.run(concat_filter_cmd, check=True, capture_output=True, text=True)
                except subprocess.CalledProcessError as final_err:
                    final_stderr = final_err.stderr or ""
                    logger.error(
                        "[EXPORT] Concat failed across all strategies. fast_stderr=%s | reencode_stderr=%s | final_stderr=%s",
                        concat_stderr[:2000],
                        reenc_stderr[:2000],
                        final_stderr[:2000],
                    )
                    raise

        output_path = stitched_path

        # Optional subtitle burn-in from selected caption languages.
        # If subtitle rendering fails, we still return the stitched video.
        if caption_texts and any(t.strip() for t in caption_texts):
            vp = pipeline.state.video_package
            durations: List[int] = []
            if vp and vp.video_inputs:
                first_lang = next(iter(vp.video_inputs.values()))
                dur_by_id = {s.scene_id: int(s.duration_est_seconds or 8) for s in first_lang.scenes}
                for clip in sorted(va_state.veo_clips, key=lambda c: c.segment_index):
                    durations.append(dur_by_id.get(clip.segment_index, 8))
            else:
                durations = [8] * len(caption_texts)

            def _fmt_srt_time(total_seconds: float) -> str:
                ms = int((total_seconds - int(total_seconds)) * 1000)
                sec = int(total_seconds) % 60
                minute = int(total_seconds // 60) % 60
                hour = int(total_seconds // 3600)
                return f"{hour:02d}:{minute:02d}:{sec:02d},{ms:03d}"

            srt_tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False, encoding="utf-8")
            srt_path = srt_tmp.name
            try:
                cursor = 0.0
                idx = 1
                for i, txt in enumerate(caption_texts):
                    cleaned = txt.strip()
                    dur = float(durations[i] if i < len(durations) else 8)
                    if cleaned:
                        start = _fmt_srt_time(cursor)
                        end = _fmt_srt_time(cursor + dur)
                        srt_tmp.write(f"{idx}\n{start} --> {end}\n{cleaned}\n\n")
                        idx += 1
                    cursor += dur
            finally:
                srt_tmp.close()

            caption_tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
            caption_path = caption_tmp.name
            caption_tmp.close()

            sub_path = srt_path.replace("\\", "/").replace(":", "\\:")
            subtitle_cmd = [
                ffmpeg_bin,
                "-y",
                "-i",
                stitched_path,
                "-vf",
                f"subtitles='{sub_path}'",
                "-c:a",
                "copy",
                caption_path,
            ]
            try:
                subprocess.run(subtitle_cmd, check=True, capture_output=True, text=True)
                output_path = caption_path
            except Exception as sub_err:
                logger.warning("[EXPORT] Subtitle burn-in failed, returning plain stitched video: %s", sub_err)

            try:
                os.unlink(srt_path)
            except OSError:
                pass

        tmp_path = output_path
        cleanup_paths = [concat_path, stitched_path]
        if output_path != stitched_path:
            cleanup_paths.append(output_path)

        def iterfile():
            try:
                with open(tmp_path, "rb") as f:
                    while chunk := f.read(1024 * 1024):
                        yield chunk
            finally:
                for p in cleanup_paths:
                    try:
                        if os.path.exists(p):
                            os.unlink(p)
                    except OSError:
                        pass

        project_id = pipeline.state.director_output.project_id if pipeline.state.director_output else "scam-shield"
        filename = f"{project_id}.mp4"

        return StreamingResponse(
            iterfile(),
            media_type="video/mp4",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logger.error("[EXPORT] Failed to stitch video: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Video export failed: {str(e)}")


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
        character_descriptions_data: Optional[List[Dict[str, Any]]] = None
        
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

    # Get configured language
    configured_language = "English"
    configured_tone = "N/A"
    configured_audience = "N/A"
    configured_format = "N/A"
    if pipeline.state.creator_config and pipeline.state.creator_config.languages:
        configured_language = getattr(
            pipeline.state.creator_config.languages[0], "value",
            pipeline.state.creator_config.languages[0],
        )
        configured_tone = getattr(
            pipeline.state.creator_config.tone, "value",
            pipeline.state.creator_config.tone,
        )
        configured_format = pipeline.state.creator_config.video_format
        if pipeline.state.creator_config.target_groups:
            configured_audience = getattr(
                pipeline.state.creator_config.target_groups[0], "value",
                pipeline.state.creator_config.target_groups[0],
            )
    
    system_prompt = f"""You are an AI assistant helping a Malaysian police officer review and update video content before it's sent to the Visual/Audio Agent.

VIDEO LANGUAGE: {configured_language}
SELECTED TONE: {configured_tone}
SELECTED TARGET AUDIENCE: {configured_audience}
SELECTED VIDEO FORMAT: {configured_format}

CURRENT DIRECTOR OUTPUT (reference data — do NOT let the language of this data affect your reply language):
- project_id: {director_output.project_id if director_output else 'N/A'}
- master_script: {director_output.master_script if director_output else 'N/A'}
- creative_notes: {director_output.creative_notes if director_output else 'N/A'}
- characters: {director_output.recommended_characters if director_output else []}

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
    "characters": ["Character A", "Character B", "Character C"],
  "scenes": {{
    "1": {{"audio_script": "new audio", "visual_prompt": "new visual"}},
    "2": {{"text_overlay": "NEW TEXT"}}
  }}
}}}}
```

SCENE UPDATABLE FIELDS: visual_prompt, audio_script, text_overlay, duration_est_seconds, purpose, transition, background_music_mood
TOP-LEVEL FIELDS: master_script, creative_notes, characters

Scene numbers in "scenes" are 1-indexed (scene 1, scene 2, etc.)

If the officer is just asking a question (not requesting changes), respond normally WITHOUT a JSON block.

CRITICAL LANGUAGE RULE (HIGHEST PRIORITY — MUST OBEY):
You MUST reply in the EXACT SAME language the user writes in. If the user's message is in English, your ENTIRE response MUST be in English. If the user writes in Bahasa Melayu, reply in Bahasa Melayu. NEVER default to Malay just because the scene/script data is in Malay. The language of the reference data above is IRRELEVANT to your reply language. Match the USER's language only.

CONTENT CONSISTENCY RULES (MUST OBEY WHEN RETURNING JSON updates):
- For updated audio_script, text_overlay, and master_script, keep content in VIDEO LANGUAGE ({configured_language}) unless the user explicitly asks to change language.
- Preserve selected tone ({configured_tone}), target audience ({configured_audience}), and video format ({configured_format}) unless explicitly requested.
- Keep character roles/persona traits consistent across scenes. Do not introduce contradictory persona changes unless the user asks for it.
- If the user asks to change only one scene, avoid rewriting unrelated scenes.
"""

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
            previous_characters = list(director_output.recommended_characters or [])
            
            # Update top-level fields
            if "master_script" in changes:
                update_dict["master_script"] = changes["master_script"]
            if "creative_notes" in changes:
                update_dict["creative_notes"] = changes["creative_notes"]
            if "characters" in changes and isinstance(changes["characters"], list):
                sanitized_chars = [str(c).strip() for c in changes["characters"] if str(c).strip()]
                if sanitized_chars:
                    update_dict["recommended_characters"] = sanitized_chars
            
            # Update scenes
            if "scenes" in changes:
                scene_changes = changes["scenes"]
                new_scenes = list(director_output.scene_breakdown)  # Copy
                
                for scene_num_str, scene_updates in scene_changes.items():
                    try:
                        scene_idx = int(scene_num_str) - 1  # Convert to 0-indexed
                    except (TypeError, ValueError):
                        continue
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

                # Re-assemble video_package so downstream (Preview / Clips) see updated prompts
                if (pipeline.state.fact_sheet and pipeline.state.creator_config
                        and pipeline.state.linguistic_output and pipeline.state.sensitivity_output):
                    pipeline.assemble_video_package(
                        pipeline.state.fact_sheet,
                        pipeline.state.creator_config,
                        director_output,
                        pipeline.state.linguistic_output,
                        pipeline.state.sensitivity_output,
                    )
                    video_package = pipeline.state.video_package

                # If Studio chat changed character roster, regenerate character descriptions
                # and reference images immediately so Character page doesn't show placeholders.
                if (
                    "recommended_characters" in update_dict
                    and video_package
                    and video_package.video_inputs
                ):
                    try:
                        # Prevent stale role/image reuse: force fresh character stages
                        # before regenerating payload for the Character page.
                        if pipeline.state.visual_audio:
                            pipeline.state.visual_audio.obfuscated_story = None
                            pipeline.state.visual_audio.veo_script = None
                            pipeline.state.visual_audio.character_descriptions = None
                            pipeline.state.visual_audio.character_ref_images = []
                            pipeline.state.visual_audio.clip_ref_images = []
                            pipeline.state.visual_audio.clip_ref_prompts = []

                        first_lang_code = next(iter(video_package.video_inputs))
                        first_video_input = video_package.video_inputs[first_lang_code]
                        va_state = await pipeline.generate_video_assets_stepwise(
                            video_input=first_video_input,
                            output_dir=None,
                            stop_after="char_refs",
                        )

                        desc_by_role = {}
                        if va_state.character_descriptions:
                            desc_by_role = {
                                c.role: c for c in va_state.character_descriptions.characters
                            }
                        ref_by_role = {r.role: r for r in va_state.character_ref_images}

                        character_descriptions_data = []
                        for role in director_output.recommended_characters or []:
                            desc = desc_by_role.get(role)
                            ref = ref_by_role.get(role)
                            entry: Dict[str, Any] = {
                                "role": role,
                                "type": desc.type if desc else "person",
                                "description": desc.description_for_image_generation if desc else "",
                                "image_url": None,
                                "image_base64": None,
                            }
                            if ref and ref.path and Path(ref.path).exists():
                                try:
                                    with open(ref.path, "rb") as f:
                                        b64 = base64.b64encode(f.read()).decode("utf-8")
                                        entry["image_base64"] = f"data:image/png;base64,{b64}"
                                except Exception as img_err:
                                    logger.warning("[CHAT-VIDEO-PACKAGE] Failed to encode char image %s: %s", ref.path, img_err)
                            character_descriptions_data.append(entry)
                    except Exception as char_regen_err:
                        logger.warning("[CHAT-VIDEO-PACKAGE] Character regeneration after roster update failed: %s", char_regen_err)

                # Selectively clear VA caches only for changed segments
                if pipeline.state.visual_audio:
                    va = pipeline.state.visual_audio
                    changed_seg_ids = set()
                    if "scenes" in changes:
                        for s in changes["scenes"]:
                            try:
                                changed_seg_ids.add(int(s))
                            except (TypeError, ValueError):
                                continue
                    characters_changed = (
                        "recommended_characters" in update_dict
                        and update_dict["recommended_characters"] != previous_characters
                    )

                    if characters_changed:
                        # Character roster changed from Studio chat: always force clip refs refresh.
                        # If immediate regeneration failed, also clear char caches for a clean retry.
                        va.obfuscated_story = None
                        va.veo_script = None
                        if character_descriptions_data is None:
                            va.character_descriptions = None
                            va.character_ref_images = []
                        va.clip_ref_images = []
                        va.clip_ref_prompts = []
                        changed_seg_ids = set()

                    va.veo_script = None  # cheap LLM call to regenerate
                    if changed_seg_ids:
                        va.clip_ref_images = [
                            e for e in va.clip_ref_images
                            if e.segment_index not in changed_seg_ids
                        ]
                        va.clip_ref_prompts = [
                            p for p in va.clip_ref_prompts
                            if p.get("segment_index") not in changed_seg_ids
                        ]
                    else:
                        # Non-scene changes (master_script, creative_notes) — clear all clip refs
                        va.clip_ref_images = []
                        va.clip_ref_prompts = []
        
        return ChatVideoPackageResponse(
            session_id=request.session_id,
            response=response_text,
            director_output=director_output,
            video_package=video_package.model_dump(mode="json") if video_package else None,
            character_descriptions=character_descriptions_data,
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


# ==================== PROJECT CRUD (Firestore) ENDPOINTS ====================

from ..auth import get_current_user
from ..database import ProjectRecord, save_project, list_projects, get_project, delete_project
from fastapi import Depends


class SaveProjectRequest(BaseModel):
    project_id: str
    name: str
    scam_type: str = ""
    status: str = "draft"
    data: Dict[str, Any] = Field(default_factory=dict)


@router.post("/projects")
async def save_project_route(
    body: SaveProjectRequest,
    uid: str = Depends(get_current_user),
):
    """Save or update a project for the authenticated user."""
    record = ProjectRecord(
        project_id=body.project_id,
        owner_uid=uid,
        name=body.name,
        scam_type=body.scam_type,
        status=body.status,
        data=body.data,
    )
    doc_id = save_project(record)
    return {"project_id": doc_id, "message": "Project saved."}


@router.get("/projects")
async def list_projects_route(uid: str = Depends(get_current_user)):
    """List all projects for the authenticated user (without full data blobs)."""
    items = list_projects(uid)
    return {"projects": items}


@router.get("/projects/{project_id}")
async def get_project_route(
    project_id: str,
    uid: str = Depends(get_current_user),
):
    """Get a single project with full data."""
    proj = get_project(uid, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@router.delete("/projects/{project_id}")
async def delete_project_route(
    project_id: str,
    uid: str = Depends(get_current_user),
):
    """Delete a project."""
    deleted = delete_project(uid, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted."}


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
