"""Comprehensive backend test suite for Meeting Minutes AI application."""

import asyncio
import os
import sys
import tempfile
import time
from fastapi.testclient import TestClient

# Add project root to sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.agent import (
    AVAILABLE_MODELS,
    DEFAULT_MODEL,
    check_agy_available,
    generate_minutes,
    generate_minutes_from_audio,
)
from backend.jobs import job_store, stream_job_events
from backend.main import app
from backend.personas import PERSONAS, get_persona, list_personas
from backend.sample_generator import (
    DEFAULT_SAMPLE_PATH,
    SAMPLE_METADATA,
    SAMPLE_TRANSCRIPT_FALLBACK,
    ensure_sample_audio_exists,
)

def test_personas():
    """Verify all 6 business personas are correctly configured."""
    print("\n--- [1/6] Testing Personas ---")
    expected_ids = {
        "executive",
        "formal",
        "action_oriented",
        "technical",
        "brainstorming",
        "client_stakeholder",
    }
    assert expected_ids.issubset(set(PERSONAS.keys())), f"Missing personas: {expected_ids - set(PERSONAS.keys())}"

    for pid in expected_ids:
        p = PERSONAS[pid]
        assert p.id == pid, f"Persona ID mismatch: {p.id} != {pid}"
        assert len(p.name) > 3, f"Persona name too short: {p.name}"
        assert p.name_my and len(p.name_my) > 3, f"Persona Burmese name too short: {p.name_my}"
        assert len(p.icon) > 0, f"Persona missing icon: {p.id}"
        assert len(p.description) > 10, f"Persona description too short: {p.id}"
        assert p.description_my and len(p.description_my) > 10, f"Persona Burmese description too short: {p.description_my}"
        assert len(p.tone) > 3, f"Persona tone too short: {p.id}"
        assert len(p.target_audience) > 3, f"Persona target audience too short: {p.id}"
        assert len(p.system_prompt) > 50, f"Persona prompt template too short: {p.id}"
        assert "{title}" in p.system_prompt, f"Persona {pid} missing {{title}} in prompt"
        assert p.system_prompt_my and len(p.system_prompt_my) > 50, f"Persona {pid} missing Burmese prompt template"
        assert "{title}" in p.system_prompt_my, f"Persona {pid} missing {{title}} in Burmese prompt"
    # Test list_personas
    p_list = list_personas()
    assert len(p_list) >= 6, f"Expected at least 6 personas, got {len(p_list)}"

    # Test get_persona fallback
    fallback = get_persona("non_existent_persona")
    assert fallback.id == "executive", f"Fallback should be executive, got {fallback.id}"

    print(f"✓ All {len(expected_ids)} personas validated successfully.")


def test_sample_audio_generation():
    """Verify sample audio file generation."""
    print("\n--- [2/6] Testing Sample Audio Generator ---")
    sample_path = ensure_sample_audio_exists()
    assert os.path.exists(sample_path), f"Sample audio missing at {sample_path}"
    file_size = os.path.getsize(sample_path)
    assert file_size > 10000, f"Sample audio unexpectedly small: {file_size} bytes"
    print(f"✓ Sample audio file verified at {sample_path} ({file_size} bytes).")


def test_generate_minutes_from_audio():
    """Verify generate_minutes_from_audio interface, validation, and execution."""
    print("\n--- [3/6] Testing agy Audio Processing (generate_minutes_from_audio) ---")
    assert check_agy_available(), "agy CLI is not available or not executable!"

    # 1. Nonexistent file raises FileNotFoundError
    try:
        asyncio.run(generate_minutes_from_audio("/path/to/nonexistent/audio.mp3"))
        assert False, "Expected FileNotFoundError for nonexistent file"
    except FileNotFoundError:
        print("  ✓ Nonexistent file raises FileNotFoundError")

    # 2. Verify with mock subprocess to test parsing and CLI arguments
    from unittest.mock import AsyncMock, patch, MagicMock

    mock_stdout = (
        b"# Executive Briefing: Q3 Sync\n\n"
        b"## Summary\nDecisions were made.\n\n"
        b"===TRANSCRIPT===\n"
        b"Sarah: Good morning.\nAlex: Hi everyone."
    )

    mock_process = MagicMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(mock_stdout, b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process) as mock_exec:
        sample_path = ensure_sample_audio_exists()
        result = asyncio.run(
            generate_minutes_from_audio(
                audio_path=sample_path,
                persona_id="executive",
                title="Q3 Sync",
                attendees="Sarah, Alex",
            )
        )

        assert isinstance(result, dict), "Result should be a dictionary"
        assert "minutes" in result, "Missing 'minutes' in result"
        assert "transcript" in result, "Missing 'transcript' in result"
        assert "Executive Briefing: Q3 Sync" in result["minutes"]
        assert "Sarah: Good morning." in result["transcript"]

        # Verify command arguments passed to agy CLI
        call_args = mock_exec.call_args[0]
        assert "--dangerously-skip-permissions" in call_args
        assert "--disable-slash-commands" in call_args
        assert "--model" in call_args
        assert "-p" in call_args
        prompt_idx = call_args.index("-p") + 1
        prompt_text = call_args[prompt_idx]
        assert "Audio File Path:" in prompt_text
        assert "view_file" in prompt_text
        print("  ✓ Mocked subprocess validated CLI arguments, view_file prompt, and output parsing")

    print("✓ generate_minutes_from_audio verified successfully.")

