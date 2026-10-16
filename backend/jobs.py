"""In-memory job management and Server-Sent Events (SSE) streaming."""

import asyncio
import json
import logging
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional, Set
from pydantic import BaseModel, Field

logger = logging.getLogger("meetingminutes.jobs")


class JobState(BaseModel):
    job_id: str
    status: str = "queued"  # queued, transcribing, generating_minutes, completed, failed
    progress: int = 0  # 0 to 100
    message: str = "Job created"
    transcript: str = ""
    segments: List[Dict[str, Any]] = Field(default_factory=list)
    minutes: str = ""
    minutes_en: str = ""
    minutes_my: str = ""
    persona: str = "executive"
    model: str = "gemini-3.8-flash-medium"
    title: Optional[str] = None
    attendees: Optional[str] = None
    language: Optional[str] = None
    audio_duration: Optional[float] = None
    error: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


class JobStore:
    """In-memory store for tracking transcription and minutes generation jobs."""

    def __init__(self) -> None:
        self._jobs: Dict[str, JobState] = {}
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    def create_job(
        self,
        persona: str = "executive",
        model: str = "gemini-3.8-flash-medium",
        title: Optional[str] = None,
        attendees: Optional[str] = None,
        initial_status: str = "queued",
        initial_message: str = "Job queued for processing",
        job_id: Optional[str] = None,
    ) -> JobState:
        """Create a new job and register it."""
        jid = job_id or str(uuid.uuid4())
        job = JobState(
            job_id=jid,
            persona=persona,
            model=model,
            title=title,
            attendees=attendees,
            status=initial_status,
            message=initial_message,
        )
        self._jobs[jid] = job
        self._subscribers[jid] = set()
        logger.info(f"Created job {jid} (persona={persona}, model={model})")
        return job

    def get_job(self, job_id: str) -> Optional[JobState]:
        """Fetch job state by ID."""
        return self._jobs.get(job_id)

    def list_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return a list of recent jobs."""
        sorted_jobs = sorted(
            self._jobs.values(), key=lambda j: j.created_at, reverse=True
        )
        return [j.to_dict() for j in sorted_jobs[:limit]]

    def update_job(
        self,
        job_id: str,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        transcript: Optional[str] = None,
        segments: Optional[List[Dict[str, Any]]] = None,
        minutes: Optional[str] = None,
        minutes_en: Optional[str] = None,
        minutes_my: Optional[str] = None,
        persona: Optional[str] = None,
        model: Optional[str] = None,
        language: Optional[str] = None,
        audio_duration: Optional[float] = None,
        error: Optional[str] = None,
    ) -> Optional[JobState]:
        """Update job fields and notify SSE subscribers."""
        job = self._jobs.get(job_id)
        if not job:
            logger.warning(f"Attempted to update non-existent job {job_id}")
            return None

        if status is not None:
            job.status = status
        if progress is not None:
            job.progress = max(0, min(100, progress))
        if message is not None:
            job.message = message
        if transcript is not None:
            job.transcript = transcript
        if segments is not None:
            job.segments = segments
        if minutes is not None:
            job.minutes = minutes
        if minutes_en is not None:
            job.minutes_en = minutes_en
        if minutes_my is not None:
            job.minutes_my = minutes_my
        if language is not None:
            job.language = language
        if audio_duration is not None:
            job.audio_duration = audio_duration
        if error is not None:
            job.error = error
        if persona is not None:
            job.persona = persona
        if model is not None:
            job.model = model
        job.updated_at = time.time()
        payload = job.to_dict()

        # Notify active SSE subscribers
        subscribers = self._subscribers.get(job_id, set())
        for q in list(subscribers):
            try:
                q.put_nowait(payload)
            except Exception as e:
                logger.debug(f"Failed to push update to subscriber for job {job_id}: {e}")

        return job

    def subscribe(self, job_id: str) -> asyncio.Queue:
        """Subscribe to live updates for a job."""
        if job_id not in self._subscribers:
            self._subscribers[job_id] = set()
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers[job_id].add(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue) -> None:
        """Unsubscribe from live updates."""
        if job_id in self._subscribers:
            self._subscribers[job_id].discard(q)


# Singleton job store instance
job_store = JobStore()


async def stream_job_events(job_id: str) -> AsyncGenerator[str, None]:
    """Generate Server-Sent Events (SSE) for a job."""
    job = job_store.get_job(job_id)
    if not job:
        error_payload = {
            "job_id": job_id,
            "status": "failed",
            "progress": 0,
            "message": "Job not found",
            "error": f"No job found with ID {job_id}",
        }
        yield f"data: {json.dumps(error_payload)}\n\n"
        return

    # Check initial status at connection time
    initial_status = job.status
    # Subscribe first so no events are dropped
    queue = job_store.subscribe(job_id)
    try:
        # Yield current state immediately as initial event
        yield f"data: {json.dumps(job.to_dict())}\n\n"

        # If already finished prior to connection, terminate stream
        if initial_status in ("completed", "failed"):
            return

        while True:
            try:
                # Wait for next update with timeout to send keepalive comment
                payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {json.dumps(payload)}\n\n"

                if payload.get("status") in ("completed", "failed"):
                    # Allow brief grace period for client buffers to process final frame
                    await asyncio.sleep(0.5)
                    break
            except asyncio.TimeoutError:
                # Send SSE comment to keep connection alive
                yield ": keepalive\n\n"
                # Check if job was completed in the meantime
                current = job_store.get_job(job_id)
                if current and current.status in ("completed", "failed"):
                    yield f"data: {json.dumps(current.to_dict())}\n\n"
                    await asyncio.sleep(0.5)
                    break
    finally:
        job_store.unsubscribe(job_id, queue)
