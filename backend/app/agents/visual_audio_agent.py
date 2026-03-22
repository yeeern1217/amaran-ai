"""
Visual/Audio Agent – Transforms pipeline output into Veo-ready video assets.

Stages (mirrors the notebook pipeline):
1. Expand FactSheet + scenes → ObfuscatedScamStory (full narrative + character_roles)
2. Convert scenes → VeoScript (structured veo_prompts per segment)
3. Generate CharacterDescriptions (for image generation)
4. Generate character reference images (2×2 grids via Nano Banana)
5. Generate clip reference frames (start/end per segment)
6. Generate Veo video clips (8s per segment, interpolation mode)

Each stage is an independent async method so the API can call them stepwise.
"""
from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from .base import BaseAgent, AgentConfig, AgentResult
from ..models import (
    FactSheet,
    Scene,
    VisualAudioAgentInput,
    ObfuscatedScamStory,
    ScriptSegment,
    VeoScript,
    CharacterDescription,
    CharacterDescriptions,
    CharacterRefImage,
    ClipRefFramePrompts,
    ClipRefEntry,
    VeoClipEntry,
    VisualAudioPipelineState,
)


logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FLASH_MODEL = "gemini-3-flash-preview"
IMAGE_MODEL = "gemini-2.5-flash-image"
VEO_MODEL = "veo-3.1-fast-generate-preview"
VEO_CLIP_SEC = 8
VEO_COST_PER_SEC = 0.15


NANO_BANANA_STYLE = (
    "Photorealistic, soft key light with subtle fill, neutral grey studio backdrop. "
    "Same character in all four panels—consistent lighting, rendering, and proportions "
    "with the same attire. No text in image."
)

MAX_RETRIES = 8
RETRY_BASE_DELAY = 1  # seconds


# ---------------------------------------------------------------------------
# Input model
# ---------------------------------------------------------------------------
# Maps video format to Veo/image aspect ratio
VIDEO_FORMAT_ASPECT = {
    "reel": "9:16",
    "story": "9:16",
    "post": "1:1",
    "landscape": "16:9",
}


