# api-integration-plan-v4.md — Claude API / TimelyAI / Higgsfield 통합 설계서

**작성일**: 2026.08.04
**작성자**: 박주미
**버전**: v4 (Day 2 기준, Supabase DB 연동 확정판)
**용도**: 웹앱이 외부 API 3곳(TimelyAI, Higgsfield, Supabase)과 어떻게 통신하는지 정의

---

## 1️⃣ 통합 대상 3곳

| 대상 | 역할 | 문서 근거 |
|---|---|---|
| **TimelyAI** | 8개 Skill/Agent 실행 (분석, 캐릭터, 시나리오, 네이밍, 카피, 검증) | `agents-sub/backend-agent.md`, `agents-sub/orchestrator.md` |
| **Higgsfield** | 최종 숏폼 영상 생성 (120초) | `agents-sub/backend-agent.md` Step 8 |
| **Supabase** | 7개 테이블 CRUD (자료/캐릭터/시나리오/네이밍/콘텐츠/영상/로그) | `agents-sub/database-agent.md` |

이 문서는 위 3곳에 대한 **연결 정보(.env), 호출 정책(재시도/타임아웃), 실패 처리 규칙**을 한 곳에 모은 것이다.
실제 호출 로직 자체는 `backend-agent.md`(TimelyAI/Higgsfield)와 `database-agent.md`(Supabase)에 이미 정의되어 있으므로,
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
TIMELYAI_API_URL=https://timelyai.io/api
TIMELYAI_PROJECT_ID=76307e07-8402-4b49-8ead-33fbf63c4940
TIMELYAI_API_KEY=<발급 후 채움>

# Higgsfield
HIGGSFIELD_API_URL=https://api.higgsfield.ai/v1
HIGGSFIELD_API_KEY=<발급 후 채움>

# Node
NODE_ENV=development
PORT=5000
```

> ⚠️ `TIMELYAI_API_KEY`, `HIGGSFIELD_API_KEY`는 Day 2 오전 기준 아직 미발급 상태.
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

호출 엔드포인트: `TIMELYAI_API_URL`을 베이스로 `run_subagent(agentName, payload)` 형태로 호출한다 (TimelyAI SDK/HTTP 클라이언트가 내부적으로 `TIMELYAI_PROJECT_ID`, `TIMELYAI_API_KEY`를 헤더에 실어 보낸다).

---

## 4️⃣ Higgsfield 통합 — 영상 생성 (Step 8)

Higgsfield는 TimelyAI Agent가 아니라 **별도의 외부 영상 생성 API**이므로 호출 방식이 다르다.

```
(a) 요청: POST {HIGGSFIELD_API_URL}/generate
    - body: { scenario, character, characterDetail, productName, contentName }
    - 응답: { jobId, status: "queued" }
    - 타임아웃: 60초 (요청 접수까지만)

(b) 폴링: GET {HIGGSFIELD_API_URL}/jobs/{jobId}
    - 5초 간격, 최대 5분(60회)
    - status: "processing" → "completed" | "failed"
    - completed 시: { videoUrl, thumbnailUrl }
```

**왜 요청과 폴링을 분리했는가**: 영상 완성까지 60초를 훨씬 초과하는 경우가 많아서, 요청 접수 확인만 60초 타임아웃을 걸고
실제 완료 대기는 별도 폴링 루프(`pollHiggsfieldStatus()`, `backend-agent.md` 참고)로 처리한다.
이 폴링 결과를 `frontend-agent.md`가 5초마다 다시 조회해서 GenerationUI.jsx의 진행률 바에 반영한다.

---

## 5️⃣ Supabase 통합 — 7개 테이블

`database-agent.md`에서 정의한 `callDatabase(table, operation, data, filter)`를 통해서만 접근한다.
저장 순서(resources → characters → scenarios → naming → contents → videos)와 롤백 정책도 해당 문서를 따른다.

연결은 Supabase JS 클라이언트로 초기화한다:

```javascript
// lib/supabaseClient.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // 서버 사이드는 service_role 사용 (RLS 우회, Day 3에 정책 추가 예정)
);

