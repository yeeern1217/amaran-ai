"""
FastAPI Application - Main entry point for the Scam Shield API.

Run with:
    uvicorn app.api.main:app --reload --port 8000
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from ..config import get_settings
from .routes import router

# Configure root logger so all app loggers output to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    # Startup
    settings = get_settings()
    print(f"🛡️ Scam Shield API starting...")
    print(f"   Research Model: {settings.default_research_model}")
    print(f"   API Key: {'✅ Set' if settings.google_api_key else '❌ Missing'}")
    yield
    # Shutdown
    print("🛡️ Scam Shield API shutting down...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="Scam Shield API",
        description="Multi-agent system for generating anti-scam awareness content for Malaysian audiences",
        version="0.1.0",
        lifespan=lifespan,
    )
    
    # CORS configuration for frontend
    # Update these origins when deploying
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",      # Next.js dev server
            "http://127.0.0.1:3000",
            "https://scam-shield-af5d9.web.app",      # Firebase Hosting
            "https://scam-shield-af5d9.firebaseapp.com",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include API routes
    app.include_router(router, prefix="/api/v1")
    
    return app


# Create app instance
app = create_app()


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    settings = get_settings()
    return {
        "status": "healthy",
        "api_key_configured": bool(settings.google_api_key),
        "models": {
            "research": settings.default_research_model,
            "director": settings.default_director_model,
            "linguistic": settings.default_linguistic_model,
            "sensitivity": settings.default_sensitivity_model,
        },
        "deep_research_enabled": settings.use_deep_research,
    }
