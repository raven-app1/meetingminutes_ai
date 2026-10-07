/**
 * Sample Data for Burmese Meeting Minutes AI
 * Provides a realistic sample Myanmar business meeting transcript and synthesized sample audio
 * for instant testing without requiring an uploaded file.
 */

const SAMPLE_MEETING = {
  title: "၂၀၂၆ ခုနှစ် တတိယသုံးလပတ် နည်းပညာစီမံကိန်းနှင့် ဘတ်ဂျက် အစည်းအဝေး",
  titleEn: "Q3 Tech Platform Launch & Budget Review Meeting 2026",
  audioFileName: "sample_management_meeting_burmese.mp3",
  durationSec: 184, // 3 mins 4 secs
  
  // Realistic Burmese business meeting transcript with code-switching
  rawTranscript: `သဘာပတိ (ဦးသန်းထိုက် - MD):
မင်္ဂလာပါ အားလုံးပဲ။ ဒီကနေ့ ကျွန်တော်တို့ရဲ့ Q3 Tech Platform Launch နဲ့ ဘတ်ဂျက်စိစစ်ရေး အစည်းအဝေးကို စတင်ပါမယ်။ တက်ရောက်လာတဲ့ Finance က ဒေါ်နွယ်နွယ်၊ Tech Lead ကိုကျော်သူ နဲ့ Marketing Lead မနှင်းဝေ တို့ကို ကျေးဇူးတင်ပါတယ်။ Agenda ပထမအချက်အနေနဲ့ Platform ရဲ့ လက်ရှိ Status ကို ကိုကျော်သူ အရင် ရှင်းပြပေးပါ။

ကိုကျော်သူ (Tech Lead):
ဟုတ်ကဲ့ပါ ဆရာ။ ကျွန်တော်တို့ Core Application Development ပြီးစီးသွားပါပြီ။ Mobile App (Android/iOS) နှစ်ခုစလုံး Beta Testing အဆင့်ကို ရောက်နေပါပြီ။ ဒါပေမဲ့ Cloud Server Infrastructure ပိုင်းမှာ အရင်လကထက် Users အရေအတွက် ပိုများလာနိုင်တဲ့အတွက် AWS နဲ့ Google Cloud Server စရိတ်ကို Scale-up လုပ်ဖို့ လိုအပ်နေပါတယ်။ Server Upgrade အတွက် တစ်လကို US$ 1,500 ခန့် ထပ်မံ လိုအပ်ပါမယ်။ API Payment Gateway အနေနဲ့ KBZPay နဲ့ WavePay Integration ကတော့ လာမယ့် သောကြာနေ့မှာ Final Sign-off လုပ်မှာ ဖြစ်ပါတယ်။

ဒေါ်နွယ်နွယ် (Finance Manager):
ကိုကျော်သူ တင်ပြတဲ့ Server Cost နဲ့ ပတ်သက်ပြီးတော့ ကျွန်မတို့ Q3 Operational Budget ထဲမှာ လျာထားချက် ရှိပါတယ်။ ဒါပေမဲ့ Vendor ဘက်က တင်ပြထားတဲ့ Maintenance Contract ကိုတော့ Payment Terms ကို ၃ လတစ်ကြိမ် (Quarterly) ပေးချေတဲ့ ပုံစံနဲ့ ပြန်ညှိနှိုင်းစေချင်ပါတယ်။ ဒါဆိုရင် Cashflow အတွက် ပိုပြီး အဆင်ပြေပါမယ်။ Budget Approval ကိုတော့ ဒီတစ်ပတ် သောကြာနေ့ မတိုင်မီ ကျွန်မ Sign-off ပေးပါမယ်။

မနှင်းဝေ (Marketing Lead):
Marketing ဘက်ကတော့ Platform Launch လုပ်မယ့် နေ့ရက်အတွက် Digital Campaign အစီအစဉ်တွေ အကုန် အဆင်သင့် ဖြစ်နေပါပြီ။ Facebook, TikTok နဲ့ LinkedIn တွေမှာ Content စတင် လွှင့်တင်ပါမယ်။ ပထမ တစ်လအတွင်း User အသစ် ၅၀,၀၀၀ ရရှိဖို့ Target ထားထားပါတယ်။ Tech team ဘက်က Launch Date ကို တိတိကျကျ အတည်ပြုပေးစေချင်ပါတယ်။

ဦးသန်းထိုက် (MD):
ကောင်းပါပြီ။ အားလုံးရဲ့ တင်ပြချက်တွေအပေါ် အခြေခံပြီး အောက်ပါ အချက်တွေကို အတည်ပြု ဆုံးဖြတ်ပါမယ် -
၁။ Server Upgrade အတွက် လစဉ် US$ 1,500 ဘတ်ဂျက်ကို အတည်ပြုပါတယ်။ ဒေါ်နွယ်နွယ်အနေနဲ့ Finance Process အတိုင်း ဆက်လက်ဆောင်ရွက်ပါ။
၂။ Payment Gateway Integration ကို ကိုကျော်သူ လာမယ့် အောက်တိုဘာလ ၁၀ ရက်နေ့ မတိုင်မီ ပြီးစီးအောင် လုပ်ဆောင်ပါ။
၃။ Vendor Contract Payment Terms ကို ဒေါ်နွယ်နွယ် ဘက်က Quarterly ပေးချေမှု ဖြစ်အောင် ပြန်လည်ညှိနှိုင်းပါ။
၄။ Public Launch Date ကို လာမယ့် နိုဝင်ဘာလ ၁ ရက်နေ့အဖြစ် သတ်မှတ်ပါတယ်။ မနှင်းဝေ အနေနဲ့ Launch Campaign ကို အောက်တိုဘာ ၂၀ ရက်နေ့မှာ စတင် Teaser ကြေညာပါ။

အားလုံး အဆင်ပြေကြမယ်လို့ ယုံကြည်ပါတယ်။ နောက်ထပ် အစည်းအဝေးကို လာမယ့် အပတ် ဗုဒ္ဓဟူးနေ့ မနက် ၁၀ နာရီမှာ ဆက်လက် ကျင်းပပါမယ်။ အစည်းအဝေးကို ဒီမှာပဲ ရပ်နားပါမယ်။ အားလုံးကို ကျေးဇူးတင်ပါတယ်။`,

  // Pre-generated sample outputs for instant preview
  sampleOutputs: {
    summary: `## အစည်းအဝေး အကျဉ်းချုပ် (Executive Summary)
**အစည်းအဝေး ခေါင်းစဉ်:** ၂၀၂၆ ခုနှစ် တတိယသုံးလပတ် နည်းပညာစီမံကိန်းနှင့် ဘတ်ဂျက် အစည်းအဝေး  
**ရက်စွဲ:** ၂၀၂၆ ခုနှစ်၊ အောက်တိုဘာလ ၇ ရက်  

### ၁။ အနှစ်ချုပ် သုံးသပ်ချက်
ကုမ္ပဏီ၏ Mobile Application Launch ပြုလုပ်ရန် အခြေအနေ၊ Cloud Server အဆင့်မြှင့်တင်ရေး၊ ဘဏ္ဍာရေး စီမံခန့်ခွဲမှုနှင့် Marketing Campaign မဟာဗျူဟာများကို သက်ဆိုင်ရာ ဌာနခေါင်းဆောင်များနှင့် ညှိနှိုင်း ဆွေးနွေးခဲ့ကြသည်။ Application ၏ Core Features များ ပြီးစီးပြီဖြစ်ပြီး လာမည့် နိုဝင်ဘာလ ၁ ရက်နေ့တွင် တရားဝင် Launch ပြုလုပ်ရန် တညီတညွတ်တည်း သဘောတူ ဆုံးဖြတ်ခဲ့သည်။

### ၂။ အဓိက ရလဒ်များနှင့် ဆုံးဖြတ်ချက်များ
* **Server Budget Approval:** Cloud Server စရိတ်အတွက် တစ်လလျှင် US$ 1,500 တိုးမြှင့် သုံးစွဲခွင့်ကို MD မှ အတည်ပြုပေးခဲ့သည်။
* **Payment Gateway Integration:** KBZPay နှင့် WavePay Integration ကို အောက်တိုဘာလ ၁၀ ရက်နေ့ မတိုင်မီ အပြီးသတ်မည်။
* **Vendor Contract ညှိနှိုင်းမှု:** ငွေပေးချေမှုပုံစံကို ၃ လတစ်ကြိမ် (Quarterly) ပေးချေသည့် စနစ်သို့ ပြောင်းလဲရန် ဆုံးဖြတ်ခဲ့သည်။
* **Launch Date သတ်မှတ်ခြင်း:** Public Launch Date ကို နိုဝင်ဘာလ ၁ ရက်နေ့အဖြစ် သတ်မှတ်ပြီး Teaser Campaign ကို အောက်တိုဘာ ၂၀ တွင် စတင်မည်။`,

    action_items: `## လုပ်ဆောင်ရန် တာဝန်များနှင့် ဆုံးဖြတ်ချက်များ (Action Items & Decisions)

### ၁။ အတည်ပြု ဆုံးဖြတ်ချက်များ
၁။ Server Upgrade အတွက် လစဉ် US$ 1,500 အား Q3 ဘတ်ဂျက်မှ သုံးစွဲရန် အတည်ပြုသည်။  
၂။ Public Launch Date ကို နိုဝင်ဘာလ ၁ ရက်နေ့အဖြစ် အတည်ပြု သတ်မှတ်သည်။  
၃။ Vendor Payment Terms အား ၃ လတစ်ကြိမ် ပေးချေရန် ပြင်ဆင်ရန် ဆုံးဖြတ်သည်။  

### ၂။ လုပ်ဆောင်ရန် တာဝန်များ ဇယား (Action Items Table)

| စဉ် | လုပ်ဆောင်ရန် တာဝန် | တာဝန်ခံ (Owner) | သတ်မှတ်ရက် (Due Date) | ဦးစားပေး | မှတ်ချက် |
|---|---|---|---|---|---|
| ၁ | Cloud Server Upgrade ပြုလုပ်ခြင်း နှင့် Scale-up စီစဉ်ခြင်း | ကိုကျော်သူ (Tech Lead) | အောက်တိုဘာ ၉ | မြင့် (High) | AWS & GCP |
| ၂ | KBZPay / WavePay Payment Gateway Integration အပြီးသတ်ခြင်း | ကိုကျော်သူ (Tech Lead) | အောက်တိုဘာ ၁၀ | မြင့် (High) | Final Testing |
| ၃ | Server Budget Sign-off နှင့် ငွေစာရင်း ထုတ်ပေးခြင်း | ဒေါ်နွယ်နွယ် (Finance) | အောက်တိုဘာ ၉ | အလယ် (Medium) | US$ 1,500/mo |
| ၄ | Vendor Maintenance Contract အား Quarterly Payment သို့ ညှိနှိုင်းခြင်း | ဒေါ်နွယ်နွယ် (Finance) | အောက်တိုဘာ ၁၂ | အလယ် (Medium) | Cashflow အဆင်ပြေစေရန် |
| ၅ | Marketing Campaign Teaser Content များ စတင်လွှင့်တင်ခြင်း | မနှင်းဝေ (Marketing) | အောက်တိုဘာ ၂၀ | မြင့် (High) | Facebook, TikTok, LinkedIn |
| ၆ | Public Platform Official Launch ပြုလုပ်ခြင်း | အဖွဲ့အားလုံး | နိုဝင်ဘာ ၁ | အရေးကြီးဆုံး | Target: 50,000 Users |`
  }
};

/**
 * Creates a synthetic demo audio WAV Blob (short tone with speech-like bursts)
 * so that users have a real playable audio file in memory without loading external network assets.
 */
function createSyntheticDemoAudio() {
  const sampleRate = 16000;
  const duration = 5; // 5 seconds demo tone
  const numSamples = sampleRate * duration;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV Header
  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16 bits
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Generate synthetic human-voice pitch pattern (~200Hz fundamental frequency with formants)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Modulation envelope
    const envelope = Math.sin(Math.PI * 2 * 0.8 * t) > 0 ? 0.4 : 0.05;
    const wave = Math.sin(Math.PI * 2 * 220 * t) * 0.5 + Math.sin(Math.PI * 2 * 440 * t) * 0.3;
    const sample = Math.max(-1, Math.min(1, wave * envelope));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

// Export for both Browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SAMPLE_MEETING, createSyntheticDemoAudio };
}
