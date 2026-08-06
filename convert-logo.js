const sharp = require('sharp');
const path = require('path');

const logoPath = path.join(__dirname, 'jejusalt-frontend/public/assets/logo/jeju-salt-logo.png');
const outputPath = path.join(__dirname, 'jejusalt-frontend/public/assets/logo/jeju-salt-logo-dark.png');

// 파란색 #2AABE2 (RGB: 42, 171, 226) - 원본 로고의 파란색
const brandBlue = { r: 42, g: 171, b: 226 };
const blueThreshold = 10; // 파란색 인식 범위

async function convertLogo() {
  try {
    const image = sharp(logoPath);
    const metadata = await image.metadata();

    let buffer = await image.raw().toBuffer();

    // 픽셀 데이터 처리
    for (let i = 0; i < buffer.length; i += metadata.channels) {
      const r = buffer[i];
      const g = buffer[i + 1];
      const b = buffer[i + 2];
      const a = metadata.channels === 4 ? buffer[i + 3] : 255;

      // 투명 픽셀은 그대로 두기
      if (a === 0) continue;

      // 파란색 검사 (#00AEEF 근처인지 확인)
      const isBlue = Math.abs(r - brandBlue.r) < blueThreshold &&
                     Math.abs(g - brandBlue.g) < blueThreshold &&
                     Math.abs(b - brandBlue.b) < blueThreshold;

      if (isBlue) {
        // 파란색은 정확한 #00AEEF로 설정
        buffer[i] = brandBlue.r;
        buffer[i + 1] = brandBlue.g;
        buffer[i + 2] = brandBlue.b;
      } else {
        // 검은색/어두운 색은 흰색으로 변환
        const brightness = (r + g + b) / 3;
        if (brightness < 150) {
          buffer[i] = 255;     // R
          buffer[i + 1] = 255; // G
          buffer[i + 2] = 255; // B
        }
        // 밝은 색(배경)은 그대로 두기
      }
    }

    // 변환된 이미지 저장
    await sharp(buffer, {
      raw: {
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels
      }
    })
    .png()
    .toFile(outputPath);

    console.log(`✓ 다크모드용 로고 생성 완료: ${outputPath}`);
  } catch (err) {
    console.error('로고 변환 실패:', err);
    process.exit(1);
  }
}

convertLogo();
