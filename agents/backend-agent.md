---
title: backend-agent
role: API 호출 중개 에이전트 (TimelyAI 8개 Agent, Higgsfield, Supabase)
type: Agent
version: 2.0
owner: 박주미
depends_on:
  - database-agent (저장 위임)
calls:
  - resource-analyzer-agent (→ SKILL_resource-analyzer)
  - character-generator-agent (→ SKILL_character-generator)
  - character-designer-agent (→ SKILL_character-designer)
  - shortform-scenario-writer-agent (→ SKILL_shortform-scenario-writer)
  - naming-generator-agent (→ SKILL_naming-generator)
  - product-intro-writer-agent (→ SKILL_product-intro-writer)
  - product-detail-page-writer-agent (→ SKILL_product-detail-page-writer)
  - compliance-reviewer-agent (→ SKILL_claim-safety-checker)
used_by:
  - routes/resources.js
  - routes/admin.js
  - routes/generation.js
---

# backend-agent.md

## 역할

**웹앱(Node.js/Express)이 TimelyAI의 8개 Agent와 Higgsfield를 직접 호출하지 않고,
backend-agent를 거쳐서 통일된 방식으로 호출하도록 중개하는 에이전트**

각 route 파일(resources.js, admin.js, generation.js)은 "무슨 Agent를 어떤 입력으로 부를지"만 결정하고,
"어떻게 재시도하고 얼마나 기다릴지"는 backend-agent가 전담한다.

---

## 어떤 route가 어떤 Agent(→Skill)를 쓰는지 (전체 매핑)

이 표가 이 문서의 핵심이다. **orchestrator.md의 8단계 파이프라인**과 동일한 순서를 따른다.

| Route 파일 | 순서 | Agent 이름 | 내부적으로 부르는 Skill | 담당 |
|---|---|---|---|---|
| routes/resources.js | 1 | `resource-analyzer-agent` | `SKILL_resource-analyzer` | 박주미 |
| routes/resources.js | 2 | `character-generator-agent` | `SKILL_character-generator` | 박주미 |
| routes/generation.js | 3 | `character-designer-agent` | `SKILL_character-designer` | 고수아 |
| routes/generation.js | 4 | `shortform-scenario-writer-agent` | `SKILL_shortform-scenario-writer` | 고수아 |
| routes/generation.js | 5 | `naming-generator-agent` | `SKILL_naming-generator` | 고수아 |
| routes/generation.js | 6 | `product-intro-writer-agent` 또는 `product-detail-page-writer-agent` | `SKILL_product-intro-writer` / `SKILL_product-detail-page-writer` | 박주미 |
| routes/generation.js | 7 | `compliance-reviewer-agent` | `SKILL_claim-safety-checker` | 박주미 |
| routes/generation.js | 8 | (Higgsfield, TimelyAI Agent 아님) | - | 공동 |
| routes/admin.js | - | (Agent 호출 없음, DB 직접 수정) | - | 박주미 |

> **왜 resources.js와 generation.js로 나뉘는가?**
> - `resources.js`: 자료 업로드 시점에 "분석 + 캐릭터 추천"까지만 (Step 1~2) → 빠르게 사용자에게 결과 보여줌
> - `generation.js`: 사용자가 "AI 생성" 버튼을 눌렀을 때 캐릭터 상세화부터 영상까지 전체 (Step 3~8) 실행

---

## 각 Agent 호출 시 실제 입력/출력 (어제 작성한 파일 기준)

routes 파일 작성 시 아래 필드명을 그대로 사용한다.

### 1️⃣ resource-analyzer-agent

```javascript
// 입력
{
  productName: "제주용암프리미엄솔트",   // 필수, 최소 3자
  productInfo: "나트륨 24.1g/100g...",   // 필수, 최소 30자
  keywords: ["프리미엄", "건강", "가족"]  // 선택
}

// 출력 (status: "success" 시)
{
  status: "success",
  metadata: {
    categories: ["식품", "헬스케어"],
    ageGroups: ["40~60대"],
    genders: ["무관"],
    targets: ["가족밥상", "건강관심층"],
    characters: ["용암이", "현무"],   // 참고용, 실제 3개 추천은 character-generator가 함
    focus: ["신뢰", "건강", "기술"],
    confidence: 0.96
  }
}
```

### 2️⃣ character-generator-agent

