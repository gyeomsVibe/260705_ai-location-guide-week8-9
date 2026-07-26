import json
import os
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright


url = os.environ.get("LOCATION_GUIDE_URL", "http://127.0.0.1:5173")
screenshot = Path(os.environ.get("LAYOUT_SCREENSHOT_PATH", r"C:\tmp\ai-location-live-baseline.png"))
screenshot.parent.mkdir(parents=True, exist_ok=True)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1728, "height": 1100})
    console_errors = []
    page_errors = []
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    response = page.goto(url, wait_until="domcontentloaded", timeout=60000)
    try:
        page.wait_for_load_state("networkidle", timeout=30000)
    except Exception:
        pass

    metrics = page.evaluate(
        """
        () => ({
          title: document.title,
          viewport: { width: innerWidth, height: innerHeight },
          document: {
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight
          },
          buttons: [...document.querySelectorAll('button')].map((node) =>
            (node.getAttribute('aria-label') || node.innerText || '').trim()
          ).filter(Boolean).slice(0, 80),
          headings: [...document.querySelectorAll('h1,h2,h3')].map((node) =>
            node.innerText.trim()
          ).filter(Boolean).slice(0, 40),
          rootChildren: document.body.children.length,
          bodyText: document.body.innerText.trim().slice(0, 1200)
        })
        """
    )
    page.screenshot(path=str(screenshot), full_page=True)
    print(
        json.dumps(
            {
                "status": response.status if response else None,
                "url": page.url,
                "metrics": metrics,
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "screenshot": str(screenshot),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    browser.close()
