/**
 * Antigravity Subscription & Gemini Web Helper
 * Supports zero-API-key operation:
 * 1. Generating optimized prompts to use with Gemini Web (gemini.google.com)
 * 2. Pure static client-side operation when deployed to Netlify / Cloud (Zero Local Dependency)
 * 3. Connecting to optional local Antigravity CLI bridge (`python3 bridge.py`) when running on localhost
 */

const LOCAL_BRIDGE_URL = 'http://localhost:3001';

class AntigravityHelper {
  constructor(options = {}) {
    this.bridgeAvailable = false;
    this.bridgeUrl = options.bridgeUrl || LOCAL_BRIDGE_URL;
    this._forceRemote = typeof options.forceRemote === 'boolean' ? options.forceRemote : null;
  }

  /**
   * Checks whether the application is running on a remote cloud host (e.g. Netlify)
   * or over HTTPS, where local HTTP bridge (http://localhost:3001) is either
   * blocked by browser Mixed Content security policy or non-existent.
   */
  isRemoteOrHttps() {
    if (this._forceRemote !== null) {
      return this._forceRemote;
    }

    if (typeof window === 'undefined' || !window.location) {
      return false; // In Node.js testing environment
    }

    const { protocol, hostname } = window.location;

    // HTTPS pages block insecure HTTP requests (Mixed Content)
    if (protocol === 'https:') {
      return true;
    }

    // Remote hosts (e.g. *.netlify.app, custom domains)
    const isLocalhost =
      protocol === 'file:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local');

