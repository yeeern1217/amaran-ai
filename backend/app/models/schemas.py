"""
Scam Shield - JSON Schema Definitions

This file defines the input/output JSON contracts for the multi-agent system.

PIPELINE OVERVIEW:
==================
1. INTAKE: Officer inputs scam info (news URL, police report, or description)
2. FACT SHEET: System analyzes and presents mandatory verification table
3. CREATOR: Multi-agent newsroom generates video content
   → Director Agent (script/scenes)
   → Linguistic Agent (translation, cultural adaptation)
   → Sensitivity Check Agent (3R compliance: Race, Religion, Royalty)
4. Visual/Audio Agent (video generation) - receives final JSON
5. Social Officer Agent (captions, hashtags)
6. PUBLISH

FINAL OUTPUT FORMAT (for Visual/Audio Agent):
=============================================
{
  "project_id": "scam_poslaju_001",
  "meta_data": {
    "language": "Bahasa Melayu (Urban)",
    "target_audience": "Elderly",
    "tone": "Urgent/Warning",
    "avatar": "officer_malay_male_01"
  },
  "scenes": [
    {
      "scene_id": 1,
      "duration_est_seconds": 6,
      "visual_prompt": "Medium shot. The avatar {primary_avatar_id} is holding a smartphone...",
      "audio_script": "Hati-hati! Kalau ada orang telefon mengaku dari Pos Laju...",
      "text_overlay": "JANGAN LAYAN SCAMMER!"
    }
  ]
}
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Literal, Dict, Any
from enum import Enum
from datetime import datetime
import uuid


# ==================== Enums ====================

class TargetAudience(str, Enum):
    ELDERLY = "Elderly"
    STUDENTS = "Students"
    PROFESSIONALS = "Professionals"
    ONLINE_SHOPPERS = "Online Shoppers"
    GENERAL = "General Public"


class Language(str, Enum):
    MALAY = "Bahasa Melayu"
    MALAY_URBAN = "Bahasa Melayu (Urban)"
    ENGLISH = "English"
    CHINESE_MANDARIN = "Chinese (Mandarin)"
    CHINESE_CANTONESE = "Chinese (Cantonese)"
    TAMIL = "Tamil"


class Tone(str, Enum):
    URGENT = "Urgent/Warning"
    CALM = "Calm"
    FRIENDLY = "Friendly"
    AUTHORITATIVE = "Authoritative"
    HIGH_ENERGY = "High Energy"


class InputSource(str, Enum):
    """Source type for scam intake."""
    NEWS_URL = "news_url"
    POLICE_REPORT = "police_report"
    MANUAL_DESCRIPTION = "manual_description"
    TRENDING_NEWSROOM = "trending_newsroom"


class ScamCategory(str, Enum):
    """Standardized scam categories."""
    DIGITAL_ARREST = "Digital Arrest"
    IMPERSONATION = "Impersonation"
    PHISHING = "Phishing"
    BANKING_FRAUD = "Banking Fraud"
    LOVE_SCAM = "Love Scam"
    INVESTMENT_SCAM = "Investment Scam"
    PARCEL_SCAM = "Parcel/Delivery Scam"
    JOB_SCAM = "Job Scam"
    E_COMMERCE = "E-Commerce Scam"
    OTHER = "Other"


class PipelineStatus(str, Enum):
    """Status tracking for pipeline stages."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    AWAITING_REVIEW = "awaiting_review"


class ChatTarget(str, Enum):
    """What the chat message is targeting for edits."""
    FACT_SHEET = "fact_sheet"


class ChatRole(str, Enum):
    """Role in the chat conversation."""
    OFFICER = "officer"
    AGENT = "agent"


