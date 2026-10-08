/**
 * Main Application Controller for Burmese Meeting Minutes AI
 * Coordinates AudioEngine, GeminiClient, StorageManager, DocumentExporter, and UI.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Core Services ---
  const audioEngine = new AudioEngine();
  const storage = new StorageManager();
  const agHelper = new AntigravityHelper();

  // --- App State ---
  const state = {
    currentLang: storage.getSetting('ui_lang', 'my'), // 'my' or 'en'
    currentTab: 'studio',
    currentStudioStep: 1, // 1: Audio, 2: Mode, 3: Generate, 4: Result
    currentSubtab: 'upload',
    selectedMode: 'summary',
    selectedOutputLang: 'bilingual',
    currentAudioBlob: null,
    currentAudioFile: null,
    currentAudioName: '',
    currentTranscriptText: '',
    rawMarkdownResult: '',
    actionItems: [],
    currentMeetingId: null,
    isGenerating: false,
    apiKey: storage.getSetting('api_key', ''),
    selectedModel: storage.getSetting('model', 'gemini-2.5-flash'),
    execMethod: storage.getSetting('exec_method', 'antigravity')
  };

  // --- DOM Elements Cache ---
  const elements = {
    // Header
    langToggleBtn: document.getElementById('langToggleBtn'),
    // Navigation
    navTabs: document.querySelectorAll('.nav-tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    // Studio Stepper
    tabContentStudio: document.getElementById('tabContent-studio'),
    studioStepBar: document.getElementById('studioStepBar'),
    studioStepBtns: document.querySelectorAll('.studio-step-btn'),
    stepCard1: document.getElementById('stepCard1'),
    stepCard2: document.getElementById('stepCard2'),
    stepCard3: document.getElementById('stepCard3'),
    stepCard4: document.getElementById('stepCard4'),
    stepResultDot: document.getElementById('stepResultDot'),
    btnGoToResult: document.getElementById('btnGoToResult'),
    btnNewAudioSession: document.getElementById('btnNewAudioSession'),
    // Subtabs
    subtabBtns: document.querySelectorAll('.sub-tab-btn'),
    subtabPanes: document.querySelectorAll('.subtab-pane'),
    // Audio Upload
    dropzone: document.getElementById('dropzone'),
    audioFileInput: document.getElementById('audioFileInput'),
    browseFileBtn: document.getElementById('browseFileBtn'),
    clearAudioBtn: document.getElementById('clearAudioBtn'),
    // Audio Player
    audioPlayerBox: document.getElementById('audioPlayerBox'),
    audioFileNameDisplay: document.getElementById('audioFileNameDisplay'),
    audioSizeDisplay: document.getElementById('audioSizeDisplay'),
    audioWaveCanvas: document.getElementById('audioWaveCanvas'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    audioSeekSlider: document.getElementById('audioSeekSlider'),
    audioTimeDisplay: document.getElementById('audioTimeDisplay'),
    playbackRateSelect: document.getElementById('playbackRateSelect'),
    // Audio Record
    recordToggleBtn: document.getElementById('recordToggleBtn'),
    recordTimer: document.getElementById('recordTimer'),
    recordVisualizerCanvas: document.getElementById('recordVisualizerCanvas'),
    recordIcon: document.getElementById('recordIcon'),
    recordHint: document.getElementById('recordHint'),
    // Sample & Transcript
    loadSampleBtn: document.getElementById('loadSampleBtn'),
    loadSampleOutputBtn: document.getElementById('loadSampleOutputBtn'),
    transcriptTextInput: document.getElementById('transcriptTextInput'),
    // Settings & Modes
    meetingTitleInput: document.getElementById('meetingTitleInput'),
    outputLanguageSelect: document.getElementById('outputLanguageSelect'),
    modeCards: document.querySelectorAll('.mode-option-card'),
    toggleCustomPromptLink: document.getElementById('toggleCustomPromptLink'),
    customPromptBox: document.getElementById('customPromptBox'),
    customPromptInput: document.getElementById('customPromptInput'),
    // Execution
    apiKeyInput: document.getElementById('apiKeyInput'),
    rememberKeyCheck: document.getElementById('rememberKeyCheck'),
    generateBtn: document.getElementById('generateBtn'),
    generateAgBtn: document.getElementById('generateAgBtn'),
    btnModeAntigravity: document.getElementById('btnModeAntigravity'),
    btnModeApiKey: document.getElementById('btnModeApiKey'),
    execPanelAntigravity: document.getElementById('execPanelAntigravity'),
    execPanelApiKey: document.getElementById('execPanelApiKey'),
    txtBackendlessBadge: document.getElementById('txt-backendlessBadge'),
    bridgeStatusBox: document.getElementById('bridgeStatusBox'),
    txtBridgeStatusLabel: document.getElementById('txt-bridgeStatusLabel'),
    txtBridgeStatusDesc: document.getElementById('txt-bridgeStatusDesc'),
    bridgeStatusBadgeMini: document.getElementById('bridgeStatusBadgeMini'),
    btnQuickBridgeRun: document.getElementById('btnQuickBridgeRun'),
    btnQuickPasteStudio: document.getElementById('btnQuickPasteStudio'),
    btnQuickGeminiWeb: document.getElementById('btnQuickGeminiWeb'),
    btnRunBridgeNow: document.getElementById('btnRunBridgeNow'),
    jumpToAntigravityLink: document.getElementById('jumpToAntigravityLink'),
    statusBanner: document.getElementById('statusBanner'),
    statusBannerTitle: document.getElementById('statusBannerTitle'),
    statusBannerDetail: document.getElementById('statusBannerDetail'),
    btnOpenPasteModal: document.getElementById('btnOpenPasteModal'),
    btnEmptyStatePaste: document.getElementById('btnEmptyStatePaste'),
    pasteModal: document.getElementById('pasteModal'),
    modalPasteInput: document.getElementById('modalPasteInput'),
    btnClosePasteModal: document.getElementById('btnClosePasteModal'),
    btnCancelModal: document.getElementById('btnCancelModal'),
    btnSubmitModalPaste: document.getElementById('btnSubmitModalPaste'),
    cloudNoticeBox: document.getElementById('cloudNoticeBox'),
    txtCloudNoticeTitle: document.getElementById('txt-cloudNoticeTitle'),
    txtCloudNoticeDesc: document.getElementById('txt-cloudNoticeDesc'),
    txtMethod2DevBadge: document.getElementById('txt-method2DevBadge'),
    // Result
    resultCard: document.getElementById('resultCard'),
    resultToolbar: document.querySelector('.result-toolbar'),
    resultTabs: document.querySelectorAll('.result-tab-btn'),
    resultFormattedView: document.getElementById('resultFormattedView'),
    resultRawView: document.getElementById('resultRawView'),
    resultTasksView: document.getElementById('resultTasksView'),
    rawMarkdownEditor: document.getElementById('rawMarkdownEditor'),
    actionItemsContainer: document.getElementById('actionItemsContainer'),
    taskStatsBadge: document.getElementById('taskStatsBadge'),
    wordCountDisplay: document.getElementById('wordCountDisplay'),
    btnCopyResult: document.getElementById('btnCopyResult'),
    btnDownloadWord: document.getElementById('btnDownloadWord'),
    btnDownloadMd: document.getElementById('btnDownloadMd'),
    btnDownloadTxt: document.getElementById('btnDownloadTxt'),
    btnPrintPdf: document.getElementById('btnPrintPdf'),
    btnSaveHistory: document.getElementById('btnSaveHistory'),
    // Mobile Navigation
    mobileQuickJumpBtn: document.getElementById('mobileQuickJumpBtn'),
    mobileJumpIcon: document.getElementById('mobileJumpIcon'),
    txtMobileJump: document.getElementById('txt-mobileJump'),
    // Antigravity Tab
    btnCopyAgPrompt: document.getElementById('btnCopyAgPrompt'),
    agPasteResultInput: document.getElementById('agPasteResultInput'),
    btnFormatPasted: document.getElementById('btnFormatPasted'),
    bridgeStatusBadge: document.getElementById('bridgeStatusBadge'),
    btnCheckBridge: document.getElementById('btnCheckBridge'),
    // History Tab
    historySearchInput: document.getElementById('historySearchInput'),
    historyListContainer: document.getElementById('historyListContainer'),
    btnClearAllHistory: document.getElementById('btnClearAllHistory'),
    // Settings Tab
    settingsApiKeyInput: document.getElementById('settingsApiKeyInput'),
    settingsModelSelect: document.getElementById('settingsModelSelect'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    // Toast
    toast: document.getElementById('toast')
  };

  // --- Initialization ---
  function init() {
    // Populate stored API Key
    if (state.apiKey) {
      elements.apiKeyInput.value = state.apiKey;
      elements.settingsApiKeyInput.value = state.apiKey;
    }
    elements.settingsModelSelect.value = state.selectedModel;

    // Apply initial localization and execution mode
    applyLanguage(state.currentLang);
    setExecMethod(state.execMethod);

    // Bind event handlers
    setupEventListeners();
    setupAudioEvents();

    // Initialize studio step
    switchStudioStep(state.currentStudioStep);

    // Check local bridge status in background
    checkBridgeStatus();
  }

  // --- Internationalization (i18n) Helper ---
  function t(key) {
    const langObj = translations[state.currentLang] || translations.my;
    return langObj[key] || (translations.my[key] || key);
  }

  function applyLanguage(lang) {
    state.currentLang = lang;
    storage.setSetting('ui_lang', lang);

    document.documentElement.lang = lang;
    const dict = translations[lang] || translations.my;

    // Update text content of elements with id="txt-key"
    Object.keys(dict).forEach(key => {
      const el = document.getElementById(`txt-${key}`);
      if (el) {
        el.textContent = dict[key];
      }
    });

    // Check if running on remote / HTTPS host (e.g. Netlify deployment)
    // and maintain cloud zero-dependency badges and titles
    if (agHelper.isRemoteOrHttps()) {
      if (elements.txtBackendlessBadge) {
        elements.txtBackendlessBadge.textContent = dict.backendlessBadgeNetlify;
      }
      if (elements.bridgeStatusBadgeMini) {
        elements.bridgeStatusBadgeMini.textContent = dict.cloudZeroDepBadge;
      }
      if (elements.bridgeStatusBadge) {
        elements.bridgeStatusBadge.textContent = dict.bridgeStatusBadgeCloud;
      }
      if (elements.txtBridgeStatusLabel) {
        elements.txtBridgeStatusLabel.textContent = dict.bridgeStatusModeLabel;
      }
      if (elements.txtBridgeStatusDesc) {
        elements.txtBridgeStatusDesc.textContent = dict.cloudModeDesc;
      }
      if (elements.txtCloudNoticeTitle) {
        elements.txtCloudNoticeTitle.textContent = dict.cloudNoticeTitle;
      }
      if (elements.txtCloudNoticeDesc) {
        elements.txtCloudNoticeDesc.textContent = dict.cloudNoticeDesc;
      }
      if (elements.txtMethod2DevBadge) {
        elements.txtMethod2DevBadge.textContent = dict.method2DevBadge;
      }
    }

    // Update placeholders and options
    elements.meetingTitleInput.placeholder = dict.meetingTitlePlaceholder;
    elements.customPromptInput.placeholder = dict.customPromptPlaceholder;
    elements.apiKeyInput.placeholder = dict.apiKeyPlaceholder;
    if (elements.settingsApiKeyInput) elements.settingsApiKeyInput.placeholder = dict.apiKeyPlaceholder;
    elements.historySearchInput.placeholder = dict.historySearchPlaceholder;
    elements.agPasteResultInput.placeholder = dict.pasteBackPlaceholder;
    if (elements.transcriptTextInput && dict.transcriptInputPlaceholder) {
      elements.transcriptTextInput.placeholder = dict.transcriptInputPlaceholder;
    }
    if (elements.modalPasteInput && dict.modalPastePlaceholder) {
      elements.modalPasteInput.placeholder = dict.modalPastePlaceholder;
    }
    if (elements.rawMarkdownEditor && dict.rawMarkdownPlaceholder) {
      elements.rawMarkdownEditor.placeholder = dict.rawMarkdownPlaceholder;
    }

    // Language select options
    const optBilingual = document.getElementById('opt-langBilingual');
    if (optBilingual) optBilingual.textContent = dict.langBilingual;
    const optPureMy = document.getElementById('opt-langPureMy');
    if (optPureMy) optPureMy.textContent = dict.langPureMy;
    const optEnglish = document.getElementById('opt-langEnglish');
    if (optEnglish) optEnglish.textContent = dict.langEnglish;

    // Update mode titles and descriptions
    Object.keys(AI_MODES).forEach(modeKey => {
      const mode = AI_MODES[modeKey];
      const titleEl = document.getElementById(`modeTitle-${modeKey}`);
      const descEl = document.getElementById(`modeDesc-${modeKey}`);
      if (titleEl) titleEl.textContent = lang === 'my' ? `${mode.nameMy} (${mode.nameEn})` : `${mode.nameEn} (${mode.nameMy})`;
      if (descEl) descEl.textContent = lang === 'my' ? mode.descriptionMy : mode.descriptionEn;
    });

    // Language toggle button text
    const langBtnText = document.getElementById('txt-langToggle');
    if (langBtnText) {
      langBtnText.textContent = lang === 'my' ? 'English' : 'မြန်မာစာ';
    }
  }

  // --- UI Event Handlers ---
  function setupEventListeners() {
    // Language toggle
    elements.langToggleBtn.addEventListener('click', () => {
      const nextLang = state.currentLang === 'my' ? 'en' : 'my';
      applyLanguage(nextLang);
      showToast(nextLang === 'my' ? 'မြန်မာဘာသာသို့ ပြောင်းလဲပြီးပါပြီ' : 'Switched to English interface');
    });

    // Main navigation tabs
    elements.navTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchMainTab(targetTab);
      });
    });

    // Audio Sub-tabs (Upload, Record, Sample)
    elements.subtabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.getAttribute('data-subtab');
        switchAudioSubtab(subtab);
      });
    });

    // AI Mode cards selection
    elements.modeCards.forEach(card => {
      card.addEventListener('click', () => {
        elements.modeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.selectedMode = card.getAttribute('data-mode');
      });
    });

    // Output language change
    elements.outputLanguageSelect.addEventListener('change', (e) => {
      state.selectedOutputLang = e.target.value;
    });

    // Custom prompt toggle
    elements.toggleCustomPromptLink.addEventListener('click', () => {
      elements.customPromptBox.classList.toggle('hidden');
    });

    // API Key input change
    elements.apiKeyInput.addEventListener('input', (e) => {
      state.apiKey = e.target.value.trim();
      if (elements.rememberKeyCheck.checked) {
        storage.setSetting('api_key', state.apiKey);
      }
    });

    // Execution method switcher
    if (elements.btnModeAntigravity && elements.btnModeApiKey) {
      elements.btnModeAntigravity.addEventListener('click', () => setExecMethod('antigravity'));
      elements.btnModeApiKey.addEventListener('click', () => setExecMethod('apikey'));
    }

    // Antigravity Generation Buttons
    if (elements.generateAgBtn) {
      elements.generateAgBtn.addEventListener('click', handleGenerateAntigravity);
    }
    if (elements.btnQuickBridgeRun) {
      elements.btnQuickBridgeRun.addEventListener('click', handleQuickBridgeRun);
    }
    if (elements.btnQuickGeminiWeb) {
      elements.btnQuickGeminiWeb.addEventListener('click', handleQuickGeminiWeb);
    }
    if (elements.btnRunBridgeNow) {
      elements.btnRunBridgeNow.addEventListener('click', handleQuickBridgeRun);
    }

    // Direct Gemini API Key Generate Button
    if (elements.generateBtn) {
      elements.generateBtn.addEventListener('click', handleGenerateMinutes);
    }

    // Jump to Antigravity link
    if (elements.jumpToAntigravityLink) {
      elements.jumpToAntigravityLink.addEventListener('click', () => {
        switchMainTab('antigravity');
      });
    }

    // Results View Tabs (Formatted / Raw Edit / Tasks)
    elements.resultTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.resultTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.getAttribute('data-view');
        switchResultView(view);
      });
    });

    // Raw Markdown Editor changes sync back to formatted view
    elements.rawMarkdownEditor.addEventListener('input', () => {
      state.rawMarkdownResult = elements.rawMarkdownEditor.value;
      updateResultViews();
    });

    // Result Toolbar Actions
    elements.btnCopyResult.addEventListener('click', async () => {
      if (!state.rawMarkdownResult) return;
      await DocumentExporter.copyToClipboard(state.rawMarkdownResult);
      showToast(t('copiedSuccess'));
    });

    elements.btnDownloadWord.addEventListener('click', () => {
      if (!state.rawMarkdownResult) return;
      const title = elements.meetingTitleInput.value.trim() || 'Meeting_Minutes';
      DocumentExporter.downloadWordDoc(title, state.rawMarkdownResult);
    });

    elements.btnDownloadMd.addEventListener('click', () => {
      if (!state.rawMarkdownResult) return;
      const title = elements.meetingTitleInput.value.trim() || 'Meeting_Minutes';
      DocumentExporter.downloadMarkdown(title, state.rawMarkdownResult);
    });

    if (elements.btnDownloadTxt) {
      elements.btnDownloadTxt.addEventListener('click', () => {
        if (!state.rawMarkdownResult) return;
        const title = elements.meetingTitleInput.value.trim() || 'Meeting_Minutes';
        DocumentExporter.downloadPlainText(title, state.rawMarkdownResult);
      });
    }

    elements.btnPrintPdf.addEventListener('click', () => {
      if (!state.rawMarkdownResult) return;
      window.print();
    });

    elements.btnSaveHistory.addEventListener('click', async () => {
      if (!state.rawMarkdownResult) return;
      await saveCurrentMeetingToHistory();
      showToast(t('savedSuccess'));
    });

    // Quick Paste Modal Listeners
    if (elements.btnOpenPasteModal) {
      elements.btnOpenPasteModal.addEventListener('click', openPasteModal);
    }
    if (elements.btnEmptyStatePaste) {
      elements.btnEmptyStatePaste.addEventListener('click', openPasteModal);
    }
    if (elements.btnClosePasteModal) {
      elements.btnClosePasteModal.addEventListener('click', closePasteModal);
    }
    if (elements.btnQuickPasteStudio) {
      elements.btnQuickPasteStudio.addEventListener('click', openPasteModal);
    }
    if (elements.btnCancelModal) {
      elements.btnCancelModal.addEventListener('click', closePasteModal);
    }
    if (elements.btnSubmitModalPaste) {
      elements.btnSubmitModalPaste.addEventListener('click', handleSubmitModalPaste);
    }
    if (elements.pasteModal) {
      elements.pasteModal.addEventListener('click', (e) => {
        if (e.target === elements.pasteModal) {
          closePasteModal();
        }
      });
    }

    // Modal keyboard accessibility
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.pasteModal && !elements.pasteModal.classList.contains('hidden')) {
        closePasteModal();
      }
    });

    if (elements.modalPasteInput) {
      elements.modalPasteInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSubmitModalPaste();
        }
      });
    }

    // Antigravity Tab: Copy Prompt
    elements.btnCopyAgPrompt.addEventListener('click', async () => {
      const textInput = elements.transcriptTextInput ? elements.transcriptTextInput.value.trim() : '';
      const promptBundle = agHelper.buildGeminiWebBundle({
        mode: state.selectedMode,
        language: state.selectedOutputLang,
        uiLang: state.currentLang,
        meetingTitle: elements.meetingTitleInput.value.trim(),
        customPrompt: elements.customPromptInput.value.trim(),
        transcriptText: textInput,
        isAudioInput: !!state.currentAudioBlob || !textInput
      });
      await DocumentExporter.copyToClipboard(promptBundle.fullBundle);
      showToast(state.currentLang === 'my' ? 'Prompt အားလုံးကို Copy ကူးယူပြီးပါပြီ! Gemini Web တွင် Paste လုပ်ပါ' : 'Prompt bundle copied! Paste into Gemini Web');
    });

    // Antigravity Tab: Paste Back & Format
    elements.btnFormatPasted.addEventListener('click', async () => {
      const text = elements.agPasteResultInput.value.trim();
      if (!text) {
        showToast(state.currentLang === 'my' ? 'ကျေးဇူးပြု၍ Gemini မှ အဖြေကို အရင် Paste လုပ်ပါ' : 'Please paste Gemini output first');
        return;
      }
      setGeneratedResult(text);
      await saveCurrentMeetingToHistory();
      switchMainTab('studio');
      showToast(t('alertSuccessGenerated'));
    });

    // Check CLI Bridge button
    elements.btnCheckBridge.addEventListener('click', checkBridgeStatus);

    // History: Clear all
    elements.btnClearAllHistory.addEventListener('click', async () => {
      if (confirm(t('historyConfirmDeleteAll'))) {
        await storage.clearAllMeetings();
        renderHistoryList();
        showToast(state.currentLang === 'my' ? 'မှတ်တမ်းအားလုံး ဖျက်ပြီးပါပြီ' : 'All history cleared');
      }
    });

    // History: Search
    elements.historySearchInput.addEventListener('input', (e) => {
      renderHistoryList(e.target.value.trim().toLowerCase());
    });

    // Settings Tab: Save
    elements.btnSaveSettings.addEventListener('click', () => {
      const key = elements.settingsApiKeyInput.value.trim();
      const model = elements.settingsModelSelect.value;
      state.apiKey = key;
      state.selectedModel = model;
      elements.apiKeyInput.value = key;
      storage.setSetting('api_key', key);
      storage.setSetting('model', model);
      showToast(state.currentLang === 'my' ? 'ချိန်ညှိချက်များ သိမ်းဆည်းပြီးပါပြီ' : 'Settings saved');
    });

    // Mobile Quick Jump Pill
    if (elements.mobileQuickJumpBtn) {
      let isScrolledDown = false;

      function updateJumpBtnState() {
        if (state.currentTab !== 'studio' || !elements.resultCard) return;
        const resultOffset = elements.resultCard.offsetTop;
        const currentScroll = window.scrollY || window.pageYOffset;
        if (state.currentStudioStep === 4 || currentScroll >= resultOffset - 120) {
          if (!isScrolledDown) {
            isScrolledDown = true;
            if (elements.mobileJumpIcon) elements.mobileJumpIcon.textContent = '⬆';
            if (elements.txtMobileJump) elements.txtMobileJump.textContent = t('mobileJumpTop');
          }
        } else {
          if (isScrolledDown) {
            isScrolledDown = false;
            if (elements.mobileJumpIcon) elements.mobileJumpIcon.textContent = '⬇';
            if (elements.txtMobileJump) elements.txtMobileJump.textContent = t('mobileJump');
          }
        }
      }

      window.addEventListener('scroll', updateJumpBtnState, { passive: true });

      elements.mobileQuickJumpBtn.addEventListener('click', () => {
        if (state.currentStudioStep === 4) {
          switchStudioStep(1);
        } else {
          switchStudioStep(4);
        }
      });
    }

    // Studio Stepper Events
    if (elements.studioStepBtns) {
      elements.studioStepBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const step = Number(btn.getAttribute('data-step'));
          if (step) switchStudioStep(step);
        });
      });
    }

    document.querySelectorAll('.btn-step-next').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextStep = Number(btn.getAttribute('data-next-step'));
        if (nextStep) switchStudioStep(nextStep);
      });
    });

    document.querySelectorAll('.btn-step-prev').forEach(btn => {
      btn.addEventListener('click', () => {
        const prevStep = Number(btn.getAttribute('data-prev-step'));
        if (prevStep) switchStudioStep(prevStep);
      });
    });

    if (elements.btnNewAudioSession) {
      elements.btnNewAudioSession.addEventListener('click', () => {
        switchStudioStep(1);
      });
    }

    if (elements.btnGoToResult) {
      elements.btnGoToResult.addEventListener('click', () => {
        switchStudioStep(4);
      });
    }
  }

  // --- Quick Paste Modal Controllers ---
  function openPasteModal() {
    if (!elements.pasteModal) return;
    elements.pasteModal.classList.remove('hidden');
    if (elements.modalPasteInput) {
      elements.modalPasteInput.value = '';
      setTimeout(() => elements.modalPasteInput.focus(), 50);
    }
  }

  function closePasteModal() {
    if (!elements.pasteModal) return;
    elements.pasteModal.classList.add('hidden');
  }

  async function handleSubmitModalPaste() {
    const text = elements.modalPasteInput ? elements.modalPasteInput.value.trim() : '';
    if (!text) {
      alert(state.currentLang === 'my'
        ? 'ကျေးဇူးပြု၍ Gemini မှ ထွက်ရှိလာသော စာသားကို Paste လုပ်ပေးပါ'
        : 'Please paste the generated meeting minutes text.');
      return;
    }

    setGeneratedResult(text);
    await saveCurrentMeetingToHistory();
    closePasteModal();
    if (state.currentTab !== 'studio') {
      switchMainTab('studio');
    }
    switchStudioStep(4);
    showToast(t('alertSuccessGenerated'));
  }

  function switchMainTab(tabId) {
    state.currentTab = tabId;
    elements.navTabs.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    elements.tabPanes.forEach(pane => {
      pane.classList.toggle('hidden', pane.id !== `tabContent-${tabId}`);
      pane.classList.toggle('active', pane.id === `tabContent-${tabId}`);
    });

    if (elements.mobileQuickJumpBtn) {
      elements.mobileQuickJumpBtn.style.display = tabId === 'studio' ? '' : 'none';
    }
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (tabId === 'history') {
      renderHistoryList();
    } else if (tabId === 'antigravity') {
      checkBridgeStatus();
    }
  }

  function switchStudioStep(stepNum) {
    stepNum = Math.max(1, Math.min(4, Number(stepNum)));
    state.currentStudioStep = stepNum;

    if (elements.tabContentStudio) {
      elements.tabContentStudio.setAttribute('data-step', String(stepNum));
    }

    if (elements.studioStepBtns) {
      elements.studioStepBtns.forEach(btn => {
        const bStep = Number(btn.getAttribute('data-step'));
        const isActive = bStep === stepNum;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        btn.classList.toggle('completed', bStep < stepNum || (bStep === 4 && Boolean(state.rawMarkdownResult)));
      });
    }

    // Toggle Go to Result button in Step 3 if result is available
    if (elements.btnGoToResult) {
      elements.btnGoToResult.classList.toggle('hidden', !state.rawMarkdownResult);
    }

    // If mobile quick jump button is visible, update its label and icon
    if (elements.mobileJumpIcon && elements.txtMobileJump) {
      if (stepNum === 4) {
        elements.mobileJumpIcon.textContent = '⬆';
        elements.txtMobileJump.textContent = t('mobileJumpTop');
      } else {
        elements.mobileJumpIcon.textContent = '⬇';
        elements.txtMobileJump.textContent = t('mobileJump');
      }
    }

    // Smooth scroll to top of Studio content when step changes
    if (window.innerWidth <= 960) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function switchAudioSubtab(subtabId) {
    state.currentSubtab = subtabId;
    elements.subtabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-subtab') === subtabId);
    });
    elements.subtabPanes.forEach(pane => {
      pane.classList.toggle('hidden', pane.id !== `subtabContent-${subtabId}`);
      pane.classList.toggle('active', pane.id === `subtabContent-${subtabId}`);
    });
  }

  function switchResultView(view) {
    elements.resultFormattedView.classList.toggle('hidden', view !== 'formatted');
    elements.resultRawView.classList.toggle('hidden', view !== 'raw');
    elements.resultTasksView.classList.toggle('hidden', view !== 'tasks');
  }

  // --- Audio Event Wiring ---
  function setupAudioEvents() {
    // Dropzone drag & drop
    const dropzone = elements.dropzone;
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    dropzone.addEventListener('click', (e) => {
      if (e.target !== elements.browseFileBtn) {
        elements.audioFileInput.click();
      }
    });

    elements.browseFileBtn.addEventListener('click', () => {
      elements.audioFileInput.click();
    });

    elements.audioFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelected(e.target.files[0]);
      }
    });

    // Clear Audio
    elements.clearAudioBtn.addEventListener('click', () => {
      audioEngine.clearAudio();
      state.currentAudioBlob = null;
      state.currentAudioFile = null;
      state.currentAudioName = '';
      elements.audioPlayerBox.classList.add('hidden');
      elements.clearAudioBtn.classList.add('hidden');
      elements.audioFileInput.value = '';
      switchStudioStep(1);
      showToast(state.currentLang === 'my' ? 'အသံဖိုင် ဖယ်ရှားပြီးပါပြီ' : 'Audio cleared');
    });

    // Audio Player Controls
    elements.playPauseBtn.addEventListener('click', async () => {
      const isPlaying = await audioEngine.togglePlay();
      elements.playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
    });

    elements.audioSeekSlider.addEventListener('input', (e) => {
      const fraction = e.target.value / 100;
      audioEngine.seekToProgress(fraction);
    });

    elements.playbackRateSelect.addEventListener('change', (e) => {
      audioEngine.setPlaybackRate(parseFloat(e.target.value));
    });

    audioEngine.onTimeUpdate = ({ currentTime, duration, progress }) => {
      elements.audioSeekSlider.value = progress;
      elements.audioTimeDisplay.textContent = `${audioEngine.formatTime(currentTime)} / ${audioEngine.formatTime(duration)}`;
      drawStaticWaveform(elements.audioWaveCanvas, progress / 100);
    };

    audioEngine.onEnded = () => {
      elements.playPauseBtn.textContent = '▶';
    };

    // Live Recording
    elements.recordToggleBtn.addEventListener('click', async () => {
      if (!audioEngine.isRecording) {
        try {
          await audioEngine.startRecording(elements.recordVisualizerCanvas);
          elements.recordToggleBtn.classList.add('recording');
          elements.recordIcon.textContent = '⏹';
          elements.recordToggleBtn.querySelector('span:last-child').textContent = t('recordStop');
          showToast(state.currentLang === 'my' ? 'အသံဖမ်းနေပါသည်...' : 'Recording started...');
        } catch (err) {
          alert('Microphone error: ' + err.message);
        }
      } else {
        const recordedBlob = await audioEngine.stopRecording();
        elements.recordToggleBtn.classList.remove('recording');
        elements.recordIcon.textContent = '⏺';
        elements.recordToggleBtn.querySelector('span:last-child').textContent = t('recordStart');
        if (recordedBlob) {
          handleFileSelected(recordedBlob, "Live_Recording.webm");
          showToast(state.currentLang === 'my' ? 'အသံဖမ်းပြီးပါပြီ!' : 'Recording stopped & loaded!');
        }
      }
    });

    audioEngine.onRecordingProgress = ({ formattedTime }) => {
      elements.recordTimer.textContent = formattedTime;
    };

    audioEngine.onSpeechTranscript = (recognizedText) => {
      elements.transcriptTextInput.value = recognizedText;
      state.currentTranscriptText = recognizedText;
    };

    audioEngine.onError = () => {
      showToast(t('audioDecodeError'));
    };

    // Sample Loader
    elements.loadSampleBtn.addEventListener('click', () => {
      const demoBlob = createSyntheticDemoAudio();
      handleFileSelected(demoBlob, SAMPLE_MEETING.audioFileName);
      elements.meetingTitleInput.value = state.currentLang === 'my' ? SAMPLE_MEETING.title : SAMPLE_MEETING.titleEn;
      elements.transcriptTextInput.value = SAMPLE_MEETING.rawTranscript;
      showToast(state.currentLang === 'my' ? 'နမူနာ အစည်းအဝေး အသံဖိုင်နှင့် စာသားများ ထည့်သွင်းပြီးပါပြီ!' : 'Sample meeting loaded successfully!');
    });

    if (elements.loadSampleOutputBtn) {
      elements.loadSampleOutputBtn.addEventListener('click', () => {
        const sampleOutput = (SAMPLE_MEETING.sampleOutputs && SAMPLE_MEETING.sampleOutputs[state.selectedMode]) || (SAMPLE_MEETING.sampleOutputs && SAMPLE_MEETING.sampleOutputs.summary);
        elements.meetingTitleInput.value = state.currentLang === 'my' ? SAMPLE_MEETING.title : SAMPLE_MEETING.titleEn;
        if (sampleOutput) {
          setGeneratedResult(sampleOutput);
          switchStudioStep(4);
          showToast(state.currentLang === 'my' ? 'နမူနာ အစည်းအဝေး ရလဒ်ကို ဖွင့်ပြထားပါသည်!' : 'Sample meeting minutes loaded!');
        }
      });
    }
  }

  function handleFileSelected(fileOrBlob, defaultName = "audio.mp3") {
    state.currentAudioBlob = fileOrBlob;
    state.currentAudioFile = fileOrBlob instanceof File ? fileOrBlob : null;
    state.currentAudioName = fileOrBlob.name || defaultName;

    const meta = audioEngine.loadAudio(fileOrBlob);

    elements.audioFileNameDisplay.textContent = state.currentAudioName;
    elements.audioSizeDisplay.textContent = meta.sizeFormatted;
    elements.audioPlayerBox.classList.remove('hidden');
    elements.clearAudioBtn.classList.remove('hidden');
    elements.playPauseBtn.textContent = '▶';

    drawStaticWaveform(elements.audioWaveCanvas, 0);
  }

  function drawStaticWaveform(canvas, progress = 0) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, width, height);

    const barCount = 60;
    const barWidth = width / barCount;
    const activeBarIndex = Math.floor(progress * barCount);

    for (let i = 0; i < barCount; i++) {
      // Deterministic synthetic waveform heights
      const hNorm = 0.2 + 0.7 * Math.abs(Math.sin((i * 12.34) + 1.5) * Math.cos(i * 0.4));
      const barHeight = hNorm * height * 0.8;
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillStyle = i <= activeBarIndex ? '#38bdf8' : '#334155';
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
    }
  }

  // --- Generation Workflow ---
  // --- Execution Method Switcher ---
  function setExecMethod(method) {
    state.execMethod = method;
    storage.setSetting('exec_method', method);

    if (elements.btnModeAntigravity && elements.btnModeApiKey) {
      elements.btnModeAntigravity.classList.toggle('active-method', method === 'antigravity');
      elements.btnModeAntigravity.classList.toggle('btn-secondary', method === 'antigravity');
      elements.btnModeAntigravity.classList.toggle('btn-outline', method !== 'antigravity');

      elements.btnModeApiKey.classList.toggle('active-method', method === 'apikey');
      elements.btnModeApiKey.classList.toggle('btn-secondary', method === 'apikey');
      elements.btnModeApiKey.classList.toggle('btn-outline', method !== 'apikey');
    }

    if (elements.execPanelAntigravity && elements.execPanelApiKey) {
      elements.execPanelAntigravity.classList.toggle('hidden', method !== 'antigravity');
      elements.execPanelApiKey.classList.toggle('hidden', method !== 'apikey');
    }
  }

  // --- Generation Workflow ---

  /**
   * Primary Zero-API-Key Antigravity Workflow
   */
  async function handleGenerateAntigravity() {
    if (state.isGenerating) return;

    const textInput = elements.transcriptTextInput.value.trim();
    if (!state.currentAudioBlob && !textInput) {
      alert(t('alertNoAudio'));
      return;
    }

    // Check if CLI Bridge is active
    const health = await checkBridgeStatus();
    if (!health.isRemote && health.available) {
      await runViaBridge(textInput);
    } else {
      await handleQuickGeminiWeb();
    }
  }

  async function handleQuickBridgeRun() {
    if (state.isGenerating) return;

    const health = await checkBridgeStatus();
    if (health.isRemote) {
      alert(t('localBridgeDisabledRemote'));
      return;
    }

    const textInput = elements.transcriptTextInput.value.trim();
    if (!state.currentAudioBlob && !textInput) {
      alert(t('alertNoAudio'));
      return;
    }

    if (!health.available) {
      alert(t('bridgeSetupHelp'));
      return;
    }

    await runViaBridge(textInput);
  }

  async function runViaBridge(textInput) {
    state.isGenerating = true;
    showGeneratingStatus(true, t('bridgeRunningText'));

    try {
      const prompt = buildGeminiPrompt({
        mode: state.selectedMode,
        language: state.selectedOutputLang,
        meetingTitle: elements.meetingTitleInput.value.trim(),
        customPrompt: elements.customPromptInput.value.trim(),
        isAudioInput: !!state.currentAudioBlob
      });

      let fullPrompt = prompt;
      if (textInput) {
        fullPrompt = `MEETING TRANSCRIPT / RECORDING NOTES:\n${textInput}\n\n${prompt}`;
      } else if (state.currentAudioName) {
        fullPrompt = `MEETING RECORDING FILE: ${state.currentAudioName}\n${prompt}`;
      }

      // Hand the recording to the bridge as a real file: the CLI reads it from
      // its own working directory. The Gemini API model id is intentionally not
      // forwarded — the CLI uses the model configured in your Antigravity login.
      const payload = await agHelper.buildCliPayload({
        prompt: fullPrompt,
        audioBlob: state.currentAudioBlob,
        audioName: state.currentAudioName,
        audioMimeType: state.currentAudioBlob ? state.currentAudioBlob.type : undefined
      });

      elements.statusBannerDetail.textContent = payload.audio
        ? t('bridgeUploadingAudioText')
        : t('bridgeRunningText');

      const generated = await agHelper.executeViaLocalBridge(payload);

      setGeneratedResult(generated);
      await saveCurrentMeetingToHistory();
      if (state.currentTab !== 'studio') {
        switchMainTab('studio');
      }
      showToast(t('alertSuccessGenerated'));

    } catch (err) {
      console.error("Bridge generation error:", err);
      alert(t('alertError') + err.message);
    } finally {
      state.isGenerating = false;
      showGeneratingStatus(false);
    }
  }

  async function handleQuickGeminiWeb() {
    const textInput = elements.transcriptTextInput.value.trim();
    const bundle = agHelper.buildGeminiWebBundle({
      mode: state.selectedMode,
      language: state.selectedOutputLang,
      uiLang: state.currentLang,
      meetingTitle: elements.meetingTitleInput.value.trim(),
      customPrompt: elements.customPromptInput.value.trim(),
      transcriptText: textInput,
      isAudioInput: !!state.currentAudioBlob
    });

    try {
      await DocumentExporter.copyToClipboard(bundle.fullBundle);
    } catch (e) {
      // handled
    }

    switchMainTab('antigravity');
    showToast(t('promptCopiedToast'));
  }

  /**
   * Direct Gemini API Key Generation (Optional)
   */
  async function handleGenerateMinutes() {
    if (state.isGenerating) return;

    // Check input: audio or transcript
    const textInput = elements.transcriptTextInput.value.trim();
    if (!state.currentAudioBlob && !textInput) {
      alert(t('alertNoAudio'));
      return;
    }

    // Check API Key
    const apiKey = elements.apiKeyInput.value.trim() || state.apiKey;
    if (!apiKey) {
      alert(t('alertNoApiKey'));
      return;
    }

    state.isGenerating = true;
    showGeneratingStatus(true, t('generatingText'));

    try {
      const prompt = buildGeminiPrompt({
        mode: state.selectedMode,
        language: state.selectedOutputLang,
        meetingTitle: elements.meetingTitleInput.value.trim(),
        customPrompt: elements.customPromptInput.value.trim(),
        isAudioInput: !!state.currentAudioBlob
      });

      const generated = await generateWithGemini({
        apiKey: apiKey,
        model: state.selectedModel,
        prompt: prompt,
        audioBlob: state.currentAudioBlob,
        textInput: textInput,
        onProgress: (statusMsg) => {
          elements.statusBannerDetail.textContent = statusMsg;
        }
      });

      setGeneratedResult(generated);
      await saveCurrentMeetingToHistory();
      showToast(t('alertSuccessGenerated'));

    } catch (err) {
      console.error("Generation error:", err);
      alert(t('alertError') + err.message);
    } finally {
      state.isGenerating = false;
      showGeneratingStatus(false);
    }
  }

  function showGeneratingStatus(show, title = '') {
    if (show) {
      elements.statusBannerTitle.textContent = title;
      elements.statusBanner.classList.remove('hidden');
      switchStudioStep(4);
      [elements.generateBtn, elements.generateAgBtn, elements.btnQuickBridgeRun].forEach(btn => {
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = '0.6';
        }
      });
    } else {
      elements.statusBanner.classList.add('hidden');
      [elements.generateBtn, elements.generateAgBtn, elements.btnQuickBridgeRun].forEach(btn => {
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      });
    }
  }

  function setGeneratedResult(markdown) {
    state.rawMarkdownResult = markdown;
    elements.rawMarkdownEditor.value = markdown;
    state.currentMeetingId = null; // New record

    if (elements.stepResultDot) elements.stepResultDot.classList.remove('hidden');
    if (elements.btnGoToResult) elements.btnGoToResult.classList.remove('hidden');

    // Auto-extract title from top heading if user left meeting title input blank
    if (elements.meetingTitleInput && !elements.meetingTitleInput.value.trim() && markdown) {
      const headingMatch = markdown.match(/^#+\s+(.+)$/m);
      if (headingMatch) {
        const cleanTitle = headingMatch[1].replace(/[*_#]/g, '').trim();
        if (cleanTitle) {
          elements.meetingTitleInput.value = cleanTitle;
        }
      }
    }

    updateResultViews();
  }

  function updateResultViews() {
    const md = state.rawMarkdownResult;

    // 1. Formatted HTML
    const html = DocumentExporter.markdownToHtml(md);
    elements.resultFormattedView.innerHTML = html;

    // Wire up interactive task checkboxes in formatted view
    elements.resultFormattedView.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const li = cb.closest('.task-item');
        if (li) {
          li.classList.toggle('completed', cb.checked);
        }
      });
    });

    // 2. Action Items
    const items = DocumentExporter.extractActionItems(md);
    state.actionItems = items;
    renderActionItemsChecklist(items);

    // 3. Word Count
    const words = md.trim() ? md.trim().split(/\s+/).length : 0;
    elements.wordCountDisplay.textContent = words;
  }

  function renderActionItemsChecklist(items) {
    const container = elements.actionItemsContainer;
    container.innerHTML = '';

    if (!items || items.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">${state.currentLang === 'my' ? 'ဤမှတ်တမ်းတွင် သီးသန့်ထုတ်ယူထားသော လုပ်ဆောင်ရန် တာဝန်များ မတွေ့ရှိသေးပါ။' : 'No structured action items table found in this text.'}</p>`;
      elements.taskStatsBadge.textContent = '0 / 0';
      return;
    }

    let completedCount = 0;
    const list = document.createElement('ul');
    list.className = 'minutes-task-list';

    const ownerLabel = state.currentLang === 'my' ? 'တာဝန်ခံ' : 'Owner';
    const dueLabel = state.currentLang === 'my' ? 'ရက်' : 'Due';
    const priorityLabel = state.currentLang === 'my' ? 'ဦးစားပေး' : 'Priority';

    items.forEach((item, idx) => {
      if (item.completed) completedCount++;

      const li = document.createElement('li');
      li.className = `task-item ${item.completed ? 'completed' : ''}`;

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = !!item.completed;

      checkbox.addEventListener('change', () => {
        item.completed = checkbox.checked;
        li.classList.toggle('completed', item.completed);
        updateTaskStats(items);
      });

      const priorityBadge = (item.priority && item.priority !== '-')
        ? ` &bull; <small style="color:#f59e0b;">${priorityLabel}: ${escapeHtml(item.priority)}</small>`
        : '';

      const span = document.createElement('span');
      // Escape HTML on item.task, item.owner, item.due to prevent XSS injection
      span.innerHTML = `<strong>${escapeHtml(item.task)}</strong> &bull; <small style="color:#38bdf8;">${ownerLabel}: ${escapeHtml(item.owner)}</small> &bull; <small style="color:#cbd5e1;">${dueLabel}: ${escapeHtml(item.due)}</small>${priorityBadge}`;

      label.appendChild(checkbox);
      label.appendChild(span);
      li.appendChild(label);
      list.appendChild(li);
    });

    container.appendChild(list);
    updateTaskStats(items);
  }

  function updateTaskStats(items) {
    const total = items.length;
    const completed = items.filter(i => i.completed).length;
    elements.taskStatsBadge.textContent = `${completed} / ${total} ${state.currentLang === 'my' ? 'ပြီးစီး' : 'Done'}`;
  }

  // --- History Management ---
  async function saveCurrentMeetingToHistory() {
    if (!state.rawMarkdownResult) return;

    const title = elements.meetingTitleInput.value.trim() || 'Untitled Meeting';
    const record = await storage.saveMeeting({
      id: state.currentMeetingId,
      title: title,
      mode: state.selectedMode,
      language: state.selectedOutputLang,
      content: state.rawMarkdownResult,
      audioName: state.currentAudioName,
      actionItems: state.actionItems
    });

    state.currentMeetingId = record.id;
    return record;
  }

  async function renderHistoryList(filterQuery = '') {
    const container = elements.historyListContainer;
    container.innerHTML = '<div style="text-align:center; padding:2rem;"><div class="spinner"></div></div>';

    const meetings = await storage.getAllMeetings();
    container.innerHTML = '';

    const filtered = meetings.filter(m => {
      if (!filterQuery) return true;
      return (m.title && m.title.toLowerCase().includes(filterQuery)) ||
             (m.content && m.content.toLowerCase().includes(filterQuery));
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding:3rem 0;">${t('historyEmpty')}</p>`;
      return;
    }

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = 'history-item-card';

      const dateStr = new Date(m.timestamp).toLocaleDateString(state.currentLang === 'my' ? 'my-MM' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const modeObj = AI_MODES[m.mode] || AI_MODES.detailed;
      const modeName = state.currentLang === 'my' ? modeObj.nameMy : modeObj.nameEn;

      card.innerHTML = `
        <div style="flex:1; cursor:pointer;" class="history-content-click">
          <div class="history-meta-title">${escapeHtml(m.title)}</div>
          <div class="history-meta-sub">
            <span>📅 ${dateStr}</span>
            <span>🎯 ${modeName}</span>
            ${m.audioName ? `<span>🎙️ ${escapeHtml(m.audioName)}</span>` : ''}
          </div>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-secondary btn-sm btn-load-history" title="${t('loadRecord')}">
            ↗ ${t('loadRecord')}
          </button>
          <button class="btn btn-outline btn-sm btn-delete-history" style="color:#f87171; border-color:rgba(248,113,113,0.3);" title="${t('deleteRecord')}">
            ✕
          </button>
        </div>
      `;

      card.querySelector('.history-content-click').addEventListener('click', () => loadMeetingIntoStudio(m));
      card.querySelector('.btn-load-history').addEventListener('click', () => loadMeetingIntoStudio(m));
      card.querySelector('.btn-delete-history').addEventListener('click', async () => {
        if (confirm(t('historyConfirmDelete'))) {
          await storage.deleteMeeting(m.id);
          renderHistoryList(elements.historySearchInput.value.trim().toLowerCase());
          showToast(state.currentLang === 'my' ? 'မှတ်တမ်း ဖျက်ပြီးပါပြီ' : 'Record deleted');
        }
      });

      container.appendChild(card);
    });
  }

  function loadMeetingIntoStudio(meeting) {
    state.currentMeetingId = meeting.id;
    state.selectedMode = meeting.mode || 'detailed';
    state.selectedOutputLang = meeting.language || 'bilingual';
    elements.meetingTitleInput.value = meeting.title || '';
    elements.outputLanguageSelect.value = state.selectedOutputLang;

    // Update active mode card
    elements.modeCards.forEach(c => {
      c.classList.toggle('active', c.getAttribute('data-mode') === state.selectedMode);
    });

    setGeneratedResult(meeting.content || '');

    switchMainTab('studio');
    switchStudioStep(4);
    showToast(state.currentLang === 'my' ? 'မှတ်တမ်း ပြန်လည်ဖွင့်လိုက်ပါပြီ' : 'Meeting loaded into studio');
  }

  // --- Antigravity Bridge Status ---
  async function checkBridgeStatus() {
    const isRemote = agHelper.isRemoteOrHttps();

    if (isRemote) {
      if (elements.bridgeStatusBadgeMini) {
        elements.bridgeStatusBadgeMini.textContent = t('cloudZeroDepBadge');
        elements.bridgeStatusBadgeMini.style.color = '#38bdf8';
        elements.bridgeStatusBadgeMini.style.backgroundColor = 'rgba(2, 132, 199, 0.2)';
      }
      if (elements.bridgeStatusBadge) {
        elements.bridgeStatusBadge.textContent = t('bridgeStatusBadgeCloud');
        elements.bridgeStatusBadge.style.color = '#38bdf8';
        elements.bridgeStatusBadge.style.backgroundColor = 'rgba(2, 132, 199, 0.2)';
      }
      if (elements.txtBackendlessBadge) {
        elements.txtBackendlessBadge.textContent = t('backendlessBadgeNetlify');
      }
      if (elements.txtBridgeStatusLabel) {
        elements.txtBridgeStatusLabel.textContent = t('bridgeStatusModeLabel');
      }
      if (elements.txtBridgeStatusDesc) {
        elements.txtBridgeStatusDesc.textContent = t('cloudModeDesc');
      }
      if (elements.cloudNoticeBox) {
        elements.cloudNoticeBox.classList.remove('hidden');
      }
      if (elements.txtCloudNoticeTitle) {
        elements.txtCloudNoticeTitle.textContent = t('cloudNoticeTitle');
      }
      if (elements.txtCloudNoticeDesc) {
        elements.txtCloudNoticeDesc.textContent = t('cloudNoticeDesc');
      }
      if (elements.txtMethod2DevBadge) {
        elements.txtMethod2DevBadge.textContent = t('method2DevBadge');
      }
      if (elements.btnQuickBridgeRun) {
        elements.btnQuickBridgeRun.classList.add('hidden');
      }
      if (elements.btnQuickPasteStudio) {
        elements.btnQuickPasteStudio.classList.remove('hidden');
      }
      return {
        available: false,
        authenticated: false,
        isRemote: true,
        reason: 'remote_or_https'
      };
    }

    if (elements.btnQuickBridgeRun) {
      elements.btnQuickBridgeRun.classList.remove('hidden');
    }
    if (elements.btnQuickPasteStudio) {
      elements.btnQuickPasteStudio.classList.add('hidden');
    }

    const badges = [elements.bridgeStatusBadge, elements.bridgeStatusBadgeMini].filter(Boolean);
    badges.forEach(badge => {
      badge.textContent = state.currentLang === 'my' ? 'စစ်ဆေးနေပါသည်...' : 'Checking...';
      badge.style.color = '#38bdf8';
    });

    const health = await agHelper.checkBridgeHealth();

    badges.forEach(badge => {
      if (health.available) {
        badge.textContent = state.currentLang === 'my' ? 'ချိတ်ဆက်မိပါသည် (Active)' : 'Connected (Active)';
        badge.style.color = '#34d399';
        badge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
      } else {
        badge.textContent = state.currentLang === 'my' ? 'ချိတ်ဆက်မထားပါ (Offline)' : 'Disconnected (Offline)';
        badge.style.color = '#94a3b8';
        badge.style.backgroundColor = 'rgba(148, 163, 184, 0.1)';
      }
    });

    return health;
  }

  // --- Utility Toast ---
  let toastTimeout;
  function showToast(message) {
    const toast = elements.toast;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Run start
  init();
});
