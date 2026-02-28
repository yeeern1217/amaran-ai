"""
Social Officer Agent - Social media optimization for anti-scam videos.

Analyzes social media trends, generates captions, selects thumbnails,
and creates hashtag strategies. Supports iterative refinement at each step.

Model: Gemini Flash (fast iteration for social media content)
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import json
import time
import re

from .base import BaseAgent, AgentConfig, AgentResult
from ..models import (
    FactSheet,
    DirectorOutput,
    Language,
    Tone,
    TargetAudience,
    CreatorConfig,
)


# ==================== Input / Output Schemas ====================

class SocialInput(BaseModel):
    """Input for Social Officer Agent — combines pipeline outputs for social media optimization."""
    fact_sheet: FactSheet
    director_output: DirectorOutput
    creator_config: CreatorConfig
    session_id: str
    platform: str = Field("instagram", description="Target platform: instagram, tiktok, facebook, x")


class TrendAnalysis(BaseModel):
    """Analysis of current social media trends relevant to the scam topic."""
    trending_topics: List[str] = Field(default_factory=list, description="Related trending topics on social media")
    recommended_posting_time: str = Field("", description="Best time to post for target audience")
    content_angle: str = Field("", description="Recommended content angle based on trends")
    viral_potential: str = Field("low", description="Estimated viral potential: low/medium/high")
    trend_hooks: List[str] = Field(default_factory=list, description="Trending hooks/formats to leverage")
    competitor_insights: str = Field("", description="What similar accounts are doing well")


class CaptionOption(BaseModel):
    """A single caption option with metadata."""
    caption: str = Field(..., description="The full caption text")
    style: str = Field("informative", description="Style: informative, storytelling, urgent, conversational")
    estimated_engagement: str = Field("medium", description="Estimated engagement level")
    call_to_action: str = Field("", description="The CTA embedded in the caption")


class ThumbnailRecommendation(BaseModel):
    """Thumbnail selection recommendation."""
    recommended_scene_id: int = Field(..., description="Scene ID to use as thumbnail source")
    thumbnail_prompt: str = Field(..., description="Visual prompt for thumbnail generation")
    text_overlay: str = Field("", description="Text to overlay on thumbnail")
    rationale: str = Field("", description="Why this scene/composition works best")
    style_notes: str = Field("", description="Color, font, and layout recommendations")


class HashtagStrategy(BaseModel):
    """Hashtag strategy for maximum reach."""
    primary_hashtags: List[str] = Field(default_factory=list, description="Core hashtags (high relevance)")
    trending_hashtags: List[str] = Field(default_factory=list, description="Currently trending hashtags to ride")
    niche_hashtags: List[str] = Field(default_factory=list, description="Niche/community hashtags for targeted reach")
    branded_hashtags: List[str] = Field(default_factory=list, description="Campaign/brand hashtags")
    total_count: int = Field(0, description="Total hashtag count")
    hashtag_string: str = Field("", description="Ready-to-copy hashtag string")


class SocialOutput(BaseModel):
    """Complete output from Social Officer Agent."""
    project_id: str
    platform: str = Field("instagram")
    trend_analysis: TrendAnalysis
    captions: List[CaptionOption] = Field(default_factory=list, description="Multiple caption options")
    selected_caption_index: int = Field(0, description="Index of the recommended caption")
    thumbnail: ThumbnailRecommendation
    hashtags: HashtagStrategy
    posting_notes: str = Field("", description="Additional posting recommendations")
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== Agent Implementation ====================

class SocialOfficerAgent(BaseAgent[SocialInput, SocialOutput]):
    """
    Social media optimization agent for anti-scam videos.
    
    This agent:
    1. Analyzes social media trends related to the scam topic
    2. Generates multiple caption options (different styles)
    3. Recommends the best thumbnail scene + composition
    4. Creates a comprehensive hashtag strategy
    
    The officer can chat with this agent to iterate on each part:
    - "Make the caption more urgent"
    - "Use scene 3 for thumbnail instead"
    - "Add more trending hashtags"
    - "Write in Bahasa Melayu"
    """
    
    @property
    def agent_name(self) -> str:
        return "Social Officer Agent"
    
    @property
    def agent_role(self) -> str:
        return (
            "Social media strategist for anti-scam awareness campaigns. "
            "Analyze trends, craft engaging captions, select thumbnails, "
            "and build hashtag strategies optimized for Malaysian social media."
        )
    
    def _get_system_prompt(self) -> str:
        """Social-media-specific system prompt."""
        return """You are the Social Officer Agent for Scam Shield, Malaysia's anti-scam video initiative.

