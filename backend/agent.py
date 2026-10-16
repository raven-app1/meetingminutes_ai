"""Agent module wrapping agy CLI for AI meeting minutes generation."""

import asyncio
import datetime
import logging
import os
import re
import shutil
import subprocess
from typing import Any, Dict, List, Optional, Tuple
from backend.personas import Persona, get_persona

logger = logging.getLogger("meetingminutes.agent")

AGY_PATH = os.environ.get("AGY_PATH", "/root/.local/bin/agy")
DEFAULT_TIMEOUT_SECONDS = int(os.environ.get("AGY_TIMEOUT", "600"))

AVAILABLE_MODELS: List[Dict[str, str]] = [
    {
        "id": "gemini-3.8-flash-medium",
        "name": "Gemini 3.8 Flash (Medium)",
        "description": "Fast and balanced, ideal for general meeting minutes and sprint syncs.",
    },
    {
        "id": "gemini-3.8-flash-high",
        "name": "Gemini 3.8 Flash (High)",
        "description": "High reasoning depth, excellent for complex multi-topic debates and board reviews.",
    },
    {
        "id": "claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6",
        "description": "Nuanced, articulate synthesis with exceptional structural discipline and clarity.",
    },
]

VALID_MODEL_IDS = {m["id"] for m in AVAILABLE_MODELS}
DEFAULT_MODEL = "gemini-3.8-flash-medium"

# Regex to strip ANSI escape codes if present in CLI output
ANSI_ESCAPE_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


def clean_cli_output(text: str) -> str:
    """Strip ANSI escape codes and clean up whitespace."""
    if not text:
        return ""
    clean = ANSI_ESCAPE_RE.sub("", text)
    # Also strip potential Windows CR
    clean = clean.replace("\r\n", "\n")
    return clean.strip()


def check_agy_available() -> bool:
    """Verify that agy binary exists and is executable."""
    return os.path.isfile(AGY_PATH) and os.access(AGY_PATH, os.X_OK)

BURMESE_CHAR_RE = re.compile(r'[\u1000-\u109F\uAA60-\uAA7F]')

