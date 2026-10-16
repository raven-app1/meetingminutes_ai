# MinuteAI — Automated Meeting Minutes AI Web Application

MinuteAI is a full-stack, enterprise-grade meeting minutes web application that transforms audio recordings into structured, high-impact business minutes tailored to specific organizational personas. Users upload meeting audio recordings directly (or load the sample meeting demo), and agy multimodal AI processes the audio file directly without Whisper.

Powered by the **agy** agent CLI's multimodal capabilities (directly inspecting and listening to audio files using Gemini 3.8 Flash and Claude Sonnet models).

---

## 🌟 Key Features & Capabilities

- **Audio Ingestion & Sample Demo**:
  - Drag-and-drop or file browser supporting `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.webm`, `.aac`.
  - One-click **Interactive Sample Meeting** demo (`sample_meeting.mp3`) with pre-synthesized multi-speaker dialogue.
- **Multimodal AI Audio Processing & Synthesis**:
  - Ingests and analyzes meeting audio recordings directly via `agy` CLI's multimodal `view_file` capabilities without Whisper or separate speech-to-text pipelines.
  - Generates comprehensive meeting minutes and transcripts tailored to 6 organizational personas.
- **6 Rich Business Personas**:
  - Tailor output format, depth, and tone for different stakeholders with a single click.
- **Live Real-Time Streaming (SSE)**:
  - Real-time progress bar (0–100%) and stage notifications streamed directly to the frontend via Server-Sent Events (`/api/jobs/{id}/stream`) with automatic fallback to polling.
- **Interactive Results Workspace**:
  - Formatted Markdown viewer with table styling, callouts, and code blocks.
  - Inline live Markdown editor allowing manual edits and notes with instant re-rendering.
  - Synchronized transcript viewer with interactive audio seeking and text search.
  - One-click regeneration with a new persona without re-uploading audio.
  - Formatted export to **Markdown (`.md`)** and standalone styled **HTML / PDF print**.

---

## 👔 The 6 Business Personas

| Persona | ID | Icon | Tone & Structure | Best For |
|---|---|:---:|---|---|
| **Executive Briefing & Strategic Decisions** | `executive` | 👔 | Concise, high-impact, bottom-line financial impact, strategic decisions, risks, KPI table | C-Suite, VPs, Board Members |
| **Formal Corporate / Board Governance Minutes** | `formal` | ⚖️ | Parliamentary, formal call to order, quorum, agenda, resolutions, vote counts, adjournment | Board of Directors, Legal Counsel |
| **Action-Oriented / Project Manager** | `action_oriented` | 🚀 | Agile/scrum focus, comprehensive Action Item Matrix (Owner, Priority, Deadline, Status), Blockers | PMs, Scrum Masters, Engineering Leads |
| **Technical & Engineering Deep-Dive** | `technical` | ⚙️ | Architectural decisions (ADR format), trade-offs evaluated, schema changes, security & reliability | Software Engineers, Architects, SREs |
| **Brainstorming & Strategy Workshop** | `brainstorming` | 💡 | Thematic clusters, divergent ideas, pros/cons, wildcard concepts, rapid validation experiments | Product Designers, Founders, Strategy |
| **Client & Partner Review** | `client_stakeholder` | 🤝 | Transparent, customer-centric, commitments made, delivery timelines, feedback received | Clients, Account Execs, Customer Success |

---

## ⚙️ System Prerequisites

1. **Python 3.10+**
2. **ffmpeg** (`/bin/ffmpeg`) installed for audio normalization and playback.
3. **agy CLI** installed at `/root/.local/bin/agy` (or configured via `AGY_PATH` environment variable).
4. Supported AI models in `agy`:
   - `gemini-3.8-flash-medium` *(default, balanced & fast)*
   - `gemini-3.8-flash-high` *(deep reasoning for complex debates)*
   - `claude-sonnet-4-6` *(articulate, highly structured synthesis)*

---

## 🚀 Quick Start

### 1. Launch the Server

Run either launcher from the project root:

```bash
# Using the bash launcher
./run.sh

# Or using Python
python3 start.py
```

By default, the server starts on `http://localhost:8000`.

### 2. Open the Web Application

Visit **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 🖥️ Web UI Usage Guide

1. **Provide Audio**:
   - **Upload Tab**: Drag and drop any meeting audio recording or click to browse. Users upload meeting audio recordings directly, and agy multimodal AI processes the audio file directly without Whisper.
   - **Sample Meeting Tab**: Click **Load Sample Audio** to immediately load our multi-speaker product sync recording without needing your own audio file.
2. **Select Persona & Options**:
   - Click on one of the **6 Persona cards** (e.g. *Executive*, *Action-Oriented*, *Technical*).
   - *(Optional)* Expand **Advanced Options** to specify a custom meeting title, attendees, extra prompt instructions, or select a different LLM model.
3. **Generate Minutes**:
   - Click **Generate Minutes**.
   - Watch the 4-step stepper and real-time SSE progress bar track audio upload, transcription, and AI synthesis.
4. **Review & Export**:
   - Toggle between **Generated Minutes**, **Audio Player**, and **Timestamped Transcript**.
   - Click **Edit** to adjust notes in real-time.
   - Click **Download .md** or **Export HTML / Print PDF**.
   - Switch personas in the dropdown and click **Regenerate Minutes** to re-synthesize instantly.

---

## 📡 API Reference

All endpoints are hosted under `/api`.

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/api/health` | Service health status & engine readiness | None | `{ status, agy_ready, sample_audio_ready, ... }` |
| `GET` | `/api/personas` | List of all 6 available business personas | None | `[ { id, name, icon, description, tone, target_audience } ]` |
| `GET` | `/api/models` | List of available LLM models | None | `[ { id, name, description } ]` |
| `GET` | `/api/sample-audio` | Stream sample meeting audio file | None | `audio/mpeg` file stream |
| `POST` | `/api/upload` | Upload audio and start processing pipeline | `multipart/form-data`: `file`, `persona`, `model`, `title`, `attendees`, `custom_instructions` | `202 Accepted` `{ job_id, status, ... }` |
| `POST` | `/api/sample-job` | Start processing using built-in sample audio | `application/json`: `{ persona, model, title, attendees, custom_instructions }` | `202 Accepted` `{ job_id, status, ... }` |
| `GET` | `/api/jobs/{id}` | Query current job state | None | `{ job_id, status, progress, message, transcript, segments, minutes, ... }` |
| `GET` | `/api/jobs/{id}/stream` | Server-Sent Events (SSE) live progress stream | None | `text/event-stream` with live JSON snapshots |
| `POST` | `/api/generate-minutes` | Regenerate minutes from transcript with persona | `application/json`: `{ transcript, persona, model, title, attendees, custom_instructions, job_id }` | `{ job_id, status, ... }` |
| `POST` | `/api/export` | Export minutes formatted as Markdown or standalone HTML | `application/json`: `{ minutes, format: "markdown" \| "html", title }` | `{ content, format, filename, mime_type }` |

---

## 🧪 Testing

Run the automated backend test suite:

```bash
python3 backend/test_backend.py
```

This verifies:
1. All 6 business personas configuration and fallbacks.
2. Multi-speaker sample audio generation.
3. agy multimodal audio processing and minutes generation (`generate_minutes_from_audio`).
4. Live `agy` meeting minutes synthesis.
5. In-memory job store & SSE event stream pub/sub.
6. All FastAPI HTTP endpoints & static UI mount.
