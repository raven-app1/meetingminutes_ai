"""Sample audio generator for meeting minutes demonstration."""

import logging
import os
import subprocess
import tempfile
from typing import List, Tuple

logger = logging.getLogger("meetingminutes.sample_generator")

DEFAULT_SAMPLE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "sample_meeting.mp3"
)

SAMPLE_METADATA = {
    "title": "Q3 AI Product Roadmap & Architecture Sync / တတိယသုံးလပတ် AI ထုတ်ကုန် မဟာဗျူဟာနှင့် စနစ်ဖွဲ့စည်းပုံ ဆွေးနွေးပွဲ",
    "attendees": "Sarah Chen (Product Lead), Alex Miller (Lead Architect), Elena Rostova (UX Lead), David Kim (VP Operations)",
    "persona": "executive",
    "model": "gemini-3.8-flash-medium",
}

SAMPLE_DIALOGUE: List[Tuple[str, int, int, str]] = [
    (
        "en-us+f2",
        145,
        60,
        "Good morning team, thanks for joining our Q3 AI Roadmap and Product Sync. "
        "Today we need to align on three critical topics: the release date for our automated minutes feature, "
        "the cloud infrastructure budget, and resolving the latency bottlenecks reported in the pilot. "
        "Alex, can you give us the engineering status on the transcription pipeline?",
    ),
    (
        "en-us+m3",
        150,
        45,
        "Sure Sarah. On the pipeline side, we migrated to the faster-whisper INT8 base model, "
        "which dropped our inference latency from 12 seconds down to 3.5 seconds per minute of audio. "
        "However, we are seeing memory spikes when multiple concurrent uploads hit the server. "
        "We propose caching the model singleton and adding an asynchronous queue to cap concurrency at 4 workers. "
        "That will keep our memory footprint strictly under 2 gigabytes.",
    ),
    (
        "en-us+f4",
        145,
        65,
        "From the user feedback side, beta customer response is overwhelmingly positive. "
        "Users love the executive persona summaries, but they requested two key improvements: "
        "first, real-time progress indicators during processing, and second, an instant sample audio button "
        "so new users do not have to scramble for meeting recordings to test the tool. "
        "We have wireframes ready for that.",
    ),
    (
        "en-us+m1",
        140,
        40,
        "On the financial side, executive leadership has approved a fifteen thousand dollar monthly cloud "
        "budget expansion for Q3, provided we maintain ninety-nine point nine percent uptime. "
        "If Alex's team can confirm the memory fix by Friday, we are cleared to launch the public beta next Monday.",
    ),
    (
        "en-us+f2",
        145,
        60,
        "Outstanding. Let us record the action items: Alex will implement model caching and the queue by Thursday. "
        "Elena will finalize the real-time progress UI by Wednesday. "
        "David will formalize the infrastructure budget allocation. "
        "And I will coordinate customer communications for the Monday launch. Meeting adjourned.",
    ),
]

