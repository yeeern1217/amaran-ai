# Deployment Guide — Scam Shield (amaran.ai)

This guide walks through deploying the app with:

- **Frontend** → Firebase Hosting (static Next.js export)
- **Backend** → Cloud Run (Docker / FastAPI)
- **Database** → Firestore (project storage)
- **Auth** → Firebase Authentication (Google sign-in)

---

## Prerequisites

| Tool | Install |
|------|---------|
| [Node.js](https://nodejs.org/) 18+ | `winget install OpenJS.NodeJS.LTS` |
| [pnpm](https://pnpm.io/) | `npm i -g pnpm` |
| [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) | `winget install Google.CloudSDK` |
| [Firebase CLI](https://firebase.google.com/docs/cli) | `npm i -g firebase-tools` |

---

## 1. Create / Configure Firebase Project

If you already have a Firebase project, skip to step 1c.

### 1a. Create a new project (or reuse existing)

```bash
firebase login
firebase projects:create amaran-ai   # pick a globally-unique ID
```

### 1b. Update `.firebaserc`

```json
{
  "projects": {
    "default": "amaran-ai"
  }
}
```

### 1c. Enable required services

Go to the [Firebase Console](https://console.firebase.google.com):

1. **Authentication** → Sign-in method → Enable **Google** provider
2. **Firestore Database** → Create database → Start in **production mode** → Choose a region (e.g. `asia-southeast1`)
3. **Hosting** → Get started (just click through — the config is already in `firebase.json`)

### 1d. Register a Web App

1. Firebase Console → Project Settings → General → **Add app** → Web
2. Copy the Firebase config object. You'll need:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

---

## 2. Configure Environment Variables

### Frontend — `frontend/.env.local`

Create from the template:

```bash
cp frontend/.env.example frontend/.env.local
```

Fill in the values:

```env
NEXT_PUBLIC_API_URL=https://YOUR_CLOUD_RUN_URL/api/v1

NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=amaran-ai.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=amaran-ai
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=amaran-ai.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

> **Note**: `NEXT_PUBLIC_API_URL` will be the Cloud Run URL you get after deploying the backend (Step 4). You can deploy backend first, then set this and rebuild.

### Backend — Cloud Run env vars

These are set during `gcloud run deploy` (see Step 4). Key variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Gemini API key |
| `GCP_PROJECT` | Your Firebase/GCP project ID |
| `SERPER_API_KEY` | (Optional) For trending news |
| `AUTH_DISABLED` | Set `true` for local dev only |

---

## 3. Local Development

### Backend

```bash
cd backend

# Create a virtual environment
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Set env vars for local dev
set GOOGLE_API_KEY=your-key
set AUTH_DISABLED=true
set GCP_PROJECT=amaran-ai

# Run
uvicorn app.api.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:3000

---

## 4. Deploy Backend to Cloud Run

### 4a. Set your project

```bash
gcloud config set project amaran-ai
gcloud auth login
```

### 4b. Enable required APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  containerregistry.googleapis.com
```

### 4c. Build and deploy

```bash
cd backend

# Build container image
gcloud builds submit --tag gcr.io/amaran-ai/amaran-ai-api

# Deploy to Cloud Run
gcloud run deploy amaran-ai-api \
  --image gcr.io/amaran-ai/amaran-ai-api \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars "GOOGLE_API_KEY=your-gemini-key,GCP_PROJECT=amaran-ai,SERPER_API_KEY=your-serper-key"
```

### 4d. Note the service URL

```bash
gcloud run services describe amaran-ai-api \
  --region asia-southeast1 \
  --format "value(status.url)"
```

You'll get something like `https://amaran-ai-api-xxxxx-as.a.run.app`.

### 4e. Update CORS (if using a different project ID)

Edit `backend/app/api/main.py` — add your Firebase Hosting domain to `allow_origins`:

```python
"https://amaran-ai.web.app",
"https://amaran-ai.firebaseapp.com",
```

Then redeploy the backend.

---

## 5. Deploy Frontend to Firebase Hosting

### 5a. Set `NEXT_PUBLIC_API_URL`

Update `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://amaran-ai-api-xxxxx-as.a.run.app/api/v1
```

### 5b. Build and deploy

```bash
cd frontend
pnpm build          # Generates frontend/out/
cd ..
firebase deploy --only hosting --project amaran-ai
```

Your app will be live at `https://amaran-ai.web.app`.

---

## 6. Firestore Security Rules

Create/update `firestore.rules` in the project root:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own projects
    match /projects/{uid}/items/{projectId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    
    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy rules:

```bash
firebase deploy --only firestore:rules --project amaran-ai
```

---

## 7. Quick Deploy (all-in-one)

A `deploy.sh` script is provided at the project root:

```bash
# Set your project
export GCP_PROJECT=amaran-ai
export REGION=asia-southeast1

# Deploy everything
./deploy.sh

# Or deploy individually
./deploy.sh backend
./deploy.sh frontend
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `firebase/auth` module not found | Run `pnpm install` in `frontend/` |
| CORS errors | Add your hosting domain to `main.py` `allow_origins` and redeploy |
| Auth returns 401 | Ensure `AUTH_DISABLED` is **not** set on Cloud Run |
| Firestore permission denied | Deploy Firestore security rules (Step 6) |
| Cloud Run cold start slow | Set `--min-instances 1` in deploy command |

---

## Architecture Summary

```
┌──────────────┐     HTTPS      ┌───────────────────┐
│   Browser     │ ──────────►   │  Firebase Hosting  │
│  (Next.js)    │   static      │   (frontend/out)   │
└──────┬───────┘                └───────────────────┘
       │
       │ API calls (Bearer token)
       ▼
┌──────────────────┐            ┌───────────────────┐
│   Cloud Run      │ ────────►  │   Firestore DB    │
│  (FastAPI)       │            │  projects/{uid}/   │
│  amaran-ai-api │            │    items/{id}      │
└──────────────────┘            └───────────────────┘
       │
       ▼
┌──────────────────┐
│  Google AI APIs  │
│  Gemini / Veo    │
└──────────────────┘
```
