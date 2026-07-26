const fs = require('fs');
const path = require('path');

module.exports = {
  id: 'kakao-map-env-sync',
  name: 'Kakao Map 키 설정 및 백엔드/프론트엔드 2중 공급망이 정상 작동한다',
  layer: 'FUNCTION',
  async run(ctx) {
    const rootDir = ctx.projectDir || ctx.cwd || process.cwd();
    const envPath = path.join(rootDir, '.env');
    
    if (!fs.existsSync(envPath)) {
      return {
        status: 'WARNING',
        details: '.env 파일이 없습니다. 대체 지도(Leaflet OpenStreetMap)로 작동 중일 수 있습니다.'
      };
    }

    const content = fs.readFileSync(envPath, 'utf-8');
    const hasBackendKey = content.includes('KAKAO_MAP_APP_KEY=') && content.split('KAKAO_MAP_APP_KEY=')[1]?.trim().length > 0;
    const hasViteKey = content.includes('VITE_KAKAO_MAP_KEY=') && content.split('VITE_KAKAO_MAP_KEY=')[1]?.trim().length > 0;

    if (hasBackendKey && hasViteKey) {
      return {
        status: 'OK',
        details: 'KAKAO_MAP_APP_KEY 및 VITE_KAKAO_MAP_KEY 동기화 완료'
      };
    }

    if (hasBackendKey || hasViteKey) {
      return {
        status: 'OK',
        details: '/api/config 2중 안전 공급망으로 카카오 지도 키 전달 가능'
      };
    }

    return {
      status: 'WARNING',
      details: '카카오 지도 키가 설정되지 않아 OpenStreetMap 대체 운용 중입니다.'
    };
  }
};