    return !isLocalhost;
  }

  /**
   * Returns diagnostic info about current deployment environment.
   */
  getDeploymentInfo() {
    const isRemote = this.isRemoteOrHttps();
    const loc = typeof window !== 'undefined' && window.location ? window.location : null;

    return {
      isRemote: isRemote,
      isHttps: loc ? loc.protocol === 'https:' : false,
      hostname: loc ? loc.hostname : 'localhost',
      protocol: loc ? loc.protocol : 'http:',
      zeroDependencyMode: isRemote,
      recommendedMode: isRemote ? 'gemini_web_or_api' : 'bridge_or_web'
    };
  }

  /**
   * Checks if local Antigravity CLI bridge is running.
   * On remote / HTTPS hosts (like Netlify), automatically skips network check
   * to eliminate Mixed Content console errors and latency.
   */
  async checkBridgeHealth(options = {}) {
    const forceCheck = options && options.force === true;

    // Skip checking local bridge when on remote host or HTTPS to prevent mixed content
    if (!forceCheck && this.isRemoteOrHttps()) {
      this.bridgeAvailable = false;
      return {
        available: false,
        authenticated: false,
        isRemote: true,
        reason: 'remote_or_https'
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${this.bridgeUrl}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.bridgeAvailable = !!data.authenticated;
        return {
          available: true,
          authenticated: !!data.authenticated,
          agent: data.agent || data.cli || 'agy',
          cli: data.cli || data.agent || null,
          version: data.version || null,
          hints: data.hints || [],
          isRemote: false
        };
      }
    } catch (e) {
      // Bridge offline or not running
    }

    this.bridgeAvailable = false;
    return {
      available: false,
      authenticated: false,
      isRemote: false
    };
  }

  /**
   * Generates a copy-paste ready prompt tailored for Gemini Web (gemini.google.com)
   * where users with Antigravity / Gemini Advanced subscriptions can upload their audio file directly!
   */
  buildGeminiWebBundle(options = {}) {
    let prompt = typeof buildGeminiPrompt === 'function'
      ? buildGeminiPrompt(options)
      : "Please transcribe and generate meeting minutes from this Burmese audio recording.";

    if (options.transcriptText && options.transcriptText.trim()) {
      prompt = `MEETING TRANSCRIPT / SPOKEN NOTES:\n${options.transcriptText.trim()}\n\n${prompt}`;
    }

    const hasAudio = options.isAudioInput !== false && !options.transcriptText;
    const isBurmese = options.uiLang === 'my';

    let headerBlock = "";
    if (isBurmese) {
      const stepAttach = hasAudio
        ? "၂။ Chat box ရှိ '+' (Paperclip) ခလုတ်ကို နှိပ်ပြီး သင့် အစည်းအဝေး အသံဖိုင်ကို တင်ပါ (Upload Audio)။\n၃။ အောက်ပါ Prompt ကို Paste လုပ်ပြီး Enter နှိပ်ပါ။"
        : "၂။ အောက်ပါ Prompt နှင့် အစည်းအဝေး အချက်အလက်များကို Chat box တွင် Paste လုပ်ပြီး Enter နှိပ်ပါ။";

      headerBlock = `================================================================================
📌 GEMINI ADVANCED / ANTIGRAVITY SUBSCRIPTION လမ်းညွှန် (INSTRUCTIONS):
================================================================================
၁။ Browser တွင် https://gemini.google.com ကို ဖွင့်ပါ။ (Open https://gemini.google.com)
${stepAttach}
၄။ Gemini မှ အဖြေထွက်လာပါက Copy ကူးယူပြီး ဤ App ၏ "Gemini ရလဒ် ထည့်မည် (Paste Result)"
   ထဲသို့ ပြန်လည် Paste လုပ်ပါက Word (.doc), PDF နှင့် Interactive Action Items များကို ရရှိပါမည်!
================================================================================`;
    } else {
      const stepAttach = hasAudio
        ? "2. In the chat box, click the '+' or paperclip icon and attach your meeting audio file.\n3. Paste the prompt below and press Enter."
        : "2. Paste the prompt and meeting text below into the chat box and press Enter.";

      headerBlock = `================================================================================
📌 INSTRUCTIONS FOR GEMINI ADVANCED / ANTIGRAVITY SUBSCRIPTION USERS:
================================================================================
1. Open https://gemini.google.com in your browser.
${stepAttach}
4. Once Gemini responds, copy the text and paste it into this app's "Paste Result" box
   to get interactive Action Items, Word .doc download, and PDF printing!
================================================================================`;
    }

    const instructions = `${headerBlock}\n\n${prompt}`;

    return {
      promptOnly: prompt,
      fullBundle: instructions
    };
  }

  /**
   * Builds the payload for the local bridge.
   *
   * Audio picked in the browser is sent as base64 so the bridge can hand the
   * recording to the CLI as a real file (the CLI cannot read browser blobs).
   *
   * @param {Object} options
   * @param {string} options.prompt - Crafted prompt text
   * @param {Blob|File} [options.audioBlob] - Meeting recording
   * @param {string} [options.audioName] - Original file name
   * @param {string} [options.audioBase64] - Pre-encoded audio
   * @param {string} [options.audioMimeType] - MIME type of the audio
   * @param {string} [options.effort] - Optional CLI reasoning effort
   * @returns {Promise<Object>} Bridge request payload
   */
  async buildCliPayload(options = {}) {
    const payload = { prompt: options.prompt || '' };
    if (options.effort) {
      payload.effort = options.effort;
    }

    let base64 = options.audioBase64;
    if (!base64 && options.audioBlob && typeof fileToBase64 === 'function') {
      base64 = await fileToBase64(options.audioBlob);
    }

    if (base64) {
      payload.audio = {
        base64: base64,
        mimeType: options.audioMimeType || (options.audioBlob && options.audioBlob.type) || 'audio/mp3',
        fileName: options.audioName || (options.audioBlob && options.audioBlob.name) || 'meeting-recording.mp3'
      };
    }

    return payload;
  }

  /**
   * Runs a tiny live check of the local bridge (verifies the CLI is signed in).
   */
  async verifyBridge() {
    if (this.isRemoteOrHttps()) {
      return { available: false, authenticated: false, reason: 'remote_or_https' };
    }

    try {
      const res = await fetch(`${this.bridgeUrl}/api/health?verify=1`);
      if (res.ok) {
        const data = await res.json();
        return {
          available: true,
          authenticated: !!data.authenticated,
          detail: data.verifyDetail || '',
          hints: data.hints || []
        };
      }
    } catch (e) {
      // bridge offline
    }

    return { available: false, authenticated: false, detail: 'Local bridge is not running.' };
  }

  /**
   * Calls the local Antigravity CLI bridge to execute `agy -p` directly.
   */
  async executeViaLocalBridge(payload) {
    if (this.isRemoteOrHttps()) {
      throw new Error(
        "Local Antigravity CLI Bridge is not available on remote/HTTPS deployments (such as Netlify). " +
        "Please use the zero-dependency Gemini Web workflow (Antigravity subscription) or direct Google AI Studio Free API Key."
      );
    }

    const res = await fetch(`${this.bridgeUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bridge execution failed' }));
      throw new Error(err.error || `CLI Bridge error: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.result;
  }
}

// Export for both Browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AntigravityHelper, LOCAL_BRIDGE_URL };
}
