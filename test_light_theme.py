#!/usr/bin/env python3
"""
Automated verification suite for MinuteAI Light Theme.
"""

import sys
import time
import urllib.request
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parent
SCREENSHOTS_DIR = REPO_ROOT / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

def is_server_ready(url: str = "http://127.0.0.1:8000/api/health") -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LightThemeTest"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False

def start_server_if_needed():
    base_url = "http://127.0.0.1:8000"
    if is_server_ready():
        print(f"✓ FastAPI server is already running at {base_url}")
        return None, base_url

    print("→ Starting FastAPI server...")
    log_file_path = REPO_ROOT / "server_test.log"
    log_file = open(log_file_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(REPO_ROOT),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True
    )

    start_time = time.monotonic()
    while time.monotonic() - start_time < 35:
        if is_server_ready():
            print(f"✓ Server started successfully at {base_url} (in {time.monotonic()-start_time:.1f}s)")
            return proc, base_url
        if proc.poll() is not None:
            log_file.close()
            with open(log_file_path, "r", encoding="utf-8", errors="replace") as f:
                logs = f.read()
            raise RuntimeError(f"Server exited prematurely:\n{logs}")
        time.sleep(0.5)

    proc.terminate()
    log_file.close()
    raise TimeoutError("Server failed to respond within 35 seconds.")

