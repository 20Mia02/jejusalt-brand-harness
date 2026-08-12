# 제주소금 AI 콘텐츠 생성 시스템 - 프로젝트 구조

**최종 정렬 완료 (2026.08.13)**

---

## 📁 프로젝트 트리

```
jejusalt-brand-harness/
│
├── 🎯 harness/                    ⭐ Harness Engineering 구조 (헌법)
│   ├── spec/                      📋 스펙 & 원칙
│   │   ├── spec.md               - 기술 스펙 (Skill, Agent, Orchestrator)
│   │   ├── PRD.md                - 제품 요구사항
│   │   └── brand-voice.md        - 브랜드 톤앤보이스 (불변 원칙)
│   │
│   ├── skills/                    🔧 단일 책임 함수
│   │   ├── SKILL_character-designer.md
│   │   ├── SKILL_naming-generator.md
│   │   └── SKILL_shortform-scenario-writer.md
│   │
│   ├── agents/                    🤖 Skill 실행자
│   │   ├── AGENT_character-designer-agent.md
│   │   ├── AGENT_naming-generator-agent.md
│   │   ├── AGENT_shortform-scenario-writer-agent.md
│   │   ├── QA-AGENT.md            ⭐ Step 9 품질 검사
│   │   └── [기타 Agent 정의들]
│   │
│   ├── orchestrator/              🎼 9단계 파이프라인 관리자
│   │   └── orchestrator.md        - Step 1~9 전체 흐름
│   │
│   └── config/                    ⚙️ 모든 규칙 & 설정
│       ├── config.json            - 캐릭터, 템플릿
│       ├── compliance-rules-v2.json ⭐ 카테고리별 검증 기준 (식품/뷰티/헬스)
│       ├── agent-schemas.json     - 입출력 스키마
│       └── config-characters-v3.json
│
│
├── 🚀 implementation/             ⭐ 실제 구현 코드
│   ├── backend/                   🔧 Node.js 서버
│   │   ├── server.js             - Express 앱 진입점
│   │   ├── package.json
│   │   ├── .env                  - 환경변수 (보안)
│   │   ├── agents/               - 에이전트 구현체
│   │   │   ├── backend-agent.js  - TimelyAI 에이전트 호출
│   │   │   ├── database-agent.js - Supabase CRUD
│   │   │   ├── character-refinement-agent.js
│   │   │   └── qa-agent.js       ⭐ Step 9 검증 로직
│   │   ├── routes/               - API 엔드포인트
│   │   │   ├── generation.js     - POST /api/generate/pipeline
│   │   │   ├── characters.js     - GET /api/characters
│   │   │   ├── resources.js
│   │   │   └── admin.js
│   │   ├── config/               - 설정 로더
│   │   │   └── scenario-templates.json
│   │   ├── services/             - 비즈니스 로직
│   │   ├── utils/                - 헬퍼 함수
│   │   └── scripts/              - CLI 스크립트
│   │
│   ├── frontend/                 💻 React 앱
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── App.jsx
│   │   ├── public/
│   │   ├── package.json
│   │   └── .env                  - React 환경변수
│   │
│   └── data/                     📊 자산 & 데이터
│       ├── characters/           - 캐릭터 디자인 (이미지, 설명)
│       ├── scenarios/            - 생성된 시나리오 저장
│       ├── videos/               - 생성된 영상 메타데이터
│       └── logs/                 - 생성 과정 로그
│
│
├── 📚 docs/                      📖 프로젝트 문서
│   ├── guides/                   - 사용 가이드
│   │   ├── 시작하기.md
│   │   ├── API-가이드.md
│   │   └── troubleshooting.md
│   │
│   ├── character/                - 캐릭터 레퍼런스
│   │   ├── character-library.md
│   │   └── character-concept-sketches/
│   │
│   └── logs/                     - 생성 기록
│       ├── generation-logs/
│       └── qa-reports/
│
│
├── 🗄️ supabase/                 🐘 PostgreSQL DB 설정
│   ├── migrations/               - DB 마이그레이션 스크립트
│   └── README.md
│
│
├── 📦 legacy/                    🚫 정렬 제외 폴더 (참고용)
│   └── duplicates/               - 이전 구조 (아카이브)
│       ├── agents/
│       ├── skills/
│       ├── jejusalt-brand-harness/
│       └── [기타 중복 폴더들]
│
│
├── 🔧 설정 파일들
│   ├── .env                      - 환경변수 (git 제외)
│   ├── .env.example             - 환경변수 템플릿
│   ├── .gitignore
│   ├── package.json             - 루트 의존성 (optional)
│   └── .git/
│
│
└── 📄 문서들
    ├── README.md                - 프로젝트 개요
    ├── PROJECT_STRUCTURE.md     👈 이 파일
    └── DEVELOPMENT.md           - 개발 가이드
```