def clean_language_minutes(text: str, lang: str) -> str:
    """Filter out the other language if mixed **English:** and **မြန်မာဘာသာ:** markers are present."""
    if not text:
        return ""

    has_en_marker = "**English:**" in text or "**English" in text or "** English" in text
    has_my_marker = "**မြန်မာဘာသာ" in text or "(Burmese)" in text or "** မြန်မာဘာသာ" in text

    if not (has_en_marker and has_my_marker):
        # Still check if section headers have bilingual slashes like '## 1. Executive Summary / အမှုဆောင် အကျဉ်းချုပ်'
        lines = text.split("\n")
        cleaned = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("#") and "/" in stripped and BURMESE_CHAR_RE.search(stripped):
                parts = stripped.split("/", 1)
                if lang == "en":
                    clean_h = re.sub(r'\s*/.*$', '', line).strip()
                    cleaned.append(clean_h)
                else:
                    prefix_match = re.match(r'^(#+\s*)', parts[0])
                    prefix = prefix_match.group(1) if prefix_match else "## "
                    cleaned.append(f"{prefix}{parts[1].strip()}")
            else:
                cleaned.append(line)
        return "\n".join(cleaned).strip()

    lines = text.split("\n")
    cleaned_lines = []
    current_mode = None

    for line in lines:
        stripped = line.strip()

        # Check for section header
        if stripped.startswith("#"):
            current_mode = "header"
            if "/" in stripped and BURMESE_CHAR_RE.search(stripped):
                parts = stripped.split("/", 1)
                if lang == "en":
                    clean_h = re.sub(r'\s*/.*$', '', line).strip()
                    cleaned_lines.append(clean_h)
                else:
                    prefix_match = re.match(r'^(#+\s*)', parts[0])
                    prefix = prefix_match.group(1) if prefix_match else "## "
                    cleaned_lines.append(f"{prefix}{parts[1].strip()}")
            else:
                cleaned_lines.append(line)
            continue

        if "**English:**" in stripped or "**English" in stripped or "** English" in stripped:
            current_mode = "en"
            continue
        elif "**မြန်မာဘာသာ" in stripped or "(Burmese)" in stripped or "** မြန်မာဘာသာ" in stripped:
            current_mode = "my"
            continue

        if current_mode == lang:
            cleaned_lines.append(line)
        elif current_mode == "header":
            if lang == "en" and not BURMESE_CHAR_RE.search(stripped):
                cleaned_lines.append(line)
            elif lang == "my" and BURMESE_CHAR_RE.search(stripped):
                cleaned_lines.append(line)
        elif current_mode is None:
            if "/" in line and BURMESE_CHAR_RE.search(line):
                parts = line.split("/", 1)
                cleaned_lines.append(parts[0].strip() if lang == "en" else parts[1].strip())
            else:
                cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def parse_minutes_output(stdout_str: str) -> Dict[str, str]:
    """Parse agy output containing optional ===MINUTES_EN===, ===MINUTES_MY===, and ===TRANSCRIPT=== delimiters."""
    if not stdout_str:
        return {"minutes": "", "minutes_en": "", "minutes_my": "", "transcript": ""}

    text = stdout_str.strip()
    transcript = ""
    minutes_en = ""
    minutes_my = ""

    # Split transcript first if present
    if "===TRANSCRIPT===" in text:
        parts = text.split("===TRANSCRIPT===", 1)
        text = parts[0].strip()
        transcript = parts[1].strip()

    if "===MINUTES_EN===" in text and "===MINUTES_MY===" in text:
        en_part = text.split("===MINUTES_EN===", 1)[1]
        en_my_split = en_part.split("===MINUTES_MY===", 1)
        minutes_en = en_my_split[0].strip()
        minutes_my = en_my_split[1].strip()
    elif "===MINUTES_MY===" in text:
        parts = text.split("===MINUTES_MY===", 1)
        minutes_en = parts[0].replace("===MINUTES_EN===", "").strip()
        minutes_my = parts[1].strip()
    elif "===MINUTES_EN===" in text:
        minutes_en = text.replace("===MINUTES_EN===", "").strip()
        minutes_my = minutes_en
    else:
        minutes_en = text
        minutes_my = text

    # Clean language mixing so English tab has purely English and Burmese tab has purely Burmese
    clean_en = clean_language_minutes(minutes_en, "en")
    clean_my = clean_language_minutes(minutes_my, "my")

    combined = f"{clean_en}\n\n---\n\n{clean_my}" if (clean_en and clean_my and clean_en != clean_my) else (clean_en or clean_my)

    return {
        "minutes": combined,
        "minutes_en": clean_en,
        "minutes_my": clean_my,
        "transcript": transcript,
    }