def test_agy_agent():
    """Verify agy CLI execution and meeting minutes generation."""
    print("\n--- [4/6] Testing agy AI Minutes Generation ---")
    assert check_agy_available(), "agy CLI is not available or not executable!"

    test_transcript = (
        "Sarah Chen: Good morning team, thanks for joining our Q3 AI Roadmap Sync. "
        "We decided today to launch the automated minutes feature next Monday. "
        "Alex Miller reported that faster-whisper INT8 drops latency to 3.5 seconds. "
        "David Kim confirmed leadership approved a $15,000 monthly cloud budget. "
        "Action items: Alex to implement queue by Thursday, Elena to finalize progress UI by Wednesday."
    )

    t0 = time.time()
    minutes = asyncio.run(
        generate_minutes(
            transcript=test_transcript,
            persona_id="executive",
            model="gemini-3.8-flash-medium",
            title="Q3 AI Roadmap Sync",
            attendees="Sarah Chen, Alex Miller, David Kim, Elena Rostova",
        )
    )
    elapsed = time.time() - t0

    assert minutes and len(minutes) > 100, f"Generated minutes too short: {len(minutes) if minutes else 0}"
    print(f"✓ agy generation passed in {elapsed:.1f}s ({len(minutes)} characters generated).")
    print(f"  Sample Output:\n{'-'*40}\n{minutes[:300]}...\n{'-'*40}")


def test_jobs_and_sse():
    """Verify in-memory job store and SSE streaming."""
    print("\n--- [5/6] Testing In-Memory Jobs & SSE ---")
    job = job_store.create_job(persona="technical", model="gemini-3.8-flash-medium", title="Test Job")
    assert job.status == "queued"
    assert job.progress == 0

    updated = job_store.update_job(
        job.job_id,
        status="transcribing",
        progress=45,
        message="Transcribing segment 2...",
        transcript="Test transcript content",
    )
    assert updated.status == "transcribing"
    assert updated.progress == 45
    assert updated.transcript == "Test transcript content"

    fetched = job_store.get_job(job.job_id)
    assert fetched is not None
    assert fetched.progress == 45

    # Test SSE stream generator
    async def sse_test():
        events = []
        gen = stream_job_events(job.job_id)
        # First event is immediate snapshot
        first_evt = await gen.asend(None)
        events.append(first_evt)
        # Update job to completed
        job_store.update_job(job.job_id, status="completed", progress=100, message="Done")
        second_evt = await gen.asend(None)
        events.append(second_evt)
        return events

    evts = asyncio.run(sse_test())
    assert len(evts) >= 2, f"Expected at least 2 SSE events, got {len(evts)}"
    assert "data: " in evts[0]
    print(f"✓ Job store and SSE streaming verified successfully.")


