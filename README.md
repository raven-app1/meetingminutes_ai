# 🎙️ အစည်းအဝေး မှတ်တမ်း AI (Burmese Meeting Minutes AI)

> **Pure Client-Side Web Application (No Backend Required)**  
> Transcribe and generate professional meeting minutes from Burmese (Myanmar) audio recordings using **Google Gemini AI** and **Antigravity Subscription** workflows.

---

## 🌟 Key Features (အဓိက ပါဝင်သော လုပ်ဆောင်ချက်များ)

1. **100% Backendless (Browser-Only & Private)**:
   - Runs entirely in your web browser. No external backend server or database is required.
   - All audio processing, transcript editing, and document exports occur locally on your machine.
   - Meeting history is securely stored in your browser's IndexedDB / LocalStorage.

2. **Zero-API-Key / Antigravity Subscription Workflow (API Key မလိုဘဲ သုံးနိုင်သောစနစ်)**:
   - **Gemini Web / Antigravity Workflow**: For Antigravity and Gemini Advanced subscription holders. Generates optimized Burmese prompt packages with 1-click copy, instructions to upload audio directly to Gemini Web, and instant formatting upon pasting back.
   - **Local Antigravity CLI Bridge (`bridge.py`)**: Connects the browser to your locally authenticated `agy` CLI (Antigravity subscription), so minutes can be generated straight from the app without an API key. Transcripts work everywhere; browser audio is offered to the CLI as a local temp file (if your CLI build cannot decode audio, use the Gemini Web workflow).

3. **Free Google AI Studio Direct Integration**:
   - Option to use a free Google AI Studio API Key (Flash 2.5 / 1.5).
   - Direct audio analysis using Gemini's native multimodal audio understanding for spoken Burmese.

4. **Specialized Burmese Audio & Code-Switching Prompt Engineering**:
   - Understands Burmese speech nuances, business terminology, and natural Code-Switching (Burmese + English technical/management terms such as *Server, Budget, KPI, Deadline, Client, Sprint, Feedback*).
   - Output language options:
     - 🇲🇲 **Bilingual (မြန်မာ + English)**: Burmese minutes with standard English business/technical terms.
     - 🇲🇲 **Pure Burmese (မြန်မာဘာသာ သီးသန့်)**: Formal Myanmar Unicode minutes.
     - 🇬🇧 **English Translation**: Translates Burmese discussions into corporate English minutes.

5. **6 Versatile Meeting Minutes Modes (မှတ်တမ်း ပုံစံ ၆ မျိုး)**:
   - 📌 **Executive Summary (အကျဉ်းချုပ် အစီရင်ခံစာ)**: 2-3 paragraph brief, core milestones, and critical decisions.
   - 📝 **Detailed Minutes (အသေးစိတ် မှတ်တမ်း)**: Chronological topic-by-topic deliberations, speakers, and consensus.
   - ✅ **Action Items & Decisions (လုပ်ဆောင်ရန်နှင့် ဆုံးဖြတ်ချက်များ)**: Interactive task table with Owner (တာဝန်ခံ), Due Date (သတ်မှတ်ရက်), and Priority.
   - 🗣️ **Discussion & Q&A (ဆွေးနွေးချက်များနှင့် အမေးအဖြေ)**: Key questions asked, answers given, and unresolved items.
   - 📋 **Formal Corporate Minutes (တရားဝင် ရုံးသုံး ပုံစံ)**: Official template with organization header, attendees list, apologies, agenda, and sign-off blocks.
   - 📜 **Cleaned Transcript (သန့်စင်ပြီး စာသား အပြည့်အစုံ)**: Verbatim cleaned text with speaker attribution and timestamps.
   - ✍️ **Custom Instructions**: Add specific focus areas (e.g. *"Focus especially on the cloud server budget"*).

6. **Audio Player & Live Recorder**:
   - Supports: `.mp3`, `.m4a`, `.wav`, `.aac`, `.ogg`, `.webm`, `.flac`.
   - Audio player with seek scrubber, playback speed (0.75x, 1x, 1.25x, 1.5x, 2x), and waveform visualization.
   - Live microphone recorder with real-time audio visualizer and timer.
   - Built-in synthetic demo audio and sample Myanmar management meeting transcript for immediate 1-click testing.

7. **Interactive Action Items Checklist**:
   - Extracted tasks are automatically rendered as an interactive checklist with checkboxes and completion counters.

