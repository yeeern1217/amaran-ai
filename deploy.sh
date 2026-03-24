#!/usr/bin/env bash
#
# deploy.sh — Build & deploy Scam Shield (Firebase Hosting + Cloud Run)
#
# Prerequisites:
#   - gcloud CLI authenticated & project set
#   - firebase CLI authenticated
#   - Node.js / pnpm installed
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh                 # deploy both frontend + backend
#   ./deploy.sh frontend        # frontend only
#   ./deploy.sh backend         # backend only

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────
GCP_PROJECT="${GCP_PROJECT:-amaran-ai}"
REGION="${REGION:-asia-southeast1}"
SERVICE_NAME="${SERVICE_NAME:-scam-shield-api}"
# ──────────────────────────────────────────────────────────────────

TARGET="${1:-all}"

deploy_backend() {
  echo "══════════════════════════════════════"
  echo "  Deploying backend to Cloud Run"
  echo "══════════════════════════════════════"

  cd backend

  # Build & push container via Cloud Build
  gcloud builds submit \
    --tag "gcr.io/${GCP_PROJECT}/${SERVICE_NAME}" \
    --project "${GCP_PROJECT}"

  # Deploy to Cloud Run
  gcloud run deploy "${SERVICE_NAME}" \
    --image "gcr.io/${GCP_PROJECT}/${SERVICE_NAME}" \
    --platform managed \
    --region "${REGION}" \
    --project "${GCP_PROJECT}" \
    --allow-unauthenticated \
    --memory 1Gi \
    --timeout 300 \
    --set-env-vars "GCP_PROJECT=${GCP_PROJECT}"

  # Print the service URL
  BACKEND_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --project "${GCP_PROJECT}" \
    --format "value(status.url)")

  echo ""
  echo "✅ Backend deployed: ${BACKEND_URL}"
  echo ""

  cd ..
}

deploy_frontend() {
  echo "══════════════════════════════════════"
  echo "  Building & deploying frontend"
  echo "══════════════════════════════════════"

  cd frontend

  # Install dependencies
  pnpm install --frozen-lockfile

  # Build static export
  pnpm build

  cd ..

  # Deploy to Firebase Hosting
  firebase deploy --only hosting --project "${GCP_PROJECT}"

  echo ""
  echo "✅ Frontend deployed to Firebase Hosting"
  echo ""
}

case "${TARGET}" in
  backend)
    deploy_backend
    ;;
  frontend)
    deploy_frontend
    ;;
  all)
    deploy_backend
    deploy_frontend
    ;;
  *)
    echo "Usage: $0 [all|frontend|backend]"
    exit 1
    ;;
esac

echo "🎉 Deployment complete!"
