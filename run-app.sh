#!/usr/bin/env bash
# 제주소금 웹앱 통합 실행 스크립트
# 사용법: ./run-app.sh
# 실행 후 출력되는 로컬 URL로 접속

set -e

# ------------------------------------------------------------------
# 0. 환경 설정 (nvm, node)
# ------------------------------------------------------------------
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null; then
  echo "❌ node가 발견되지 않았습니다. nvm install --lts를 먼저 실행하세요."
  exit 1
fi

echo "🟢 Node: $(node --version) | npm: $(npm --version)"

# ------------------------------------------------------------------
# 1. 프로젝트 루트에서 실행 중인지 확인
# ------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ------------------------------------------------------------------
# 2. 백엔드 의존성 설치 및 실행
# ------------------------------------------------------------------
BACKEND_DIR="$SCRIPT_DIR/implementation/backend"

if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "📦 백엔드 의존성 설치 중..."
  (cd "$BACKEND_DIR" && npm install)
fi

echo "🚀 백엔드 서버 시작 (http://localhost:5000)..."
cd "$BACKEND_DIR"
# 환경변수 .env 로딩 (dotenv 패키지가 server.js에서 처리)
node server.js &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# ------------------------------------------------------------------
# 3. 프론트엔드 의존성 설치 및 실행
# ------------------------------------------------------------------
FRONTEND_DIR="$SCRIPT_DIR/implementation/frontend"

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "📦 프론트엔드 의존성 설치 중..."
  (cd "$FRONTEND_DIR" && npm install)
fi

echo "🌐 프론트엔드 개발 서버 시작 (Vite)..."
cd "$FRONTEND_DIR"

# VITE_API_URL이 설정되어 있지 않으면 백엔드 URL로 자동 설정
export VITE_API_URL="${VITE_API_URL:-http://localhost:5000}"

npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# ------------------------------------------------------------------
# 4. 서버 준비 완료까지 대기
# ------------------------------------------------------------------
echo ""
echo "⏳ 서버 준비 중... (최대 15초)"
 for i in $(seq 1 15); do
  if curl -s http://localhost:5000/health >/dev/null 2>&1; then
    echo "✅ 백엔드 준비 완료"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "⚠️  백엔드 준비에 15초 이상 소요됨 (계속 대기)"
  fi
  sleep 1
done

# ------------------------------------------------------------------
# 5. 접속 URL 안내
# ------------------------------------------------------------------
 프론트엔드_URL="http://localhost:5173"
 백엔드_URL="http://localhost:5000"

echo ""
echo "═══════════════════════════════════════════"
echo "✅ 제주소금 웹앱 실행 중!"
echo "═══════════════════════════════════════════"
echo ""
echo "  🌐 웹앱 (Frontend): $FRONTEND_URL"
echo "  🔧 API (Backend):   $BACKEND_URL"
echo "  🏥 헬스체크:         $BACKEND_URL/health"
echo ""
echo "  브라우저에서 '$FRONTEND_URL'로 접속하세요."
echo ""
echo "  정지: kill $BACKEND_PID $FRONTEND_PID"
echo "═══════════════════════════════════════════"
echo ""

# 프로세스 종료 대기 (스크립트가 바로 안 끝나게)
wait