```javascript
// 입력 (resource-analyzer-agent의 metadata를 그대로 전달)
{
  productName: "제주용암프리미엄솔트",
  productInfo: "...",
  keywords: ["프리미엄", "건강", "가족"],
  metadata: {                          // 필수: Step 1의 결과
    categories: ["식품", "헬스케어"],
    ageGroups: ["40~60대"],
    genders: ["무관"],
    targets: ["가족밥상", "건강관심층"],
    focus: ["신뢰", "건강", "기술"]
  }
}

// 출력
{
  status: "success",
  characters: [
    { name: "용암이", description: "...", reason: "...", score: 95 },
    { name: "가마할방", description: "...", reason: "...", score: 89 },
    { name: "현무", description: "...", reason: "...", score: 86 }
  ]
}
```

### 3️⃣ character-designer-agent (고수아, 선택사항)

```javascript
// 입력
{
  character: "용암이",         // 선택된 캐릭터명
  productName: "...",
  metadata: { ... }
}

// 출력
{
  status: "success",
  detail: {
    characterName: "용암이",
    voiceTone: "낮고 차분한 아버지 목소리",
    personalityTraits: ["따뜻함", "신뢰", "보호 본능"],
    visualDescription: "...",
    preferredExpressions: ["함께", "이 맛", "우리 가족"]
  }
}
```

### 4️⃣ shortform-scenario-writer-agent (고수아)

> 실제 파일(`shortform-scenario-writer-agent.md`)에는 4막 구조 + 마케터 검토/재생성(최대 2회) 로직이 있다.
> 웹앱에서는 사람이 실시간으로 "다시 생성해줘"를 누르는 게 아니라 **자동 파이프라인**으로 돌아가므로,
> **1회 호출 → 120초 검증 실패 시 최대 1회 자동 재생성**으로 단순화해서 구현한다.

```javascript
// 입력
{
  character: "용암이",
  productName: "...",
  productInfo: "...",
  metadata: { ... },
  contentType: "제품스토리"   // "캐릭터소개" | "제품스토리" | "일상밥상"
}

// 출력
{
  status: "success",
  scenario: {
    title: "70년 제주 바다의 기술, 이제 당신 가족 밥상의 지킴이",
    total_duration: 120,
    acts: [
      { act: 1, duration: "0-30초", scene: "..." },
      { act: 2, duration: "30-60초", scene: "..." },
      { act: 3, duration: "60-90초", scene: "..." },
      { act: 4, duration: "90-120초", scene: "..." }
    ]
  }
}
```

**웹앱 자동화 규칙**: `total_duration`이 120초 ±5초를 벗어나면 1회 자동 재호출, 그래도 벗어나면 경고만 로그에 남기고 진행.

### 5️⃣ naming-generator-agent (고수아)

> 실제 파일에는 "마케터가 3개 중 선택"하는 UI 흐름이 있다. 웹앱에서는 **1순위(가장 높은 점수)를 자동 채택**하되,
> AdminMode.jsx에서 사용자가 2·3순위로 바꿀 수 있게 3개 옵션을 모두 함께 반환한다.

```javascript
// 입력
{
  scenario: { ... },   // Step 4의 결과
  productName: "...",
  metadata: { ... }
}

// 출력
{
  status: "success",
  product_names: [
    { name: "제주용암프리미엄솔트", score: 100 },  // 기존명 유지 옵션
    { name: "70년 제주의 약속", score: 89 },
    { name: "바다의 선물, 우리 가족의 선택", score: 86 }
  ],
  content_names: [
    { name: "용암이가 전하는 제주 소금의 맛", score: 93 },
    { name: "70년 기술, 한 숟가락의 신뢰", score: 88 },
    { name: "우리 가족 밥상을 지키는 방법", score: 85 }
  ]
}
```

### 6️⃣ product-intro-writer-agent / product-detail-page-writer-agent (박주미)

```javascript
// 입력 (두 Agent 모두 동일한 입력 스펙)
{
  category: "식품",              // 필수, metadata.categories[0]
  character: "용암이",           // 필수
  productName: "...",            // 필수
  productInfo: "...",            // 필수
  videoType: "제품스토리",       // 필수
  keywords: ["프리미엄", "건강"] // 선택
}

// intro는 SNS/짧은 카피용, detail은 상세 페이지용 (더 길고 깊이 있음)
// 출력: 마크다운 형식 카피 (SKILL_product-intro-writer / SKILL_product-detail-page-writer 결과 그대로)
```

