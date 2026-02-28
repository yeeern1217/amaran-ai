# Scam Shield API Documentation

**Base URL:** `http://localhost:8000`

**API Version:** `v1`

**Full Path Prefix:** `/api/v1`


## Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/intake` | POST | Submit scam info → get fact sheet |
| `/api/v1/verify` | POST | Officer verifies fact sheet |
| `/api/v1/chat/factsheet` | POST | Chat about fact sheet (auto-updates) |
| `/api/v1/chat/video-package` | POST | Chat about video package (auto-updates) |
| `/api/v1/generate` | POST | Generate video package |
| `/api/v1/render-complete` | POST | Visual Audio Agent submits rendered videos |
| `/api/v1/render-status/{project_id}` | GET | Poll for render completion status |
| `/api/v1/avatars` | GET | List available avatars |
| `/api/v1/config` | GET | Get format constraints |
| `/api/v1/debug/sessions` | GET | List active sessions (debug) |

---

## Endpoints

### 1. Health Check

Check if API is running and configured.

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "api_key_configured": true,
  "models": {
    "research": "gemini-2.5-flash",
    "director": "gemini-2.5-flash",
    "linguistic": "gemini-2.5-flash",
    "sensitivity": "gemini-2.5-flash"
  }
}
```

---

### 2. Submit Intake

Submit scam information to generate a Fact Sheet for verification.

```
POST /api/v1/intake
```

**Request Body:**
```json
{
  "source_type": "manual_description",
  "content": "A retiree in Petaling Jaya lost RM50k to a fake 'Pos Laju' call. Scammer claimed there was a parcel with illegal items...",
  "additional_context": "Victim was alone at home",
  "officer_id": "OFC-001"
}
```

**Response (200 OK):**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "fact_sheet": {
    "scam_name": "Digital Arrest Phone Scam (Macau Scam Variant)",
    "story_hook": "Scammers call pretending to be from a delivery company...",
    "red_flag": "Any call where someone impersonating a government official demands immediate payment...",
    "the_fix": "Immediately hang up. Report to NSRC hotline at 997.",
    "reference_sources": [
      "Royal Malaysia Police (PDRM) official scam advisories",
      "MCMC public warnings"
    ],
    "category": "Digital Arrest",
    "verified_by_officer": false,
    "verification_timestamp": null,
    "officer_notes": null
  },
  "message": "Fact sheet generated. Please verify before proceeding."
}
```

**Error Response (500):**
```json
{
  "detail": "Research Agent failed: ..."
}
```

---

### 3. Verify Fact Sheet

Officer verifies (and optionally corrects) the fact sheet. **Required before video generation.**

```
POST /api/v1/verify
```

**Request Body:**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "officer_id": "OFC-001",
  "notes": "Confirmed pattern matches recent cases in Klang Valley",
  "corrections": {
    "scam_name": "Pos Laju Digital Arrest Scam"
  }
}
```

**Response (200 OK):**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "fact_sheet": {
    "scam_name": "Pos Laju Digital Arrest Scam",
    "story_hook": "...",
    "red_flag": "...",
    "the_fix": "...",
    "reference_sources": [...],
    "category": "Digital Arrest",
    "verified_by_officer": true,
    "verification_timestamp": "2026-02-20T00:30:00.000Z",
    "officer_notes": "Confirmed pattern matches recent cases in Klang Valley"
  },
  "verified": true,
  "message": "Fact sheet verified. Ready for video generation."
}
```

---

### 4. Chat - Fact Sheet Review (Auto-Updates)

Chat with AI about the fact sheet. **Changes are automatically applied** when you request modifications.

```
POST /api/v1/chat/factsheet
```

**Request Body:**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "message": "Add a warning about OTPs to the red flag",
  "chat_history": []
}
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Session from `/intake` |
| `message` | string | Question or request about the fact sheet |
| `chat_history` | array | Previous messages (frontend-managed, optional) |

