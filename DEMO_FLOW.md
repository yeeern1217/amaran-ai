# amaran.ai — Hackathon Demo Flow

> **Mode**: `NEXT_PUBLIC_DEMO_MODE=true` in `frontend/.env.local`
>
> In demo mode, **zero API calls** are made during the scripted flow below.
> The real backend is only contacted if you deviate (e.g. type a chat message
> that doesn't match any preset trigger). This saves costs while keeping full
> AI functionality available if a judge asks for a live demo.

---

## Pre-Demo Checklist

- [ ] `frontend/.env.local` has `NEXT_PUBLIC_DEMO_MODE=true`
- [ ] Frontend running: `pnpm dev` in `frontend/`
- [ ] Backend running: `uvicorn app.api.main:app --reload --port 8000` in `backend/` (standby only — not called unless you deviate)
- [ ] Browser: Chrome/Edge, dark mode preferred
- [ ] Sign in with Google on landing page (needed for Past Projects / save)

If you want to skip login for the hackathon demo, set the backend env flag `AUTH_DISABLED=true`.
This bypasses Firebase token verification and uses `DEV_UID=dev-user` by default.
Commands (PowerShell):

```powershell
cd backend
$env:AUTH_DISABLED = "true"
$env:DEV_UID = "demo-judge"
uvicorn app.api.main:app --reload --port 8000
```

Note: This is only for local hackathon demos. Do NOT enable `AUTH_DISABLED` in production.

---

## Step-by-Step Demo Script

### 1. Landing Page

**What you see**: News feed (5 trending scam articles), Past Projects list, New Project button.

**Action**:
1. Briefly scroll through the news feed to show real-time scam intelligence
2. Click the **first news article**: _"RM4.2 Million Lost to Fake Pos Laju Delivery Scam Syndicates in Johor"_ (The Star)
3. A drawer opens with the article summary
4. Click **"Generate from This Article"** button in the drawer

> This auto-fills the news URL and navigates to The Briefing page.

---

### 2. The Briefing (Step 0) — Fact Sheet Generation

**What you see**: The news URL is pre-filled. A toggle for "Deep Research" is available.

**Action**:
1. Ensure **Deep Research** toggle is **ON** (enabled)
2. Click **"Analyze"**
3. Watch the Deep Research thought process stream in (13 research steps, ~36 seconds total):
   - _"Planning research strategy..."_
   - _"Searching Malaysian government sources — PDRM, MCMC, Bank Negara Malaysia..."_
   - _"Found 12 related news articles..."_
   - _"Cross-referencing with INTERPOL..."_
   - ... (auto-streams progressively)
4. The fact sheet appears with these sections:
   - **Scam Name**: "Pos Laju Verification Scam"
   - **Story Hook**: Victim receives a call from someone impersonating Pos Laju...
   - **Red Flag**: Caller creating urgency, asking for bank details...
   - **The Fix**: Steps to protect yourself...
   - **Reference Sources**: Verified links
   - **Global Ancestry**: Macau Scam origin tracing
   - **Psychological Exploit**: Authority compliance + fear analysis
   - **Victim Profile**: Demographics and vulnerability factors
   - **Counter-Hack**: Behavioral science-based countermeasure

**Demo Chat (optional — uses preset, NO API call)**:
> Type: `"The victim lost 20k"`
>
> This triggers a preset that updates the Story Hook to include "RM 20,000" in the narrative.

5. Check all **5 verification checkboxes** (Name, Hook, Red Flag, Fix, Sources)
6. Click **"Approve & Continue"** → moves to Configuration

---

### 3. Configuration (Step 1) — Video Settings

**What you see**: Auto-recommended settings based on the fact sheet analysis.

**AI-recommended defaults** (auto-selected based on victim profile):
- **Language**: English ✓
- **Audience**: Seniors ✓ (detected from victim profile: retirees/elderly)
- **Tone**: Dramatic ✓
- **Format**: Landscape 16:9 ✓ (default and recommended for seniors audience)
- **Duration**: 90 sec ✓

> **Note**: The default format is **Landscape 16:9** — optimal for TV broadcasts, WhatsApp video shares, and desktop viewing (the primary channels for seniors).

**Action**:
1. Point out that the AI has **auto-recommended** settings based on the scam analysis (e.g. "Seniors" audience because victim profile mentions retirees)
2. You can change options to show flexibility, but for the demo keep defaults
3. Click **"Generate Video Package"** → moves to The Studio

---

### 4. The Studio (Step 2) — Scene Breakdown & Script

**What you see**: Full scene-by-scene breakdown with master script. 11 scenes, each ~8 seconds.

**Scenes**: The Hook → The Setup → The Transfer → Building Trust → The Escalation → Authority Pressure → Fear & Compliance → The Heist → The Realisation → The Recovery → The Protection

**Action**:
1. Scroll through scenes to show the AI-generated dramatised script
2. Click a few scenes to show individual scene details (narration, visual direction, audio cues)

**Demo Chat (optional — uses preset, NO API call)**:

> Type: `"Make it more dramatic"`
>
> This triggers a preset that adds tighter close-ups and intense lighting to scene directions.

**OR**:

> Type: `"I want to avoid showing the scam technique"`
>
> This triggers a preset that restructures the ending to teach avoidance techniques (adds 2 new scenes).

3. Click **"Next: Characters"** → moves to Characters

---

### 5. Characters (Step 3) — Character Design & Refinement

**What you see**: AI-generated character silhouettes for each role (Retiree victim, Fake Pos Laju rep, Fake police officer, Fake Bank Negara rep).

**Action**:
1. Show the character cards with descriptions and reference images
2. Point out that characters are generated as vector silhouettes for privacy/safety

**Demo Chat (optional — uses preset, NO API call)**:

> Type: `"Make the police officer more detailed"`
>
> This triggers a preset that refines the officer's uniform with epaulette outlines, sharper cap, and broader stance. Character images update to `character_refs_2/` set.

3. Click **"Next: Preview"** → moves to Preview

---

### 6. Preview (Step 4) — Storyboard Preview Frames

**What you see**: Preview frames for each scene (28 clip reference images across 11 scenes).

**Action**:
1. Click through scenes to show the AI-generated storyboard frames
2. Each frame shows the visual composition before video generation

**Demo Chat (optional — uses preset, NO API call)**:

> Type: `"Add more dramatic lighting"`
>
> This triggers a preset that adds high-contrast cinematic lighting to scenes.

**OR**:

> Type: `"The style looks too childish"`
>
> This triggers a preset that removes cartoon graphics and adds realistic visuals.

3. Click **"Next: Generate Clips"** → moves to Clips Review

---

### 7. Clips Review (Step 5) — Generated Video Clips

**What you see**: Generated video clips for each scene (MP4 files). Each clip is ~8 seconds.

**Action**:
1. Play a few video clips to show the AI-generated video output
2. Click through different scenes to show variety
3. Click **"Next: Screening Room"** → moves to Screening Room

---

### 8. Screening Room (Step 6) — Final Video & Export

**What you see**: Final stitched video player, caption/audio language controls, export, and share buttons.

**Action**:
1. Play the final stitched video
2. Show the **two language controls**:

   **Subtitle Captions** (left column — instant, no regeneration):
   - Checkboxes for English, Bahasa Melayu, Mandarin, Tamil
   - Toggle any combination — captions update **instantly** in the preview overlay
   - Selected caption languages are **burned into the downloaded MP4**
   - All 4 languages are pre-translated and available immediately

   **Spoken Audio Language** (right column — requires regeneration):
   - Radio selection: English, Bahasa Melayu, Mandarin, Tamil
   - Changing this requires clicking **"Generate Video"** to regenerate clips with translated dialogue
   - In demo mode the audio clips are **not** regenerated (same English clips play); captions show the translation
   - In real backend mode, Veo regenerates all clips with translated dialogue audio

3. Show the **Download MP4** button — exports with current audio language + all selected subtitle languages
4. Show **Share Directly** buttons:
   - Clicking any share button **auto-downloads the video** + **copies caption text to clipboard** + **opens the platform**
   - **WhatsApp** → Downloads video, then opens WhatsApp Web with pre-filled text. User attaches the downloaded video.
   - **Instagram** → Downloads video, then opens Instagram Reels. User uploads the downloaded video as a new Reel.
   - **TikTok** → Downloads video, then opens TikTok upload page. User uploads the downloaded video.
   - A confirmation message appears: "Video downloaded — attach it in [Platform] to share"
5. Click **"Social Strategy"** → moves to Social

> **Caption vs Audio — How They Work Together:**
>
> | Feature | Subtitles | Audio |
> |---|---|---|
> | **What it does** | Text overlay on video | Spoken dialogue in clips |
> | **Needs regeneration?** | No — instant toggle | Yes — click "Generate Video" |
> | **Languages available** | EN, BM, ZH, TA (all pre-translated) | EN, BM, ZH, TA (requires Veo regeneration) |
> | **In downloaded MP4** | Burned in based on checked boxes | Whatever was last generated |
> | **Demo mode** | All 4 languages with translated text | Audio stays English (mock clips) |

---

### 9. Social Media Strategy (Step 7) — AI-Powered Posting Strategy

**What you see**: Platform selection (Instagram, TikTok, Facebook, X), then generate strategy.

**Action**:
1. Select **Instagram** as target platform (default)
2. Click **"Generate Social Strategy"**
3. Wait ~12 seconds for strategy generation
4. Show the 4 strategy sections:
   - **Trend Analysis**: Current trending topics, recommended posting time, engagement predictions
   - **Captions**: Multiple caption options with tone variations
   - **Thumbnail**: AI-recommended thumbnail with text overlay and visual prompt
   - **Hashtags**: Categorized hashtags (Primary, Trending, Niche, Branded) with copy-all button

**Demo Chat (optional — uses preset, NO API call)**:

> Type: `"Rewrite the caption with a stronger hook"`
>
> This triggers a preset that rewrites captions with counter-hack angle: "Real police NEVER demand money transfers over the phone."

**OR**:

> Type: `"Update the hashtags to include Macau Scam"`
>
> This triggers a preset that updates hashtags with #MacauScam and #HangUpCall999.

5. Show the **Post to** buttons at the bottom:
   - **WhatsApp** / **Instagram** / **TikTok** → Opens platform + copies caption & hashtags to clipboard

---

## Deviation Handling (If Judge Asks Something Off-Script)

**The system is designed to handle deviations gracefully:**

| Scenario | What Happens |
|---|---|
| Judge types a chat message that **matches a preset trigger** | Instant mock response, no API call |
| Judge types a chat message that **doesn't match any preset** | System lazily creates a real backend session (~15s first time), then routes to real Gemini AI for a genuine response. Changes are applied to the UI immediately. |
| Judge wants to try a **different news article or manual text** | System detects non-demo input → calls **real backend** for intake. From that point forward, **all subsequent steps** (generate video, characters, preview, social, chat) use the real AI pipeline. The entire flow becomes live. |
| Judge goes back to the **scripted demo article** after deviating | Once the real pipeline is activated, it stays active for the rest of the session. Restart `pnpm dev` to reset. |
| Backend is **down or unreachable** | All calls fall back to mock data — flow never breaks |

### How Deviation Detection Works

The system checks whether the intake input matches one of the **5 scripted mock news articles** (by URL fragment). If the input doesn't match any of them, it's treated as a deviation:

- **Demo input** (any of the 5 mock articles) → pure mock, zero API calls
- **Any other URL or manual text** → real backend, full AI pipeline from that point

Once `_usingRealPipeline` is activated, **every subsequent function** (generateVideoPackage, generateVideoAssets, generatePreviewFrames, generateSocialStrategy, captions, export, and all chat) routes to the real backend. This means the judge gets a fully functional live demo with real AI responses that build on each other.

### Chat Preset Quick Reference

| Page | Type this... | What happens |
|---|---|---|
| Briefing | `"The victim lost 20k"` | Updates story hook with RM 20,000 figure |
| Studio | `"Make it more dramatic"` | Adds dramatic camera angles and lighting |
| Studio | `"I want to avoid showing the scam"` | Restructures ending with avoidance scenes |
| Characters | `"Make the police officer more detailed"` | Refines officer uniform and silhouette |
| Preview | `"Add more dramatic lighting"` | Adds cinematic high-contrast lighting |
| Preview | `"The style looks too childish"` | Switches to realistic visual style |
| Social | `"Rewrite the caption with a stronger hook"` | Rewrites with counter-hack angle |
| Social | `"Update the hashtags"` | Adds #MacauScam and #HangUpCall999 |

### Trigger Keywords (any message containing these words will match)

- **Briefing**: `20k`
- **Studio**: `dramatic`, `avoid`
- **Characters**: `police`, `officer`, `refine`, `detail`
- **Preview**: `lighting`, `childish`
- **Social**: `caption`, `hashtag`

---

## Switching Between Demo and Live Mode

| Mode | `.env.local` setting | Behavior |
|---|---|---|
| **Demo** | `NEXT_PUBLIC_DEMO_MODE=true` | Mock data, no API costs, preset chat |
| **Live** | `NEXT_PUBLIC_DEMO_MODE=false` | Full AI pipeline, real Gemini calls |

After changing the env variable, restart the dev server (`pnpm dev`).
