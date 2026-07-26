import os

from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://127.0.0.1:3101"

KAKAO_STUB = r"""
(() => {
  class LatLng { constructor(lat, lng) { this.lat = lat; this.lng = lng; } }
  class LatLngBounds { extend() {} }
  class Map {
    constructor() {}
    setBounds() {}
    setLevel() {}
    panTo() {}
  }
  class Marker { constructor() {} setMap() {} }
  class CustomOverlay { constructor() {} setMap() {} }
  class Circle { constructor() {} setMap() {} }
  class Size { constructor() {} }
  class MarkerImage { constructor() {} }
  const samplePlaces = [
    { id: 'place-1', place_name: '서울 테스트 식당', category_name: '음식점', road_address_name: '서울 중구 세종대로 1', address_name: '서울 중구', x: '126.9784', y: '37.5666', distance: '320', place_url: 'https://place.map.kakao.com/1' },
    { id: 'place-2', place_name: '시청 테스트 카페', category_name: '카페', road_address_name: '서울 중구 세종대로 2', address_name: '서울 중구', x: '126.9790', y: '37.5670', distance: '540', place_url: 'https://place.map.kakao.com/2' }
  ];
  const Status = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' };
  class Places {
    keywordSearch(keyword, callback) {
      const status = window.__miaPlaceStatus || Status.OK;
      const data = status === Status.OK ? samplePlaces.map((item) => ({ ...item, place_name: `${keyword} · ${item.place_name}` })) : [];
      setTimeout(() => callback(data, status), 0);
    }
  }
  window.kakao = {
    maps: {
      load: (callback) => callback(), LatLng, LatLngBounds, Map, Marker,
      CustomOverlay, Circle, Size, MarkerImage,
      services: { Places, Status, SortBy: { ACCURACY: 'ACCURACY' } },
      event: { addListener() {} }
    }
  };
})();
"""

GEO_STUB = r"""
(() => {
  window.__miaGeoCalls = 0;
  window.__miaGeoMode = 'success';
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(success, error) {
        window.__miaGeoCalls += 1;
        if (window.__miaGeoMode === 'hang') return;
        if (window.__miaGeoMode === 'denied') return error({ code: 1 });
        if (window.__miaGeoMode === 'unavailable') return error({ code: 2 });
        success({ coords: { latitude: 37.5665, longitude: 126.9780 } });
      }
    }
  });
})();
"""


def make_page(browser, geo_mode="success", timeout_ms=None, viewport=None):
    page = browser.new_page(viewport=viewport or {"width": 1440, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.add_init_script(GEO_STUB)
    if geo_mode != "success":
        page.add_init_script(f"window.__miaGeoMode = '{geo_mode}';")
    if timeout_ms is not None:
        page.add_init_script(f"window.__MIA_LOCATION_TIMEOUT_MS = {timeout_ms};")
    page.route("**/v2/maps/sdk.js*", lambda route: route.fulfill(content_type="application/javascript", body=KAKAO_STUB))
    page.route("https://fonts.googleapis.com/**", lambda route: route.abort())
    page.route("https://fonts.gstatic.com/**", lambda route: route.abort())
    page.route("**/api/cafes*", lambda route: route.fulfill(status=503, content_type="application/json", body='{"error":{"code":"PUBLIC_API_NOT_CONFIGURED","message":"not configured"}}'))
    page.route("**/api/benefits*", lambda route: route.fulfill(status=503, content_type="application/json", body='{"error":{"code":"PUBLIC_API_NOT_CONFIGURED","message":"not configured"}}'))
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    return page, page_errors


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    page, errors = make_page(browser)
    assert page.evaluate("window.__miaGeoCalls") == 0, "페이지 로드가 위치 권한을 자동 요청했습니다."
    page.get_by_role("button", name="내 위치 사용").click()
    expect(page.locator("#location-status-title")).to_have_text("내 현재 위치 기준")
    assert not errors, errors
    page.close()

    page, errors = make_page(browser, geo_mode="denied")
    page.get_by_role("button", name="내 위치 사용").click()
    expect(page.locator("#location-status-title")).to_have_text("위치 권한이 꺼져 있습니다")
    expect(page.get_by_role("button", name="내 위치 다시 확인")).to_be_visible()
    assert "조회하고 있습니다" not in page.locator("#results-list").inner_text()
    assert not errors, errors
    page.close()

    page, errors = make_page(browser, geo_mode="hang", timeout_ms=40)
    page.get_by_role("button", name="내 위치 사용").click()
    expect(page.locator("#location-status-title")).to_have_text("위치 확인 시간이 초과됐습니다")
    assert "확인하고 있습니다" not in page.locator("#results-list").inner_text()
    assert not errors, errors
    page.close()

    page, errors = make_page(browser)
    page.locator("#btn-bung-main").click()
    page.get_by_role("button", name="맞춤 모임 장소 후보 찾기").click()
    expect(page.locator("#result-count")).to_have_text("2")
    assert "조건에 부합하는 장소를 찾지 못했습니다" not in page.locator("#results-list").inner_text()

    screenshot_path = os.environ.get("MIA_SCREENSHOT_PATH")
    if screenshot_path:
        page.screenshot(path=screenshot_path, full_page=True)

    page.locator(".radius-chip").filter(has_text="3km").click()
    expect(page.locator("#result-count")).to_have_text("2")
    expect(page.locator("#results-list")).to_contain_text("지도 장소 검색 결과")

    page.get_by_role("tab", name="정부 혜택 찾기").click()
    page.locator(".quick-chip-btn").filter(has_text="1인 창조기업").click()
    expect(page.get_by_role("link", name="정부24 혜택알리미 열기")).to_be_visible()
    expect(page.locator("#benefit-results-list")).not_to_contain_text("API 인증키")
    benefit_screenshot_path = os.environ.get("MIA_BENEFIT_SCREENSHOT_PATH")
    if benefit_screenshot_path:
        page.screenshot(path=benefit_screenshot_path, full_page=True)
    assert not errors, errors
    page.close()

    page, errors = make_page(browser)
    page.evaluate("window.__miaPlaceStatus = 'ZERO_RESULT'")
    page.locator(".recommend-chip-btn").filter(has_text="헬스장").click()
    expect(page.locator("#results-list")).to_contain_text("다른 위치나 키워드")
    page.evaluate("window.__miaPlaceStatus = 'ERROR'")
    page.locator(".recommend-chip-btn").filter(has_text="카페").click()
    expect(page.locator("#results-list")).to_contain_text("검색 연결이 원활하지 않습니다")
    assert not errors, errors
    page.close()

    page, errors = make_page(browser, viewport={"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "모바일 화면에 가로 스크롤이 생겼습니다."
    page.get_by_role("tab", name="정부 혜택 찾기").click()
    first_chip = page.locator(".quick-chip-btn").nth(0).bounding_box()
    second_chip = page.locator(".quick-chip-btn").nth(1).bounding_box()
    assert first_chip and second_chip and abs(first_chip["y"] - second_chip["y"]) < 2, "혜택 빠른 탐색이 모바일에서 2열로 정렬되지 않았습니다."
    assert not errors, errors
    page.close()

    browser.close()
    print("MIA UI vaccine: all scenarios passed")