**Response (200 OK):**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "response": "I've updated the red flag to include a warning about OTPs.",
  "fact_sheet": {
    "scam_name": "Digital Arrest Phone Scam",
    "story_hook": "...",
    "red_flag": "ANY call demanding money transfer is a scam. Never share OTPs or PINs.",
    "the_fix": "...",
    "category": "Digital Arrest",
    "verified_by_officer": false
  },
  "updated": true,
  "changes_applied": {
    "red_flag": "ANY call demanding money transfer is a scam. Never share OTPs or PINs."
  }
}
```

**Updatable Fields:** `scam_name`, `story_hook`, `red_flag`, `the_fix`, `officer_notes`, `reference_sources`

**Chat History (Frontend-Managed):**
```json
{
  "session_id": "...",
  "message": "Can you elaborate on that?",
  "chat_history": [
    {"role": "user", "content": "Add a warning about OTPs"},
    {"role": "assistant", "content": "I've updated the red flag..."}
  ]
}
```

---

### 4b. Chat - Video Package Review (Auto-Updates)

Chat with AI about the video package/director output. **Changes are automatically applied** when you request modifications.

```
POST /api/v1/chat/video-package
```

**Request Body:**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "message": "Make scene 2 more urgent and change the text overlay to SCAM ALERT",
  "chat_history": []
}
```

**Response (200 OK):**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "response": "I've updated scene 2 to be more urgent with the new text overlay.",
  "director_output": {
    "project_id": "scam_digital_arrest_abc123",
    "master_script": "...",
    "scene_breakdown": [...],
    "creative_notes": "..."
  },
  "video_package": null,
  "updated": true,
  "changes_applied": {
    "scenes": {
      "2": {"text_overlay": "SCAM ALERT", "background_music_mood": "tense"}
    }
  }
}
```

**Updatable Fields:**
- Top-level: `master_script`, `creative_notes`
- Per-scene (1-indexed): `visual_prompt`, `audio_script`, `text_overlay`, `duration_est_seconds`, `purpose`, `transition`, `background_music_mood`

---

### 5. Generate Video Package

Generate the complete multi-language video package.

```
POST /api/v1/generate
```

**Request Body:**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "target_groups": ["Elderly", "General Public"],
  "languages": ["Bahasa Melayu (Urban)", "English"],
  "tone": "Urgent/Warning",
  "avatar_id": "officer_malay_male_01",
  "video_format": "reel",
  "director_instructions": "Focus on the phone call scenario. Make it urgent."
}
```

**Response (200 OK):**
```json
{
  "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
  "status": "completed",
  "video_package": {
    "session_id": "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
    "scam_report": {
      "title": "Digital Arrest Phone Scam",
      "category": "Digital Arrest",
      "severity": "medium",
      "description": "...",
      "story_hook": "...",
      "red_flag": "...",
      "the_fix": "..."
    },
    "creator_config": {
      "target_groups": ["Elderly", "General Public"],
      "languages": ["Bahasa Melayu (Urban)", "English"],
      "tone": "Urgent/Warning",
      "avatar": {
        "id": "officer_malay_male_01",
        "name": "Inspektor Amir",
        "rank": "Inspektor",
        "gender": "male",
        "ethnicity": "malay"
      },
      "video_format": "reel"
    },
    "video_inputs": {
      "bm": {
        "project_id": "scam_digital_arrest_ccd3d58d_bm",
        "meta_data": {
          "language": "Bahasa Melayu (Urban)",
          "target_audience": "Elderly",
          "tone": "Urgent/Warning",
          "avatar": "officer_malay_male_01",
          "video_format": "reel",
          "total_duration_seconds": 30
        },
        "scenes": [
          {
            "scene_id": 1,
            "duration_est_seconds": 6,
            "visual_prompt": "Medium shot. Avatar {officer_malay_male_01} holding smartphone with urgent expression...",
            "audio_script": "AWAS! Kalau telefon berdering dan ada suara ancam...",
            "text_overlay": "⚠️ AWAS SCAMMER!",
            "transition": "cut",
            "background_music_mood": "tense"
          },
          {
            "scene_id": 2,
            "duration_est_seconds": 8,
            "visual_prompt": "...",
            "audio_script": "...",
            "text_overlay": "...",
            "transition": "cut",
            "background_music_mood": "urgent"
          }
        ],
        "sensitivity_cleared": true
      },
      "en": {
        "project_id": "scam_digital_arrest_ccd3d58d_en",
        "meta_data": {...},
        "scenes": [...]
      }
    },
    "sensitivity_report": {
      "project_id": "scam_digital_arrest_ccd3d58d",
      "passed": true,
      "flags": [],
      "compliance_summary": "Content reviewed and cleared. No 3R issues identified."
    },
    "created_at": "2026-02-20T00:35:00.000Z"
  },
  "message": "Video package generated successfully."
}
```