class ChatMessage(BaseModel):
    """A single message in the chat history."""
    role: ChatRole
    content: str
    target: Optional[ChatTarget] = ChatTarget.FACT_SHEET
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatHistory(BaseModel):
    """Complete chat history for a session."""
    messages: List["ChatMessage"] = Field(default_factory=list)
    
    def add_message(self, role: ChatRole, content: str, target: Optional[ChatTarget] = ChatTarget.FACT_SHEET) -> "ChatMessage":
        """Add a message to the history."""
        msg = ChatMessage(role=role, content=content, target=target)
        self.messages.append(msg)
        return msg
    
    def get_context(self, max_messages: int = 10) -> str:
        """Get recent conversation context as a string."""
        recent = self.messages[-max_messages:] if len(self.messages) > max_messages else self.messages
        return "\n".join([f"{m.role.value}: {m.content}" for m in recent])


# ==================== STAGE 1: INTAKE ====================

class IntakeInput(BaseModel):
    """
    Raw intake from officer.
    Accepts news URL, police report text, or manual description.
    """
    source_type: InputSource
    content: str = Field(..., description="URL, report text, or description")
    additional_context: Optional[str] = Field(None, description="Any extra context from officer")
    officer_id: Optional[str] = Field(None, description="Officer identifier for audit trail")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ==================== STAGE 2: FACT SHEET (Mandatory Verification) ====================

class FactSheet(BaseModel):
    """
    THE MANDATORY TABLE - Must be verified by officer before video generation.
    Populated by Google Deep Research analysis.
    """
    scam_name: str = Field(..., description="e.g., 'Digital Arrest' Phone Scam")
    story_hook: str = Field(..., description="The narrative - what scammer does/claims")
    red_flag: str = Field(..., description="Key warning sign to identify the scam")
    the_fix: str = Field(..., description="What to do - actionable advice")
    reference_sources: List[str] = Field(default_factory=list, description="URLs/sources for verification")
    category: ScamCategory
    verified_by_officer: bool = Field(default=False, description="Officer must verify before proceeding")
    verification_timestamp: Optional[datetime] = Field(None)
    officer_notes: Optional[str] = Field(None, description="Officer corrections or additions")
    # Deep Research Insights (populated only when Deep Research mode is active)
    global_ancestry: Optional[str] = Field(None, description="Where this scam originated globally, related variants worldwide")
    psychological_exploit: Optional[str] = Field(None, description="Cognitive bias being weaponized (e.g., Authority Bias, Urgency)")
    victim_profile: Optional[str] = Field(None, description="Demographic most vulnerable to this exploit")
    counter_hack: Optional[str] = Field(None, description="Behavioral-science-backed narrative strategy to break the victim's trance")

    def verify(self, officer_id: str, notes: Optional[str] = None) -> "FactSheet":
        """Mark fact sheet as verified by officer."""
        return self.model_copy(update={
            "verified_by_officer": True,
            "verification_timestamp": datetime.utcnow(),
            "officer_notes": notes
        })


class FactSheetWithIntake(BaseModel):
    """Combined intake and fact sheet for pipeline processing."""
    intake: IntakeInput
    fact_sheet: FactSheet
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


# ==================== STAGE 3: CREATOR CONFIG ====================

class ScamReport(BaseModel):
    """
    Processed scam report - derived from FactSheet.
    This is the structured intelligence that feeds the multi-agent pipeline.
    """
    title: str = Field(..., description="Scam title/name")
    category: ScamCategory = Field(..., description="Scam category")
    severity: Literal["low", "medium", "high", "critical"]
    description: str = Field(..., description="Detailed description of the scam")
    story_hook: str = Field(..., description="The narrative hook for video")
    red_flag: str = Field(..., description="Key warning sign")
    the_fix: str = Field(..., description="Actionable advice")
    source_urls: List[str] = Field(default_factory=list, description="Source URLs for reference")
    victims_profile: Optional[str] = Field(None, description="Typical victim profile")
    financial_impact: Optional[str] = Field(None, description="Reported financial losses")


# ==================== INPUT: Creator Config ====================

class AvatarConfig(BaseModel):
    """Avatar configuration - use consistent avatars for trustability."""
    id: str = Field(..., description="Avatar identifier (e.g., officer_malay_male_01)")
    name: str = Field(..., description="Display name (e.g., Inspektor Amir)")
    rank: Optional[str] = Field(None, description="Official rank/title")
    gender: Literal["male", "female"] = Field("male")
    ethnicity: Literal["malay", "chinese", "indian", "mixed"] = Field("malay")


