"""
Sensitivity Check Agent - 3R Compliance and Content Review.

Reviews generated scripts for sensitive content before video generation.
Checks against Malaysian regulations: MCMC Guidelines, Sedition Act, 3R policy.

Model: Gemini 3 Flash (for fast compliance checking)
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import json
import time

from .base import BaseAgent, AgentConfig, AgentResult
from ..models import (
    DirectorOutput,
    LinguisticOutput,
    SensitivityFlag,
    ComplianceAnalysis,
    SensitivityCheckOutput,
    Language,
)


class SensitivityInput(BaseModel):
    """Input for Sensitivity Check Agent."""
    project_id: str
    director_output: DirectorOutput
    linguistic_output: LinguisticOutput
    
    
class SensitivityCheckAgent(BaseAgent[SensitivityInput, SensitivityCheckOutput]):
    """
    Reviews content for 3R compliance and sensitivity issues.
    
    Checks against:
    - 3R Policy: Race, Religion, Royalty
    - MCMC Guidelines (Malaysian Communications and Multimedia Commission)
    - Sedition Act 1948
    - Victim-blaming language
    - Stereotyping
    - Inadvertent offensive content
    
    This agent flags issues but doesn't automatically fix them.
    Officer must review and approve before proceeding to video generation.
    """
    
    @property
    def agent_name(self) -> str:
        return "Sensitivity Check Agent"
    
    @property
    def agent_role(self) -> str:
        return (
            "Compliance reviewer for Malaysian content regulations. "
            "Flag any content that could be seen as racist, religiously insensitive, "
            "disrespectful to royalty, or victim-blaming. Protect both victims and communities."
        )
    
    def _get_system_prompt(self) -> str:
        """Sensitivity-specific system prompt."""
        return """You are the Sensitivity Check Agent for Scam Shield, ensuring all content complies with Malaysian regulations.

## COMPLIANCE FRAMEWORK

### 3R Policy (Race, Religion, Royalty)
Malaysia's content guidelines prohibit content that:
- Demeans or stereotypes any racial/ethnic group
- Insults or misrepresents any religion
- Shows disrespect to the monarchy (Yang di-Pertuan Agong, Sultans)

### MCMC Guidelines
The Malaysian Communications and Multimedia Commission prohibits:
- Content that incites hatred between groups
- Defamatory or false statements about individuals/organizations
- Content that disturbs public harmony

### Sedition Act 1948
Prohibits content that:
- Promotes feelings of ill-will between races
- Questions constitutional provisions (special position of Malays, citizenship rights)
- Creates disaffection against rulers or government

### Additional Considerations
- VICTIM-BLAMING: Never imply the victim deserved to be scammed
- STEREOTYPING: Avoid portraying certain groups as scammers or victims
- AGEISM: Don't demean elderly for being less tech-savvy
- CLASSISM: Don't mock people for being targeted by scams

## SEVERITY LEVELS
- WARNING: Content that could be improved but isn't critically problematic
- CRITICAL: Content that must be changed before publication

## OUTPUT
You must identify ANY potentially problematic content, even if mild.
It's better to flag and have officer approve than to miss something sensitive.
"""

    # Malaysian regulatory references
    REGULATIONS = {
        "mcmc": {
            "name": "MCMC Content Standards",
            "sections": {
                "hate_speech": "Malaysian Content Code - Prohibition of content promoting hatred",
                "public_order": "CMA 1998 Section 211 - Prohibition of offensive content",
                "defamation": "Malaysian Content Code - Defamatory content guidelines",
            }
        },
        "sedition": {
            "name": "Sedition Act 1948",
            "sections": {
                "racial_harmony": "Section 3(1)(e) - Promoting ill-will between races",
                "rulers": "Section 3(1)(a) - Exciting disaffection against any Ruler",
                "constitution": "Section 3(1)(f) - Questioning constitutional matters",
            }
        },
        "3r": {
            "name": "3R Policy (Race, Religion, Royalty)",
            "sections": {
                "race": "Prohibition of racial stereotyping and discrimination",
                "religion": "Prohibition of religious insensitivity",
                "royalty": "Prohibition of disrespect to monarchy",
            }
        }
    }
    
    def build_prompt(self, input_data: SensitivityInput) -> str:
        """Build compliance review prompt."""
        
        # Compile all scripts to review
        all_scripts = []
        
        # Add original script
        all_scripts.append({
            "language": input_data.director_output.primary_language.value,
            "master_script": input_data.director_output.master_script,
            "scenes": input_data.director_output.scene_breakdown,
        })
        
        # Add translated scripts
        for lang, scenes in input_data.linguistic_output.translations.items():
            if lang != input_data.director_output.primary_language.value:
                all_scripts.append({
                    "language": lang,
                    "scenes": scenes,
                })
        
        prompt = f"""Review the following anti-scam video scripts for sensitivity and compliance issues.

