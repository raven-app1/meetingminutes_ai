/**
 * MinuteAI — Executive Meeting Minutes Web Application
 * Audio to Strategic Minutes powered by agy AI
 */

(function () {
  'use strict';

  // =========================================================================
  // Safe Local Storage Helpers
  // =========================================================================
  function safeGetStorage(key, fallback = null) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeSetStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Silently ignore storage errors in restricted contexts
    }
  }

  function safeRemoveStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Silently ignore storage errors in restricted contexts
    }
  }

  // =========================================================================
  // Mobile Screen WakeLock Helpers (Prevents screen sleep during generation)
  // =========================================================================
  let wakeLock = null;
  async function requestWakeLock() {
    if ('wakeLock' in navigator && !wakeLock) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } catch (err) {
        // Silently ignore if not supported or denied by battery policy
      }
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }

  // =========================================================================
  // Global Application State
  // =========================================================================
  const state = {
    // Audio source
    audioSourceType: null, // 'upload' | 'demo'
    audioFile: null,       // File or Blob
    wizardStep: 1,         // Active wizard page (1, 2, 3, 4)
    maxAllowedStep: 1,     // Furthest step unlocked
    audioFileName: '',
    audioFileSize: 0,
    audioDuration: 0,
    audioObjectUrl: null,

    // Persona & Config
    selectedPersona: 'executive',
    selectedModel: 'gemini-3.8-flash-medium',
    meetingTitle: '',
    meetingDate: '',
    meetingAttendees: '',
    customInstructions: '',
    savedMeetings: [],
    activeMeetingId: null,
    // Language / i18n
    currentLang: 'my',


    // Job Processing
    activeJobId: null,
    jobStatus: null,
    jobProgress: 0,
    eventSource: null,
    pollIntervalId: null,
    timerIntervalId: null,
    startTime: null,

    // Results
    rawMinutesMarkdown: '',
    rawMinutesEn: '',
    rawMinutesMy: '',
    rawTranscriptText: '',
    transcriptSegments: [],
    jobData: null,
    isEditingMinutes: false,
    isJobFinished: false,
    completedJobId: null,
    finishJobExecuted: false,
    // System Health
    agyReady: false
  };

  // =========================================================================
  // DOM Elements Cache
  // =========================================================================
  const el = {
    // Theme
    // Language Switcher
    langToggleBtn: document.getElementById('lang-toggle-btn'),
    langFlag: document.getElementById('lang-flag'),
    langLabel: document.getElementById('lang-label'),

    themeToggleBtn: document.getElementById('theme-toggle-btn'),

    // Health
    statusAgy: document.getElementById('status-agy'),
    offlineAlert: document.getElementById('offline-alert'),
    alertRetryBtn: document.getElementById('alert-retry-btn'),

    // Tabs
    tabUpload: document.getElementById('tab-btn-upload'),
    tabDemo: document.getElementById('tab-btn-demo'),
    paneUpload: document.getElementById('tab-pane-upload'),
    paneDemo: document.getElementById('tab-pane-demo'),

    // Upload
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('audio-file-input'),

    // Demo
    btnLoadDemo: document.getElementById('btn-load-demo'),

    // Preview
    audioPreviewCard: document.getElementById('audio-preview-card'),
    previewFilename: document.getElementById('preview-filename'),
    previewFilesize: document.getElementById('preview-filesize'),
    previewDuration: document.getElementById('preview-duration'),
    previewBadge: document.getElementById('preview-badge'),
    audioElement: document.getElementById('audio-element'),
    btnRemoveAudio: document.getElementById('btn-remove-audio'),

    // Personas & Form
    personaGrid: document.getElementById('persona-grid'),
    accordionToggle: document.getElementById('accordion-toggle'),
    advancedPanel: document.getElementById('advanced-panel'),
    inputMeetingTitle: document.getElementById('input-meeting-title'),
    inputMeetingDate: document.getElementById('input-meeting-date'),
    labelMeetingDate: document.getElementById('label-meeting-date'),
    inputMeetingAttendees: document.getElementById('input-meeting-attendees'),
    inputCustomInstructions: document.getElementById('input-custom-instructions'),
    selectAiModel: document.getElementById('select-ai-model'),

    // Saved Meetings Drawer / Modal & Actions
    btnSavedMeetings: document.getElementById('btn-saved-meetings'),
    savedMeetingsBadge: document.getElementById('saved-meetings-badge'),
    savedMeetingsModal: document.getElementById('saved-meetings-modal'),
    savedMeetingsList: document.getElementById('saved-meetings-list'),
    savedModalTitle: document.getElementById('saved-modal-title'),
    savedModalHint: document.getElementById('saved-modal-hint'),
    btnCloseSavedModal: document.getElementById('btn-close-saved-modal'),
    btnClearAllSaved: document.getElementById('btn-clear-all-saved'),
    btnSaveMeeting: document.getElementById('btn-save-meeting'),
    btnSaveMeetingText: document.getElementById('btn-save-meeting-text'),
    btnRenameTitle: document.getElementById('btn-rename-title'),
    // Action Bar
    summaryAudioVal: document.getElementById('summary-audio-val'),
    summaryPersonaVal: document.getElementById('summary-persona-val'),
    btnGenerate: document.getElementById('btn-generate'),

    // Wizard Navigation & Pages
    wizardNavStepper: document.getElementById('wizard-nav-stepper'),
    wizardPages: [
      document.getElementById('wizard-page-1'),
      document.getElementById('wizard-page-2'),
      document.getElementById('wizard-page-3'),
      document.getElementById('wizard-page-4')
    ],
    wizardNodes: [
      document.getElementById('wizard-nav-step-1'),
      document.getElementById('wizard-nav-step-2'),
      document.getElementById('wizard-nav-step-3'),
      document.getElementById('wizard-nav-step-4')
    ],
    wizardLines: [
      document.getElementById('wizard-line-1'),
      document.getElementById('wizard-line-2'),
      document.getElementById('wizard-line-3')
    ],
    btnToStep2: document.getElementById('btn-to-step-2'),
    btnToStep1: document.getElementById('btn-to-step-1'),
    wizardAudioStatusVal: document.getElementById('wizard-audio-status-val'),
    wizardAudioStatusLabel: document.getElementById('wizard-audio-status-label'),

    // Workflow containers
    setupSection: document.getElementById('setup-section'),
    stepProgress: document.getElementById('step-progress'),
    resultsWorkspace: document.getElementById('results-workspace'),
    // Progress
    progressElapsed: document.getElementById('progress-elapsed'),
    progressJobId: document.getElementById('progress-job-id'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressMessage: document.getElementById('progress-message'),
    progressPercent: document.getElementById('progress-percent'),
    stepNode1: document.getElementById('step-node-1'),
    stepNode2: document.getElementById('step-node-2'),
    stepNode3: document.getElementById('step-node-3'),
    stepNode4: document.getElementById('step-node-4'),
    stepLine1: document.getElementById('step-line-1'),
    stepLine2: document.getElementById('step-line-2'),
    stepLine3: document.getElementById('step-line-3'),

    // Results Header
    resultsMeetingTitle: document.getElementById('results-meeting-title'),
    resultsPersonaBadge: document.getElementById('results-persona-badge'),
    resultsModelBadge: document.getElementById('results-model-badge'),
    resultsDateStamp: document.getElementById('results-date-stamp'),
    resultsAttendeesDisplay: document.getElementById('results-attendees-display'),
    resultsDurationDisplay: document.getElementById('results-duration-display'),
    regenPersonaSelect: document.getElementById('regen-persona-select'),
    btnRegenPersona: document.getElementById('btn-regen-persona'),
    btnNewMeeting: document.getElementById('btn-new-meeting'),

    // Results Tabs & Toolbar
    wtabMinutes: document.getElementById('wtab-minutes'),
    wtabMinutesMy: document.getElementById('wtab-minutes-my'),
    wtabTranscript: document.getElementById('wtab-transcript'),
    transcriptSegmentCount: document.getElementById('transcript-segment-count'),
    paneMinutes: document.getElementById('pane-minutes'),
    paneMinutesMy: document.getElementById('pane-minutes-my'),
    paneTranscript: document.getElementById('pane-transcript'),
    btnToggleEdit: document.getElementById('btn-toggle-edit'),
    btnToggleEditLabel: document.getElementById('btn-toggle-edit-label'),
    btnCopyMd: document.getElementById('btn-copy-md'),
    btnCopyText: document.getElementById('btn-copy-text'),
    btnDownloadMd: document.getElementById('btn-download-md'),
    btnDownloadTxt: document.getElementById('btn-download-txt'),
    btnPrintPdf: document.getElementById('btn-print-pdf'),

    // Markdown View & Editor (English)
    markdownPreview: document.getElementById('markdown-preview'),
    editorContainer: document.getElementById('editor-container'),
    markdownTextarea: document.getElementById('markdown-textarea'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),
    btnSaveEdit: document.getElementById('btn-save-edit'),

    // Markdown View & Editor (Burmese)
    markdownPreviewMy: document.getElementById('markdown-preview-my'),
    editorContainerMy: document.getElementById('editor-container-my'),
    markdownTextareaMy: document.getElementById('markdown-textarea-my'),
    btnCancelEditMy: document.getElementById('btn-cancel-edit-my'),
    btnSaveEditMy: document.getElementById('btn-save-edit-my'),
    // Transcript View
    transcriptSearchInput: document.getElementById('transcript-search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    searchMatchCount: document.getElementById('search-match-count'),
    btnCopyTranscript: document.getElementById('btn-copy-transcript'),
    transcriptTimeline: document.getElementById('transcript-timeline'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  // Human readable persona names mapping (updated dynamically by setLanguage)
  let PERSONA_NAMES = {
    executive: 'အမှုဆောင် အကျဉ်းချုပ်',
    formal: 'တရားဝင် အုပ်ချုပ်မှု / ဒါရိုက်တာဘုတ်',
    action_oriented: 'လုပ်ငန်းတာဝန်များ / PM ဇယား',
    technical: 'နည်းပညာနှင့် ဗိသုကာဆိုင်ရာ',
    brainstorming: 'အကြံဥာဏ်ဖလှယ်ခြင်းနှင့် ဆွေးနွေးပွဲ',
    client_stakeholder: 'ဖောက်သည်နှင့် အစုရှယ်ယာရှင် သုံးသပ်ချက်'
  };

  // =========================================================================
  // Exhaustive i18n Translation Dictionary (Burmese မြန်မာ & English)
  // =========================================================================
  const TRANSLATIONS = {
    en: {
      brandTagline: 'Audio to Executive Meeting Minutes powered by agy AI',
      statusAgyLabel: 'agy AI',
      statusChecking: 'Checking...',
      statusConnected: 'Connected',
      statusOffline: 'Offline',
      statusAgyReady: 'agy AI Ready',
      offlineAlertTitle: 'Backend Service Unreachable:',
      offlineAlertDesc: 'Ensure FastAPI is running on port 8000. Changes may fail to process until reconnected.',
      offlineAlertRetry: 'Retry',
      heroHeading: 'Transform Meeting Audio into <span class="gradient-text">Actionable Executive Intelligence</span>',
      heroSubtext: 'Upload meeting audio or try the demo. Specialized <code>agy</code> multimodal AI agents process audio directly to synthesize strategic minutes tailored to your stakeholders.',
      step1Title: 'Audio Input',
      step1Desc: 'Upload meeting audio or try the pre-loaded demo meeting.',
      tabUpload: 'Upload Audio File',
      tabDemo: 'Try Demo Meeting',
      dropTitle: 'Drag & drop meeting audio here',
      dropSubtitle: 'or <span class="browse-link">browse from your computer</span>',
      dropHelp: 'Max recommended: 100 MB • agy multimodal AI processes multi-channel and multi-speaker audio directly',
      demoTitle: 'Pre-packaged AI Product Roadmap & Architecture Sync',
      demoDesc: 'Test MinuteAI instantly without uploading your own audio file. Simulates an executive sync with Sarah Chen, Alex Miller, Elena Rostova, and David Kim discussing Whisper latency, memory optimization, and cloud budgets.',
      demoBadgeSpeakers: '4 Speakers',
      demoBadgeInfra: 'Whisper & Infra',
      demoBadgeDuration: '1:30 Duration',
      demoBtnLoad: 'Load Sample Meeting Audio',
      previewBadgeReady: 'Ready for agy AI',
      previewBtnChange: 'Change',
      previewDurationLoading: 'Loading duration...',
      step2Title: 'AI Persona & Synthesis Style',
      step2Desc: 'Select how the AI Agent should organize, prioritize, and articulate your meeting minutes.',
      personas: {
        executive: {
          badge: 'C-Suite & VP',
          name: 'Executive Summary',
          tagline: 'Strategic briefing, high-level decisions & bottom-line impact.',
          bullets: [
            'Concise strategic executive overview',
            'Key decisions adopted & business rationale',
            'Financial, KPI, and milestone impact'
          ]
        },
        formal: {
          badge: 'Governance',
          name: 'Formal Governance / Board',
          tagline: 'Call to order, formal motions, resolutions voted & legal record.',
          bullets: [
            'Call to order, quorum, and roll call',
            'Formal motions seconded and voting tally',
            'Official corporate compliance log'
          ]
        },
        action_oriented: {
          badge: 'Scrum / Agile',
          name: 'Action-Oriented / PM Matrix',
          tagline: 'Scrum task matrix, owners, deadlines, priority & blockers.',
          bullets: [
            'Structured task table: Owner, Due Date, Priority',
            'Blockers, dependencies & critical path',
            'Sprint deliverables & review gates'
          ]
        },
        technical: {
          badge: 'Engineering',
          name: 'Technical & Architecture',
          tagline: 'Architecture decisions, RFC trade-offs, security & code specs.',
          bullets: [
            'RFC proposals & architecture trade-offs',
            'Infrastructure, security & scalability notes',
            'Concrete engineering tickets & tech debt'
          ]
        },
        brainstorming: {
          badge: 'Innovation',
          name: 'Brainstorming & Workshop',
          tagline: 'Thematic clusters, divergence/convergence, pros/cons & ideas.',
          bullets: [
            'Thematic categorization of raw ideas',
            'Pros, cons, and feasibility evaluation',
            'Unvetted sparks & experimental hypotheses'
          ]
        },
        client_stakeholder: {
          badge: 'Client CRM',
          name: 'Client & Stakeholder Sync',
          tagline: 'Client requirements, commitments made, promises & follow-ups.',
          bullets: [
            'Explicit client requests and feedback points',
            'Agreed contractual milestones & delivery dates',
            'Relationship health & next touchpoint agenda'
          ]
        }
      },
      advancedTitle: 'Advanced Meeting Settings',
      advancedSub: 'Title, Attendees, Custom Directives, AI Model',
      labelMeetingTitle: 'Meeting Title / Topic',
      placeholderMeetingTitle: 'e.g. Q4 Executive Strategy & AI Roadmap',
      labelMeetingDate: 'Meeting Date',
      labelMeetingAttendees: 'Participants & Roles',
      placeholderMeetingAttendees: 'e.g. Elena (VP), Marcus (Lead Arch), Priya (PM)',
      labelCustomDirectives: 'Custom Directives for AI Agent',
      placeholderCustomDirectives: 'e.g. Highlight budget commitments, flag migration risks, and format decisions with impact scores.',
      labelAiModel: 'AI Synthesis Model (agy)',
      modelNote: 'Models run locally through the system <code>agy</code> agent with streaming telemetry.',
      summaryAudioLabel: 'Audio:',
      summaryAudioNone: 'None selected',
      summaryPersonaLabel: 'Persona:',
      btnGenerateMinutes: 'Generate Meeting Minutes',
      btnNextToPersona: 'Next: Choose Persona ->',
      btnBackToAudio: '<- Back: Audio',
      wizardAudioLabel: 'Audio:',
      wizardAudioNone: 'None selected',
      wizardSteps: [
        'Audio',
        'Persona',
        'Processing',
        'Results'
      ],
      stepperTitle: 'Processing Meeting',
      stepElapsed: 'Elapsed:',
      stepJob: 'Job:',
      stepper: [
        'Audio Upload',
        'agy Audio Analysis',
        'agy AI Persona Synthesis',
        'Minutes Finalized'
      ],
      progressInit: 'Initializing pipeline...',
      progressJobInit: 'Initializing job...',
      progressUploading: 'Uploading audio for agy AI processing...',
      progressDemoInit: 'Initializing pre-packaged meeting demo...',
      progressRegen: (personaName) => `Prompting agy AI agent with ${personaName} persona...`,
      progressRegenComplete: 'Minutes regenerated!',
      resultsTitleDefault: 'Executive Meeting Minutes',
      resultsAttendeesDefault: 'Attendees: Team Sync',
      resultsAttendeesPrefix: 'Attendees: ',
      resultsDurationPrefix: 'Generated in ',
      regenLabel: 'Regenerate as:',
      btnSwitch: 'Switch',
      btnNewMeeting: 'New Meeting',
      btnSavedMeetingsTitle: 'Saved Meetings',
      savedModalTitle: 'Saved Meetings History',
      savedModalHint: 'Meetings are automatically saved to browser local storage.',
      btnClearAllSaved: 'Clear All History',
      btnSaveMeeting: 'Save Meeting',
      btnSaveMeetingDone: 'Saved',
      btnOpenMeeting: 'Open',
      btnDeleteMeeting: 'Delete',
      emptySavedMsg: 'No saved meetings found in browser storage.',
      promptRenameTitle: 'Enter new meeting title:',
      tabMinutes: 'English Minutes',
      tabMinutesEn: 'English Minutes',
      tabMinutesMy: 'Burmese Minutes',
      tabTranscript: 'Audio Transcript',
      btnEditMinutes: 'Edit Minutes',
      btnViewPreview: 'View Preview',
      btnCopyMarkdown: 'Copy Markdown',
      btnCopyText: 'Copy Text',
      btnDownloadMd: '.MD',
      btnDownloadTxt: '.TXT',
      btnPrintPdf: 'Print / PDF',
      editorHint: 'Edit markdown directly below, then click "Apply Changes" to re-render.',
      btnCancel: 'Cancel',
      btnApplyChanges: 'Apply Changes',
      searchPlaceholder: 'Search transcript keywords or speakers...',
      btnCopyTranscript: 'Copy Transcript',
      searchMatchSingular: 'match found',
      searchMatchPlural: 'matches found',
      noSpeechSegments: 'No speech segments detected in this recording.',
      toastTheme: (theme) => `Switched to ${theme} theme`,
      toastAudioTooLarge: 'Audio file is too large (max 200MB)',
      toastAudioLoaded: (name, size) => `Loaded: ${name} (${size})`,
      toastAudioCleared: 'Audio selection cleared',
      toastDemoLoaded: 'Sample Meeting Audio loaded! Ready to generate minutes.',
      toastDemoProfile: 'Demo Meeting profile loaded!',
      toastSelectAudioFirst: 'Please upload an audio file or select demo meeting',
      toastJobReady: 'Executive Meeting Minutes ready!',
      toastMinutesUpdated: 'Meeting minutes updated successfully',
      toastTimestampSeek: (ts) => `Jumped to audio timestamp [${ts}]`,
      toastCopiedMd: 'Markdown copied to clipboard!',
      toastCopiedText: 'Plain text copied to clipboard!',
      toastCopiedTranscript: 'Transcript copied to clipboard!',
      toastCopiedGeneral: 'Copied to clipboard!',
      toastDownloaded: (fn) => `Downloaded ${fn}`,
      toastNoTranscript: 'No transcript available to regenerate minutes',
      toastRegenFailed: (err) => `Regeneration failed: ${err}`,
      toastNewMeetingReady: 'Ready for new meeting upload',
      toastRetryingHealth: 'Retrying service health check...',
      toastMeetingSaved: 'Meeting saved to local storage!',
      toastMeetingLoaded: 'Loaded saved meeting!',
      toastMeetingDeleted: 'Meeting deleted from history',
      toastTitleUpdated: 'Meeting title updated',
      confirmClearAllSaved: 'Are you sure you want to delete all saved meetings from local storage?',
      confirmDeleteMeeting: 'Delete this meeting from saved history?',
      confirmNewMeeting: 'Start a new meeting? Your current minutes will be replaced.'
    },
    my: {
      brandTagline: 'အသံဖိုင်မှ အမှုဆောင် အစည်းအဝေးမှတ်တမ်းများသို့ (agy AI ဖြင့် အစွမ်းထက်ထားသည်)',
      statusAgyLabel: 'agy AI',
      statusChecking: 'စစ်ဆေးနေသည်...',
      statusConnected: 'ချိတ်ဆက်ပြီး',
      statusOffline: 'လိုင်းမရှိပါ',
      statusAgyReady: 'agy AI အသင့်ရှိသည်',
      offlineAlertTitle: 'နောက်ခံ ဆာဗာ ချိတ်ဆက်မရပါ:',
      offlineAlertDesc: 'FastAPI ဆာဗာ ပို့စ် ၈၀၀၀ တွင် လည်ပတ်နေကြောင်း စစ်ဆေးပါ။ ပြန်လည်မချိတ်ဆက်မချင်း လုပ်ဆောင်ချက်များ မအောင်မြင်နိုင်ပါ။',
      offlineAlertRetry: 'ပြန်လည်ကြိုးစားရန်',
      heroHeading: 'အစည်းအဝေး အသံဖိုင်များကို <span class="gradient-text">အဆင့်မြင့် အမှုဆောင် ဆုံးဖြတ်ချက်မှတ်တမ်းများသို့</span> ပြောင်းလဲပါ',
      heroSubtext: 'အစည်းအဝေး အသံဖိုင်ကို တင်သွင်းပါ သို့မဟုတ် နမူနာဖြင့် စမ်းသပ်ပါ။ အထူးပြု <code>agy</code> multimodal AI အေဂျင်စီများက အသံဖိုင်ကို တိုက်ရိုက်ခွဲခြမ်းစိတ်ဖြာပြီး သက်ဆိုင်သူများအတွက် မဟာဗျူဟာမြောက် မှတ်တမ်းများ ထုတ်ပေးပါသည်။',
      step1Title: 'အသံဖိုင် ထည့်သွင်းခြင်း',
      step1Desc: 'အစည်းအဝေး အသံဖိုင် တင်သွင်းပါ သို့မဟုတ် နမူနာ အစည်းအဝေး စမ်းသပ်ပါ။',
      tabUpload: 'အသံဖိုင် တင်သွင်းရန်',
      tabDemo: 'နမူနာ အစည်းအဝေး စမ်းသပ်ရန်',
      dropTitle: 'အစည်းအဝေး အသံဖိုင်ကို ဤနေရာသို့ ဆွဲထည့်ပါ',
      dropSubtitle: 'သို့မဟုတ် <span class="browse-link">ကွန်ပျူတာမှ ရွေးချယ်တင်သွင်းပါ</span>',
      dropHelp: 'အများဆုံး အကြံပြုချက်: 100 MB • agy multimodal AI သည် စကားပြောသူ များပြားသော အသံဖိုင်များကို တိုက်ရိုက်ပိုင်းခြားနိုင်ပါသည်',
      demoTitle: 'ကြိုတင်ပြင်ဆင်ထားသော AI ထုတ်ကုန် မဟာဗျူဟာနှင့် ဗိသုကာ ညှိနှိုင်းမှု',
      demoDesc: 'မိမိကိုယ်ပိုင် အသံဖိုင် မတင်ဘဲ MinuteAI ကို ချက်ချင်း စမ်းသပ်ကြည့်ပါ။ Sarah Chen, Alex Miller, Elena Rostova နှင့် David Kim တို့၏ Whisper latency လျှော့ချရေး၊ မှတ်ဉာဏ်ထိန်းချုပ်မှုနှင့် cloud ဘတ်ဂျက်ဆိုင်ရာ အမှုဆောင်အစည်းအဝေးကို နမူနာဖော်ပြထားပါသည်။',
      demoBadgeSpeakers: 'စကားပြောသူ ၄ ဦး',
      demoBadgeInfra: 'Whisper နှင့် အခြေခံအဆောက်အအုံ',
      demoBadgeDuration: 'ကြာချိန် ၁:၃၀ မိနစ်',
      demoBtnLoad: 'နမူနာ အစည်းအဝေး အသံဖိုင် ဖွင့်ရန်',
      previewBadgeReady: 'agy AI အတွက် အသင့်ရှိသည်',
      previewBtnChange: 'ပြောင်းလဲမည်',
      previewDurationLoading: 'ကြာချိန် တွက်ချက်နေသည်...',
      step2Title: 'AI ပုံစံနှင့် မှတ်တမ်းပြုစုမှု စတိုင်',
      step2Desc: 'AI အေဂျင်စီမှ သင်၏ အစည်းအဝေးမှတ်တမ်းကို မည်သို့ စနစ်တကျ ဦးစားပေးစီစဉ်စေလိုကြောင်း ရွေးချယ်ပါ။',
      personas: {
        executive: {
          badge: 'အမှုဆောင်အရာရှိချုပ် & VP',
          name: 'အမှုဆောင် အကျဉ်းချုပ်',
          tagline: 'မဟာဗျူဟာ အကျဉ်းချုပ်၊ အဓိက ဆုံးဖြတ်ချက်များနှင့် အကျိုးသက်ရောက်မှုများ။',
          bullets: [
            'တိကျရှင်းလင်းသော အမှုဆောင် မဟာဗျူဟာ ခြုံငုံသုံးသပ်ချက်',
            'ချမှတ်ခဲ့သော အဓိက ဆုံးဖြတ်ချက်များနှင့် စီးပွားရေးဆိုင်ရာ အကြောင်းပြချက်များ',
            'ဘဏ္ဍာရေး၊ KPI နှင့် စီမံကိန်းမှတ်တိုင်များအပေါ် သက်ရောက်မှု'
          ]
        },
        formal: {
          badge: 'အုပ်ချုပ်မှု',
          name: 'တရားဝင် အုပ်ချုပ်မှု / ဒါရိုက်တာဘုတ်',
          tagline: 'အစည်းအဝေး စတင်ခြင်း၊ အဆိုတင်သွင်းခြင်း၊ မဲခွဲဆုံးဖြတ်ချက်များနှင့် ဥပဒေရေးရာ မှတ်တမ်း။',
          bullets: [
            'အစည်းအဝေး စတင်ခြင်း၊ အထမြောက်မှုနှင့် တက်ရောက်သူ စာရင်း',
            'ထောက်ခံအတည်ပြုခဲ့သော အဆိုများနှင့် မဲရလဒ် အသေးစိတ်',
            'တရားဝင် ကော်ပိုရိတ် လိုက်နာဆောင်ရွက်မှု မှတ်တမ်း'
          ]
        },
        action_oriented: {
          badge: 'Scrum / Agile',
          name: 'လုပ်ငန်းတာဝန်များ / PM ဇယား',
          tagline: 'လုပ်ငန်းတာဝန်များ၊ တာဝန်ခံများ၊ သတ်မှတ်ရက်များ၊ ဦးစားပေးနှင့် အတားအဆီးများ။',
          bullets: [
            'စနစ်တကျ တာဝန်ဇယား - တာဝန်ခံ၊ ပြီးစီးရမည့်ရက်၊ ဦးစားပေးအဆင့်',
            'ကြုံတွေ့ရသော အတားအဆီးများ၊ မှီခိုမှုများနှင့် အရေးကြီးသော လမ်းကြောင်း',
            'Sprint ပေးပို့ရမည့် ရလဒ်များနှင့် ပြန်လည်သုံးသပ်ချက် အဆင့်များ'
          ]
        },
        technical: {
          badge: 'အင်ဂျင်နီယာ',
          name: 'နည်းပညာနှင့် ဗိသုကာဆိုင်ရာ',
          tagline: 'စနစ်ဗိသုကာ ဆုံးဖြတ်ချက်များ၊ RFC ညှိနှိုင်းမှုများ၊ လုံခြုံရေးနှင့် ကုဒ်သတ်မှတ်ချက်များ။',
          bullets: [
            'RFC အဆိုပြုချက်များနှင့် ဗိသုကာဆိုင်ရာ ရွေးချယ်မှုများ',
            'အခြေခံအဆောက်အအုံ၊ လုံခြုံရေးနှင့် ချဲ့ထွင်နိုင်စွမ်းဆိုင်ရာ မှတ်စုများ',
            'လက်တွေ့ကျသော အင်ဂျင်နီယာ တာဝန်များနှင့် နည်းပညာကြွေးမြီများ'
          ]
        },
        brainstorming: {
          badge: 'တီထွင်ဆန်းသစ်မှု',
          name: 'အကြံဥာဏ်ဖလှယ်ခြင်းနှင့် ဆွေးနွေးပွဲ',
          tagline: 'ခေါင်းစဉ်အလိုက် စုစည်းမှုများ၊ ဆွေးနွေးချက်များ၊ အားသာချက်/အားနည်းချက်များနှင့် အကြံသစ်များ။',
          bullets: [
            'အကြံဥာဏ်သစ်များကို ခေါင်းစဉ်အလိုက် စနစ်တကျ စုစည်းခြင်း',
            'အားသာချက်၊ အားနည်းချက်နှင့် လက်တွေ့ဖြစ်နိုင်ခြေ သုံးသပ်ခြင်း',
            'စမ်းသပ်အဆင့် စိတ်ကူးသစ်များနှင့် သုတေသနယူဆချက်များ'
          ]
        },
        client_stakeholder: {
          badge: 'ဖောက်သည် ဆက်ဆံရေး',
          name: 'ဖောက်သည်နှင့် အစုရှယ်ယာရှင် သုံးသပ်ချက်',
          tagline: 'ဖောက်သည် လိုအပ်ချက်များ၊ ပေးထားသော ကတိကဝတ်များနှင့် နောက်ဆက်တွဲ ဆောင်ရွက်ချက်များ။',
          bullets: [
            'ဖောက်သည်၏ တိုက်ရိုက်တောင်းဆိုချက်များနှင့် တုံ့ပြန်ချက်များ',
            'သဘောတူညီထားသော စာချုပ်ပါ သတ်မှတ်ရက်များနှင့် ပေးပို့ရမည့်ရက်များ',
            'လုပ်ငန်းဆိုင်ရာ ဆက်ဆံရေးအခြေအနေနှင့် နောက်ဆက်တွဲ လုပ်ငန်းစဉ်များ'
          ]
        }
      },
      advancedTitle: 'အဆင့်မြင့် အစည်းအဝေး ဆက်တင်များ',
      advancedSub: 'ခေါင်းစဉ်၊ တက်ရောက်သူများ၊ AI အထူးညွှန်ကြားချက်များ၊ AI မော်ဒယ်',
      labelMeetingTitle: 'အစည်းအဝေး ခေါင်းစဉ် / အကြောင်းအရာ',
      placeholderMeetingTitle: 'ဥပမာ - စတုတ္ထသုံးလပတ် မဟာဗျူဟာနှင့် AI စီမံကိန်း',
      labelMeetingDate: 'အစည်းအဝေး နေ့စွဲ (Meeting Date)',
      labelMeetingAttendees: 'တက်ရောက်သူများနှင့် အခန်းကဏ္ဍများ',
      placeholderMeetingAttendees: 'ဥပမာ - ဒေါ်လှလှ (VP)၊ ဦးကျော် (Lead Arch)၊ ဒေါ်မြ (PM)',
      labelCustomDirectives: 'AI အေဂျင်စီအတွက် အထူးညွှန်ကြားချက်များ',
      placeholderCustomDirectives: 'ဥပမာ - ဘတ်ဂျက်ကတိကဝတ်များကို အလေးပေးဖော်ပြပါ၊ ပြောင်းလဲမှုအန္တရာယ်များကို အလံပြပါ၊ ဆုံးဖြတ်ချက်များကို အမှတ်ပေးဇယားဖြင့် ပြုစုပါ။',
      labelAiModel: 'AI မှတ်တမ်းပြုစုမှု မော်ဒယ် (agy)',
      modelNote: 'မော်ဒယ်များသည် စနစ်၏ <code>agy</code> agent မှတစ်ဆင့် streaming telemetry ဖြင့် ဒေသတွင်း တိုက်ရိုက်လည်ပတ်ပါသည်။',
      summaryAudioLabel: 'အသံဖိုင်:',
      summaryAudioNone: 'ရွေးချယ်ထားခြင်း မရှိပါ',
      summaryPersonaLabel: 'ပုံစံ:',
      btnGenerateMinutes: 'အစည်းအဝေး မှတ်တမ်း ထုတ်ယူမည်',
      btnNextToPersona: 'ရှေ့သို့: ပုံစံရွေးချယ်ရန် ->',
      btnBackToAudio: '<- နောက်သို့: အသံဖိုင်',
      wizardAudioLabel: 'အသံဖိုင်:',
      wizardAudioNone: 'ရွေးချယ်ထားခြင်း မရှိပါ',
      wizardSteps: [
        'အသံဖိုင်',
        'ပုံစံရွေးချယ်မှု',
        'မှတ်တမ်းထုတ်ယူခြင်း',
        'ရလဒ်များ'
      ],
      stepperTitle: 'အစည်းအဝေး မှတ်တမ်း ပြုစုနေသည်',
      stepElapsed: 'ကြာမြင့်ချိန်:',
      stepJob: 'အလုပ်အမှတ်:',
      stepper: [
        'အသံဖိုင် တင်သွင်းခြင်း',
        'agy အသံဖိုင် သုံးသပ်ခြင်း',
        'agy မှတ်တမ်း ပြုစုခြင်း',
        'မှတ်တမ်း ပြီးစီးခြင်း'
      ],
      progressInit: 'လုပ်ငန်းစဉ် စတင်နေသည်...',
      progressJobInit: 'အလုပ် စတင်ပြင်ဆင်နေသည်...',
      progressUploading: 'agy AI ဖြင့် ခွဲခြမ်းစိတ်ဖြာရန် အသံဖိုင် တင်သွင်းနေသည်...',
      progressDemoInit: 'ကြိုတင်ပြင်ဆင်ထားသော နမူနာကို ဖွင့်လှစ်နေသည်...',
      progressRegen: (personaName) => `agy AI ကို ${personaName} ပုံစံဖြင့် မှတ်တမ်းအသစ် ပြုစုခိုင်းနေသည်...`,
      progressRegenComplete: 'မှတ်တမ်း အသစ် ပြန်လည်ပြုစုပြီးပါပြီ။',
      resultsTitleDefault: 'အမှုဆောင် အစည်းအဝေး မှတ်တမ်း',
      resultsAttendeesDefault: 'တက်ရောက်သူများ - အဖွဲ့လိုက် ညှိနှိုင်းမှု',
      resultsAttendeesPrefix: 'တက်ရောက်သူများ: ',
      resultsDurationPrefix: 'ကြာမြင့်ချိန် ',
      regenLabel: 'အခြားပုံစံဖြင့် ပြန်ထုတ်ရန်:',
      btnSwitch: 'ပြောင်းလဲမည်',
      btnNewMeeting: 'အစည်းအဝေး အသစ်',
      btnSavedMeetingsTitle: 'သိမ်းဆည်းထားသော အစည်းအဝေးများ / Saved Meetings',
      savedModalTitle: 'သိမ်းဆည်းထားသော အစည်းအဝေးများ',
      savedModalHint: 'အစည်းအဝေးများကို ဘရောက်ဆာ Local Storage တွင် အလိုအလျောက် သိမ်းဆည်းထားပါသည်',
      btnClearAllSaved: 'အားလုံး ဖျက်မည်',
      btnSaveMeeting: 'သိမ်းဆည်းမည်',
      btnSaveMeetingDone: 'သိမ်းဆည်းပြီး',
      btnOpenMeeting: 'ဖွင့်ရန်',
      btnDeleteMeeting: 'ဖျက်မည်',
      emptySavedMsg: 'ဘရောက်ဆာထဲတွင် သိမ်းဆည်းထားသော အစည်းအဝေး မှတ်တမ်း မရှိသေးပါ။',
      promptRenameTitle: 'အစည်းအဝေး ခေါင်းစဉ် အသစ် ထည့်သွင်းပါ:',
      tabMinutes: 'အင်္ဂလိပ်ဘာသာ မှတ်တမ်း',
      tabMinutesEn: 'အင်္ဂလိပ်ဘာသာ မှတ်တမ်း',
      tabMinutesMy: 'မြန်မာဘာသာ မှတ်တမ်း',
      tabTranscript: 'အသံဖိုင် စာသားမှတ်တမ်း',
      btnEditMinutes: 'မှတ်တမ်း ပြင်ဆင်ရန်',
      btnViewPreview: 'မူကြမ်း ပြန်ကြည့်ရန်',
      btnCopyMarkdown: 'Markdown ကူးယူမည်',
      btnCopyText: 'စာသား ကူးယူမည်',
      btnDownloadMd: '.MD ရယူရန်',
      btnDownloadTxt: '.TXT ရယူရန်',
      btnPrintPdf: 'ပုံနှိပ် / PDF',
      editorHint: 'အောက်တွင် markdown ကို တိုက်ရိုက်ပြင်ဆင်နိုင်ပြီး "အပြောင်းအလဲ သိမ်းဆည်းမည်" ကို နှိပ်ပါ။',
      btnCancel: 'မလုပ်တော့ပါ',
      btnApplyChanges: 'အပြောင်းအလဲ သိမ်းဆည်းမည်',
      searchPlaceholder: 'စာသားမှတ်တမ်းတွင် စကားလုံး သို့မဟုတ် ပြောသူ ရှာဖွေရန်...',
      btnCopyTranscript: 'စာသားမှတ်တမ်း ကူးယူမည်',
      searchMatchSingular: 'ခု တွေ့ရှိသည်',
      searchMatchPlural: 'ခု တွေ့ရှိသည်',
      noSpeechSegments: 'ဤအသံဖိုင်တွင် စကားပြော စာသား အပိုင်းအစများ မတွေ့ရှိပါ။',
      toastTheme: (theme) => `${theme} အရောင်ပုံစံသို့ ပြောင်းလဲလိုက်ပါပြီ`,
      toastAudioTooLarge: 'အသံဖိုင် အရွယ်အစား ကြီးလွန်းပါသည် (အများဆုံး 200MB)',
      toastAudioLoaded: (name, size) => `တင်သွင်းပြီး: ${name} (${size})`,
      toastAudioCleared: 'ရွေးချယ်ထားသော အသံဖိုင်ကို ဖယ်ရှားပြီးပါပြီ',
      toastDemoLoaded: 'နမူနာ အသံဖိုင် ဖွင့်လှစ်ပြီးပါပြီ။ မှတ်တမ်း စတင်ထုတ်ယူနိုင်ပါပြီ။',
      toastDemoProfile: 'နမူနာ အစည်းအဝေး ပရိုဖိုင်ကို ဖွင့်လှစ်ပြီးပါပြီ။',
      toastSelectAudioFirst: 'ကျေးဇူးပြု၍ အသံဖိုင် တင်သွင်းပါ သို့မဟုတ် နမူနာ အစည်းအဝေးကို ရွေးချယ်ပါ',
      toastJobReady: 'အမှုဆောင် အစည်းအဝေး မှတ်တမ်း အသင့်ဖြစ်ပါပြီ။',
      toastMinutesUpdated: 'အစည်းအဝေး မှတ်တမ်းကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ',
      toastTimestampSeek: (ts) => `အသံဖိုင် အချိန် [${ts}] သို့ ရွှေ့လိုက်ပါပြီ`,
      toastCopiedMd: 'Markdown ကို clipboard သို့ ကူးယူပြီးပါပြီ။',
      toastCopiedText: 'စာသားများကို clipboard သို့ ကူးယူပြီးပါပြီ။',
      toastCopiedTranscript: 'စာသားမှတ်တမ်းကို clipboard သို့ ကူးယူပြီးပါပြီ။',
      toastCopiedGeneral: 'Clipboard သို့ ကူးယူပြီးပါပြီ။',
      toastDownloaded: (fn) => `${fn} ကို သိမ်းဆည်းပြီးပါပြီ`,
      toastNoTranscript: 'မှတ်တမ်း အသစ်ထုတ်ရန် စာသားမှတ်တမ်း မရှိသေးပါ',
      toastRegenFailed: (err) => `မှတ်တမ်း အသစ်ထုတ်ယူမှု မအောင်မြင်ပါ: ${err}`,
      toastNewMeetingReady: 'အစည်းအဝေး အသစ် တင်သွင်းရန် အသင့်ဖြစ်ပါပြီ',
      toastRetryingHealth: 'ဆာဗာ အခြေအနေကို ပြန်လည် စစ်ဆေးနေပါသည်...',
      toastMeetingSaved: 'အစည်းအဝေးမှတ်တမ်းကို Local Storage တွင် သိမ်းဆည်းလိုက်ပါပြီ။',
      toastMeetingLoaded: 'သိမ်းဆည်းထားသော အစည်းအဝေးကို ဖွင့်လှစ်လိုက်ပါပြီ။',
      toastMeetingDeleted: 'အစည်းအဝေး မှတ်တမ်းကို ဖျက်ပြီးပါပြီ။',
      toastTitleUpdated: 'အစည်းအဝေး ခေါင်းစဉ်ကို ပြင်ဆင်ပြီးပါပြီ။',
      confirmClearAllSaved: 'သိမ်းဆည်းထားသော အစည်းအဝေးအားလုံးကို ဖျက်ရန် သေချာပါသလား။',
      confirmDeleteMeeting: 'ဤအစည်းအဝေး မှတ်တမ်းကို ဖျက်ရန် သေချာပါသလား။',
      confirmNewMeeting: 'အစည်းအဝေး အသစ် စတင်မည်လား။ လက်ရှိ မှတ်တမ်းများ အစားထိုးခံရပါမည်။'
    }
  };

  function getI18nText(key) {
    const lang = state.currentLang || 'my';
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.my;
    return dict[key] || TRANSLATIONS.en[key] || '';
  }

  function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'my') lang = 'my';
    state.currentLang = lang;
    safeSetStorage('minuteai_lang', lang);
    if (document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
    }

    // Button state semantics:
    // In Burmese (my), button shows 🇺🇸 English (switch to English)
    // In English (en), button shows 🇲🇲 မြန်မာ (switch to Burmese)
    if (el.langFlag) el.langFlag.textContent = lang === 'my' ? '🇺🇸' : '🇲🇲';
    if (el.langLabel) el.langLabel.textContent = lang === 'my' ? 'English' : 'မြန်မာ';
    if (el.langToggleBtn) {
      el.langToggleBtn.setAttribute('title', lang === 'my' ? 'English ဘာသာသို့ ပြောင်းရန် (Switch to English)' : 'မြန်မာဘာသာသို့ ပြောင်းရန် (Switch to Burmese)');
    }
    const t = TRANSLATIONS[lang];

    // Update PERSONA_NAMES dictionary for code references
    PERSONA_NAMES = {
      executive: t.personas.executive.name,
      formal: t.personas.formal.name,
      action_oriented: t.personas.action_oriented.name,
      technical: t.personas.technical.name,
      brainstorming: t.personas.brainstorming.name,
      client_stakeholder: t.personas.client_stakeholder.name
    };

    // Header & Tagline
    const taglineEl = document.querySelector('.brand-tagline');
    if (taglineEl) taglineEl.textContent = t.brandTagline;

    // Health status label
    const statusLabelEl = el.statusAgy ? el.statusAgy.querySelector('.status-label') : null;
    if (statusLabelEl) statusLabelEl.textContent = t.statusAgyLabel;
    const statusValEl = el.statusAgy ? el.statusAgy.querySelector('.status-val') : null;
    if (statusValEl && !state.agyReady) {
      statusValEl.textContent = t.statusChecking;
    } else if (statusValEl && state.agyReady) {
      statusValEl.textContent = t.statusConnected;
    }

    // Offline alert
    const alertBodyEl = el.offlineAlert ? el.offlineAlert.querySelector('.alert-body') : null;
    if (alertBodyEl) {
      alertBodyEl.innerHTML = `<strong>${t.offlineAlertTitle}</strong> ${t.offlineAlertDesc}`;
    }
    if (el.alertRetryBtn) el.alertRetryBtn.textContent = t.offlineAlertRetry;

    // Hero Section
    const heroHeadingEl = document.querySelector('.hero-heading');
    if (heroHeadingEl) heroHeadingEl.innerHTML = t.heroHeading;
    const heroSubtextEl = document.querySelector('.hero-subtext');
    if (heroSubtextEl) heroSubtextEl.innerHTML = t.heroSubtext;

    // Step 1: Audio Input
    const stepAudioHeader = document.querySelector('#step-audio .step-title-group');
    if (stepAudioHeader) {
      const h2 = stepAudioHeader.querySelector('.step-title');
      const p = stepAudioHeader.querySelector('.step-description');
      if (h2) h2.textContent = t.step1Title;
      if (p) p.textContent = t.step1Desc;
    }

    // Input Mode Tabs
    if (el.tabUpload) {
      const svg = el.tabUpload.querySelector('svg');
      el.tabUpload.innerHTML = '';
      if (svg) el.tabUpload.appendChild(svg);
      el.tabUpload.appendChild(document.createTextNode(' ' + t.tabUpload));
    }
    if (el.tabDemo) {
      const svg = el.tabDemo.querySelector('svg');
      el.tabDemo.innerHTML = '';
      if (svg) el.tabDemo.appendChild(svg);
      el.tabDemo.appendChild(document.createTextNode(' ' + t.tabDemo));
    }

    // Drop Zone
    const dropTitleEl = document.querySelector('.drop-title');
    if (dropTitleEl) dropTitleEl.textContent = t.dropTitle;
    const dropSubEl = document.querySelector('.drop-subtitle');
    if (dropSubEl) dropSubEl.innerHTML = t.dropSubtitle;
    const dropHelpEl = document.querySelector('.drop-help');
    if (dropHelpEl) dropHelpEl.textContent = t.dropHelp;

    // Demo Card
    const demoTitleEl = document.querySelector('.demo-card-title');
    if (demoTitleEl) demoTitleEl.textContent = t.demoTitle;
    const demoTextEl = document.querySelector('.demo-card-text');
    if (demoTextEl) demoTextEl.textContent = t.demoDesc;
    const demoBadges = document.querySelectorAll('.demo-tags .badge');
    if (demoBadges.length >= 3) {
      demoBadges[0].textContent = t.demoBadgeSpeakers;
      demoBadges[1].textContent = t.demoBadgeInfra;
      demoBadges[2].textContent = t.demoBadgeDuration;
    }
    if (el.btnLoadDemo) {
      el.btnLoadDemo.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        ${t.demoBtnLoad}
      `;
    }

    // Audio Preview Card
    if (el.previewBadge) el.previewBadge.textContent = t.previewBadgeReady;
    if (el.btnRemoveAudio) {
      el.btnRemoveAudio.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        ${t.previewBtnChange}
      `;
    }

    // Step 2: Persona Selection
    const stepPersonaHeader = document.querySelector('#step-persona .step-title-group');
    if (stepPersonaHeader) {
      const h2 = stepPersonaHeader.querySelector('.step-title');
      const p = stepPersonaHeader.querySelector('.step-description');
      if (h2) h2.textContent = t.step2Title;
      if (p) p.textContent = t.step2Desc;
    }

    // Persona Cards
    const personaCards = el.personaGrid ? el.personaGrid.querySelectorAll('.persona-card') : [];
    personaCards.forEach((card) => {
      const pid = card.getAttribute('data-persona');
      const pInfo = t.personas[pid];
      if (!pInfo) return;
      const badge = card.querySelector('.persona-badge');
      if (badge) badge.textContent = pInfo.badge;
      const name = card.querySelector('.persona-name');
      if (name) name.textContent = pInfo.name;
      const tagline = card.querySelector('.persona-tagline');
      if (tagline) tagline.textContent = pInfo.tagline;
      const bullets = card.querySelectorAll('.persona-bullets li');
      if (bullets && pInfo.bullets) {
        bullets.forEach((li, idx) => {
          if (pInfo.bullets[idx]) li.textContent = pInfo.bullets[idx];
        });
      }
    });

    // Advanced Accordion
    const accTitleEl = document.querySelector('.accordion-title');
    if (accTitleEl) {
      const svg = accTitleEl.querySelector('svg');
      accTitleEl.innerHTML = '';
      if (svg) accTitleEl.appendChild(svg);
      accTitleEl.appendChild(document.createTextNode(' ' + t.advancedTitle));
    }
    const accSubEl = document.querySelector('.accordion-sub');
    if (accSubEl) accSubEl.textContent = t.advancedSub;

    const labelTitle = document.querySelector('label[for="input-meeting-title"]');
    if (labelTitle) labelTitle.textContent = t.labelMeetingTitle;
    if (el.inputMeetingTitle) el.inputMeetingTitle.setAttribute('placeholder', t.placeholderMeetingTitle);

    const labelAttendees = document.querySelector('label[for="input-meeting-attendees"]');
    if (labelAttendees) labelAttendees.textContent = t.labelMeetingAttendees;
    if (el.inputMeetingAttendees) el.inputMeetingAttendees.setAttribute('placeholder', t.placeholderMeetingAttendees);

    const labelDirectives = document.querySelector('label[for="input-custom-instructions"]');
    if (labelDirectives) labelDirectives.textContent = t.labelCustomDirectives;
    if (el.inputCustomInstructions) el.inputCustomInstructions.setAttribute('placeholder', t.placeholderCustomDirectives);

    const labelModel = document.querySelector('label[for="select-ai-model"]');
    if (labelModel) labelModel.textContent = t.labelAiModel;
    const modelNoteSpan = document.querySelector('.model-note span');
    if (modelNoteSpan) modelNoteSpan.innerHTML = t.modelNote;

    // Action Bar Summary
    const summaryLabels = document.querySelectorAll('.summary-label');
    if (summaryLabels.length >= 2) {
      summaryLabels[0].textContent = t.summaryAudioLabel;
      summaryLabels[1].textContent = t.summaryPersonaLabel;
    }
    if (!state.audioFile && state.audioSourceType !== 'demo') {
      if (el.summaryAudioVal) el.summaryAudioVal.textContent = t.summaryAudioNone;
    }
    if (el.summaryPersonaVal) {
      el.summaryPersonaVal.textContent = PERSONA_NAMES[state.selectedPersona] || state.selectedPersona;
    }
    const btnGenText = el.btnGenerate ? el.btnGenerate.querySelector('.btn-text') : null;
    if (btnGenText) btnGenText.textContent = t.btnGenerateMinutes;

    // Wizard Navigation & Labels
    if (t.wizardSteps) {
      t.wizardSteps.forEach((stLabel, idx) => {
        const lblEl = document.getElementById(`wizard-label-${idx + 1}`);
        if (lblEl) lblEl.textContent = stLabel;
      });
    }
    if (el.btnToStep2) {
      const btnTxt = el.btnToStep2.querySelector('.btn-text');
      if (btnTxt) btnTxt.textContent = t.btnNextToPersona;
    }
    if (el.btnToStep1) {
      const btnTxt = el.btnToStep1.querySelector('.btn-text');
      if (btnTxt) btnTxt.textContent = t.btnBackToAudio;
    }
    if (el.wizardAudioStatusLabel) {
      el.wizardAudioStatusLabel.textContent = t.wizardAudioLabel;
    }
    if (el.wizardAudioStatusVal && !state.audioFile && state.audioSourceType !== 'demo') {
      el.wizardAudioStatusVal.textContent = t.wizardAudioNone;
    }

    // Step 3: Stepper & Progress
    const progressTitleEl = document.querySelector('#step-progress .step-title');
    if (progressTitleEl) progressTitleEl.textContent = t.stepperTitle;

    const stepTexts = document.querySelectorAll('.stepper-step .step-text');
    if (stepTexts && t.stepper) {
      stepTexts.forEach((st, idx) => {
        if (t.stepper[idx]) st.textContent = t.stepper[idx];
      });
    }

    // Results Workspace
    if (el.resultsMeetingTitle && (!state.jobData || !state.jobData.title)) {
      if (!state.meetingTitle) el.resultsMeetingTitle.textContent = t.resultsTitleDefault;
    }
    if (el.resultsPersonaBadge) {
      el.resultsPersonaBadge.textContent = PERSONA_NAMES[state.selectedPersona] || state.selectedPersona;
    }
    if (el.resultsAttendeesDisplay && !state.meetingAttendees && (!state.jobData || !state.jobData.attendees)) {
      el.resultsAttendeesDisplay.textContent = t.resultsAttendeesDefault;
    }

    // Regenerate Select Label & Options
    const regenLabelEl = document.querySelector('.regen-label');
    if (regenLabelEl) regenLabelEl.textContent = t.regenLabel;
    if (el.btnRegenPersona) {
      el.btnRegenPersona.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
        ${t.btnSwitch}
      `;
    }
    if (el.regenPersonaSelect) {
      const currentRegenVal = el.regenPersonaSelect.value;
      el.regenPersonaSelect.innerHTML = `
        <option value="executive">${t.personas.executive.name}</option>
        <option value="formal">${t.personas.formal.name}</option>
        <option value="action_oriented">${t.personas.action_oriented.name}</option>
        <option value="technical">${t.personas.technical.name}</option>
        <option value="brainstorming">${t.personas.brainstorming.name}</option>
        <option value="client_stakeholder">${t.personas.client_stakeholder.name}</option>
      `;
      el.regenPersonaSelect.value = currentRegenVal;
    }

    // New Meeting Button
    if (el.btnNewMeeting) {
      el.btnNewMeeting.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        ${t.btnNewMeeting}
      `;
    }

    // Workspace Tabs
    const labelMinutesEn = document.getElementById('tab-label-minutes-en');
    if (labelMinutesEn) labelMinutesEn.textContent = t.tabMinutesEn || t.tabMinutes;
    const labelMinutesMy = document.getElementById('tab-label-minutes-my');
    if (labelMinutesMy) labelMinutesMy.textContent = t.tabMinutesMy;
    const labelTranscript = document.getElementById('tab-label-transcript');
    if (labelTranscript) labelTranscript.textContent = t.tabTranscript;

    // Workspace Toolbar
    if (el.btnToggleEditLabel) {
      el.btnToggleEditLabel.textContent = state.isEditingMinutes ? t.btnViewPreview : t.btnEditMinutes;
    }
    if (el.btnCopyMd) {
      el.btnCopyMd.innerHTML = `
        <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        ${t.btnCopyMarkdown}
      `;
    }
    if (el.btnCopyText) {
      el.btnCopyText.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        ${t.btnCopyText}
      `;
    }
    if (el.btnDownloadMd) {
      el.btnDownloadMd.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        ${t.btnDownloadMd}
      `;
    }
    if (el.btnDownloadTxt) {
      el.btnDownloadTxt.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        ${t.btnDownloadTxt}
      `;
    }
    if (el.btnPrintPdf) {
      el.btnPrintPdf.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        ${t.btnPrintPdf}
      `;
    }

    // Editor Toolbar
    const editorHintEl = document.querySelector('.editor-toolbar-hint');
    if (editorHintEl) editorHintEl.textContent = t.editorHint;
    if (el.btnCancelEdit) el.btnCancelEdit.textContent = t.btnCancel;
    if (el.btnSaveEdit) el.btnSaveEdit.textContent = t.btnApplyChanges;
    // Transcript Controls
    if (el.transcriptSearchInput) el.transcriptSearchInput.setAttribute('placeholder', t.searchPlaceholder);
    if (el.btnCopyTranscript) {
      el.btnCopyTranscript.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        ${t.btnCopyTranscript}
      `;
    }

    // Meeting Date Label & Saved Meetings UI
    if (el.labelMeetingDate) el.labelMeetingDate.textContent = t.labelMeetingDate;
    if (el.btnSavedMeetings) el.btnSavedMeetings.setAttribute('title', t.btnSavedMeetingsTitle);
    if (el.savedModalTitle) el.savedModalTitle.textContent = t.savedModalTitle;
    if (el.savedModalHint) el.savedModalHint.textContent = t.savedModalHint;
    if (el.btnClearAllSaved) el.btnClearAllSaved.textContent = t.btnClearAllSaved;
    if (el.btnSaveMeetingText) el.btnSaveMeetingText.textContent = t.btnSaveMeeting;
    if (el.btnRenameTitle) el.btnRenameTitle.setAttribute('title', t.promptRenameTitle);
    if (el.savedMeetingsModal && el.savedMeetingsModal.style.display !== 'none') {
      renderSavedMeetingsList();
    }
  }

  function toggleLanguage() {
    const nextLang = state.currentLang === 'my' ? 'en' : 'my';
    setLanguage(nextLang);
    const t = TRANSLATIONS[nextLang];
    showToast(nextLang === 'my' ? 'မြန်မာဘာသာသို့ ပြောင်းလဲလိုက်ပါပြီ' : 'Switched to English', 'info', 1800);
  }

  function initLanguage() {
    const savedLang = safeGetStorage('minuteai_lang');
    if (savedLang === 'en') {
      setLanguage('en');
    } else {
      setLanguage('my');
    }
  }

  // =========================================================================
  // Theme Management
  // =========================================================================
  function initTheme() {
    const savedTheme = safeGetStorage('minuteai_theme', 'light');
    if (document.documentElement) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }

  function toggleTheme() {
    const current = (document.documentElement && document.documentElement.getAttribute('data-theme')) || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    if (document.documentElement) {
      document.documentElement.setAttribute('data-theme', next);
    }
    safeSetStorage('minuteai_theme', next);
    showToast(getI18nText('toastTheme')(next), 'info', 1800);
  }

  // =========================================================================
  // Toast Notifications
  // =========================================================================
  function showToast(message, type = 'info', duration = 3000) {
    if (!el.toastContainer || !message) return;

    // Deduplicate: avoid stacking identical toast messages currently visible
    const existingToasts = el.toastContainer.querySelectorAll('.toast');
    for (const t of existingToasts) {
      if (t.textContent.includes(message)) {
        return;
      }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 250);
    }, duration);
  }

  // =========================================================================
  // System Health & Service Status Check
  // =========================================================================
  async function checkSystemHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`Health check returned ${res.status}`);
      const data = await res.json();

      // agy Agent status
      if (data.agy_ready !== false) {
        state.agyReady = true;
        el.statusAgy.classList.add('status-online');
        el.statusAgy.classList.remove('status-error');
        el.statusAgy.querySelector('.status-val').textContent = getI18nText('statusConnected');
      } else {
        state.agyReady = false;
        el.statusAgy.classList.remove('status-online');
        el.statusAgy.classList.add('status-error');
        el.statusAgy.querySelector('.status-val').textContent = getI18nText('statusOffline');
      }

      el.offlineAlert.style.display = 'none';
    } catch (err) {
      console.warn('System health check failed:', err);
      el.statusAgy.classList.remove('status-online');
      el.statusAgy.classList.add('status-error');
      el.statusAgy.querySelector('.status-val').textContent = getI18nText('statusOffline');

      el.offlineAlert.style.display = 'flex';
    }
  }

  async function loadModels() {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const models = await res.json();
        if (Array.isArray(models) && models.length > 0) {
          el.selectAiModel.innerHTML = '';
          models.forEach((m) => {
            const opt = document.createElement('option');
            opt.value = m.id || m;
            const label = m.name ? `${m.id} (${m.name})` : (m.id || m);
            opt.textContent = label;
            if (opt.value === 'gemini-3.8-flash-medium') opt.selected = true;
            el.selectAiModel.appendChild(opt);
          });
        }
      }
    } catch (e) {
      // Fallback to defaults already in HTML
    }
  }

  // =========================================================================
  // Step 1: Audio Input Navigation & Tab Switching
  // =========================================================================
  function switchInputTab(tab) {
    state.activeTab = tab;
    const tabs = [
      { btn: el.tabUpload, pane: el.paneUpload, id: 'upload' },
      { btn: el.tabDemo, pane: el.paneDemo, id: 'demo' }
    ];

    tabs.forEach((t) => {
      const isActive = t.id === tab;
      t.btn.classList.toggle('active', isActive);
      t.btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      t.pane.classList.toggle('active', isActive);
    });
  }

  // =========================================================================
  // Audio File Selection & Drag & Drop
  // =========================================================================
  function handleSelectedFile(file) {
    if (!file) return;

    // Validate size (e.g. max 200MB)
    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(getI18nText('toastAudioTooLarge'), 'error', 4000);
      return;
    }

    state.audioFile = file;
    state.audioFileName = file.name || 'meeting_recording.mp3';
    state.audioFileSize = file.size;
    state.audioSourceType = 'upload';

    // Revoke previous url if any
    if (state.audioObjectUrl) {
      URL.revokeObjectURL(state.audioObjectUrl);
    }
    state.audioObjectUrl = URL.createObjectURL(file);

    // Update Preview UI
    displayAudioPreview();
    showToast(getI18nText('toastAudioLoaded')(file.name, formatBytes(file.size)), 'success', 2500);
  }

  function displayAudioPreview() {
    el.previewFilename.textContent = state.audioFileName;
    el.previewFilesize.textContent = formatBytes(state.audioFileSize);
    el.previewDuration.textContent = getI18nText('previewDurationLoading');
    el.audioElement.src = state.audioObjectUrl;
    el.audioPreviewCard.style.display = 'block';

    // Auto-detect duration when metadata loads
    el.audioElement.onloadedmetadata = () => {
      state.audioDuration = el.audioElement.duration || 0;
      el.previewDuration.textContent = formatTime(state.audioDuration);
    };

    // Update Action Bar
    el.summaryAudioVal.textContent = `${state.audioFileName} (${formatBytes(state.audioFileSize)})`;
    el.btnGenerate.disabled = false;
    if (el.wizardAudioStatusVal) {
      el.wizardAudioStatusVal.textContent = `${state.audioFileName} (${formatBytes(state.audioFileSize)})`;
    }
    state.maxAllowedStep = Math.max(state.maxAllowedStep, 2);
    updateWizardNav();
  }
  function clearSelectedAudio() {
    if (state.audioObjectUrl) {
      URL.revokeObjectURL(state.audioObjectUrl);
      state.audioObjectUrl = null;
    }
    state.audioFile = null;
    state.audioFileName = '';
    state.audioFileSize = 0;
    state.audioDuration = 0;
    state.audioSourceType = null;

    el.audioElement.pause();
    el.audioElement.removeAttribute('src');
    el.audioElement.load();
    el.audioPreviewCard.style.display = 'none';
    el.fileInput.value = '';

    el.summaryAudioVal.textContent = getI18nText('summaryAudioNone');
    el.btnGenerate.disabled = true;
    showToast(getI18nText('toastAudioCleared'), 'info', 1500);
    if (el.wizardAudioStatusVal) {
      el.wizardAudioStatusVal.textContent = getI18nText('wizardAudioNone');
    }
    if (state.wizardStep > 1 && state.wizardStep < 3) {
      goToWizardStep(1);
    }
    state.maxAllowedStep = 1;
    updateWizardNav();
  }

  // =========================================================================
  // Demo Meeting Loader
  // =========================================================================
  async function loadDemoMeeting() {
    el.btnLoadDemo.disabled = true;
    el.btnLoadDemo.innerHTML = `<span class="spinner-dot"></span> Loading Demo...`;

    try {
      const res = await fetch('/api/sample-audio');
      if (!res.ok) throw new Error('Sample audio endpoint returned status ' + res.status);

      const blob = await res.blob();
      const demoFile = new File([blob], 'sample_executive_sync.mp3', { type: blob.type || 'audio/mp3' });

      state.audioFile = demoFile;
      state.audioFileName = demoFile.name;
      state.audioFileSize = demoFile.size;
      state.audioSourceType = 'demo';

      if (state.audioObjectUrl) URL.revokeObjectURL(state.audioObjectUrl);
      state.audioObjectUrl = URL.createObjectURL(blob);

      // Pre-populate recommended meeting context for a great out-of-the-box demo experience
      if (!el.inputMeetingTitle.value.trim()) {
        el.inputMeetingTitle.value = 'Q3 AI Product Roadmap & Architecture Sync';
      }
      if (!el.inputMeetingAttendees.value.trim()) {
        el.inputMeetingAttendees.value = 'Sarah Chen (Product Lead), Alex Miller (Lead Architect), Elena Rostova (UX Lead), David Kim (VP Operations)';
      }
      if (!el.inputCustomInstructions.value.trim()) {
        el.inputCustomInstructions.value = 'Focus on transcription latency improvements, memory caps for concurrent workers, and cloud budget approval.';
      }

      displayAudioPreview();
      showToast(getI18nText('toastDemoLoaded'), 'success', 3500);
    } catch (err) {
      console.warn('Direct sample audio fetch failed, falling back to simulated sample:', err);
      // Create a clean demo wav fallback if backend sample is generating
      const dummyBlob = new Blob(['MinuteAI Demo Audio Stream'], { type: 'audio/mp3' });
      const demoFile = new File([dummyBlob], 'sample_executive_sync.mp3', { type: 'audio/mp3' });
      state.audioFile = demoFile;
      state.audioFileName = demoFile.name;
      state.audioFileSize = 1024 * 512;
      state.audioSourceType = 'demo';

      if (!el.inputMeetingTitle.value.trim()) {
        el.inputMeetingTitle.value = 'Q3 AI Product Roadmap & Architecture Sync';
      }
      if (!el.inputMeetingAttendees.value.trim()) {
        el.inputMeetingAttendees.value = 'Sarah Chen (Product Lead), Alex Miller (Lead Architect), Elena Rostova (UX Lead), David Kim (VP Operations)';
      }
      displayAudioPreview();
      showToast(getI18nText('toastDemoProfile'), 'info', 3000);
    } finally {
      el.btnLoadDemo.disabled = false;
      el.btnLoadDemo.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        ${getI18nText('demoBtnLoad')}
      `;
    }
  }

  // =========================================================================
  // Wizard Stepper & View Navigation Controller
  // =========================================================================
  function goToWizardStep(stepNum) {
    const targetStep = Math.max(1, Math.min(4, stepNum));

    // Only guard moving to step 2 if audio has not been selected yet
    if (targetStep === 2 && !state.audioFile && state.audioSourceType !== 'demo' && !state.activeJobId && !state.rawMinutesMarkdown) {
      showToast(getI18nText('toastSelectAudioFirst'), 'info', 3500);
      return;
    }

    state.wizardStep = targetStep;
    state.maxAllowedStep = Math.max(state.maxAllowedStep, targetStep);

    // Show only the active wizard page view
    el.wizardPages.forEach((page, idx) => {
      if (!page) return;
      const isCurrent = (idx + 1) === targetStep;
      page.style.display = isCurrent ? 'block' : 'none';
      page.classList.toggle('active', isCurrent);
    });

    // Ensure setupSection is visible if on Step 1 or Step 2, hidden on Step 3 or 4
    if (el.setupSection) {
      el.setupSection.style.display = (targetStep === 1 || targetStep === 2) ? 'block' : 'none';
    }

    // Sync step-progress display if on Step 3
    if (targetStep === 3) {
      if (el.stepProgress) el.stepProgress.style.display = 'block';
      if (el.resultsWorkspace) el.resultsWorkspace.style.display = 'none';
    } else if (targetStep === 4) {
      if (el.stepProgress) el.stepProgress.style.display = 'none';
      if (el.resultsWorkspace) el.resultsWorkspace.style.display = 'block';
    }
    updateWizardNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateWizardNav() {
    const cur = state.wizardStep || 1;
    const maxA = state.maxAllowedStep || 1;

    el.wizardNodes.forEach((node, idx) => {
      if (!node) return;
      const stepNum = idx + 1;
      node.classList.remove('active', 'completed', 'unlocked', 'disabled');

      if (stepNum < cur) {
        node.classList.add('completed');
        node.setAttribute('aria-current', 'false');
      } else if (stepNum === cur) {
        node.classList.add('active');
        node.setAttribute('aria-current', 'step');
      } else if (stepNum <= maxA) {
        node.classList.add('unlocked');
        node.setAttribute('aria-current', 'false');
      } else {
        node.classList.add('disabled');
        node.setAttribute('aria-current', 'false');
      }
    });

    el.wizardLines.forEach((line, idx) => {
      if (!line) return;
      const stepNum = idx + 1;
      line.classList.toggle('completed', stepNum < cur);
    });
  }

  // Expose goToWizardStep to window for testing / automated suites
  window.goToWizardStep = goToWizardStep;


  // =========================================================================
  // Step 2: Persona Selection & Accordion Controls
  // =========================================================================
  function selectPersona(personaId) {
    state.selectedPersona = personaId;
    const cards = el.personaGrid.querySelectorAll('.persona-card');

    cards.forEach((card) => {
      const match = card.getAttribute('data-persona') === personaId;
      card.classList.toggle('active', match);
      card.setAttribute('aria-checked', match ? 'true' : 'false');
    });

    const personaName = PERSONA_NAMES[personaId] || personaId;
    el.summaryPersonaVal.textContent = personaName;
    el.regenPersonaSelect.value = personaId;
  }

  function toggleAdvancedAccordion() {
    const isExpanded = el.accordionToggle.getAttribute('aria-expanded') === 'true';
    el.accordionToggle.setAttribute('aria-expanded', !isExpanded);
    el.advancedPanel.style.display = isExpanded ? 'none' : 'block';
  }

  // =========================================================================
  // Step 3: Job Submission & Generation
  // =========================================================================
  async function startMinutesGeneration() {
    if (!state.audioFile && state.audioSourceType !== 'demo') {
      showToast(getI18nText('toastSelectAudioFirst'), 'error', 3000);
      return;
    }
    // Sync input values and reset completion idempotency flags
    state.isJobFinished = false;
    state.completedJobId = null;
    state.finishJobExecuted = false;
    state.meetingTitle = el.inputMeetingTitle ? el.inputMeetingTitle.value.trim() : '';
    state.meetingDate = (el.inputMeetingDate && el.inputMeetingDate.value) || state.meetingDate || new Date().toISOString().split('T')[0];
    state.meetingAttendees = el.inputMeetingAttendees ? el.inputMeetingAttendees.value.trim() : '';
    state.customInstructions = el.inputCustomInstructions ? el.inputCustomInstructions.value.trim() : '';
    state.selectedModel = el.selectAiModel ? el.selectAiModel.value : 'gemini-3.8-flash-medium';
    // Transition to Wizard Step 3
    el.btnGenerate.disabled = true;
    goToWizardStep(3);

    // Reset Progress indicators
    resetProgressUI();
    startProgressTimer();

    try {
      let jobId = null;

      // Check if we should use POST /api/sample-job directly (if user chose demo with no custom upload)
      if (state.audioSourceType === 'demo' && (!state.audioFile || state.audioFile.size < 10000)) {
        updateProgressUI(10, getI18nText('progressDemoInit'));
        const payload = {
          persona: state.selectedPersona,
          model: state.selectedModel,
          title: state.meetingTitle || 'Q4 Strategic Roadmap & Infrastructure Sync',
          attendees: state.meetingAttendees || 'Elena (VP), Marcus (Lead Architect), Priya (PM)',
          custom_instructions: state.customInstructions
        };

        const res = await fetch('/api/sample-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Sample job creation failed with status ' + res.status);
        const data = await res.json();
        jobId = data.job_id;
      } else {
        // Standard Upload workflow: FormData to POST /api/upload
        updateProgressUI(15, getI18nText('progressUploading'));
        highlightStepperStep(1);

        const formData = new FormData();
        formData.append('file', state.audioFile, state.audioFileName);
        formData.append('persona', state.selectedPersona);
        formData.append('model', state.selectedModel);
        if (state.meetingTitle) formData.append('title', state.meetingTitle);
        if (state.meetingAttendees) formData.append('attendees', state.meetingAttendees);
        if (state.customInstructions) formData.append('custom_instructions', state.customInstructions);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.message || `Upload failed with status ${res.status}`);
        }

        const data = await res.json();
        jobId = data.job_id;
      }

      state.activeJobId = jobId;
      safeSetStorage('minuteai_active_job_id', jobId);
      requestWakeLock();
      el.progressJobId.textContent = `Job: ${jobId.slice(0, 8)}...`;

      // Connect to Real-time Progress (SSE with fallback to polling)
      subscribeToJobStream(jobId);
    } catch (err) {
      console.error('Job submission failed:', err);
      showToast('Processing error: ' + err.message, 'error', 5000);
      stopProgressTimer();
      releaseWakeLock();
      safeRemoveStorage('minuteai_active_job_id');
      el.progressMessage.textContent = 'Error: ' + err.message;
      el.progressBarFill.style.backgroundColor = 'var(--color-danger)';
      el.btnGenerate.disabled = false;
    }
  }

  // =========================================================================
  // Real-Time Progress: SSE Stream with Polling Fallback & Mobile Resilience
  // =========================================================================
  function subscribeToJobStream(jobId) {
    if (state.eventSource) {
      try { state.eventSource.close(); } catch (e) {}
      state.eventSource = null;
    }

    // Dual-Channel Sync: Always start concurrent polling immediately!
    startPollingFallback(jobId);

    const streamUrl = `/api/jobs/${encodeURIComponent(jobId)}/stream`;
    try {
      const es = new EventSource(streamUrl);
      state.eventSource = es;

      es.onmessage = (event) => {
        try {
          const job = JSON.parse(event.data);
          handleJobUpdate(job);
        } catch (e) {
          console.error('Failed to parse SSE payload:', e);
        }
      };

      es.onerror = (err) => {
        console.warn('SSE stream notice:', err);
        try { es.close(); } catch (e) {}
        state.eventSource = null;
        startPollingFallback(jobId);
      };
    } catch (e) {
      console.warn('SSE instantiation failed, relying on polling:', e);
      startPollingFallback(jobId);
    }
  }

  function startPollingFallback(jobId) {
    if (state.pollIntervalId) return;

    let networkErrorsCount = 0;
    state.pollIntervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
          cache: 'no-store'
        });
        if (!res.ok) throw new Error('Polling fetch error ' + res.status);
        networkErrorsCount = 0;
        const job = await res.json();
        handleJobUpdate(job);

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(state.pollIntervalId);
          state.pollIntervalId = null;
        }
      } catch (err) {
        networkErrorsCount++;
        console.warn(`Polling check notice (attempt ${networkErrorsCount}):`, err);
        // Mobile networks occasionally glitch when switching 5G/Wi-Fi or waking from sleep;
        // continue retrying up to 40 times (~60 seconds) without failing the job
        if (networkErrorsCount > 40) {
          clearInterval(state.pollIntervalId);
          state.pollIntervalId = null;
        }
      }
    }, 1500);
  }
  function handleJobUpdate(job) {
    if (!job) return;
    state.jobStatus = job.status;
    state.jobProgress = job.progress || 0;
    state.jobData = job;

    const progress = Math.max(5, Math.min(100, job.progress || 10));
    updateProgressUI(progress, job.message || 'Processing...');

    // Update 4-step stepper
    if (job.status === 'queued') {
      highlightStepperStep(1);
    } else if (job.status === 'transcribing' || job.status === 'analyzing_audio') {
      highlightStepperStep(2);
    } else if (job.status === 'generating_minutes') {
      highlightStepperStep(3);
    } else if (job.status === 'completed') {
      highlightStepperStep(4);
      if (state.completedJobId === job.job_id || state.isJobFinished) {
        return; // Already completed this job, ignore duplicate completion broadcasts
      }
      state.completedJobId = job.job_id;
      state.isJobFinished = true;
      finishJob(job);
    } else if (job.status === 'failed') {
      handleJobFailure(job);
    }
  }

  function highlightStepperStep(currentStep) {
    const steps = [
      { node: el.stepNode1, line: el.stepLine1, num: 1 },
      { node: el.stepNode2, line: el.stepLine2, num: 2 },
      { node: el.stepNode3, line: el.stepLine3, num: 3 },
      { node: el.stepNode4, line: null, num: 4 }
    ];

    steps.forEach((s) => {
      s.node.classList.remove('active', 'completed');
      if (s.line) s.line.classList.remove('completed');

      if (s.num < currentStep) {
        s.node.classList.add('completed');
        if (s.line) s.line.classList.add('completed');
      } else if (s.num === currentStep) {
        s.node.classList.add('active');
      }
    });
  }

  function updateProgressUI(pct, message) {
    el.progressBarFill.style.width = `${pct}%`;
    el.progressPercent.textContent = `${Math.round(pct)}%`;
    if (message) el.progressMessage.textContent = message;
  }

  function resetProgressUI() {
    el.progressBarFill.style.width = '5%';
    el.progressBarFill.style.backgroundColor = '';
    el.progressPercent.textContent = '5%';
    el.progressMessage.textContent = getI18nText('progressInit');
    highlightStepperStep(1);
  }

  function startProgressTimer() {
    stopProgressTimer();
    state.startTime = Date.now();
    el.progressElapsed.textContent = `${getI18nText('stepElapsed')} 00:00`;
    state.timerIntervalId = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - state.startTime) / 1000);
      el.progressElapsed.textContent = `${getI18nText('stepElapsed')} ${formatTime(elapsedSec)}`;
    }, 1000);
  }

  function stopProgressTimer() {
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }
  }

  function finishJob(job) {
    if (state.finishJobExecuted && state.completedJobId === job.job_id) {
      return; // Already executed finishJob for this job
    }
    state.finishJobExecuted = true;
    state.completedJobId = job.job_id;
    state.isJobFinished = true;

    stopProgressTimer();
    releaseWakeLock();
    safeRemoveStorage('minuteai_active_job_id');
    if (state.eventSource) {
      try { state.eventSource.close(); } catch (e) {}
      state.eventSource = null;
    }
    if (state.pollIntervalId) {
      clearInterval(state.pollIntervalId);
      state.pollIntervalId = null;
    }

    if (el.btnGenerate) el.btnGenerate.disabled = false;
    showToast(getI18nText('toastJobReady'), 'success', 4000);

    // Render results
    try {
      renderResultsWorkspace(job);
    } catch (e) {
      console.error('Error in renderResultsWorkspace:', e);
      goToWizardStep(4);
      if (el.stepProgress) el.stepProgress.style.display = 'none';
      if (el.resultsWorkspace) el.resultsWorkspace.style.display = 'block';
    }
  }

  function handleJobFailure(job) {
    stopProgressTimer();
    releaseWakeLock();
    safeRemoveStorage('minuteai_active_job_id');
    if (state.eventSource) {
      try { state.eventSource.close(); } catch (e) {}
      state.eventSource = null;
    }
    if (state.pollIntervalId) {
      clearInterval(state.pollIntervalId);
      state.pollIntervalId = null;
    }

    if (el.btnGenerate) el.btnGenerate.disabled = false;
    el.progressBarFill.style.backgroundColor = 'var(--color-danger)';
    el.progressMessage.textContent = 'Failed: ' + (job.error || 'Unknown error occurred');
    showToast('Job failed: ' + (job.error || 'Processing error'), 'error', 6000);
  }

  // =========================================================================
  // Mobile Lifecycle: Reconnect on Tab Visibility / Wakeup
  // =========================================================================
  async function handlePageWakeup() {
    const savedJobId = state.activeJobId || safeGetStorage('minuteai_active_job_id');
    if (!savedJobId) return;
    if (state.jobStatus === 'completed') return;

    console.log('Mobile tab resumed / visible, checking active job status:', savedJobId);
    if (state.wizardStep === 3) {
      requestWakeLock();
    }

    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(savedJobId)}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const job = await res.json();
        handleJobUpdate(job);
        if (job.status !== 'completed' && job.status !== 'failed') {
          if (!state.pollIntervalId) startPollingFallback(savedJobId);
          if (!state.eventSource) subscribeToJobStream(savedJobId);
        }
      }
    } catch (err) {
      console.warn('Wakeup status check notice:', err);
      if (!state.pollIntervalId) startPollingFallback(savedJobId);
    }
  }

  async function checkResumedJobOnStartup() {
    const savedJobId = safeGetStorage('minuteai_active_job_id');
    if (!savedJobId) return;

    console.log('Found saved active job on startup:', savedJobId);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(savedJobId)}`, {
        cache: 'no-store'
      });
      if (!res.ok) {
        safeRemoveStorage('minuteai_active_job_id');
        return;
      }
      const job = await res.json();
      if (job.status === 'completed') {
        finishJob(job);
      } else if (job.status === 'failed') {
        safeRemoveStorage('minuteai_active_job_id');
      } else {
        state.activeJobId = savedJobId;
        goToWizardStep(3);
        subscribeToJobStream(savedJobId);
      }
    } catch (e) {
      console.warn('Error checking resumed job on startup:', e);
    }
  }

  // =========================================================================
  // Step 4: Results Workspace Rendering & Tabs
  // =========================================================================
  function renderResultsWorkspace(job) {
    state.rawMinutesEn = job.minutes_en || job.minutes || '# Executive Meeting Minutes\n\nNo English minutes generated.';
    state.rawMinutesMy = job.minutes_my || job.minutes || '# အမှုဆောင် အစည်းအဝေး မှတ်တမ်း\n\nမြန်မာဘာသာ မှတ်တမ်း မရှိပါ။';
    state.rawMinutesMarkdown = state.currentLang === 'my' ? state.rawMinutesMy : state.rawMinutesEn;
    state.rawTranscriptText = job.transcript || '';
    state.transcriptSegments = job.segments || [];

    // Header Metadata
    const title = job.title || state.meetingTitle || getI18nText('resultsTitleDefault');
    if (el.resultsMeetingTitle) el.resultsMeetingTitle.textContent = title;

    const personaKey = job.persona || state.selectedPersona;
    const personaLabel = PERSONA_NAMES[personaKey] || personaKey;
    if (el.resultsPersonaBadge) el.resultsPersonaBadge.textContent = personaLabel;
    if (el.resultsModelBadge) el.resultsModelBadge.textContent = job.model || state.selectedModel;

    // Date & Duration
    const dateVal = job.date || state.meetingDate || (el.inputMeetingDate && el.inputMeetingDate.value) || new Date().toISOString().split('T')[0];
    state.meetingDate = dateVal;
    if (el.resultsDateStamp) el.resultsDateStamp.textContent = `📅 ${dateVal}`;

    const attendees = job.attendees || state.meetingAttendees || (state.currentLang === 'my' ? 'အဖွဲ့လိုက် ညှိနှိုင်းမှု' : 'Team Strategic Sync');
    if (el.resultsAttendeesDisplay) el.resultsAttendeesDisplay.textContent = `${getI18nText('resultsAttendeesPrefix')}${attendees}`;

    const totalSeconds = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 15;
    if (el.resultsDurationDisplay) el.resultsDurationDisplay.textContent = `${getI18nText('resultsDurationPrefix')}${totalSeconds}s`;

    // Auto-save meeting to browser local storage
    try {
      saveMeetingRecord({
        id: state.activeMeetingId || (job && job.job_id ? `job_${job.job_id}` : `meeting_${Date.now()}`),
        title: title,
        date: dateVal,
        persona: personaKey,
        model: job.model || state.selectedModel,
        minutes: state.rawMinutesMarkdown,
        minutes_en: state.rawMinutesEn,
        minutes_my: state.rawMinutesMy,
        transcript: state.rawTranscriptText,
        segments: state.transcriptSegments,
        attendees: attendees
      });
    } catch (saveErr) {
      console.warn('Auto-save meeting to local storage notice:', saveErr);
    }
    // Render English Markdown Tab
    try {
      renderMarkdownContent(state.rawMinutesEn, el.markdownPreview);
    } catch (e) {
      console.warn('English Markdown parsing error, using raw fallback:', e);
      if (el.markdownPreview) {
        el.markdownPreview.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(state.rawMinutesEn)}</pre>`;
      }
    }

    // Render Burmese Markdown Tab
    try {
      renderMarkdownContent(state.rawMinutesMy, el.markdownPreviewMy);
    } catch (e) {
      console.warn('Burmese Markdown parsing error, using raw fallback:', e);
      if (el.markdownPreviewMy) {
        el.markdownPreviewMy.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(state.rawMinutesMy)}</pre>`;
      }
    }

    // Render Transcript Tab
    try {
      renderTranscriptTimeline(state.transcriptSegments, state.rawTranscriptText);
    } catch (e) {
      console.warn('Transcript timeline render error:', e);
    }

    // Pre-select persona in quick-regenerate dropdown
    if (el.regenPersonaSelect) el.regenPersonaSelect.value = personaKey;

    // Auto-select tab matching user preference (Burmese tab if Burmese UI, English tab if English UI)
    const defaultTab = state.currentLang === 'my' ? 'minutes-my' : 'minutes-en';
    switchWorkspaceTab(defaultTab);

    // Transition to Wizard Step 4
    goToWizardStep(4);

    // Explicitly guarantee visibility of results and hiding of progress
    if (el.stepProgress) el.stepProgress.style.display = 'none';
    if (el.resultsWorkspace) el.resultsWorkspace.style.display = 'block';
    const page3 = document.getElementById('wizard-page-3');
    const page4 = document.getElementById('wizard-page-4');
    if (page3) page3.style.display = 'none';
    if (page4) page4.style.display = 'block';
  }

  function renderMarkdownContent(mdText, targetEl) {
    const container = targetEl || el.markdownPreview;
    if (!container) return;
    if (typeof marked !== 'undefined' && marked.parse) {
      container.innerHTML = marked.parse(mdText);
    } else {
      container.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(mdText)}</pre>`;
    }
  }

  function renderTranscriptTimeline(segments, fallbackText) {
    el.transcriptTimeline.innerHTML = '';

    if (Array.isArray(segments) && segments.length > 0) {
      el.transcriptSegmentCount.textContent = segments.length;

      segments.forEach((seg, idx) => {
        const item = document.createElement('div');
        item.className = 'transcript-segment';
        item.setAttribute('data-index', idx);
        item.setAttribute('data-start', seg.start || 0);

        const startFormatted = formatTime(seg.start || 0);
        const textEscaped = escapeHtml(seg.text || '');

        item.innerHTML = `
          <button class="transcript-timestamp" title="Click to jump audio to this moment" data-seek="${seg.start || 0}">
            [${startFormatted}]
          </button>
          <div class="transcript-text">${textEscaped}</div>
        `;

        el.transcriptTimeline.appendChild(item);
      });
    } else if (fallbackText && fallbackText.trim()) {
      el.transcriptSegmentCount.textContent = '1';
      const item = document.createElement('div');
      item.className = 'transcript-segment';
      item.innerHTML = `
        <span class="transcript-timestamp">[00:00]</span>
        <div class="transcript-text">${escapeHtml(fallbackText)}</div>
      `;
      el.transcriptTimeline.appendChild(item);
    } else {
      el.transcriptSegmentCount.textContent = '0';
      el.transcriptTimeline.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
          ${getI18nText('noSpeechSegments')}
        </div>
      `;
    }
  }

  // Switch Workspace Tabs (English Minutes vs Burmese Minutes vs Transcript)
  function switchWorkspaceTab(tab) {
    if (tab === 'minutes') tab = 'minutes-en';
    state.workspaceTab = tab;

    const isMinutesEn = tab === 'minutes-en';
    const isMinutesMy = tab === 'minutes-my';
    const isTranscript = tab === 'transcript';

    if (el.wtabMinutes) {
      el.wtabMinutes.classList.toggle('active', isMinutesEn);
      el.wtabMinutes.setAttribute('aria-selected', isMinutesEn ? 'true' : 'false');
    }
    if (el.paneMinutes) {
      el.paneMinutes.style.display = isMinutesEn ? 'block' : 'none';
      el.paneMinutes.classList.toggle('active', isMinutesEn);
    }

    if (el.wtabMinutesMy) {
      el.wtabMinutesMy.classList.toggle('active', isMinutesMy);
      el.wtabMinutesMy.setAttribute('aria-selected', isMinutesMy ? 'true' : 'false');
    }
    if (el.paneMinutesMy) {
      el.paneMinutesMy.style.display = isMinutesMy ? 'block' : 'none';
      el.paneMinutesMy.classList.toggle('active', isMinutesMy);
    }

    if (el.wtabTranscript) {
      el.wtabTranscript.classList.toggle('active', isTranscript);
      el.wtabTranscript.setAttribute('aria-selected', isTranscript ? 'true' : 'false');
    }
    if (el.paneTranscript) {
      el.paneTranscript.style.display = isTranscript ? 'block' : 'none';
      el.paneTranscript.classList.toggle('active', isTranscript);
    }

    state.rawMinutesMarkdown = isMinutesMy ? (state.rawMinutesMy || state.rawMinutesEn) : (state.rawMinutesEn || state.rawMinutesMy);
  }

  // =========================================================================
  // Direct Markdown Editing Mode
  // =========================================================================
  function toggleMarkdownEditMode() {
    state.isEditingMinutes = !state.isEditingMinutes;
    const isBurmeseTab = state.workspaceTab === 'minutes-my';

    const activePreview = isBurmeseTab ? el.markdownPreviewMy : el.markdownPreview;
    const activeEditor = isBurmeseTab ? el.editorContainerMy : el.editorContainer;
    const activeTextarea = isBurmeseTab ? el.markdownTextareaMy : el.markdownTextarea;
    const activeContent = isBurmeseTab ? (state.rawMinutesMy || '') : (state.rawMinutesEn || '');

    if (state.isEditingMinutes) {
      if (activeTextarea) activeTextarea.value = activeContent;
      if (activePreview) activePreview.style.display = 'none';
      if (activeEditor) activeEditor.style.display = 'flex';
      if (el.btnToggleEditLabel) el.btnToggleEditLabel.textContent = getI18nText('btnViewPreview');
      if (activeTextarea) activeTextarea.focus();
    } else {
      if (activePreview) activePreview.style.display = 'block';
      if (activeEditor) activeEditor.style.display = 'none';
      if (el.btnToggleEditLabel) el.btnToggleEditLabel.textContent = getI18nText('btnEditMinutes');
    }
  }

  function saveEditedMarkdown() {
    const isBurmeseTab = state.workspaceTab === 'minutes-my';
    const activeTextarea = isBurmeseTab ? el.markdownTextareaMy : el.markdownTextarea;
    const activePreview = isBurmeseTab ? el.markdownPreviewMy : el.markdownPreview;
    if (activeTextarea) {
      const updated = activeTextarea.value;
      if (isBurmeseTab) {
        state.rawMinutesMy = updated;
      } else {
        state.rawMinutesEn = updated;
      }
      state.rawMinutesMarkdown = updated;
      renderMarkdownContent(updated, activePreview);
    }
    toggleMarkdownEditMode();
    showToast(getI18nText('toastMinutesUpdated'), 'success', 2000);
  }

  function cancelEditedMarkdown() {
    toggleMarkdownEditMode();
  }

  // =========================================================================
  // Transcript Search & Highlight
  // =========================================================================
  function handleTranscriptSearch() {
    const query = el.transcriptSearchInput.value.trim().toLowerCase();
    const segments = el.transcriptTimeline.querySelectorAll('.transcript-segment');

    if (!query) {
      el.btnClearSearch.style.display = 'none';
      el.searchMatchCount.textContent = '';
      segments.forEach((seg) => {
        seg.style.display = 'flex';
        const textDiv = seg.querySelector('.transcript-text');
        const idx = parseInt(seg.getAttribute('data-index'), 10);
        if (state.transcriptSegments[idx]) {
          textDiv.textContent = state.transcriptSegments[idx].text;
        }
      });
      return;
    }

    el.btnClearSearch.style.display = 'inline-block';
    let matchCount = 0;

    segments.forEach((seg) => {
      const idx = parseInt(seg.getAttribute('data-index'), 10);
      const originalText = state.transcriptSegments[idx]
        ? state.transcriptSegments[idx].text
        : seg.querySelector('.transcript-text').textContent;

      const lower = originalText.toLowerCase();
      if (lower.includes(query)) {
        matchCount++;
        seg.style.display = 'flex';

        // Highlight matching query safely
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        const highlighted = escapeHtml(originalText).replace(
          regex,
          '<mark class="transcript-highlight">$1</mark>'
        );
        seg.querySelector('.transcript-text').innerHTML = highlighted;
      } else {
        seg.style.display = 'none';
      }
    });

    el.searchMatchCount.textContent = `${matchCount} ${matchCount === 1 ? getI18nText('searchMatchSingular') : getI18nText('searchMatchPlural')}`;
  }

  function clearTranscriptSearch() {
    el.transcriptSearchInput.value = '';
    handleTranscriptSearch();
  }

  // Clickable Timestamps that seek the preview audio player
  function handleTimelineClick(e) {
    const btn = e.target.closest('[data-seek]');
    if (!btn) return;
    const seekTime = parseFloat(btn.getAttribute('data-seek'));
    if (!isNaN(seekTime) && el.audioElement) {
      el.audioElement.currentTime = seekTime;
      el.audioElement.play().catch(() => {});
      showToast(getI18nText('toastTimestampSeek')(formatTime(seekTime)), 'info', 1500);
    }
  }

  // =========================================================================
  // Toolbar Export & Action Handlers
  // =========================================================================
  async function copyMarkdown() {
    const isBurmeseTab = state.workspaceTab === 'minutes-my';
    const textToCopy = isBurmeseTab ? (state.rawMinutesMy || state.rawMinutesMarkdown) : (state.rawMinutesEn || state.rawMinutesMarkdown);
    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast(getI18nText('toastCopiedMd'), 'success', 2000);
      flipCopyButton(el.btnCopyMd);
    } catch (e) {
      fallbackCopy(textToCopy);
    }
  }

  async function copyPlainText() {
    const isBurmeseTab = state.workspaceTab === 'minutes-my';
    const activePreview = isBurmeseTab ? (el.markdownPreviewMy || el.markdownPreview) : el.markdownPreview;
    const text = (activePreview && (activePreview.innerText || activePreview.textContent)) || (isBurmeseTab ? state.rawMinutesMy : state.rawMinutesEn);
    try {
      await navigator.clipboard.writeText(text);
      showToast(getI18nText('toastCopiedText'), 'success', 2000);
      flipCopyButton(el.btnCopyText);
    } catch (e) {
      fallbackCopy(text);
    }
  }

  async function copyTranscriptText() {
    try {
      const text = state.rawTranscriptText ||
        Array.from(el.transcriptTimeline.querySelectorAll('.transcript-segment'))
          .map(s => s.innerText).join('\n');
      await navigator.clipboard.writeText(text);
      showToast(getI18nText('toastCopiedTranscript'), 'success', 2000);
      flipCopyButton(el.btnCopyTranscript);
    } catch (e) {
      fallbackCopy(state.rawTranscriptText);
    }
  }

  function flipCopyButton(btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<span>✓</span> Copied!`;
    btn.classList.add('btn-primary');
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.classList.remove('btn-primary');
    }, 1800);
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(getI18nText('toastCopiedGeneral'), 'success', 2000);
  }

  function downloadMarkdown() {
    const isBurmeseTab = state.workspaceTab === 'minutes-my';
    const content = isBurmeseTab ? (state.rawMinutesMy || state.rawMinutesMarkdown) : (state.rawMinutesEn || state.rawMinutesMarkdown);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const slug = slugify(el.resultsMeetingTitle.textContent || 'meeting_minutes');
    const suffix = isBurmeseTab ? 'burmese' : 'english';
    const filename = `${slug}_${state.selectedPersona}_${suffix}.md`;
    triggerDownload(blob, filename);
    showToast(getI18nText('toastDownloaded')(filename), 'success', 2500);
  }

  function downloadPlainText() {
    const isBurmeseTab = state.workspaceTab === 'minutes-my';
    const activePreview = isBurmeseTab ? (el.markdownPreviewMy || el.markdownPreview) : el.markdownPreview;
    const text = (activePreview && (activePreview.innerText || activePreview.textContent)) || (isBurmeseTab ? state.rawMinutesMy : state.rawMinutesEn);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const slug = slugify(el.resultsMeetingTitle.textContent || 'meeting_minutes');
    const suffix = isBurmeseTab ? 'burmese' : 'english';
    const filename = `${slug}_${state.selectedPersona}_${suffix}.txt`;
    triggerDownload(blob, filename);
    showToast(getI18nText('toastDownloaded')(filename), 'success', 2500);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printOrExportPdf() {
    window.print();
  }

  // =========================================================================
  // Quick Persona Regeneration (No Audio Re-Upload Needed)
  // =========================================================================
  async function regenerateWithPersona() {
    const newPersona = el.regenPersonaSelect.value;
    if (!newPersona) return;

    if (!state.rawTranscriptText && (!state.transcriptSegments || state.transcriptSegments.length === 0)) {
      showToast(getI18nText('toastNoTranscript'), 'error', 3000);
      return;
    }

    state.isJobFinished = false;
    state.completedJobId = null;
    state.finishJobExecuted = false;
    state.selectedPersona = newPersona;
    selectPersona(newPersona);
    // Switch view to progress stepper (Wizard Step 3)
    goToWizardStep(3);

    resetProgressUI();
    updateProgressUI(40, getI18nText('progressRegen')(PERSONA_NAMES[newPersona]));
    highlightStepperStep(3); // Step 3: Synthesis
    startProgressTimer();

    try {
      const payload = {
        transcript: state.rawTranscriptText,
        persona: newPersona,
        model: state.selectedModel,
        title: el.resultsMeetingTitle.textContent || state.meetingTitle,
        attendees: state.meetingAttendees,
        custom_instructions: state.customInstructions,
        job_id: state.activeJobId
      };

      const res = await fetch('/api/generate-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Regeneration request returned status ' + res.status);
      const data = await res.json();

      if (data.job_id) {
        state.activeJobId = data.job_id;
        safeSetStorage('minuteai_active_job_id', data.job_id);
        requestWakeLock();
        subscribeToJobStream(data.job_id);
      } else if (data.minutes) {
        updateProgressUI(100, getI18nText('progressRegenComplete'));
        highlightStepperStep(4);
        setTimeout(() => {
          finishJob({
            minutes: data.minutes,
            transcript: state.rawTranscriptText,
            segments: state.transcriptSegments,
            title: payload.title,
            persona: newPersona,
            model: payload.model
          });
        }, 500);
      }
    } catch (err) {
      console.error('Regeneration error:', err);
      showToast('Regeneration failed: ' + err.message, 'error', 5000);
      stopProgressTimer();
      el.resultsWorkspace.style.display = 'block';
      el.stepProgress.style.display = 'none';
    }
  }

  // Reset to Upload Step
  function resetToNewMeeting() {
    if (confirm(getI18nText('confirmNewMeeting'))) {
      state.isJobFinished = false;
      state.completedJobId = null;
      state.finishJobExecuted = false;
      safeRemoveStorage('minuteai_active_job_id');
      clearSelectedAudio();
      goToWizardStep(1);
      showToast(getI18nText('toastNewMeetingReady'), 'info', 2000);
    }
  }

  // =========================================================================
  // Utility Helper Functions
  // =========================================================================
  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatTime(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '_')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 40);
  }

  // =========================================================================
  // Local Storage Saved Meetings Persistence & History Manager
  // =========================================================================
  const SAVED_MEETINGS_KEY = 'minuteai_saved_meetings';

  function initMeetingDate() {
    const today = new Date().toISOString().split('T')[0];
    if (el.inputMeetingDate && !el.inputMeetingDate.value) {
      el.inputMeetingDate.value = today;
    }
    state.meetingDate = (el.inputMeetingDate && el.inputMeetingDate.value) || today;
  }

  function getSavedMeetings() {
    const raw = safeGetStorage(SAVED_MEETINGS_KEY, '[]');
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveMeetingRecord(record) {
    if (!record || (!record.minutes && !record.minutes_en && !record.minutes_my)) return null;
    const meetings = getSavedMeetings();
    const id = record.id || `meeting_${Date.now()}`;
    const dateVal = record.date || state.meetingDate || (el.inputMeetingDate && el.inputMeetingDate.value) || new Date().toISOString().split('T')[0];
    const cleanRecord = {
      id: id,
      title: record.title || state.meetingTitle || getI18nText('resultsTitleDefault'),
      date: dateVal,
      persona: record.persona || state.selectedPersona,
      model: record.model || state.selectedModel,
      minutes: record.minutes || '',
      minutes_en: record.minutes_en || record.minutes || '',
      minutes_my: record.minutes_my || record.minutes || '',
      transcript: record.transcript || state.rawTranscriptText || '',
      segments: record.segments || state.transcriptSegments || [],
      attendees: record.attendees || state.meetingAttendees || '',
      savedAt: Date.now()
    };

    const existingIdx = meetings.findIndex(m => m.id === id);
    if (existingIdx >= 0) {
      meetings[existingIdx] = cleanRecord;
    } else {
      meetings.unshift(cleanRecord);
    }

    if (meetings.length > 50) {
      meetings.length = 50;
    }

    safeSetStorage(SAVED_MEETINGS_KEY, JSON.stringify(meetings));
    state.activeMeetingId = id;
    updateSavedMeetingsBadge();
    return cleanRecord;
  }

  function deleteSavedMeeting(id) {
    const meetings = getSavedMeetings().filter(m => m.id !== id);
    safeSetStorage(SAVED_MEETINGS_KEY, JSON.stringify(meetings));
    if (state.activeMeetingId === id) {
      state.activeMeetingId = null;
    }
    updateSavedMeetingsBadge();
    renderSavedMeetingsList();
    showToast(getI18nText('toastMeetingDeleted'), 'info', 2000);
  }

  function clearAllSavedMeetings() {
    if (confirm(getI18nText('confirmClearAllSaved'))) {
      safeSetStorage(SAVED_MEETINGS_KEY, '[]');
      state.activeMeetingId = null;
      updateSavedMeetingsBadge();
      renderSavedMeetingsList();
      showToast(getI18nText('toastMeetingDeleted'), 'info', 2000);
    }
  }

  function updateSavedMeetingsBadge() {
    const meetings = getSavedMeetings();
    if (el.savedMeetingsBadge) {
      if (meetings.length > 0) {
        el.savedMeetingsBadge.textContent = meetings.length;
        el.savedMeetingsBadge.style.display = 'inline-block';
      } else {
        el.savedMeetingsBadge.style.display = 'none';
      }
    }
  }

  function renderSavedMeetingsList() {
    if (!el.savedMeetingsList) return;
    const meetings = getSavedMeetings();
    el.savedMeetingsList.innerHTML = '';

    if (meetings.length === 0) {
      el.savedMeetingsList.innerHTML = `<div class="empty-saved-msg">${getI18nText('emptySavedMsg')}</div>`;
      if (el.btnClearAllSaved) el.btnClearAllSaved.style.display = 'none';
      return;
    }

    if (el.btnClearAllSaved) el.btnClearAllSaved.style.display = 'inline-block';

    meetings.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'saved-meeting-card';
      const personaLabel = PERSONA_NAMES[m.persona] || m.persona;

      card.innerHTML = `
        <div class="saved-meeting-info">
          <div class="saved-meeting-title" title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</div>
          <div class="saved-meeting-meta">
            <span>📅 ${escapeHtml(m.date || 'Today')}</span>
            <span class="meta-dot">•</span>
            <span class="badge badge-persona">${escapeHtml(personaLabel)}</span>
          </div>
        </div>
        <div class="saved-meeting-actions">
          <button class="btn btn-secondary btn-sm btn-open-meeting" data-id="${m.id}" title="${getI18nText('btnOpenMeeting')}">
            ${getI18nText('btnOpenMeeting')}
          </button>
          <button class="btn btn-ghost btn-sm btn-del-meeting" data-id="${m.id}" title="${getI18nText('btnDeleteMeeting')}">
            ✕
          </button>
        </div>
      `;

      card.querySelector('.btn-open-meeting').addEventListener('click', () => {
        loadSavedMeetingById(m.id);
      });

      card.querySelector('.btn-del-meeting').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(getI18nText('confirmDeleteMeeting'))) {
          deleteSavedMeeting(m.id);
        }
      });

      el.savedMeetingsList.appendChild(card);
    });
  }

  function openSavedMeetingsModal() {
    renderSavedMeetingsList();
    if (el.savedMeetingsModal) {
      el.savedMeetingsModal.style.display = 'flex';
    }
  }

  function closeSavedMeetingsModal() {
    if (el.savedMeetingsModal) {
      el.savedMeetingsModal.style.display = 'none';
    }
  }

  function loadSavedMeetingById(id) {
    const meetings = getSavedMeetings();
    const meeting = meetings.find(m => m.id === id);
    if (!meeting) return;

    closeSavedMeetingsModal();
    state.activeMeetingId = meeting.id;
    state.meetingTitle = meeting.title;
    state.meetingDate = meeting.date;
    state.selectedPersona = meeting.persona;
    state.selectedModel = meeting.model;
    state.meetingAttendees = meeting.attendees || '';
    state.rawMinutesEn = meeting.minutes_en || meeting.minutes || '';
    state.rawMinutesMy = meeting.minutes_my || meeting.minutes || '';
    state.rawMinutesMarkdown = state.currentLang === 'my' ? state.rawMinutesMy : state.rawMinutesEn;
    state.rawTranscriptText = meeting.transcript || '';
    state.transcriptSegments = meeting.segments || [];

    if (el.inputMeetingTitle) el.inputMeetingTitle.value = meeting.title;
    if (el.inputMeetingDate) el.inputMeetingDate.value = meeting.date;
    if (el.inputMeetingAttendees) el.inputMeetingAttendees.value = meeting.attendees || '';

    state.maxAllowedStep = 4;
    renderResultsWorkspace(meeting);
    goToWizardStep(4);
    showToast(getI18nText('toastMeetingLoaded'), 'success', 2500);
  }

  function manualSaveMeeting() {
    const title = (el.resultsMeetingTitle && el.resultsMeetingTitle.textContent) || state.meetingTitle || getI18nText('resultsTitleDefault');
    const dateVal = state.meetingDate || (el.inputMeetingDate && el.inputMeetingDate.value) || new Date().toISOString().split('T')[0];
    saveMeetingRecord({
      id: state.activeMeetingId || `meeting_${Date.now()}`,
      title: title,
      date: dateVal,
      persona: state.selectedPersona,
      model: state.selectedModel,
      minutes: state.rawMinutesMarkdown,
      minutes_en: state.rawMinutesEn,
      minutes_my: state.rawMinutesMy,
      transcript: state.rawTranscriptText,
      segments: state.transcriptSegments,
      attendees: state.meetingAttendees
    });
    showToast(getI18nText('toastMeetingSaved'), 'success', 2500);
    if (el.btnSaveMeetingText) {
      el.btnSaveMeetingText.textContent = getI18nText('btnSaveMeetingDone');
      setTimeout(() => {
        if (el.btnSaveMeetingText) el.btnSaveMeetingText.textContent = getI18nText('btnSaveMeeting');
      }, 2000);
    }
  }

  function renameMeetingTitle() {
    const currentTitle = (el.resultsMeetingTitle && el.resultsMeetingTitle.textContent) || state.meetingTitle || 'Meeting Minutes';
    const newTitle = prompt(getI18nText('promptRenameTitle'), currentTitle);
    if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
      const cleanTitle = newTitle.trim();
      state.meetingTitle = cleanTitle;
      if (el.resultsMeetingTitle) el.resultsMeetingTitle.textContent = cleanTitle;
      if (el.inputMeetingTitle) el.inputMeetingTitle.value = cleanTitle;

      if (state.activeMeetingId) {
        saveMeetingRecord({
          id: state.activeMeetingId,
          title: cleanTitle,
          date: state.meetingDate,
          persona: state.selectedPersona,
          model: state.selectedModel,
          minutes: state.rawMinutesMarkdown,
          minutes_en: state.rawMinutesEn,
          minutes_my: state.rawMinutesMy,
          transcript: state.rawTranscriptText,
          segments: state.transcriptSegments,
          attendees: state.meetingAttendees
        });
      }
      showToast(getI18nText('toastTitleUpdated'), 'success', 2000);
    }
  }
  // =========================================================================
  // Event Listeners Binding
  // =========================================================================
  function initEventListeners() {
    // Language toggle
    if (el.langToggleBtn) {
      el.langToggleBtn.addEventListener('click', toggleLanguage);
    }

    // Theme toggle
    el.themeToggleBtn.addEventListener('click', toggleTheme);

    // Health retry
    el.alertRetryBtn.addEventListener('click', () => {
      checkSystemHealth();
      showToast(getI18nText('toastRetryingHealth'), 'info', 1500);
    });

    // Input Tabs
    el.tabUpload.addEventListener('click', () => switchInputTab('upload'));
    el.tabDemo.addEventListener('click', () => switchInputTab('demo'));

    // File Upload Drag & Drop
    el.dropZone.addEventListener('click', () => el.fileInput.click());
    el.dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.fileInput.click();
      }
    });

    el.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSelectedFile(e.target.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      el.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      el.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropZone.classList.remove('dragover');
      });
    });

    el.dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleSelectedFile(e.dataTransfer.files[0]);
      }
    });


    // Demo Meeting Loader
    el.btnLoadDemo.addEventListener('click', loadDemoMeeting);

    // Remove Selected Audio
    el.btnRemoveAudio.addEventListener('click', clearSelectedAudio);

    // Persona Selection Cards
    el.personaGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.persona-card');
      if (card) {
        const pid = card.getAttribute('data-persona');
        if (pid) selectPersona(pid);
      }
    });

    el.personaGrid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.persona-card');
        if (card) {
          e.preventDefault();
          const pid = card.getAttribute('data-persona');
          if (pid) selectPersona(pid);
        }
      }
    });

    // Accordion Toggle
    el.accordionToggle.addEventListener('click', toggleAdvancedAccordion);

    // Primary Action Button
    el.btnGenerate.addEventListener('click', startMinutesGeneration);
    // Wizard Navigation Buttons
    if (el.btnToStep2) {
      el.btnToStep2.addEventListener('click', () => {
        if (!state.audioFile && state.audioSourceType !== 'demo') {
          showToast(getI18nText('toastSelectAudioFirst'), 'info', 3500);
          return;
        }
        goToWizardStep(2);
      });
    }

    if (el.btnToStep1) {
      el.btnToStep1.addEventListener('click', () => {
        goToWizardStep(1);
      });
    }

    // Wizard Stepper Nav Clicks
    el.wizardNodes.forEach((node, idx) => {
      if (!node) return;
      const stepNum = idx + 1;
      node.addEventListener('click', () => {
        // Allow navigating to visited or currently allowed steps
        if (stepNum <= state.maxAllowedStep || (stepNum <= 2 && (state.audioFile || state.audioSourceType === 'demo'))) {
          goToWizardStep(stepNum);
        } else if (stepNum > 1 && !state.audioFile && state.audioSourceType !== 'demo') {
          showToast(getI18nText('toastSelectAudioFirst'), 'info', 3500);
        }
      });
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          node.click();
        }
      });
    });


    // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to generate
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!el.btnGenerate.disabled && el.stepProgress.style.display === 'none') {
          startMinutesGeneration();
        }
      }
    });

    // Workspace Tabs
    if (el.wtabMinutes) el.wtabMinutes.addEventListener('click', () => switchWorkspaceTab('minutes-en'));
    if (el.wtabMinutesMy) el.wtabMinutesMy.addEventListener('click', () => switchWorkspaceTab('minutes-my'));
    if (el.wtabTranscript) el.wtabTranscript.addEventListener('click', () => switchWorkspaceTab('transcript'));

    // Markdown Edit Mode
    if (el.btnToggleEdit) el.btnToggleEdit.addEventListener('click', toggleMarkdownEditMode);
    if (el.btnSaveEdit) el.btnSaveEdit.addEventListener('click', saveEditedMarkdown);
    if (el.btnCancelEdit) el.btnCancelEdit.addEventListener('click', cancelEditedMarkdown);
    if (el.btnSaveEditMy) el.btnSaveEditMy.addEventListener('click', saveEditedMarkdown);
    if (el.btnCancelEditMy) el.btnCancelEditMy.addEventListener('click', cancelEditedMarkdown);
    // Transcript Search & Timestamps
    el.transcriptSearchInput.addEventListener('input', handleTranscriptSearch);
    el.btnClearSearch.addEventListener('click', clearTranscriptSearch);
    el.transcriptTimeline.addEventListener('click', handleTimelineClick);

    // Export Buttons
    el.btnCopyMd.addEventListener('click', copyMarkdown);
    el.btnCopyText.addEventListener('click', copyPlainText);
    el.btnCopyTranscript.addEventListener('click', copyTranscriptText);
    el.btnDownloadMd.addEventListener('click', downloadMarkdown);
    el.btnDownloadTxt.addEventListener('click', downloadPlainText);
    el.btnPrintPdf.addEventListener('click', printOrExportPdf);

    // Regeneration & New Meeting
    el.btnRegenPersona.addEventListener('click', regenerateWithPersona);
    el.btnNewMeeting.addEventListener('click', resetToNewMeeting);

    // Saved Meetings Modal Toggle & Actions
    if (el.btnSavedMeetings) el.btnSavedMeetings.addEventListener('click', openSavedMeetingsModal);
    if (el.btnCloseSavedModal) el.btnCloseSavedModal.addEventListener('click', closeSavedMeetingsModal);
    if (el.btnClearAllSaved) el.btnClearAllSaved.addEventListener('click', clearAllSavedMeetings);
    if (el.savedMeetingsModal) {
      el.savedMeetingsModal.addEventListener('click', (e) => {
        if (e.target === el.savedMeetingsModal) closeSavedMeetingsModal();
      });
    }

    // Save Meeting Action & Title Rename Action
    if (el.btnSaveMeeting) el.btnSaveMeeting.addEventListener('click', manualSaveMeeting);
    if (el.btnRenameTitle) el.btnRenameTitle.addEventListener('click', renameMeetingTitle);
    if (el.resultsMeetingTitle) el.resultsMeetingTitle.addEventListener('click', renameMeetingTitle);

    // Meeting Date Input
    if (el.inputMeetingDate) {
      el.inputMeetingDate.addEventListener('change', (e) => {
        state.meetingDate = e.target.value;
      });
    }

    // Mobile Page Lifecycle & Visibility Event Handlers
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handlePageWakeup();
      }
    });
    window.addEventListener('pageshow', handlePageWakeup);
    window.addEventListener('focus', handlePageWakeup);
    window.addEventListener('online', handlePageWakeup);
  }
  // Application Bootstrapping
  // =========================================================================
  function initApp() {
    try {
      initEventListeners();
    } catch (e) {
      console.error('Error initializing event listeners:', e);
    }

    try {
      initLanguage();
    } catch (e) {
      console.error('Error initializing language:', e);
    }

    try {
      initTheme();
    } catch (e) {
      console.error('Error initializing theme:', e);
    }

    try {
      checkSystemHealth();
    } catch (e) {
      console.error('Error checking system health:', e);
    }

    try {
      loadModels();
    } catch (e) {
      console.error('Error loading models:', e);
    }

    // Resume interrupted/backgrounded job if present
    try {
      checkResumedJobOnStartup();
    } catch (e) {
      console.warn('Error checking resumed job on startup:', e);
    }
    // Periodic health check every 25s
    setInterval(() => {
      try {
        checkSystemHealth();
      } catch (e) {}
    }, 25000);

    // Initialize Meeting Date default & Saved Meetings Badge
    try {
      initMeetingDate();
      updateSavedMeetingsBadge();
    } catch (e) {
      console.error('Error initializing meeting date/storage:', e);
    }

    console.log('MinuteAI Frontend initialized successfully.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
