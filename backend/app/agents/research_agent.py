"""
Research Agent - Analyzes scam intake and generates Fact Sheet.

Uses the Gemini Deep Research API (Interactions API) to autonomously
plan, search, read, and synthesize multi-step research tasks.
Falls back to standard Google Search grounding when Deep Research
is disabled.

Agent: deep-research-pro-preview-12-2025 (via Interactions API)
"""
from typing import Optional
from datetime import datetime
import json
import time
import os
import asyncio
import re as regex_module

from google import genai
from google.genai import types

from .base import BaseAgent, AgentConfig, AgentResult
from ..models import (
    IntakeInput,
    FactSheet,
    ScamCategory,
    InputSource,
)

# Deep Research agent identifier
DEEP_RESEARCH_AGENT = "deep-research-pro-preview-12-2025"
# Polling interval in seconds for Deep Research status checks
DEEP_RESEARCH_POLL_INTERVAL = 10
# Maximum wait time for Deep Research (10 minutes)
DEEP_RESEARCH_MAX_WAIT = 600


class ResearchAgent(BaseAgent[IntakeInput, FactSheet]):
    """
    Analyzes raw scam intake and generates a structured Fact Sheet.
    
    This agent:
    1. Receives raw scam information (URL, report, description)
    2. Uses Gemini Deep Research (Interactions API) for autonomous
       multi-step web research to verify scam patterns
    3. Extracts key components: name, hook, red flag, fix, references
    4. Outputs a structured Fact Sheet for officer verification
    
    Deep Research autonomously plans, searches, reads, and iterates
    to produce a comprehensive research report with real citations.
    """
    
    def __init__(self, config: AgentConfig, use_deep_research: bool = True):
        """
        Initialize Research Agent.
        
        Args:
            config: Agent configuration
            use_deep_research: Use Gemini Deep Research API for autonomous
                multi-step web research (default: True). Falls back to
                standard Google Search grounding when disabled.
        """
        super().__init__(config)
        self.use_deep_research = use_deep_research
        self._research_client = None
    
    @property
    def agent_name(self) -> str:
        return "Research Agent"
    
    @property
    def agent_role(self) -> str:
        return (
            "Analyze scam reports and news using Google Search to verify "
            "key information and extract a structured Fact Sheet. Identify scam patterns, "
            "tactics, red flags, and prevention measures with real sources."
        )
    
    def build_prompt(self, input_data: IntakeInput) -> str:
        """Build research prompt based on input source type and research mode."""
        
        source_context = self._get_source_context(input_data)
        
        base_context = f"""You are a Scam Research Analyst for the Malaysian government's Scam Shield initiative.
Your role is to analyze scam reports and news, verify key information using web sources,
and extract a structured Fact Sheet. You must identify scam patterns, tactics, red flags,
and prevention measures with real sources.

Context: Scam Shield is a Malaysian government initiative to create anti-scam awareness
videos targeting vulnerable populations (elderly, non-tech-savvy). Videos are generated
in multiple languages (Malay, English, Chinese, Tamil) and distributed via social media.

## Input Information
Source Type: {input_data.source_type.value}
Content: {input_data.content}
{f"Additional Context: {input_data.additional_context}" if input_data.additional_context else ""}

{source_context}"""

        if self.use_deep_research:
            research_tasks = """
## Research Tasks (Deep Research Mode)

### Core Fact Sheet Research
1. Verify the scam pattern against official Malaysian sources (PDRM, MCMC, BNM, LHDN)
2. Find real reference URLs from news reports and government advisories
3. Identify the scam category and modus operandi
4. Determine the most effective warning signs and prevention advice

### Deep Intelligence Research
5. **Global Ancestry**: Search the web to trace where this scam originated globally. Find international variants and precedents. Which country or region did it start? What was the original form? How has it been localized for the Malaysian context?
6. **Core Psychological Exploit**: Identify the exact cognitive biases being weaponized by the scammers. Research behavioral science literature on why this scam works — what psychological pressure does it apply? (e.g., Authority Bias, Urgency/Scarcity, Social Proof, Loss Aversion)
7. **Victim Profiling**: Search demographic data, news reports, and academic research to identify WHO falls for this specific scam exploit. What age groups, occupations, income levels, or psychographic profiles are most vulnerable? Why are they vulnerable?
8. **Counter-Hack Strategy**: Based on behavioral science research, determine the exact narrative strategy needed to break the victim's cognitive trance. Do NOT rely on logic alone — research what emotional or behavioral intervention works best for the identified psychological exploit. (e.g., "Verification Pause", "Authority Override", "Social Anchor")"""

            json_schema = """
## Required Output
After completing ALL research tasks above, provide the final output as a JSON object with these EXACT fields:

```json
{{
    "scam_name": "Official name for this scam type (e.g., 'Digital Arrest Phone Scam', 'Parcel Delivery Scam')",
    "story_hook": "The narrative - what the scammer does, how they approach victims, what they claim. 2-3 sentences.",
    "red_flag": "The KEY warning sign that identifies this as a scam. What should immediately alert the victim? 1-2 sentences.",
    "the_fix": "Actionable advice - what should the victim do? Include specific helpline numbers if applicable (997 for police, MCMC hotline). 1-2 sentences.",
    "reference_sources": ["List of URLs or official sources that verify this scam pattern"],
    "category": "One of: Digital Arrest, Impersonation, Phishing, Banking Fraud, Love Scam, Investment Scam, Parcel/Delivery Scam, Job Scam, E-Commerce Scam, Other",
    "global_ancestry": "Where this scam originated globally, what it is a variant of, when it first appeared, and how it was adapted for Malaysia. 2-4 sentences with specific countries/dates.",
    "psychological_exploit": "The exact cognitive biases being weaponized. Name them specifically (e.g., 'Authority Bias coupled with High-Urgency Threat') and explain the mechanism. 2-3 sentences.",
    "victim_profile": "The specific demographics most vulnerable to this scam — age, occupation, financial situation, digital literacy. Why they are specifically targeted. 2-3 sentences.",
    "counter_hack": "The behavioral-science-backed narrative strategy to break the victim's trance. Be specific about the intervention technique (e.g., 'Verification Pause', 'Authority Override'). Explain why this works against the identified psychological exploit. 2-3 sentences."
}}
```"""
        else:
            research_tasks = """
## Research Tasks
1. Verify the scam pattern against official Malaysian sources (PDRM, MCMC, BNM, LHDN)
2. Find real reference URLs from news reports and government advisories
3. Identify the scam category and modus operandi
4. Determine the most effective warning signs and prevention advice"""

            json_schema = """
## Required Output
After completing your research, provide the final output as a JSON object with these EXACT fields:

```json
{{
    "scam_name": "Official name for this scam type (e.g., 'Digital Arrest Phone Scam', 'Parcel Delivery Scam')",
    "story_hook": "The narrative - what the scammer does, how they approach victims, what they claim. 2-3 sentences.",
    "red_flag": "The KEY warning sign that identifies this as a scam. What should immediately alert the victim? 1-2 sentences.",
    "the_fix": "Actionable advice - what should the victim do? Include specific helpline numbers if applicable (997 for police, MCMC hotline). 1-2 sentences.",
    "reference_sources": ["List of URLs or official sources that verify this scam pattern"],
    "category": "One of: Digital Arrest, Impersonation, Phishing, Banking Fraud, Love Scam, Investment Scam, Parcel/Delivery Scam, Job Scam, E-Commerce Scam, Other"
}}
```"""

        guidelines = """
## Guidelines
- Use Malaysian context (RM currency, local authorities like PDRM, LHDN, MCMC)
- The "story_hook" should be vivid enough to be recognizable to potential victims
- The "red_flag" should be a simple, memorable warning sign
- The "the_fix" must include actionable steps anyone can follow
- Reference official Malaysian government sources when possible
- Include real, verified URLs in reference_sources

Your final answer MUST contain the JSON object above.
"""

        return f"{base_context}\n{research_tasks}\n{json_schema}\n{guidelines}"
    
    def _get_source_context(self, input_data: IntakeInput) -> str:
        """Get additional context based on input source type."""
        if input_data.source_type == InputSource.NEWS_URL:
            return """
## Research Instructions (News URL)
1. Fetch and analyze the news article content
2. Cross-reference with official police/government announcements
3. Identify the scam pattern and any reported victim demographics
4. Find related cases or warnings from authorities
"""
        elif input_data.source_type == InputSource.POLICE_REPORT:
            return """
## Research Instructions (Police Report)
1. Analyze the report structure and key details
2. Match against known scam patterns in PDRM database
3. Identify MO (modus operandi) and any unique tactics
4. Cross-reference with recent similar reports
"""
        elif input_data.source_type == InputSource.MANUAL_DESCRIPTION:
            return """
## Research Instructions (Manual Description)
1. Identify the scam type from the description
2. Research similar cases and official warnings
3. Validate the pattern against known scam databases
4. Supplement with additional context from official sources
"""
        else:
            return ""
    
    def parse_response(self, response: str, input_data: IntakeInput) -> FactSheet:
        """Parse LLM JSON response into FactSheet model."""
        try:
            data = self._extract_json(response)
            
            # Map category string to enum
            category_str = data.get("category", "Other")
            category = self._map_category(category_str)
            
            # Build FactSheet with optional deep research fields
            fact_sheet_kwargs = dict(
                scam_name=data["scam_name"],
                story_hook=data["story_hook"],
                red_flag=data["red_flag"],
                the_fix=data["the_fix"],
                reference_sources=data.get("reference_sources", []),
                category=category,
                verified_by_officer=False,
            )
            
            # Add deep research insight fields if present
            if data.get("global_ancestry"):
                fact_sheet_kwargs["global_ancestry"] = data["global_ancestry"]
            if data.get("psychological_exploit"):
                fact_sheet_kwargs["psychological_exploit"] = data["psychological_exploit"]
            if data.get("victim_profile"):
                fact_sheet_kwargs["victim_profile"] = data["victim_profile"]
            if data.get("counter_hack"):
                fact_sheet_kwargs["counter_hack"] = data["counter_hack"]
            
            return FactSheet(**fact_sheet_kwargs)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse LLM response as JSON: {e}")
        except KeyError as e:
            raise ValueError(f"Missing required field in response: {e}")

    def _extract_json(self, response: str) -> dict:
        """
        Robustly extract JSON from LLM response, handling common formatting issues.
        Tries multiple strategies:
        1. Direct parse after cleaning markdown fences
        2. Regex extraction of JSON object
        3. Fix common LLM JSON errors (trailing commas, unescaped chars)
        4. Last-resort regex field extraction
        """
        import re
        
        # Strategy 1: Clean markdown fences and try direct parse
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass
        
        # Strategy 2: Extract JSON object with regex
        json_match = re.search(r'\{[\s\S]*\}', cleaned)
        if json_match:
            json_str = json_match.group(0)
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass
            
            # Strategy 3: Fix common issues and retry
            fixed = self._fix_json(json_str)
            try:
                return json.loads(fixed)
            except json.JSONDecodeError:
                pass
        
        # Strategy 4: Try fixing the full cleaned text
        fixed = self._fix_json(cleaned)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass
        
        # Strategy 5: Last-resort regex field extraction
        self.logger.warning("All JSON parse strategies failed, falling back to regex field extraction")
        return self._repair_json_string(cleaned)

    def _fix_json(self, text: str) -> str:
        """Fix common JSON issues from LLM output."""
        import re
        
        # Remove trailing commas before } or ]
        text = re.sub(r',\s*([}\]])', r'\1', text)
        
        # Remove any BOM or zero-width characters
        text = text.replace('\ufeff', '').replace('\u200b', '').replace('\u200c', '').replace('\u200d', '')
        
        # Fix unescaped control characters and problematic chars inside strings
        result = []
        in_string = False
        i = 0
        while i < len(text):
            char = text[i]
            if char == '\\' and in_string and i + 1 < len(text):
                # Already escaped, keep as-is
                result.append(char)
                result.append(text[i + 1])
                i += 2
                continue
            if char == '"' and (i == 0 or text[i - 1] != '\\'):
                in_string = not in_string
                result.append(char)
            elif in_string and ord(char) < 32:
                # Escape control characters
                escape_map = {'\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f'}
                result.append(escape_map.get(char, f'\\u{ord(char):04x}'))
            else:
                result.append(char)
            i += 1
        
        return ''.join(result)

    def _repair_json_string(self, text: str) -> dict:
        """Last-resort JSON repair: re-extract field values using regex."""
        import re
        
        def extract_field(name: str, fallback: str = "") -> str:
            # Match "field_name": "value" — greedy up to next field or closing brace
            pattern = rf'"{name}"\s*:\s*"((?:[^"\\]|\\.)*)"'
            m = re.search(pattern, text)
            if m:
                return m.group(1).replace('\\n', ' ').replace('\\"', '"')
            # Try unquoted or badly quoted
            pattern2 = rf'"{name}"\s*:\s*"(.*?)"\s*[,}}]'
            m2 = re.search(pattern2, text, re.DOTALL)
            if m2:
                return m2.group(1).replace('\n', ' ').replace('"', "'")
            return fallback
        
        def extract_array(name: str) -> list:
            pattern = rf'"{name}"\s*:\s*\[(.*?)\]'
            m = re.search(pattern, text, re.DOTALL)
            if m:
                items = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))
                return items
            return []
        
        return {
            "scam_name": extract_field("scam_name", "Unknown Scam"),
            "story_hook": extract_field("story_hook", "Details unavailable."),
            "red_flag": extract_field("red_flag", "Be cautious of suspicious requests."),
            "the_fix": extract_field("the_fix", "Contact authorities immediately."),
            "reference_sources": extract_array("reference_sources"),
            "category": extract_field("category", "Other"),
            "global_ancestry": extract_field("global_ancestry", "") or None,
            "psychological_exploit": extract_field("psychological_exploit", "") or None,
            "victim_profile": extract_field("victim_profile", "") or None,
            "counter_hack": extract_field("counter_hack", "") or None,
        }
    
    def _map_category(self, category_str: str) -> ScamCategory:
        """Map category string to ScamCategory enum."""
        category_map = {
            "digital arrest": ScamCategory.DIGITAL_ARREST,
            "impersonation": ScamCategory.IMPERSONATION,
            "phishing": ScamCategory.PHISHING,
            "banking fraud": ScamCategory.BANKING_FRAUD,
            "love scam": ScamCategory.LOVE_SCAM,
            "investment scam": ScamCategory.INVESTMENT_SCAM,
            "parcel/delivery scam": ScamCategory.PARCEL_SCAM,
            "parcel scam": ScamCategory.PARCEL_SCAM,
            "delivery scam": ScamCategory.PARCEL_SCAM,
            "job scam": ScamCategory.JOB_SCAM,
            "e-commerce scam": ScamCategory.E_COMMERCE,
            "e-commerce": ScamCategory.E_COMMERCE,
        }
        return category_map.get(category_str.lower(), ScamCategory.OTHER)
    
    async def _call_deep_research(self, prompt: str, on_thought: Optional[callable] = None) -> str:
        """
        Call Gemini Deep Research API via the Interactions API with streaming.
        
        Deep Research autonomously plans, executes, and synthesizes
        multi-step research tasks using web search and reading.
        Uses streaming with thought_summaries to provide real-time
        progress updates via the on_thought callback.
        
        Args:
            prompt: The research query/prompt
            on_thought: Optional async callback receiving thought summary strings
            
        Returns:
            Research report text with citations
        """
        api_key = self.config.api_key or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("No API key provided. Set GOOGLE_API_KEY env var or pass api_key in config.")
        
        # Initialize client
        if self._research_client is None:
            self._research_client = genai.Client(api_key=api_key)
        
        self.logger.info(f"Starting Deep Research (streaming) with agent={DEEP_RESEARCH_AGENT}...")
        
        # Use streaming mode to capture thought summaries in real time
        stream = self._research_client.interactions.create(
            input=prompt,
            agent=DEEP_RESEARCH_AGENT,
            background=True,
            stream=True,
            agent_config={
                "type": "deep-research",
                "thinking_summaries": "auto",
            },
        )
        
        interaction_id = None
        last_event_id = None
        final_text = ""
        
        try:
            for chunk in stream:
                # Track interaction ID
                if chunk.event_type == "interaction.start":
                    interaction_id = chunk.interaction.id
                    self.logger.info(f"Deep Research started: interaction_id={interaction_id}")
                
                if chunk.event_id:
                    last_event_id = chunk.event_id
                
                # Handle content deltas
                if chunk.event_type == "content.delta":
                    if chunk.delta.type == "text":
                        final_text += chunk.delta.text
                    elif chunk.delta.type == "thought_summary":
                        thought_text = chunk.delta.content.text
                        self.logger.info(f"Deep Research thought: {thought_text[:100]}...")
                        if on_thought:
                            await on_thought(thought_text)
                
                elif chunk.event_type == "interaction.complete":
                    self.logger.info(f"Deep Research completed. Report length: {len(final_text)} chars")
                    return final_text
                
                elif chunk.event_type == "error":
                    raise RuntimeError(f"Deep Research stream error")
        
        except Exception as e:
            # If streaming failed mid-way but we have an interaction_id, try polling
            if interaction_id and not final_text:
                self.logger.warning(f"Stream interrupted ({e}), falling back to polling...")
                if on_thought:
                    await on_thought("Reconnecting to research session...")
                return await self._poll_deep_research(interaction_id, on_thought)
            elif final_text:
                # We got partial text before error, return what we have
                self.logger.warning(f"Stream ended with partial result, using collected text")
                return final_text
            raise
        
        # If we exit the loop without completion, fall back to polling
        if interaction_id:
            return await self._poll_deep_research(interaction_id, on_thought)
        
        raise RuntimeError("Deep Research failed: no interaction_id received")
    
    async def _poll_deep_research(self, interaction_id: str, on_thought: Optional[callable] = None) -> str:
        """
        Poll a Deep Research interaction for completion.
        Fallback when streaming is interrupted.
        """
        elapsed = 0
        while elapsed < DEEP_RESEARCH_MAX_WAIT:
            await asyncio.sleep(DEEP_RESEARCH_POLL_INTERVAL)
            elapsed += DEEP_RESEARCH_POLL_INTERVAL
            
            interaction = self._research_client.interactions.get(interaction_id)
            status = interaction.status
            
            self.logger.info(f"Deep Research poll status: {status} (elapsed: {elapsed}s)")
            if on_thought:
                await on_thought(f"Research in progress... ({elapsed}s elapsed)")
            
            if status == "completed":
                result_text = interaction.outputs[-1].text
                self.logger.info(f"Deep Research completed via polling. Report length: {len(result_text)} chars")
                return result_text
            elif status == "failed":
                error_msg = getattr(interaction, 'error', 'Unknown error')
                raise RuntimeError(f"Deep Research failed: {error_msg}")
        
        raise TimeoutError(
            f"Deep Research did not complete within {DEEP_RESEARCH_MAX_WAIT}s "
            f"(interaction_id={interaction_id})"
        )
    
    async def _call_llm_with_grounding(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """
        Fallback: Call LLM with Google Search grounding (non-Deep Research).
        
        Used when Deep Research is disabled. Uses standard generate_content
        with Google Search tool for real-time web grounding.
        
        Args:
            prompt: The research query/prompt
            system_prompt: Optional system instructions
            
        Returns:
            Response with grounded information from web sources
        """
        api_key = self.config.api_key or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("No API key provided. Set GOOGLE_API_KEY env var or pass api_key in config.")
        
        # Initialize client
        if self._research_client is None:
            self._research_client = genai.Client(api_key=api_key)
        
        # Build full prompt with system prompt if provided
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n---\n\n{prompt}"
        else:
            full_prompt = prompt
        
        self.logger.info(f"Calling {self.config.model_name} with Google Search grounding...")
        
        # Configure Google Search tool for grounding
        google_search_tool = types.Tool(
            google_search=types.GoogleSearch()
        )
        
        # Make the API call with grounding
        response = await self._research_client.aio.models.generate_content(
            model=self.config.model_name,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=self.config.temperature,
                max_output_tokens=self.config.max_tokens,
                tools=[google_search_tool],
            ),
        )
        
        self.logger.info(f"Received grounded response from {self.config.model_name}")
        return response.text
    
    async def process(self, input_data: IntakeInput, on_thought: Optional[callable] = None) -> AgentResult:
        """
        Process intake and generate Fact Sheet.
        
        Uses Gemini Deep Research API (Interactions API) for autonomous
        multi-step web research when enabled. Falls back to standard
        Google Search grounding otherwise.
        
        Args:
            input_data: The scam intake information
            on_thought: Optional async callback for streaming thought updates
                during Deep Research. Receives thought summary strings.
        
        Returns AgentResult containing FactSheet or error.
        """
        start_time = time.time()
        if self.use_deep_research:
            model_info = f"Deep Research ({DEEP_RESEARCH_AGENT})"
        else:
            model_info = self.config.model_name + " (with Google Search)"
        
        try:
            # Validate input
            if not self.validate_input(input_data):
                return AgentResult(
                    success=False,
                    error="Invalid input data",
                    execution_time_ms=int((time.time() - start_time) * 1000),
                    model_used=model_info,
                )
            
            # Build prompt
            prompt = self.build_prompt(input_data)
            
            # Call LLM - use Deep Research if enabled, else fallback to grounding
            if self.use_deep_research:
                response = await self._call_deep_research(prompt, on_thought=on_thought)
            else:
                system_prompt = self._get_system_prompt()
                response = await self._call_llm_with_grounding(prompt, system_prompt)
            
            # Parse response
            fact_sheet = self.parse_response(response, input_data)
            
            return AgentResult(
                success=True,
                output=fact_sheet,
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=model_info,
            )
            
        except Exception as e:
            self.logger.error(f"Research Agent failed: {e}")
            return AgentResult(
                success=False,
                error=str(e),
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=model_info,
            )
    
    def validate_input(self, input_data: IntakeInput) -> bool:
        """Validate intake input."""
        if not input_data.content or len(input_data.content.strip()) < 10:
            self.logger.warning("Input content too short")
            return False
        return True


# Factory function for easy instantiation
def create_research_agent(
    model_name: str = "gemini-2.5-flash",
    use_deep_research: bool = True,
    **kwargs
) -> ResearchAgent:
    """
    Create a Research Agent with default configuration.
    
    Args:
        model_name: Gemini model to use as fallback (default: gemini-2.5-flash).
            When Deep Research is enabled, the agent uses
            deep-research-pro-preview-12-2025 instead.
        use_deep_research: Use Gemini Deep Research API for autonomous
            multi-step web research (default: True)
        **kwargs: Additional AgentConfig parameters
    
    Returns:
        Configured ResearchAgent instance
    """
    config = AgentConfig(model_name=model_name, **kwargs)
    return ResearchAgent(config, use_deep_research=use_deep_research)