# Standard trusted avatars for consistency
TRUSTED_AVATARS = [
    AvatarConfig(id="officer_malay_male_01", name="Inspektor Amir", rank="Inspektor", gender="male", ethnicity="malay"),
    AvatarConfig(id="officer_malay_female_01", name="Inspektor Siti", rank="Inspektor", gender="female", ethnicity="malay"),
    AvatarConfig(id="officer_chinese_male_01", name="Inspektor Wong", rank="Inspektor", gender="male", ethnicity="chinese"),
    AvatarConfig(id="officer_chinese_female_01", name="Inspektor Mei Lin", rank="Inspektor", gender="female", ethnicity="chinese"),
    AvatarConfig(id="officer_indian_male_01", name="Inspektor Rajan", rank="Inspektor", gender="male", ethnicity="indian"),
    AvatarConfig(id="officer_indian_female_01", name="Inspektor Priya", rank="Inspektor", gender="female", ethnicity="indian"),
]


# Video format constraints
VIDEO_FORMAT_CONSTRAINTS = {
    "reel": {"max_duration": 30, "default_duration": 30},   # Instagram/TikTok Reels
    "story": {"max_duration": 15, "default_duration": 15},  # Stories
    "post": {"max_duration": 60, "default_duration": 60},   # Regular posts
}

# Veo 3 constraint: max 8 seconds per scene
MAX_SCENE_DURATION = 8


class CreatorConfig(BaseModel):
    """
    Configuration from the Creator Studio.
    User selections for video generation parameters.
    """
    target_groups: List[TargetAudience] = Field(..., min_length=1)
    languages: List[Language] = Field(..., min_length=1, description="Generate versions for these languages")
    tone: Tone
    avatar: AvatarConfig
    video_duration_seconds: Optional[int] = Field(None, ge=8, le=60, description="Auto-set based on format if not provided")
    video_format: Literal["reel", "story", "post"] = Field("reel")
    director_instructions: Optional[str] = Field(None, description="Custom instructions for Director Agent")
    
    def get_duration(self) -> int:
        """Get video duration, respecting format constraints."""
        max_dur = VIDEO_FORMAT_CONSTRAINTS[self.video_format]["max_duration"]
        default_dur = VIDEO_FORMAT_CONSTRAINTS[self.video_format]["default_duration"]
        
        if self.video_duration_seconds is None:
            return default_dur
        return min(self.video_duration_seconds, max_dur)


# ==================== INTER-AGENT DATA TRANSFER ====================

class DirectorOutput(BaseModel):
    """Output from Director Agent - raw script and scene structure."""
    project_id: str
    master_script: str = Field(..., description="Full script in primary language")
    scene_breakdown: List[Dict[str, Any]] = Field(..., description="Scene structure with timing")
    creative_notes: Optional[str] = Field(None, description="Director's creative direction notes")
    primary_language: Language


class LinguisticOutput(BaseModel):
    """Output from Linguistic Agent - translated and culturally adapted scripts."""
    project_id: str
    translations: Dict[str, List[Dict[str, Any]]] = Field(
        ..., 
        description="Keyed by language code, contains adapted scene scripts"
    )
    cultural_adaptations: Optional[Dict[str, str]] = Field(
        None,
        description="Notes on cultural adaptations made per language"
    )


class SensitivityFlag(BaseModel):
    """A sensitivity issue flagged by the Sensitivity Check Agent."""
    severity: Literal["warning", "critical"]
    issue_type: str = Field(..., description="e.g., 'racial_stereotype', 'victim_blaming', 'religious_reference'")
    description: str
    scene_id: Optional[int] = Field(None)
    suggested_fix: Optional[str] = Field(None)
    regulation_reference: Optional[str] = Field(None, description="MCMC guideline, Sedition Act section, etc.")