**언제 어느 것을 쓰는가**: `requestType`이 "intro"면 product-intro-writer-agent,
"detail"이면 product-detail-page-writer-agent, "both"면 둘 다 호출.

### 7️⃣ compliance-reviewer-agent (박주미)

```javascript
// 입력
{
  generatedContent: "## 식품 | 용암이와 함께하는...",  // Step 6 결과 (마크다운)
  category: "식품",
  productName: "제주용암프리미엄솔트"
}

// 출력 (마크다운 → 파싱해서 JSON화)
{
  status: "success",
  validation: {
    status: "APPROVED" | "NEEDS REVISION" | "REJECTED",
    score: 96,
    issues: [],
    corrections: []
  }
}
```

---

## 호출 방식 (run_subagent 공통 래퍼)

### 재시도/타임아웃 정책

```
최대 재시도: 3회
Backoff: 1차 실패 → 1초 대기, 2차 실패 → 2초 대기
타임아웃: 60초 (Higgsfield "영상 완료"는 예외, 아래 참고)

재시도 대상: 타임아웃, 5xx, 429
재시도 안 함: 4xx (입력값 문제), JSON 파싱 실패
```

### 공통 래퍼 함수

```javascript
async function callAgent(agentName, payload, options = {}) {
  const { resourceId, step } = options;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await run_subagent(agentName, payload, { timeout: 60000 });

      if (!result || result.status !== "success") {
        throw new Error(result?.message || `${agentName} 응답이 success가 아님`);
      }

      const durationMs = Date.now() - startedAt;
      await logStep({ resourceId, step, status: "success", durationMs, attempt });
      return { success: true, data: result, durationMs, attempt };

    } catch (error) {
      const retryable = isRetryableError(error);
      if (!retryable || attempt === 3) {
        const durationMs = Date.now() - startedAt;
        await logStep({ resourceId, step, status: "fail", error: error.message, durationMs, attempt });
        return { success: false, error: classifyError(error), message: error.message, attempt, durationMs };
      }
      await sleep(attempt === 1 ? 1000 : 2000);
    }
  }
}
```

### 실제 사용 예 (routes/resources.js, Step 1~2)

```javascript
// Step 1: resource-analyzer-agent
const step1 = await callAgent(
  "resource-analyzer-agent",
  { productName, productInfo, keywords },
  { resourceId, step: "resource-analyzer" }
);
if (!step1.success) {
  return res.status(502).json({ success: false, message: "제품 정보 분석 실패", detail: step1 });
}
const metadata = step1.data.metadata;

// Step 2: character-generator-agent (metadata를 그대로 전달)
const step2 = await callAgent(
  "character-generator-agent",
  { productName, productInfo, keywords, metadata },
  { resourceId, step: "character-generator" }
);
if (!step2.success) {
  return res.status(502).json({ success: false, message: "캐릭터 추천 실패", detail: step2 });
}
const characters = step2.data.characters;
```

### 실제 사용 예 (routes/generation.js, Step 3~7)

```javascript
// Step 3: character-designer-agent (실패해도 진행 — 선택사항)
const step3 = await callAgent(
  "character-designer-agent",
  { character: selectedCharacter, productName, metadata },
  { resourceId, step: "character-designer" }
);
const characterDetail = step3.success ? step3.data.detail : null;

// Step 4: shortform-scenario-writer-agent (120초 검증 + 1회 자동 재생성)
let step4 = await callAgent(
  "shortform-scenario-writer-agent",
  { character: selectedCharacter, productName, productInfo, metadata, contentType },
  { resourceId, step: "shortform-scenario-writer" }
);
if (step4.success && Math.abs(step4.data.scenario.total_duration - 120) > 5) {
  step4 = await callAgent("shortform-scenario-writer-agent", { character: selectedCharacter, productName, productInfo, metadata, contentType }, { resourceId, step: "shortform-scenario-writer-retry" });
}
if (!step4.success) {
  return res.status(502).json({ success: false, message: "시나리오 생성 실패", detail: step4 });
}
const scenario = step4.data.scenario;

// Step 5: naming-generator-agent
const step5 = await callAgent(
  "naming-generator-agent",
  { scenario, productName, metadata },
  { resourceId, step: "naming-generator" }
);
const productNameGenerated = step5.success ? step5.data.product_names[0].name : productName;
const contentNameGenerated = step5.success ? step5.data.content_names[0].name : "제품 스토리";

// Step 6: product-intro-writer-agent 또는 product-detail-page-writer-agent
const agentName = requestType === "detail" ? "product-detail-page-writer-agent" : "product-intro-writer-agent";
const step6 = await callAgent(
  agentName,
  { category: metadata.categories[0], character: selectedCharacter, productName, productInfo, videoType: contentType, keywords },
  { resourceId, step: agentName }
);
if (!step6.success) {
  return res.status(502).json({ success: false, message: "카피 생성 실패", detail: step6 });
}
const generatedContent = step6.data.content;

// Step 7: compliance-reviewer-agent
const step7 = await callAgent(
  "compliance-reviewer-agent",
  { generatedContent, category: metadata.categories[0], productName },
  { resourceId, step: "compliance-reviewer" }
);
if (!step7.success || step7.data.validation.status === "REJECTED") {
  return res.status(422).json({ success: false, message: "검증 실패, 콘텐츠 재생성 필요", detail: step7 });
}
```

