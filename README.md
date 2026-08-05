# 제주소금(JejuSalt) — AI 브랜드 콘텐츠·마케팅 자동화 플랫폼

## 📋 프로젝트 개요

제주소금 제품을 다양한 타겟 고객층에 맞게 자동으로 분석하고, AI가 추천한 캐릭터와 120초 숏폼 시나리오를 기반으로 **영상까지 완성**하는 플랫폼입니다.

### 주요 기술 스택
- **프론트엔드**: React 18, Tailwind CSS
- **백엔드**: Node.js/Express
- **데이터베이스**: Supabase (PostgreSQL)
- **AI 에이전트**: TimelyAI (8개 Skill/Agent)
- **영상 생성**: Higgsfield CLI (로컬 실행)

---

## 🚀 새 컴퓨터에서 처음 셋업하기

### 전제 조건

다음이 설치되어 있어야 합니다:
- **Node.js 18+** (https://nodejs.org)
- **Git** (https://git-scm.com)
- **npm** (Node.js와 함께 자동 설치됨)

### Step 1: 저장소 클론

```bash
git clone https://github.com/20Mia02/jejusalt-brand-harness.git
cd jejusalt-brand-harness
```

### Step 2: 환경 변수 설정 (.env 파일)

프로젝트 루트에 `.env` 파일을 생성하세요:

```bash
# Supabase 설정
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# TimelyAI API (백엔드)
TIMELY_AI_BASE_URL=https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai
TIMELY_AI_API_KEY=tgpt_sk_your_api_key_here

# 서버 설정
NODE_ENV=development
PORT=5000
HOST=localhost

# 프론트엔드 설정
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# 로깅
DEBUG=false
LOG_LEVEL=info
```

### Step 3: 의존성 설치

```bash
npm install
```

### Step 4: Supabase 스키마 초기화

```bash
# Supabase 대시보드 → SQL Editor → 파일 열기 → docs/schema.sql 전체 복사 후 실행
# → 7개 테이블 자동 생성됨
```

### Step 5: 서버 시작

```bash
npm start
# 또는 (개발 모드)
npm run dev
```

브라우저: `http://localhost:5000`

---

## 🔧 필수 연동 설정 가이드

### 1️⃣ Higgsfield CLI (영상 생성)

**역할**: 120초 시나리오를 바탕으로 실제 영상 생성

#### Windows 설정

```powershell
# 1. CLI 설치
npm i -g @higgsfield/cli

# 2. ExecutionPolicy 변경 (처음 1회만)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# → Y 입력

# 3. 로그인 (24시간마다 필요)
higgsfield auth login
# → 브라우저에서 Higgsfield 계정으로 로그인

# 4. Workspace 설정 (처음 1회만)
higgsfield workspace list
# → ID 확인
higgsfield workspace set <workspace_id>

# 5. 확인
higgsfield account status
# → "xxx@email.com — plus plan, XXXX credits" 표시되면 성공
```

#### Mac 설정

```bash
# 1. CLI 설치
npm i -g @higgsfield/cli

# 2. 로그인 (24시간마다 필요)
higgsfield auth login
# → 브라우저에서 Higgsfield 계정으로 로그인

# 3. Workspace 설정 (처음 1회만)
higgsfield workspace list
higgsfield workspace set <workspace_id>

# 4. 확인
higgsfield account status
```

#### ⚠️ 주의사항

- **토큰 만료**: 24시간마다 `higgsfield auth login` 재실행 필요
- **발표 당일**: 아침에 미리 로그인해두세요
- **백엔드 실행**: Higgsfield CLI가 설치된 PC에서만 `npm start` 실행

### 2️⃣ Supabase (데이터베이스)

**역할**: 제품 정보, 캐릭터, 시나리오, 영상 메타데이터 저장

#### 설정 방법

```bash
# 1. Supabase 계정 생성
# https://supabase.com → Sign Up

# 2. 새 프로젝트 생성
# Organization → New Project

# 3. 프로젝트 설정
# Settings → API → 다음 정보 .env에 저장:
#   - Project URL → SUPABASE_URL
#   - anon key → SUPABASE_ANON_KEY
#   - service_role key → SUPABASE_SERVICE_KEY

# 4. 스키마 초기화
# SQL Editor → 파일 열기 → docs/schema.sql 전체 복사 후 실행
# → 7개 테이블 자동 생성됨
```

#### 테이블 구조

```
- resources (제품 정보)
- characters (캐릭터)
- scenarios (120초 시나리오)
- contents (생성된 카피)
- naming (제품명/콘텐츠명 옵션)
- videos (완성된 영상)
- generation_logs (생성 이력)
```

### 3️⃣ TimelyAI API (AI 에이전트)

**역할**: 캐릭터 설계, 시나리오 작성, 카피 생성, 컴플라이언스 검증

#### 설정 방법

```bash
# 1. TimelyAI 계정 가입
# https://timelygpt.co.kr

# 2. API 키 발급
# 계정 설정 → API Keys → New Key 생성

# 3. .env에 저장
TIMELY_AI_API_KEY=tgpt_sk_your_key_here
TIMELY_AI_BASE_URL=https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai
```

#### 에이전트 목록 (백엔드에서 자동 호출)

```
1. character-designer-agent (캐릭터 상세 설계)
2. shortform-scenario-writer-agent (120초 시나리오)
3. naming-generator-agent (제품명/콘텐츠명 생성)
4. product-intro-writer-agent (제품 소개 카피)
5. product-detail-page-writer-agent (상세페이지 카피)
6. compliance-reviewer-agent (컴플라이언스 검증)
```

### 4️⃣ Claude MCP (선택사항 - 개발/테스트용)

**역할**: Claude Code에서 Higgsfield 직접 연동 (빠른 테스트)

#### 설정 방법

```
Claude Code 설정에서:
1. Settings → MCP servers → Add MCP server
2. Name: Higgsfield
3. Remote MCP server URL: https://mcp.higgsfield.ai/mcp
4. HTTP header 추가:
   - Authorization: Bearer <API_KEY>
```

#### 사용 예

```
Claude Code 대화창에서:
"Generate a 5-second video of woman holding Jeju Salt"
→ MCP를 통해 직접 Higgsfield 호출
```

### 5️⃣ GitHub (버전 관리)

**역할**: 코드 저장소, 협업

#### 설정 방법

```bash
# 1. GitHub 저장소 클론 (Step 1에서 이미 함)
git clone https://github.com/20Mia02/jejusalt-brand-harness.git

# 2. 커밋 설정
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# 3. 변경사항 커밋
git add .
git commit -m "message"
git push origin main
```

---

## 🧪 테스트 및 실행

### 백엔드 API 테스트

```bash
# 1. 서버 시작
npm start

# 2. 전체 파이프라인 테스트 (Step 1~9)
curl -X POST http://localhost:5000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"resourceId":"test-id","requestType":"intro"}'
```

### CLI로 직접 영상 생성 테스트

```bash
# Higgsfield가 설치된 PC에서:
higgsfield generate create seedance1_5 \
  --prompt "Woman smiling with Jeju Salt product" \
  --duration 8 \
  --resolution 720p \
  --wait
```

---

## 📋 발표 준비 체크리스트

```
✅ Step 1: Higgsfield CLI 설정 (발표 당일 아침 로그인)
✅ Step 2: Supabase 스키마 초기화
✅ Step 3: TimelyAI API 키 설정
✅ Step 4: 모든 환경변수 (.env) 확인
✅ Step 5: npm install 및 npm start 실행
✅ Step 6: API 엔드포인트 테스트
✅ Step 7: 실제 영상 1~2개 미리 생성 (발표용)
```

---

## ⚠️ 주의사항

### 크레딧 관리

- Higgsfield 계정 크레딧: 약 1,210개 (현재)
- 5초 영상 생성 = 약 2.5 크레딧 소비
- 10초 영상 생성 = 약 5 크레딧 소비

**크레딧 확인**:
```bash
higgsfield account status
```

### 토큰 만료

- **Higgsfield**: 24시간마다 만료
- **TimelyAI**: 구독 기간 내 유효
- **Supabase**: 세션 기간 내 유효

### 발표 시나리오

```
발표 당일 오전:
1. higgsfield auth login (토큰 갱신)
2. npm start (서버 시작)
3. 사전 생성한 영상 URL로 데모

발표 중:
- 웹 인터페이스로 실시간 시연 (또는 사전 녹화)
```

---

## 📞 문제 해결

### Higgsfield CLI 에러

**에러**: `Error: No workspace selected`
```bash
higgsfield workspace set <workspace_id>
```

**에러**: `Error: Invalid values: duration=5`
```bash
# Higgsfield는 4, 8, 12초만 지원
higgsfield generate create seedance1_5 --duration 8 --prompt "..." --wait
```

### TimelyAI API 에러

**에러**: `401 Unauthorized`
- TIMELY_AI_API_KEY 확인
- API 키 만료 여부 확인

### Supabase 에러

**에러**: `Connection refused`
- SUPABASE_URL, SUPABASE_ANON_KEY 확인
- 인터넷 연결 확인

---

## 📚 추가 문서

- `docs/api-integration-plan-v4.md` - API 통합 설계
- `docs/data-schema-v4.md` - 데이터베이스 스키마
- `agents/` - AI 에이전트 정의
- `backend/` - 백엔드 코드

---

**마지막 업데이트**: 2026-08-04