def run_tests():
    server_proc, base_url = start_server_if_needed()
    exit_code = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            print("\n==========================================")
            print("1. Testing Default Clean Load (Light Theme)")
            print("==========================================")
            # Clean context, no storage
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()
            page.goto(f"{base_url}/", wait_until="networkidle")

            # 1. Verify data-theme attribute
            theme = page.evaluate("() => document.documentElement.getAttribute('data-theme')")
            print(f"  • html[data-theme]: '{theme}'")
            assert theme == "light", f"Expected 'light', got '{theme}'"

            # 2. Verify body background color
            body_bg = page.evaluate("() => window.getComputedStyle(document.body).backgroundColor")
            print(f"  • body backgroundColor: '{body_bg}'")
            # rgb(248, 250, 252) corresponds to #f8fafc
            assert body_bg in ["rgb(248, 250, 252)", "#f8fafc"], f"Unexpected body bg: {body_bg}"

            # 3. Verify body text color
            body_color = page.evaluate("() => window.getComputedStyle(document.body).color")
            print(f"  • body color: '{body_color}'")
            # rgb(15, 23, 42) corresponds to #0f172a
            assert body_color in ["rgb(15, 23, 42)", "#0f172a"], f"Unexpected body color: {body_color}"

            # 4. Verify .step-card background
            card_bg = page.evaluate("() => window.getComputedStyle(document.querySelector('.step-card')).backgroundColor")
            print(f"  • .step-card backgroundColor: '{card_bg}'")
            # rgb(255, 255, 255)
            assert card_bg in ["rgb(255, 255, 255)", "#ffffff"], f"Unexpected card bg: {card_bg}"

            # 5. Verify theme toggle button displays moon icon by default
            sun_display = page.evaluate("() => window.getComputedStyle(document.querySelector('.theme-toggle-btn .sun-icon')).display")
            moon_display = page.evaluate("() => window.getComputedStyle(document.querySelector('.theme-toggle-btn .moon-icon')).display")
            print(f"  • moon-icon display: '{moon_display}', sun-icon display: '{sun_display}'")
            assert moon_display == "block", f"Expected moon-icon to be block, got {moon_display}"
            assert sun_display == "none", f"Expected sun-icon to be none, got {sun_display}"

            # Desktop screenshot
            page.screenshot(path=str(SCREENSHOTS_DIR / "light_theme_desktop.png"), full_page=False)
            print(f"✓ Saved screenshots/light_theme_desktop.png")

            # 6. Click theme toggle button -> dark theme
            print("\n==========================================")
            print("2. Testing Theme Toggle (Light -> Dark -> Light)")
            print("==========================================")
            page.click("#theme-toggle-btn")
            page.wait_for_timeout(300)

            theme_after_toggle = page.evaluate("() => document.documentElement.getAttribute('data-theme')")
            sun_display_dark = page.evaluate("() => window.getComputedStyle(document.querySelector('.theme-toggle-btn .sun-icon')).display")
            moon_display_dark = page.evaluate("() => window.getComputedStyle(document.querySelector('.theme-toggle-btn .moon-icon')).display")
            body_bg_dark = page.evaluate("() => window.getComputedStyle(document.body).backgroundColor")

            print(f"  • After toggle 1: theme='{theme_after_toggle}', sun='{sun_display_dark}', moon='{moon_display_dark}', bg='{body_bg_dark}'")
            assert theme_after_toggle == "dark", f"Expected 'dark', got '{theme_after_toggle}'"
            assert sun_display_dark == "block", f"Expected sun icon to be visible in dark theme"
            assert moon_display_dark == "none", f"Expected moon icon to be hidden in dark theme"
            assert body_bg_dark in ["rgb(11, 15, 25)", "#0b0f19"], f"Expected dark body bg, got {body_bg_dark}"

            # 7. Click again -> back to light
            page.click("#theme-toggle-btn")
            page.wait_for_timeout(300)

            theme_back_to_light = page.evaluate("() => document.documentElement.getAttribute('data-theme')")
            sun_display_light = page.evaluate("() => window.getComputedStyle(document.querySelector('.theme-toggle-btn .sun-icon')).display")
            moon_display_light = page.evaluate("() => window.getComputedStyle(document.querySelector('.theme-toggle-btn .moon-icon')).display")
            print(f"  • After toggle 2: theme='{theme_back_to_light}', sun='{sun_display_light}', moon='{moon_display_light}'")
            assert theme_back_to_light == "light", f"Expected 'light', got '{theme_back_to_light}'"
            assert moon_display_light == "block"
            assert sun_display_light == "none"

            # 8. Mobile screenshot (375x667)
            print("\n==========================================")
            print("3. Testing Mobile Viewport (375x667)")
            print("==========================================")
            mobile_context = browser.new_context(viewport={"width": 375, "height": 667})
            mobile_page = mobile_context.new_page()
            mobile_page.goto(f"{base_url}/", wait_until="networkidle")
            mobile_page.screenshot(path=str(SCREENSHOTS_DIR / "light_theme_mobile.png"), full_page=False)
            print(f"✓ Saved screenshots/light_theme_mobile.png")
            mobile_context.close()

            # 9. Test UI components in light theme
            print("\n==========================================")
            print("4. Testing UI Components in Light Theme")
            print("==========================================")
            # Switch to Try Demo Meeting tab first, then click #btn-load-demo
            page.click("#tab-btn-demo")
            page.wait_for_timeout(300)
            page.click("#btn-load-demo")
            page.wait_for_selector("#audio-preview-card", state="visible", timeout=10000)
            preview_display = page.evaluate("() => window.getComputedStyle(document.getElementById('audio-preview-card')).display")
            assert preview_display != "none", "Preview card should be visible"
            print("  • Try Demo Meeting loaded successfully, preview card visible")
            page.screenshot(path=str(SCREENSHOTS_DIR / "light_theme_demo.png"), full_page=False)
            print(f"✓ Saved screenshots/light_theme_demo.png")

            # Navigate to Step 2 to test Advanced Settings accordion
            page.click("#btn-to-step-2")
            page.wait_for_timeout(300)
            settings_toggle = page.query_selector("#accordion-toggle")
            if settings_toggle:
                settings_toggle.click()
                page.wait_for_timeout(300)
                input_border = page.evaluate("() => window.getComputedStyle(document.querySelector('.form-control')).borderColor")
                input_color = page.evaluate("() => window.getComputedStyle(document.querySelector('.form-control')).color")
                assert input_border in ["rgb(203, 213, 225)", "#cbd5e1"], f"Unexpected input border: {input_border}"
                # Color should be slate-900 #0f172a = rgb(15, 23, 42)
                assert input_color in ["rgb(15, 23, 42)", "#0f172a"], f"Unexpected input color: {input_color}"

            # Simulate Results Workspace with Markdown table
            print("\n==========================================")
            print("5. Testing Results Workspace & Markdown Rendering")
            print("==========================================")
            markdown_content = """# Executive Meeting Minutes
| Strategic Initiative | Owner | Deadline | Status |
| :--- | :--- | :--- | :--- |
| Core Speech Inference | Infra Team | Q4 Day 15 | On Track |
| Model Latency Optimization | ML Eng | Q4 Day 30 | Active |

> High priority items require VP review.

```json
{
  "status": "success",
  "persona": "executive"
}
```
"""
            page.evaluate("""(md) => {
                const ws = document.getElementById('results-workspace');
                ws.style.display = 'block';
                const container = document.getElementById('markdown-preview');
                container.innerHTML = marked.parse(md);
            }""", markdown_content)
            page.wait_for_timeout(300)
            th_bg = page.evaluate("() => window.getComputedStyle(document.querySelector('.markdown-preview th')).backgroundColor")
            th_color = page.evaluate("() => window.getComputedStyle(document.querySelector('.markdown-preview th')).color")
            td_border = page.evaluate("() => window.getComputedStyle(document.querySelector('.markdown-preview td')).borderColor")
            code_color = page.evaluate("() => window.getComputedStyle(document.querySelector('.markdown-preview pre code')).color")

            print(f"  • Table header bg: '{th_bg}' (expected #f1f5f9 / rgb(241, 245, 249))")
            print(f"  • Table header text color: '{th_color}' (expected #0f172a / rgb(15, 23, 42))")
            print(f"  • Table border: '{td_border}' (expected #e2e8f0 / rgb(226, 232, 240))")
            print(f"  • Pre code text color: '{code_color}'")

            assert th_bg in ["rgb(241, 245, 249)", "#f1f5f9"], f"Unexpected th bg: {th_bg}"
            assert th_color in ["rgb(15, 23, 42)", "#0f172a"], f"Unexpected th color: {th_color}"
            assert td_border in ["rgb(226, 232, 240)", "#e2e8f0"], f"Unexpected td border: {td_border}"

            page.evaluate("() => document.getElementById('results-workspace').scrollIntoView()")
            page.screenshot(path=str(SCREENSHOTS_DIR / "light_theme_results.png"), full_page=False)
            print(f"✓ Saved screenshots/light_theme_results.png")

            browser.close()
            print("\n✓ ALL LIGHT THEME VERIFICATION CHECKS PASSED!")

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        exit_code = 1
    finally:
        if server_proc:
            print("→ Terminating background server process...")
            server_proc.terminate()
            try:
                server_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_proc.kill()
            print("✓ Server process cleaned up.")

    return exit_code

if __name__ == "__main__":
    sys.exit(run_tests())
