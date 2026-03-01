# amaran.ai

**AI Scam Intelligence for Multilingual Awareness Videos**

*From Threat to Broadcast in Minutes. We are not just a video generator; we are an AI-powered threat intelligence pipeline that reverse-engineers the psychology of a scam and weaponizes that data into rapid-response public defense campaigns.*

Link to Presentation Slide: https://drive.google.com/file/d/1EvbhQh4IoSBSC0con3r7kx2q1MLkhslZ/view?usp=sharing 

## The Problem

Scam cases in Malaysia are increasing rapidly. In 2025, Malaysians lost RM542 million to scams, but only RM34 million was recovered, putting seniors, retirees, and students at high risk. The core issues driving this crisis include:

- **Rapidly Evolving Scams:** Scammers constantly change tactics, transitioning from fake delivery calls to sophisticated AI voice cloning, making threat vectors highly unpredictable.
- **Information Doesn't Reach People:** Official warnings are typically long, text-heavy, and slow to circulate. This distribution bottleneck leaves many victims completely unaware of emerging threats until it is too late.
- **Victims Suffer Too Late:** By the time awareness spreads through traditional channels, thousands may already be targeted. This delayed communication directly leads to preventable financial and emotional harm.

## The Solution

amaran.ai is a multi-agent orchestration platform designed for law enforcement and financial institutions. It replaces slow manual production by ingesting breaking scam reports, extracting the underlying psychological exploit, and automatically rendering a multi-lingual, visual "circuit-breaker" video designed to disrupt the victim's cognitive trance.

## Core Pipeline Features

- **Deep Threat Intelligence** — Gemini Deep Research autonomously maps the scam's global ancestry, victim demographic, and psychological trigger to formulate a precise behavioral Counter-Hack Strategy.
- **Multi-Agent Video Production Orchestration** — A sequential pipeline of 6 specialized AI agents handling the entire pre-to-post video production workflow.
- **Human-in-the-Loop (HITL)** — Built-in chat interfaces at every pipeline stage allow human officers to review, refine, and override AI outputs, ensuring no video is ever published with AI hallucinations or factual errors.
- **Automated Compliance** — A specialized Sensitivity Agent enforces strict MCMC guidelines and screens content for 3R (Race, Religion, Royalty) compliance prior to production.
- **Hyper-Localization** — The Linguistic Agent ensures no demographic is left behind by instantly generating localized subtitles and voice dubs in Bahasa Melayu, English, Mandarin, and Tamil.


## SDG Alignment

- **SDG 16 (Peace, Justice and Strong Institutions - Target 16.4)** — Equipping relevant national institutions (PDRM, NSRC) with the rapid-response AI infrastructure needed to prevent violence, combat crime, and preemptively intercept illicit financial flows.
- **SDG 10 (Reduced Inequalities - Target 10.2)** — Closing the digital awareness gap by empowering and promoting the social inclusion of all. amaran.ai ensures every Malaysian is informed regardless of language by autonomously deploying visual safety countermeasures in localized dialects.


### Local Development

#### Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+
- A Google API key with Gemini access

#### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Opens at http://localhost:3000. Set `NEXT_PUBLIC_API_URL` to point to your backend.

#### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
GOOGLE_API_KEY=your_google_api_key_here
SERPER_API_KEY=your_serper_api_key_here
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Google API key with Gemini access |
| `SERPER_API_KEY` | Yes | Serper API key (a Google Search API) |

Start the server:

```bash
uvicorn app.api.main:app --reload --port 8000
```


## Technical Architecture

Our architecture is designed to orchestrate complex, multi-modal generative tasks while maintaining a lightweight, serverless infrastructure.

### 1. High-Level System Design
The application follows a decoupled client-server architecture, utilizing Google Cloud serverless components to handle long-running AI generation tasks.

```text
┌───────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT                             │
│                                                               │
│   Firebase Hosting           Cloud Run                        │
│   ┌─────────────┐          ┌──────────────────┐               │
│   │  Next.js    │  ──API──▶│  FastAPI Backend │               │
│   │  Frontend   │          │  (Python 3.11)   │               │
│   │  (Static)   │          │                  │               │
│   └─────────────┘          └──────┬───────────┘               │
│                                   │                           │
│                                   ▼                           │
│                            Google Gemini API                  │
│                            (Multi-agent pipeline)             │
└───────────────────────────────────────────────────────────────┘
```

- **Frontend** — Next.js app exported as static HTML, hosted on Firebase Hosting
- **Backend** — FastAPI server running on Cloud Run, orchestrating the Gemini-powered agent pipeline

### 2. Project Structure