module.exports = supabase;
```

> 클라이언트(브라우저) 쪽에서 직접 Supabase를 호출하는 경우는 없음 — 모든 요청은 Express 서버(routes/*.js)를 거쳐서 `SUPABASE_SERVICE_KEY`로만 접근한다. `SUPABASE_ANON_KEY`는 현재 미사용이지만, Day 3에 RLS 정책을 적용하면서 프론트에서 직접 읽기 전용 조회에 활용할 수 있도록 `.env.example`에 남겨둔다.

---

## 6️⃣ 공통 재시도/타임아웃 정책 (TimelyAI, Higgsfield 공통)

`backend-agent.md`에 정의된 정책을 그대로 인용한다:

```
최대 재시도: 3회
Backoff: 1차 실패 → 1초 대기, 2차 실패 → 2초 대기
타임아웃: 60초 (Higgsfield 완료 폴링은 예외)

재시도 대상: TIMEOUT, RATE_LIMIT(429), SERVER_ERROR(5xx)
재시도 안 함: CLIENT_ERROR(4xx), INVALID_RESPONSE(JSON 파싱 실패/status 필드 없음)
```

**API 키 미발급 상태 방어 코드** (TIMELYAI_API_KEY, HIGGSFIELD_API_KEY가 비어있을 때):

```javascript
function assertApiKeysConfigured() {
  const missing = [];
  if (!process.env.TIMELYAI_API_KEY) missing.push("TIMELYAI_API_KEY");
  if (!process.env.HIGGSFIELD_API_KEY) missing.push("HIGGSFIELD_API_KEY");
  if (missing.length > 0) {
    throw new Error(`API 키 미설정: ${missing.join(", ")} — .env를 확인하세요`);
  }
}
```
→ 이 체크를 `callAgent()`/`requestHiggsfieldVideo()` 진입 시점에 넣어서, 키가 없을 때 무의미한 재시도 3회를 반복하지 않고 즉시 `CLIENT_ERROR`로 실패 처리한다.

---

## 7️⃣ 전체 호출 흐름 요약도

```
[사용자 입력]
   ↓
routes/resources.js
   → callAgent("resource-analyzer-agent") ─┐
   → callAgent("character-generator-agent")│ TimelyAI
   → callDatabase(...)                     │ (backend-agent.md)
   ↓                                       │
routes/generation.js                       │
   → callAgent("character-designer-agent") │
   → callAgent("shortform-scenario-writer-agent")
   → callAgent("naming-generator-agent")   │
   → callAgent("product-intro/detail-writer-agent")
   → callAgent("compliance-reviewer-agent")┘
   → requestHiggsfieldVideo()  ─────────────── Higgsfield
   → pollHiggsfieldStatus()
   ↓
callDatabase(...) 매 단계마다 ────────────────── Supabase
   (resources/characters/scenarios/naming/contents/videos/generation_logs)
   ↓
routes/generation.js GET /status
   ↓
frontend-agent.md (5초 폴링) → GenerationUI.jsx
```

---

## 8️⃣ 체크리스트

- [ ] .env에 SUPABASE_URL/ANON_KEY/SERVICE_KEY 채워짐 (완료)
- [ ] .env에 TIMELYAI_API_KEY, HIGGSFIELD_API_KEY는 발급 후 채우기 (미완료 — 발급 대기 중)
- [ ] 서버는 SUPABASE_SERVICE_KEY만 사용, 프론트는 Supabase 직접 호출 안 함
- [ ] 키 미설정 시 즉시 실패(CLIENT_ERROR)하고 3회 재시도 낭비하지 않음
- [ ] Higgsfield "요청"과 "완료 폴링" 타임아웃 분리 확인

---

✅ **완성. 이 문서는 backend-agent.md / database-agent.md의 실제 구현을 전제로 한 "연결 설정 + 정책 요약"입니다. 실제 호출 코드는 두 문서를 참고하세요.**