---

### 6. Submit Rendered Video

Visual Audio Agent submits rendered video/audio after processing scene prompts.

```
POST /api/v1/render-complete
```

**Request Body:**
```json
{
  "project_id": "scam_digital_arrest_ccd3d58d_bm",
  "rendered_scenes": [
    {
      "scene_id": 1
      // TODO: Define rendered output format (URL, base64, GCS path, etc.)
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "project_id": "scam_digital_arrest_ccd3d58d_bm",
  "status": "received",
  "message": "Rendered video received successfully."
}
```

---

### 7. Get Render Status

Frontend polls to check if rendered videos are ready for a specific project.

```
GET /api/v1/render-status/{project_id}
```

**Response (200 OK - In Progress):**
```json
{
  "project_id": "scam_digital_arrest_ccd3d58d_bm",
  "status": "rendering",
  "progress_percent": 50
}
```

**Response (200 OK - Completed):**
```json
{
  "project_id": "scam_digital_arrest_ccd3d58d_bm",
  "status": "completed",
  "progress_percent": 100,
  "rendered_video": {
    // TODO: Define rendered output format
  }
}
```
```

---

### 8. List Avatars

Get list of available trusted avatars.

```
GET /api/v1/avatars
```

**Response (200 OK):**
```json
{
  "avatars": [
    {
      "id": "officer_malay_male_01",
      "name": "Inspektor Amir",
      "rank": "Inspektor",
      "gender": "male",
      "ethnicity": "malay"
    },
    {
      "id": "officer_malay_female_01",
      "name": "Inspektor Siti",
      "rank": "Inspektor",
      "gender": "female",
      "ethnicity": "malay"
    },
    {
      "id": "officer_chinese_male_01",
      "name": "Inspektor Wong",
      "rank": "Inspektor",
      "gender": "male",
      "ethnicity": "chinese"
    },
    {
      "id": "officer_chinese_female_01",
      "name": "Inspektor Mei Lin",
      "rank": "Inspektor",
      "gender": "female",
      "ethnicity": "chinese"
    },
    {
      "id": "officer_indian_male_01",
      "name": "Inspektor Rajan",
      "rank": "Inspektor",
      "gender": "male",
      "ethnicity": "indian"
    },
    {
      "id": "officer_indian_female_01",
      "name": "Inspektor Priya",
      "rank": "Inspektor",
      "gender": "female",
      "ethnicity": "indian"
    }
  ]
}
```

---

### 9. Get Configuration

Get video format constraints and all supported options.

```
GET /api/v1/config
```

**Response (200 OK):**
```json
{
  "formats": {
    "reel": {"max_duration": 30, "default_duration": 30},
    "story": {"max_duration": 15, "default_duration": 15},
    "post": {"max_duration": 60, "default_duration": 60}
  },
  "max_scene_duration": 8,
  "supported_languages": [
    {"code": "MALAY", "label": "Bahasa Melayu"},
    {"code": "MALAY_URBAN", "label": "Bahasa Melayu (Urban)"},
    {"code": "ENGLISH", "label": "English"},
    {"code": "CHINESE_MANDARIN", "label": "Chinese (Mandarin)"},
    {"code": "CHINESE_CANTONESE", "label": "Chinese (Cantonese)"},
    {"code": "TAMIL", "label": "Tamil"}
  ],
  "supported_tones": [
    "Urgent/Warning",
    "Calm",
    "Friendly",
    "Authoritative",
    "High Energy"
  ],
  "supported_audiences": [
    "Elderly",
    "Students",
    "Professionals",
    "Online Shoppers",
    "General Public"
  ]
}
```

---

### 10. Debug - List Sessions

List all active sessions in memory (for debugging).

```
GET /api/v1/debug/sessions
```

**Response (200 OK):**
```json
{
  "active_sessions": [
    "ccd3d58d-8dc6-499f-bb43-a6d2841d7260",
    "abc12345-1234-5678-abcd-123456789012"
  ],
  "count": 2
}
```

**Note:** Sessions are stored in-memory and are lost when the server restarts.

---

## Enums Reference

### source_type
| Value | Description |
|-------|-------------|
| `news_url` | URL to a news article |
| `police_report` | Police report text |
| `manual_description` | Manual scam description |
| `trending_newsroom` | From trending scam feed |

### category (auto-detected)
| Value |
|-------|
| `Digital Arrest` |
| `Impersonation` |
| `Phishing` |
| `Banking Fraud` |
| `Love Scam` |
| `Investment Scam` |
| `Parcel/Delivery Scam` |
| `Job Scam` |
| `E-Commerce Scam` |
| `Other` |

### video_format
| Value | Max Duration | Description |
|-------|--------------|-------------|
| `reel` | 30 seconds | Instagram/TikTok Reels |
| `story` | 15 seconds | Instagram/Facebook Stories |
| `post` | 60 seconds | Regular social posts |

---

## Typical Frontend Flow

```
1. GET /api/v1/config               → Get supported options for dropdowns
2. GET /api/v1/avatars              → Populate avatar selector
3. POST /api/v1/intake              → User submits scam report
   ↓ Returns session_id + fact_sheet