Your expertise:
- Social media optimization (Instagram, TikTok, Facebook, X/Twitter)
- Malaysian social media landscape and user behavior
- Viral content strategies for awareness campaigns
- Hashtag research and trend analysis
- Thumbnail/cover image best practices
- Copywriting for social media across Malay, English, Chinese, and Tamil

Your outputs must:
- Maximize reach and engagement while maintaining credibility
- Use culturally relevant language and references
- Include clear calls-to-action (report, share, protect family)
- Balance virality with accuracy (no clickbait that misleads)
- Follow platform-specific best practices (character limits, formatting)
- Be appropriate for a government/police awareness campaign

Platform guidelines:
- Instagram: 2,200 char caption limit, 30 hashtags max, visual-first
- TikTok: 2,200 char caption, trending sounds/formats important
- Facebook: Longer captions OK, share-focused, community engagement
- X/Twitter: 280 char limit, thread format for longer content, 5 hashtags max
"""
    
    def build_prompt(self, input_data: SocialInput) -> str:
        """Build the comprehensive social media optimization prompt."""
        fs = input_data.fact_sheet
        do = input_data.director_output
        cc = input_data.creator_config
        
        primary_lang = getattr(cc.languages[0], "value", cc.languages[0])
        targets = ", ".join([getattr(t, "value", t) for t in cc.target_groups])
        tone_label = getattr(cc.tone, "value", cc.tone)
        category_label = getattr(fs.category, "value", fs.category)
        
        # Build scene summary for thumbnail selection
        scenes_summary = ""
        for i, scene in enumerate(do.scene_breakdown):
            scene_id = scene.get("scene_id", i + 1)
            purpose = scene.get("purpose", "")
            visual = scene.get("visual_prompt", "")[:100]
            scenes_summary += f"  Scene {scene_id}: {purpose} | Visual: {visual}...\n"
        
        prompt = f"""Generate a complete social media strategy for an anti-scam awareness video.

## SCAM INTELLIGENCE
- Scam Name: {fs.scam_name}
- Category: {category_label}
- Story/Hook: {fs.story_hook}
- Red Flag: {fs.red_flag}
- The Fix: {fs.the_fix}

## VIDEO DETAILS
- Master Script Summary: {do.master_script[:300]}...
- Number of Scenes: {len(do.scene_breakdown)}
- Creative Notes: {do.creative_notes or 'N/A'}
- Primary Language: {primary_lang}
- Target Audience: {targets}
- Tone: {tone_label}
- Video Format: {cc.video_format}
- Platform: {input_data.platform}

## AVAILABLE SCENES (for thumbnail selection)
{scenes_summary}

## OUTPUT REQUIREMENTS

Generate a JSON response with this EXACT structure:

{{
    "trend_analysis": {{
        "trending_topics": ["topic1", "topic2", "topic3"],
        "recommended_posting_time": "Best posting time with timezone (MYT)",
        "content_angle": "The recommended angle/hook for this content",
        "viral_potential": "low/medium/high",
        "trend_hooks": ["trending format 1", "trending format 2"],
        "competitor_insights": "What similar awareness accounts do well"
    }},
    "captions": [
        {{
            "caption": "Full caption text with emojis and formatting",
            "style": "informative",
            "estimated_engagement": "high",
            "call_to_action": "The CTA in this caption"
        }},
        {{
            "caption": "Alternative caption - different style",
            "style": "storytelling",
            "estimated_engagement": "medium",
            "call_to_action": "Different CTA"
        }},
        {{
            "caption": "Third option - platform-optimized",
            "style": "urgent",
            "estimated_engagement": "high",
            "call_to_action": "Urgent CTA"
        }}
    ],
    "selected_caption_index": 0,
    "thumbnail": {{
        "recommended_scene_id": 1,
        "thumbnail_prompt": "Detailed visual prompt for thumbnail generation",
        "text_overlay": "SHORT BOLD TEXT for thumbnail",
        "rationale": "Why this scene works as thumbnail",
        "style_notes": "Color, font, layout recommendations"
    }},
    "hashtags": {{
        "primary_hashtags": ["#AntiScam", "#ScamAlert", "#ScamAwareness"],
        "trending_hashtags": ["#trending1", "#trending2"],
        "niche_hashtags": ["#niche1", "#niche2"],
        "branded_hashtags": ["#ScamShield", "#AmaranAI", "#PDRM"],
        "hashtag_string": "#AntiScam #ScamAlert ..."
    }},
    "posting_notes": "Additional tips for maximizing this post's impact"
}}

