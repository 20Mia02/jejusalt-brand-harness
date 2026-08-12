# 제주소금(JejuSalt) — Harness Engineering 기반 AI 콘텐츠 자동화 🧂✨

## 📋 프로젝트 개요

**Harness Engineering 구조**로 설계된 제주소금 AI 콘텐츠 생성 시스템입니다.
- 📋 **spec**: 프로젝트 정의 & 원칙 (불변)
- 🔧 **skills**: 단일 책임 함수 (3개)
- 🤖 **agents**: Skill 실행자 (4개)
- 🎼 **orchestrator**: 9단계 파이프라인
- ⚙️ **config**: 검증 규칙 & 설정

**구현**은 `implementation/` 폴더에서 Node.js 백엔드 + React 프론트엔드로 진행됩니다.

### 주요 기술 스택
- **프론트엔드**: React 18, Tailwind CSS
- **백엔드**: Node.js/Express
- **데이터베이스**: Supabase (PostgreSQL)
- **AI 모델**: TimelyAI (solar-pro-4)
- **영상 생성**: Higgsfield CLI (로컬 인증, 매일 갱신)

---

## 📥 다운로드 & 폴더 설정 (매우 중요!)

### GitHub에서 ZIP 다운로드

```bash
# GitHub에서 "Code" → "Download ZIP"
# → jejusalt-brand-harness-main.zip 다운로드

# 압축 해제
unzip jejusalt-brand-harness-main.zip

# 폴더명 변경 (매우 중요!)
mv jejusalt-brand-harness-main harness

# 이제 harness 폴더 열면:
cd harness
ls
# harness/          (← Harness 정의)
# implementation/   (← 코드)
# docs/             (← 문서)
# supabase/         (← DB)
# legacy/           (← 이전 구조)
# README.md         (← 이 파일)
```

---

## 🚀 새 컴퓨터에서 처음 셋업하기

### 전제 조건

