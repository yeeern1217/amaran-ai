# Scam Shield (amaran.ai)

Multi-agent system for generating anti-scam awareness video content for Malaysian audiences, powered by Google Gemini.

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT                             │
│                                                               │
│   Firebase Hosting          Cloud Run                         │
│   ┌─────────────┐          ┌──────────────────┐              │
│   │  Next.js    │  ──API──▶│  FastAPI Backend  │              │
│   │  Frontend   │          │  (Python 3.11)    │              │
│   │  (Static)   │          │                   │              │
│   └─────────────┘          └──────┬───────────┘              │
│                                   │                           │
│                                   ▼                           │
│                            Google Gemini API                  │
│                            (Multi-agent pipeline)             │
└───────────────────────────────────────────────────────────────┘
```

- **Frontend** — Next.js app exported as static HTML, hosted on Firebase Hosting
- **Backend** — FastAPI server running on Cloud Run, orchestrating the Gemini-powered agent pipeline

## AI Technologies

| Technology | Usage |
|------------|-------|
| **Gemini** | Powers all six agents — research, script direction, translation, visual/audio generation, sensitivity review, and social copy |
| **Deep Research** | Autonomous multi-step web research for fact sheet generation — the Research Agent uses the Gemini Interactions API to verify scam reports against official sources (PDRM, MCMC, NSRC) |
| **Nano Banana** | Character reference image generation — produces 2×2 reference grids for each character to ensure visual consistency across scenes |
| **Veo** | Video clip generation — renders each scene as an 8-second video clip from structured visual prompts with character and clip references |

## Multi-Agent Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCAM SHIELD PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT                         AGENTS                              OUTPUT   │
│                                                                             │
│  ┌────────────┐                                                             │
│  │ ScamReport │ ──┐                                                         │
│  └────────────┘   │   ┌──────────┐   ┌───────────┐   ┌─────────────────┐   │
│                   ├──▶│ Research │──▶│ Director  │──▶│   Linguistic    │   │
│  ┌────────────┐   │   │  Agent   │   │   Agent   │   │     Agent       │   │
│  │CreatorConf │ ──┘   └──────────┘   └───────────┘   └────────┬────────┘   │
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
| 1 | **Research Agent** | Analyze scam report, generate verified fact sheet with sources |
| 2 | **Director Agent** | Script direction, scene structuring, visual storytelling |
| 3 | **Linguistic Agent** | Translation and cultural adaptation (BM, EN, ZH, TA) |
| 4 | **Visual/Audio Agent** | Video generation prompts, character reference images, clip rendering |
| 5 | **Sensitivity Check** | 3R compliance (Race, Religion, Royalty), MCMC guidelines review |
| 6 | **Social Officer** | Caption, hashtags, thumbnail, posting schedule |

## Workflow Steps

The UI guides officers through an 8-step workflow:

1. **The Briefing** — Submit scam intel, AI generates a fact sheet; officer verifies each field
2. **Configuration** — Select target audience, language(s), tone, and avatar(s)
3. **The Studio** — AI generates the video package (director → linguistic → visual/audio pipeline)
4. **Characters** — Review and refine AI-generated character reference images
5. **Preview** — Preview generated scene frames before rendering
6. **Clips Review** — Review rendered video clips per scene
7. **Screening Room** — Final video review with sensitivity check results
8. **Social** — AI-generated social media captions, hashtags, and posting recommendations

## Project Structure

```
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

## API

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for the full endpoint reference.

Key endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/intake` | POST | Submit scam info → get AI-generated fact sheet |
| `/api/v1/verify` | POST | Officer verifies fact sheet |
| `/api/v1/chat/factsheet` | POST | Chat to refine fact sheet (auto-updates) |
| `/api/v1/generate` | POST | Generate multi-language video package |
| `/api/v1/chat/video-package` | POST | Chat to refine video package (auto-updates) |
| `/api/v1/render-complete` | POST | Submit rendered video assets |
| `/api/v1/render-status/{id}` | GET | Poll render completion |
| `/api/v1/avatars` | GET | List available avatars |
| `/api/v1/config` | GET | Get format constraints |

## Local Development

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+
- A Google API key with Gemini access

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Opens at [http://localhost:3000](http://localhost:3000). Set `NEXT_PUBLIC_API_URL` to point to your backend.

### Backend

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
| `SERPER_API_KEY` | Yes | [Serper](https://serper.dev) API key (a Google Search API) — 

Start the server:

```bash
uvicorn app.api.main:app --reload --port 8000
```