def build_prompt(
    persona: Persona,
    transcript: str,
    title: Optional[str] = None,
    attendees: Optional[str] = None,
    custom_instructions: Optional[str] = None,
) -> str:
    """Construct a high-quality prompt for agy combining persona rules and meeting content."""
    meeting_title = title.strip() if title and title.strip() else "Executive Sync / Team Meeting"
    attendee_str = attendees.strip() if attendees and attendees.strip() else "Identified participants from audio"
    today_str = datetime.date.today().strftime("%B %d, %Y")

    # Format the persona system prompt with template variables
    # Format English and Burmese templates separately
    formatted_persona_prompt_en = persona.system_prompt.format(
        title=meeting_title,
        date=today_str,
        attendees=attendee_str,
    )
    burmese_template = getattr(persona, "system_prompt_my", None) or persona.system_prompt
    formatted_persona_prompt_my = burmese_template.format(
        title=meeting_title,
        date=today_str,
        attendees=attendee_str,
    )

    prompt_parts = [
        f"You are generating meeting minutes following the role: {persona.name}.",
        f"Target Audience: {persona.target_audience}",
        f"Tone: {persona.tone}",
        "",
        "### MEETING METADATA ###",
        f"- Title: {meeting_title}",
        f"- Date: {today_str}",
        f"- Attendees / Participants: {attendee_str}",
        "",
        "### DESIRED ENGLISH MINUTES STRUCTURE (under ===MINUTES_EN===) ###",
        formatted_persona_prompt_en,
        "",
        "### DESIRED BURMESE MINUTES STRUCTURE (under ===MINUTES_MY===) ###",
        formatted_persona_prompt_my,
    ]

    if custom_instructions and custom_instructions.strip():
        prompt_parts.extend([
            "",
            "### ADDITIONAL USER INSTRUCTIONS ###",
            custom_instructions.strip(),
        ])

    prompt_parts.extend([
        "",
        "### AUDIO TRANSCRIPT OF THE MEETING ###",
        "```text",
        transcript.strip(),
        "```",
        "",
        "### INSTRUCTIONS ###",
        "STRICT LANGUAGE SEPARATION REQUIREMENT (အင်္ဂလိပ် နှင့် မြန်မာ သီးခြားစီ လုံးဝ ခွဲထုတ်ပါ):",
        "You MUST generate the meeting minutes in two separate blocks using these exact delimiters:",
        "===MINUTES_EN===",
        "(Output 100% PURE ENGLISH meeting minutes following the English template above. DO NOT include any Burmese words or translations here).",
        "===MINUTES_MY===",
        "(Output 100% PURE BURMESE meeting minutes in natural Myanmar Unicode following the Burmese template above. DO NOT include any English words or translations here).",
        "===TRANSCRIPT===",
        "(The spoken meeting transcript)",
        "Strictly use standard Myanmar Unicode 10646 (not Zawgyi).",
        "",
        "Do NOT include conversational meta-chatter such as 'Here are the minutes:'.",
        "Begin immediately with ===MINUTES_EN=== followed by the pure English minutes.",
    ])
    return "\n".join(prompt_parts)


def optimize_audio_if_needed(audio_path: str) -> Tuple[str, bool]:
    """Downsample and compress audio using ffmpeg if large (>3MB) to speed up agy processing.

    Returns (effective_path, is_temp). If an optimized file is created, is_temp is True.
    """
    if not os.path.exists(audio_path):
        return audio_path, False

    if not shutil.which("ffmpeg"):
        return audio_path, False

    try:
        size = os.path.getsize(audio_path)
        if size <= 3 * 1024 * 1024:
            return audio_path, False

        dir_name = os.path.dirname(audio_path)
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        opt_path = os.path.join(dir_name, f"{base_name}_opt.mp3")

        logger.info(f"Optimizing audio file ({size:,} bytes) with ffmpeg to '{opt_path}'...")
        res = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                audio_path,
                "-ar",
                "16000",
                "-ac",
                "1",
                "-b:a",
                "32k",
                opt_path,
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=30,
            check=False,
        )
        if res.returncode == 0 and os.path.exists(opt_path) and os.path.getsize(opt_path) > 0:
            new_size = os.path.getsize(opt_path)
            logger.info(
                f"Audio optimized: {size:,} bytes -> {new_size:,} bytes (reduced by {(1 - new_size/size)*100:.1f}%)"
            )
            return opt_path, True
    except Exception as e:
        logger.warning(f"Audio optimization failed, falling back to original: {e}")

    return audio_path, False