8. **Rich Export Formats**:
   - 📄 **Microsoft Word (`.doc`)**: Pre-styled with Myanmar Unicode fonts and tables.
   - 📑 **Markdown (`.md`)**: Clean GitHub-flavored markdown.
   - 📝 **Plain Text (`.txt`)**: Formatted plain text.
   - 🖨️ **PDF / Print**: Dedicated print stylesheet formatted for formal paper/PDF output.
   - 📋 **Copy to Clipboard**: Rich text and plain text clipboard copy.

9. **Bilingual UI (မြန်မာစာ / English)**:
   - Instant language switcher in the header between Burmese Unicode and English.

---
## ☁️ Hosting on Netlify (Zero Local Dependencies)

This web application is **100% pure client-side** (static HTML/CSS/JS). When hosted on Netlify, it runs **completely without backend servers or local Python dependencies** (`server.py` and `bridge.py` are NOT needed).

### Deployment Option 1: Netlify Drag-and-Drop (Netlify Drop)
1. Go to **[https://app.netlify.com/drop](https://app.netlify.com/drop)** in your browser.
2. Drag and drop this entire project folder (`/root/meetingminutes`) onto the Netlify upload area.
3. Your web app will be live globally in seconds with free SSL (`https://<your-site>.netlify.app`).

### Deployment Option 2: Git Repository Deployment
1. Push this directory to your GitHub / GitLab repository.
2. Log in to [Netlify](https://app.netlify.com), click **Add new site** > **Import an existing project**.
3. Select your repository.
4. Netlify will automatically detect `netlify.toml`:
   - **Publish directory**: `.`
   - **Build command**: `npm run build` (or leave empty)
5. Click **Deploy Site**.

### Zero-Dependency Operation on Netlify:
- **Automatic HTTPS / Remote Host Detection**: The application automatically detects that it is running on a remote HTTPS cloud domain (`*.netlify.app`). It skips connecting to `http://localhost:3001` to eliminate any Mixed Content browser warnings or timeouts.
- **Option A - Gemini Web Workflow (Zero API Key / Antigravity Subscription)**:
  1. Select your meeting audio/notes and AI format mode in the web app.
  2. Click **"အစည်းအဝေး မှတ်တမ်း ထုတ်ယူမည် ✦"** or **"Gemini Web Prompt ကူးယူမည်"** (copies optimized Burmese prompt bundle).
  3. Upload your audio to [gemini.google.com](https://gemini.google.com) with your Antigravity / Gemini Advanced account.
  4. Copy Gemini's output and click the app's **"📋 Gemini ရလဒ် ထည့်မည်" (Paste Result)** button to render rich minutes, interactive task checklists, Word `.doc`, and PDF!
- **Option B - Free Google AI Studio API Key**:
  1. Paste a free key from [Google AI Studio](https://aistudio.google.com/app/apikey) directly into the app.
  2. The browser makes direct client-side HTTPS calls to Gemini 2.5 Flash / 1.5 Flash.
  3. The key is securely saved in your browser's `localStorage` and never leaves your device.

---

## 🚀 Local Development (Localhost)

If you prefer to run locally on your computer:

### Option 1: Quick Start with Python
```bash
python3 server.py
```
Open **http://localhost:3000** in your browser.

### Option 2: Run via npm
```bash
npm start
```

### Option 3: Direct File Open
You can also open `index.html` directly in any modern web browser (Chrome, Edge, Firefox, Safari).

### 🔑 Use your Antigravity subscription (no Gemini API key)

There are two zero-API-key paths in this app. **Neither one requires a Gemini API key.**

#### Path A — Gemini Web workflow (works everywhere, including phones)
1. In the app pick your mode/language, then press **🌐 Gemini Web** (or *Copy Prompt Bundle*).
2. Open <https://gemini.google.com> in another tab and attach your meeting recording.
3. Paste the copied prompt, send it, then paste Gemini's answer back into the app
   (**📋 Gemini ရလဒ် ထည့်မည်**) to get formatted minutes, Word/PDF export and the action-item checklist.

This is the only path that feeds **audio** to your subscription, because Gemini Web accepts audio uploads.

#### Path B — Local Antigravity CLI bridge (`bridge.py`)
Runs your locally signed-in `agy` CLI behind `http://localhost:3001`, so the app can generate
minutes with your subscription directly (best for transcripts and text notes).

```bash
# 1. Install the Antigravity CLI (macOS / Linux / Googlebook)
curl -fsSL https://antigravity.google/cli/install.sh | bash

# 2. Sign in once, interactively — headless runs reuse these cached credentials
agy

# 3. Check the setup, then start the bridge
python3 bridge.py --check     # binary path, version, sign-in test
python3 bridge.py             # serves http://localhost:3001
```

The app is served on `localhost:3000` (`python3 server.py` / `npm start`), where it discovers the
bridge automatically and shows **Connected (Active)** in *Antigravity / Zero Key → Method 2*.
Press **⚡ Local Bridge** to generate. Invalid URL or missing CLI? The app tells you exactly which
command to run.

| Symptom | Meaning | Fix |
| --- | --- | --- |
| Badge shows **Disconnected (Offline)** | `bridge.py` is not running | Start it: `python3 bridge.py` |
| Error mentions *not found* | `agy` is not installed | Run the install script above |
| Error mentions *Authentication required* | The CLI has no cached sign-in | Run `agy` once and sign in with your subscription |
| Error mentions the audio file | Your CLI build cannot decode audio | Use Path A (Gemini Web) for that recording |

Notes: audio selected in the browser is written to a private temp folder that the CLI can read as a
local file (removed automatically after each run); on HTTPS deployments such as Netlify the local
bridge is disabled by the browser's mixed-content rules, so use Path A there. Environment overrides:
`AGY_BIN`, `BRIDGE_PORT` (default `3001`), `BRIDGE_TIMEOUT` (default `600`), `BRIDGE_EFFORT`,
`BRIDGE_MODEL`, `BRIDGE_PERMISSIVE=0`.

---

## 🧪 Running Automated Tests

Run the complete test suite with:
```bash
npm test
```
or:
```bash
node --test tests/run_all.js
```

All 63 unit and integration tests verify:
- Netlify configuration (`netlify.toml`), SPA redirects, and security headers
- `_redirects` and `_headers` compatibility for Netlify Drop
- Remote host and HTTPS detection (preventing mixed content requests)
- AI modes and Burmese prompt engineering
- Bilingual i18n dictionary completeness (မြန်မာ & English parity)
- Markdown to HTML parsing and Myanmar table rendering
- Interactive Action Items checklist extraction and assignee/deadline parsing
- Gemini API payload construction and MIME normalization
- StorageManager persistence with IndexedDB and fallback
- Antigravity prompt bundle generation and Gemini Web workflows
- Audio engine time, byte formatting, and synthetic audio generation
- XSS prevention and script tag sanitization

---

## 📁 Project Structure

```
/root/meetingminutes/
├── netlify.toml             # Netlify deployment configuration, redirects, and headers
├── _redirects               # Netlify Drop SPA routing rules
├── _headers                 # Netlify Drop security and UTF-8 charset headers
├── index.html               # Main application interface & Quick Paste modal
├── css/
│   └── styles.css           # Styling, Myanmar typography, modals, and print stylesheet
├── js/
│   ├── app.js               # Application coordinator, Netlify cloud mode, and UI controller
│   ├── audio.js             # Web Audio API engine, player, recorder, waveform
│   ├── gemini.js            # Client-side Google Gemini Flash API client
│   ├── modes.js             # 6 AI modes and Burmese prompt engineering
│   ├── i18n.js              # Bilingual translations dictionary (မြန်မာ / English)
│   ├── storage.js           # IndexedDB & LocalStorage history manager
│   ├── exporter.js          # Word, Markdown, Text, PDF, and clipboard exporter
│   ├── antigravity.js       # Antigravity subscription, remote detection, and CLI helper
│   └── sample-data.js       # Sample Burmese meeting dataset & audio synth
├── tests/
│   ├── run_all.js           # Test suite runner
│   ├── test_netlify_and_remote.js # Netlify config & remote host tests
│   ├── test_modes.js        # AI modes tests
│   ├── test_i18n.js         # Translation tests
│   ├── test_exporter.js     # Exporter & parser tests
│   ├── test_gemini.js       # Gemini API client tests
│   ├── test_storage.js      # History storage tests
│   ├── test_antigravity.js  # Antigravity helper tests
│   └── test_audio_and_edge_cases.js # Audio & edge cases tests
├── bridge.py                # Optional local Antigravity CLI bridge server (for localhost only)
├── server.py                # Lightweight Python HTTP static server (for localhost only)
├── package.json             # NPM scripts (build, test, start) and metadata
└── README.md                # Documentation (English & Burmese)
```
