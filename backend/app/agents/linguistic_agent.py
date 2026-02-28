"""
Linguistic Agent - Translation and cultural adaptation.

Translates and adapts scripts for different Malaysian language communities.
Ensures cultural accuracy and natural expression in each mother tongue.

Model: Gemini 3 Flash (for speed across multiple language versions)
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import json
import time

from .base import BaseAgent, AgentConfig, AgentResult
from ..models import (
    DirectorOutput,
    LinguisticOutput,
    Language,
    CreatorConfig,
)


class LinguisticInput(BaseModel):
    """Input for Linguistic Agent."""
    director_output: DirectorOutput
    target_languages: List[Language]
    primary_language: Language


class LinguisticAgent(BaseAgent[LinguisticInput, LinguisticOutput]):
    """
    Translates and culturally adapts video scripts.
    
    This agent:
    1. Receives master script from Director Agent
    2. Translates to all requested languages
    3. Adapts cultural references, idioms, expressions
    4. Ensures natural-sounding dialogue in each language
    
    Key considerations:
    - Malaysian Chinese may use Mandarin or Cantonese
    - Malay varies by region (urban vs kampung)
    - Tamil should feel natural to Malaysian Indians
    - Code-switching is common and acceptable
    """
    
    @property
    def agent_name(self) -> str:
        return "Linguistic Agent"
    
    @property
    def agent_role(self) -> str:
        return (
            "Expert translator and cultural adapter for Malaysian languages. "
            "Ensure every language version feels native and natural, not just translated. "
            "Preserve emotional impact while adapting to cultural context."
        )
    
    def _get_system_prompt(self) -> str:
        """Linguistic-specific system prompt."""
        return """You are the Linguistic Agent for Scam Shield, specializing in Malaysian multilingual content.

Your expertise:
- Native-level fluency in Bahasa Melayu, English, Mandarin Chinese, and Tamil
- Understanding of Malaysian cultural nuances across ethnic communities
- Knowledge of code-switching patterns common in Malaysia
- Awareness of generational language differences

Translation principles:
1. NATURAL EXPRESSION: Don't translate word-for-word. Recreate the meaning naturally.
2. CULTURAL ADAPTATION: Replace idioms/references with culturally equivalent ones.
3. EMOTIONAL PRESERVATION: Maintain the urgency, warmth, or authority of the original.
4. ACCESSIBILITY: Use everyday vocabulary, avoid overly formal or literary language.

Language-specific notes:
- Bahasa Melayu: Use urban/conversational style unless targeting rural areas
- Chinese: Default to Mandarin; use simplified characters
- Tamil: Use Malaysian Tamil (not Indian Tamil), accessible vocabulary
- English: Malaysian English is fine; avoid British/American-specific expressions

Output format: Keep the same scene structure, only translate audio_script and text_overlay.
"""
    
    def build_prompt(self, input_data: LinguisticInput) -> str:
        """Build translation prompt for all target languages."""
        
        # Get language names
        lang_names = [lang.value for lang in input_data.target_languages 
                      if lang != input_data.primary_language]
        
        if not lang_names:
            raise ValueError("No additional languages to translate to")
        
        prompt = f"""Translate and culturally adapt this video script.

## ORIGINAL SCRIPT (in {input_data.primary_language.value})

Master Script:
{input_data.director_output.master_script}

Scene Breakdown:
{json.dumps(input_data.director_output.scene_breakdown, indent=2, ensure_ascii=False)}

## TARGET LANGUAGES
{', '.join(lang_names)}

## OUTPUT FORMAT
Generate a JSON response with translations for EACH target language:

{{
    "translations": {{
        "{lang_names[0]}": [
            {{
                "scene_id": 1,
                "audio_script": "Translated dialogue in {lang_names[0]}",
                "text_overlay": "TRANSLATED OVERLAY"
            }},
            // ... all scenes
        ],
        // ... repeat for each language
    }},
    "cultural_adaptations": {{
        "{lang_names[0]}": "Brief notes on any cultural adaptations made for this language",
        // ... for each language
    }}
}}

## TRANSLATION GUIDELINES