def build_audio_prompt(
    persona: Persona,
    audio_path: str,
    title: Optional[str] = None,
    attendees: Optional[str] = None,
    custom_instructions: Optional[str] = None,
) -> str:
    """Construct a prompt instructing agy to inspect and listen to the audio file directly."""
    abs_path = os.path.abspath(audio_path)
    meeting_title = title.strip() if title and title.strip() else "Executive Sync / Team Meeting"
    attendee_str = attendees.strip() if attendees and attendees.strip() else "Identified participants from audio"
    today_str = datetime.date.today().strftime("%B %d, %Y")

    formatted_persona_prompt_en = persona.system_prompt.format(
        title=meeting_title,
        date=today_str,
        attendees=attendee_str,
    )
    burmese_template = getattr(persona, "system_prompt_my", None) or persona.system_prompt
    formatted_persona_prompt_my = burmese_template.format(
        title=meeting_title,
        date=today_str,
        attendees=attendee_str,
    )

    prompt_parts = [
        f"Audio File Path: {abs_path}",
        "Immediately call view_file on this audio file path.",
        "Once you inspect the audio file with view_file, do NOT output any intermediate notes, draft observations, or commentary. In your immediate response after viewing the audio, directly output the complete meeting minutes cleanly separated by delimiters.",
        "",
        f"Role: {persona.name}",
        f"Target Audience: {persona.target_audience}",
        f"Tone: {persona.tone}",
        "",
        "### MEETING METADATA ###",
        f"- Title: {meeting_title}",
        f"- Date: {today_str}",
        f"- Attendees / Participants: {attendee_str}",
        "",
        "### DESIRED ENGLISH MINUTES STRUCTURE (under ===MINUTES_EN===) ###",
        formatted_persona_prompt_en,
        "",
        "### DESIRED BURMESE MINUTES STRUCTURE (under ===MINUTES_MY===) ###",
        formatted_persona_prompt_my,
    ]

    if custom_instructions and custom_instructions.strip():
        prompt_parts.extend([
            "",
            "### ADDITIONAL USER INSTRUCTIONS ###",
            custom_instructions.strip(),
        ])

    prompt_parts.extend([
        "",
        "### INSTRUCTIONS ###",
        "STRICT LANGUAGE SEPARATION REQUIREMENT (အင်္ဂလိပ် နှင့် မြန်မာ သီးခြားစီ လုံးဝ ခွဲထုတ်ပါ):",
        "1. Immediately inspect and listen to the audio file at the Audio File Path above using your view_file tool.",
        "2. Directly produce the complete meeting minutes in two separate blocks using these exact delimiters:",
        "===MINUTES_EN===",
        "(Output 100% PURE ENGLISH meeting minutes following the English template above. DO NOT include any Burmese words or translations here).",
        "===MINUTES_MY===",
        "(Output 100% PURE BURMESE meeting minutes in natural Myanmar Unicode following the Burmese template above. DO NOT include any English words or translations here).",
        "===TRANSCRIPT===",
        "(The spoken meeting transcript)",
        "Strictly use standard Myanmar Unicode 10646 (not Zawgyi).",
        "Begin immediately with ===MINUTES_EN=== without conversational meta-chatter or intermediate notes.",
    ])
    return "\n".join(prompt_parts)


