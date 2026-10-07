/**
 * Audio Engine for Burmese Meeting Minutes AI
 * Handles audio playback, microphone recording, waveform visualization,
 * and client-side audio compression/resampling via Web Audio API.
 */

class AudioEngine {
  constructor() {
    this.audioElement = typeof Audio !== 'undefined' ? new Audio() : null;
    this.currentBlob = null;
    this.currentFile = null;
    this.audioUrl = null;
    this.audioContext = null;
    
    // MediaRecorder state
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStartTime = 0;
    this.recordingTimerId = null;
    this.isRecording = false;
    this.isPaused = false;
    this.stream = null;
    this.analyser = null;
    this.dataArray = null;
    this.visualizerAnimationId = null;

    // Callbacks
    this.onTimeUpdate = null;
    this.onLoadedMetadata = null;
    this.onEnded = null;
    this.onRecordingProgress = null;
    this.onError = null;
    this.onSpeechTranscript = null;
    this.recognition = null;

    if (this.audioElement) {
      this._initAudioEvents();
    }
  }

  _initAudioEvents() {
    this.audioElement.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate({
          currentTime: this.audioElement.currentTime,
          duration: this.audioElement.duration || 0,
          progress: (this.audioElement.currentTime / (this.audioElement.duration || 1)) * 100
        });
      }
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      if (this.onLoadedMetadata) {
        this.onLoadedMetadata({
          duration: this.audioElement.duration || 0
        });
      }
    });

    this.audioElement.addEventListener('ended', () => {
      if (this.onEnded) this.onEnded();
    });

    this.audioElement.addEventListener('error', (err) => {
      if (this.onError) this.onError(err);
    });
  }

  /**
   * Loads an audio File or Blob into the engine.
   */
  loadAudio(fileOrBlob) {
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
    }
    this.currentBlob = fileOrBlob;
    if (fileOrBlob instanceof File) {
      this.currentFile = fileOrBlob;
    } else {
      this.currentFile = new File([fileOrBlob], "recording.webm", { type: fileOrBlob.type || "audio/webm" });
    }

    this.audioUrl = URL.createObjectURL(fileOrBlob);
    this.audioElement.src = this.audioUrl;
    this.audioElement.playbackRate = 1.0;
    return {
      name: this.currentFile.name,
      size: this.currentFile.size,
      type: this.currentFile.type,
      sizeFormatted: this.formatBytes(this.currentFile.size)
    };
  }

  play() {
    return this.audioElement.play();
  }

  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  clearAudio() {
    this.pause();
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
    this.currentBlob = null;
    this.currentFile = null;
    if (this.audioElement) {
      this.audioElement.src = '';
    }
  }

  togglePlay() {
    if (this.audioElement.paused) {
      return this.play().then(() => true);
    } else {
      this.pause();
      return Promise.resolve(false);
    }
  }

  seek(seconds) {
    if (isFinite(seconds) && seconds >= 0) {
      this.audioElement.currentTime = seconds;
    }
  }

  seekToProgress(fraction) {
    if (this.audioElement.duration) {
      this.seek(fraction * this.audioElement.duration);
    }
  }

  setPlaybackRate(rate) {
    this.audioElement.playbackRate = rate;
  }

  getDuration() {
    return this.audioElement.duration || 0;
  }

  getCurrentTime() {
    return this.audioElement.currentTime || 0;
  }

  /**
   * Starts microphone recording.
   *
   * @param {HTMLCanvasElement} [canvas] - Optional canvas element to draw live waveform.
   */
  async startRecording(canvas = null) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone access is not supported by your browser.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    if (canvas) {
      this._setupLiveVisualizer(canvas);
    }

    this.mediaRecorder.start(250);
    this.isRecording = true;
    this.isPaused = false;
    this.recordingStartTime = Date.now();

    // Initialize Web Speech API for real-time Burmese dictation if supported
    const SpeechRecognitionClass = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (SpeechRecognitionClass) {
      try {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.lang = 'my-MM'; // Burmese
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        let finalTranscript = '';

        this.recognition.onresult = (event) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const fullText = (finalTranscript + interimTranscript).trim();
          if (this.onSpeechTranscript && fullText) {
            this.onSpeechTranscript(fullText);
          }
        };

        this.recognition.onerror = (e) => {
          console.warn('Speech recognition notice:', e.error);
        };

        this.recognition.start();
      } catch (speechErr) {
        console.warn('Could not start SpeechRecognition:', speechErr);
      }
    }

    this.recordingTimerId = setInterval(() => {
      if (this.onRecordingProgress && !this.isPaused) {
        const elapsedSec = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        this.onRecordingProgress({
          elapsedSeconds: elapsedSec,
          formattedTime: this.formatTime(elapsedSec)
        });
      }
    }, 500);

    return true;
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
    }
  }

  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return resolve(null);
      }

      this.mediaRecorder.onstop = () => {
        clearInterval(this.recordingTimerId);
        if (this.visualizerAnimationId) {
          cancelAnimationFrame(this.visualizerAnimationId);
        }
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.recognition) {
          try {
            this.recognition.stop();
          } catch (e) {}
          this.recognition = null;
        }

        const type = this.mediaRecorder.mimeType || 'audio/webm';
        const recordedBlob = new Blob(this.recordedChunks, { type });
        this.isRecording = false;
        this.isPaused = false;

        this.loadAudio(recordedBlob);
        resolve(recordedBlob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        reject(e);
      }
    });
  }

  _setupLiveVisualizer(canvas) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = new AudioContextClass();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      const ctx = canvas.getContext('2d');

      const draw = () => {
        if (!this.isRecording) return;
        this.visualizerAnimationId = requestAnimationFrame(draw);

        this.analyser.getByteFrequencyData(this.dataArray);
        ctx.fillStyle = '#0f172a'; // dark slate
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.2;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (this.dataArray[i] / 255) * canvas.height * 0.9;
          // Gradient emerald to cyan
          ctx.fillStyle = `rgb(${16 + barHeight * 0.5}, ${185 + barHeight * 0.2}, ${129})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.warn("Visualizer init error:", e);
    }
  }

  /**
   * Downsamples an audio buffer/file to 16kHz mono WAV for reduced size.
   */
  async compressTo16kHzWav(fileOrBlob) {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // Target sample rate: 16000Hz, 1 channel (mono)
    const targetSampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = this.audioBufferToWavBlob(renderedBuffer);
    return wavBlob;
  }

  audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels = [];
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function setUint16(data) {
      out.setUint16(pos, data, true);
      pos += 2;
    }
    function setUint32(data) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    // RIFF identifier
    out.setUint32(0, 0x46464952, true); // "RIFF"
    out.setUint32(4, length - 8, true);
    out.setUint32(8, 0x45564157, true); // "WAVE"
    out.setUint32(12, 0x20746d66, true); // "fmt "
    out.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    out.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    out.setUint16(22, numOfChan, true);
    out.setUint32(24, sampleRate, true);
    out.setUint32(28, sampleRate * 2 * numOfChan, true); // ByteRate
    out.setUint16(32, numOfChan * 2, true); // BlockAlign
    out.setUint16(34, 16, true); // BitsPerSample
    out.setUint32(36, 0x61746164, true); // "data"
    out.setUint32(40, length - pos - 4, true);

    pos = 44;
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (offset < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      const remMins = mins % 60;
      return `${hrs.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export for both Browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioEngine };
}
