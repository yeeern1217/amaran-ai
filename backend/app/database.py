"""
Firestore Database Module — CRUD operations for Scam Shield projects.

Collection: projects/{uid}/items/{project_id}
"""
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_db = None  # Lazy singleton


def _get_db():
    """Return a Firestore client (lazy init). Works both locally and on Cloud Run."""
    global _db
    if _db is not None:
        return _db

    from google.cloud import firestore

    project_id = os.getenv("GCP_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT")
    _db = firestore.Client(project=project_id) if project_id else firestore.Client()
    logger.info("[DB] Firestore client initialised (project=%s)", _db.project)
    return _db


# ── Pydantic schemas ───────────────────────────────────────────────

class ProjectRecord(BaseModel):
    """Stored representation of a Scam Shield project."""
    project_id: str
    owner_uid: str
    name: str
    scam_type: str = ""
    status: str = "draft"  # draft | in-progress | completed
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    # Snapshot of pipeline artefacts (fact_sheet, scenes, config, etc.)
    data: Dict[str, Any] = Field(default_factory=dict)


# ── CRUD helpers ───────────────────────────────────────────────────

def _col(uid: str):
    """Return the sub-collection reference for a user's projects."""
    return _get_db().collection("projects").document(uid).collection("items")


def save_project(record: ProjectRecord) -> str:
    """Upsert a project document. Returns the document ID."""
    record.updated_at = datetime.utcnow().isoformat()
    _col(record.owner_uid).document(record.project_id).set(
        record.model_dump(mode="json"),
        merge=True,
    )
    logger.info("[DB] Saved project %s for user %s", record.project_id, record.owner_uid)
    return record.project_id


def list_projects(uid: str, limit: int = 50) -> List[Dict[str, Any]]:
    """List projects owned by *uid*, newest first."""
    docs = (
        _col(uid)
        .order_by("updated_at", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    results = []
    for doc in docs:
        d = doc.to_dict()
        # Strip heavy data blob for listing
        d.pop("data", None)
        results.append(d)
    return results


def get_project(uid: str, project_id: str) -> Optional[Dict[str, Any]]:
    """Get a single project document (with full data)."""
    doc = _col(uid).document(project_id).get()
    return doc.to_dict() if doc.exists else None


def delete_project(uid: str, project_id: str) -> bool:
    """Delete a project document. Returns True if it existed."""
    ref = _col(uid).document(project_id)
    doc = ref.get()
    if doc.exists:
        ref.delete()
        logger.info("[DB] Deleted project %s for user %s", project_id, uid)
        return True
    return False