SAMPLE_TRANSCRIPT_FALLBACK = (
    "Sarah Chen: Good morning team, thanks for joining our Q3 AI Roadmap and Product Sync. "
    "Today we need to align on three critical topics: the release date for our automated minutes feature, "
    "the cloud infrastructure budget, and resolving the latency bottlenecks reported in the pilot. "
    "Alex, can you give us the engineering status on the transcription pipeline?\n"
    "(မင်္ဂလာပါ အဖွဲ့သားတို့၊ တတိယသုံးလပတ် AI ထုတ်ကုန် မဟာဗျူဟာနှင့် စနစ်ဖွဲ့စည်းပုံ ဆွေးနွေးပွဲကို တက်ရောက်ပေးတဲ့အတွက် ကျေးဇူးတင်ပါတယ်။ "
    "ဒီကနေ့မှာ အဓိက အရေးကြီးတဲ့ အချက် ၃ ချက်ဖြစ်တဲ့ အလိုအလျောက် မှတ်တမ်းတင်စနစ် ဖြန့်ချိမည့်ရက်၊ "
    "Cloud အခြေခံအဆောက်အအုံ ဘတ်ဂျက်၊ ပြီးတော့ စမ်းသပ်မှုမှာ တွေ့ရှိခဲ့တဲ့ latency နှောင့်နှေးမှု ပြဿနာ ဖြေရှင်းရေးတို့ကို ညှိနှိုင်းရပါမယ်။ "
    "Alex ရေ၊ transcription pipeline ရဲ့ အင်ဂျင်နီယာပိုင်း အခြေအနေကို ရှင်းပြပေးနိုင်မလား။)\n\n"
    "Alex Miller: Sure Sarah. On the pipeline side, we migrated to the faster-whisper INT8 base model, "
    "which dropped our inference latency from 12 seconds down to 3.5 seconds per minute of audio. "
    "However, we are seeing memory spikes when multiple concurrent uploads hit the server. "
    "We propose caching the model singleton and adding an asynchronous queue to cap concurrency at 4 workers. "
    "That will keep our memory footprint strictly under 2 gigabytes.\n"
    "(ဟုတ်ကဲ့ Sarah။ Pipeline ဘက်မှာတော့ ကျွန်တော်တို့ faster-whisper INT8 base model ကို ပြောင်းလဲအသုံးပြုခဲ့တာကြောင့် "
    "အသံ ၁ မိနစ်စာအတွက် latency ကို ၁၂ စက္ကန့်ကနေ ၃.၅ စက္ကန့်အထိ လျှော့ချနိုင်ခဲ့ပါတယ်။ "
    "ဒါပေမဲ့ တစ်ပြိုင်နက်တည်း upload လုပ်ဆောင်မှုတွေ များလာတဲ့အခါ memory မြင့်တက်လာတာကို တွေ့ရပါတယ်။ "
    "ဒါကြောင့် model singleton ကို cache လုပ်ပြီး asynchronous queue ထည့်သွင်းကာ worker ၄ ခုထက် မကျော်အောင် ကန့်သတ်ဖို့ အဆိုပြုပါတယ်။ "
    "ဒါဆိုရင် memory အသုံးပြုမှုကို ၂ gigabytes အောက်မှာ တိကျစွာ ထိန်းထားနိုင်ပါမယ်။)\n\n"
    "Elena Rostova: From the user feedback side, beta customer response is overwhelmingly positive. "
    "Users love the executive persona summaries, but they requested two key improvements: "
    "first, real-time progress indicators during processing, and second, an instant sample audio button "
    "so new users do not have to scramble for meeting recordings to test the tool. "
    "We have wireframes ready for that.\n"
    "(အသုံးပြုသူတွေရဲ့ တုံ့ပြန်ချက်ဘက်ကတော့ beta သုံးစွဲသူတွေရဲ့ တုံ့ပြန်မှု အလွန်ကောင်းမွန်ပါတယ်။ "
    "အသုံးပြုသူတွေက executive persona အကျဉ်းချုပ်တွေကို သဘောကျကြပေမဲ့ အဓိက တိုးတက်မှု ၂ ချက် တောင်းဆိုထားပါတယ် - "
    "ပထမအချက်က လုပ်ဆောင်နေစဉ်အတွင်း အချိန်နှင့်တစ်ပြေးညီ progress တိုးတက်မှု ပြသပေးဖို့နဲ့ ဒုတိယအချက်က အသုံးပြုသူအသစ်တွေ စမ်းသပ်ဖို့ "
    "အသံဖိုင်လိုက်ရှာစရာမလိုအောင် ချက်ချင်းနမူနာ အသံဖွင့်နိုင်တဲ့ ခလုတ်တစ်ခု ထည့်သွင်းပေးဖို့ ဖြစ်ပါတယ်။ ကျွန်မတို့ wireframe တွေ အဆင်သင့် ပြင်ဆင်ပြီးပါပြီ။)\n\n"
    "David Kim: On the financial side, executive leadership has approved a fifteen thousand dollar monthly cloud "
    "budget expansion for Q3, provided we maintain ninety-nine point nine percent uptime. "
    "If Alex's team can confirm the memory fix by Friday, we are cleared to launch the public beta next Monday.\n"
    "(ဘဏ္ဍာရေးဘက်ကတော့ စနစ်လည်ပတ်မှု ၉၉.၉% ထိန်းထားနိုင်မယ်ဆိုရင် တတိယသုံးလပတ်အတွက် တစ်လကို ဒေါ်လာ ၁၅,၀၀၀ တန်ဖိုးရှိတဲ့ cloud ဘတ်ဂျက် တိုးချဲ့မှုကို အမှုဆောင်ခေါင်းဆောင်ပိုင်းက အတည်ပြုပေးထားပါတယ်။ "
    "သောကြာနေ့မှာ Alex တို့အဖွဲ့က memory ပြဿနာ ဖြေရှင်းမှုကို အတည်ပြုနိုင်ရင် လာမယ့် တနင်္လာနေ့မှာ public beta စတင်ဖြန့်ချိနိုင်ပါပြီ။)\n\n"
    "Sarah Chen: Outstanding. Let us record the action items: Alex will implement model caching and the queue by Thursday. "
    "Elena will finalize the real-time progress UI by Wednesday. "
    "David will formalize the infrastructure budget allocation. "
    "And I will coordinate customer communications for the Monday launch. Meeting adjourned.\n"
    "(အရမ်းကောင်းပါတယ်။ လုပ်ဆောင်ရမယ့် အချက်တွေကို မှတ်တမ်းတင်ကြရအောင် - Alex က ကြာသပတေးနေ့မှာ model caching နဲ့ queue စနစ်ကို အကောင်အထည်ဖော်မယ်။ "
    "Elena က ဗုဒ္ဓဟူးနေ့မှာ real-time progress UI ကို အပြီးသတ်မယ်။ "
    "David က အခြေခံအဆောက်အအုံ ဘတ်ဂျက်ခွဲဝေမှုကို တရားဝင် အတည်ပြုပေးမယ်။ "
    "ပြီးတော့ ကျွန်မက တနင်္လာနေ့ ဖြန့်ချိမှုအတွက် သုံးစွဲသူ ဆက်သွယ်ရေး လုပ်ငန်းတွေကို ညှိနှိုင်းဆောင်ရွက်ပါမယ်။ အစည်းအဝေး ပြီးဆုံးပါပြီ။)"
)