class ComplianceAnalysis(BaseModel):
    """Detailed analysis for a specific compliance category."""
    category: str = Field(..., description="e.g., '3R Compliance', 'Victim Sensitivity'")
    status: Literal["passed", "warning", "flagged"] = Field(..., description="Analysis result")
    analysis: str = Field(..., description="Detailed explanation of what was reviewed and findings")
    elements_reviewed: List[str] = Field(default_factory=list, description="Specific elements that were checked")


class SensitivityCheckOutput(BaseModel):
    """Output from Sensitivity Check Agent."""
    project_id: str
    passed: bool = Field(..., description="True if no critical issues found")
    flags: List[SensitivityFlag] = Field(default_factory=list)
    compliance_summary: str = Field(..., description="Summary of 3R compliance check")
    detailed_analysis: List[ComplianceAnalysis] = Field(
        default_factory=list,
        description="Breakdown of analysis per compliance category"
    )
    checked_against: List[str] = Field(
        default_factory=lambda: ["MCMC Guidelines", "Sedition Act 1948", "3R Policy"]
    )


# ==================== OUTPUT: Scene ====================

class Scene(BaseModel):
    """
    A single scene in the video output.
    Each scene is max 8 seconds (Veo 3 constraint).
    """
    scene_id: int = Field(..., description="Sequential scene identifier")
    duration_est_seconds: int = Field(..., ge=1, le=8, description="Duration in seconds (max 8s for Veo 3)")
    visual_prompt: str = Field(..., description="Prompt for visual generation. Use {primary_avatar_id} for avatar reference")
    audio_script: str = Field(..., description="Script for voiceover/audio generation")
    text_overlay: Optional[str] = Field(None, description="Text to overlay on the video")
    transition: Optional[str] = Field(None, description="Transition effect to next scene")
    background_music_mood: Optional[str] = Field(None, description="Mood for background music (e.g., tense, hopeful)")


# ==================== OUTPUT: Visual/Audio Agent Input ====================

class MetaData(BaseModel):
    """Metadata for the video project."""
    language: Language
    target_audience: TargetAudience
    tone: Tone
    avatar: str = Field(..., description="Avatar ID for the primary character")
    video_format: Literal["reel", "story", "post"] = Field("reel")
    total_duration_seconds: int = Field(..., description="Target total duration")


class VisualAudioAgentInput(BaseModel):
    """
    FINAL OUTPUT: JSON schema for the Visual/Audio Agent.
    
    This is the handoff format from the multi-agent pipeline to the video generation system.
    The Visual/Audio Agent consumes this to produce the final video with:
    - Gemini 3 Pro (Nano Banana) for avatar generation
    - Google Lyria for voiceover and music
    - Lip-sync alignment
    - Google SynthID watermarking
    """
    project_id: str = Field(..., description="Unique project identifier")
    meta_data: MetaData = Field(..., description="Project metadata")
    scenes: List[Scene] = Field(..., min_length=1, description="List of scenes to generate")
    fact_sheet_reference: Optional[FactSheet] = Field(None, description="Original fact sheet for reference")
    sensitivity_cleared: bool = Field(default=False, description="True if passed sensitivity check")


class MultiLanguageVideoPackage(BaseModel):
    """
    Complete package containing video inputs for all requested languages.
    One Scam Shield project can generate multiple language versions.
    """
    session_id: str
    scam_report: ScamReport
    creator_config: CreatorConfig
    video_inputs: Dict[str, VisualAudioAgentInput] = Field(
        ...,
        description="Keyed by language code (e.g., 'bm', 'en', 'zh', 'ta')"
    )
    sensitivity_report: SensitivityCheckOutput
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== VISUAL/AUDIO AGENT: Intermediate Schemas ====================

