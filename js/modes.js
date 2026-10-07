/**
 * AI Modes & Specialized Prompt Engineering for Burmese Meeting Minutes
 * Supports 6 distinct meeting minutes modes, 3 language outputs, and custom instructions.
 */

const AI_MODES = {
  summary: {
    id: "summary",
    nameEn: "Executive Summary",
    nameMy: "အကျဉ်းချုပ် အစီရင်ခံစာ",
    icon: "📌",
    descriptionEn: "High-level brief, key takeaways, crucial decisions, and executive wrap-up",
    descriptionMy: "အဓိက သဘောတူညီချက်များ၊ ဆုံးဖြတ်ချက်များနှင့် အနှစ်ချုပ်ကို အကျဉ်းရုံးဖော်ပြခြင်း",
    promptInstruction: `Focus on delivering a concise, high-impact Executive Summary:
1. Executive Overview (အစည်းအဝေး အနှစ်ချုပ် သုံးသပ်ချက်) - 2-3 concise paragraphs summarizing the purpose and key outcomes.
2. Key Takeaways & Milestones (အဓိက အရေးကြီး ရလဒ်များ) - 5-7 bullet points of pivotal points discussed.
3. Critical Decisions Ratified (အတည်ပြုခဲ့သော အဓိက ဆုံးဖြတ်ချက်များ) - Clear bullet points of what was decided.
4. Immediate Next Steps (ချက်ချင်း ဆောင်ရွက်ရမည့် အစီအမံများ) - Key high-level priorities.`
  },

  detailed: {
    id: "detailed",
    nameEn: "Detailed Minutes",
    nameMy: "အသေးစိတ် မှတ်တမ်း",
    icon: "📝",
    descriptionEn: "Comprehensive chronological breakdown by agenda, speakers, and discussions",
    descriptionMy: "အစီအစဉ်အလိုက် ဆွေးနွေးချက်များ၊ တင်ပြသူများနှင့် ဆွေးနွေးမှုအသေးစိတ်ကို အပြည့်အစုံ ရေးသားခြင်း",
    promptInstruction: `Focus on delivering Comprehensive, Topic-by-Topic Detailed Meeting Minutes:
1. Meeting Meta (ခေါင်းစဉ်၊ နေ့ရက်၊ အချိန်၊ တက်ရောက်သူများစာရင်း).
2. Agenda-by-Agenda Deliberations (အစီအစဉ်အလိုက် ဆွေးနွေးချက်များ):
   - For each topic discussed, specify:
     * Topic Title (ဆွေးနွေးသည့် အကြောင်းအရာ)
     * Presenter / Key Speakers & Perspectives (တင်ပြသူနှင့် ဆွေးနွေးချက်များ)
     * Arguments, counter-arguments, and rationales given (အပြန်အလှန် သဘောထားများ)
     * Conclusion / Consensus reached on this agenda (ရရှိသော သဘောတူညီချက်)
3. Formal Resolutions & Decisions (အတည်ပြု ဆုံးဖြတ်ချက်များ).
4. Departmental / Team Updates (သက်ဆိုင်ရာ ဌာန/အဖွဲ့အလိုက် တင်ပြချက်များ).
5. Open Issues / Deferred Items (နောက်တစ်ကြိမ်သို့ ရွှေ့ဆိုင်းသည့် အချက်များ).`
  },

  action_items: {
    id: "action_items",
    nameEn: "Action Items & Decisions",
    nameMy: "လုပ်ဆောင်ရန်များနှင့် ဆုံးဖြတ်ချက်များ",
    icon: "✅",
    descriptionEn: "Actionable tasks table with assignees, deadlines, priorities, and formal resolutions",
    descriptionMy: "တာဝန်ခွဲဝေမှု၊ တာဝန်ခံ (Assignee)၊ ပြီးစီးရမည့်ရက် (Deadline) နှင့် ဆုံးဖြတ်ချက်များ ဇယား",
    promptInstruction: `Focus specifically on Extracting and Structuring all Action Items and Formal Decisions:
1. Executive Decision Summary (အတည်ပြု ဆုံးဖြတ်ချက်များ):
   - Numbered list of all explicit decisions agreed upon by the attendees.
2. Action Items Table (လုပ်ဆောင်ရန် တာဝန်များ ဇယား):
   - Format strictly as a Markdown table with the following columns:
     | စဉ် (No.) | လုပ်ဆောင်ရန် တာဝန် (Action Item / Task) | တာဝန်ခံ (Owner / Assignee) | သတ်မှတ်ရက် (Due Date / Deadline) | ဦးစားပေး (Priority: မြင့်/အလယ်/နိမ့်) | မှတ်ချက် (Notes / Status) |
3. Follow-up Checkpoints (နောက်ဆက်တွဲ စစ်ဆေးမည့် အစီအစဉ်) - Who checks what and when.`
  },

  discussion: {
    id: "discussion",
    nameEn: "Discussion & Q&A Breakdown",
    nameMy: "ဆွေးနွေးချက်များနှင့် အမေးအဖြေ",
    icon: "🗣️",
    descriptionEn: "Key questions asked, answers given, debates, and unresolved open topics",
    descriptionMy: "အစည်းအဝေးတွင် မေးမြန်းခဲ့သော မေးခွန်းများ၊ ဖြေဆိုချက်များနှင့် မပြေလည်သေးသော အချက်များ",
    promptInstruction: `Focus on capturing the Interactive Dynamics, Debates, and Q&A during the meeting:
1. Core Questions Asked & Answers Given (အဓိက အမေးနှင့် အဖြေများ):
   - Format:
     * Q: [Question asked and who raised it if identifiable]
     * A: [Explanation/answer given and by whom]
2. Major Debates & Divergent Opinions (အငြင်းပွားဖွယ် အချက်များနှင့် ကွဲလွဲသော သဘောထားများ):
   - Nuances of differing perspectives before consensus was reached.
3. Clarifications & Technical Explanations (ရှင်းလင်းတင်ပြချက်များနှင့် နည်းပညာဆိုင်ရာ အချက်အလက်များ).
4. Unresolved Inquiries (အဖြေမရသေးဘဲ စုံစမ်းရန် ကျန်ရှိနေသော မေးခွန်းများ).`
  },

  formal: {
    id: "formal",
    nameEn: "Formal Corporate Minutes",
    nameMy: "တရားဝင် ရုံးသုံး မှတ်တမ်း",
    icon: "📋",
    descriptionEn: "Standard corporate template with organization header, attendees, agenda, resolutions, and sign-offs",
    descriptionMy: "အဖွဲ့အစည်း၊ နေ့စွဲ၊ တက်ရောက်သူ၊ ဥက္ကဋ္ဌ၊ အတွင်းရေးမှူး နှင့် လက်မှတ်ရေးထိုးရန် နေရာပါဝင်သော စံပုံစံ",
    promptInstruction: `Format strictly according to Formal Corporate / Institutional Meeting Minutes Standards:
1. Organization / Company Header (ကုမ္ပဏီ / အဖွဲ့အစည်း အမည်).
2. Formal Meeting Details (အစည်းအဝေး အမှတ်စဉ်၊ နေ့ရက်၊ အချိန်၊ နေရာ / Zoom).
3. Attendance Record:
   - Present (တက်ရောက်သူများ: အမည်၊ ရာထူး)
   - Apologies / Absent with Permission (ခွင့်ပန်သူများ)
   - In Attendance / Observers (လေ့လာသူများ)
4. Opening of Meeting by Chairperson (သဘာပတိမှ အစည်းအဝေး ဖွင့်လှစ်ခြင်း).
5. Confirmation of Previous Minutes (ယခင် အစည်းအဝေးမှတ်တမ်း အတည်ပြုခြင်း).
6. Matters Arising from Previous Minutes (ယခင်မှတ်တမ်းပါ ဆောင်ရွက်ချက်များ ပြန်လည်သုံးသပ်ခြင်း).
7. Agenda Items & Deliberations (အစီအစဉ်အလိုက် ဆွေးနွေးချက်များနှင့် ဆုံးဖြတ်ချက်များ).
8. Any Other Business (AOB - အထွေထွေ ဆွေးနွေးချက်များ).
9. Next Meeting Date & Adjournment (နောက်အစည်းအဝေး ကျင်းပမည့်ရက်နှင့် အစည်းအဝေး ပြီးဆုံးခြင်း).
10. Official Sign-off Block:
    - Prepared by / Secretary (အတွင်းရေးမှူး / မှတ်တမ်းတင်သူ)
    - Approved by / Chairperson (သဘာပတိ / ဥက္ကဋ္ဌ)`
  },

  transcript: {
    id: "transcript",
    nameEn: "Cleaned Full Transcript",
    nameMy: "သန့်စင်ပြီး စာသား အပြည့်အစုံ",
    icon: "📜",
    descriptionEn: "Full cleaned speech-to-text transcript with speaker tags and timeline markers",
    descriptionMy: "အသံဖိုင်မှ ပြောဆိုခဲ့သည်များကို စကားလုံးအလိုက် သန့်စင်ပြီး အချိန်မှတ်တမ်းနှင့်အတူ ရေးသားခြင်း",
    promptInstruction: `Focus on providing a Cleaned, Verbatim-Accurate Transcript of the spoken audio:
1. Transcribe what was spoken chronologically.
2. Label speakers clearly (Speaker 1 / စကားပြောသူ ၁, Speaker 2 / စကားပြောသူ ၂, or names if mentioned in the meeting).
3. Include approximate timestamp checkpoints (e.g. [00:00], [05:00], [10:00]).
4. Remove stuttering, accidental false starts, and filler sounds (e.g. အဲ, ဟို, အင်း) while preserving the exact technical vocabulary and substantive meaning.
5. Punctuate properly with Myanmar comma (၊) and full stop (။).`
  }
};

