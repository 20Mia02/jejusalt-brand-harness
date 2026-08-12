import { useEffect, useRef } from 'react';

export default function OceanBackground({ theme }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);

  // 라이트/다크 모드 감지
  const isDarkMode = theme === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 색상 팔레트 (라이트모드 기본값, 다크모드에서는 별도로 정의)
    const colors = !isDarkMode ? {
      // 라이트모드: 낮 바다
      sky1: '#e8f1f5',
      sky2: '#d4e6f0',
      sky3: '#c8dde8',
      sky4: '#b8d4e0',
      sun: '#ffc84d',
      sunGlow: '#ffd89b',
      mountain1: '#5a8fa8',
      mountain2: '#4a8fa0',
      mountain3: '#3a7f98',
      mountain4: '#2a6f90',
      mountainDark: '#1a5f88',
      mountainHighlight: '#6aa0b8',
      oceanDeep: '#2aa8d0',
      oceanMid: '#4ab8d8',
      oceanBright: '#56c0e0',
      oceanLight: '#76d0f0',
      wave: '#88d8f8',
      shimmerBright: '#ffffff',
      shimmerLight: '#e0f4ff'
    } : {
      // 다크모드: 밤 바다
      sky1: '#0d1419',
      sky2: '#172338',
      sky3: '#1f3a52',
      sky4: '#27527a',
      moon: '#f0e9d8',
      moonGlow: '#e0dcc8',
      mountain1: '#2a4a5a',
      mountain2: '#1f3a52',
      mountain3: '#1a3a4a',
      mountain4: '#0f2a3a',
      mountainDark: '#0a1f30',
      mountainHighlight: '#3a5a7a',
      oceanDeep: '#0f2a3a',
      oceanMid: '#1a3a4a',
      oceanBright: '#2a4a5a',
      oceanLight: '#3a5a6a',
      wave: '#4a6a7a',
      shimmerBright: '#e8f4ff',
      shimmerLight: '#c8e0f0'
    };

    const drawHallasan = (time) => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerX = width / 2;
      const mountainTop = height * 0.55;
      const mountainBase = height * 0.68;
      const mountainWidth = 700;  // 산의 폭을 매우 넓게

      // 먼 산들 (안개 효과)
      ctx.fillStyle = colors.mountain4;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(50, mountainBase + 80);
      ctx.bezierCurveTo(180, mountainTop + 180, 350, mountainTop + 170, 500, mountainBase + 80);
      ctx.lineTo(50, height);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width - 500, mountainBase + 90);
      ctx.bezierCurveTo(width - 350, mountainTop + 190, width - 180, mountainTop + 180, width - 50, mountainBase + 90);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // 중간 산들
      ctx.fillStyle = colors.mountain3;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(120, mountainBase + 30);
      ctx.bezierCurveTo(300, mountainTop + 100, 500, mountainTop + 110, 700, mountainBase + 30);
      ctx.lineTo(120, height);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width - 700, mountainBase + 40);
      ctx.bezierCurveTo(width - 500, mountainTop + 95, width - 300, mountainTop + 115, width - 120, mountainBase + 40);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // 양옆 작은 산들 (높이 다름) - 더 크게
      ctx.fillStyle = colors.mountain2;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(80, mountainBase + 20);
      ctx.bezierCurveTo(200, mountainTop - 40, 400, mountainTop - 35, 580, mountainBase + 20);
      ctx.lineTo(80, height);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width - 580, mountainBase + 25);
      ctx.bezierCurveTo(width - 400, mountainTop - 30, width - 200, mountainTop - 45, width - 80, mountainBase + 25);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // 한라산 그림자 (왼쪽)
      ctx.fillStyle = colors.mountainDark;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(centerX - mountainWidth / 2.2, mountainBase);
      ctx.bezierCurveTo(centerX - mountainWidth / 2.5, mountainTop + 80, centerX - mountainWidth / 6, mountainTop - 20, centerX - 30, mountainTop - 70);
      ctx.bezierCurveTo(centerX, mountainTop - 85, centerX + 15, mountainTop - 80, centerX + 50, mountainTop - 50);
      ctx.bezierCurveTo(centerX + mountainWidth / 6, mountainTop + 20, centerX + mountainWidth / 2.5, mountainBase - 30, centerX + mountainWidth / 2.2, mountainBase);
      ctx.lineTo(centerX, height);
      ctx.closePath();
      ctx.fill();

      // 한라산 주 봉우리 (어두운 톤)
      ctx.fillStyle = colors.mountain2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(centerX - mountainWidth / 2.1, mountainBase);
      ctx.bezierCurveTo(centerX - mountainWidth / 2.3, mountainTop + 70, centerX - mountainWidth / 7, mountainTop - 15, centerX - 25, mountainTop - 65);
      ctx.bezierCurveTo(centerX, mountainTop - 80, centerX + 12, mountainTop - 75, centerX + 45, mountainTop - 45);
      ctx.bezierCurveTo(centerX + mountainWidth / 7, mountainTop + 15, centerX + mountainWidth / 2.3, mountainBase - 25, centerX + mountainWidth / 2.1, mountainBase);
      ctx.lineTo(centerX, height);
      ctx.closePath();
      ctx.fill();

      // 한라산 중간 톤
      ctx.fillStyle = colors.mountain1;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(centerX - mountainWidth / 2, mountainBase);
      ctx.bezierCurveTo(centerX - mountainWidth / 2.2, mountainTop + 60, centerX - mountainWidth / 8, mountainTop - 10, centerX, mountainTop - 75);
      ctx.bezierCurveTo(centerX + mountainWidth / 8, mountainTop - 10, centerX + mountainWidth / 2.2, mountainTop + 60, centerX + mountainWidth / 2, mountainBase);
      ctx.lineTo(centerX, height);
      ctx.closePath();
      ctx.fill();

      // 한라산 최고 정상부 (하이라이트) - 매우 둥근 형태
      ctx.fillStyle = colors.mountainHighlight;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(centerX - 60, mountainTop - 20);
      ctx.bezierCurveTo(centerX - 65, mountainTop - 40, centerX - 40, mountainTop - 60, centerX - 10, mountainTop - 65);
      ctx.bezierCurveTo(centerX, mountainTop - 68, centerX + 10, mountainTop - 65, centerX + 40, mountainTop - 60);
      ctx.bezierCurveTo(centerX + 65, mountainTop - 40, centerX + 60, mountainTop - 20, centerX + 70, mountainTop + 5);
      ctx.bezierCurveTo(centerX + 75, mountainTop + 25, centerX + 50, mountainTop + 40, centerX, mountainTop + 42);
      ctx.bezierCurveTo(centerX - 50, mountainTop + 40, centerX - 75, mountainTop + 25, centerX - 70, mountainTop + 5);
      ctx.bezierCurveTo(centerX - 60, mountainTop - 20, centerX - 60, mountainTop - 20, centerX - 60, mountainTop - 20);
      ctx.closePath();
      ctx.fill();

      // 산의 능선 텍스처
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.2;
      for (let i = -6; i <= 6; i++) {
        const x1 = centerX + i * 25;
        const y1 = mountainBase - 40;
        const x2 = centerX + i * 15;
        const y2 = mountainTop - 50;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(centerX + i * 20, mountainBase - 50, x2, y2);
        ctx.stroke();
      }

      // 산의 안개 레이어
      const gradient = ctx.createLinearGradient(0, mountainTop - 40, 0, mountainBase);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(centerX - 280, mountainTop);
      ctx.bezierCurveTo(centerX - 120, mountainTop - 90, centerX + 120, mountainTop - 90, centerX + 280, mountainTop);
      ctx.lineTo(centerX + 280, mountainBase + 80);
      ctx.bezierCurveTo(centerX + 120, mountainBase + 50, centerX - 120, mountainBase + 50, centerX - 280, mountainBase + 80);
      ctx.closePath();
      ctx.fill();
    };

    const drawStars = (width, height) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      const starCount = 60;

      for (let i = 0; i < starCount; i++) {
        const seed = i * 73 + 37;
        const x = (seed * 137) % width;
        const y = ((seed * 211) % (height * 0.55));
        const size = ((seed * 17) % 3) / 2 + 0.5;
        const opacity = ((seed * 41) % 100) / 100 * 0.6 + 0.3;

        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    const drawClouds = (width, height) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.globalAlpha = 0.5;

      const clouds = [
        { x: width * 0.15, y: height * 0.2, scale: 1 },
        { x: width * 0.5, y: height * 0.15, scale: 1.2 },
        { x: width * 0.8, y: height * 0.25, scale: 1.1 },
        { x: width * 0.3, y: height * 0.4, scale: 0.9 },
        { x: width * 0.75, y: height * 0.35, scale: 0.95 },
      ];

      clouds.forEach(cloud => {
        ctx.save();
        ctx.translate(cloud.x, cloud.y);
        ctx.scale(cloud.scale, cloud.scale);

        // 베지어 곡선으로 현실적인 구름 그리기
        ctx.beginPath();
        ctx.moveTo(-70, 0);
        ctx.quadraticCurveTo(-70, -25, -55, -35);
        ctx.quadraticCurveTo(-35, -45, -10, -48);
        ctx.quadraticCurveTo(15, -50, 35, -42);
        ctx.quadraticCurveTo(60, -35, 70, -15);
        ctx.quadraticCurveTo(75, 5, 70, 15);
        ctx.quadraticCurveTo(50, 28, 20, 32);
        ctx.quadraticCurveTo(-20, 35, -50, 28);
        ctx.quadraticCurveTo(-75, 20, -80, 5);
        ctx.quadraticCurveTo(-78, -8, -70, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      });

      ctx.globalAlpha = 1;
    };

    const drawSky = () => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // 하늘 그라데이션
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.65);
      skyGrad.addColorStop(0, colors.sky1);
      skyGrad.addColorStop(0.3, colors.sky2);
      skyGrad.addColorStop(0.7, colors.sky3);
      skyGrad.addColorStop(1, colors.sky4);

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height * 0.65);

      if (!isDarkMode) {
        // 라이트모드: 구름 추가
        drawClouds(width, height);

        // 태양 (오른쪽에 위치)
        const sunX = width * 0.70;
        const sunY = height * 0.35;

        // 태양 빛 번짐
        const sunGlowGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 150);
        sunGlowGrad.addColorStop(0, 'rgba(255, 216, 155, 0.4)');
        sunGlowGrad.addColorStop(0.5, 'rgba(255, 200, 77, 0.2)');
        sunGlowGrad.addColorStop(1, 'rgba(255, 200, 77, 0)');

        ctx.fillStyle = sunGlowGrad;
        ctx.fillRect(sunX - 150, sunY - 150, 300, 300);

        // 태양
        ctx.fillStyle = colors.sun;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 85, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
      } else {
        // 다크모드: 별 추가
        drawStars(width, height);

        // 달 (왼쪽에 위치)
        const moonX = width * 0.28;
        const moonY = height * 0.35;

        // 달 빛 번짐 (태양처럼 크고 밝게)
        const moonGlowGrad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 150);
        moonGlowGrad.addColorStop(0, 'rgba(240, 233, 216, 0.35)');
        moonGlowGrad.addColorStop(0.4, 'rgba(240, 233, 216, 0.15)');
        moonGlowGrad.addColorStop(1, 'rgba(240, 233, 216, 0)');

        ctx.fillStyle = moonGlowGrad;
        ctx.fillRect(moonX - 150, moonY - 150, 300, 300);

        // 달
        ctx.fillStyle = colors.moon;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 80, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
      }
    };

    const drawWaves = (time) => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const seaStart = height * 0.63;
      const seaHeight = height - seaStart;

      // 해양 그라데이션 배경
      const oceanGrad = ctx.createLinearGradient(0, seaStart, 0, height);
      oceanGrad.addColorStop(0, colors.oceanLight);
      oceanGrad.addColorStop(0.2, colors.oceanBright);
      oceanGrad.addColorStop(0.5, colors.oceanMid);
      oceanGrad.addColorStop(1, colors.oceanDeep);

      ctx.fillStyle = oceanGrad;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, seaStart, width, seaHeight);

      // 지평선 - 자연스럽고 부드러운 곡선
      const horizonY = seaStart;
      const sunX = width * 0.35;

      // 지평선 선
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      for (let x = 0; x <= width; x += 2) {
        const normalizedX = x / width;
        const wave1 = Math.sin(normalizedX * Math.PI * 4) * 5;
        const wave2 = Math.sin(normalizedX * Math.PI * 2.5) * 3;
        const wave3 = Math.sin(normalizedX * Math.PI * 1.8) * 1.5;
        const baseOffset = wave1 + wave2 + wave3;
        ctx.lineTo(x, horizonY - baseOffset);
      }
      ctx.stroke();

      // 앞뒤 방향의 파도 (깊이감)
      const waveConfigs = [
        { amplitude: 10, wavelength: 200, speed: 0.35, opacity: 0.2, y: seaStart + 20, depth: 0.9 },
        { amplitude: 15, wavelength: 280, speed: 0.3, opacity: 0.3, y: seaStart + 60, depth: 0.7 },
        { amplitude: 20, wavelength: 350, speed: 0.25, opacity: 0.4, y: seaStart + 120, depth: 0.5 },
        { amplitude: 28, wavelength: 450, speed: 0.2, opacity: 0.55, y: seaStart + 200, depth: 0.3 }
      ];

      waveConfigs.forEach((config, index) => {
        const waveY = config.y;

        // 파도의 어두운 그림자 (깊이감)
        ctx.fillStyle = `rgba(0, 0, 0, ${0.06 * config.depth})`;
        ctx.globalAlpha = config.opacity * 0.3 * (1 - config.depth);
        ctx.beginPath();
        ctx.moveTo(0, waveY + 4);

        for (let x = 0; x <= width; x += 8) {
          const normalizedX = (x + time * config.speed * 50) % config.wavelength;
          const waveOffset = Math.sin((normalizedX / config.wavelength) * Math.PI * 2) * config.amplitude;
          ctx.lineTo(x, waveY + 4 + waveOffset);
        }

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();

        // 파도 메인 선
        ctx.strokeStyle = colors.oceanBright;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = config.opacity * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, waveY);

        for (let x = 0; x <= width; x += 5) {
          const normalizedX = (x + time * config.speed * 50) % config.wavelength;
          const waveOffset = Math.sin((normalizedX / config.wavelength) * Math.PI * 2) * config.amplitude;
          ctx.lineTo(x, waveY + waveOffset);
        }

        ctx.stroke();
      });
    };

    const animate = () => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // 배경 리셋
      ctx.fillStyle = isDarkMode ? '#0a0f14' : '#ffffff';
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, width, height);

      // 그리기
      drawSky();
      drawHallasan(timeRef.current);
      drawWaves(timeRef.current);

      // 다크모드: 달빛이 바다에 비추는 효과
      if (isDarkMode) {
        const moonX = width * 0.28;
        const seaStart = height * 0.63;

        // 달빛 반사 - 세로 방향 그라데이션
        const moonlightGrad = ctx.createLinearGradient(0, seaStart, 0, height);
        moonlightGrad.addColorStop(0, 'rgba(240, 233, 216, 0)');
        moonlightGrad.addColorStop(0.15, 'rgba(240, 233, 216, 0.12)');
        moonlightGrad.addColorStop(0.5, 'rgba(240, 233, 216, 0.06)');
        moonlightGrad.addColorStop(1, 'rgba(240, 233, 216, 0)');

        // 달 아래 중심에서 양옆으로 퍼지는 달빛 반사 영역
        ctx.save();
        ctx.globalAlpha = 0.6;

        // 중심 밝은 영역
        const brightGrad = ctx.createRadialGradient(moonX, seaStart, 0, moonX, seaStart + 200, 250);
        brightGrad.addColorStop(0, 'rgba(240, 233, 216, 0.15)');
        brightGrad.addColorStop(0.5, 'rgba(240, 233, 216, 0.08)');
        brightGrad.addColorStop(1, 'rgba(240, 233, 216, 0)');

        ctx.fillStyle = brightGrad;
        ctx.fillRect(moonX - 250, seaStart, 500, height - seaStart);

        ctx.restore();
      }

      timeRef.current += 0.016; // 60fps 기준
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      className="ocean-background-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none'
      }}
    />
  );
}
