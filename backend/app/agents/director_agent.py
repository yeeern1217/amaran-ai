"""
Director Agent - Script direction and scene structuring.

Creates the master script and scene breakdown from verified Fact Sheet.
The officer interacts with this agent to customize video direction.

Model: Gemini 3 Pro (for creative direction)
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import json
import time
import uuid

import re

from .base import BaseAgent, AgentConfig, AgentResult
from ..models import (
    FactSheet,
    ScamReport,
    CreatorConfig,
    DirectorOutput,
    Language,
    Tone,
    TargetAudience,
)


class DirectorInput(BaseModel):
    """Input for Director Agent - combines Fact Sheet with Creator Config."""
    fact_sheet: FactSheet
    creator_config: CreatorConfig
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class DirectorAgent(BaseAgent[DirectorInput, DirectorOutput]):
    """
    Creates video script and scene breakdown.
    
    This agent:
    1. Receives verified Fact Sheet + Creator Config
    2. Creates master script in primary language
    3. Breaks script into timed scenes (8-sec clips)
    4. Adds creative direction notes for visual generation
    
    The officer can chat with this agent:
    - "Make this a high-energy 1-minute Reel"
    - "Focus on elderly audience"
    - "Add more urgency"
    """
    
    @property
    def agent_name(self) -> str:
        return "Director Agent"
    
    @property
    def agent_role(self) -> str:
        return (
            "Creative director for anti-scam videos. Transform verified scam intelligence "
            "into compelling, shareable video scripts with precise scene breakdowns. "
            "Optimize for social media engagement while maintaining educational value."
        )
    
    def _get_system_prompt(self) -> str:
        """Director-specific system prompt."""
        return """You are the Director Agent for Scam Shield, Malaysia's anti-scam video initiative.

Your expertise:
- Social media video formats (Reels, TikTok, Stories)
- Attention-grabbing hooks and storytelling
- Malaysian cultural context and communication styles
- Educational content that's also entertaining

Your outputs must:
- Hook viewers in first 3 seconds
- Deliver clear, actionable message
- Be appropriate for target audience (often elderly/non-tech-savvy)
- Work within specified duration limits
- Use avatar-based presentation format

Scene guidelines:
- Each scene MUST be 8 seconds or less (Veo 3 generation limit)
- Include visual prompts for avatar/animation
- Write natural, conversational dialogue
- Add text overlays for key points
- Consider pacing and emotional arc
"""
    
    def build_prompt(self, input_data: DirectorInput) -> str:
        """Build creative direction prompt."""
        fs = input_data.fact_sheet
        cc = input_data.creator_config
        
        # Get primary language and targets
        primary_lang = cc.languages[0].value
        targets = ", ".join([t.value for t in cc.target_groups])
        
        # Get actual duration respecting format constraints
        video_duration = cc.get_duration()
        # Handle enums/strings for category, tone, language
        category_label = getattr(fs.category, "value", fs.category)
        category_key = getattr(fs.category, "name", str(fs.category)).lower()
        primary_lang = getattr(cc.languages[0], "value", cc.languages[0])
        tone_label = getattr(cc.tone, "value", cc.tone)
        
        # Calculate number of scenes (each scene max 8 seconds for Veo 3)
        num_scenes = max(3, video_duration // 8)
        
        prompt = f"""Create a video script for an anti-scam awareness campaign.

## SCAM INTELLIGENCE (Verified Fact Sheet)
- Scam Name: {fs.scam_name}
- Story/Hook: {fs.story_hook}
- Red Flag: {fs.red_flag}
- The Fix: {fs.the_fix}
- Category: {category_label}

## VIDEO CONFIGURATION
- Format: {cc.video_format}
- Target Duration: {video_duration} seconds (STRICT LIMIT)
- Target Audience: {targets}
- Tone: {tone_label}
- Primary Language: {primary_lang}
- Avatar: {cc.avatar.name} ({cc.avatar.id})

{f"## DIRECTOR INSTRUCTIONS (from officer)" + chr(10) + cc.director_instructions if cc.director_instructions else ""}

## OUTPUT REQUIREMENTS

Generate a JSON response with this structure:

{{
    "project_id": "scam_{category_key}_{input_data.session_id[:8]}",
    "master_script": "The complete script in {primary_lang}, written naturally as spoken dialogue",
    "scene_breakdown": [
        {{
            "scene_id": 1,
            "duration_est_seconds": 6,
            "purpose": "HOOK - grab attention immediately",
            "visual_prompt": "Detailed description of what to show. Use {{primary_avatar_id}} for avatar placement.",
            "audio_script": "Exact dialogue in {primary_lang}",
            "text_overlay": "SHORT TEXT FOR SCREEN",
            "transition": "cut/fade/swipe",
            "background_music_mood": "tense/urgent/calm/hopeful"
        }},
        // ... more scenes totaling EXACTLY {video_duration} seconds
    ],
    "creative_notes": "Director notes on overall vision, pacing, visual style"
}}