---

## 🎯 각 폴더의 역할

### 1. `harness/` ⭐ (헌법/구조)
- **목적**: Harness Engineering의 설계 문서
- **관리자**: 제주소금 팀 (박주미, 고수아)
- **변경 주기**: 사업 방향 변경 시만 수정
- **구성**:
  - `spec/`: 비즈니스 & 기술 스펙
  - `skills/`: 단일 책임 함수 정의
  - `agents/`: Skill 실행자 정의
  - `orchestrator/`: 9단계 파이프라인
  - `config/`: 실행 규칙 & 데이터

**📌 예시**:
```
harness/spec/spec.md         ← "Skill은 뭔가?"
harness/skills/SKILL_*.md    ← "Character Designer가 뭘 하나?"
harness/agents/AGENT_*.md    ← "Character Designer Agent가 뭘 호출하나?"
harness/config/compliance-rules-v2.json ← "식품 검증은 14개 항목"
```

---

### 2. `implementation/backend/` 🔧 (실제 코드)
- **목적**: Node.js 서버 구현
- **기술 스택**: Express.js + OpenAI SDK + Supabase
- **진입점**: `server.js`
- **구성**:
  - `agents/`: Harness agents 구현
  - `routes/`: REST API 엔드포인트
  - `services/`: 비즈니스 로직
  - `config/`: 설정 로더

**📌 예시**:
```
harness/agents/AGENT_character-designer-agent.md (정의)
  ↓
implementation/backend/agents/backend-agent.js (구현)
  ↓ callAgent() 함수에서 TimelyAI SDK 호출
```

---

### 3. `implementation/frontend/` 💻 (UI)
- **목적**: React 사용자 인터페이스
- **기술 스택**: React + Supabase Auth + Tailwind
- **사용자**: 마케터, 콘텐츠 팀

**📌 예시**:
```
Step 1: 자료 입력 (React Form)
  ↓ POST /api/generate/pipeline
  ↓
Step 2~8: 진행 상황 표시
  ↓ WebSocket 또는 polling
```

---

### 4. `implementation/data/` 📊 (자산)
- **목적**: 생성된 결과 & 중간 데이터
- **포함**:
  - 캐릭터 이미지 & 메타데이터
  - 생성된 시나리오 & 카피
  - 생성된 영상 URL & 메타데이터
  - 생성 로그 & QA 리포트

---

### 5. `docs/` 📚 (문서)
- **목적**: 사용자 & 개발자 문서
- **대상**:
  - 개발자: `guides/` (API, 개발 환경 설정)
  - 마케터: `character/`, `qa-reports/` (캐릭터 가이드, QA 결과)

---

### 6. `supabase/` 🗄️ (데이터베이스)
- **목적**: PostgreSQL 스키마 & 마이그레이션
- **내용**: 테이블 정의, RLS 정책, 함수

---

### 7. `legacy/duplicates/` 🚫 (아카이브)
- **목적**: 이전 프로젝트 구조 (참고/복구용)
- **포함**:
  - 중복된 agents/, skills/ 폴더
  - 이전 jejusalt-brand-harness/ 구조
- **주의**: Git에 추가하지 않음

---

## 🔗 파일 경로 매핑

| 목적 | Harness 정의 | 구현 코드 | 비고 |
|------|-------------|---------|------|
| **Step 1: 자료 분석** | `harness/agents/AGENT_*.md` | `backend/routes/generation.js` | POST /api/generate/pipeline |
| **Step 3: 캐릭터 설계** | `harness/skills/SKILL_character-designer.md` | `backend/agents/backend-agent.js::callAgent()` | TimelyAI 호출 |
| **Step 7: 컴플라이언스** | `harness/config/compliance-rules-v2.json` | `backend/agents/qa-agent.js::performAutoValidation()` | 자동 검증 |
| **Step 9: 품질 검사** | `harness/agents/QA-AGENT.md` | `backend/agents/qa-agent.js::performComprehensiveQA()` | Phase 1/2/3 |
| **환경변수** | - | `implementation/backend/.env` | Git 제외 |
| **캐릭터 라이브러리** | `harness/config/config-characters-v3.json` | `backend/config/` 에서 로드 | 메모리 캐시 |

