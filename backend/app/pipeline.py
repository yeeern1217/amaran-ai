"""
Pipeline Orchestrator - Coordinates the multi-agent workflow.

Manages the flow from intake to Visual/Audio Agent output:
1. Intake → Research Agent → Fact Sheet
2. Fact Sheet (officer verified) + Creator Config → Director Agent
3. Director Output → Linguistic Agent → Translations
4. All Scripts → Sensitivity Check Agent → Compliance Report
5. Assemble → VisualAudioAgentInput (per language)
6. VisualAudioAgentInput → Visual/Audio Agent → Video Assets

Supports iteration and editing at each stage.
"""
from typing import Optional, Dict, List, Callable, Any
from pydantic import BaseModel, Field
from datetime import datetime
from pathlib import Path
import uuid
import logging
import asyncio
import json

from .models import (
    # Inputs
    IntakeInput,
    FactSheet,
    ScamReport,
    CreatorConfig,
    # Inter-agent
    DirectorOutput,
    LinguisticOutput,
    SensitivityCheckOutput,
    # Outputs
    Scene,
    MetaData,
    VisualAudioAgentInput,
    MultiLanguageVideoPackage,
    # Visual/Audio
    VisualAudioPipelineState,
    # Social
    SocialOfficerOutput,
    # State
    PipelineState,
    PipelineStatus,
    # Enums
    Language,
    ScamCategory,
    # Chat
    ChatTarget,
    ChatRole,
)
from .agents import (
    BaseAgent,
    AgentConfig,
    ResearchAgent,
    DirectorAgent,
    LinguisticAgent,
    SensitivityCheckAgent,
    VisualAudioAgent,
    VisualAudioInput,
    SocialOfficerAgent,
    SocialInput,
)
from .agents.director_agent import DirectorInput
from .agents.linguistic_agent import LinguisticInput
from .agents.sensitivity_agent import SensitivityInput
from .config import get_settings


logger = logging.getLogger(__name__)


class PipelineConfig(BaseModel):
    """Configuration for the pipeline. Defaults read from .env via get_settings()."""
    research_model: Optional[str] = Field(None, description="Model for Research Agent")
    director_model: Optional[str] = Field(None, description="Model for Director Agent")
    linguistic_model: Optional[str] = Field(None, description="Model for Linguistic Agent")
    sensitivity_model: Optional[str] = Field(None, description="Model for Sensitivity Check")
    visual_audio_model: Optional[str] = Field(None, description="Model for Visual/Audio Agent")
    social_model: Optional[str] = Field(None, description="Model for Social Officer Agent")
    auto_skip_sensitivity: bool = Field(False, description="Skip sensitivity check (not recommended)")
    api_key: Optional[str] = Field(None, description="Google API key")
    visual_audio_output_dir: Optional[str] = Field(None, description="Output dir for VA assets")
    
    def get_research_model(self) -> str:
        return self.research_model or get_settings().default_research_model
    
    def get_director_model(self) -> str:
        return self.director_model or get_settings().default_director_model
    
    def get_linguistic_model(self) -> str:
        return self.linguistic_model or get_settings().default_linguistic_model
    
    def get_sensitivity_model(self) -> str:
        return self.sensitivity_model or get_settings().default_sensitivity_model
    
    def get_visual_audio_model(self) -> str:
        return self.visual_audio_model or get_settings().default_visual_audio_model
    
    def get_social_model(self) -> str:
        return self.social_model or get_settings().default_social_model


