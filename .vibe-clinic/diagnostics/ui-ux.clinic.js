const fs = require("node:fs");
const path = require("node:path");

module.exports = {
  id: "ui-ux-diagnostic",
  name: "UI/UX Visual and Accessibility Diagnostic",
  layer: "FUNCTION",
  linkedTask: "TASK-002",

  async run(ctx) {
    const rootPath = ctx.cwd || process.cwd();
    const htmlPath = path.join(rootPath, "frontend", "public", "index.html");

    if (!fs.existsSync(htmlPath)) return { status: "ERROR", details: "frontend/public/index.html 파일이 없습니다." };

    const htmlContent = fs.readFileSync(htmlPath, "utf8");
    if (!htmlContent.includes('<html lang="ko">') && !htmlContent.includes('<html lang="en">')) return { status: "WARNING", details: "스크린 리더를 위해 html lang 속성이 필요합니다." };
    if (!htmlContent.includes(":root") || !htmlContent.includes("--primary")) return { status: "WARNING", details: "디자인 시스템용 CSS 변수를 확인하지 못했습니다." };
    if (!htmlContent.includes("transition:")) return { status: "WARNING", details: "상호작용 피드백용 transition이 없습니다." };
    if (!htmlContent.includes("::-webkit-scrollbar")) return { status: "WARNING", details: "스크롤바 스타일을 확인하지 못했습니다." };
    if (htmlContent.includes("tryAutoDetectLocation();")) return { status: "ERROR", details: "페이지 로드 중 위치 권한을 자동 요청하고 있습니다." };
    if (!htmlContent.includes('id="btn-use-location"') || !htmlContent.includes("renderLocationFailure")) return { status: "ERROR", details: "위치 요청 또는 위치 실패 복구 UI가 없습니다." };
    if (!htmlContent.includes("function focusOnPlace()")) return { status: "ERROR", details: "위치 변경 후 지도를 이동하는 focusOnPlace 계약이 없습니다." };
    if (!htmlContent.includes("searchMultiplePlaceCategories")) return { status: "ERROR", details: "병원·약국 복수 카테고리 검색 경로가 없습니다." };
    if (!htmlContent.includes("renderBenefitFallback")) return { status: "ERROR", details: "혜택 서비스 장애 시 공식 확인 경로가 없습니다." };
    if (htmlContent.includes("혜택 API 인증키 설정을 확인해 주세요")) return { status: "ERROR", details: "운영 인증 설정을 사용자에게 해결하도록 요구하고 있습니다." };
    if (!htmlContent.includes(".quick-chip-grid") || !htmlContent.includes("grid-template-columns: repeat(2")) return { status: "WARNING", details: "혜택 빠른 탐색의 균형 잡힌 그리드가 없습니다." };

    return { status: "OK", details: "위치·장소·혜택의 성공 및 실패 복구 UI와 반응형 정보 구조가 확인되었습니다." };
  }
};