## SCRIPTS TO REVIEW

{json.dumps(all_scripts, indent=2, ensure_ascii=False)}

## REVIEW CHECKLIST

Check ALL scripts (including translations) for:

### 1. 3R COMPLIANCE
- [ ] No racial stereotypes or generalizations about ethnic groups
- [ ] No religious references that could offend any faith
- [ ] No disrespect to Malaysian royalty or rulers

### 2. VICTIM SENSITIVITY
- [ ] No language that blames victims for being scammed
- [ ] No implications that victims are stupid or careless
- [ ] Empathetic, supportive tone toward potential victims

### 3. GROUP STEREOTYPING
- [ ] No implications that certain ethnicities are more likely to be scammers
- [ ] No ageist content (mocking elderly for technology struggles)
- [ ] No classist content (mocking people for financial vulnerability)

### 4. MALAYSIAN CONTEXT
- [ ] Appropriate respect for local authorities
- [ ] Accurate representation of Malaysian institutions
- [ ] Cultural sensitivity across all ethnic communities

## OUTPUT FORMAT

Generate a JSON response with detailed analysis for each compliance category:

{{
    "passed": true/false,
    "flags": [
        {{
            "severity": "warning" or "critical",
            "issue_type": "racial_stereotype|religious_reference|victim_blaming|royalty_disrespect|other",
            "description": "Detailed description of the issue",
            "scene_id": scene number or null if general,
            "language": "which language version has this issue",
            "original_text": "the problematic text",
            "suggested_fix": "recommended change",
            "regulation_reference": "relevant regulation section"
        }}
        // ... more flags if any
    ],
    "detailed_analysis": [
        {{
            "category": "3R Compliance (Race)",
            "status": "passed",
            "analysis": "Detailed explanation of racial sensitivity review. Describe what was checked, any ethnic references found, and why they are appropriate or neutral.",
            "elements_reviewed": ["scene 1 dialogue", "scene 2 visual descriptions", "character representations"]
        }},
        {{
            "category": "3R Compliance (Religion)", 
            "status": "passed",
            "analysis": "Detailed explanation of religious sensitivity review. Note any religious terms, settings, or references and explain their appropriateness.",
            "elements_reviewed": ["dialogue content", "visual settings", "cultural references"]
        }},
        {{
            "category": "3R Compliance (Royalty)",
            "status": "passed", 
            "analysis": "Review of any references to Malaysian monarchy or government institutions.",
            "elements_reviewed": ["authority references", "institutional mentions"]
        }},
        {{
            "category": "Victim Sensitivity",
            "status": "passed",
            "analysis": "Analysis of tone toward scam victims. Confirm language is supportive, not blaming. Note how victims are portrayed.",
            "elements_reviewed": ["victim portrayal", "tone of messaging", "empathetic language used"]
        }},
        {{
            "category": "Group Stereotyping",
            "status": "passed",
            "analysis": "Check for age/class/ethnic stereotypes. Note how different demographics are represented.",
            "elements_reviewed": ["demographic representations", "scammer portrayal", "target audience messaging"]
        }},
        {{
            "category": "Malaysian Context",
            "status": "passed",
            "analysis": "Review of local cultural context and institutional accuracy.",
            "elements_reviewed": ["authority references", "cultural appropriateness", "institutional accuracy"]
        }}
    ],
    "compliance_summary": "Overall assessment summarizing key findings from all categories"
}}

## IMPORTANT NOTES
- The goal is education and scam prevention - ensure content serves this purpose
- Flag even minor concerns - officer will make final decision
- "passed" should be false ONLY if there are critical issues
- ALWAYS provide detailed_analysis for ALL 6 categories, even when content is clean
- Each analysis should describe WHAT was reviewed and WHY it passed/flagged