## IMPORTANT GUIDELINES
1. Captions should be in {primary_lang} primarily (mix English if natural for Malaysia)
2. Generate exactly 3 caption options with different styles
3. Thumbnail should use the most visually impactful scene
4. Hashtags: mix of English and {primary_lang} hashtags
5. Include Malaysia-specific hashtags (#Malaysia, #PDRM, #ScamMalaysia)
6. Platform-specific: optimize for {input_data.platform}
7. Keep captions within platform character limits

Respond with ONLY the JSON object."""
        
        return prompt
    
    def _extract_json_from_response(self, response: str) -> str:
        """Extract JSON from LLM response."""
        cleaned = response.strip()
        
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        start_idx = cleaned.find('{')
        if start_idx == -1:
            return cleaned
        
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
        return cleaned[start_idx:]
    
    def _fix_json(self, json_str: str) -> str:
        """Fix common JSON issues from LLM output."""
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        open_braces = json_str.count('{') - json_str.count('}')
        open_brackets = json_str.count('[') - json_str.count(']')
        
        json_str += ']' * max(0, open_brackets)
        json_str += '}' * max(0, open_braces)
        
        return json_str
    
    def parse_response(self, response: str, input_data: SocialInput) -> SocialOutput:
        """Parse LLM response into SocialOutput."""
        try:
            cleaned = self._extract_json_from_response(response)
            
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError:
                self.logger.warning("Initial JSON parse failed. Attempting fix...")
                fixed = self._fix_json(cleaned)
                data = json.loads(fixed)
            
            # Build sub-models
            trend = TrendAnalysis(**(data.get("trend_analysis", {})))
            
            captions = []
            for cap_data in data.get("captions", []):
                captions.append(CaptionOption(**cap_data))
            
            thumb_data = data.get("thumbnail", {})
            thumbnail = ThumbnailRecommendation(**thumb_data)
            
            hash_data = data.get("hashtags", {})
            all_tags = (
                hash_data.get("primary_hashtags", []) +
                hash_data.get("trending_hashtags", []) +
                hash_data.get("niche_hashtags", []) +
                hash_data.get("branded_hashtags", [])
            )
            hash_data["total_count"] = len(all_tags)
            if not hash_data.get("hashtag_string"):
                hash_data["hashtag_string"] = " ".join(all_tags)
            hashtags = HashtagStrategy(**hash_data)
            
            return SocialOutput(
                project_id=input_data.director_output.project_id,
                platform=input_data.platform,
                trend_analysis=trend,
                captions=captions,
                selected_caption_index=data.get("selected_caption_index", 0),
                thumbnail=thumbnail,
                hashtags=hashtags,
                posting_notes=data.get("posting_notes", ""),
            )
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse response. Raw (first 500): {response[:500]}")
            raise ValueError(f"Failed to parse Social Agent response as JSON: {e}")
        except Exception as e:
            raise ValueError(f"Error building SocialOutput: {e}")
    
    async def process(self, input_data: SocialInput) -> AgentResult:
        """Process pipeline outputs to generate social media strategy."""
        start_time = time.time()
        max_retries = 2
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                prompt = self.build_prompt(input_data)
                system_prompt = self._get_system_prompt()
                
                response = await self._call_llm(prompt, system_prompt)
                social_output = self.parse_response(response, input_data)
                
                return AgentResult(
                    success=True,
                    output=social_output,
                    execution_time_ms=int((time.time() - start_time) * 1000),
                    model_used=self.config.model_name,
                )
            except ValueError as e:
                last_error = e
                if attempt < max_retries:
                    self.logger.warning(f"Attempt {attempt + 1} failed, retrying...")
                    continue
            except Exception as e:
                self.logger.error(f"Social Officer Agent failed: {e}")
                last_error = e
                break
        
        return AgentResult(
            success=False,
            error=str(last_error),
            execution_time_ms=int((time.time() - start_time) * 1000),
            model_used=self.config.model_name,
        )
    
    async def refine_section(
        self,
        input_data: SocialInput,
        previous_output: SocialOutput,
        feedback: str,
        section: str = "all",
    ) -> AgentResult:
        """
        Refine a specific section based on officer feedback.
        
        Args:
            input_data: Original input
            previous_output: Previous social output
            feedback: Officer's feedback
            section: Which section to refine: 'trends', 'captions', 'thumbnail', 'hashtags', or 'all'
            
        Returns:
            Refined SocialOutput
        """
        start_time = time.time()
        
        section_context = {
            "trends": f"Trend Analysis:\n{json.dumps(previous_output.trend_analysis.model_dump(), indent=2)}",
            "captions": f"Captions:\n{json.dumps([c.model_dump() for c in previous_output.captions], indent=2)}",
            "thumbnail": f"Thumbnail:\n{json.dumps(previous_output.thumbnail.model_dump(), indent=2)}",
            "hashtags": f"Hashtags:\n{json.dumps(previous_output.hashtags.model_dump(), indent=2)}",
        }
        
        if section == "all":
            prev_context = json.dumps(previous_output.model_dump(mode="json"), indent=2)
        else:
            prev_context = section_context.get(section, json.dumps(previous_output.model_dump(mode="json"), indent=2))
        
        refinement_prompt = f"""You previously generated this social media strategy:

## PREVIOUS OUTPUT ({section.upper()} SECTION)
{prev_context}

## OFFICER FEEDBACK
{feedback}

## TASK
Revise the {'entire strategy' if section == 'all' else section + ' section'} based on the feedback.
Return the complete JSON output with the same structure (ALL fields, not just changed ones).
Only modify what the feedback requests — keep everything else intact.

Respond with ONLY the JSON object."""
        
        try:
            response = await self._call_llm(refinement_prompt, self._get_system_prompt())
            social_output = self.parse_response(response, input_data)
            
            return AgentResult(
                success=True,
                output=social_output,
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )
        except Exception as e:
            self.logger.error(f"Social refinement failed: {e}")
            return AgentResult(
                success=False,
                error=str(e),
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )


# Factory function
def create_social_agent(
    model_name: str = "gemini-2.0-flash",
    **kwargs
) -> SocialOfficerAgent:
    """Create a Social Officer Agent with default configuration."""
    if 'max_tokens' not in kwargs:
        kwargs['max_tokens'] = 8192
    config = AgentConfig(model_name=model_name, **kwargs)
    return SocialOfficerAgent(config)
