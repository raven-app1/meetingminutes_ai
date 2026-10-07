/**
 * Client-Side Google Gemini API Client
 * Directly sends audio files and prompts to Gemini Flash via browser fetch.
 * Zero backend server required - runs entirely in the browser.
 */

const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recommended)", audioReady: true },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", audioReady: true },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", audioReady: true },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Deep Reasoning)", audioReady: true }
];

/**
 * Normalizes audio MIME type for Gemini API.
 */
function normalizeAudioMimeType(mimeType, filename = "") {
  let mime = (mimeType || "").toLowerCase().trim();
  const ext = (filename || "").split('.').pop().toLowerCase();

  if (mime.includes('mp3') || ext === 'mp3') return 'audio/mp3';
  if (mime.includes('wav') || ext === 'wav') return 'audio/wav';
  if (mime.includes('m4a') || ext === 'm4a') return 'audio/mp4';
  if (mime.includes('mp4') || ext === 'mp4') return 'audio/mp4';
  if (mime.includes('aac') || ext === 'aac') return 'audio/aac';
  if (mime.includes('ogg') || ext === 'ogg') return 'audio/ogg';
  if (mime.includes('webm') || ext === 'webm') return 'audio/webm';
  if (mime.includes('flac') || ext === 'flac') return 'audio/flac';
  if (mime.includes('opus') || ext === 'opus') return 'audio/opus';

  return mime || 'audio/mp3';
}

/**
 * Converts a Blob / File to base64 string.
 */
function fileToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Calls Google Gemini API directly from the browser.
 *
 * @param {Object} options
 * @param {string} options.apiKey - Google AI Studio API key
 * @param {string} options.model - e.g. 'gemini-2.5-flash'
 * @param {string} options.prompt - Crafted prompt text
 * @param {Blob|File} [options.audioBlob] - Audio blob or file
 * @param {string} [options.audioBase64] - Pre-encoded audio base64
 * @param {string} [options.audioMimeType] - MIME type of audio
 * @param {string} [options.textInput] - If text transcript input instead of audio
 * @param {function} [options.onProgress] - Optional status progress callback
 * @returns {Promise<string>} Generated text
 */
async function generateWithGemini(options = {}) {
  const {
    apiKey,
    model = "gemini-2.5-flash",
    prompt,
    audioBlob,
    audioBase64,
    audioMimeType,
    textInput,
    onProgress
  } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("Missing Google AI Studio API Key. Please provide a key or use the Antigravity Subscription workflow.");
  }

  const cleanKey = apiKey.trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

  const parts = [];

  // Add audio if provided
  if (audioBlob || audioBase64) {
    if (onProgress) onProgress("Preparing audio data for Gemini...");
    let b64Data = audioBase64;
    let mime = audioMimeType || 'audio/mp3';

    if (audioBlob && !b64Data) {
      mime = normalizeAudioMimeType(audioBlob.type, audioBlob.name || "");
      b64Data = await fileToBase64(audioBlob);
    }

    parts.push({
      inlineData: {
        mimeType: mime,
        data: b64Data
      }
    });
  }

  // Add text input if provided
  if (textInput && textInput.trim()) {
    parts.push({
      text: `MEETING TRANSCRIPT / TEXT CONTENT:\n${textInput.trim()}`
    });
  }

  // Add main prompt
  parts.push({
    text: prompt
  });

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: parts
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      maxOutputTokens: 8192
    }
  };

  if (onProgress) onProgress("Connecting to Gemini AI and analyzing Burmese audio...");

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
  } catch (netErr) {
    throw new Error(`Network connection error: ${netErr.message}. Check your internet connection.`);
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = errJson.error ? errJson.error.message : JSON.stringify(errJson);
    } catch (e) {
      errorDetail = await response.text();
    }

    if (response.status === 400) {
      if (errorDetail.includes("inlineData") || errorDetail.includes("size")) {
        throw new Error(`File is too large for direct browser inline upload (> 20MB). Please use the "Antigravity / Gemini Web" tab to process long audio files with zero limits!`);
      }
      throw new Error(`Invalid request (400): ${errorDetail}`);
    } else if (response.status === 403 || response.status === 401) {
      throw new Error(`API Key error (${response.status}): Your Google AI Studio API key appears to be invalid or unauthorized. Please verify your key.`);
    } else if (response.status === 429) {
      throw new Error(`Rate limit reached (429): Google AI Studio quota exceeded for this minute. Please wait 15-30 seconds and try again, or use the Antigravity Subscription mode.`);
    } else {
      throw new Error(`Gemini API error (${response.status}): ${errorDetail}`);
    }
  }

  const resultData = await response.json();

  if (
    !resultData.candidates ||
    !resultData.candidates[0] ||
    !resultData.candidates[0].content ||
    !resultData.candidates[0].content.parts ||
    !resultData.candidates[0].content.parts[0]
  ) {
    if (resultData.promptFeedback && resultData.promptFeedback.blockReason) {
      throw new Error(`Content blocked by safety filters: ${resultData.promptFeedback.blockReason}`);
    }
    throw new Error("Gemini returned an empty response. Please try again with a different mode or audio segment.");
  }

  const generatedText = resultData.candidates[0].content.parts
    .map(p => p.text || '')
    .join('\n');

  return generatedText;
}

// Export for both Browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GEMINI_MODELS,
    normalizeAudioMimeType,
    generateWithGemini
  };
}
