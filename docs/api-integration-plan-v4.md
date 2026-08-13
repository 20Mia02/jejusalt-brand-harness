# api-integration-plan-v4.md — Claude API / TimelyAI / Higgsfield 통합 설계서

**작성일**: 2026.08.04
**작성자**: 박주미 (변수명 수정: 고수아, 코드 기준 통일)
**버전**: v4.1 (Day 2 기준, 환경변수명 코드와 일치시킴)
**용도**: 웹앱이 외부 API 3곳(TimelyAI, Higgsfield, Supabase)과 어떻게 통신하는지 정의

> ⚠️ **v4.1 변경사항**: TimelyAI 관련 환경변수 이름이 이 문서(v4)와 실제 코드(`backend-agent.js`)가 서로 달라서(`TIMELYAI_*` vs `TIMELY_AI_*`) 혼동이 있었습니다. **코드가 이미 실제로 동작 확인된 이름이므로, 문서를 코드에 맞춰 수정**했습니다.

---

## 1️⃣ 통합 대상 3곳

| 대상 | 역할 | 문서 근거 |
|---|---|---|
| **TimelyAI** | 8개 Skill/Agent 실행 (분석, 캐릭터, 시나리오, 네이밍, 카피, 검증) | `agents-sub/backend-agent.md`, `agents-sub/orchestrator.md` |
| **Higgsfield** | 최종 숏폼 영상 생성 (120초) | `agents-sub/backend-agent.md` Step 8 |
| **Supabase** | 7개 테이블 CRUD (자료/캐릭터/시나리오/네이밍/콘텐츠/영상/로그) | `agents-sub/database-agent.md` |

이 문서는 위 3곳에 대한 **연결 정보(.env), 호출 정책(재시도/타임아웃), 실패 처리 규칙**을 한 곳에 모은 것이다.
실제 호출 로직 자체는 `backend-agent.js`(TimelyAI/Higgsfield)와 `database-agent.js`(Supabase)에 이미 구현되어 있으므로,
이 문서는 그 둘을 아우르는 **연결 설정 + 정책 요약**의 역할을 한다.

---

## 2️⃣ 환경 변수 (.env) 구성

`.env.example`에 이미 커밋된 구조와 동일하다. 실제 키는 로컬 `.env`에만 보관하고 GitHub에 올리지 않는다.

```bash
# Supabase
SUPABASE_URL=https://bwquipczxdmofkfmbvdd.supabase.co
SUPABASE_ANON_KEY=<Settings > API Keys > anon public>
SUPABASE_SERVICE_KEY=<Settings > API Keys > service_role secret>

# TimelyAI
# ⚠️ v4.1: 아래 이름이 backend-agent.js 실제 코드와 일치하는 정식 이름입니다.
TIMELY_AI_BASE_URL=https://timelyai.io/api
TIMELY_AI_API_KEY=<발급 후 채움>

# Higgsfield
HIGGSFIELD_API_URL=https://api.higgsfield.ai
HIGGSFIELD_API_KEY=<발급 후 채움>

# Node
NODE_ENV=development
PORT=5000
```

> ⚠️ `TIMELY_AI_API_KEY`, `HIGGSFIELD_API_KEY`는 Day 2 오전 기준 아직 미발급 상태였으나, Higgsfield는 5장(Higgsfield 연동 가이드)에 따라 오늘 오후 발급 완료 예정.
> 발급 전까지는 `callAgent()` / `requestHiggsfieldVideo()` 호출부에서 키 누락 시 `CLIENT_ERROR`로 즉시 실패 처리되도록 방어 코드가 필요하다 (아래 6️⃣ 참고).

---

## 3️⃣ TimelyAI 통합 — 8개 Agent 매핑

`backend-agent.md`에서 정의한 표를 그대로 따른다 (중복 정의 방지를 위해 여기서는 요약만 둠).

| 순서 | Agent | 호출 route | 담당 |
|---|---|---|---|
| 1 | resource-analyzer-agent | routes/resources.js | 박주미 |
| 2 | character-generator-agent | routes/resources.js | 박주미 |
| 3 | character-designer-agent | routes/generation.js | 고수아 |
| 4 | shortform-scenario-writer-agent | routes/generation.js | 고수아 |
| 5 | naming-generator-agent | routes/generation.js | 고수아 |
| 6 | product-intro-writer-agent / product-detail-page-writer-agent | routes/generation.js | 박주미 |
| 7 | compliance-reviewer-agent | routes/generation.js | 박주미 |

호출 엔드포인트: `TIMELY_AI_BASE_URL`을 베이스로 `callAgent(agentName, payload)` 형태로 호출한다 (`backend-agent.js`가 내부적으로 `TIMELY_AI_API_KEY`를 `Authorization` 헤더 또는 body에 실어 보낸다).

---

## 4️⃣ Higgsfield 통합 — 영상 생성 (Step 9)

Higgsfield는 TimelyAI Agent가 아니라 **별도의 외부 영상 생성 API**이므로 호출 방식이 다르다.

```
(a) 요청: POST {HIGGSFIELD_API_URL}/v1/videos
    - body: { character, script, voiceTone, duration }
    - 응답: { id, status: "processing", progress: 0, video_url: null }
    - 타임아웃: 30초 (요청 접수까지만)
    - 성공 즉시 videos 테이블에 INSERT (generation_status: "processing", generation_progress: 0)

(b) 폴링: GET {HIGGSFIELD_API_URL}/v1/videos/{higgsfieldId}
    - 5초 간격, 최대 10분(120회)
    - status: "processing" → "completed" | "failed"
    - 매 응답마다 videos 테이블 UPDATE (generation_progress, generation_status, video_url)
    - completed/failed 시 폴링 중단
```