SAMPLE_MINUTES_EN_FALLBACK = """# Executive Briefing: Q3 AI Product Roadmap & Architecture Sync

**Date:** October 14, 2026  
**Attendees:** Sarah Chen (Product Lead), Alex Miller (Lead Architect), Elena Rostova (UX Lead), David Kim (VP Operations)  

---

## 1. Executive Summary
> The engineering steering committee greenlit the public beta release for next Monday, subject to finalizing worker memory caps by Friday. Leadership approved a $15,000 monthly cloud infrastructure budget expansion.

## 2. Strategic Decisions Made
- **Launch Date:** Public beta launch scheduled for next Monday following Friday memory validation.
- **Model Optimization:** Adopted INT8 quantization, reducing speech transcription latency from 12s to 3.5s per audio minute.
- **Concurrency Architecture:** Caching model singleton and implementing an asynchronous worker queue capped at 4 workers to restrict peak memory to <2.0 GB.

## 3. Financial & KPI Implications
- **Budget Expansion:** Executive leadership approved a $15,000 monthly cloud infrastructure budget expansion for Q3.
- **Service Level Agreement:** Release approval requires maintaining a strict 99.9% system uptime SLA.

## 4. Key Risks & Escalations
- **Memory Spikes:** Concurrent uploads risk memory spikes without the worker queue. Alex Miller's team must validate stability by Friday.

## 5. Action Items Matrix
| Owner | Action Item | Target Date | Strategic Impact |
| --- | --- | --- | --- |
| Alex Miller | Implement model caching and 4-worker queue | Thursday | High (Prevents OOM churn) |
| Elena Rostova | Finalize real-time progress UI | Wednesday | Medium (UX polish) |
| David Kim | Formalize $15,000 cloud infrastructure budget allocation | Friday | High (Budget clearance) |
| Sarah Chen | Coordinate public beta customer communications | Monday | High (Market launch) |
"""

