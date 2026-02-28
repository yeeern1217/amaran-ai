"""
Scam Shield Configuration

Load configuration from environment variables or .env file.
"""
import os
from typing import Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()


class Settings(BaseModel):
    """Application settings."""
    
    # Google AI
    google_api_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("GOOGLE_API_KEY"),
        description="Google API key for Gemini models"
    )
    
    # Model defaults
    default_research_model: str = Field(
        default_factory=lambda: os.getenv("RESEARCH_MODEL", "gemini-2.0-flash"),
        description="Default model for Research Agent"
    )
    default_director_model: str = Field(
        default_factory=lambda: os.getenv("DIRECTOR_MODEL", "gemini-2.0-flash"),
        description="Default model for Director Agent"
    )
    default_linguistic_model: str = Field(
        default_factory=lambda: os.getenv("LINGUISTIC_MODEL", "gemini-2.0-flash"),
        description="Default model for Linguistic Agent"
    )
    default_sensitivity_model: str = Field(
        default_factory=lambda: os.getenv("SENSITIVITY_MODEL", "gemini-2.0-flash"),
        description="Default model for Sensitivity Check Agent"
    )
    default_visual_audio_model: str = Field(
        default_factory=lambda: os.getenv("VISUAL_AUDIO_MODEL", "gemini-3-flash-preview"),
        description="Default model for Visual/Audio Agent (text gen stages)"
    )
    default_social_model: str = Field(
        default_factory=lambda: os.getenv("SOCIAL_MODEL", "gemini-2.0-flash"),
        description="Default model for Social Officer Agent"
    )
    visual_audio_image_model: str = Field(
        default_factory=lambda: os.getenv("VISUAL_AUDIO_IMAGE_MODEL", "gemini-2.5-flash-image"),
        description="Model for image generation (Nano Banana)"
    )
    visual_audio_veo_model: str = Field(
        default_factory=lambda: os.getenv("VEO_MODEL", "veo-3.1-fast-generate-preview"),
        description="Model for Veo video generation"
    )
    visual_audio_output_dir: str = Field(
        default_factory=lambda: os.getenv("VISUAL_AUDIO_OUTPUT_DIR", "output"),
        description="Base output directory for visual/audio assets"
    )
    
    # Serper API (Google Search API for trending news)
    serper_api_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("SERPER_API_KEY"),
        description="Serper API key for fetching trending scam news"
    )
    
    # Timeouts
    agent_timeout_seconds: int = Field(
        default_factory=lambda: int(os.getenv("AGENT_TIMEOUT", "60")),
        description="Default timeout for agent LLM calls"
    )
    
    # Deep Research for Research Agent
    use_deep_research: bool = Field(
        default_factory=lambda: os.getenv("USE_DEEP_RESEARCH", "true").lower() == "true",
        description="Use Gemini Deep Research API (Interactions API) for autonomous multi-step web research in fact sheet generation"
    )
    
    # Logging
    log_level: str = Field(
        default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"),
        description="Logging level"
    )
    
    # Feature flags
    skip_sensitivity_check: bool = Field(
        default_factory=lambda: os.getenv("SKIP_SENSITIVITY_CHECK", "false").lower() == "true",
        description="Skip sensitivity check (NOT RECOMMENDED for production)"
    )


# Singleton settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get application settings (singleton)."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reload_settings() -> Settings:
    """Reload settings from environment."""
    global _settings
    load_dotenv(override=True)
    _settings = Settings()
    return _settings