class VisualAudioInput(BaseModel):
    """Input to the Visual/Audio Agent – one language version from the pipeline."""
    project_id: str
    fact_sheet: FactSheet
    scenes: List[Dict[str, Any]]  # Scene dicts from VisualAudioAgentInput
    output_dir: str = Field(default="output", description="Base directory for generated assets")
    video_format: str = Field(default="reel", description="Video format: reel, story, post, or landscape")
    total_duration_seconds: int = Field(default=30, description="Target total video duration")


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------
class VisualAudioAgent(BaseAgent):
    """
    Transforms pipeline VisualAudioAgentInput into video-ready assets.

    Uses Gemini Flash for text/structured generation, Nano Banana (Flash Image)
    for reference images, and Veo for 8-second video clips.
    """

    def __init__(self, config: AgentConfig):
        super().__init__(config)
        self._state = VisualAudioPipelineState()

    @property
    def agent_name(self) -> str:
        return "VisualAudioAgent"

    @property
    def agent_role(self) -> str:
        return (
            "Transforms pipeline scene scripts into production-ready video assets: "
            "obfuscated story, Veo script, character references, clip references, "
            "and final Veo video clips."
        )

    # -- Required abstract methods (unused directly – we expose stage methods) --
    def build_prompt(self, input_data: Any) -> str:  # pragma: no cover
        return ""

    def parse_response(self, response: str, input_data: Any) -> Any:  # pragma: no cover
        return response

    async def process(self, input_data: VisualAudioInput) -> AgentResult:
        """Run the full visual/audio pipeline end-to-end."""
        start_ms = time.monotonic()
        try:
            self._ensure_client()
            base_dir = Path(input_data.output_dir)
            base_dir.mkdir(parents=True, exist_ok=True)
            self._state.output_dir = str(base_dir)
            self._state.video_format = input_data.video_format

            # Stage 1: Expand to full story
            story = await self.expand_to_story(input_data.fact_sheet, input_data.scenes)

            # Stage 2: Generate Veo script
            script = await self.generate_veo_script(story, input_data.scenes)

            # Stage 3: Character descriptions
            char_descs = await self.generate_character_descriptions(story, script)

            # Stage 4: Character reference images
            char_refs = await self.generate_character_ref_images(
                char_descs, base_dir / "character_refs"
            )

            # Stage 5: Clip reference frames
            clip_refs = await self.generate_clip_ref_frames(
                script, char_refs, base_dir / "clip_refs"
            )

            # Stage 6: Veo video clips
            veo_clips = await self.generate_veo_clips(
                script, char_refs, clip_refs, base_dir / "veo_clips"
            )

            elapsed = int((time.monotonic() - start_ms) * 1000)
            return AgentResult(
                success=True,
                output=self._state,
                execution_time_ms=elapsed,
                model_used=f"{FLASH_MODEL}, {IMAGE_MODEL}, {VEO_MODEL}",
            )
        except Exception as e:
            elapsed = int((time.monotonic() - start_ms) * 1000)
            logger.exception("VisualAudioAgent failed")
            return AgentResult(
                success=False,
                error=str(e),
                execution_time_ms=elapsed,
                model_used=FLASH_MODEL,
            )

    @property
    def state(self) -> VisualAudioPipelineState:
        return self._state

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _ensure_client(self):
        api_key = self.config.api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("No API key. Set GOOGLE_API_KEY or GEMINI_API_KEY.")
        if self._client is None:
            self._client = genai.Client(api_key=api_key)

    async def _call_flash_json(
        self,
        system: str,
        user: str,
        schema: dict,
        *,
        thinking: str = "low",
    ) -> str:
        """Call Gemini Flash with structured JSON output."""
        self._ensure_client()
        resp = await self._client.aio.models.generate_content(
            model=FLASH_MODEL,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_json_schema=schema,
                thinking_config=types.ThinkingConfig(thinking_level=thinking),
            ),
        )
        return resp.text

    def _call_image_sync(self, prompt: str, aspect_ratio: str = "1:1", image_size: str = "1K", parts=None):
        """Synchronous Nano Banana image generation with retry."""
        self._ensure_client()
        for attempt in range(MAX_RETRIES):
            try:
                if parts is not None:
                    resp = self._client.models.generate_content(
                        model=IMAGE_MODEL,
                        contents=[types.Content(role="user", parts=parts)],
                        config=types.GenerateContentConfig(
                            response_modalities=["TEXT", "IMAGE"],
                            image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size=image_size),
                        ),
                    )
                else:
                    resp = self._client.models.generate_content(
                        model=IMAGE_MODEL,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_modalities=["TEXT", "IMAGE"],
                            image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size=image_size),
                        ),
                    )
                for part in resp.candidates[0].content.parts if resp.candidates else []:
                    if getattr(part, "inline_data", None) and part.inline_data.mime_type.startswith("image/"):
                        return part.as_image()
                return None
            except Exception as e:
                if _is_retryable(e) and attempt < MAX_RETRIES - 1:
                    wait = min(RETRY_BASE_DELAY + attempt * 10, 90)
                    logger.warning("Image gen retry %d/%d in %ds: %s", attempt + 1, MAX_RETRIES, wait, e)
                    time.sleep(wait)
                else:
                    raise
        return None

    # ------------------------------------------------------------------
    # Stage 1: Expand pipeline output → ObfuscatedScamStory
    # ------------------------------------------------------------------
    async def expand_to_story(
        self,
        fact_sheet: FactSheet,
        scenes: List[Dict[str, Any]],
    ) -> ObfuscatedScamStory:
        """Expand compressed fact sheet + scenes into a full narrative with character roles."""
        scenes_summary = "\n".join(
            f"Scene {s.get('scene_id', i+1)}: visual={str(s.get('visual_prompt', ''))[:150]} | "
            f"audio={str(s.get('audio_script', ''))[:150]}"
            for i, s in enumerate(scenes)
        )

        category_label = getattr(fact_sheet.category, "value", fact_sheet.category)

        system = (
            "You expand a Scam Shield pipeline output into a full ObfuscatedScamStory for video production. "
            "Given a fact sheet (scam_name, story_hook, red_flag, the_fix) and scene scripts, "
            "reconstruct a complete, multi-paragraph obfuscated narrative and identify all character roles. "
            "All identities must be obfuscated (no real names). Malaysian context (RM, PDRM, 997). "
            "The story must be detailed enough to drive a full video script."
        )

        user = (
            f"Expand this pipeline output into an ObfuscatedScamStory.\n\n"
            f"FACT SHEET:\n"
            f"- Scam Name: {fact_sheet.scam_name}\n"
            f"- Story Hook: {fact_sheet.story_hook}\n"
            f"- Red Flag: {fact_sheet.red_flag}\n"
            f"- The Fix: {fact_sheet.the_fix}\n"
            f"- Category: {category_label}\n\n"
            f"SCENE SCRIPTS:\n{scenes_summary}\n\n"
            f"Output an ObfuscatedScamStory JSON with: title, summary, story (FULL narrative), "
            f"character_roles (every distinct role), solution, red_flags."
        )

        raw = await self._call_flash_json(
            system, user, ObfuscatedScamStory.model_json_schema()
        )
        story = ObfuscatedScamStory.model_validate_json(raw)
        self._state.obfuscated_story = story
        logger.info("Stage 1 done: ObfuscatedScamStory (%d chars, %d roles)", len(story.story), len(story.character_roles))
        return story

    # ------------------------------------------------------------------
    # Stage 2: Scenes → VeoScript
    # ------------------------------------------------------------------
    async def generate_veo_script(
        self,
        story: ObfuscatedScamStory,
        scenes: List[Dict[str, Any]],
    ) -> VeoScript:
        """Convert pipeline scenes into Veo-structured segments."""
        system = (
            "You are converting Scam Shield pipeline scene data into Veo-ready video segments. "
            "Each pipeline scene has: visual_prompt and audio_script. "
            "Convert each into a structured veo_prompt with: "
            "(1) Subject+action+setting, (2) Camera (shot type, angle, movement), "
            "(3) Lighting/mood, (4) Audio: sound and dialogue (fit 8s), "
            "(5) Visual style. "
            "Assign characters_involved per segment from the character_roles list. "
            "Vary camera and shot types across segments. No text overlays. "
            "Solution and red flags in final segments via dialogue/action only."
        )

        roles_text = "\n".join(f"- {r}" for r in story.character_roles)
        user = (
            f"Convert these pipeline scenes into a Veo-ready VeoScript.\n\n"
            f"Character roles:\n{roles_text}\n\n"
            f"Pipeline scenes:\n{json.dumps(scenes, indent=2, default=str)}\n\n"
            f"Story context: {story.story[:1000]}\n\n"
            f"Title: {story.title}\n"
            f"Total duration: {sum(s.get('duration_est_seconds', 8) for s in scenes)}s"
        )

        raw = await self._call_flash_json(
            system, user, VeoScript.model_json_schema(), thinking="high"
        )
        script = VeoScript.model_validate_json(raw)
        self._state.veo_script = script
        logger.info("Stage 2 done: VeoScript (%d segments, %ds)", len(script.segments), script.total_duration_sec)
        return script

    # ------------------------------------------------------------------
    # Dialogue-only translation of an existing VeoScript
    # ------------------------------------------------------------------
    async def translate_veo_script_dialogue(
        self,
        script: VeoScript,
        target_language: str,
    ) -> VeoScript:
        """Translate ONLY the spoken dialogue inside quotation marks in each
        segment's veo_prompt, keeping scene descriptions, camera directions,
        and character names unchanged.  Returns a new VeoScript."""

        lang_map = {
            "bm": "Malaysian Malay (Bahasa Melayu Malaysia)",
            "zh": "Simplified Chinese (Malaysia context)",
            "zh_yue": "Cantonese (Malaysia context)",
            "ta": "Tamil suitable for Malaysian Tamil speakers",
            "en": "English",
        }
        lang_label = lang_map.get(target_language, target_language)

        system = (
            "You are a strict dialogue-only translator for Scam Shield Malaysia awareness videos.\n\n"
            "You will receive a full video script in JSON format with:\n"
            "- title (string)\n- total_duration_sec (int)\n"
            "- segments (list of objects with segment_index, characters_involved, veo_prompt)\n\n"
            "Your task:\nTranslate ONLY the spoken dialogue inside quotation marks "
            '(" ") or (\' \') inside each veo_prompt.\n\n'
            "STRICT RULES:\n"
            "- Do NOT translate title.\n"
            "- Do NOT translate characters_involved.\n"
            "- Do NOT translate narration, scene descriptions, camera directions, or visual style text.\n"
            "- Do NOT modify segment_index.\n"
            "- Do NOT modify total_duration_sec.\n"
            "- Only replace text inside quotation marks.\n"
            "- Keep the exact same JSON schema and structure.\n"
            "- Do NOT add explanations.\n"
            "- Output valid JSON only.\n\n"
            f"Target language: {lang_label}\n\n"
            "If a segment has no dialogue, leave it unchanged."
        )

        script_json = script.model_dump_json()
        user = (
            f"Target language: {lang_label}\n\n"
            "Translate ONLY the dialogue inside quotation marks in the following JSON script.\n"
            "Return valid JSON with the exact same schema and structure.\n"
            "Do NOT translate any other text.\n\n"
            f"Script:\n\n{script_json}"
        )

        raw = await self._call_flash_json(
            system, user, VeoScript.model_json_schema(), thinking="low"
        )
        translated = VeoScript.model_validate_json(raw)

        # Guardrail: some model responses may return partial segment lists.
        # Always rebuild a full script in source order and keep source metadata.
        src_segments = script.segments or []
        translated_by_idx = {s.segment_index: s for s in (translated.segments or [])}
        merged_segments: List[ScriptSegment] = []

        translated_count = 0
        for src in src_segments:
            t = translated_by_idx.get(src.segment_index)
            if t is not None and (t.veo_prompt or "").strip():
                merged_segments.append(
                    ScriptSegment(
                        segment_index=src.segment_index,
                        # Preserve source character bindings strictly.
                        characters_involved=src.characters_involved,
                        veo_prompt=t.veo_prompt,
                    )
                )
                translated_count += 1
            else:
                # Fallback to source prompt for any missing segment.
                merged_segments.append(src)

        merged = VeoScript(
            title=script.title,
            total_duration_sec=script.total_duration_sec,
            segments=merged_segments,
        )

        if len(translated.segments or []) != len(src_segments):
            logger.warning(
                "Dialogue translation returned partial segments (%d/%d). Filled missing segments from source.",
                len(translated.segments or []),
                len(src_segments),
            )

        logger.info(
            "Dialogue-only translation done → %s (%d/%d segments translated)",
            target_language,
            translated_count,
            len(src_segments),
        )
        return merged

    # ------------------------------------------------------------------
    # Stage 3: Character descriptions
    # ------------------------------------------------------------------
    async def generate_character_descriptions(
        self,
        story: ObfuscatedScamStory,
        script: VeoScript,
        canonical_roles: Optional[List[str]] = None,
    ) -> CharacterDescriptions:
        """Generate per-character visual descriptions for image generation."""
        script_lines = [f"Video: {script.title}", f"Total segments: {len(script.segments)}", ""]
        for seg in script.segments:
            script_lines.append(f"--- Segment {seg.segment_index} ---")
            script_lines.append(f"Characters: {', '.join(seg.characters_involved)}")
            script_lines.append(f"veo_prompt: {seg.veo_prompt}")
            script_lines.append("")
        script_summary = "\n".join(script_lines)

        system = (
            "You output character descriptions for image generation. Given (1) the video script and "
            "(2) the obfuscated scam story and character roles. ALWAYS describe each character as FULL BODY "
            "(full figure, head to toe). Each character must have ONE consistent outfit and look for the "
            "ENTIRE video. All characters are for a MALAYSIAN audience.\n\n"
            "If CANONICAL ROLES are provided, you MUST output exactly those roles with exactly the same labels "
            "and the same count. Do NOT rename, merge, split, or invent roles. If a role label includes age "
            "or persona hints (e.g., 'Elderly Victim', 'Young Adult Victim'), preserve that intent exactly "
            "in the visual description.\n\n"
            "For type 'person' (victims, authorities, bystanders): FULL BODY figure—Malaysian ethnicity, "
            "age range, hair, ONE consistent attire. No emotions/setting/actions/props.\n\n"
            "For type 'scammer' (perpetrators, AI/voice-cloned): always type 'scammer'. NEVER a real person. "
            "FULL-BODY anonymous human figure—featureless silhouette or AI-robot-like. "
            "Give each scammer 1-2 differentiating traits."
        )

        canonical_roles_block = ""
        if canonical_roles:
            canonical_roles_block = "\n".join(f"- {r}" for r in canonical_roles)

        user = (
            f"Generate character descriptions for the video below.\n\n"
            f"--- Video script ---\n{script_summary}\n"
            f"--- Obfuscated story ---\n{story.story}\n\n"
            f"--- Character roles ---\n"
            + "\n".join(f"- {r}" for r in story.character_roles)
            + (f"\n\n--- CANONICAL ROLES (MUST MATCH EXACTLY) ---\n{canonical_roles_block}" if canonical_roles_block else "")
        )

        raw = await self._call_flash_json(
            system, user, CharacterDescriptions.model_json_schema()
        )
        descs = CharacterDescriptions.model_validate_json(raw)

        # Enforce canonical role set/order when provided to prevent role drift.
        if canonical_roles:
            desc_by_role = {c.role: c for c in descs.characters}
            normalized_chars: List[CharacterDescription] = []
            for role in canonical_roles:
                existing = desc_by_role.get(role)
                if existing is not None:
                    normalized_chars.append(existing)
                    continue
                lower = role.lower()
                inferred_type = "scammer" if any(
                    k in lower for k in ["scammer", "fraud", "fake", "caller", "syndicate", "agent"]
                ) else "person"
                normalized_chars.append(CharacterDescription(
                    role=role,
                    type=inferred_type,
                    description_for_image_generation=(
                        f"Full-body Malaysian {'anonymous scammer silhouette' if inferred_type == 'scammer' else 'person'} "
                        f"representing role '{role}', with a single consistent outfit across all scenes."
                    ),
                ))
            descs = CharacterDescriptions(characters=normalized_chars)

        self._state.character_descriptions = descs
        logger.info("Stage 3 done: %d character descriptions", len(descs.characters))
        return descs

    # ------------------------------------------------------------------
    # Stage 4: Character reference images (2×2 grids)
    # ------------------------------------------------------------------
    async def generate_character_ref_images(
        self,
        descs: CharacterDescriptions,
        out_dir: Path,
        roles_to_regenerate: Optional[Set[str]] = None,
    ) -> List[CharacterRefImage]:
        """Generate a 2×2 reference grid per character via Nano Banana.

        Args:
            roles_to_regenerate: If provided, only regenerate images for these
                roles and keep existing images for all other roles.
        """
        out_dir.mkdir(parents=True, exist_ok=True)

        # Build lookup of existing images to preserve unchanged roles
        existing_by_role: Dict[str, CharacterRefImage] = {}
        if roles_to_regenerate is not None and self._state.character_ref_images:
            for img in self._state.character_ref_images:
                if img.role not in roles_to_regenerate:
                    existing_by_role[img.role] = img

        index: List[CharacterRefImage] = []

        for char in descs.characters:
            # Keep existing image for unchanged roles
            if roles_to_regenerate is not None and char.role not in roles_to_regenerate:
                if char.role in existing_by_role:
                    index.append(existing_by_role[char.role])
                    logger.info("Keeping existing ref image for %s", char.role)
                continue

            safe_name = re.sub(r"[^a-zA-Z0-9]+", "_", char.role).strip("_")
            filename = f"{safe_name}_2x2_grid.png"
            path = out_dir / filename
            prompt = _build_grid_prompt(char)

            # Run sync image gen in executor to not block event loop
            img = await asyncio.get_event_loop().run_in_executor(
                None, lambda p=prompt: self._call_image_sync(p, aspect_ratio="1:1", image_size="1K")
            )
            if img is not None:
                img.save(path)
                entry = CharacterRefImage(
                    role=char.role,
                    description=char.description_for_image_generation,
                    filename=filename,
                    path=str(path),
                )
                index.append(entry)
                logger.info("Character ref saved: %s", path)
            else:
                logger.warning("Failed to generate ref for %s", char.role)

        # Save index
        index_data = [e.model_dump() for e in index]
        (out_dir / "index.json").write_text(json.dumps(index_data, indent=2), encoding="utf-8")

        self._state.character_ref_images = index
        mode = "selective" if roles_to_regenerate else "full"
        logger.info("Stage 4 done: %d character ref images (%s)", len(index), mode)
        return index

    # ------------------------------------------------------------------
    # Stage 5: Clip reference frames (start/end per segment)
    # ------------------------------------------------------------------
    async def generate_clip_ref_frames(
        self,
        script: VeoScript,
        char_refs: List[CharacterRefImage],
        out_dir: Path,
        segments_to_regenerate: Optional[Set[int]] = None,
    ) -> List[ClipRefEntry]:
        """Generate start/end frames for each segment for Veo interpolation.

        Args:
            segments_to_regenerate: If provided, only regenerate frames for
                these segment indices and keep existing frames for all others.
        """
        out_dir.mkdir(parents=True, exist_ok=True)
        role_to_path = {r.role: Path(r.path) for r in char_refs}

        # Build full script text for context (always uses complete script)
        full_script_text = _build_full_script_text(script)

        # Determine which segments to process
        if segments_to_regenerate is not None:
            segments_to_process = [
                s for s in script.segments
                if s.segment_index in segments_to_regenerate
            ]
            # Preserve existing data for unchanged segments
            existing_prompts = {
                p["segment_index"]: p
                for p in self._state.clip_ref_prompts
                if p.get("segment_index") not in segments_to_regenerate
            }
            existing_entries = [
                e for e in self._state.clip_ref_images
                if e.segment_index not in segments_to_regenerate
            ]
        else:
            segments_to_process = list(script.segments)
            existing_prompts = {}
            existing_entries = []

        # Step 5a: Generate prompts for target segments
        new_prompts: List[Dict[str, Any]] = []
        for seg in segments_to_process:
            seg_chars = ", ".join(seg.characters_involved) if seg.characters_involved else "(none)"
            frame_input = (
                f"{full_script_text}\n\n"
                f"Output start and end frame prompts for **segment {seg.segment_index}** only. "
                f"Characters that MUST appear at least once across these two frames: {seg_chars}. "
                "Think about continuity and flow."
            )
            raw = await self._call_flash_json(
                _CLIP_REF_SYSTEM, frame_input, ClipRefFramePrompts.model_json_schema(), thinking="high"
            )
            prompts = ClipRefFramePrompts.model_validate_json(raw)
            new_prompts.append({
                "segment_index": seg.segment_index,
                "start_frame_prompt": prompts.start_frame_prompt,
                "end_frame_prompt": prompts.end_frame_prompt,
            })
            logger.info("Clip ref prompts generated for segment %d", seg.segment_index)

        # Merge prompts: existing unchanged + newly generated
        all_prompts = list(existing_prompts.values()) + new_prompts
        all_prompts.sort(key=lambda p: p["segment_index"])
        self._state.clip_ref_prompts = all_prompts

        # Step 5b: Generate images for target segments
        new_entries: List[ClipRefEntry] = []
        seg_by_idx = {s.segment_index: s for s in script.segments}
        role_to_desc = {r.role: r.description for r in char_refs}

        for entry in new_prompts:
            seg_idx = entry["segment_index"]
            seg = seg_by_idx.get(seg_idx)
            if not seg:
                continue

            # Gather character ref paths
            char_paths = [role_to_path[r] for r in seg.characters_involved if r in role_to_path]
            role_constraints = []
            for role in seg.characters_involved:
                desc = role_to_desc.get(role)
                if desc:
                    role_constraints.append(f"- {role}: {desc}")
                else:
                    role_constraints.append(f"- {role}: match the provided character reference image exactly")
            identity_lock = (
                "Reference images are authoritative for each named character. "
                "Do NOT change gender, age, body type, face, hairstyle, skin tone, or outfit from references. "
                "If scene text conflicts with references, references win."
            )
            role_constraints_text = "Character appearance lock:\n" + "\n".join(role_constraints)

            # Previous segment end as scene reference
            prev_end_path = out_dir / f"segment_{seg_idx - 1}_end.png" if seg_idx > 1 else None

            # Start frame
            start_prompt = entry["start_frame_prompt"]
            if prev_end_path and prev_end_path.exists():
                start_prompt = (
                    "The first image is the end of the previous segment. "
                    "Use it as scene reference; create the start frame of this segment as follows. "
                    + start_prompt
                )
            start_text = (
                f"Create the START frame for this clip. {start_prompt} "
                f"Characters that MUST appear at least once across START+END for this segment: {', '.join(seg.characters_involved)}. "
                f"{identity_lock} {role_constraints_text} "
                "IMPORTANT: Any featureless/anonymous humanoid must remain featureless. No text in image."
            )
            parts = _build_clip_start_parts(char_paths, start_text, prev_end_path)
            start_path = out_dir / f"segment_{seg_idx}_start.png"

            clip_aspect = VIDEO_FORMAT_ASPECT.get(self._state.video_format, "9:16")
            img = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda p=parts, ar=clip_aspect: self._call_image_sync("", aspect_ratio=ar, image_size="1K", parts=p),
            )
            if img is not None:
                img.save(start_path)
                new_entries.append(ClipRefEntry(
                    segment_index=seg_idx, frame="start",
                    filename=start_path.name, path=str(start_path),
                ))
                logger.info("Saved %s", start_path)

            # End frame (uses start frame as reference)
            if start_path.exists():
                end_text = (
                    f"Using the provided reference images (start frame + character reference image(s)), create the END frame: "
                    f"{entry['end_frame_prompt']} "
                    f"Characters that MUST appear at least once across START+END for this segment: {', '.join(seg.characters_involved)}. "
                    f"{identity_lock} {role_constraints_text} "
                    "IMPORTANT: Keep any featureless humanoid characters as-is. No text in image."
                )
                end_parts = _build_clip_end_parts(start_path, char_paths, end_text)
                end_path = out_dir / f"segment_{seg_idx}_end.png"

                img = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda p=end_parts, ar=clip_aspect: self._call_image_sync("", aspect_ratio=ar, image_size="1K", parts=p),
                )
                if img is not None:
                    img.save(end_path)
                    new_entries.append(ClipRefEntry(
                        segment_index=seg_idx, frame="end",
                        filename=end_path.name, path=str(end_path),
                    ))
                    logger.info("Saved %s", end_path)

        # Merge entries: existing unchanged + newly generated
        all_entries = existing_entries + new_entries
        all_entries.sort(key=lambda e: (e.segment_index, 0 if e.frame == "start" else 1))

        # Save index
        index_data = [e.model_dump() for e in all_entries]
        (out_dir / "index.json").write_text(json.dumps(index_data, indent=2), encoding="utf-8")

        self._state.clip_ref_images = all_entries
        mode = "selective" if segments_to_regenerate else "full"
        logger.info("Stage 5 done: %d clip ref frames (%s, %d regenerated)",
                    len(all_entries), mode, len(new_entries))
        return all_entries

    # ------------------------------------------------------------------
    # Stage 6: Veo video generation
    # ------------------------------------------------------------------
    async def generate_veo_clips(
        self,
        script: VeoScript,
        char_refs: List[CharacterRefImage],
        clip_refs: List[ClipRefEntry],
        out_dir: Path,
    ) -> List[VeoClipEntry]:
        """Generate 8s Veo clips per segment using interpolation."""
        out_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_client()

        role_to_path = {r.role: Path(r.path) for r in char_refs}
        clip_ref_map: Dict[int, Dict[str, Path]] = {}
        for cr in clip_refs:
            clip_ref_map.setdefault(cr.segment_index, {})[cr.frame] = Path(cr.path)

        veo_entries: List[VeoClipEntry] = []
        total_cost = 0.0

        for seg in script.segments:
            seg_idx = seg.segment_index
            # Build prompt with strong identity-lock instructions.
            char_list = ", ".join(seg.characters_involved)
            identity_lock = (
                "Identity lock: keep each named character exactly consistent with the provided references "
                "and frame constraints (same face, age, body type, outfit, hairstyle, skin tone, and role). "
                "Do not replace, swap, or hallucinate extra main characters. "
                "If a scammer is featureless/anonymous in refs, keep them featureless."
            )
            prompt = (
                f"Characters on screen: {char_list}. {identity_lock} {seg.veo_prompt}"
                if seg.characters_involved else seg.veo_prompt
            )

            # Load start/end frames for interpolation
            frames = clip_ref_map.get(seg_idx, {})
            first_image = _load_veo_image(frames.get("start"))
            last_image = _load_veo_image(frames.get("end"))

            # Build character reference images for Veo
            char_paths = [role_to_path[r] for r in seg.characters_involved if r in role_to_path]
            ref_images = _build_veo_reference_images(char_paths[:3])

            # Interpolation mode: API doesn't allow reference_images with start/end frames
            use_refs = ref_images and first_image is None
            if first_image and last_image:
                prompt = (
                    "The provided first and last frames are authoritative references. "
                    "Preserve character identity and outfit continuity exactly between them. "
                    + prompt
                )
            veo_aspect = VIDEO_FORMAT_ASPECT.get(self._state.video_format, "9:16")
            config = types.GenerateVideosConfig(
                aspect_ratio=veo_aspect,
                last_frame=last_image,
                reference_images=ref_images if use_refs else None,
            )
            kwargs: Dict[str, Any] = {"model": VEO_MODEL, "prompt": prompt, "config": config}
            if first_image is not None:
                kwargs["image"] = first_image

            mode = (
                "interpolation" if first_image and last_image
                else "text+refs" if use_refs
                else "text-only"
            )
            logger.info("Segment %d: generating (%s)", seg_idx, mode)

            # Veo is synchronous (polling), run in executor
            out_path = out_dir / f"segment_{seg_idx}.mp4"
            video_ok = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda kw=kwargs, op=out_path: _generate_veo_clip_sync(self._client, kw, op),
            )
            if video_ok:
                clip_cost = VEO_CLIP_SEC * VEO_COST_PER_SEC
                total_cost += clip_cost
                veo_entries.append(VeoClipEntry(
                    segment_index=seg_idx,
                    filename=out_path.name,
                    path=str(out_path),
                    estimated_cost_usd=clip_cost,
                ))
                logger.info("Saved %s (total $%.2f)", out_path, total_cost)

        # Save index
        index_data = [e.model_dump() for e in veo_entries]
        (out_dir / "index.json").write_text(json.dumps(index_data, indent=2), encoding="utf-8")

        self._state.veo_clips = veo_entries
        logger.info("Stage 6 done: %d Veo clips (est. $%.2f)", len(veo_entries), total_cost)
        return veo_entries


