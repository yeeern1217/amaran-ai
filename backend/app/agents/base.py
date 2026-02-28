"""
Base Agent - Abstract base class for all Scam Shield agents.

All agents in the pipeline inherit from this class to ensure
consistent interface and behavior.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, TypeVar, Generic
from pydantic import BaseModel, Field
from datetime import datetime
import logging
import os

from google import genai
from google.genai import types

# Type variable for input/output typing
InputT = TypeVar("InputT", bound=BaseModel)
OutputT = TypeVar("OutputT", bound=BaseModel)


class AgentConfig(BaseModel):
    """Configuration for an agent."""
    model_name: str = Field(..., description="LLM model to use (e.g., gemini-3-pro, gemini-3-flash)")
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(4096, ge=1)
    timeout_seconds: int = Field(60, ge=1)
    retry_attempts: int = Field(3, ge=0)
    api_key: Optional[str] = Field(None, description="API key (if not using env var)")


class AgentResult(BaseModel, Generic[OutputT]):
    """Wrapper for agent execution results."""
    success: bool
    output: Optional[Any] = None  # Will be OutputT when successful
    error: Optional[str] = None
    execution_time_ms: int
    model_used: str
    tokens_used: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class BaseAgent(ABC, Generic[InputT, OutputT]):
    """
    Abstract base class for all Scam Shield agents.
    
    Each agent:
    1. Receives structured input (Pydantic model)
    2. Processes via LLM (Gemini)
    3. Returns structured output (Pydantic model)
    
    Subclasses must implement:
    - `build_prompt()`: Construct the LLM prompt
    - `parse_response()`: Parse LLM output to structured data
    - `process()`: Main execution logic
    """
    
    def __init__(self, config: AgentConfig):
        self.config = config
        self.logger = logging.getLogger(self.__class__.__name__)
        self._client = None  # LLM client, initialized lazily
    
    @property
    @abstractmethod
    def agent_name(self) -> str:
        """Unique identifier for this agent."""
        pass
    
    @property
    @abstractmethod
    def agent_role(self) -> str:
        """Description of what this agent does."""
        pass
    
    @abstractmethod
    def build_prompt(self, input_data: InputT) -> str:
        """
        Build the prompt to send to the LLM.
        
        Args:
            input_data: Structured input from previous pipeline stage
            
        Returns:
            Formatted prompt string
        """
        pass
    
    @abstractmethod
    def parse_response(self, response: str, input_data: InputT) -> OutputT:
        """
        Parse LLM response into structured output.
        
        Args:
            response: Raw LLM response text
            input_data: Original input (for context)
            
        Returns:
            Structured output model
        """
        pass
    
    @abstractmethod
    async def process(self, input_data: InputT) -> AgentResult:
        """
        Main processing method. Orchestrates prompt building,
        LLM call, and response parsing.
        
        Args:
            input_data: Structured input
            
        Returns:
            AgentResult containing output or error
        """
        pass
    
    def _get_system_prompt(self) -> str:
        """
        Get the system prompt for this agent.
        Override in subclasses for custom system prompts.
        """
        return f"""You are {self.agent_name}, a specialized AI agent in the Scam Shield system.

Your role: {self.agent_role}

Context: Scam Shield is a Malaysian government initiative to create anti-scam awareness
videos targeting vulnerable populations (elderly, non-tech-savvy). Videos are generated
in multiple languages (Malay, English, Chinese, Tamil) and distributed via social media.

Guidelines:
- Be culturally sensitive to Malaysian context
- Use clear, simple language accessible to all education levels
- Focus on actionable advice that viewers can immediately apply
- Avoid technical jargon unless necessary
- Ensure content is appropriate for all Malaysian communities (3R compliance)
"""
    
    async def _call_llm(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Call the LLM with the given prompt using Google GenAI.
        
        Args:
            prompt: The main prompt to send
            system_prompt: Optional system instructions
            
        Returns:
            The model's response text
        """
        # Configure API key
        api_key = self.config.api_key or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("No API key provided. Set GOOGLE_API_KEY env var or pass api_key in config.")
        
        # Initialize client lazily
        if self._client is None:
            self._client = genai.Client(api_key=api_key)
        
        # Build full prompt with system prompt if provided
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n---\n\n{prompt}"
        else:
            full_prompt = prompt
        
        self.logger.info(f"Calling {self.config.model_name}...")
        
        # Make the API call
        response = await self._client.aio.models.generate_content(
            model=self.config.model_name,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=self.config.temperature,
                max_output_tokens=self.config.max_tokens,
                response_mime_type="application/json",
            ),
        )
        
        self.logger.info(f"Received response from {self.config.model_name}")
        return response.text
    
    def validate_input(self, input_data: InputT) -> bool:
        """
        Validate input before processing.
        Override in subclasses for custom validation.
        """
        return True
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(model={self.config.model_name})>"
