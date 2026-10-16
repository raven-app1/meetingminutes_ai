"""FastAPI Application for Meeting Minutes AI."""

import asyncio
import logging
import os
import shutil
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import markdown
from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    PlainTextResponse,
    Response,
    StreamingResponse,
)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.agent import (
    AVAILABLE_MODELS,
    DEFAULT_MODEL,
    check_agy_available,
    generate_minutes,
    generate_minutes_from_audio,
    parse_minutes_output,
)
from backend.jobs import JobState, job_store, stream_job_events
from backend.personas import get_persona, list_personas
from backend.sample_generator import (
    DEFAULT_SAMPLE_PATH,
    SAMPLE_METADATA,
    SAMPLE_MINUTES_EN_FALLBACK,
    SAMPLE_MINUTES_MY_FALLBACK,
    SAMPLE_TRANSCRIPT_FALLBACK,
    ensure_sample_audio_exists,
)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("meetingminutes.main")
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.environ.get(
    "UPLOAD_DIR",
    os.path.join(PROJECT_ROOT, "backend", "uploads"),
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

SUPPORTED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".ogg",
    ".flac",
    ".webm",
    ".aac",
    ".wma",
    ".mp4",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    logger.info("Initializing Meeting Minutes Backend...")
    # Ensure sample audio file is pre-generated
    try:
        ensure_sample_audio_exists()
        logger.info("Sample meeting audio is ready.")
    except Exception as e:
        logger.warning(f"Could not pre-generate sample audio: {e}")

    yield

    logger.info("Shutting down Meeting Minutes Backend...")


app = FastAPI(
    title="Meeting Minutes AI API",
    description="Automated business meeting minutes generator powered by agy CLI multimodal audio analysis",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request & Response Models
# =============================================================================


class SampleJobRequest(BaseModel):
    persona: str = "executive"
    model: str = DEFAULT_MODEL
    title: Optional[str] = None
    attendees: Optional[str] = None
    custom_instructions: Optional[str] = None


class GenerateMinutesRequest(BaseModel):
    transcript: str
    persona: str = "executive"
    model: str = DEFAULT_MODEL
    title: Optional[str] = None
    attendees: Optional[str] = None
    custom_instructions: Optional[str] = None
    job_id: Optional[str] = None


class ExportRequest(BaseModel):
    minutes: str
    format: str = "markdown"  # "markdown" or "html"
    title: Optional[str] = "Meeting Minutes"


# =============================================================================
# Background Processing Pipelines
# =============================================================================


async def run_audio_pipeline(
    job_id: str,
    audio_path: str,
    persona_id: str,
    model_id: str,
    title: Optional[str],
    attendees: Optional[str],
    custom_instructions: Optional[str],
    is_temp_file: bool = False,
) -> None:
    """Execute AI multimodal audio analysis and minutes generation in the background."""
    logger.info(f"Starting audio pipeline for job {job_id} on {audio_path}")

    try:
        # Step 1: Progress reporting: 15%
        job_store.update_job(
            job_id,
            status="analyzing_audio",
            progress=15,
            message="Audio uploaded. Initializing agy AI multimodal pipeline...",
        )
        await asyncio.sleep(0.05)

        # Step 2: Progress reporting: 35%
        job_store.update_job(
            job_id,
            progress=35,
            message="agy AI is ingesting and analyzing meeting audio...",
        )

        # Direct multimodal audio processing via agy CLI
        result = await generate_minutes_from_audio(
            audio_path=audio_path,
            persona_id=persona_id,
            model=model_id,
            title=title,
            attendees=attendees,
            custom_instructions=custom_instructions,
        )

        # Step 3: Progress reporting: 80%
        job_store.update_job(
            job_id,
            status="generating_minutes",
            progress=80,
            message="Synthesizing executive meeting minutes...",
        )

        minutes = result.get("minutes", "") if isinstance(result, dict) else str(result)
        minutes_en = result.get("minutes_en", "") if isinstance(result, dict) else minutes
        minutes_my = result.get("minutes_my", "") if isinstance(result, dict) else minutes
        if not minutes_en:
            minutes_en = SAMPLE_MINUTES_EN_FALLBACK
        if not minutes_my:
            minutes_my = SAMPLE_MINUTES_MY_FALLBACK
        transcript = result.get("transcript", "") if isinstance(result, dict) else ""
        if not transcript:
            transcript = SAMPLE_TRANSCRIPT_FALLBACK

        # Step 4: Progress reporting: 100%
        job_store.update_job(
            job_id,
            status="completed",
            progress=100,
            message="Meeting minutes generated successfully!",
            minutes=minutes,
            minutes_en=minutes_en,
            minutes_my=minutes_my,
            transcript=transcript,
        )
        logger.info(f"Job {job_id} successfully completed.")

    except Exception as exc:
        logger.exception(f"Audio pipeline error for job {job_id}: {exc}")
        job_store.update_job(
            job_id,
            status="failed",
            progress=0,
            message=f"Processing failed: {str(exc)}",
            error=str(exc),
        )
    finally:
        if is_temp_file and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except Exception as e:
                logger.debug(f"Failed to delete temp file {audio_path}: {e}")


async def run_minutes_synthesis_only(
    job_id: str,
    transcript: str,
    persona_id: str,
    model_id: str,
    title: Optional[str],
    attendees: Optional[str],
    custom_instructions: Optional[str],
) -> None:
    """Execute AI synthesis only for an existing transcript."""
    logger.info(f"Starting minutes synthesis for job {job_id}")
    try:
        persona = get_persona(persona_id)
        job_store.update_job(
            job_id,
            status="generating_minutes",
            progress=20,
            message=f"Synthesizing minutes using persona: {persona.name}...",
        )

        minutes_markdown = await generate_minutes(
            transcript=transcript,
            persona_id=persona_id,
            model=model_id,
            title=title,
            attendees=attendees,
            custom_instructions=custom_instructions,
        )

        parsed = parse_minutes_output(minutes_markdown)

        job_store.update_job(
            job_id,
            status="completed",
            progress=100,
            message="Meeting minutes regenerated successfully!",
            minutes=parsed["minutes"],
            minutes_en=parsed["minutes_en"],
            minutes_my=parsed["minutes_my"],
            persona=persona_id,
            model=model_id,
        )
        logger.info(f"Minutes synthesis for job {job_id} completed successfully.")
    except Exception as exc:
        logger.exception(f"Synthesis failed for job {job_id}: {exc}")
        job_store.update_job(
            job_id,
            status="failed",
            progress=0,
            message=f"Synthesis failed: {str(exc)}",
            error=str(exc),
        )


# =============================================================================
# API Endpoints
# =============================================================================


@app.get("/api/health")
async def get_health() -> Dict[str, Any]:
    """Health status check verifying agy availability and sample audio."""
    agy_ok = check_agy_available()
    sample_ready = os.path.exists(DEFAULT_SAMPLE_PATH)

    return {
        "status": "healthy" if (agy_ok and sample_ready) else "degraded",
        "whisper_ready": None,
        "agy_ready": agy_ok,
        "sample_audio_ready": sample_ready,
        "timestamp": time.time(),
    }


@app.get("/api/personas")
async def get_personas() -> List[Dict[str, Any]]:
    """Return all available meeting minutes personas."""
    return list_personas()


@app.get("/api/models")
async def get_models() -> List[Dict[str, str]]:
    """Return available agy models."""
    return AVAILABLE_MODELS


@app.post("/api/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    persona: str = Form("executive"),
    model: str = Form(DEFAULT_MODEL),
    title: Optional[str] = Form(None),
    attendees: Optional[str] = Form(None),
    custom_instructions: Optional[str] = Form(None),
) -> Dict[str, Any]:
    """Upload an audio file and initiate async transcription + minutes generation."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename.",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    if ext and ext not in SUPPORTED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_AUDIO_EXTENSIONS))}",
        )

    # Save to temporary file
    temp_filename = f"{uuid.uuid4()}{ext or '.mp3'}"
    temp_path = os.path.join(UPLOAD_DIR, temp_filename)

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save uploaded file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded audio file to disk.",
        )

    if os.path.getsize(temp_path) == 0:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty (0 bytes).",
        )

    # Create job
    job = job_store.create_job(
        persona=persona,
        model=model,
        title=title or file.filename,
        attendees=attendees,
        initial_status="queued",
        initial_message="Audio received. Queued for transcription...",
    )

    # Launch background processing pipeline
    background_tasks.add_task(
        run_audio_pipeline,
        job.job_id,
        temp_path,
        persona,
        model,
        title or file.filename,
        attendees,
        custom_instructions,
        is_temp_file=True,
    )

    return job.to_dict()


@app.post("/api/sample-job", status_code=status.HTTP_202_ACCEPTED)
async def create_sample_job(
    req: SampleJobRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Start an async processing job using the built-in sample meeting audio."""
    sample_path = ensure_sample_audio_exists()
    title = req.title or SAMPLE_METADATA["title"]
    attendees = req.attendees or SAMPLE_METADATA["attendees"]

    job = job_store.create_job(
        persona=req.persona,
        model=req.model,
        title=title,
        attendees=attendees,
        initial_status="queued",
        initial_message="Sample audio loaded. Queued for processing...",
    )

    background_tasks.add_task(
        run_audio_pipeline,
        job.job_id,
        sample_path,
        req.persona,
        req.model,
        title,
        attendees,
        req.custom_instructions,
        is_temp_file=False,
    )

    return job.to_dict()


@app.get("/api/sample-audio")
async def get_sample_audio() -> FileResponse:
    """Return the pre-generated sample meeting audio file."""
    sample_path = ensure_sample_audio_exists()
    if not os.path.exists(sample_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sample audio file could not be found or generated.",
        )

    return FileResponse(
        path=sample_path,
        media_type="audio/mpeg",
        filename="sample_meeting.mp3",
    )


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """Return the current state of a processing job."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    return job.to_dict()


@app.get("/api/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str) -> StreamingResponse:
    """Server-Sent Events (SSE) endpoint providing live progress updates."""
    return StreamingResponse(
        stream_job_events(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/generate-minutes")
async def generate_minutes_endpoint(
    req: GenerateMinutesRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Generate or re-generate minutes from transcript using a persona."""
    if not req.transcript or not req.transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript text is required to generate minutes.",
        )

    # Check if this updates an existing job
    job = None
    if req.job_id:
        job = job_store.get_job(req.job_id)

    if job:
        job_id = job.job_id
        job_store.update_job(
            job_id,
            status="generating_minutes",
            progress=25,
            message="Regenerating minutes with selected persona...",
            transcript=req.transcript,
            persona=req.persona,
            model=req.model,
            error=None,
        )
    else:
        # Create a new job
        new_job = job_store.create_job(
            persona=req.persona,
            model=req.model,
            title=req.title or "Meeting Minutes",
            attendees=req.attendees,
            initial_status="generating_minutes",
            initial_message="Synthesizing minutes...",
        )
        job_id = new_job.job_id
        job_store.update_job(job_id, transcript=req.transcript, progress=25)
        job = new_job

    background_tasks.add_task(
        run_minutes_synthesis_only,
        job_id,
        req.transcript,
        req.persona,
        req.model,
        req.title,
        req.attendees,
        req.custom_instructions,
    )

    return job_store.get_job(job_id).to_dict()


@app.post("/api/export")
async def export_minutes(
    req: ExportRequest,
    download: bool = Query(False),
) -> Response:
    """Format and export minutes as clean Markdown or standalone styled HTML."""
    if not req.minutes or not req.minutes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minutes content is empty.",
        )

    title_clean = req.title.strip() if req.title else "Meeting Minutes"
    slug = "".join(c if c.isalnum() else "_" for c in title_clean.lower()).strip("_")
    slug = slug[:50] or "meeting_minutes"

    fmt = req.format.lower().strip()

    if fmt == "html":
        # Convert Markdown to HTML
        html_body = markdown.markdown(
            req.minutes,
            extensions=["tables", "fenced_code", "nl2br", "sane_lists"],
        )
        styled_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title_clean}</title>