# ---------------------------------------------------------------------------
# Module-level helpers (not agent methods)
# ---------------------------------------------------------------------------

def _is_retryable(e: Exception) -> bool:
    s = str(e).lower()
    return any(k in s for k in ("503", "unavailable", "high demand", "resource_exhausted", "rate"))


def _build_grid_prompt(char: CharacterDescription) -> str:
    return (
        f"A photorealistic 2x2 split-screen character reference sheet. "
        f"The SAME character appears in all four panels. "
        f"Character: {char.description_for_image_generation} "
        f"Standing, neutral pose, full body in each panel. "
        f"Panel 1 (Top Left): Front view. "
        f"Panel 2 (Top Right): Back view. "
        f"Panel 3 (Bottom Left): Left profile view. "
        f"Panel 4 (Bottom Right): Right profile view. "
        f"{NANO_BANANA_STYLE} 1:1 aspect ratio for the grid."
    )


def _build_full_script_text(script: VeoScript) -> str:
    lines = [f"Video: {script.title}", f"Total segments: {len(script.segments)}", ""]
    for seg in script.segments:
        lines.append(f"--- Segment {seg.segment_index} ---")
        lines.append(f"Characters: {', '.join(seg.characters_involved)}")
        lines.append(f"veo_prompt: {seg.veo_prompt}")
        lines.append("")
    return "\n".join(lines)


