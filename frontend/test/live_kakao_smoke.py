import os

from playwright.sync_api import expect, sync_playwright


base_url = os.environ.get("LOCATION_GUIDE_URL", "http://127.0.0.1:3102")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.goto(base_url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=30000)

    expect(page.locator("#map-loading")).to_have_class("map-loading hidden", timeout=20000)
    page.locator(".recommend-chip-btn").filter(has_text="헬스장").click()
    expect(page.locator("#result-count")).not_to_have_text("0", timeout=20000)
    expect(page.locator("#results-list .result-card").first).to_be_visible()

    if page_errors:
        raise AssertionError("uncaught page errors: " + " | ".join(page_errors))

    browser.close()
    print("Live Kakao smoke: actual place results rendered")