class ObfuscatedScamStory(BaseModel):
    """Officer's full story turned into a safe, obfuscated version for video/awareness. No real victim identities."""
    title: str = Field(..., description="Short, clear title for the story/video")
    summary: str = Field(..., description="2-3 sentence summary for quick reading")
    story: str = Field(
        ...,
        description="The COMPLETE full narrative with ALL details, identities OBFUSCATED only. "
        "Include every event, sequence, scammer claim, tactic, and dialogue."
    )
    character_roles: List[str] = Field(
        ...,
        description="Roles in the obfuscated story (no real names), for script generation "
        "(e.g. 'Elderly grandmother', 'Fake police caller', 'Bank officer')"
    )
    solution: str = Field(..., description="What the public should do")
    red_flags: List[str] = Field(default_factory=list, description="Key warning signs the public should watch for")


class ScriptSegment(BaseModel):
    """One 8-second clip for Veo video generation."""
    segment_index: int = Field(..., description="1-based index of this segment")
    characters_involved: List[str] = Field(
        ..., description="Character roles in this clip (exact names from character_roles)"
    )
    veo_prompt: str = Field(
        ...,
        description="Structured Veo prompt: (1) Subject+action+setting, (2) Camera, "
        "(3) Lighting/mood, (4) Audio+dialogue (fit 8s), (5) Visual style"
    )


class VeoScript(BaseModel):
    """Full video script: title and ordered 8-second segments for Veo."""
    title: str = Field(..., description="Video title")
    total_duration_sec: int = Field(..., description="Total duration in seconds")
    segments: List[ScriptSegment] = Field(..., description="Ordered list of 8-second segments")


class CharacterDescription(BaseModel):
    """One character's visual description for image generation."""
    role: str = Field(..., description="Character role name")
    type: Literal["person", "scammer"] = Field(
        ...,
        description="'scammer' for perpetrators/AI-cloned roles (featureless); 'person' for victims/authorities"
    )
    description_for_image_generation: str = Field(
        ...,
        description="FULL BODY description head to toe. Person: Malaysian ethnicity, age, attire. "
        "Scammer: featureless silhouette or AI-robot-like figure."
    )


class CharacterDescriptions(BaseModel):
    """All character descriptions for image generation."""
    characters: List[CharacterDescription] = Field(
        ..., description="One entry per character role"
    )


class CharacterRefImage(BaseModel):
    """Index entry for a generated character reference image."""
    role: str
    description: str
    filename: str
    path: str


class ClipRefFramePrompts(BaseModel):
    """Start and end frame prompts for a single segment's clip reference."""
    start_frame_prompt: str = Field(
        ...,
        description="Prompt for START frame (used with character ref images). "
        "Scene/setting, camera, lighting, character pose/expression."
    )
    end_frame_prompt: str = Field(
        ...,
        description="Prompt for END frame (used with start frame as reference). "
        "Same scene, new pose/expression showing progression."
    )


class ClipRefEntry(BaseModel):
    """Index entry for a generated clip reference frame."""
    segment_index: int
    frame: Literal["start", "end"]
    filename: str
    path: str


class VeoClipEntry(BaseModel):
    """Index entry for a generated Veo video clip."""
    segment_index: int
    filename: str
    path: str
    estimated_cost_usd: float = 0.0


class VisualAudioPipelineState(BaseModel):
    """Tracks the state of the Visual/Audio generation pipeline."""
    obfuscated_story: Optional[ObfuscatedScamStory] = None
    veo_script: Optional[VeoScript] = None
    character_descriptions: Optional[CharacterDescriptions] = None
    character_ref_images: List[CharacterRefImage] = Field(default_factory=list)
    clip_ref_prompts: List[Dict[str, Any]] = Field(default_factory=list)
    clip_ref_images: List[ClipRefEntry] = Field(default_factory=list)
    veo_clips: List[VeoClipEntry] = Field(default_factory=list)
    output_dir: Optional[str] = None


# ==================== SOCIAL OFFICER OUTPUT ====================

class SocialTrendAnalysis(BaseModel):
    """Analysis of current social media trends relevant to the scam topic."""
    trending_topics: List[str] = Field(default_factory=list)
    recommended_posting_time: str = Field("")
    content_angle: str = Field("")
    viral_potential: str = Field("low")
    trend_hooks: List[str] = Field(default_factory=list)
    competitor_insights: str = Field("")