SAMPLE_MINUTES_MY_FALLBACK = """# အမှုဆောင် အစည်းအဝေး အကျဉ်းချုပ်: တတိယသုံးလပတ် AI ထုတ်ကုန် မဟာဗျူဟာနှင့် စနစ်ဖွဲ့စည်းပုံ ဆွေးနွေးပွဲ

**နေ့စွဲ:** အောက်တိုဘာ ၁၄၊ ၂၀၂၆  
**တက်ရောက်သူများ:** Sarah Chen (Product Lead), Alex Miller (Lead Architect), Elena Rostova (UX Lead), David Kim (VP Operations)  

---

## ၁။ အမှုဆောင် အကျဉ်းချုပ်
> အင်ဂျင်နီယာ ဦးဆောင်ကော်မတီသည် သောကြာနေ့တွင် memory ထိန်းချုပ်မှု အတည်ပြုပြီးနောက် လာမည့် တနင်္လာနေ့တွင် အများပြည်သူသုံး beta စနစ်ကို စတင်ဖြန့်ချိရန် ခွင့်ပြုအတည်ပြုခဲ့သည်။ စီမံခန့်ခွဲမှုအဖွဲ့မှ တစ်လလျှင် ဒေါ်လာ ၁၅,၀၀၀ တိုးမြှင့်မည့် cloud အခြေခံအဆောက်အအုံ ဘတ်ဂျက်ကို အတည်ပြုပေးခဲ့သည်။

## ၂။ ချမှတ်ခဲ့သော အဓိက ဆုံးဖြတ်ချက်များ
- **စတင်ဖြန့်ချိမည့်ရက်:** လာမည့် တနင်္လာနေ့တွင် public beta စတင်မည်။
- **မော်ဒယ် စွမ်းဆောင်ရည်မြှင့်တင်မှု:** INT8 quantization ကို အသုံးပြု၍ အသံဖိုင် စာသားပြောင်းလဲမှု နှောင့်နှေးချိန်ကို ၁၂ စက္ကန့်မှ ၃.၅ စက္ကန့်သို့ လျှော့ချခဲ့သည်။
- **စနစ်ဖွဲ့စည်းပုံ:** Model singleton ကို cache လုပ်ပြီး worker ၄ ခု ကန့်သတ်ထားသော asynchronous queue ထည့်သွင်းကာ memory ကို ၂.၀ GB အောက်တွင် ထိန်းချုပ်မည်။

## ၃။ ဘဏ္ဍာရေးနှင့် စွမ်းဆောင်ရည် သက်ရောက်မှုများ
- **ဘတ်ဂျက်ခွဲဝေမှု:** Q3 အတွက် တစ်လလျှင် ဒေါ်လာ ၁၅,၀၀၀ တိုးမြှင့်မည့် cloud အခြေခံအဆောက်အအုံ ဘတ်ဂျက်ကို အတည်ပြုခဲ့သည်။
- **ဝန်ဆောင်မှုအဆင့် သတ်မှတ်ချက်:** ၉၉.၉% စနစ် အချိန်ပြည့် လည်ပတ်နိုင်စွမ်း (uptime) ထိန်းသိမ်းရန် လိုအပ်သည်။

## ၄။ အဓိက အန္တရာယ်များနှင့် စိန်ခေါ်မှုများ
- **Memory မြင့်တက်မှု:** ပြိုင်တူ upload လုပ်ဆောင်မှုများကြောင့် memory မြင့်တက်နိုင်ခြေကို သောကြာနေ့မတိုင်မီ စစ်ဆေးအတည်ပြုရမည်။

## ၅။ လုပ်ဆောင်ရန် အချက်များ ဇယား
| တာဝန်ခံ | လုပ်ဆောင်ရန် အချက် | ပြီးစီးရမည့်ရက် | မဟာဗျူဟာ သက်ရောက်မှု |
| --- | --- | --- | --- |
| Alex Miller | Model caching နှင့် 4-worker queue စနစ် ထည့်သွင်းရန် | ကြာသပတေး | အလွန်အရေးကြီး (OOM ကာကွယ်ရေး) |
| Elena Rostova | အချိန်နှင့်တစ်ပြေးညီ progress UI အပြီးသတ်ရန် | ဗုဒ္ဓဟူး | အလယ်အလတ် (UX ကောင်းမွန်ရေး) |
| David Kim | ဒေါ်လာ ၁၅,၀၀၀ cloud ဘတ်ဂျက်ခွဲဝေမှု အတည်ပြုရန် | သောကြာ | အလွန်အရေးကြီး (ဘတ်ဂျက်ခွင့်ပြုချက်) |
| Sarah Chen | Public beta အတွက် သုံးစွဲသူ ဆက်သွယ်ရေး ပြင်ဆင်ရန် | တနင်္လာ | အလွန်အရေးကြီး (ဈေးကွက်ဖြန့်ချိရေး) |
"""


def generate_sample_audio_file(output_path: str = DEFAULT_SAMPLE_PATH) -> str:
    """Generate sample audio file using espeak-ng and ffmpeg if it doesn't already exist."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        logger.info(f"Sample audio already exists at {output_path}")
        return output_path

    logger.info(f"Generating realistic sample audio at {output_path}...")

    with tempfile.TemporaryDirectory() as tmpdir:
        temp_wav_files = []
        for i, (voice, speed, pitch, text) in enumerate(SAMPLE_DIALOGUE):
            wav_path = os.path.join(tmpdir, f"segment_{i}.wav")
            try:
                cmd = [
                    "espeak-ng",
                    "-v", voice,
                    "-s", str(speed),
                    "-p", str(pitch),
                    "-w", wav_path,
                    text,
                ]
                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                temp_wav_files.append(wav_path)
            except Exception as e:
                logger.warning(f"Failed to generate segment {i} with espeak-ng: {e}")

        if not temp_wav_files:
            # Fallback: create a brief synthesized audio using ffmpeg tone
            logger.info("Falling back to ffmpeg tone generation")
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-f", "lavfi",
                    "-i", "sine=frequency=440:duration=5",
                    "-c:a", "libmp3lame",
                    output_path,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return output_path

        # Concatenate audio segments with ffmpeg
        concat_file = os.path.join(tmpdir, "concat.txt")
        with open(concat_file, "w") as f:
            for wav_f in temp_wav_files:
                f.write(f"file '{wav_f}'\n")

        subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file,
                "-c:a", "libmp3lame",
                "-b:a", "128k",
                output_path,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    logger.info(f"Sample audio generated successfully: {output_path} ({os.path.getsize(output_path)} bytes)")
    return output_path


def ensure_sample_audio_exists() -> str:
    """Ensure the sample audio file is ready on disk and return its path."""
    return generate_sample_audio_file(DEFAULT_SAMPLE_PATH)


if __name__ == "__main__":
    path = ensure_sample_audio_exists()
    print(f"Generated sample audio at: {path}")
