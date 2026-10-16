#!/usr/bin/env python3
"""
MinuteAI — Comprehensive Mobile Viewport Automated Test Suite
Evaluates full responsiveness across mobile viewports (320px to 768px).

Verifies:
 1. document.documentElement.scrollWidth <= window.innerWidth (ZERO horizontal scrolling)
 2. Visible element bounding rects: no elements spilling outside viewport borders
 3. Key components:
    - Header & status pills
    - Dropzone & format badges
    - Persona cards grid (cards width <= viewport)
    - Advanced settings accordion & form inputs
    - Action bar & generate button
    - Stepper track (stepper steps within border)
    - Results workspace (tabs, toolbar buttons, rendered tables, pre blocks, transcript segments)
 4. Interactive states:
    - "Try Demo Meeting" audio load & preview card
    - Advanced Settings accordion expand
    - Render sample meeting minutes (rich markdown with table and pre code blocks)
    - Transcript tab switching & segment timeline
 5. Screenshots captured into `screenshots/` directory (mobile_320.png, mobile_375.png, mobile_412.png, etc.)
"""

import os
import sys
import time
import json
import urllib.request
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

try:
    from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
except ImportError:
    print("ERROR: Playwright is not installed in the python environment.")
    print("Run: pip install playwright && playwright install chromium")
    sys.exit(1)

# Working directory and output paths
REPO_ROOT = Path(__file__).resolve().parent
SCREENSHOTS_DIR = REPO_ROOT / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Mobile Viewports matrix
VIEWPORTS = [
    {"name": "iPhone SE 1st gen", "width": 320, "height": 568, "slug": "320"},
    {"name": "Galaxy S8 / small Android", "width": 360, "height": 740, "slug": "360"},
    {"name": "iPhone SE 2nd/3rd gen", "width": 375, "height": 667, "slug": "375"},
    {"name": "iPhone 14/15", "width": 390, "height": 844, "slug": "390"},
    {"name": "Pixel 7 / Galaxy S23", "width": 412, "height": 915, "slug": "412"},
    {"name": "iPad / tablet portrait", "width": 768, "height": 1024, "slug": "768"},
]

# Rich sample meeting minutes for results workspace testing
SAMPLE_MINUTES_MARKDOWN = """# Executive Meeting Minutes: Q4 Architecture & Product Sync

## 1. Executive Summary
The engineering leadership and product steering committee met to finalize Q4 deliverables, Whisper speech-to-text inference latency milestones, and infrastructure cost models.

## 2. Key Decisions & Strategic Initiatives
| Strategic Initiative | Responsible Owner | Target Date | Budget Allocation | Risk / Status |
| :--- | :--- | :--- | :--- | :--- |
| Core Whisper Engine CPU Optimization | Alex Miller (Arch) | 2026-11-15 | $45,000 | Low - In Benchmarking |
| Multi-tenant Role Based Access Control | Elena Rostova (UX) | 2026-12-01 | $32,000 | Medium - Spec Approved |
| Production Kubernetes Cluster Deployment | David Kim (Ops) | 2026-12-20 | $58,000 | Low - Staging Ready |
| Enterprise Client Pilot Launch (500 seats) | Sarah Chen (Product) | 2027-01-15 | $75,000 | High - Blocked on RBAC |

## 3. Architecture & Implementation Directives
```bash
# Benchmark command for speech recognition latency on 4-thread CPU
curl -X POST https://api.minuteai.corp/v1/jobs/benchmark \\
  -H "Authorization: Bearer $MINUTES_AI_TOKEN" \\
  -d '{"model": "whisper-base", "compute_type": "int8", "threads": 4}'
```

> **Direct Operational Mandate:** All containerized worker nodes must cap peak memory consumption under 2.0 GB during streaming audio transcription to avoid OOM churn.

## 4. Open Discussion Points & Follow-ups
* Review token streaming latency with frontend visualization team.
* Validate Safari iOS AudioContext permissions on live microphone recording.
* Finalize security assessment before SOC2 Type II audit.
"""