4. Display fact_sheet for officer review
5. [Optional] POST /api/v1/chat/factsheet → Review/refine fact sheet via conversation
   ↓ "Add a warning about OTPs to the red flag"
   ↓ Returns updated fact_sheet (auto-applied, repeat as needed)
6. POST /api/v1/verify              → Officer confirms fact sheet
   ↓ Returns verified fact_sheet
7. Display Creator Studio (select languages, tone, avatar, format)
8. POST /api/v1/generate            → Generate video package
   ↓ Returns video_package with scenes for each language
9. [Optional] POST /api/v1/chat/video-package → Review/refine scenes via conversation
   ↓ "Make scene 2 more urgent"
   ↓ Returns updated director_output (auto-applied, repeat as needed)
10. Visual Audio Agent processes scenes asynchronously
    ↓ POST /api/v1/render-complete (per project_id)
11. Frontend polls GET /api/v1/render-status/{project_id}
    ↓ Returns rendered video when complete
12. Display Final Preview with rendered videos
```

**Chat refinement loops:**
```
# Fact sheet review (step 5, before verify)
Officer: "Add warning about OTPs to the red flag"
  ↓ POST /api/v1/chat/factsheet {message: "...", chat_history: []}
Agent: "I've updated the red flag..." (auto-applied)
  ↓ Returns {updated: true, changes_applied: {...}, fact_sheet: {...}}

# Video package review (step 9, after generate)
Officer: "Make scene 2 more urgent and change text to SCAM ALERT"
  ↓ POST /api/v1/chat/video-package {message: "...", chat_history: []}
Agent: "I've updated scene 2..." (auto-applied)
  ↓ Returns {updated: true, changes_applied: {scenes: {...}}, director_output: {...}}
```

---

## Scene Structure (for Video Generation)

Each scene in `video_package.video_inputs.{lang}.scenes`:

```json
{
  "scene_id": 1,
  "duration_est_seconds": 6,
  "visual_prompt": "Description for Veo 3 video generation. Use {avatar_id} for avatar placement.",
  "audio_script": "Voiceover text for Lyria audio generation",
  "text_overlay": "TEXT SHOWN ON SCREEN",
  "transition": "cut|fade|swipe",
  "background_music_mood": "tense|urgent|calm|hopeful|dramatic"
}
```

**Constraints:**
- Each scene: **max 8 seconds** (Veo 3 limit)
- Reel total: **30 seconds** (~4 scenes)
- Story total: **15 seconds** (~2 scenes)
- Post total: **60 seconds** (~8 scenes)

---

## CORS

Allowed origins (development):
- `http://localhost:3000` (Next.js)

---

## Running the API

```bash
cd backend
pip install fastapi uvicorn
uvicorn app.api.main:app --reload --port 8000
```

- **Swagger Docs:** http://localhost:8000/docs
- **OpenAPI JSON:** http://localhost:8000/openapi.json