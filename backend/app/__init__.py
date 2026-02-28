"""
Scam Shield Backend

Multi-agent system for generating anti-scam awareness content for Malaysian audiences.

Pipeline:
1. INTAKE: Officer inputs scam info (news URL, police report, or description)
2. FACT SHEET: Research Agent analyzes and presents mandatory verification table
3. CREATOR: Multi-agent newsroom generates video content
   - Director Agent: Script direction, scene structuring
   - Linguistic Agent: Translation, cultural adaptation
   - Sensitivity Check Agent: 3R compliance (Race, Religion, Royalty)
4. OUTPUT: VisualAudioAgentInput ready for video generation

Usage:
    from app import create_pipeline, IntakeInput, CreatorConfig
    
    pipeline = create_pipeline()
    
    # Process intake
    intake = IntakeInput(
        source_type="manual_description",
        content="A retiree lost RM50k to a fake Pos Laju call..."
    )
    fact_sheet = await pipeline.process_intake(intake)
    
    # Verify fact sheet
    verified = pipeline.verify_fact_sheet(fact_sheet, "officer_001")
    
    # Generate video package
    package = await pipeline.generate_video_package(verified, creator_config)
"""

# Configuration
from .config import get_settings, Settings

# Models
from .models import (
    # Enums
    TargetAudience,
    Language,
    Tone,
    InputSource,
    ScamCategory,
    PipelineStatus,
    # Intake
    IntakeInput,
    # Fact Sheet
    FactSheet,
    FactSheetWithIntake,
    # Creator
    ScamReport,
    AvatarConfig,
    CreatorConfig,
    TRUSTED_AVATARS,
    VIDEO_FORMAT_CONSTRAINTS,
    MAX_SCENE_DURATION,
    # Inter-agent
    DirectorOutput,
    LinguisticOutput,
    SensitivityFlag,
    ComplianceAnalysis,
    SensitivityCheckOutput,
    # Output
    Scene,
    MetaData,
    VisualAudioAgentInput,
    MultiLanguageVideoPackage,
    # State
    PipelineState,
    # Examples
    EXAMPLE_INTAKE,
)

# Pipeline
from .pipeline import (
    PipelineOrchestrator,
    PipelineConfig,
    create_pipeline,
)

# Agents
from .agents import (
    BaseAgent,
    AgentConfig,
    ResearchAgent,
    DirectorAgent,
    LinguisticAgent,
    SensitivityCheckAgent,
)

__version__ = "0.1.0"

__all__ = [
    # Config
    "get_settings",
    "Settings",
    # Enums
    "TargetAudience",
    "Language",
    "Tone",
    "InputSource",
    "ScamCategory",
    "PipelineStatus",
    # Intake
    "IntakeInput",
    # Fact Sheet
    "FactSheet",
    "FactSheetWithIntake",
    # Creator
    "ScamReport",
    "AvatarConfig",
    "CreatorConfig",
    "TRUSTED_AVATARS",
    "VIDEO_FORMAT_CONSTRAINTS",
    "MAX_SCENE_DURATION",
    # Inter-agent
    "DirectorOutput",
    "LinguisticOutput",
    "SensitivityFlag",
    "ComplianceAnalysis",
    "SensitivityCheckOutput",
    # Output
    "Scene",
    "MetaData",
    "VisualAudioAgentInput",
    "MultiLanguageVideoPackage",
    # State
    "PipelineState",
    # Examples
    "EXAMPLE_INTAKE",
    # Pipeline
    "PipelineOrchestrator",
    "PipelineConfig",
    "create_pipeline",
    # Agents
    "BaseAgent",
    "AgentConfig",
    "ResearchAgent",
    "DirectorAgent",
    "LinguisticAgent",
    "SensitivityCheckAgent",
]
