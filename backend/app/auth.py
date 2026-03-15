"""
Firebase Auth — verify ID tokens from the frontend.

Usage:
    from .auth import get_current_user
    
    @router.get("/me")
    async def me(uid: str = Depends(get_current_user)):
        ...
"""
import logging
import os
from typing import Optional

from fastapi import Depends, HTTPException, Request

logger = logging.getLogger(__name__)

_auth_app = None


def _init_firebase_admin():
    """Initialise the Firebase Admin SDK (once)."""
    global _auth_app
    if _auth_app is not None:
        return

    import firebase_admin
    from firebase_admin import credentials

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and os.path.isfile(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        # On Cloud Run, ADC (Application Default Credentials) works automatically
        firebase_admin.initialize_app()

    _auth_app = firebase_admin.get_app()
    logger.info("[AUTH] Firebase Admin SDK initialised")


def _extract_token(request: Request) -> Optional[str]:
    """Pull the Bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


async def get_current_user(request: Request) -> str:
    """
    FastAPI dependency — extracts and verifies Firebase ID token.
    Returns the user's UID.
    """
    # During local development, allow bypass via env flag
    if os.getenv("AUTH_DISABLED", "").lower() == "true":
        return os.getenv("DEV_UID", "dev-user")

    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    try:
        _init_firebase_admin()
        from firebase_admin import auth

        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        logger.warning("[AUTH] Token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")