class SocialCaptionOption(BaseModel):
    """A single caption option."""
    caption: str = Field(...)
    style: str = Field("informative")
    estimated_engagement: str = Field("medium")
    call_to_action: str = Field("")


class SocialThumbnailRecommendation(BaseModel):
    """Thumbnail recommendation."""
    recommended_scene_id: int = Field(...)
    thumbnail_prompt: str = Field(...)
    text_overlay: str = Field("")
    rationale: str = Field("")
    style_notes: str = Field("")


class SocialHashtagStrategy(BaseModel):
    """Hashtag strategy for the post."""
    primary_hashtags: List[str] = Field(default_factory=list)
    trending_hashtags: List[str] = Field(default_factory=list)
    niche_hashtags: List[str] = Field(default_factory=list)
    branded_hashtags: List[str] = Field(default_factory=list)
    total_count: int = Field(0)
    hashtag_string: str = Field("")


class SocialOfficerOutput(BaseModel):
    """Complete output from Social Officer Agent."""
    project_id: str
    platform: str = Field("instagram")
    trend_analysis: SocialTrendAnalysis
    captions: List[SocialCaptionOption] = Field(default_factory=list)
    selected_caption_index: int = Field(0)
    thumbnail: SocialThumbnailRecommendation
    hashtags: SocialHashtagStrategy
    posting_notes: str = Field("")
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== PIPELINE STATE ====================

class PipelineState(BaseModel):
    """
    Tracks the complete state of a Scam Shield pipeline run.
    Enables iteration and editing at each stage.
    """
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Stage 1: Intake
    intake: Optional[IntakeInput] = None
    intake_status: PipelineStatus = PipelineStatus.PENDING
    
    # Stage 2: Fact Sheet
    fact_sheet: Optional[FactSheet] = None
    fact_sheet_status: PipelineStatus = PipelineStatus.PENDING
    
    # Stage 3: Creator Config
    scam_report: Optional[ScamReport] = None
    creator_config: Optional[CreatorConfig] = None
    
    # Agent outputs
    director_output: Optional[DirectorOutput] = None
    director_status: PipelineStatus = PipelineStatus.PENDING
    
    linguistic_output: Optional[LinguisticOutput] = None
    linguistic_status: PipelineStatus = PipelineStatus.PENDING
    
    sensitivity_output: Optional[SensitivityCheckOutput] = None
    sensitivity_status: PipelineStatus = PipelineStatus.PENDING
    
    # Final output
    video_package: Optional[MultiLanguageVideoPackage] = None
    
    # Visual/Audio Agent state
    visual_audio: Optional[VisualAudioPipelineState] = None
    visual_audio_status: PipelineStatus = PipelineStatus.PENDING
    
    # Social Officer Agent state
    social_output: Optional[SocialOfficerOutput] = None
    social_status: PipelineStatus = PipelineStatus.PENDING
    
    # Chat history for iterative refinement
    chat_history: ChatHistory = Field(default_factory=ChatHistory)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    def update_status(self, stage: str, status: PipelineStatus) -> "PipelineState":
        """Update status for a pipeline stage."""
        updates = {f"{stage}_status": status, "updated_at": datetime.utcnow()}
        return self.model_copy(update=updates)


# ==================== Enhanced Workflow Models ====================

class RecommendAvatarsRequest(BaseModel):
    """Request to generate avatar recommendations."""
    session_id: str
    target_audience: Optional[TargetAudience] = None
    language: Optional[Language] = None
    tone: Optional[Tone] = None


class RecommendAvatarsResponse(BaseModel):
    """Response with avatar recommendations."""
    recommended_avatars: List[str]
    message: str = "Avatar recommendations generated successfully"