**왜 요청과 폴링을 분리했는가**: 영상 완성까지 30초를 훨씬 초과하는 경우가 많아서, 요청 접수 확인만 30초 타임아웃을 걸고
실제 완료 대기는 별도 폴링 루프(`pollHiggsfield()`, `backend-agent.js` 참고)로 처리한다. **`callHiggsfield()` 성공 직후 `pollHiggsfield()`를 fire-and-forget으로 실행**하여 API 응답이 지연되지 않도록 한다.
이 폴링 결과를 `frontend-agent.md`가 5초마다 다시 조회해서 `GenerationUI.jsx`의 진행률 바에 반영한다.

---

## 5️⃣ Supabase 통합 — 7개 테이블

`database-agent.js`에서 정의한 `callDatabase(table, operation, data, filter)`를 통해서만 접근한다.
저장 순서(resources → characters → scenarios → naming → contents → videos)와 롤백 정책도 해당 문서를 따른다.

연결은 Supabase JS 클라이언트로 초기화한다:

```javascript
// backend/agents/database-agent.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // 서버 사이드는 service_role 사용 (RLS 우회)
);

module.exports = { supabase, /* ...callDatabase 등 */ };
```

> 클라이언트(브라우저) 쪽에서 직접 Supabase를 호출하는 경우는 없음 — 모든 요청은 Express 서버(routes/*.js)를 거쳐서 `SUPABASE_SERVICE_KEY`로만 접근한다. `SUPABASE_ANON_KEY`는 현재 미사용이지만, Day 3에 RLS 정책을 적용하면서 프론트에서 직접 읽기 전용 조회에 활용할 수 있도록 `.env.example`에 남겨둔다.

---

## 6️⃣ 공통 재시도/타임아웃 정책 (TimelyAI, Higgsfield 공통)

`backend-agent.md`에 정의된 정책을 그대로 인용한다:

```
최대 재시도: 3회
Backoff: 지수백오프 (1초 → 2초 → 4초)
타임아웃: TimelyAI 60초 / Higgsfield 요청 30초 (완료 폴링은 예외, 최대 10분)

재시도 대상: TIMEOUT, RATE_LIMIT(429), SERVER_ERROR(5xx)
재시도 안 함: CLIENT_ERROR(4xx), AUTH_ERROR(401/403), INVALID_RESPONSE(JSON 파싱 실패/status 필드 없음)
```

**API 키 미발급 상태 방어 코드** (`TIMELY_AI_API_KEY`, `HIGGSFIELD_API_KEY`가 비어있을 때):

```javascript
function assertApiKeysConfigured() {
  const missing = [];
  if (!process.env.TIMELY_AI_API_KEY) missing.push("TIMELY_AI_API_KEY");
  if (!process.env.HIGGSFIELD_API_KEY) missing.push("HIGGSFIELD_API_KEY");
  if (missing.length > 0) {
    throw new Error(`API 키 미설정: ${missing.join(", ")} — .env를 확인하세요`);
  }
}
```
→ 이 체크를 `callAgent()`/`callHiggsfield()` 진입 시점에 넣어서, 키가 없을 때 무의미한 재시도 3회를 반복하지 않고 즉시 `CLIENT_ERROR`로 실패 처리한다.

---

## 7️⃣ 전체 호출 흐름 요약도

```
[사용자 입력]
   ↓
routes/resources.js
   → callAgent("resource-analyzer-agent") ─┐
   → callAgent("character-generator-agent")│ TimelyAI
   → callDatabase(...)                     │ (backend-agent.js)
   ↓                                       │
routes/generation.js                       │
   → callAgent("character-designer-agent") │
   → callAgent("shortform-scenario-writer-agent")
   → callAgent("naming-generator-agent")   │
   → callAgent("product-intro/detail-writer-agent")
   → callAgent("compliance-reviewer-agent")┘
   → callHiggsfield()          ─────────────── Higgsfield (요청, 30초 타임아웃)
   → pollHiggsfield() [fire-and-forget] ────── Higgsfield (5초 폴링, 최대 10분)
   ↓
callDatabase(...) 매 단계마다 ────────────────── Supabase (SERVICE_KEY)
   (resources/characters/scenarios/naming/contents/videos/generation_logs)
   ↓
frontend-agent.md (5초 폴링, videos 테이블) → GenerationUI.jsx
```

---

## 8️⃣ 체크리스트

- [x] .env에 SUPABASE_URL/ANON_KEY/SERVICE_KEY 채워짐
- [x] .env에 TIMELY_AI_BASE_URL, TIMELY_AI_API_KEY 이름 통일 완료 (v4.1)
- [ ] .env에 HIGGSFIELD_API_KEY는 발급 후 채우기 (5장 가이드 참고, 오늘 오후 발급 예정)
- [x] 서버는 SUPABASE_SERVICE_KEY 사용, 프론트는 Supabase 직접 호출 안 함
- [ ] 키 미설정 시 즉시 실패(CLIENT_ERROR)하고 3회 재시도 낭비하지 않음
- [x] Higgsfield "요청"과 "완료 폴링" 타임아웃 분리 확인
- [x] pollHiggsfield()가 callHiggsfield() 직후 fire-and-forget으로 실행되는지 확인

---

✅ **v4.1 완성. 이 문서는 backend-agent.js / database-agent.js의 실제 구현을 전제로 한 "연결 설정 + 정책 요약"입니다. 실제 호출 코드는 두 파일을 참고하세요.**