async def generate_minutes_from_audio(
    audio_path: str,
    persona_id: str = "executive",
    model: str = DEFAULT_MODEL,
    title: Optional[str] = None,
    attendees: Optional[str] = None,
    custom_instructions: Optional[str] = None,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    """Generate meeting minutes and transcript directly from an audio file using agy multimodal capabilities.

    Args:
        audio_path: File path to the meeting audio recording.
        persona_id: ID of the selected business persona.
        model: Selected model identifier.
        title: Optional meeting title.
        attendees: Optional meeting attendees list.
        custom_instructions: Optional extra guidance.
        timeout_seconds: Max seconds to wait for agy to complete.

    Returns:
        Dict containing 'minutes' (str) and 'transcript' (str).

    Raises:
        FileNotFoundError if audio_path does not exist.
        RuntimeError if agy fails or times out.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found at {audio_path}")

    if not check_agy_available():
        raise RuntimeError(f"agy CLI not found or not executable at {AGY_PATH}")

    chosen_model = model if model in VALID_MODEL_IDS else DEFAULT_MODEL
    persona = get_persona(persona_id)

    target_audio_path, is_temp_opt = optimize_audio_if_needed(audio_path)

    prompt = build_audio_prompt(
        persona=persona,
        audio_path=target_audio_path,
        title=title,
        attendees=attendees,
        custom_instructions=custom_instructions,
    )

    cmd = [
        AGY_PATH,
        "-p",
        prompt,
        "--dangerously-skip-permissions",
        "--disable-slash-commands",
        "--model",
        chosen_model,
    ]

    logger.info(
        f"Invoking agy audio pipeline on '{target_audio_path}' with model='{chosen_model}', persona='{persona.id}'"
    )

    try:
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout_data, stderr_data = await asyncio.wait_for(
                process.communicate(), timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            try:
                process.kill()
                await process.wait()
            except Exception:
                pass
            logger.error(f"agy audio generation timed out after {timeout_seconds}s")
            raise RuntimeError(
                f"Minutes generation timed out after {timeout_seconds} seconds. Please try again or use a faster model."
            )
        except Exception as e:
            logger.error(f"Failed to execute agy for audio processing: {str(e)}")
            raise RuntimeError(f"Failed to execute agy: {str(e)}")

        stdout_str = clean_cli_output(stdout_data.decode("utf-8", errors="replace"))
        stderr_str = clean_cli_output(stderr_data.decode("utf-8", errors="replace"))

        if process.returncode != 0:
            logger.error(f"agy exited with code {process.returncode}: {stderr_str}")
            err_msg = stderr_str if stderr_str else f"agy exited with return code {process.returncode}"
            raise RuntimeError(f"AI Audio processing failed: {err_msg}")

        if not stdout_str:
            if stderr_str:
                raise RuntimeError(f"AI Audio processing produced no output. Error details: {stderr_str}")
            raise RuntimeError("AI Audio processing produced an empty response.")

        return parse_minutes_output(stdout_str)
    finally:
        if is_temp_opt and os.path.exists(target_audio_path):
            try:
                os.remove(target_audio_path)
            except Exception:
                pass

async def generate_minutes(
    transcript: str,
    persona_id: str = "executive",
    model: str = DEFAULT_MODEL,
    title: Optional[str] = None,
    attendees: Optional[str] = None,
    custom_instructions: Optional[str] = None,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> str:
    """Generate minutes using the agy CLI asynchronously.

    Args:
        transcript: The raw transcribed text.
        persona_id: ID of the selected business persona.
        model: Selected model identifier.
        title: Optional meeting title.
        attendees: Optional meeting attendees list.
        custom_instructions: Optional extra guidance.
        timeout_seconds: Max seconds to wait for agy to complete.

    Returns:
        Generated Markdown string.

    Raises:
        RuntimeError if agy fails or times out.
    """
    if not check_agy_available():
        raise RuntimeError(f"agy CLI not found or not executable at {AGY_PATH}")

    if not transcript or not transcript.strip():
        raise ValueError("Transcript cannot be empty for minutes generation.")

    # Validate model
    chosen_model = model if model in VALID_MODEL_IDS else DEFAULT_MODEL
    persona = get_persona(persona_id)

    prompt = build_prompt(
        persona=persona,
        transcript=transcript,
        title=title,
        attendees=attendees,
        custom_instructions=custom_instructions,
    )

    cmd = [
        AGY_PATH,
        "-p",
        prompt,
        "--dangerously-skip-permissions",
        "--disable-slash-commands",
        "--model",
        chosen_model,
    ]

    logger.info(
        f"Invoking agy with model='{chosen_model}', persona='{persona.id}', title='{title or 'Default'}'"
    )

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout_data, stderr_data = await asyncio.wait_for(
            process.communicate(), timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        try:
            process.kill()
            await process.wait()
        except Exception:
            pass
        logger.error(f"agy generation timed out after {timeout_seconds}s")
        raise RuntimeError(
            f"Minutes generation timed out after {timeout_seconds} seconds. Please try again or use a faster model."
        )
    except Exception as e:
        logger.error(f"Failed to execute agy: {str(e)}")
        raise RuntimeError(f"Failed to execute agy: {str(e)}")

    stdout_str = clean_cli_output(stdout_data.decode("utf-8", errors="replace"))
    stderr_str = clean_cli_output(stderr_data.decode("utf-8", errors="replace"))

    if process.returncode != 0:
        logger.error(f"agy exited with code {process.returncode}: {stderr_str}")
        err_msg = stderr_str if stderr_str else f"agy exited with return code {process.returncode}"
        raise RuntimeError(f"AI Generation failed: {err_msg}")

    if not stdout_str:
        if stderr_str:
            raise RuntimeError(f"AI Generation produced no output. Error details: {stderr_str}")
        raise RuntimeError("AI Generation produced an empty response.")

    return stdout_str