class PipelineOrchestrator:
    """
    Orchestrates the Scam Shield multi-agent pipeline.
    
    Flow:
    ```
    IntakeInput
        ↓
    [Research Agent] → FactSheet
        ↓ (officer verification required)
    [Director Agent] → DirectorOutput (script + scenes)
        ↓
    [Linguistic Agent] → LinguisticOutput (translations)
        ↓
    [Sensitivity Check Agent] → SensitivityCheckOutput
        ↓ (if passed or officer override)
    MultiLanguageVideoPackage (ready for Visual/Audio Agent)
    ```
    
    Usage:
    ```python
    pipeline = PipelineOrchestrator(config)
    
    # Stage 1: Intake → Fact Sheet
    fact_sheet = await pipeline.process_intake(intake)
    
    # Stage 2: Officer reviews and verifies fact sheet
    verified_fact_sheet = pipeline.verify_fact_sheet(fact_sheet, officer_id, notes)
    
    # Stage 3: Generate video package
    package = await pipeline.generate_video_package(verified_fact_sheet, creator_config)
    ```
    """
    
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self._state: Optional[PipelineState] = None
        self._init_agents()
    
    def _init_agents(self):
        """Initialize all agents with configuration."""
        settings = get_settings()
        agent_config_kwargs = {}
        if self.config.api_key:
            agent_config_kwargs["api_key"] = self.config.api_key
        
        # Initialize Research Agent with Deep Research setting
        self.research_agent = ResearchAgent(
            AgentConfig(model_name=self.config.get_research_model(), **agent_config_kwargs),
            use_deep_research=settings.use_deep_research
        )
        self.director_agent = DirectorAgent(
            AgentConfig(model_name=self.config.get_director_model(), **agent_config_kwargs)
        )
        self.linguistic_agent = LinguisticAgent(
            AgentConfig(model_name=self.config.get_linguistic_model(), **agent_config_kwargs)
        )
        self.sensitivity_agent = SensitivityCheckAgent(
            AgentConfig(model_name=self.config.get_sensitivity_model(), **agent_config_kwargs)
        )
        self.visual_audio_agent = VisualAudioAgent(
            AgentConfig(model_name=self.config.get_visual_audio_model(), **agent_config_kwargs)
        )
        self.social_agent = SocialOfficerAgent(
            AgentConfig(model_name=self.config.get_social_model(), max_tokens=8192, **agent_config_kwargs)
        )
    
    def new_session(self) -> str:
        """Start a new pipeline session."""
        self._state = PipelineState()
        logger.info(f"New pipeline session: {self._state.session_id}")
        return self._state.session_id
    
    @property
    def state(self) -> Optional[PipelineState]:
        """Get current pipeline state."""
        return self._state
    
    # ==================== STAGE 1: INTAKE → FACT SHEET ====================
    
    async def process_intake(self, intake: IntakeInput, on_thought: Optional[Callable] = None) -> FactSheet:
        """
        Process raw intake and generate Fact Sheet.
        
        Args:
            intake: Raw scam information from officer
            on_thought: Optional async callback for Deep Research thought updates
            
        Returns:
            Unverified FactSheet for officer review
        """
        if not self._state:
            self.new_session()
        
        self._state.intake = intake
        self._state.intake_status = PipelineStatus.IN_PROGRESS
        
        logger.info(f"Processing intake: {intake.source_type.value}")
        
        # Call Research Agent (pass through thought callback)
        result = await self.research_agent.process(intake, on_thought=on_thought)
        
        if not result.success:
            self._state.intake_status = PipelineStatus.FAILED
            raise RuntimeError(f"Research Agent failed: {result.error}")
        
        fact_sheet = result.output
        self._state.fact_sheet = fact_sheet
        self._state.intake_status = PipelineStatus.COMPLETED
        self._state.fact_sheet_status = PipelineStatus.AWAITING_REVIEW
        
        logger.info(f"Fact Sheet generated: {fact_sheet.scam_name}")
        return fact_sheet
    
    def verify_fact_sheet(
        self,
        fact_sheet: FactSheet,
        officer_id: str,
        notes: Optional[str] = None,
        corrections: Optional[Dict[str, Any]] = None
    ) -> FactSheet:
        """
        Officer verifies (and optionally corrects) the Fact Sheet.
        
        This is a REQUIRED step before video generation.
        
        Args:
            fact_sheet: Generated Fact Sheet
            officer_id: Officer identifier
            notes: Officer notes/comments
            corrections: Dict of field corrections (e.g., {"scam_name": "New Name"})
            
        Returns:
            Verified FactSheet
        """
        # Apply corrections if any
        if corrections:
            update_dict = {**corrections}
            fact_sheet = fact_sheet.model_copy(update=update_dict)
        
        # Mark as verified
        verified = fact_sheet.verify(officer_id, notes)
        
        if self._state:
            self._state.fact_sheet = verified
            self._state.fact_sheet_status = PipelineStatus.COMPLETED
        
        logger.info(f"Fact Sheet verified by {officer_id}")
        return verified
    
    # ==================== STAGE 2: FACT SHEET → SCAM REPORT ====================
    
    def create_scam_report(self, fact_sheet: FactSheet, severity: str = "medium") -> ScamReport:
        """
        Convert verified Fact Sheet to ScamReport for Director Agent.
        
        Args:
            fact_sheet: Verified Fact Sheet
            severity: Scam severity level
            
        Returns:
            ScamReport model
        """
        if not fact_sheet.verified_by_officer:
            raise ValueError("Fact Sheet must be verified before creating ScamReport")
        
        report = ScamReport(
            title=fact_sheet.scam_name,
            category=fact_sheet.category,
            severity=severity,
            description=f"{fact_sheet.story_hook} {fact_sheet.officer_notes or ''}",
            story_hook=fact_sheet.story_hook,
            red_flag=fact_sheet.red_flag,
            the_fix=fact_sheet.the_fix,
            source_urls=fact_sheet.reference_sources,
        )
        
        if self._state:
            self._state.scam_report = report
        
        return report
    
    # ==================== STAGE 3: DIRECTOR → SCRIPT ====================
    
    async def generate_script(
        self,
        fact_sheet: FactSheet,
        creator_config: CreatorConfig
    ) -> DirectorOutput:
        """
        Generate video script from verified Fact Sheet.
        
        Args:
            fact_sheet: Verified Fact Sheet
            creator_config: Creator configuration
            
        Returns:
            DirectorOutput with master script and scenes
        """
        if not fact_sheet.verified_by_officer:
            raise ValueError("Fact Sheet must be verified before script generation")
        
        if self._state:
            self._state.creator_config = creator_config
            self._state.director_status = PipelineStatus.IN_PROGRESS
        
        logger.info(f"Generating script for {fact_sheet.scam_name}")
        
        # Prepare Director input
        director_input = DirectorInput(
            fact_sheet=fact_sheet,
            creator_config=creator_config,
            session_id=self._state.session_id if self._state else str(uuid.uuid4()),
        )
        
        # Call Director Agent
        result = await self.director_agent.process(director_input)
        
        if not result.success:
            if self._state:
                self._state.director_status = PipelineStatus.FAILED
            raise RuntimeError(f"Director Agent failed: {result.error}")
        
        director_output = result.output
        if self._state:
            self._state.director_output = director_output
            self._state.director_status = PipelineStatus.COMPLETED
        
        logger.info(f"Script generated: {len(director_output.scene_breakdown)} scenes")
        return director_output
    
    async def refine_script(self, feedback: str) -> DirectorOutput:
        """
        Refine the current script based on officer feedback.
        
        Args:
            feedback: Officer's feedback for changes
            
        Returns:
            Refined DirectorOutput
        """
        if not self._state or not self._state.director_output:
            raise ValueError("No script to refine. Generate script first.")
        
        director_input = DirectorInput(
            fact_sheet=self._state.fact_sheet,
            creator_config=self._state.creator_config,
            session_id=self._state.session_id,
        )
        
        result = await self.director_agent.refine_with_feedback(
            director_input,
            self._state.director_output,
            feedback
        )
        
        if result.success:
            self._state.director_output = result.output
        
        return result.output
    
    # ==================== STAGE 4: LINGUISTIC → TRANSLATIONS ====================
    
    async def generate_translations(
        self,
        director_output: DirectorOutput,
        target_languages: List[Language]
    ) -> LinguisticOutput:
        """
        Generate translations for all target languages.
        
        Args:
            director_output: Script from Director Agent
            target_languages: Languages to generate
            
        Returns:
            LinguisticOutput with all translations
        """
        if self._state:
            self._state.linguistic_status = PipelineStatus.IN_PROGRESS
        
        logger.info(f"Generating translations for {len(target_languages)} languages")
        
        linguistic_input = LinguisticInput(
            director_output=director_output,
            target_languages=target_languages,
            primary_language=director_output.primary_language,
        )
        
        result = await self.linguistic_agent.process(linguistic_input)
        
        if not result.success:
            if self._state:
                self._state.linguistic_status = PipelineStatus.FAILED
            raise RuntimeError(f"Linguistic Agent failed: {result.error}")
        
        linguistic_output = result.output
        if self._state:
            self._state.linguistic_output = linguistic_output
            self._state.linguistic_status = PipelineStatus.COMPLETED
        
        logger.info(f"Translations generated: {list(linguistic_output.translations.keys())}")
        return linguistic_output
    
    # ==================== STAGE 5: SENSITIVITY CHECK ====================
    
    async def check_sensitivity(
        self,
        director_output: DirectorOutput,
        linguistic_output: LinguisticOutput,
        project_id: str
    ) -> SensitivityCheckOutput:
        """
        Run sensitivity check on all generated content.
        
        Args:
            director_output: Original script
            linguistic_output: All translations
            project_id: Project identifier
            
        Returns:
            SensitivityCheckOutput with any flags
        """
        if self._state:
            self._state.sensitivity_status = PipelineStatus.IN_PROGRESS
        
        logger.info("Running sensitivity check...")
        
        sensitivity_input = SensitivityInput(
            project_id=project_id,
            director_output=director_output,
            linguistic_output=linguistic_output,
        )
        
        result = await self.sensitivity_agent.process(sensitivity_input)
        
        if not result.success:
            if self._state:
                self._state.sensitivity_status = PipelineStatus.FAILED
            raise RuntimeError(f"Sensitivity Check Agent failed: {result.error}")
        
        sensitivity_output = result.output
        if self._state:
            self._state.sensitivity_output = sensitivity_output
            self._state.sensitivity_status = PipelineStatus.COMPLETED
        
        status = "PASSED" if sensitivity_output.passed else "FAILED"
        logger.info(f"Sensitivity check: {status} ({len(sensitivity_output.flags)} flags)")
        return sensitivity_output
    
    # ==================== FINAL: ASSEMBLE VIDEO PACKAGE ====================
    
    def assemble_video_package(
        self,
        fact_sheet: FactSheet,
        creator_config: CreatorConfig,
        director_output: DirectorOutput,
        linguistic_output: LinguisticOutput,
        sensitivity_output: SensitivityCheckOutput,
    ) -> MultiLanguageVideoPackage:
        """
        Assemble final video package for Visual/Audio Agent.
        
        Creates VisualAudioAgentInput for each language version.
        
        Returns:
            MultiLanguageVideoPackage ready for video generation
        """
        scam_report = self.create_scam_report(fact_sheet)
        video_inputs: Dict[str, VisualAudioAgentInput] = {}
        
        for lang_name, translated_scenes in linguistic_output.translations.items():
            # Find matching Language enum
            language = self._find_language_enum(lang_name)
            
            # Build scenes for this language
            scenes = []
            for i, scene_data in enumerate(translated_scenes):
                # Get visual prompt from original director output
                original_scene = director_output.scene_breakdown[i] if i < len(director_output.scene_breakdown) else {}
                
                scenes.append(Scene(
                    scene_id=scene_data.get("scene_id", i + 1),
                    duration_est_seconds=original_scene.get("duration_est_seconds", 8),
                    visual_prompt=original_scene.get("visual_prompt", ""),
                    audio_script=scene_data.get("audio_script", ""),
                    text_overlay=scene_data.get("text_overlay"),
                    transition=original_scene.get("transition"),
                    background_music_mood=original_scene.get("background_music_mood"),
                ))
            
            # Build metadata
            meta_data = MetaData(
                language=language,
                target_audience=creator_config.target_groups[0],
                tone=creator_config.tone,
                avatar=creator_config.avatar.id,
                video_format=creator_config.video_format,
                total_duration_seconds=creator_config.get_duration(),
            )
            
            # Create VisualAudioAgentInput for this language
            lang_code = self._get_language_code(language)
            video_inputs[lang_code] = VisualAudioAgentInput(
                project_id=f"{director_output.project_id}_{lang_code}",
                meta_data=meta_data,
                scenes=scenes,
                fact_sheet_reference=fact_sheet,
                sensitivity_cleared=sensitivity_output.passed,
            )
        
        package = MultiLanguageVideoPackage(
            session_id=self._state.session_id if self._state else str(uuid.uuid4()),
            scam_report=scam_report,
            creator_config=creator_config,
            video_inputs=video_inputs,
            sensitivity_report=sensitivity_output,
        )
        
        if self._state:
            self._state.video_package = package
        
        logger.info(f"Video package assembled: {len(video_inputs)} language versions")
        return package
    
    def _find_language_enum(self, lang_name: str) -> Language:
        """Find Language enum from string name."""
        for lang in Language:
            if lang.value == lang_name or lang.name.lower() == lang_name.lower():
                return lang
        return Language.ENGLISH  # fallback
    
    def _get_language_code(self, language: Language) -> str:
        """Get short language code for keys."""
        codes = {
            Language.MALAY: "bm",
            Language.MALAY_URBAN: "bm",
            Language.ENGLISH: "en",
            Language.CHINESE_MANDARIN: "zh",
            Language.CHINESE_CANTONESE: "zh_yue",
            Language.TAMIL: "ta",
        }
        return codes.get(language, "en")
    
    # ==================== VISUAL/AUDIO AGENT ====================
    
    async def generate_video_assets(
        self,
        video_input: VisualAudioAgentInput,
        output_dir: Optional[str] = None,
    ) -> VisualAudioPipelineState:
        """
        Run the Visual/Audio Agent on a single-language VisualAudioAgentInput.
        
        This bridges the pipeline output to the video generation stages:
        1. Expand fact sheet + scenes → full ObfuscatedScamStory
        2. Convert scenes → VeoScript (structured Veo prompts)
        3. Generate character descriptions
        4. Generate character reference images (2×2 grids)
        5. Generate clip reference frames (start/end per segment)
        6. Generate Veo video clips (8s interpolation)
        
        Args:
            video_input: VisualAudioAgentInput from the assembled package
            output_dir: Directory for generated assets (default: output/<project_id>)
            
        Returns:
            VisualAudioPipelineState with all generated assets
        """
        if self._state:
            self._state.visual_audio_status = PipelineStatus.IN_PROGRESS
        
        settings = get_settings()
        base_dir = output_dir or str(
            Path(settings.visual_audio_output_dir) / video_input.project_id
        )
        
        fact_sheet = video_input.fact_sheet_reference
        if not fact_sheet:
            raise ValueError("VisualAudioAgentInput must include fact_sheet_reference")
        
        # Convert Scene models to dicts for the agent
        scenes_dicts = [s.model_dump() for s in video_input.scenes]
        
        va_input = VisualAudioInput(
            project_id=video_input.project_id,
            fact_sheet=fact_sheet,
            scenes=scenes_dicts,
            output_dir=base_dir,
        )
        
        logger.info(f"Starting Visual/Audio Agent for {video_input.project_id}")
        result = await self.visual_audio_agent.process(va_input)
        
        if not result.success:
            if self._state:
                self._state.visual_audio_status = PipelineStatus.FAILED
            raise RuntimeError(f"Visual/Audio Agent failed: {result.error}")
        
        va_state = result.output
        if self._state:
            self._state.visual_audio = va_state
            self._state.visual_audio_status = PipelineStatus.COMPLETED
        
        logger.info(f"Visual/Audio Agent completed: {len(va_state.veo_clips)} clips generated")
        return va_state
    
    async def generate_video_assets_stepwise(
        self,
        video_input: VisualAudioAgentInput,
        output_dir: Optional[str] = None,
        stop_after: Optional[str] = None,
    ) -> VisualAudioPipelineState:
        """
        Run Visual/Audio Agent stages individually for stepwise control.
        
        Args:
            video_input: VisualAudioAgentInput from the assembled package
            output_dir: Directory for generated assets
            stop_after: Stop after this stage: 'story', 'script', 'characters',
                       'char_refs', 'clip_refs', or None for all stages
                       
        Returns:
            VisualAudioPipelineState at the requested stop point
        """
        settings = get_settings()
        base_dir = Path(output_dir or str(
            Path(settings.visual_audio_output_dir) / video_input.project_id
        ))
        base_dir.mkdir(parents=True, exist_ok=True)
        
        fact_sheet = video_input.fact_sheet_reference
        if not fact_sheet:
            raise ValueError("VisualAudioAgentInput must include fact_sheet_reference")
        
        scenes_dicts = [s.model_dump() for s in video_input.scenes]
        agent = self.visual_audio_agent
        agent._ensure_client()
        agent._state.output_dir = str(base_dir)
        
        # Load existing state if available (from previous runs) to reuse completed stages
        if self._state and self._state.visual_audio:
            existing_va_state = self._state.visual_audio
            if existing_va_state.obfuscated_story:
                agent._state.obfuscated_story = existing_va_state.obfuscated_story
            if existing_va_state.veo_script:
                agent._state.veo_script = existing_va_state.veo_script
            if existing_va_state.character_descriptions:
                agent._state.character_descriptions = existing_va_state.character_descriptions
            if existing_va_state.character_ref_images:
                agent._state.character_ref_images = existing_va_state.character_ref_images
            if existing_va_state.clip_ref_images:
                agent._state.clip_ref_images = existing_va_state.clip_ref_images
        
        import time as _time
        if self._state:
            self._state.visual_audio_status = PipelineStatus.IN_PROGRESS
        
        total_stages = 6
        t_pipeline = _time.time()
        
        # Check which stages are already completed
        has_story = agent._state.obfuscated_story is not None
        has_script = agent._state.veo_script is not None
        has_char_descs = agent._state.character_descriptions is not None
        has_char_refs = agent._state.character_ref_images and len(agent._state.character_ref_images) > 0
        has_clip_refs = agent._state.clip_ref_images and len(agent._state.clip_ref_images) > 0

        # Stage 1: Story
        if has_story:
            logger.info("[VA-PIPELINE] Stage 1/%d — Reusing existing ObfuscatedScamStory", total_stages)
            story = agent._state.obfuscated_story
        else:
            t0 = _time.time()
            logger.info("[VA-PIPELINE] Stage 1/%d — Expanding to ObfuscatedScamStory...", total_stages)
            story = await agent.expand_to_story(fact_sheet, scenes_dicts)
            logger.info("[VA-PIPELINE] Stage 1/%d — Story done (%.1fs) — %d chars, %d character roles",
                        total_stages, _time.time() - t0, len(story.story), len(story.character_roles))
        if stop_after == "story":
            return self._save_va_state(agent)
        
        # Stage 2: Script
        if has_script:
            logger.info("[VA-PIPELINE] Stage 2/%d — Reusing existing VeoScript", total_stages)
            script = agent._state.veo_script
        else:
            t0 = _time.time()
            logger.info("[VA-PIPELINE] Stage 2/%d — Generating VeoScript...", total_stages)
            script = await agent.generate_veo_script(story, scenes_dicts)
            logger.info("[VA-PIPELINE] Stage 2/%d — VeoScript done (%.1fs) — %d segments, %ds total",
                        total_stages, _time.time() - t0, len(script.segments), script.total_duration_sec)
        if stop_after == "script":
            return self._save_va_state(agent)
        
        # Stage 3: Character descriptions
        if has_char_descs:
            logger.info("[VA-PIPELINE] Stage 3/%d — Reusing existing character descriptions", total_stages)
            char_descs = agent._state.character_descriptions
        else:
            t0 = _time.time()
            logger.info("[VA-PIPELINE] Stage 3/%d — Generating character descriptions...", total_stages)
            char_descs = await agent.generate_character_descriptions(story, script)
            logger.info("[VA-PIPELINE] Stage 3/%d — Character descriptions done (%.1fs) — %d characters",
                        total_stages, _time.time() - t0, len(char_descs.characters))
        if stop_after == "characters":
            return self._save_va_state(agent)
        
        # Stage 4: Character reference images
        if has_char_refs:
            logger.info("[VA-PIPELINE] Stage 4/%d — Reusing existing character reference images (%d images)", 
                        total_stages, len(agent._state.character_ref_images))
            char_refs = agent._state.character_ref_images
        else:
            t0 = _time.time()
            logger.info("[VA-PIPELINE] Stage 4/%d — Generating character reference images...", total_stages)
            char_refs = await agent.generate_character_ref_images(
                char_descs, base_dir / "character_refs"
            )
            logger.info("[VA-PIPELINE] Stage 4/%d — Character ref images done (%.1fs) — %d images saved",
                        total_stages, _time.time() - t0, len(char_refs))
        if stop_after == "char_refs":
            return self._save_va_state(agent)
        
        # Stage 5: Clip reference frames
        if has_clip_refs:
            logger.info("[VA-PIPELINE] Stage 5/%d — Reusing existing clip reference frames (%d frames)", 
                        total_stages, len(agent._state.clip_ref_images))
            clip_refs = agent._state.clip_ref_images
        else:
            t0 = _time.time()
            logger.info("[VA-PIPELINE] Stage 5/%d — Generating clip reference frames...", total_stages)
            clip_refs = await agent.generate_clip_ref_frames(
                script, char_refs, base_dir / "clip_refs"
            )
            logger.info("[VA-PIPELINE] Stage 5/%d — Clip ref frames done (%.1fs) — %d frames saved",
                        total_stages, _time.time() - t0, len(clip_refs))
        if stop_after == "clip_refs":
            return self._save_va_state(agent)
        
        # Stage 6: Veo clips
        t0 = _time.time()
        logger.info("[VA-PIPELINE] Stage 6/%d — Generating Veo video clips...", total_stages)
        await agent.generate_veo_clips(
            script, char_refs, clip_refs, base_dir / "veo_clips"
        )
        logger.info("[VA-PIPELINE] Stage 6/%d — Veo clips done (%.1fs) — %d clips generated",
                    total_stages, _time.time() - t0, len(agent.state.veo_clips))
        
        if self._state:
            self._state.visual_audio = agent.state
            self._state.visual_audio_status = PipelineStatus.COMPLETED
        
        total_elapsed = _time.time() - t_pipeline
        logger.info("[VA-PIPELINE] === All %d stages completed in %.1fs ===", total_stages, total_elapsed)
        return agent.state
    
    def _save_va_state(self, agent: VisualAudioAgent) -> VisualAudioPipelineState:
        """Snapshot visual/audio state into pipeline state."""
        if self._state:
            self._state.visual_audio = agent.state
        return agent.state
    
    # ==================== SOCIAL OFFICER AGENT ====================
    
    async def generate_social_strategy(
        self,
        platform: str = "instagram",
    ) -> SocialOfficerOutput:
        """
        Generate social media strategy (captions, hashtags, thumbnail, trends).
        
        Requires director_output and creator_config to be set.
        
        Args:
            platform: Target platform (instagram, tiktok, facebook, x)
            
        Returns:
            SocialOfficerOutput with complete social strategy
        """
        if not self._state:
            raise ValueError("No active session.")
        if not self._state.director_output:
            raise ValueError("No director output. Generate script first.")
        if not self._state.fact_sheet:
            raise ValueError("No fact sheet available.")
        if not self._state.creator_config:
            raise ValueError("No creator config available.")
        
        self._state.social_status = PipelineStatus.IN_PROGRESS
        
        social_input = SocialInput(
            fact_sheet=self._state.fact_sheet,
            director_output=self._state.director_output,
            creator_config=self._state.creator_config,
            session_id=self._state.session_id,
            platform=platform,
        )
        
        logger.info(f"Generating social strategy for platform={platform}")
        result = await self.social_agent.process(social_input)
        
        if not result.success:
            self._state.social_status = PipelineStatus.FAILED
            raise RuntimeError(f"Social Officer Agent failed: {result.error}")
        
        # Map agent output to schema model
        agent_output = result.output
        social_output = SocialOfficerOutput(
            project_id=agent_output.project_id,
            platform=agent_output.platform,
            trend_analysis=agent_output.trend_analysis.model_dump(),
            captions=[c.model_dump() for c in agent_output.captions],
            selected_caption_index=agent_output.selected_caption_index,
            thumbnail=agent_output.thumbnail.model_dump(),
            hashtags=agent_output.hashtags.model_dump(),
            posting_notes=agent_output.posting_notes,
        )
        
        self._state.social_output = social_output
        self._state.social_status = PipelineStatus.COMPLETED
        
        logger.info(f"Social strategy generated: {len(social_output.captions)} captions, "
                    f"{social_output.hashtags.total_count} hashtags")
        return social_output
    
    async def refine_social_strategy(
        self,
        feedback: str,
        section: str = "all",
        platform: str = "instagram",
    ) -> SocialOfficerOutput:
        """
        Refine social strategy based on officer feedback.
        
        Args:
            feedback: Officer's feedback/instruction
            section: Section to refine: 'trends', 'captions', 'thumbnail', 'hashtags', or 'all'
            platform: Target platform
            
        Returns:
            Refined SocialOfficerOutput
        """
        if not self._state or not self._state.social_output:
            raise ValueError("No social output to refine. Generate social strategy first.")
        if not self._state.director_output or not self._state.fact_sheet or not self._state.creator_config:
            raise ValueError("Missing pipeline data for refinement.")
        
        from .agents.social_agent import SocialOutput, TrendAnalysis, CaptionOption, ThumbnailRecommendation, HashtagStrategy
        
        # Reconstruct agent-level SocialOutput from the schema-level SocialOfficerOutput
        so = self._state.social_output
        previous_agent_output = SocialOutput(
            project_id=so.project_id,
            platform=so.platform,
            trend_analysis=TrendAnalysis(**so.trend_analysis.model_dump()),
            captions=[CaptionOption(**c.model_dump()) for c in so.captions],
            selected_caption_index=so.selected_caption_index,
            thumbnail=ThumbnailRecommendation(**so.thumbnail.model_dump()),
            hashtags=HashtagStrategy(**so.hashtags.model_dump()),
            posting_notes=so.posting_notes,
        )
        
        social_input = SocialInput(
            fact_sheet=self._state.fact_sheet,
            director_output=self._state.director_output,
            creator_config=self._state.creator_config,
            session_id=self._state.session_id,
            platform=platform,
        )
        
        result = await self.social_agent.refine_section(
            social_input, previous_agent_output, feedback, section
        )
        
        if not result.success:
            raise RuntimeError(f"Social refinement failed: {result.error}")
        
        agent_output = result.output
        social_output = SocialOfficerOutput(
            project_id=agent_output.project_id,
            platform=agent_output.platform,
            trend_analysis=agent_output.trend_analysis.model_dump(),
            captions=[c.model_dump() for c in agent_output.captions],
            selected_caption_index=agent_output.selected_caption_index,
            thumbnail=agent_output.thumbnail.model_dump(),
            hashtags=agent_output.hashtags.model_dump(),
            posting_notes=agent_output.posting_notes,
        )
        
        self._state.social_output = social_output
        return social_output
    
    # ==================== CHAT REFINEMENT ====================
    
    async def chat_refine(
        self,
        message: str,
    ) -> Dict[str, Any]:
        """
        Process a chat message to refine the fact sheet before verification.
        
        This enables conversational editing where officers can say things like:
        - "Make the story hook more urgent"
        - "The fix should include calling 997"
        - "Add more detail about the RM50k loss"
        
        NOTE: Must be called BEFORE /verify. Once verified, use /verify corrections.
        
        Args:
            message: Officer's instruction/feedback
            
        Returns:
            Dict with updated fact sheet and agent response
        """
        if not self._state:
            raise ValueError("No active session. Start a session first.")
        
        if not self._state.fact_sheet:
            raise ValueError("No fact sheet to refine. Call /intake first.")
        
        if self._state.fact_sheet.verified_by_officer:
            raise ValueError("Fact sheet already verified. Use /verify with corrections to make changes.")
        
        # Record officer message
        self._state.chat_history.add_message(
            role=ChatRole.OFFICER,
            content=message,
            target=ChatTarget.FACT_SHEET,
        )
        
        result = await self._refine_fact_sheet_via_chat(message)
        agent_response = result.get("response", "Fact sheet updated.")
        
        # Record agent response
        self._state.chat_history.add_message(
            role=ChatRole.AGENT,
            content=agent_response,
            target=ChatTarget.FACT_SHEET,
        )
        
        return {
            "response": agent_response,
            "updated_content": result.get("content"),
            "chat_history": [m.model_dump() for m in self._state.chat_history.messages[-6:]],
        }
    
    async def _refine_fact_sheet_via_chat(self, instruction: str) -> Dict[str, Any]:
        """Use Research Agent to refine fact sheet based on instruction."""
        if not self._state or not self._state.fact_sheet:
            raise ValueError("No fact sheet to refine.")
        
        current_fact_sheet = self._state.fact_sheet
        conversation_context = self._state.chat_history.get_context()
        
        # Build refinement prompt
        category_label = getattr(current_fact_sheet.category, "value", current_fact_sheet.category)

        prompt = f"""You are refining a Scam Shield Fact Sheet based on officer feedback.

CURRENT FACT SHEET:
- Scam Name: {current_fact_sheet.scam_name}
- Story Hook: {current_fact_sheet.story_hook}
- Red Flag: {current_fact_sheet.red_flag}
- The Fix: {current_fact_sheet.the_fix}
- Category: {category_label}

CONVERSATION:
{conversation_context}

OFFICER'S INSTRUCTION:
{instruction}

Respond in JSON format with:
1. "updated_fields": dict of fields to update (only include changed fields)
2. "response": brief explanation of changes made (1-2 sentences)

Example response:
{{"updated_fields": {{"story_hook": "New improved hook text"}}, "response": "I've updated the story hook to be more urgent as requested."}}
"""
        
        response_text = await self.research_agent._call_llm(
            prompt,
            self.research_agent._get_system_prompt()
        )
        
        # Parse response
        import json
        try:
            # Extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            result = json.loads(response_text[json_start:json_end])
            
            # Apply updates to fact sheet
            if result.get("updated_fields"):
                self._state.fact_sheet = current_fact_sheet.model_copy(
                    update=result["updated_fields"]
                )
            
            return {
                "content": self._state.fact_sheet.model_dump(),
                "response": result.get("response", "Fact sheet updated.")
            }
        except json.JSONDecodeError:
            return {
                "content": current_fact_sheet.model_dump(),
                "response": "I understood your request but couldn't process it. Please try rephrasing."
            }
    
    # ==================== FULL PIPELINE ====================
    
    async def run_full_pipeline(
        self,
        intake: IntakeInput,
        creator_config: CreatorConfig,
        officer_id: str,
        fact_sheet_corrections: Optional[Dict[str, Any]] = None,
        fact_sheet_notes: Optional[str] = None,
    ) -> MultiLanguageVideoPackage:
        """
        Run the complete pipeline from intake to video package.
        
        NOTE: This is a convenience method. In production, you'll likely
        want to run stages separately to allow officer review between stages.
        
        Args:
            intake: Raw scam information
            creator_config: Video configuration
            officer_id: Officer identifier
            fact_sheet_corrections: Optional corrections to fact sheet
            fact_sheet_notes: Optional notes for fact sheet
            
        Returns:
            MultiLanguageVideoPackage ready for Visual/Audio Agent
        """
        import time as _time
        t_full = _time.time()
        self.new_session()
        logger.info("[FULL-PIPELINE] === Starting full pipeline run ===")
        
        # Stage 1: Generate Fact Sheet
        t0 = _time.time()
        logger.info("[FULL-PIPELINE] Stage 1/6 — Research Agent: generating fact sheet...")
        fact_sheet = await self.process_intake(intake)
        logger.info("[FULL-PIPELINE] Stage 1/6 — Fact sheet ready (%.1fs)", _time.time() - t0)
        
        # Stage 2: Verify Fact Sheet (simulated - in prod, officer reviews)
        logger.info("[FULL-PIPELINE] Stage 2/6 — Auto-verifying fact sheet (officer=%s)", officer_id)
        verified_fact_sheet = self.verify_fact_sheet(
            fact_sheet,
            officer_id,
            fact_sheet_notes,
            fact_sheet_corrections,
        )
        
        # Stage 3: Generate Script
        t0 = _time.time()
        logger.info("[FULL-PIPELINE] Stage 3/6 — Director Agent: generating script...")
        director_output = await self.generate_script(verified_fact_sheet, creator_config)
        logger.info("[FULL-PIPELINE] Stage 3/6 — Script ready (%.1fs) — %d scenes",
                    _time.time() - t0, len(director_output.scene_breakdown))
        
        # Stage 4: Generate Translations
        t0 = _time.time()
        logger.info("[FULL-PIPELINE] Stage 4/6 — Linguistic Agent: translating...")
        linguistic_output = await self.generate_translations(
            director_output,
            creator_config.languages,
        )
        logger.info("[FULL-PIPELINE] Stage 4/6 — Translations ready (%.1fs) — %s",
                    _time.time() - t0, list(linguistic_output.translations.keys()))
        
        # Stage 5: Sensitivity Check
        t0 = _time.time()
        logger.info("[FULL-PIPELINE] Stage 5/6 — Sensitivity Agent: checking compliance...")
        sensitivity_output = await self.check_sensitivity(
            director_output,
            linguistic_output,
            director_output.project_id,
        )
        logger.info("[FULL-PIPELINE] Stage 5/6 — Sensitivity check done (%.1fs) — passed=%s, flags=%d",
                    _time.time() - t0, sensitivity_output.passed, len(sensitivity_output.flags))
        
        # Check for critical issues
        if self.sensitivity_agent.has_critical_issues(sensitivity_output):
            logger.warning("[FULL-PIPELINE] Critical sensitivity issues found - review required")
        
        # Stage 6: Assemble Package
        t0 = _time.time()
        logger.info("[FULL-PIPELINE] Stage 6/6 — Assembling video package...")
        package = self.assemble_video_package(
            verified_fact_sheet,
            creator_config,
            director_output,
            linguistic_output,
            sensitivity_output,
        )
        logger.info("[FULL-PIPELINE] Stage 6/6 — Package assembled (%.1fs)", _time.time() - t0)
        
        total = _time.time() - t_full
        logger.info("[FULL-PIPELINE] === Full pipeline completed in %.1fs ===", total)
        return package


# Factory function for easy instantiation
def create_pipeline(
    api_key: Optional[str] = None,
    **kwargs
) -> PipelineOrchestrator:
    """Create a pipeline orchestrator with default configuration."""
    config = PipelineConfig(api_key=api_key, **kwargs)
    return PipelineOrchestrator(config)