def _build_clip_start_parts(
    char_paths: List[Path], prompt_text: str, prev_end_path: Optional[Path] = None,
) -> list:
    parts = []
    if prev_end_path is not None and prev_end_path.exists():
        data = prev_end_path.read_bytes()
        mime = "image/png" if prev_end_path.suffix.lower() == ".png" else "image/jpeg"
        parts.append(types.Part(inline_data=types.Blob(data=data, mime_type=mime)))
    for p in char_paths:
        if p.exists():
            data = p.read_bytes()
            mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
            parts.append(types.Part(inline_data=types.Blob(data=data, mime_type=mime)))
    parts.append(types.Part(text=prompt_text))
    return parts


def _build_clip_end_parts(start_frame: Path, char_paths: List[Path], prompt_text: str) -> list:
    data = start_frame.read_bytes()
    mime = "image/png" if start_frame.suffix.lower() == ".png" else "image/jpeg"
    parts = [types.Part(inline_data=types.Blob(data=data, mime_type=mime))]
    for p in char_paths:
        if p.exists():
            c_data = p.read_bytes()
            c_mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
            parts.append(types.Part(inline_data=types.Blob(data=c_data, mime_type=c_mime)))
    parts.append(types.Part(text=prompt_text))
    return parts


def _load_veo_image(path: Optional[Path]):
    """Load an image file as types.Image for Veo API."""
    if path is None or not path.exists():
        return None
    from PIL import Image as PILImage
    buf = io.BytesIO()
    PILImage.open(path).convert("RGB").save(buf, format="PNG")
    return types.Image(image_bytes=buf.getvalue(), mime_type="image/png")


