/**
 * Antigravity Subscription & Gemini Web Helper
 * Supports zero-API-key operation:
 * 1. Generating optimized prompts to use with Gemini Web (gemini.google.com)
 * 2. Connecting to optional local Antigravity CLI bridge (`python3 bridge.py`)
 */

const LOCAL_BRIDGE_URL = 'http://localhost:3001';

class AntigravityHelper {
  constructor() {
    this.bridgeAvailable = false;
  }

  /**
   * Checks if local Antigravity CLI bridge is running.
   */
  async checkBridgeHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${LOCAL_BRIDGE_URL}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.bridgeAvailable = !!data.authenticated;
        return {
          available: true,
          authenticated: !!data.authenticated,
          agent: data.agent || 'agy'
        };
      }
    } catch (e) {
      // Bridge offline or not running
    }

    this.bridgeAvailable = false;
    return {
      available: false,
      authenticated: false
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
    const stepAttach = hasAudio
      ? "2. In the chat box, click the '+' or paperclip icon and attach your meeting audio file.\n3. Paste the prompt below and press Enter."
      : "2. Paste the prompt and meeting text below into the chat box and press Enter.";

    const instructions = `================================================================================
📌 INSTRUCTIONS FOR GEMINI ADVANCED / ANTIGRAVITY SUBSCRIPTION USERS:
================================================================================
1. Open https://gemini.google.com in your browser.
${stepAttach}
4. Once Gemini responds, copy the text and paste it into this app's "Paste Result" box
   to get interactive Action Items, Word .doc download, and PDF printing!
================================================================================

${prompt}`;

    return {
      promptOnly: prompt,
      fullBundle: instructions
    };
  }

  /**
   * Calls the local Antigravity CLI bridge to execute `agy -p` directly.
   */
  async executeViaLocalBridge(payload) {
    const res = await fetch(`${LOCAL_BRIDGE_URL}/api/process`, {
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
