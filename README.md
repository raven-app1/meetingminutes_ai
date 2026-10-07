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
   - **Local Antigravity CLI Bridge (`bridge.py`)**: Seamlessly connects the browser to your local authenticated `agy` CLI binary (`/root/.local/bin/agy`), piping prompts and audio through your Antigravity subscription without needing an API key.

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

## 🚀 How to Run (စတင် အသုံးပြုနည်း)

### Option 1: Quick Start with Python (Recommended)
```bash
cd /root/meetingminutes
python3 server.py
```
Open **http://localhost:3000** in your browser.

### Option 2: Run via npm
```bash
npm start
```

### Option 3: Direct File Open
You can also open `index.html` directly in any modern web browser (Chrome, Edge, Firefox, Safari).

---

## ⚡ Using with Antigravity Subscription (No API Key)

### Method A: Gemini Web Workflow (Browser-Only)
1. Open the app at `http://localhost:3000`.
2. Select your desired Meeting Title, Output Language, and AI Mode.
3. Switch to the **Antigravity / Gemini Guide** tab and click **"Copy Optimized Burmese Prompt 📋"**.
4. Open [Gemini Web](https://gemini.google.com) (where your Antigravity / Gemini Advanced subscription is active).
5. Drag and drop your audio file into Gemini, paste the copied prompt, and press Enter.
6. Copy Gemini's response and paste it into the **"Paste Generated Result Here"** box in the app.
7. Click **"Format Minutes & Save ✨"** to instantly get interactive action items, Word download, and PDF printing!

### Method B: Local Antigravity CLI Bridge (`bridge.py`)
If you have the Antigravity CLI (`agy`) installed:
```bash
python3 bridge.py
```
The web app will automatically detect the bridge on port 3001 and allow running directly through your authenticated Antigravity subscription.

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

All 26 unit and integration tests verify:
- AI modes and Burmese prompt generation
- Bilingual i18n dictionary completeness
- Markdown to HTML parsing and table rendering
- Myanmar substring collision handling in Action Items
- Gemini API payload construction and MIME normalization
- StorageManager persistence with IndexedDB and fallback
- Antigravity prompt bundle generation and bridge health checks
- Audio engine time and byte formatting
- XSS prevention and script tag sanitization

---

## 📁 Project Structure

```
/root/meetingminutes/
├── index.html               # Main application interface
├── css/
│   └── styles.css           # Styling, Myanmar fonts, and print stylesheet
├── js/
│   ├── app.js               # Application coordinator and UI controller
│   ├── audio.js             # Web Audio API engine, player, recorder, waveform
│   ├── gemini.js            # Client-side Google Gemini Flash API client
│   ├── modes.js             # 6 AI modes and Burmese prompt engineering
│   ├── i18n.js              # Bilingual translations dictionary (မြန်မာ / English)
│   ├── storage.js           # IndexedDB & LocalStorage history manager
│   ├── exporter.js          # Word, Markdown, Text, PDF, and clipboard exporter
│   ├── antigravity.js       # Antigravity subscription and CLI bridge helper
│   └── sample-data.js       # Sample Burmese meeting dataset & audio synth
├── tests/
│   ├── run_all.js           # Test suite runner
│   ├── test_modes.js        # AI modes tests
│   ├── test_i18n.js         # Translation tests
│   ├── test_exporter.js     # Exporter & parser tests
│   ├── test_gemini.js       # Gemini API client tests
│   ├── test_storage.js      # History storage tests
│   ├── test_antigravity.js  # Antigravity helper tests
│   └── test_audio_and_edge_cases.js # Audio & edge cases tests
├── bridge.py                # Optional local Antigravity CLI bridge server
├── server.py                # Lightweight Python HTTP static server
├── package.json             # NPM scripts and project metadata
└── README.md                # Documentation (English & Burmese)
```