## SCENE STRUCTURE GUIDE (for {video_duration}s video)
1. HOOK (Scene 1, ~6s): Grab attention - shock, question, or relatable situation
2. PROBLEM (Scene 2, ~8s): Show the scam scenario - what happens to victims
3. RED FLAG (Scene 3, ~8s): Highlight the warning sign - what to look for  
4. SOLUTION (Scene 4, ~8s): Clear action steps + helpline

## CRITICAL CONSTRAINTS
- TOTAL VIDEO DURATION: EXACTLY {video_duration} seconds (NOT MORE)
- EACH SCENE: MAXIMUM 8 seconds (Veo 3 generation limit)
- Generate {num_scenes}-{num_scenes + 1} scenes to fit within {video_duration}s

## STYLE NOTES FOR {cc.tone.value.upper()} TONE
{self._get_tone_guidance(cc.tone)}

## TARGET AUDIENCE: {targets}
{self._get_audience_guidance(cc.target_groups)}

Respond with ONLY the JSON object.
"""
        return prompt
    
    def _get_tone_guidance(self, tone: Tone) -> str:
        """Get specific guidance for the selected tone."""
        guidance = {
            Tone.URGENT: """
- Use warning language: "AWAS!", "Hati-hati!", "Warning!"
- Fast pacing, quick cuts
- Tense background music
- Red/yellow color associations in visual prompts
- Direct, commanding voice""",
            Tone.CALM: """
- Reassuring, measured delivery
- Gentle background music
- Conversational pacing
- Soft transitions
- Empathetic tone""",
            Tone.FRIENDLY: """
- Warm, approachable language
- Smile in visual prompts
- Upbeat but not hyper
- Relatable examples
- Encouraging tone""",
            Tone.AUTHORITATIVE: """
- Professional, official tone
- Avatar in formal pose
- Clear, factual statements
- Reference official sources
- Trustworthy delivery""",
            Tone.HIGH_ENERGY: """
- Dynamic pacing, quick cuts
- Energetic delivery
- Bold text overlays
- Exciting transitions
- Trending audio style""",
        }
        return guidance.get(tone, "")
    
    def _get_audience_guidance(self, targets: List[TargetAudience]) -> str:
        """Get specific guidance for target audience."""
        guidance_parts = []
        for target in targets:
            if target == TargetAudience.ELDERLY:
                guidance_parts.append("""
ELDERLY AUDIENCE:
- Larger text overlays
- Slower pacing
- Clear pronunciation
- Relatable scenarios (phone calls at home, messages from "family")
- Respect and dignity in presentation""")
            elif target == TargetAudience.STUDENTS:
                guidance_parts.append("""
STUDENTS:
- Trendy format, fast-paced
- Current slang OK
- E-commerce/online scenarios
- Quick tips format""")
            elif target == TargetAudience.ONLINE_SHOPPERS:
                guidance_parts.append("""
ONLINE SHOPPERS:
- E-commerce platform visuals
- Deal/promotion scam scenarios
- Payment process focus
- Quick verification tips""")
            elif target == TargetAudience.PROFESSIONALS:
                guidance_parts.append("""