def test_api_endpoints():
    """Verify all FastAPI HTTP routes with TestClient."""
    print("\n--- [6/6] Testing FastAPI HTTP Endpoints ---")
    from unittest.mock import patch

    async def mock_run_audio_pipeline(job_id, audio_path, persona_id, model_id, title, attendees, custom_instructions, is_temp_file=False):
        job_store.update_job(
            job_id,
            status="completed",
            progress=100,
            message="Processed successfully",
            minutes="# Mock Minutes\n\nExecutive briefing content.",
            transcript="Mock transcript",
            segments=[{"start": 0.0, "end": 1.0, "text": "Mock"}],
        )

    async def mock_run_minutes_synthesis_only(job_id, transcript, persona_id, model_id, title, attendees, custom_instructions):
        job_store.update_job(
            job_id,
            status="completed",
            progress=100,
            message="Synthesized successfully",
            minutes="# Regenerated Minutes\n\nAction items recorded.",
            persona=persona_id,
            model=model_id,
        )

    with patch("backend.main.run_audio_pipeline", side_effect=mock_run_audio_pipeline), \
         patch("backend.main.run_minutes_synthesis_only", side_effect=mock_run_minutes_synthesis_only), \
         TestClient(app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        data = res.json()
        assert data.get("agy_ready") is True
        print("  ✓ GET /api/health passed")

        # 2. Personas list
        res = client.get("/api/personas")
        assert res.status_code == 200
        personas = res.json()
        assert len(personas) >= 6
        assert any(p["id"] == "executive" for p in personas)
        assert any(p["id"] == "technical" for p in personas)
        print(f"  ✓ GET /api/personas returned {len(personas)} personas")

        # 3. Models list
        res = client.get("/api/models")
        assert res.status_code == 200
        models = res.json()
        assert len(models) >= 3
        assert any(m["id"] == "gemini-3.8-flash-medium" for m in models)
        print(f"  ✓ GET /api/models returned {len(models)} models")

        # 4. Sample audio endpoint
        res = client.get("/api/sample-audio")
        assert res.status_code == 200
        assert res.headers.get("content-type") == "audio/mpeg"
        assert len(res.content) > 10000
        print(f"  ✓ GET /api/sample-audio returned {len(res.content)} bytes")

        # 5. Sample job creation
        sample_payload = {
            "persona": "action_oriented",
            "model": "gemini-3.8-flash-medium",
            "title": "Automated Test Meeting",
            "attendees": "Alice, Bob, Charlie",
        }
        res = client.post("/api/sample-job", json=sample_payload)
        assert res.status_code == 202, f"Sample job failed: {res.text}"
        job_data = res.json()
        job_id = job_data["job_id"]
        assert job_id, "Missing job_id in sample-job response"
        print(f"  ✓ POST /api/sample-job created job {job_id}")

        # 6. Job status check
        res = client.get(f"/api/jobs/{job_id}")
        assert res.status_code == 200
        fetched_job = res.json()
        assert fetched_job["job_id"] == job_id
        print(f"  ✓ GET /api/jobs/{job_id} returned status: {fetched_job['status']}")

        # 7. Generate minutes directly from transcript
        gen_payload = {
            "transcript": "Project Manager: Sprint 42 is on track. John finished the login API. Mary will finish frontend by Friday.",
            "persona": "action_oriented",
            "model": "gemini-3.8-flash-medium",
            "title": "Sprint 42 Sync",
        }
        res = client.post("/api/generate-minutes", json=gen_payload)
        assert res.status_code == 200, f"Generate minutes failed: {res.text}"
        gen_job = res.json()
        assert gen_job["job_id"]
        print(f"  ✓ POST /api/generate-minutes initiated job {gen_job['job_id']}")

        # 8. Export endpoint (Markdown)
        export_md = client.post(
            "/api/export",
            json={
                "minutes": "# Sprint Review\n\n- Task 1 completed\n- Task 2 in progress",
                "format": "markdown",
                "title": "Sprint Review",
            },
        )
        assert export_md.status_code == 200
        assert export_md.json()["format"] == "markdown"
        assert "# Sprint Review" in export_md.json()["content"]
        print("  ✓ POST /api/export (markdown) passed")

        # 9. Export endpoint (HTML)
        export_html = client.post(
            "/api/export",
            json={
                "minutes": "# Executive Brief\n\n> Strategic alignment achieved.",
                "format": "html",
                "title": "Executive Brief",
            },
        )
        assert export_html.status_code == 200
        assert export_html.json()["format"] == "html"
        assert "<html" in export_html.json()["content"]
        assert "Executive Brief" in export_html.json()["content"]
        print("  ✓ POST /api/export (html) passed")

        # 10. File upload endpoint
        sample_path = ensure_sample_audio_exists()
        with open(sample_path, "rb") as f:
            upload_res = client.post(
                "/api/upload",
                files={"file": ("test_upload.mp3", f, "audio/mpeg")},
                data={
                    "persona": "technical",
                    "model": "gemini-3.8-flash-medium",
                    "title": "Upload Test Audio",
                },
            )
        assert upload_res.status_code == 202, f"Upload failed: {upload_res.text}"
        upload_job = upload_res.json()
        assert upload_job["job_id"]
        print(f"  ✓ POST /api/upload created job {upload_job['job_id']}")

        # 11. Frontend static mount check
        res = client.get("/")
        assert res.status_code == 200
        assert "html" in res.headers.get("content-type", "").lower()
        assert "MinuteAI" in res.text or "Meeting Minutes" in res.text
        print("  ✓ GET / correctly serves frontend HTML")


def run_all_tests():
    """Run the entire test suite and print a clean summary."""
    print("=" * 60)
    print("   MEETING MINUTES AI — BACKEND TEST SUITE")
    print("=" * 60)

    t_start = time.time()

    test_personas()
    test_sample_audio_generation()
    test_generate_minutes_from_audio()
    test_agy_agent()
    test_jobs_and_sse()
    test_api_endpoints()

    total_time = time.time() - t_start
    print("\n" + "=" * 60)
    print(f"   ALL TESTS PASSED! Total elapsed time: {total_time:.1f}s")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