def _build_veo_reference_images(char_paths: List[Path]) -> list:
    refs = []
    for p in char_paths:
        if p.exists():
            data = p.read_bytes()
            mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
            api_image = types.Image(image_bytes=data, mime_type=mime)
            refs.append(types.VideoGenerationReferenceImage(image=api_image, reference_type="asset"))
    return refs


def _generate_veo_clip_sync(client, kwargs: dict, out_path: Path) -> bool:
    """Synchronous Veo clip generation with polling."""
    try:
        operation = client.models.generate_videos(**kwargs)
        while not operation.done:
            time.sleep(10)
            operation = client.operations.get(operation)
        g = operation.response.generated_videos[0]
        client.files.download(file=g.video)
        g.video.save(str(out_path))
        return True
    except Exception as e:
        logger.error("Veo clip generation failed: %s", e)
        return False


# System prompt for clip ref frame generation (Stage 5)
_CLIP_REF_SYSTEM = """You are given the **full video script** (all segments). Output start and end frame prompts for **one specified segment only**.

**Continuity and flow are critical.** (1) Within the segment: start and end frame = one 8-second story beat. (2) Between segments: start flows from previous end; end sets up next start.

**Character identity lock (strict):**
- Character reference images are authoritative for appearance.
- Do NOT invent or alter gender, age, body type, face, hairstyle, skin tone, or outfit.
- If script wording conflicts with references, references win.
- Prefer wording like "as shown in the provided reference image" for each named character.

1. **start_frame_prompt**: Used with character reference images. Describe scene/setting, camera/shot, lighting, character pose/expression. Include "Using the provided character reference image(s), place [character] in the following scene: ..." For scammer/featureless characters: explicitly state they must remain featureless. One still image, no motion, no text.

2. **end_frame_prompt**: Used with start frame image AND character reference images as references. Same setting, new pose/expression. Progression must feel like one continuous flow. Scammers remain featureless. One still image, no motion, no text.

3. Character coverage constraint: every listed character for the segment must appear at least once across the pair (start frame + end frame)."""


# Factory
def create_visual_audio_agent(
    api_key: Optional[str] = None,
    model_name: str = FLASH_MODEL,
) -> VisualAudioAgent:
    config = AgentConfig(model_name=model_name)
    if api_key:
        config.api_key = api_key
    return VisualAudioAgent(config)