/**
 * Builds the complete system prompt and instructions for Gemini.
 *
 * @param {Object} options
 * @param {string} options.mode - One of the AI_MODES keys ('summary', 'detailed', 'action_items', 'discussion', 'formal', 'transcript')
 * @param {string} options.language - 'pure_my', 'bilingual', or 'english'
 * @param {string} options.meetingTitle - Optional title for the meeting
 * @param {string} options.customPrompt - Optional custom user instructions
 * @param {boolean} options.isAudioInput - Whether input is audio or text transcript
 * @returns {string} The complete crafted prompt.
 */
function buildGeminiPrompt(options = {}) {
  const modeKey = options.mode || 'detailed';
  const modeObj = AI_MODES[modeKey] || AI_MODES.detailed;
  const lang = options.language || 'bilingual';
  const title = (options.meetingTitle || '').trim();
  const custom = (options.customPrompt || '').trim();
  const isAudio = options.isAudioInput !== false;

  let langDirective = '';
  if (lang === 'pure_my') {
    langDirective = `LANGUAGE REQUIREMENT:
- Write the entire meeting minutes in clean, professional Burmese (မြန်မာဘာသာ သီးသန့်).
- Use standard Myanmar Unicode script and formal business terminology.
- If common English words were spoken, provide the standard Burmese equivalent with natural flow.`;
  } else if (lang === 'english') {
    langDirective = `LANGUAGE REQUIREMENT:
- The spoken audio is in Burmese (Myanmar), but you must produce the FINAL OUTPUT IN PROFESSIONAL ENGLISH.
- Translate all discussions, ideas, and decisions accurately into fluent, standard corporate English meeting minutes.
- Retain Myanmar names, designations, and specific local context accurately.`;
  } else {
    // bilingual (default)
    langDirective = `LANGUAGE REQUIREMENT (BILINGUAL / BUSINESS BURMESE):
- Write primarily in professional Burmese (မြန်မာဘာသာ).
- Retain commonly used English technical, IT, management, and financial business terms naturally (e.g., "Project Timeline", "Budget", "Deadline", "Client", "KPI", "API", "Marketing", "Sprint", "Review", "Feedback", "Invoice", "Approval", "Contract").
- Do NOT force unnatural transliterations for well-known English business terms; write them cleanly in English or Burmese as standard in modern Myanmar business workplaces.`;
  }

  const prompt = `You are an elite, highly professional Executive Assistant and Meeting Secretary specializing in Myanmar (Burmese) corporate, organizational, and technical meetings.

INPUT CONTEXT:
${isAudio ? 'You are receiving an AUDIO RECORDING of a meeting conducted primarily or partly in the Burmese (Myanmar) language.' : 'You are receiving a text record or transcript of a meeting conducted primarily or partly in the Burmese language.'}
${title ? `MEETING TITLE / TOPIC: "${title}"` : 'MEETING TITLE: Automatically identify or provide an appropriate title based on the audio discussion.'}

${langDirective}

CRITICAL RULES FOR ACCURACY IN BURMESE:
1. AUDIO COMPREHENSION: Listen carefully to Burmese speech nuances, colloquial phrasing, tone, and speech particles (ပါ၊ ခင်ဗျာ၊ ရှင်၊ ပါတယ်).
2. SPEAKER IDENTIFICATION: Attribute points to speakers when identifiable (e.g. ဦးဇော်၊ ဒေါ်ခင်၊ Speaker A, Director, Finance Manager). If names are not introduced, use descriptive titles or Speaker 1, Speaker 2.
3. FACTUAL INTEGRITY: Strictly record what was actually discussed and decided. Never invent facts, numbers, dates, or decisions that were not mentioned.
4. FORMATTING: Use structured Markdown with clear headings (##, ###), bullet points, bold highlights, and tables where requested.
5. NUMBERS & CURRENCIES: Keep figures, percentages, dates, and amounts (MMK / ကျပ်, USD / ဒေါ်လာ) precise.

SELECTED MINUTES FORMAT: ${modeObj.nameEn} (${modeObj.nameMy})
${modeObj.promptInstruction}

${custom ? `ADDITIONAL CUSTOM USER INSTRUCTIONS (PRIORITIZE THESE):
${custom}
` : ''}

OUTPUT STRUCTURE:
Produce the final meeting minutes directly in clean, well-formatted Markdown. Begin immediately with the meeting title and structured content without meta preamble like "Sure, here are the minutes".`;

  return prompt;
}

// Export for both Browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AI_MODES, buildGeminiPrompt };
}