```text
scam-shield/
├── firebase.json              # Firebase Hosting config
├── frontend/                  # Next.js (static export → Firebase Hosting)
│   ├── app/                   # Next.js app router
│   ├── components/            # Page components + shadcn/ui
│   ├── hooks/                 # Custom React hooks
│   └── lib/
│       ├── app-context.tsx    # Global state management
│       ├── api/               # API client (backend communication)
│       └── utils.ts
│
└── backend/                   # FastAPI (Docker → Cloud Run)
    ├── Dockerfile             # Cloud Run container config
    ├── requirements.txt
    └── app/
        ├── config.py          # Settings & environment
        ├── pipeline.py        # Pipeline orchestrator
        ├── agents/            # Gemini-powered agents
        │   ├── research_agent.py
        │   ├── director_agent.py
        │   ├── linguistic_agent.py
        │   ├── visual_audio_agent.py
        │   ├── sensitivity_agent.py
        │   └── social_agent.py
        ├── api/
        │   ├── main.py        # FastAPI application
        │   └── routes.py      # REST endpoints
        └── models/
            └── schemas.py     # Pydantic models & types
```

### 3. AI Technologies

| Technology | Usage |
|------------|-------|
| **Gemini 3.1 Pro** | The core reasoning engine powering the agent pipeline: script direction, translation, sensitivity review, and social copy. |
| **Deep Research** | Autonomous multi-step web research. The Research Agent synthesizes threat intelligence to extract facts, decode manipulation tactics, and formulate the behavioral Counter-Hack Strategy. |
| **Nano Banana** | Visual storyboarding and localized character profile generation. Produces reference grids for each character to ensure visual consistency across scenes. |
| **Veo** | High-fidelity video clip generation. Renders each storyboard scene into an automated video clip based on structured visual prompts and character references. |



## Implementation Details

This section condenses the visual flow shown in the implementation diagram (Gemini/Gemini Flash, Nano Banana 2, Veo 3.1 Fast) into a concise, non-redundant mapping of pipeline steps and design decisions.


- **Inputs:** Scam reports (text, news, social alerts) → fed into Deep Research to extract ancestry, victim demographics, and the psychological exploit.
- **AI Scriptwriter / Director (Gemini 3.1 Pro):** Writes scene-level scripts, camera motion hints, SFX cues, and produces structured scene prompts for downstream agents.
- **Character Prompt Generation (Gemini 3 Flash):** Produces detailed character prompts from the script used to seed image generation.
- **Character Image Generation (Nano Banana 2):** Generates canonical 2×2 character reference grids that establish a consistent visual identity for each role.
- **Start & End Frame Generation:** Create anchored keyframes from the character references to serve as concrete visual boundaries for each scene.
- **AI Video Generation (Veo 3.1 Fast):** Consumes start/end frames + scene script and runs in interpolation mode to render 8s clips per scene; clips are merged to produce the final video.
- **Post-processing & Localization (Gemini 3 Flash):** Translates dialogue, regenerates voiceovers if needed, generates subtitles (SRT), and creates platform-optimized social captions.
- **Sensitivity Check:** A dedicated agent reviews scripts and final outputs for 3R and regulatory compliance before human approval and publication.

Design notes:
- Frame-to-frame anchoring (start/end keyframes) is the primary mechanism used to prevent visual identity drift across independently generated clips.
- Canonical reference grids (Nano Banana) + cached assets improve determinism, reduce cost, and speed up iteration.
- The pipeline favors chained, idempotent steps with human-in-the-loop checkpoints at script, character, and final screening stages.


## Challenges Faced

### 1. Visual Consistency Across Independent Clips

**Challenge:** Separately generated 8-second scenes caused visual drift and inconsistent quality.

**Solution:** We enforced frame-to-frame anchoring using fixed start and end keyframes to ensure coherent, high-quality transitions.

### 2. Character Identity Drift

**Challenge:** Text prompts alone could not reliably preserve character appearance across scenes.

**Solution:** We introduced canonical visual references to lock in consistent character identity before rendering

### 3. Grounded Research vs Hallucination Risk

**Challenge:**  Open-ended LLM generation risked factual inaccuracies in public awareness content.

**Solution:** We implemented a structured Deep Research grounding layer before script generation to ensure contextual accuracy and reliability.


## Future Scalability Roadmap (2026 - 2029+)

- **Q3 2026 (B2G Pilot):** Deploy NSRC beta to cut public advisory latency to 30 mins while optimizing token costs by 40%.
- **Q1 2027 (Enterprise API):** Launch a developer API for tier-one financial institutions that automatically triggers the amaran.ai video generation pipeline whenever their internal fraud desks detect a 15% spike in specific phishing payloads.
- **Q3 2027 (Predictive SAAS):** Upgrade the AI architecture to a proactive scraping engine to identify and profile emerging global scam syndicates up to 72 hours before they localize in Malaysia.
- **Q2 2028 (Autonomous Defense):** Establish amaran.ai as a de-facto regulatory standard by directly integrating with programmatic ad networks (Meta/Google Ads) for instant, zero-touch public defense deployment.
- **2029+ (ASEAN Scale):** Scale the FastAPI backend orchestration using Kubernetes and train linguistic agents on regional nuances (Singlish/Bahasa Indonesia) for 10k+ monthly generations.
