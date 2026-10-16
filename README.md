# MinuteAI

MinuteAI is a self-hosted meeting minutes web application that ingests meeting audio recordings and synthesizes structured executive minutes directly using the **`agy`** agent CLI's multimodal capabilities (Gemini & Claude models).

---

## Features

- **Multimodal Audio Ingestion**: Ingests `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.webm`, `.aac` directly through `agy` CLI's `view_file` tool without requiring Whisper or external transcription engines. Includes an automatic compression fallback (>3 MB audio downsampled to 16 kHz mono 32 kbps via `ffmpeg`).
- **4-Step "No-Scroll" Wizard UI**: Clean step-by-step progress layout (Audio Input $\rightarrow$ Persona & Settings $\rightarrow$ Live Processing $\rightarrow$ Results Workspace).
- **Dual-Language Meeting Minutes**: Generates separate, pure English and pure Burmese (မြန်မာဘာသာ) meeting minutes along with a spoken transcript under dedicated tabs.
- **Bilingual Interface**: Native Burmese UI by default with instant toggle to English. Uses Noto Sans Myanmar and Padauk typography.
- **6 Business Personas**:
  - `executive`: Executive Briefing & Strategic Decisions
  - `formal`: Formal Corporate / Board Governance Minutes
  - `action_oriented`: Action-Oriented / PM Matrix
  - `technical`: Technical & Engineering Deep-Dive
  - `brainstorming`: Brainstorming & Strategy Workshop
  - `client_stakeholder`: Client & Partner Review
- **Local Storage Meeting History**: Automatically saves meetings locally in the browser with inline title renaming, date picker (defaults to today), and a slide-out drawer to reload or delete past meetings.
- **Real-Time Sync & Mobile Resilience**: Dual-channel SSE stream and concurrent polling heartbeat with Page Lifecycle recovery (`visibilitychange`, `pageshow`, `online`) and Screen WakeLock API support.

---

## Quick Start

### Prerequisites
- Python 3.10+
- `ffmpeg` installed
- `agy` CLI installed at `/root/.local/bin/agy` (or set via `AGY_PATH` environment variable)

### Installation & Run

```bash
# Start server using bash script
./run.sh

# Or start using python directly
python3 start.py
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## Project Structure

```text
├── backend/
│   ├── agent.py            # agy CLI runner & prompt builder
│   ├── jobs.py             # In-memory job state & SSE stream generator
│   ├── main.py             # FastAPI HTTP routes & static file server
│   ├── personas.py         # 6 business personas & bilingual prompts
│   ├── sample_generator.py # Sample multi-speaker audio & fallbacks
│   ├── test_backend.py     # Backend unit & integration test suite
│   └── uploads/            # Temporary upload workspace (git-ignored)
├── frontend/
│   ├── index.html          # Single-page application markup (native Burmese)
│   ├── styles.css          # Executive theme & responsive mobile styles
│   ├── app.js              # State machine, i18n, SSE & storage manager
│   └── vendor/             # Bundled dependencies (marked.min.js)
├── run.sh                  # Bash entry point
├── start.py                # Python entry point
├── test_mobile_responsive.py # Playwright mobile responsiveness test suite
└── test_light_theme.py     # Playwright theme toggle test suite
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status & `agy` availability |
| `GET` | `/api/personas` | Available meeting minutes personas |
| `GET` | `/api/models` | Supported `agy` model configurations |
| `GET` | `/api/sample-audio` | Serves pre-synthesized demo audio |
| `POST` | `/api/upload` | Upload meeting audio file (`multipart/form-data`) |
| `POST` | `/api/sample-job` | Launch job with pre-packaged sample meeting audio |
| `GET` | `/api/jobs/{id}` | Query current job status |
| `GET` | `/api/jobs/{id}/stream` | Server-Sent Events (SSE) live progress stream |
| `POST` | `/api/generate-minutes` | Regenerate minutes from transcript with new persona |
| `POST` | `/api/export` | Export minutes as `.md` or standalone `.html` |

---

## Testing

```bash
# Run backend test suite
python3 backend/test_backend.py

# Run mobile responsiveness tests (320px to 768px viewports)
python3 test_mobile_responsive.py

# Run theme verification tests
python3 test_light_theme.py
```