---

## Higgsfield (Step 8, TimelyAI Agent 아님 — 별도 처리)

```javascript
// (a) 영상 생성 요청 (60초 타임아웃)
async function requestHiggsfieldVideo(payload, options) {
  return callExternalAPI("higgsfield", payload, options);
  // 반환: { success, data: { jobId, status: "queued" }, ... }
}

// (b) 진행률 폴링 (5초 간격, 최대 5분 = 60회)
async function pollHiggsfieldStatus(jobId, resourceId) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`https://api.higgsfield.ai/v1/jobs/${jobId}`);
    const data = await res.json();
    if (data.status === "completed") {
      return { success: true, videoUrl: data.videoUrl, thumbnailUrl: data.thumbnailUrl };
    }
    if (data.status === "failed") {
      return { success: false, error: "GENERATION_FAILED", message: data.errorMessage };
    }
    await sleep(5000);
  }
  return { success: false, error: "TIMEOUT", message: "5분 내 영상 생성 완료되지 않음" };
}
```

> Higgsfield 완료까지는 60초를 훨씬 넘기므로, "요청 접수"만 60초 타임아웃을 적용하고
> "완료 확인"은 frontend-agent가 5초마다 진행률을 화면에 갱신하는 별도 폴링으로 분리한다.

---

## 에러 분류 (classifyError)

| 분류 | 조건 | 재시도 |
|---|---|---|
| `TIMEOUT` | 60초 내 응답 없음 | ✅ |
| `RATE_LIMIT` | HTTP 429 | ✅ |
| `SERVER_ERROR` | HTTP 5xx | ✅ |
| `CLIENT_ERROR` | HTTP 4xx (429 제외) | ❌ |
| `INVALID_RESPONSE` | JSON 파싱 실패, status 필드 없음 | ❌ |
| `GENERATION_FAILED` | Higgsfield status: failed | ❌ |

---

## generation_logs 기록 (database-agent에 위임)

backend-agent는 DB에 직접 쓰지 않는다. 모든 호출 성공/실패는 database-agent를 통해 기록한다.

```javascript
async function logStep({ resourceId, step, status, durationMs, attempt, error }) {
  await callDatabase("generation_logs", "create", {
    resource_id: resourceId,
    step,                      // 예: "resource-analyzer", "shortform-scenario-writer-retry"
    status,                    // "success" | "fail"
    error_message: error || null,
    duration_ms: durationMs,
    attempt
  });
}
```

---

## 체크리스트

- [ ] 8개 Agent 이름/입출력 필드가 실제 파일과 정확히 일치하는가
- [ ] resources.js는 Step 1~2까지만, generation.js는 Step 3~8까지 담당하는가
- [ ] shortform-scenario-writer 120초 검증 + 1회 자동 재생성 구현했는가
- [ ] naming-generator는 1순위 자동 채택 + 3개 옵션 모두 반환 (AdminMode에서 변경 가능하도록)
- [ ] compliance-reviewer REJECTED 시 즉시 422 반환
- [ ] Higgsfield "요청"과 "완료 폴링" 분리했는가 (60초 vs 5초×60회)
- [ ] 모든 단계 generation_logs에 기록 (database-agent 경유)

---

✅ **완성! routes/resources.js, routes/generation.js에서 이 인터페이스를 그대로 사용합니다.**