SAMPLE_TRANSCRIPT_SEGMENTS = [
    {"start": 0.0, "text": "Sarah Chen: Good morning everyone. Let's review the Q4 product roadmap and Whisper inference optimizations."},
    {"start": 8.4, "text": "Alex Miller: Thanks Sarah. On the Whisper STT side, quantizing weights to int8 brought our CPU transcription time down by 42%."},
    {"start": 19.2, "text": "Elena Rostova: That improves user experience significantly on mobile devices. Will memory usage remain stable?"},
    {"start": 30.5, "text": "David Kim: Yes, memory stays capped at under 1.8GB per concurrent worker node in our staging benchmarks."}
]


# =============================================================================
# Server Process Management
# =============================================================================
def is_server_ready(url: str = "http://127.0.0.1:8000/api/health") -> bool:
    """Check if the FastAPI backend is already up and healthy."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MobileResponsiveTest"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


def start_server_if_needed() -> Tuple[Optional[subprocess.Popen], str]:
    """Start uvicorn server in a subprocess if not running, wait for readiness."""
    base_url = "http://127.0.0.1:8000"
    if is_server_ready():
        print(f"✓ FastAPI server is already running at {base_url}")
        return None, base_url

    print("→ Starting FastAPI server in background...")
    log_file_path = REPO_ROOT / "server_test.log"
    log_file = open(log_file_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(REPO_ROOT),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True
    )

    # Wait up to 35 seconds for server startup using monotonic clock
    start_time = time.monotonic()
    while time.monotonic() - start_time < 35:
        if is_server_ready():
            print(f"✓ Server started successfully at {base_url} (in {time.monotonic()-start_time:.1f}s)")
            return proc, base_url
        if proc.poll() is not None:
            log_file.close()
            with open(log_file_path, "r", encoding="utf-8", errors="replace") as f:
                logs = f.read()
            raise RuntimeError(f"Server process terminated prematurely with exit code {proc.returncode}:\n{logs}")
        time.sleep(0.5)

    proc.terminate()
    log_file.close()
    with open(log_file_path, "r", encoding="utf-8", errors="replace") as f:
        logs = f.read()
    raise TimeoutError(f"Server failed to respond to /api/health within 35 seconds. Logs:\n{logs}")

# =============================================================================
# JavaScript Evaluation Helpers
# =============================================================================
JS_OVERFLOW_CHECK = """
() => {
    const innerWidth = window.innerWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const bodyScrollWidth = document.body ? document.body.scrollWidth : 0;
    const maxScroll = Math.max(scrollWidth, bodyScrollWidth);
    const hasHorizontalOverflow = maxScroll > innerWidth;

    const issues = [];
    const elements = Array.from(document.querySelectorAll('*'));

    for (const el of elements) {
        // Skip invisible / non-rendered elements
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            continue;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            continue;
        }

        // Check if element is inside an ancestor that legitimately scrolls or clips overflow
        let isClipped = false;
        let parent = el.parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
            const pStyle = window.getComputedStyle(parent);
            const ox = pStyle.overflowX;
            if (ox === 'hidden' || ox === 'auto' || ox === 'scroll') {
                const pRect = parent.getBoundingClientRect();
                // If parent itself is horizontally within viewport bounds, it clips children
                if (pRect.right <= innerWidth + 1.5 && pRect.left >= -1.5) {
                    isClipped = true;
                    break;
                }
            }
            parent = parent.parentElement;
        }

        const rightOverflow = rect.right - (innerWidth + 1.0);
        const leftOverflow = -1.0 - rect.left;

        if (!isClipped && (rightOverflow > 0.5 || leftOverflow > 0.5)) {
            let sel = el.tagName.toLowerCase();
            if (el.id) sel += '#' + el.id;
            if (el.className && typeof el.className === 'string') {
                sel += '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.');
            }
            issues.push({
                selector: sel,
                rect: {
                    left: Math.round(rect.left * 10) / 10,
                    right: Math.round(rect.right * 10) / 10,
                    width: Math.round(rect.width * 10) / 10
                },
                rightOverflow: Math.max(0, Math.round(rightOverflow * 10) / 10),
                leftOverflow: Math.max(0, Math.round(leftOverflow * 10) / 10)
            });
        }
    }

    return {
        innerWidth: innerWidth,
        scrollWidth: scrollWidth,
        bodyScrollWidth: bodyScrollWidth,
        maxScroll: maxScroll,
        hasHorizontalOverflow: hasHorizontalOverflow,
        issueCount: issues.length,
        issues: issues.slice(0, 15) // Limit output preview
    };
}
"""

JS_VERIFY_COMPONENTS = """
() => {
    const innerWidth = window.innerWidth;
    const results = {};

    function checkEl(sel, checkWidth = true) {
        const el = document.querySelector(sel);
        if (!el) return { found: false, ok: false, error: 'Element not found' };
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const visible = style.display !== 'none' && style.visibility !== 'hidden';
        const rightOk = rect.right <= innerWidth + 1.5;
        const leftOk = rect.left >= -1.5;
        const widthOk = !checkWidth || rect.width <= innerWidth + 1.5;
        return {
            found: true,
            visible: visible,
            width: Math.round(rect.width),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            ok: rightOk && leftOk && widthOk
        };
    }

    // Header & Status Pills
    results.header = checkEl('.app-header');
    results.headerInner = checkEl('.header-inner');
    results.statusAgy = checkEl('#status-agy');

    // Dropzone & Format Badges
    results.dropZone = checkEl('#drop-zone');
    const badges = Array.from(document.querySelectorAll('.format-badges .badge'));
    results.formatBadges = {
        count: badges.length,
        allWithinBorder: badges.every(b => {
            const r = b.getBoundingClientRect();
            return r.right <= innerWidth + 1.5 && r.left >= -1.5;
        })
    };

    // Persona Grid & Cards
    results.personaGrid = checkEl('#persona-grid');
    const cards = Array.from(document.querySelectorAll('.persona-card'));
    results.personaCards = {
        count: cards.length,
        allWithinBorder: cards.every(c => {
            const r = c.getBoundingClientRect();
            return r.right <= innerWidth + 1.5 && r.left >= -1.5 && r.width <= innerWidth;
        }),
        maxCardWidth: Math.max(...cards.map(c => Math.round(c.getBoundingClientRect().width)))
    };

    // Action Bar & Generate Button
    results.actionBar = checkEl('.action-bar');
    results.btnGenerate = checkEl('#btn-generate');

    return results;
}
"""

JS_POPULATE_RESULTS_WORKSPACE = """
(data) => {
    const sampleMarkdown = data.sampleMarkdown;
    const sampleSegments = data.sampleSegments;
    // Populate Results Workspace for mobile responsiveness verification
    const workspace = document.getElementById('results-workspace');
    const setupSection = document.getElementById('setup-section');
    const stepProgress = document.getElementById('step-progress');
    const mdPreview = document.getElementById('markdown-preview');
    const timeline = document.getElementById('transcript-timeline');
    const segCount = document.getElementById('transcript-segment-count');

    if (!workspace || !mdPreview || !timeline) {
        return { ok: false, error: 'Results elements not found in DOM' };
    }
    // Render markdown using vendor marked if available, or structured fallback
    if (typeof marked !== 'undefined' && marked.parse) {
        mdPreview.innerHTML = marked.parse(sampleMarkdown);
    } else {
        // Build fallback HTML with table and code block
        mdPreview.innerHTML = `
            <h2>Executive Meeting Minutes: Q4 Architecture & Product Sync</h2>
            <p>The steering committee reviewed Whisper latency benchmarks and memory limits.</p>
            <table class="minutes-table">
                <thead>
                    <tr><th>Initiative</th><th>Owner</th><th>Date</th><th>Budget</th><th>Status</th></tr>
                </thead>
                <tbody>
                    <tr><td>Whisper Optimization</td><td>Alex Miller</td><td>2026-11-15</td><td>$45,000</td><td>In Progress</td></tr>
                    <tr><td>Enterprise RBAC</td><td>Elena Rostova</td><td>2026-12-01</td><td>$32,000</td><td>Approved</td></tr>
                    <tr><td>Kubernetes Rollout</td><td>David Kim</td><td>2026-12-20</td><td>$58,000</td><td>Staging</td></tr>
                </tbody>
            </table>
            <pre><code>curl -X POST https://api.minuteai.corp/v1/jobs/benchmark -d '{"threads": 4}'</code></pre>
            <blockquote>Operational mandate: Cap peak memory under 2.0 GB.</blockquote>
        `;
    }

    // Populate Transcript Timeline
    timeline.innerHTML = '';
    sampleSegments.forEach((seg, idx) => {
        const item = document.createElement('div');
        item.className = 'transcript-segment';
        item.setAttribute('data-index', idx);
        const mins = Math.floor(seg.start / 60);
        const secs = Math.floor(seg.start % 60);
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        item.innerHTML = `
            <button class="transcript-timestamp">[${timeStr}]</button>
            <div class="transcript-text">${seg.text}</div>
        `;
        timeline.appendChild(item);
    });
    if (segCount) segCount.textContent = sampleSegments.length;

    // Display Results Workspace via Wizard Step 4
    if (typeof window.goToWizardStep === 'function') {
        window.goToWizardStep(4);
    } else {
        const page4 = document.getElementById('wizard-page-4');
        if (page4) page4.style.display = 'block';
        workspace.style.display = 'block';
        if (stepProgress) stepProgress.style.display = 'none';
    }
    return { ok: true, tableCount: mdPreview.querySelectorAll('table').length, segmentCount: sampleSegments.length };
}
"""


# =============================================================================
# Viewport Runner Function
# =============================================================================
def test_viewport(
    browser: Browser,
    base_url: str,
    vp_config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute full responsive test suite against a single mobile viewport."""
    name = vp_config["name"]
    width = vp_config["width"]
    height = vp_config["height"]
    slug = vp_config["slug"]

    print(f"\n================================================================================")
    print(f"▶ Testing Viewport: {name} ({width}x{height})")
    print(f"================================================================================")

    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        is_mobile=True,
        has_touch=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
    )

    page = context.new_page()
    vp_report: Dict[str, Any] = {
        "name": name,
        "width": width,
        "height": height,
        "slug": slug,
        "passed": True,
        "stages": {},
        "issues": []
    }

    try:
        # ---------------------------------------------------------------------
        # STAGE 1: Initial Page Load
        # ---------------------------------------------------------------------
        print(f"  [1/5] Loading initial page at {width}x{height}...")
        page.goto(base_url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_selector("#drop-zone", timeout=8000)
        time.sleep(0.3)  # Allow initial CSS rendering to stabilize

        initial_overflow = page.evaluate(JS_OVERFLOW_CHECK)
        components_check = page.evaluate(JS_VERIFY_COMPONENTS)

        stage1_ok = (not initial_overflow["hasHorizontalOverflow"]) and (initial_overflow["issueCount"] == 0)
        vp_report["stages"]["initial_load"] = {
            "ok": stage1_ok,
            "scrollWidth": initial_overflow["scrollWidth"],
            "innerWidth": initial_overflow["innerWidth"],
            "issueCount": initial_overflow["issueCount"],
            "issues": initial_overflow["issues"],
            "components": components_check
        }

        if stage1_ok:
            print(f"    ✓ Initial page load: ZERO horizontal overflow (scrollWidth={initial_overflow['scrollWidth']} <= {width})")
        else:
            vp_report["passed"] = False
            print(f"    ✗ Stage 1 Overflow detected! scrollWidth={initial_overflow['scrollWidth']} > innerWidth={width}")
            for iss in initial_overflow["issues"]:
                print(f"       Issue: {iss['selector']} right={iss['rect']['right']} (+{iss['rightOverflow']}px)")

        # Verify initial Step 1 components
        step1_components = page.evaluate("""
        () => {
            const innerWidth = window.innerWidth;
            const nav = document.getElementById('wizard-nav-stepper');
            const drop = document.getElementById('drop-zone');
            const btnNext = document.getElementById('btn-to-step-2');
            const nRect = nav ? nav.getBoundingClientRect() : null;
            const dRect = drop ? drop.getBoundingClientRect() : null;
            const bRect = btnNext ? btnNext.getBoundingClientRect() : null;
            return {
                navOk: !nRect || (nRect.right <= innerWidth + 1.5 && nRect.left >= -1.5),
                dropOk: !dRect || (dRect.right <= innerWidth + 1.5 && dRect.left >= -1.5),
                btnNextOk: !bRect || (bRect.right <= innerWidth + 1.5 && bRect.left >= -1.5)
            };
        }
        """)
        if step1_components["navOk"] and step1_components["dropOk"] and step1_components["btnNextOk"]:
            print(f"    ✓ Step 1 UI components: Top wizard nav, dropzone, and next button cleanly bounded")
        else:
            vp_report["passed"] = False
            print(f"    ✗ Step 1 UI components excursion outside bounds: {step1_components}")
        # ---------------------------------------------------------------------
        # STAGE 2: "Try Demo Meeting" Audio Load & Preview Card
        # ---------------------------------------------------------------------
        print(f"  [2/5] Simulating 'Try Demo Meeting' interactive flow...")
        page.click("#tab-btn-demo")
        page.wait_for_selector("#btn-load-demo", state="visible", timeout=5000)
        page.click("#btn-load-demo")

        # Wait for audio preview card to appear
        page.wait_for_selector("#audio-preview-card", state="visible", timeout=8000)
        time.sleep(0.3)

        preview_box = page.evaluate("""
        () => {
            const card = document.getElementById('audio-preview-card');
            const audio = document.getElementById('audio-element');
            const meta = card ? card.querySelector('.audio-meta') : null;
            const innerWidth = window.innerWidth;
            const cRect = card ? card.getBoundingClientRect() : null;
            const aRect = audio ? audio.getBoundingClientRect() : null;
            return {
                cardRight: cRect ? cRect.right : 0,
                audioRight: aRect ? aRect.right : 0,
                innerWidth: innerWidth,
                ok: cRect && cRect.right <= innerWidth + 1.5 && (!aRect || aRect.right <= innerWidth + 1.5)
            };
        }
        """)

        demo_overflow = page.evaluate(JS_OVERFLOW_CHECK)
        stage3_ok = (not demo_overflow["hasHorizontalOverflow"]) and (demo_overflow["issueCount"] == 0) and preview_box["ok"]
        vp_report["stages"]["demo_meeting"] = {
            "ok": stage3_ok,
            "previewBox": preview_box,
            "overflow": demo_overflow
        }

        if stage3_ok:
            print(f"    ✓ Audio preview card rendered cleanly within border (right={preview_box['cardRight']:.0f}px <= {width}px)")
        else:
            vp_report["passed"] = False
            print(f"    ✗ Demo preview overflow: cardRight={preview_box['cardRight']}px innerWidth={width}px")

        # Capture evidence screenshot for demo state
        demo_screenshot_path = SCREENSHOTS_DIR / f"mobile_{slug}_demo.png"
        page.screenshot(path=str(demo_screenshot_path), full_page=False)

        # Navigate to Step 2 via Wizard Next Button
        print(f"  [2b] Navigating Wizard: Step 1 -> Step 2 (Choose Persona)...")
        page.click("#btn-to-step-2")
        page.wait_for_selector("#wizard-page-2", state="visible", timeout=5000)
        time.sleep(0.3)

        # Verify Persona Grid & Cards on Step 2
        persona_check = page.evaluate(JS_VERIFY_COMPONENTS)
        if persona_check.get("personaCards", {}).get("allWithinBorder"):
            print(f"    ✓ Step 2 Persona cards: all {persona_check['personaCards']['count']} cards within viewport (max={persona_check['personaCards']['maxCardWidth']}px)")
        else:
            vp_report["passed"] = False
            print(f"    ✗ Step 2 Persona cards: some cards overflow viewport!")

        # ---------------------------------------------------------------------
        # STAGE 3: Advanced Settings Accordion Expand
        # ---------------------------------------------------------------------
        print(f"  [3/5] Expanding Advanced Settings accordion...")
        # Scroll accordion into view and click
        page.evaluate("() => document.getElementById('accordion-toggle').scrollIntoView()")
        time.sleep(0.1)
        page.click("#accordion-toggle")
        page.wait_for_selector("#advanced-panel", state="visible", timeout=5000)
        time.sleep(0.2)

        inputs_check = page.evaluate("""
        () => {
            const innerWidth = window.innerWidth;
            const panel = document.getElementById('advanced-panel');
            const inputs = Array.from(panel ? panel.querySelectorAll('input, select, textarea') : []);
            return {
                count: inputs.length,
                allWithinBounds: inputs.every(inp => {
                    const r = inp.getBoundingClientRect();
                    return r.right <= innerWidth + 1.5 && r.left >= -1.5;
                }),
                inputs: inputs.map(inp => ({
                    id: inp.id,
                    width: Math.round(inp.getBoundingClientRect().width),
                    right: Math.round(inp.getBoundingClientRect().right)
                }))
            };
        }
        """)

        accordion_overflow = page.evaluate(JS_OVERFLOW_CHECK)
        stage4_ok = (not accordion_overflow["hasHorizontalOverflow"]) and (accordion_overflow["issueCount"] == 0) and inputs_check["allWithinBounds"]
        vp_report["stages"]["advanced_settings"] = {
            "ok": stage4_ok,
            "inputsCheck": inputs_check,
            "overflow": accordion_overflow
        }

        if stage4_ok:
            print(f"    ✓ Advanced Settings expanded: all {inputs_check['count']} form controls within border")
        else:
            vp_report["passed"] = False
            print(f"    ✗ Advanced Settings overflow: inputs overflowing border!")

        # ---------------------------------------------------------------------
        # STAGE 4: Stepper Track Validation
        # ---------------------------------------------------------------------
        print(f"  [4/5] Testing Stepper Track and progress UI (Step 3)...")
        page.evaluate("""
        () => {
            if (typeof window.goToWizardStep === 'function') {
                window.goToWizardStep(3);
            } else {
                const progress = document.getElementById('step-progress');
                if (progress) progress.style.display = 'block';
            }
        }
        """)
        time.sleep(0.2)

        stepper_box = page.evaluate("""
        () => {
            const track = document.getElementById('stepper-track');
            const steps = Array.from(document.querySelectorAll('.stepper-step'));
            const innerWidth = window.innerWidth;
            const stepDetails = steps.map(st => {
                const r = st.getBoundingClientRect();
                return {
                    text: st.textContent.trim().replace(/\\s+/g, ' '),
                    left: Math.round(r.left),
                    right: Math.round(r.right),
                    width: Math.round(r.width),
                    ok: r.right <= innerWidth + 1.5 && r.left >= -1.5
                };
            });
            return {
                stepCount: steps.length,
                allStepsWithinBounds: stepDetails.every(s => s.ok),
                stepDetails: stepDetails,
                trackRight: track ? Math.round(track.getBoundingClientRect().right) : 0,
                innerWidth: innerWidth
            };
        }
        """)
        stepper_overflow = page.evaluate(JS_OVERFLOW_CHECK)
        stage5_ok = (not stepper_overflow["hasHorizontalOverflow"]) and (stepper_overflow["issueCount"] == 0) and stepper_box["allStepsWithinBounds"]
        vp_report["stages"]["stepper_track"] = {
            "ok": stage5_ok,
            "stepper": stepper_box,
            "overflow": stepper_overflow
        }

        if stage5_ok:
            print(f"    ✓ Stepper Track: all {stepper_box['stepCount']} steps within boundaries")
        else:
            vp_report["passed"] = False
            print(f"    ✗ Stepper Track stage failed:")
            print(f"       hasHorizontalOverflow={stepper_overflow['hasHorizontalOverflow']} (scrollWidth={stepper_overflow['scrollWidth']} vs innerWidth={width})")
            print(f"       allStepsWithinBounds={stepper_box['allStepsWithinBounds']}")
            for sd in stepper_box.get("stepDetails", []):
                if not sd["ok"]:
                    print(f"       Failed step: '{sd['text']}' (left={sd['left']}, right={sd['right']}, ok={sd['ok']})")
            for iss in stepper_overflow.get("issues", []):
                print(f"       Overflow issue: {iss['selector']} right={iss['rect']['right']} (+{iss['rightOverflow']}px)")
        # Capture evidence screenshot for stepper state
        stepper_screenshot_path = SCREENSHOTS_DIR / f"mobile_{slug}_stepper.png"
        page.screenshot(path=str(stepper_screenshot_path), full_page=False)

        # ---------------------------------------------------------------------
        # STAGE 5: Results Workspace (Rich Markdown, Table, Pre, Transcript)
        # ---------------------------------------------------------------------
        print(f"  [5/5] Rendering simulated Results Workspace with Table & Pre...")
        page.evaluate(
            JS_POPULATE_RESULTS_WORKSPACE,
            {"sampleMarkdown": SAMPLE_MINUTES_MARKDOWN, "sampleSegments": SAMPLE_TRANSCRIPT_SEGMENTS}
        )
        time.sleep(0.3)

        results_components = page.evaluate("""
        () => {
            const innerWidth = window.innerWidth;
            const header = document.querySelector('.workspace-header');
            const toolbar = document.querySelector('.workspace-toolbar');
            const table = document.querySelector('.markdown-preview table');
            const pre = document.querySelector('.markdown-preview pre');
            const tabs = document.querySelector('.workspace-tabs');

            const hRect = header ? header.getBoundingClientRect() : null;
            const tRect = toolbar ? toolbar.getBoundingClientRect() : null;
            const tblRect = table ? table.getBoundingClientRect() : null;
            const preRect = pre ? pre.getBoundingClientRect() : null;

            return {
                headerOk: !hRect || (hRect.right <= innerWidth + 1.5 && hRect.left >= -1.5),
                toolbarOk: !tRect || (tRect.right <= innerWidth + 1.5 && tRect.left >= -1.5),
                tablePresent: !!table,
                tableRect: tblRect ? { width: Math.round(tblRect.width), right: Math.round(tblRect.right) } : null,
                prePresent: !!pre,
                preRect: preRect ? { width: Math.round(preRect.width), right: Math.round(preRect.right) } : null,
                innerWidth: innerWidth
            };
        }
        """)

        results_overflow = page.evaluate(JS_OVERFLOW_CHECK)

        # Also test switching to Transcript tab
        page.click("#wtab-transcript")
        time.sleep(0.2)
        transcript_box = page.evaluate("""
        () => {
            const timeline = document.getElementById('transcript-timeline');
            const segments = Array.from(document.querySelectorAll('.transcript-segment'));
            const search = document.getElementById('transcript-search-input');
            const innerWidth = window.innerWidth;
            const sRect = search ? search.getBoundingClientRect() : null;
            return {
                segmentCount: segments.length,
                allSegmentsOk: segments.every(s => {
                    const r = s.getBoundingClientRect();
                    return r.right <= innerWidth + 1.5 && r.left >= -1.5;
                }),
                searchOk: !sRect || (sRect.right <= innerWidth + 1.5 && sRect.left >= -1.5)
            };
        }
        """)

        # Switch back to Minutes tab for primary evidence screenshot
        page.click("#wtab-minutes")
        time.sleep(0.2)

        stage6_ok = (not results_overflow["hasHorizontalOverflow"]) and (results_overflow["issueCount"] == 0) and transcript_box["allSegmentsOk"]
        vp_report["stages"]["results_workspace"] = {
            "ok": stage6_ok,
            "resultsComponents": results_components,
            "transcriptBox": transcript_box,
            "overflow": results_overflow
        }

        if stage6_ok:
            print(f"    ✓ Results Workspace (Table & Pre & Transcript) rendered without horizontal overflow")
        else:
            vp_report["passed"] = False
            print(f"    ✗ Results Workspace overflow: scrollWidth={results_overflow['scrollWidth']} innerWidth={width}")

        # Capture primary screenshot requested by prompt (e.g. mobile_320.png)
        primary_screenshot = SCREENSHOTS_DIR / f"mobile_{slug}.png"
        page.screenshot(path=str(primary_screenshot), full_page=True)

        results_screenshot = SCREENSHOTS_DIR / f"mobile_{slug}_results.png"
        page.screenshot(path=str(results_screenshot), full_page=False)
        print(f"    📸 Screenshots captured: {primary_screenshot.name}, mobile_{slug}_results.png")

    except Exception as e:
        vp_report["passed"] = False
        vp_report["error"] = str(e)
        print(f"    ✗ Unhandled exception during viewport {name}: {e}")

    finally:
        context.close()

    status_str = "PASSED ✓" if vp_report["passed"] else "FAILED ✗"
    print(f"→ Result for {name} ({width}px): {status_str}\n")
    return vp_report


# =============================================================================
# Main Orchestration Routine
# =============================================================================
def main():
    print("=" * 80)
    print("   MinuteAI — Comprehensive Mobile Viewport Automated Test Suite")
    print("=" * 80)

    # 1. Ensure server is up
    server_proc, base_url = start_server_if_needed()

    reports = []
    overall_success = True

    try:
        # 2. Launch Chromium via Playwright
        print(f"→ Launching Chromium headless browser...")
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
                ]
            )

            # 3. Test each viewport in matrix
            for vp in VIEWPORTS:
                rep = test_viewport(browser, base_url, vp)
                reports.append(rep)
                if not rep["passed"]:
                    overall_success = False

            browser.close()

    finally:
        # 4. Clean up server if we spawned it
        if server_proc is not None:
            print("→ Terminating background test server...")
            server_proc.terminate()
            try:
                server_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_proc.kill()
            print("✓ Server process terminated cleanly")

    # 5. Output Summary Table
    print("\n" + "=" * 80)
    print("   MOBILE VIEWPORT RESPONSIVENESS TEST SUMMARY")
    print("=" * 80)
    print(f"{'Viewport Name':<28} {'Dimensions':<12} {'Scroll':<10} {'Issues':<8} {'Status':<10}")
    print("-" * 80)

    for rep in reports:
        dim = f"{rep['width']}x{rep['height']}"
        init_st = rep["stages"].get("initial_load", {})
        scroll = f"{init_st.get('scrollWidth', '-')}/{init_st.get('innerWidth', '-')}"
        issue_cnt = str(init_st.get("issueCount", "-"))
        status = "PASSED" if rep["passed"] else "FAILED"
        print(f"{rep['name']:<28} {dim:<12} {scroll:<10} {issue_cnt:<8} {status:<10}")

    print("=" * 80)

    # List generated screenshots
    screenshots = list(SCREENSHOTS_DIR.glob("*.png"))
    print(f"Evidence screenshots saved in {SCREENSHOTS_DIR} ({len(screenshots)} files):")
    for s in sorted(screenshots):
        print(f"  - {s.name} ({s.stat().st_size // 1024} KB)")

    if overall_success:
        print("\n🎉 ALL MOBILE VIEWPORTS PASSED WITH ZERO HORIZONTAL OVERFLOW!")
        return 0
    else:
        print("\n⚠️ SOME MOBILE VIEWPORTS EXHIBITED OVERFLOW OR BOUNDARY EXCURSIONS.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
