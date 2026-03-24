"""
YouTube OAuth2 Setup Script — One-time authorization to get a refresh token.

Usage:
  1. Go to Google Cloud Console → APIs & Services → Credentials
  2. Create an OAuth 2.0 Client ID (Desktop application)
  3. Download the JSON and rename to client_secret.json in this directory
     OR set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in backend/.env
  4. Run:  python scripts/youtube_auth.py
  5. A browser window opens → authorize with the Google account that owns the YouTube channel
  6. The script prints YOUTUBE_REFRESH_TOKEN — add it to backend/.env

Prerequisites:
  - Enable "YouTube Data API v3" in your GCP project (amaran-ai)
  - pip install google-auth-oauthlib  (already in requirements)
"""

import json
import os
import sys
from pathlib import Path

# Add backend root to path so we can read .env
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

try:
    from dotenv import load_dotenv
    load_dotenv(backend_root / ".env")
except ImportError:
    pass

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def main():
    client_id = os.getenv("YOUTUBE_CLIENT_ID", "")
    client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "")

    # Try client_secret.json file first
    secret_file = Path(__file__).parent / "client_secret.json"
    if secret_file.exists():
        print(f"Using client_secret.json from {secret_file}")
        from google_auth_oauthlib.flow import InstalledAppFlow
        flow = InstalledAppFlow.from_client_secrets_file(str(secret_file), SCOPES)
    elif client_id and client_secret:
        print("Using YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET from .env")
        from google_auth_oauthlib.flow import InstalledAppFlow
        client_config = {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost"],
            }
        }
        flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    else:
        print("ERROR: No OAuth2 credentials found.")
        print("Either:")
        print("  1. Place client_secret.json in this directory, OR")
        print("  2. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in backend/.env")
        sys.exit(1)

    # Run local server flow (opens browser)
    credentials = flow.run_local_server(port=8090, prompt="consent")

    print("\n" + "=" * 60)
    print("SUCCESS! Add these to your backend/.env file:")
    print("=" * 60)
    if not client_id:
        # Extract from client_secret.json
        with open(secret_file) as f:
            data = json.load(f)
            installed = data.get("installed", data.get("web", {}))
            client_id = installed.get("client_id", "")
            client_secret = installed.get("client_secret", "")
        print(f"YOUTUBE_CLIENT_ID={client_id}")
        print(f"YOUTUBE_CLIENT_SECRET={client_secret}")
    print(f"YOUTUBE_REFRESH_TOKEN={credentials.refresh_token}")
    print("=" * 60)


if __name__ == "__main__":
    main()