### Bahasa Melayu (if translating TO Malay)
- Use natural conversational style
- "Hati-hati!" instead of formal "Berhati-hatilah"
- Include common expressions like "Jangan layan!", "Terus letak telefon!"
- OK to mix some English for commonly used terms

### Chinese/Mandarin (if translating TO Chinese)
- Use simplified Chinese characters
- Natural spoken Mandarin, not written/literary style
- Malaysian Chinese expressions are preferred
- Common warnings: 小心!, 注意!, 不要相信!

### Tamil (if translating TO Tamil)
- Use Malaysian Tamil vocabulary and expressions
- Avoid overly formal or Indian Tamil style
- Keep sentences short and punchy
- Common warnings: கவனம்!, ஜாக்கிரதை!

### English (if translating TO English)
- Malaysian English is acceptable
- Keep it simple - target audience may not be native speakers
- Direct, clear sentences
- Common warnings: "Be careful!", "Don't fall for it!", "Hang up!"

## IMPORTANT
- Keep scene_id matching the original
- Preserve visual_prompt (no translation needed - it's for image generation)
- Duration should remain the same
- Maintain the same emotional tone

Respond with ONLY the JSON object.
"""
        return prompt
    
    def parse_response(self, response: str, input_data: LinguisticInput) -> LinguisticOutput:
        """Parse LLM response into LinguisticOutput."""
        try:
            # Clean response
            cleaned = response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            data = json.loads(cleaned)
            
            return LinguisticOutput(
                project_id=input_data.director_output.project_id,
                translations=data["translations"],
                cultural_adaptations=data.get("cultural_adaptations"),
            )
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Linguistic response as JSON: {e}")
        except KeyError as e:
            raise ValueError(f"Missing required field in response: {e}")
    
    async def process(self, input_data: LinguisticInput) -> AgentResult:
        """Process Director output and generate translations."""
        start_time = time.time()
        
        try:
            # Check if translation is needed
            languages_to_translate = [
                lang for lang in input_data.target_languages 
                if lang != input_data.primary_language
            ]
            
            if not languages_to_translate:
                # No translation needed - return original as single-language output
                original_scenes = [
                    {
                        "scene_id": scene["scene_id"],
                        "audio_script": scene["audio_script"],
                        "text_overlay": scene.get("text_overlay", ""),
                    }
                    for scene in input_data.director_output.scene_breakdown
                ]
                
                return AgentResult(
                    success=True,
                    output=LinguisticOutput(
                        project_id=input_data.director_output.project_id,
                        translations={input_data.primary_language.value: original_scenes},
                        cultural_adaptations=None,
                    ),
                    execution_time_ms=int((time.time() - start_time) * 1000),
                    model_used=self.config.model_name,
                )
            
            # Build and send prompt
            prompt = self.build_prompt(input_data)
            system_prompt = self._get_system_prompt()
            
            response = await self._call_llm(prompt, system_prompt)
            
            # Parse response
            linguistic_output = self.parse_response(response, input_data)
            
            # Add original language to translations
            original_scenes = [
                {
                    "scene_id": scene["scene_id"],
                    "audio_script": scene["audio_script"],
                    "text_overlay": scene.get("text_overlay", ""),
                }
                for scene in input_data.director_output.scene_breakdown
            ]
            linguistic_output.translations[input_data.primary_language.value] = original_scenes
            
            return AgentResult(
                success=True,
                output=linguistic_output,
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )
            
        except Exception as e:
            self.logger.error(f"Linguistic Agent failed: {e}")
            return AgentResult(
                success=False,
                error=str(e),
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )
    
    async def translate_single_language(
        self,
        director_output: DirectorOutput,
        from_language: Language,
        to_language: Language
    ) -> AgentResult:
        """
        Translate to a single language (for on-demand translation).
        
        Useful when user requests additional language after initial generation.
        """
        input_data = LinguisticInput(
            director_output=director_output,
            target_languages=[to_language],
            primary_language=from_language,
        )
        return await self.process(input_data)


# Factory function
def create_linguistic_agent(
    model_name: str = "gemini-2.0-flash",
    **kwargs
) -> LinguisticAgent:
    """Create a Linguistic Agent with default configuration."""
    config = AgentConfig(model_name=model_name, **kwargs)
    return LinguisticAgent(config)