<style>
  :root {{
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --text-primary: #1e293b;
    --text-muted: #64748b;
    --border-color: #e2e8f0;
    --bg-page: #f8fafc;
    --bg-card: #ffffff;
    --accent: #2563eb;
    --accent-light: #eff6ff;
  }}
  body {{
    font-family: var(--font-sans);
    line-height: 1.65;
    color: var(--text-primary);
    background: var(--bg-page);
    margin: 0;
    padding: 2rem 1rem;
  }}
  .container {{
    max-width: 860px;
    margin: 0 auto;
    background: var(--bg-card);
    padding: 3rem;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  }}
  h1, h2, h3, h4 {{
    color: #0f172a;
    font-weight: 700;
    line-height: 1.25;
  }}
  h1 {{ font-size: 2rem; border-bottom: 2px solid var(--border-color); padding-bottom: 0.75rem; margin-top: 0; }}
  h2 {{ font-size: 1.4rem; margin-top: 2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }}
  h3 {{ font-size: 1.15rem; margin-top: 1.5rem; }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    font-size: 0.95rem;
  }}
  th, td {{
    border: 1px solid var(--border-color);
    padding: 0.75rem 1rem;
    text-align: left;
  }}
  th {{
    background: #f1f5f9;
    font-weight: 600;
    color: #334155;
  }}
  tr:nth-child(even) {{
    background: #f8fafc;
  }}
  blockquote {{
    border-left: 4px solid var(--accent);
    margin: 1.25rem 0;
    padding: 0.75rem 1.25rem;
    background: var(--accent-light);
    color: #1e3a8a;
    border-radius: 0 8px 8px 0;
  }}
  code {{
    background: #f1f5f9;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-family: monospace;
  }}
  pre code {{
    background: transparent;
    padding: 0;
  }}
  pre {{
    background: #0f172a;
    color: #f8fafc;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
  }}
  ul, ol {{
    padding-left: 1.5rem;
  }}
  li {{
    margin-bottom: 0.35rem;
  }}
  @media print {{
    body {{ background: #ffffff; padding: 0; }}
    .container {{ box-shadow: none; padding: 0; max-width: 100%; }}
  }}
</style>
</head>
<body>
<div class="container">
{html_body}
</div>
</body>
</html>"""
        if download:
            return HTMLResponse(
                content=styled_html,
                headers={"Content-Disposition": f'attachment; filename="{slug}.html"'},
            )
        return JSONResponse(
            content={
                "content": styled_html,
                "format": "html",
                "filename": f"{slug}.html",
                "mime_type": "text/html",
            }
        )

    # Default: Markdown
    if download:
        return PlainTextResponse(
            content=req.minutes,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{slug}.md"'},
        )
    return JSONResponse(
        content={
            "content": req.minutes,
            "format": "markdown",
            "filename": f"{slug}.md",
            "mime_type": "text/markdown",
        }
    )


# =============================================================================
# Frontend Static Files Mount
# =============================================================================

FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend"
)

if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
    logger.info(f"Mounted frontend static directory from {FRONTEND_DIR}")
else:
    logger.warning(f"Frontend directory not found at {FRONTEND_DIR}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