---

## 🚀 실제 워크플로우

```
[프로젝트 초기화]
1. harness/spec/spec.md 읽기         ← 프로젝트 정의
2. harness/brand-voice.md 읽기       ← 톤앤보이스
3. implementation/backend/.env 설정  ← API 키 입력
4. npm install                       ← 의존성 설치
5. npm start                         ← 서버 시작

[콘텐츠 생성 요청]
1. Frontend: POST /api/generate/pipeline
2. Backend: implementation/backend/routes/generation.js
3. CallAgent: implementation/backend/agents/backend-agent.js
4. TimelyAI SDK: harness/agents/ 정의 기반 프롬프트
5. Higgsfield CLI: higgsfield generate create (로컬 인증)
6. QA: implementation/backend/agents/qa-agent.js
   - compliance-rules-v2.json (harness/config/) 로드
   - Phase 1: 자동 검증
   - Phase 2: 수동 체크리스트

[최종 검증]
1. QA 결과: PASS / WARNING / REJECTED
2. Supabase: quality_assurance_logs 테이블에 저장
3. Frontend: 결과 표시
```

---

## ✅ 정렬 체크리스트

| 항목 | 상태 | 확인 |
|------|------|------|
| `harness/spec/` | ✅ 완료 | spec.md, PRD.md, brand-voice.md |
| `harness/skills/` | ✅ 완료 | 3개 Skill 정의 |
| `harness/agents/` | ✅ 완료 | 4개 Agent 정의 + QA-AGENT.md |
| `harness/config/` | ✅ 완료 | compliance-rules-v2.json (카테고리별 검증) |
| `implementation/backend/` | ✅ 완료 | Node.js 서버 (agents, routes, config) |
| `implementation/frontend/` | ✅ 완료 | React 앱 |
| `implementation/data/` | ✅ 완료 | 자산 & 메타데이터 |
| `docs/` | ✅ 완료 | 사용자 & 개발자 문서 |
| `supabase/` | ✅ 완료 | DB 마이그레이션 |
| `legacy/duplicates/` | ✅ 완료 | 이전 구조 아카이브 |

---

## 📝 개발 가이드

### 새로운 Agent 추가하기

1. **정의 (Harness)**
   ```
   harness/agents/AGENT_my-agent.md
   ```

2. **구현 (Code)**
   ```
   implementation/backend/agents/my-agent.js
   ```

3. **호출 (Routes)**
   ```
   implementation/backend/routes/generation.js
   ```

---

### 새로운 검증 규칙 추가하기

1. **규칙 정의 (Harness)**
   ```json
   harness/config/compliance-rules-v2.json
   {
     "rule_id": "CUSTOM_001",
     "rule_name": "...",
     "automation": "auto" or "manual",
     "keywords_to_block": [...]
   }
   ```

2. **로직 (Code)**
   ```
   implementation/backend/agents/qa-agent.js::performAutoValidation()
   ```

---

## 🔐 .gitignore

```
# 환경 변수 (보안)
.env

# 의존성 & 빌드
node_modules/
build/
dist/

# 임시 파일
*.log
.DS_Store
.vscode/

# 이전 구조 (아카이브)
legacy/

# 대용량 파일
videos/
*.mp4
```

---

## 📞 문제 해결

**Q: `harness/config/compliance-rules-v2.json`을 수정했는데 반영이 안 돼요.**
→ `implementation/backend/agents/qa-agent.js`에서 `loadComplianceRulesV2()` 함수가 캐시를 사용합니다. 서버를 재시작해주세요.

**Q: 새로운 Agent를 추가했는데 호출이 안 돼요.**
→ `harness/agents/AGENT_*.md`에 정의했는지, `implementation/backend/agents/backend-agent.js::callAgent()`에서 해당 Agent 이름을 처리하는지 확인해주세요.

**Q: legacy/duplicates 폴더는 왜 있어요?**
→ 이전 프로젝트 구조입니다. Git에서 제외되었으며, 필요한 경우 참고용으로만 사용합니다.

---

**정렬 완료 일시**: 2026-08-13  
**정렬 담당**: Claude Code  
**최종 검증**: 보류 중