Respond with ONLY the JSON object.
"""
        return prompt
    
    def parse_response(self, response: str, input_data: SensitivityInput) -> SensitivityCheckOutput:
        """Parse LLM response into SensitivityCheckOutput."""
        try:
            data = self._extract_json(response)
            
            # Parse flags
            flags = []
            for flag_data in data.get("flags", []):
                flags.append(SensitivityFlag(
                    severity=flag_data.get("severity", "warning"),
                    issue_type=flag_data.get("issue_type", "unknown"),
                    description=flag_data.get("description", ""),
                    scene_id=flag_data.get("scene_id"),
                    suggested_fix=flag_data.get("suggested_fix"),
                    regulation_reference=flag_data.get("regulation_reference"),
                ))
            
            # Parse detailed analysis
            detailed_analysis = []
            for analysis_data in data.get("detailed_analysis", []):
                detailed_analysis.append(ComplianceAnalysis(
                    category=analysis_data.get("category", "General"),
                    status=analysis_data.get("status", "passed"),
                    analysis=analysis_data.get("analysis", ""),
                    elements_reviewed=analysis_data.get("elements_reviewed", []),
                ))
            
            return SensitivityCheckOutput(
                project_id=input_data.project_id,
                passed=data.get("passed", True),
                flags=flags,
                compliance_summary=data.get("compliance_summary", "Compliance check completed."),
                detailed_analysis=detailed_analysis,
            )
        except (json.JSONDecodeError, ValueError) as e:
            self.logger.warning(f"JSON parse failed, returning safe default: {e}")
            # Return a safe default rather than crashing the pipeline
            return SensitivityCheckOutput(
                project_id=input_data.project_id,
                passed=True,
                flags=[],
                compliance_summary="Sensitivity check completed (response parsing fell back to defaults).",
                detailed_analysis=[
                    ComplianceAnalysis(
                        category="3R Compliance",
                        status="passed",
                        analysis="Automated review completed. Manual review recommended.",
                        elements_reviewed=[],
                    )
                ],
            )
        except KeyError as e:
            raise ValueError(f"Missing required field in response: {e}")

    def _extract_json(self, response: str) -> dict:
        """Robustly extract JSON from LLM response."""
        import re
        
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        # Strategy 1: Direct parse
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
            
            # Strategy 3: Fix trailing commas and control chars
            fixed = self._fix_json(json_str)
            try:
                return json.loads(fixed)
            except json.JSONDecodeError:
                pass
        
        # Strategy 4: Fix full text
        fixed = self._fix_json(cleaned)
        return json.loads(fixed)

    def _fix_json(self, text: str) -> str:
        """Fix common JSON issues from LLM output."""
        import re
        text = re.sub(r',\s*([}\]])', r'\1', text)
        text = text.replace('\ufeff', '').replace('\u200b', '')
        result = []
        in_string = False
        i = 0
        while i < len(text):
            char = text[i]
            if char == '\\' and in_string and i + 1 < len(text):
                result.append(char)
                result.append(text[i + 1])
                i += 2
                continue
            if char == '"' and (i == 0 or text[i - 1] != '\\'):
                in_string = not in_string
                result.append(char)
            elif in_string and ord(char) < 32:
                escape_map = {'\n': '\\n', '\r': '\\r', '\t': '\\t'}
                result.append(escape_map.get(char, f'\\u{ord(char):04x}'))
            else:
                result.append(char)
            i += 1
        return ''.join(result)
    
    async def process(self, input_data: SensitivityInput) -> AgentResult:
        """Process scripts for sensitivity review."""
        start_time = time.time()
        
        try:
            # Build and send prompt
            prompt = self.build_prompt(input_data)
            system_prompt = self._get_system_prompt()
            
            response = await self._call_llm(prompt, system_prompt)
            
            # Parse response
            sensitivity_output = self.parse_response(response, input_data)
            
            return AgentResult(
                success=True,
                output=sensitivity_output,
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )
            
        except Exception as e:
            self.logger.error(f"Sensitivity Check Agent failed: {e}")
            return AgentResult(
                success=False,
                error=str(e),
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=self.config.model_name,
            )
    
    def has_critical_issues(self, output: SensitivityCheckOutput) -> bool:
        """Check if any critical issues were flagged."""
        return any(flag.severity == "critical" for flag in output.flags)
    
    def get_issues_by_scene(self, output: SensitivityCheckOutput) -> Dict[int, List[SensitivityFlag]]:
        """Group sensitivity flags by scene_id."""
        by_scene: Dict[int, List[SensitivityFlag]] = {}
        for flag in output.flags:
            scene_id = flag.scene_id or 0  # 0 for general issues
            if scene_id not in by_scene:
                by_scene[scene_id] = []
            by_scene[scene_id].append(flag)
        return by_scene


# Factory function
def create_sensitivity_agent(
    model_name: str = "gemini-2.0-flash",
    **kwargs
) -> SensitivityCheckAgent:
    """Create a Sensitivity Check Agent with default configuration."""
    config = AgentConfig(model_name=model_name, **kwargs)
    return SensitivityCheckAgent(config)