PROFESSIONALS:
- Business context
- Investment/banking scenarios
- Quick, efficient messaging
- Professional tone""")
        return "\n".join(guidance_parts)
    
    def _extract_json_from_response(self, response: str) -> str:
        """Extract JSON from LLM response, handling various formats."""
        cleaned = response.strip()
        
        # Remove markdown code blocks
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        # Try to find JSON object boundaries
        start_idx = cleaned.find('{')
        if start_idx == -1:
            return cleaned
        
        # Find matching closing brace
        brace_count = 0
        end_idx = -1
        for i, char in enumerate(cleaned[start_idx:], start=start_idx):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i
                    break
        
        if end_idx != -1:
            return cleaned[start_idx:end_idx + 1]
        
        # If no matching brace found, return from start brace to end
        return cleaned[start_idx:]
    
    def _fix_truncated_json(self, json_str: str) -> str:
        """Attempt to fix common JSON issues from LLM output."""
        # Remove any trailing commas before } or ]
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        # Fix common LLM issues with unescaped newlines in strings
        # Replace actual newlines within strings with \n
        result = []
        in_string = False
        escaped = False
        i = 0
        while i < len(json_str):
            char = json_str[i]
            if escaped:
                result.append(char)
                escaped = False
                i += 1
                continue
            if char == '\\':
                escaped = True
                result.append(char)
                i += 1
                continue
            if char == '"':
                in_string = not in_string
                result.append(char)
                i += 1
                continue
            if in_string and char == '\n':
                result.append('\\n')
                i += 1
                continue
            result.append(char)
            i += 1
        
        json_str = ''.join(result)
        
        # Count open braces/brackets
        open_braces = json_str.count('{') - json_str.count('}')
        open_brackets = json_str.count('[') - json_str.count(']')
        
        # Check for unclosed string (odd number of unescaped quotes)
        in_string = False
        escaped = False
        for char in json_str:
            if escaped:
                escaped = False
                continue
            if char == '\\':
                escaped = True
                continue
            if char == '"':
                in_string = not in_string
        
        # If we're in an unclosed string, close it
        if in_string:
            json_str += '"'
        
        # Close any unclosed brackets/braces
        json_str += ']' * open_brackets
        json_str += '}' * open_braces
        
        return json_str

    def parse_response(self, response: str, input_data: DirectorInput) -> DirectorOutput:
        """Parse LLM response into DirectorOutput."""
        try:
            cleaned = self._extract_json_from_response(response)
            
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError as e:
                # Try to fix truncated JSON
                self.logger.warning(f"Initial JSON parse failed: {e}. Attempting to fix truncated JSON...")
                fixed = self._fix_truncated_json(cleaned)
                data = json.loads(fixed)
            
            return DirectorOutput(
                project_id=data["project_id"],
                master_script=data["master_script"],
                scene_breakdown=data["scene_breakdown"],
                creative_notes=data.get("creative_notes"),
                primary_language=input_data.creator_config.languages[0],
            )
        except json.JSONDecodeError as e:
            # Log the problematic response for debugging
            self.logger.error(f"Failed to parse response. Raw response (first 500 chars): {response[:500]}")
            raise ValueError(f"Failed to parse Director response as JSON: {e}")
        except KeyError as e:
            raise ValueError(f"Missing required field in response: {e}")
    
    async def process(self, input_data: DirectorInput) -> AgentResult:
        """Process Fact Sheet and Creator Config to generate script."""
        start_time = time.time()
        max_retries = 2
        last_error = None
        
        # Validate: Fact Sheet must be verified
        if not input_data.fact_sheet.verified_by_officer:
            return AgentResult(
                success=False,
                error="Fact Sheet must be verified by officer before script generation",
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )
        
        for attempt in range(max_retries + 1):
            try:
                # Build and send prompt
                prompt = self.build_prompt(input_data)
                system_prompt = self._get_system_prompt()
                
                response = await self._call_llm(prompt, system_prompt)
                
                # Parse response
                director_output = self.parse_response(response, input_data)
                
                return AgentResult(
                    success=True,
                    output=director_output,
                    execution_time_ms=int((time.time() - start_time) * 1000),
                    model_used=self.config.model_name,
                )
                
            except ValueError as e:
                last_error = e
                if attempt < max_retries:
                    self.logger.warning(f"Attempt {attempt + 1} failed with parse error, retrying...")
                    continue
                self.logger.error(f"Director Agent failed after {max_retries + 1} attempts: {e}")
            except Exception as e:
                self.logger.error(f"Director Agent failed: {e}")
                last_error = e
                break
        
        return AgentResult(
            success=False,
            error=str(last_error),
            execution_time_ms=int((time.time() - start_time) * 1000),
            model_used=self.config.model_name,
        )
    
    async def refine_with_feedback(
        self,
        input_data: DirectorInput,
        previous_output: DirectorOutput,
        feedback: str
    ) -> AgentResult:
        """
        Refine script based on officer feedback.
        
        Args:
            input_data: Original input
            previous_output: Previous script output
            feedback: Officer's feedback for changes
            
        Returns:
            Refined DirectorOutput
        """
        start_time = time.time()
        
        try:
            refinement_prompt = f"""You previously generated this video script:

## PREVIOUS OUTPUT
Project ID: {previous_output.project_id}
Master Script: {previous_output.master_script}

Scene Breakdown:
{json.dumps(previous_output.scene_breakdown, indent=2)}

## OFFICER FEEDBACK
{feedback}

## TASK
Revise the script based on the feedback. Maintain the same JSON structure.
Only modify what the feedback requests - keep everything else intact.

Respond with the complete revised JSON output.
"""
            
            response = await self._call_llm(refinement_prompt, self._get_system_prompt())
            director_output = self.parse_response(response, input_data)
            
            return AgentResult(
                success=True,
                output=director_output,
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )
            
        except Exception as e:
            self.logger.error(f"Director refinement failed: {e}")
            return AgentResult(
                success=False,
                error=str(e),
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )


# Factory function
def create_director_agent(
    model_name: str = "gemini-2.0-flash",
    **kwargs
) -> DirectorAgent:
    """Create a Director Agent with default configuration."""
    # Director Agent needs higher max_tokens due to complex scene breakdowns
    if 'max_tokens' not in kwargs:
        kwargs['max_tokens'] = 8192
    config = AgentConfig(model_name=model_name, **kwargs)
    return DirectorAgent(config)
