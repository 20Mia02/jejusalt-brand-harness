const sharp = require('sharp');
const path = require('path');

const logoPath = path.join(__dirname, 'jejusalt-frontend/public/assets/logo/jeju-salt-logo.png');

async function analyzeLogo() {
  try {
    const image = sharp(logoPath);
    const metadata = await image.metadata();
    let buffer = await image.raw().toBuffer();

    const colors = {};

    // 모든 픽셀 색상 분석
    for (let i = 0; i < buffer.length; i += metadata.channels) {
      const r = buffer[i];
      const g = buffer[i + 1];
      const b = buffer[i + 2];
      const a = metadata.channels === 4 ? buffer[i + 3] : 255;

      // 투명 픽셀 제외
      if (a === 0) continue;

      const key = `rgb(${r},${g},${b})`;
      colors[key] = (colors[key] || 0) + 1;
    }

    // 색상을 빈도순으로 정렬
    const sorted = Object.entries(colors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // 상위 20개

    console.log('로고의 상위 20개 색상:');
    sorted.forEach(([color, count], i) => {
      const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
        console.log(`${i + 1}. ${color} (HEX: ${hex}) - 픽셀 수: ${count}`);
      }
    });
  } catch (err) {
    console.error('로고 분석 실패:', err);
    process.exit(1);
  }
}

analyzeLogo();
