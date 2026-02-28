# amaran.ai

**AI Scam Intelligence for Multilingual Awareness Videos**

*From Threat to Broadcast in Minutes. We are not just a video generator; we are an AI-powered threat intelligence pipeline that reverse-engineers the psychology of a scam and weaponizes that data into rapid-response public defense campaigns.*

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

### 2. AI Technologies

| Technology | Usage |
|------------|-------|
| **Gemini 3.1 Pro** | The core reasoning engine powering the agent pipeline: script direction, translation, sensitivity review, and social copy. |
| **Deep Research** | Autonomous multi-step web research. The Research Agent synthesizes threat intelligence to extract facts, decode manipulation tactics, and formulate the behavioral Counter-Hack Strategy. |
| **Nano Banana** | Visual storyboarding and localized character profile generation. Produces reference grids for each character to ensure visual consistency across scenes. |
| **Veo** | High-fidelity video clip generation. Renders each storyboard scene into an automated video clip based on structured visual prompts and character references. |


### 3. Multi-Agent Pipeline

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCAM SHIELD PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT                         AGENTS                             OUTPUT    │
│                                                                             │
│  ┌────────────┐                                                             │
│  │ ScamReport │ ──┐                                                         │
│  └────────────┘   │   ┌──────────┐   ┌───────────┐   ┌─────────────────┐    │
│                   ├──▶│ Research │──▶│ Director  │──▶│   Linguistic    │    │
│  ┌────────────┐   │   │  Agent   │   │   Agent   │   │     Agent       │    │
│  │CreatorConf │ ──┘   └──────────┘   └───────────┘   └────────┬────────┘    │
│  └────────────┘                                               │             │
│                                                               ▼             │
│                                                      ┌─────────────────┐    │
│                                                      │  Visual/Audio   │    │
│                                                      │    Agent        │    │
│                                                      └────────┬────────┘    │
│                                                               │             │
│                                                               ▼             │
│                                                      ┌─────────────────┐    │
│                                                      │  Sensitivity    │    │
│                                                      │    Check        │    │
│                                                      └────────┬────────┘    │
│                                                               │             │
│                                                               ▼             │
│                                                      ┌─────────────────┐    │
│                                                      │ Social Officer  │──▶ PUBLISH
│                                                      │ (caption, tags) │    │
│                                                      └─────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Order | Agent | Responsibility |
|-------|-------|----------------|
| 1 | **Research Agent** | Conducts deep research on scams to extract facts and decode the scammers' manipulation tactics. Generates verified fact sheet with sources. |
| 2 | **Director Agent** | Turns scam incidents analysis into clear storylines with engaging scenes and characters, specialized for targeted local demographics. |
| 3 | **Linguistic Agent** | Translation and cultural adaptation (BM, EN, ZH, TA). |
| 4 | **Visual/Audio Agent** | Video generation prompts, character reference images, clip rendering, and background scoring. |
| 5 | **Sensitivity Check** | Screens content for 3R compliance (Race, Religion, Royalty) and MCMC guidelines review prior to production. |
| 6 | **Social Officer** | Packages the final video with platform-optimized strategies, hashtags, captions, and thumbnail ready for immediate viral deployment. |

## Implementation
### 1. Application Workflow

The UI guides officers through an 8-step workflow:

1. **The Briefing** — Submit scam intel (or use live Serper API fetch). The Research Agent generates a fact sheet; the officer verifies each field via the Human-in-the-Loop chat.
2. **Configuration** — Select target audience, language(s), tone, and video format.
3. **The Studio** — AI generates the video script. The Sensitivity Agent reviews for 3R compliance. Officer approves via chat.
4. **Characters** — AI recommends roles. Officer refines AI-generated character reference images (via Nano Banana).
5. **Preview** — Nano Banana generates storyboard scene frames using the verified characters. Officer refines via chat.
6. **Clips Review** — Veo renders the storyboard into high-fidelity video clips for each scene.
7. **Screening Room** — Individual clips are compiled. Full assembled video playback with multi-language subtitle/caption support.
8. **Social** — AI-generated social media captions, hashtags, and posting recommendations based on the selected platform.

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

### 3. Local Development

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


## Challenges Faced

**The Challenge:Visual Consistency & Temporal Coherence in Video Generation** Generating multiple 8-second video clips independently with Veo 3.1 resulted in visual drift. Characters suffered from inconsistent facial features, clothing, and body proportions from scene to scene, destroying the narrative coherence of the final public defense campaign.

**Investigation & Iteration:** We initially attempted to enforce consistency by injecting highly detailed, text-only character descriptions into each Veo prompt. However, text alone lacked the spatial precision needed for continuity. We then experimented with passing a single reference image per character, but Veo's standard generation mode struggled to maintain strict fidelity without more heavily structured input constraints.

**The Architectural Solution:** We abandoned text-to-video prompting in favor of a multi-stage, image-to-image chained reference pipeline:
* **Semantic Grounding:** Gemini 3 Flash extracts precise character descriptions directly from the approved script.
* **Visual Anchors:** Nano Banana 2 generates a 2×2 character reference grid for each role, mathematically locking in a canonical appearance.
* **Storyboard Bounding:** These reference grids are used as strict visual anchors to generate specific static *Start* and *End* keyframes for every scene.
* **Interpolation Rendering:** Veo 3.1 is then fed these Start and End keyframes alongside the script prompt. By operating Veo in *interpolation mode*, it effectively "fills in" the fluid motion between two visually verified boundaries.

**The Result:** This chained approach successfully forced character consistency without requiring expensive fine-tuning or custom model training. The critical engineering pivot was relying on bounding image-to-image anchors rather than open-ended text prompting to control video output.

## Future Scalability Roadmap (2026 - 2029+)

- **Q3 2026 (B2G Pilot):** Deploy NSRC beta to cut public advisory latency to 30 mins while optimizing token costs by 40%.
- **Q1 2027 (Enterprise API):** Launch a developer API for tier-one financial institutions that automatically triggers the amaran.ai video generation pipeline whenever their internal fraud desks detect a 15% spike in specific phishing payloads.
- **Q3 2027 (Predictive SAAS):** Upgrade the AI architecture to a proactive scraping engine to identify and profile emerging global scam syndicates up to 72 hours before they localize in Malaysia.
- **Q2 2028 (Autonomous Defense):** Establish amaran.ai as a de-facto regulatory standard by directly integrating with programmatic ad networks (Meta/Google Ads) for instant, zero-touch public defense deployment.
- **2029+ (ASEAN Scale):** Scale the FastAPI backend orchestration using Kubernetes and train linguistic agents on regional nuances (Singlish/Bahasa Indonesia) for 10k+ monthly generations.