다음이 설치되어 있어야 합니다:
- **Node.js 18+** (https://nodejs.org)
- **Git** (https://git-scm.com)
- **npm** (Node.js와 함께 자동 설치됨)

### Step 1: 환경 변수 설정 (.env 파일)

`implementation/backend/` 폴더에 `.env` 파일을 생성하세요:

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

# TimelyAI 모델 (이미 설정됨)
TIMELY_AI_MODEL=solar-pro-4

# 로깅
DEBUG=false
LOG_LEVEL=info
```

**⚠️ 주의**: `.env` 파일은 git에서 제외됩니다 (보안).

### Step 2: Higgsfield 로컬 인증 (매일 필요)

```bash
# 설치 (처음 1회만)
npm install -g @higgsfield/cli

# 로그인 (매일 필요)
higgsfield auth login
# → 브라우저에서 계정 로그인
```

### Step 3: 의존성 설치

```bash
# 백엔드
cd implementation/backend
npm install

# 프론트엔드 (다른 터미널)
cd implementation/frontend
npm install
```

### Step 4: Supabase 스키마 초기화

#### 4-1. 기본 테이블 생성
```bash
# Supabase 대시보드 → SQL Editor에서 supabase/migrations/ 의 SQL 실행
# → 7개 테이블 자동 생성됨
```

### Step 5: 서버 & 프론트엔드 시작

```bash
# 터미널 1: 백엔드
cd implementation/backend
npm start

# 터미널 2: 프론트엔드
cd implementation/frontend
npm start
```

**접속**:
- 백엔드: `http://localhost:5000`
- 프론트엔드: `http://localhost:3000`

---

## 📁 폴더 구조 이해하기

```
harness/                          ← 다운받은 폴더
│
├── 📋 harness/                   (Harness 정의 - 읽으세요!)
│   ├── spec/
│   │   ├── spec.md              (전체 구조)
│   │   ├── brand-voice.md       (브랜드 원칙)
│   │   └── PRD.md
│   ├── skills/                  (3개 Skill 정의)
│   ├── agents/                  (4개 Agent 정의)
│   │   └── QA-AGENT.md          (Step 9 검증 기준)
│   ├── orchestrator/            (9단계 파이프라인)
│   └── config/                  (검증 규칙)
│       └── compliance-rules-v2.json (식품/뷰티/헬스)
│
├── 🚀 implementation/            (실제 코드)
│   ├── backend/
│   │   ├── server.js
│   │   ├── agents/              (에이전트 구현)
│   │   ├── routes/              (API 엔드포인트)
│   │   ├── config/
│   │   └── .env                 (환경변수 - 직접 작성)
│   ├── frontend/
│   │   ├── src/
│   │   └── public/
│   └── data/                    (자산)
│
├── 📚 docs/                     (문서)
├── 🗄️ supabase/                (DB 설정)
├── 🚫 legacy/                   (이전 구조 - 참고용)
└── PROJECT_STRUCTURE.md         (전체 구조 설명)
```

---

## 🎯 9단계 파이프라인

```
Step 1: 자료 분석
Step 2: 캐릭터 선택        [마케터 검토]
Step 3: 캐릭터 설계        [마케터 선택]
Step 4: 시나리오 작성      [마케터 검토]
Step 5: 영상 제목 생성     [마케터 선택]
Step 6: 카피 작성         [마케터 검토]
Step 7: 컴플라이언스 검토  (자동)
Step 8: 영상 생성         (Higgsfield CLI)
Step 9: 품질 검사 ⭐       (카테고리별 상세 검증)
        ↓
        ✅ 완료
```

---

## 🚀 주요 개선사항 (2026-08-13)

### A. Harness Engineering 구조화 ⭐
- 프로젝트 전체를 Harness 표준으로 정렬
- `harness/`: 정의 & 원칙 (불변)
- `implementation/`: 구현 코드 (변경)
- 파일 경로 재구성 및 문서화

### B. Step 9 품질 검사 v2.0 (카테고리별 검증) ⭐
- **식품** (14개 검증 항목)
  - Critical: 의약품 표현, 거짓 원산지, 부정확한 영양소
  - 경고: 할인율, 비교 표현, 제조 과정 투명성
- **뷰티** (13개 검증 항목)
  - Critical: 의약품 용어, 천연 인증, 성분 안전성
  - 경고: 부작용 미공시, 필터 미공시, 임상 근거 부족
- **헬스/영양제** (15개 검증 항목)
  - Critical: 의약품 효능, 기능식품 인증, 성분 정확성
  - 경고: 부작용 미공시, 의료 상담 부재, GMP 인증 부재

### C. TimelyAI 모델 업그레이드
- solar-pro-4 모델로 설정 완료
- 더 나은 응답 품질과 안정성

### D. 개발자 경험 개선
- PROJECT_STRUCTURE.md 작성 (전체 구조 설명)
- README.md 개선 (이 파일)
- QA-AGENT.md 작성 (마케터용 체크리스트)

---

## 🔧 필수 연동 설정 가이드

### 1️⃣ Higgsfield CLI (영상 생성) ⭐

**역할**: 시나리오를 바탕으로 실제 영상 생성 (Step 8)

#### 설치 (처음 1회)

```bash
npm install -g @higgsfield/cli
```

#### 로컬 인증 (매일 필요)

```bash
# 로그인 (아침에 1회)
higgsfield auth login
# → 브라우저에서 계정으로 로그인

# Workspace 설정 (처음 1회만)
higgsfield workspace list
higgsfield workspace set <workspace_id>

# 확인
higgsfield account status
```

#### ⚠️ 주의사항

- **매일 필요**: 24시간마다 `higgsfield auth login` 재실행
- **발표 당일**: 아침에 미리 로그인하세요
- **API KEY 불필요**: 로컬 CLI 인증 방식입니다

### 2️⃣ Supabase (데이터베이스) ⭐

**역할**: 제품 정보, 캐릭터, 시나리오, 메타데이터 저장

```bash
# 1. https://supabase.com → 계정 가입

# 2. 새 프로젝트 생성 후, Settings → API에서:
#    - Project URL → SUPABASE_URL
#    - anon key → SUPABASE_ANON_KEY
#    - service_role key → SUPABASE_SERVICE_KEY

# 3. SQL Editor에서 supabase/migrations/ SQL 실행
#    → 7개 테이블 생성됨
```

### 3️⃣ TimelyAI API (AI 모델) ⭐

**역할**: 캐릭터 설계, 시나리오, 카피 생성 (Step 3, 4, 5, 6)

```bash
# 1. https://timelygpt.co.kr → 계정 가입

# 2. API 키 발급 후 .env에 저장:
TIMELY_AI_API_KEY=tgpt_sk_your_key_here
TIMELY_AI_BASE_URL=https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai
TIMELY_AI_MODEL=solar-pro-4  (이미 설정됨)
```

---

## 🧪 테스트 및 실행

### 서비스 상태 확인

```bash
# 헬스 체크
curl http://localhost:5000/health

# 응답:
# {
#   "status": "ok",
#   "env": {
#     "supabase": true,
#     "higgsfield": "CLI 로컬 인증 사용",
#     "timelyai": true
#   }
# }
```

### 전체 파이프라인 테스트 (Step 1~9)

```bash
# 프론트엔드에서 form 제출, 또는:
curl -X POST http://localhost:5000/api/generate/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "resourceName": "제주 바다의 미네랄",
    "category": "food",
    "highlights": ["미네랄 풍부"]
  }'
```

---

## 🧠 Harness 구조 이해하기

### 5분 입문

1. **spec.md 읽기** (프로젝트 정의)
   ```bash
   cat harness/spec/spec.md
   ```

2. **brand-voice.md 읽기** (브랜드 원칙)
   ```bash
   cat harness/spec/brand-voice.md
   ```

3. **orchestrator.md 읽기** (9단계 파이프라인)
   ```bash
   cat harness/orchestrator/orchestrator.md
   ```

4. **QA-AGENT.md 읽기** (Step 9 검증)
   ```bash
   cat harness/agents/QA-AGENT.md
   ```

---

## 📋 준비 체크리스트

```
✅ 폴더명 변경 (jejusalt-brand-harness-main → harness)
✅ harness/ 폴더 구조 확인
✅ .env 파일 생성 & 설정 (Supabase, TimelyAI API 키)
✅ higgsfield auth login 실행 (매일 필요)
✅ npm install (backend, frontend)
✅ npm start (backend, frontend)
✅ http://localhost:5000/health 테스트
✅ 문서 읽기 (harness/spec/, harness/agents/)
```

---

## 📚 추가 가이드

| 문서 | 내용 | 읽기 시간 |
|------|------|---------|
| `PROJECT_STRUCTURE.md` | 전체 구조 설명 | 20분 |
| `harness/spec/spec.md` | 기술 스펙 | 15분 |
| `harness/spec/brand-voice.md` | 브랜드 원칙 | 10분 |
| `harness/orchestrator/orchestrator.md` | 파이프라인 | 10분 |
| `harness/agents/QA-AGENT.md` | 품질 검사 | 20분 |

---

## 🐛 문제 해결

### "higgsfield: command not found"
→ `npm install -g @higgsfield/cli` 후 재시도

### "TIMELY_AI_API_KEY is required"
→ `.env` 파일의 TIMELY_AI_API_KEY 값 확인

### "Supabase 연결 실패"
→ `.env`의 SUPABASE_URL, SUPABASE_SERVICE_KEY 확인

### "backend/npm start 실패"
→ `npm install` 재실행, Node 버전 확인 (16+)

### "Step 7 컴플라이언스 검사 실패"
→ harness/config/compliance-rules-v2.json 로드 확인
→ 서버 재시작

---

## 👥 팀 연락처

- **박주미** (아키텍처): Harness 구조, 전체 방향
- **고수아** (마케팅): Step 3~6 검토, Step 9 수동 검증
- **개발팀**: implementation/ 코드 유지보수

---

## 📞 더 필요한 도움?

문제가 있으면 **자동으로 해결합니다!**

자동 문제 해결 기능:
- 스크립트 실행 실패 → 자동 진단 & 수정
- API 연동 문제 → 자동 디버깅
- 설정 오류 → 자동 검사 & 수정

---

**마지막 업데이트**: 2026-08-13 (Harness v2.0, Step 9 QA v2.0)  
**상태**: ✅ 프로덕션 준비 완료
