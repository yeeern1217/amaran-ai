# amaran.ai — API Documentation

**Base URL:** `https://api.amaran.ai/v1`

**Authentication:** All endpoints require a Bearer token in the `Authorization` header.

```
Authorization: Bearer <access_token>
```

---

## Table of Contents

1. [Projects](#1-projects)
2. [News Analysis & Fact-Check](#2-news-analysis--fact-check)
3. [Configuration](#3-configuration)
4. [Scenes](#4-scenes)
5. [Video Generation](#5-video-generation)
6. [AI Chat (Scene Director)](#6-ai-chat-scene-director)
7. [Safety Review](#7-safety-review)
8. [Export & Share](#8-export--share)
9. [Data Models](#9-data-models)
10. [Enumerations](#10-enumerations)
11. [Error Handling](#11-error-handling)
12. [Webhooks](#12-webhooks)

---

## 1. Projects

A **project** represents a single end-to-end video creation session — from news input through to final export.

### `POST /projects`

Create a new project.

**Request Body:**

```json
{
  "name": "string (optional)"
}
```

**Response:** `201 Created`

```json
{
  "id": "proj_abc123",
  "name": "Untitled Project",
  "status": "draft",
  "currentStep": 0,
  "createdAt": "2026-02-20T10:00:00Z",
  "updatedAt": "2026-02-20T10:00:00Z"
}
```

---

### `GET /projects/:projectId`

Retrieve full project state including fact-check, config, scenes, and safety status.

**Response:** `200 OK`

```json
{
  "id": "proj_abc123",
  "name": "APK Scam Awareness Video",
  "status": "draft | generating | safety_review | completed",
  "currentStep": 0,
  "factCheck": { ... },
  "config": { ... },
  "scenes": [ ... ],
  "safetyReview": { ... },
  "createdAt": "2026-02-20T10:00:00Z",
  "updatedAt": "2026-02-20T10:30:00Z"
}
```

---

### `PATCH /projects/:projectId`

Update project metadata (e.g. name, current step).

**Request Body:**

```json
{
  "name": "string (optional)",
  "currentStep": "number (optional, 0-4)"
}
```

**Response:** `200 OK` — Returns the updated project object.

---

### `DELETE /projects/:projectId`

Delete a project and all associated resources.

**Response:** `204 No Content`

---

## 2. News Analysis & Fact-Check

### `POST /projects/:projectId/analyze`

Submit news content (text, URL, or file) for AI analysis. Returns extracted fact-check results and auto-generated scene scripts.

**Request Body (JSON — text or URL):**

```json
{
  "type": "text | url",
  "content": "string"
}
```

**Request Body (multipart/form-data — file upload):**

| Field  | Type   | Description                          |
| ------ | ------ | ------------------------------------ |
| `file` | File   | Document file (.pdf, .docx, .txt)    |
| `type` | String | Must be `"file"`                     |

**Response:** `200 OK`

```json
{
  "factCheck": {
    "scamName": "Fake APK Wedding Invitation",
    "story": "Victim receives a WhatsApp message from an unknown +60 number with a malicious .apk file disguised as a digital wedding invitation...",
    "redFlag": "Message from an unrecognized +60 number not in contacts. The attachment ends in .apk instead of .jpg, .png, or .pdf...",
    "fix": "Do NOT download or install any .apk files received via messaging apps from unknown contacts...",
    "referenceLink": "https://www.mcmc.gov.my/en/resources/scam-alerts/apk-scam",
    "scamNameVerified": false,
    "storyVerified": false,
    "redFlagVerified": false,
    "fixVerified": false,
    "referenceLinkVerified": false
  },
  "scenes": [
    {
      "id": 1,
      "description": "A dimly lit bedroom in a modest Malaysian apartment — the only light source is the pale blue glow of a smartphone screen...",
      "dialogue": "[Text on screen]: 'Tahniah! Anda dijemput ke majlis perkahwinan kami...'",
      "generated": false
    }
  ]
}
```

> **Note:** This is a long-running operation. See [Webhooks](#12-webhooks) for async completion notification. Alternatively, poll `GET /projects/:projectId` until `factCheck` is populated.

---

### `PUT /projects/:projectId/fact-check`

Update the fact-check results (user edits) and per-field verification status.

**Request Body:**

```json
{
  "scamName": "Fake APK Wedding Invitation",
  "story": "Updated story text...",
  "redFlag": "Updated red flag text...",
  "fix": "Updated fix text...",
  "referenceLink": "https://www.mcmc.gov.my/en/resources/scam-alerts/apk-scam",
  "scamNameVerified": true,
  "storyVerified": true,
  "redFlagVerified": false,
  "fixVerified": true,
  "referenceLinkVerified": false
}
```

**Response:** `200 OK` — Returns the updated `FactCheck` object.

---

### `GET /projects/:projectId/fact-check`

Retrieve current fact-check results and verification status.

**Response:** `200 OK` — Returns the `FactCheck` object.

---

## 3. Configuration

### `PUT /projects/:projectId/config`

Save or update the video configuration (avatar, language, audience, tone, format, length).

**Request Body:**

```json
{
  "avatar": "officer-amir",
  "language": "english",
  "targetAudience": "general",
  "tone": "urgent",
  "videoFormat": "reels",
  "videoLength": "60s"
}
```

**Response:** `200 OK` — Returns the updated `ConfigData` object.

---

### `GET /projects/:projectId/config`

Retrieve current video configuration.

**Response:** `200 OK`

```json
{
  "avatar": "officer-amir",
  "language": "english",
  "targetAudience": "general",
  "tone": "urgent",
  "videoFormat": "reels",
  "videoLength": "60s"
}
```

---

### `GET /config/avatars`

List all available avatar options.

**Response:** `200 OK`

```json
[
  { "id": "officer-amir", "label": "Officer Amir", "description": "Authoritative law enforcement", "thumbnailUrl": "https://..." },
  { "id": "elderly-uncle", "label": "Elderly Uncle", "description": "Relatable senior figure", "thumbnailUrl": "https://..." },
  { "id": "shady-hacker", "label": "Shady Hacker", "description": "Antagonist villain", "thumbnailUrl": "https://..." },
  { "id": "news-anchor", "label": "News Anchor", "description": "Professional reporter", "thumbnailUrl": "https://..." },
  { "id": "young-student", "label": "Young Student", "description": "Youth perspective", "thumbnailUrl": "https://..." },
  { "id": "tech-expert", "label": "Tech Expert", "description": "Cybersecurity specialist", "thumbnailUrl": "https://..." }
]
```

---

### `GET /config/options`

List all available configuration options (languages, audiences, tones, formats, video lengths).

**Response:** `200 OK`

```json
{
  "languages": [
    { "id": "english", "label": "English" },
    { "id": "malay", "label": "Bahasa Melayu" },
    { "id": "mandarin", "label": "Mandarin" },
    { "id": "tamil", "label": "Tamil" }
  ],
  "audiences": [
    { "id": "seniors", "label": "Seniors" },
    { "id": "young-adults", "label": "Young Adults" },
    { "id": "general", "label": "General Public" },
    { "id": "parents", "label": "Parents" }
  ],
  "tones": [
    { "id": "urgent", "label": "Urgent Warning" },
    { "id": "educational", "label": "Educational" },
    { "id": "dramatic", "label": "Dramatic" },
    { "id": "casual", "label": "Casual & Friendly" }
  ],
  "formats": [
    { "id": "reels", "label": "Story / Reels", "aspectRatio": "9:16" },
    { "id": "post", "label": "Square Post", "aspectRatio": "1:1" },
    { "id": "landscape", "label": "Landscape", "aspectRatio": "16:9" }
  ],
  "videoLengths": [
    { "id": "15s", "label": "15 sec", "description": "Quick Story" },
    { "id": "30s", "label": "30 sec", "description": "Short Form" },
    { "id": "60s", "label": "60 sec", "description": "Standard" },
    { "id": "90s", "label": "90 sec", "description": "Extended" },
    { "id": "3min", "label": "3 min", "description": "Long Form" }
  ]
}
```

---

## 4. Scenes

### `GET /projects/:projectId/scenes`

List all scenes in the project.

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "description": "A dimly lit bedroom in a modest Malaysian apartment...",
    "dialogue": "[Text on screen]: 'Tahniah! Anda dijemput ke majlis perkahwinan kami...'",
    "generated": false,
    "videoUrl": null,
    "thumbnailUrl": null,
    "durationMs": null
  }
]
```

---

### `GET /projects/:projectId/scenes/:sceneId`

Get a single scene by ID.

**Response:** `200 OK` — Returns a single `Scene` object.

---

### `PUT /projects/:projectId/scenes/:sceneId`

Update a scene's description and/or dialogue.

**Request Body:**

```json
{
  "description": "Updated scene description...",
  "dialogue": "Updated dialogue..."
}
```

**Response:** `200 OK` — Returns the updated `Scene` object.

---

### `POST /projects/:projectId/scenes`

Add a new scene to the project.

**Request Body:**

```json
{
  "description": "New scene description...",
  "dialogue": "[VO]: New dialogue...",
  "insertAfter": 3
}
```

| Field         | Type   | Description                                         |
| ------------- | ------ | --------------------------------------------------- |
| `description` | String | Visual scene description                            |
| `dialogue`    | String | Dialogue, voiceover, SFX, text overlays             |
| `insertAfter` | Number | (Optional) Scene ID after which to insert. Defaults to appending at end. |

**Response:** `201 Created` — Returns the new `Scene` object.

---

### `DELETE /projects/:projectId/scenes/:sceneId`

Remove a scene from the project.

**Response:** `204 No Content`

---

### `POST /projects/:projectId/scenes/reorder`

Reorder scenes within the project.

**Request Body:**

```json
{
  "order": [3, 1, 2, 4, 5, 6, 7]
}
```

**Response:** `200 OK` — Returns the updated scene list.

---

## 5. Video Generation

### `POST /projects/:projectId/scenes/:sceneId/generate`

Trigger video generation for a single scene. This is an async operation.

**Request Body:** _(empty — uses current scene description, dialogue, and project config)_

**Response:** `202 Accepted`

```json
{
  "jobId": "job_xyz789",
  "sceneId": 1,
  "status": "queued",
  "estimatedDurationMs": 30000
}
```

---

### `GET /projects/:projectId/scenes/:sceneId/generate/status`

Poll generation status for a scene.

**Response:** `200 OK`

```json
{
  "jobId": "job_xyz789",
  "sceneId": 1,
  "status": "queued | processing | completed | failed",
  "progress": 65,
  "videoUrl": "https://cdn.amaran.ai/videos/proj_abc123/scene_1.mp4",
  "thumbnailUrl": "https://cdn.amaran.ai/thumbnails/proj_abc123/scene_1.jpg",
  "durationMs": 8500,
  "error": null
}
```

---

### `POST /projects/:projectId/compile`

Compile all generated scenes into a single full video. Requires all scenes to have `generated: true`.

**Request Body:** _(empty)_

**Response:** `202 Accepted`

```json
{
  "jobId": "job_compile_001",
  "status": "queued",
  "estimatedDurationMs": 60000
}
```

---

### `GET /projects/:projectId/compile/status`

Poll compilation status.

**Response:** `200 OK`

```json
{
  "jobId": "job_compile_001",
  "status": "queued | processing | completed | failed",
  "progress": 80,
  "videoUrl": "https://cdn.amaran.ai/videos/proj_abc123/full_video.mp4",
  "durationMs": 61000,
  "error": null
}
```

---

## 6. AI Chat (Scene Director)

### `POST /projects/:projectId/chat/scene`

Send a message to the AI Director for **per-scene** adjustments. The AI may return updated scene data.

**Request Body:**

```json
{
  "sceneId": 1,
  "message": "Make the room darker and add a more ominous soundtrack."
}
```

**Response:** `200 OK`

```json
{
  "reply": "Updated Scene 1 based on your feedback. The mood has been adjusted to be more intense with darker lighting and an ominous ambient score.",
  "updatedScene": {
    "id": 1,
    "description": "Updated scene description with darker lighting...",
    "dialogue": "Updated dialogue...",
    "generated": false
  }
}
```

> **Note:** If the scene was previously generated, `generated` resets to `false` — the scene needs to be re-generated to reflect changes.

---

### `GET /projects/:projectId/chat/history`

Retrieve chat history for a project.

**Query Parameters:**

| Param    | Type   | Description                                    |
| -------- | ------ | ---------------------------------------------- |
| `sceneId` | Number | (Optional) Filter scene chat by scene ID      |

**Response:** `200 OK`

```json
{
  "messages": [
    {
      "id": "msg_001",
      "sceneId": 1,
      "role": "user",
      "text": "Make the room darker.",
      "createdAt": "2026-02-20T10:15:00Z"
    },
    {
      "id": "msg_002",
      "sceneId": 1,
      "role": "ai",
      "text": "Updated Scene 1 based on your feedback...",
      "createdAt": "2026-02-20T10:15:02Z"
    }
  ]
}
```

---

## 7. Safety Review

### `POST /projects/:projectId/safety-review`

Trigger an automated safety review of the compiled video. This runs a series of checks sequentially.

**Request Body:** _(empty)_

**Response:** `202 Accepted`

```json
{
  "reviewId": "review_001",
  "status": "running",
  "checks": [
    { "id": "content-accuracy", "label": "Content accuracy verified", "status": "pending" },
    { "id": "harmful-claims", "label": "No harmful or misleading claims", "status": "pending" },
    { "id": "age-appropriate", "label": "Age-appropriate content confirmed", "status": "pending" },
    { "id": "copyright", "label": "No copyrighted material detected", "status": "pending" },
    { "id": "fact-check", "label": "Fact-check alignment confirmed", "status": "pending" },
    { "id": "community", "label": "Community guidelines compliance", "status": "pending" }
  ]
}
```

---

### `GET /projects/:projectId/safety-review`

Get the current safety review status and results.

**Response:** `200 OK`

```json
{
  "reviewId": "review_001",
  "status": "running | completed | failed",
  "checks": [
    { "id": "content-accuracy", "label": "Content accuracy verified", "status": "passed", "completedAt": "2026-02-20T10:30:01Z" },
    { "id": "harmful-claims", "label": "No harmful or misleading claims", "status": "passed", "completedAt": "2026-02-20T10:30:02Z" },
    { "id": "age-appropriate", "label": "Age-appropriate content confirmed", "status": "passed", "completedAt": "2026-02-20T10:30:03Z" },
    { "id": "copyright", "label": "No copyrighted material detected", "status": "running", "completedAt": null },
    { "id": "fact-check", "label": "Fact-check alignment confirmed", "status": "pending", "completedAt": null },
    { "id": "community", "label": "Community guidelines compliance", "status": "pending", "completedAt": null }
  ],
  "warnings": [
    {
      "type": "fact-check-incomplete",
      "message": "Not all fact-check items were verified in The Briefing. Consider completing verification."
    }
  ],
  "overallResult": "pending | passed | failed"
}
```

---

## 8. Export & Share

### `GET /projects/:projectId/export`

Get the download URL for the final compiled video.

**Query Parameters:**

| Param    | Type   | Description                                      |
| -------- | ------ | ------------------------------------------------ |
| `format` | String | `"mp4"` (default). Future: `"webm"`, `"mov"`    |

**Response:** `200 OK`

```json
{
  "downloadUrl": "https://cdn.amaran.ai/exports/proj_abc123/final_video.mp4",
  "fileName": "amaran_Fake_APK_Wedding_Invitation_9x16.mp4",
  "fileSizeMb": 24.5,
  "format": "mp4",
  "aspectRatio": "9:16",
  "durationMs": 61000,
  "expiresAt": "2026-02-21T10:00:00Z"
}
```

---

### `POST /projects/:projectId/share`

Generate a share link or directly share to a social platform.

**Request Body:**

```json
{
  "platform": "whatsapp | instagram | tiktok | link",
  "caption": "Jangan jadi mangsa penipuan! #JanganKenaTipu (optional)"
}
```

**Response:** `200 OK`

```json
{
  "platform": "whatsapp",
  "shareUrl": "https://wa.me/?text=...",
  "shortLink": "https://amaran.ai/v/abc123"
}
```

---

## 9. Data Models

### FactCheck

| Field                   | Type    | Description                                            |
| ----------------------- | ------- | ------------------------------------------------------ |
| `scamName`              | String  | Name/title of the identified scam                      |
| `story`                 | String  | Detailed narrative of how the scam works                |
| `redFlag`               | String  | Warning signs to identify the scam                     |
| `fix`                   | String  | Recommended actions and remediation steps               |
| `referenceLink`         | String  | URL to official source or report                       |
| `scamNameVerified`      | Boolean | User verification status for scam name                 |
| `storyVerified`         | Boolean | User verification status for story                     |
| `redFlagVerified`       | Boolean | User verification status for red flags                 |
| `fixVerified`           | Boolean | User verification status for fix                       |
| `referenceLinkVerified` | Boolean | User verification status for reference link            |

### ConfigData

| Field            | Type   | Description                                                      |
| ---------------- | ------ | ---------------------------------------------------------------- |
| `avatar`         | String | Selected avatar ID (see [Enumerations](#10-enumerations))        |
| `language`       | String | Video language (`english`, `malay`, `mandarin`, `tamil`)         |
| `targetAudience` | String | Target audience (`seniors`, `young-adults`, `general`, `parents`)|
| `tone`           | String | Video tone (`urgent`, `educational`, `dramatic`, `casual`)       |
| `videoFormat`    | String | Aspect ratio format (`reels`, `post`, `landscape`)               |
| `videoLength`    | String | Target duration (`15s`, `30s`, `60s`, `90s`, `3min`)             |

### Scene

| Field          | Type    | Description                                      |
| -------------- | ------- | ------------------------------------------------ |
| `id`           | Number  | Sequential scene identifier (1-based)            |
| `description`  | String  | Cinematic scene description (visual direction)   |
| `dialogue`     | String  | Dialogue, voiceover, SFX, and text overlays      |
| `generated`    | Boolean | Whether the video clip has been generated         |
| `videoUrl`     | String? | URL to generated video clip (null if not generated) |
| `thumbnailUrl` | String? | URL to scene thumbnail (null if not generated)   |
| `durationMs`   | Number? | Duration of generated clip in milliseconds       |

### SafetyCheck

| Field         | Type   | Description                                                  |
| ------------- | ------ | ------------------------------------------------------------ |
| `id`          | String | Unique check identifier                                      |
| `label`       | String | Human-readable check description                             |
| `status`      | String | `"pending"`, `"running"`, `"passed"`, or `"failed"`          |
| `completedAt` | String? | ISO 8601 timestamp when check completed (null if pending)   |

### ChatMessage

| Field       | Type    | Description                                      |
| ----------- | ------- | ------------------------------------------------ |
| `id`        | String  | Unique message identifier                        |
| `sceneId`   | Number  | Scene ID the message relates to                  |
| `role`      | String  | `"user"` or `"ai"`                               |
| `text`      | String  | Message content                                  |
| `createdAt` | String  | ISO 8601 timestamp                               |

---

## 10. Enumerations

### Avatar IDs

| ID               | Label          | Description                     |
| ---------------- | -------------- | ------------------------------- |
| `officer-amir`   | Officer Amir   | Authoritative law enforcement   |
| `elderly-uncle`  | Elderly Uncle  | Relatable senior figure         |
| `shady-hacker`   | Shady Hacker   | Antagonist villain              |
| `news-anchor`    | News Anchor    | Professional reporter           |
| `young-student`  | Young Student  | Youth perspective               |
| `tech-expert`    | Tech Expert    | Cybersecurity specialist        |

### Languages

| ID         | Label          |
| ---------- | -------------- |
| `english`  | English        |
| `malay`    | Bahasa Melayu  |
| `mandarin` | Mandarin       |
| `tamil`    | Tamil          |

### Target Audiences

| ID             | Label          |
| -------------- | -------------- |
| `seniors`      | Seniors        |
| `young-adults` | Young Adults   |
| `general`      | General Public |
| `parents`      | Parents        |

### Tones

| ID            | Label             |
| ------------- | ----------------- |
| `urgent`      | Urgent Warning    |
| `educational` | Educational       |
| `dramatic`    | Dramatic          |
| `casual`      | Casual & Friendly |

### Video Formats

| ID          | Label          | Aspect Ratio |
| ----------- | -------------- | ------------ |
| `reels`     | Story / Reels  | 9:16         |
| `post`      | Square Post    | 1:1          |
| `landscape` | Landscape      | 16:9         |

### Video Lengths

| ID    | Label  | Description |
| ----- | ------ | ----------- |
| `15s` | 15 sec | Quick Story |
| `30s` | 30 sec | Short Form  |
| `60s` | 60 sec | Standard    |
| `90s` | 90 sec | Extended    |
| `3min`| 3 min  | Long Form   |

### Safety Check IDs

| ID                 | Description                          |
| ------------------ | ------------------------------------ |
| `content-accuracy` | Content accuracy verified            |
| `harmful-claims`   | No harmful or misleading claims      |
| `age-appropriate`  | Age-appropriate content confirmed    |
| `copyright`        | No copyrighted material detected     |
| `fact-check`       | Fact-check alignment confirmed       |
| `community`        | Community guidelines compliance      |

---

## 11. Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error description.",
    "details": {
      "field": "description of the issue"
    }
  }
}
```

### HTTP Status Codes

| Code  | Meaning                                                    |
| ----- | ---------------------------------------------------------- |
| `200` | Success                                                    |
| `201` | Resource created                                           |
| `202` | Accepted (async job started)                               |
| `204` | No content (successful deletion)                           |
| `400` | Bad request — validation error or missing required fields  |
| `401` | Unauthorized — invalid or missing access token             |
| `403` | Forbidden — insufficient permissions                       |
| `404` | Not found — resource does not exist                        |
| `409` | Conflict — e.g. generating a scene that is already generating |
| `422` | Unprocessable — e.g. compiling when not all scenes are generated |
| `429` | Rate limit exceeded                                        |
| `500` | Internal server error                                      |

### Error Codes

| Code                         | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `VALIDATION_ERROR`           | Request body failed validation                       |
| `PROJECT_NOT_FOUND`          | Project ID does not exist                            |
| `SCENE_NOT_FOUND`            | Scene ID does not exist in the project               |
| `GENERATION_IN_PROGRESS`     | A generation job is already running for this scene   |
| `SCENES_NOT_COMPLETE`        | Cannot compile — not all scenes are generated        |
| `SAFETY_REVIEW_NOT_COMPLETE` | Cannot proceed — safety review has not passed        |
| `ANALYSIS_FAILED`            | News analysis failed (invalid content or AI error)   |
| `RATE_LIMIT_EXCEEDED`        | Too many requests, retry after cooldown              |

---

## 12. Webhooks

Register a webhook URL to receive real-time notifications for async operations.

### `POST /webhooks`

```json
{
  "url": "https://your-server.com/amaran-webhook",
  "events": [
    "analysis.completed",
    "scene.generation.completed",
    "scene.generation.failed",
    "compile.completed",
    "compile.failed",
    "safety-review.check.completed",
    "safety-review.completed"
  ]
}
```

### Webhook Payload

```json
{
  "event": "scene.generation.completed",
  "projectId": "proj_abc123",
  "data": {
    "sceneId": 1,
    "jobId": "job_xyz789",
    "videoUrl": "https://cdn.amaran.ai/videos/proj_abc123/scene_1.mp4",
    "durationMs": 8500
  },
  "timestamp": "2026-02-20T10:20:00Z"
}
```

### Event Types

| Event                            | Trigger                                           |
| -------------------------------- | ------------------------------------------------- |
| `analysis.completed`             | News analysis and fact-check extraction finished   |
| `scene.generation.completed`     | A single scene video clip finished generating      |
| `scene.generation.failed`        | A scene generation job failed                      |
| `compile.completed`              | Full video compilation finished                    |
| `compile.failed`                 | Full video compilation failed                      |
| `safety-review.check.completed`  | An individual safety check item completed          |
| `safety-review.completed`        | All safety checks completed                        |

---

## Typical Flow

```
1. POST   /projects                                  → Create project
2. POST   /projects/:id/analyze                      → Submit news, get fact-check + scenes
3. PUT    /projects/:id/fact-check                    → User edits & verifies fact-check items
4. PUT    /projects/:id/config                        → Set avatar, language, tone, format, length
5. PUT    /projects/:id/scenes/:sceneId               → Edit individual scene scripts
6. POST   /projects/:id/chat/scene                    → AI Director adjusts per-scene
7. POST   /projects/:id/scenes/:sceneId/generate      → Generate video per scene (repeat for all)
8. POST   /projects/:id/compile                       → Compile all scenes into full video
9. POST   /projects/:id/safety-review                 → Run automated safety checks
10. GET   /projects/:id/safety-review                 → Poll until all checks pass
11. GET   /projects/:id/export                        → Download final video
12. POST  /projects/:id/share                         → Share to social platforms
```