class PreviewFrame(BaseModel):
    """Represents a generated visual frame (start or end) for a scene."""
    scene_id: int = Field(..., gt=0, description="Scene number this frame belongs to")
    frame_type: Literal["start", "end"] = Field(..., description="Type of frame (start or end of scene)")
    image_url: Optional[str] = Field(None, description="URL to the generated frame image (if stored)")
    image_data: Optional[str] = Field(None, description="Base64 encoded image data (if stored in memory)")
    visual_prompt: str = Field(..., description="Visual prompt used to generate this frame")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp when frame was generated")
    refined_at: Optional[datetime] = Field(None, description="Timestamp when frame was last refined via chat")
    
    @model_validator(mode='after')
    def validate_image_source(self):
        """Ensure at least one image source is provided."""
        if self.image_url is None and self.image_data is None:
            raise ValueError("Either image_url or image_data must be provided")
        return self


class RefinementEntry(BaseModel):
    """Represents a single chat-based refinement to preview frames."""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_message: str = Field(..., description="User's chat message requesting refinement")
    ai_response: str = Field(..., description="AI's response text")
    updated_prompts: Dict[int, str] = Field(default_factory=dict, description="Map of scene_id to updated visual prompt")
    regenerated_frames: List[int] = Field(default_factory=list, description="List of scene_ids that were regenerated")


class PreviewState(BaseModel):
    """Represents the collection of preview frames for a video package."""
    session_id: str = Field(..., description="Session identifier")
    frames: List[PreviewFrame] = Field(default_factory=list, description="All generated preview frames")
    generation_status: Literal["pending", "generating", "completed", "error"] = Field(
        default="pending", 
        description="Current generation status"
    )
    generated_at: Optional[datetime] = Field(None, description="Timestamp when all frames were generated")
    refinement_history: List[RefinementEntry] = Field(
        default_factory=list, 
        description="History of chat-based refinements"
    )


class GeneratePreviewFramesRequest(BaseModel):
    """Request to generate preview frames for all scenes."""
    session_id: str
    language_code: str = Field(..., description="Language code for frame generation (e.g., 'en', 'bm', 'zh', 'ta')")


class GeneratePreviewFramesResponse(BaseModel):
    """Response with generated preview frames."""
    preview_state: PreviewState
    message: str = "Preview frames generated successfully"


class ChatPreviewFramesRequest(BaseModel):
    """Request to chat about preview frames and refine them."""
    session_id: str
    message: str = Field(..., description="User's chat message")
    chat_history: Optional[List[Dict[str, str]]] = Field(default_factory=list, description="Previous chat messages as dicts with 'role' and 'content'")


class ChatPreviewFramesResponse(BaseModel):
    """Response from chat about preview frames."""
    response: str = Field(..., description="AI's text response")
    updated_frames: Optional[PreviewState] = Field(None, description="Updated preview state if frames were refined")
    updated: bool = Field(..., description="Whether frames were actually updated")


# ==================== Workflow Reorganization Models ====================

class SceneCharacterAssignment(BaseModel):
    """Character assignment for a specific scene."""
    scene_id: int = Field(..., gt=0, description="Scene number this assignment belongs to")
    character_ids: List[str] = Field(..., min_length=2, description="List of character/avatar IDs (minimum 2)")
    character_images: List[str] = Field(default_factory=list, description="List of image URLs for each character")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp when characters were assigned")


class CharacterRecommendation(BaseModel):
    """Character recommendation for a scene (used during generation)."""
    scene_id: int = Field(..., gt=0, description="Scene number this recommendation is for")
    character_ids: List[str] = Field(..., min_length=2, description="List of recommended character/avatar IDs (minimum 2)")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp when recommendation was generated")


# ==================== Example Data ====================

# Sample intake for testing - used by test_pipeline.py
EXAMPLE_INTAKE = {
    "source_type": "manual_description",
    "content": "A retiree in Petaling Jaya lost RM50k to a fake 'Pos Laju' call. Scammer claimed there was a parcel with illegal items and transferred the call to a fake 'police officer' who demanded payment to a 'safe account'.",
    "additional_context": "Victim was alone at home. Scammer kept victim on phone for 3 hours.",
    "officer_id": "OFC-001"
}
