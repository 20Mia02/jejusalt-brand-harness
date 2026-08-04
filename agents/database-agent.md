---
title: database-agent
role: Supabase CRUD 전담 에이전트
type: Agent
version: 1.0
owner: 박주미
tables:
  - resources
  - characters
  - scenarios
  - naming
  - contents
  - videos
  - generation_logs
used_by:
  - backend-agent (모든 저장/조회 위임받음)
  - routes/resources.js
  - routes/admin.js
  - routes/generation.js
---

# database-agent.md

## 역할

**Supabase(PostgreSQL) 7개 테이블에 대한 모든 CRUD를 전담하는 에이전트**

backend-agent(그리고 routes 파일들)는 Supabase 클라이언트를 직접 만지지 않고,
반드시 database-agent의 `callDatabase()`를 통해서만 데이터를 읽고 쓴다.

**목적**:
- 저장 순서(자식 테이블이 부모 테이블의 id를 참조)를 한 곳에서 보장
- 각 route 파일이 테이블 구조를 몰라도 되게 함 (필드명 오타, FK 누락 등 실수 방지)
- 실패 시 어디까지 저장됐는지 generation_logs로 추적 가능

---

## 테이블 구조 (오늘 생성한 schema.sql 기준)

```
resources (자료 = 파이프라인의 루트)
  ├─ characters        (resource_id FK)
  ├─ scenarios          (resource_id FK, character_id FK)
  ├─ naming             (resource_id FK)
  ├─ contents           (resource_id FK)
  ├─ videos             (resource_id FK)
  └─ generation_logs    (resource_id FK)
```

| 테이블 | 주요 컬럼 | 채워지는 시점 |
|---|---|---|
| `resources` | product_name, product_info, keywords, metadata(jsonb), status | Step 1 시작 시 생성, Step 2 후 metadata 업데이트 |
| `characters` | resource_id, name, description, reason, score, selected | Step 2 (character-generator) 후 3개 insert |
| `scenarios` | resource_id, character_id, title, total_duration, acts(jsonb) | Step 4 (shortform-scenario-writer) 후 |
| `naming` | resource_id, product_names(text[]), content_names(text[]) | Step 5 (naming-generator) 후 |
| `contents` | resource_id, content_type, generated_content, tone, length, validation_status, validation_score | Step 6~7 (writer + compliance) 후 |
| `videos` | resource_id, video_url, thumbnail_url, duration, status | Step 8 (Higgsfield 완료) 후 |
| `generation_logs` | resource_id, step, status, error_message, duration_ms, attempt | 매 Agent 호출마다 (backend-agent가 자동 기록) |

> `resources.metadata`는 JSONB로 저장한다 (`data-schema.md`의 metadata 구조를 그대로 사용:
> categories, ageGroups, genders, targets, focus, confidence).

---

## 입력

```javascript
{
  "table": "resources",              // 필수: 테이블명
  "operation": "create" | "read" | "update" | "delete",
  "data": { ... },                   // create/update 시 저장할 데이터
  "filter": { id: "uuid" },          // read/update/delete 시 조건
  "resourceId": "uuid"               // 로그 연결용 (선택, generation_logs 저장 시 제외)
}
```

## 출력

```javascript
{
  "success": true,
  "rows": [ { ... } ]     // create/read/update: 반영된 행, delete: 삭제된 행
}
```

실패 시:
```javascript
{
  "success": false,
  "error": "FK_VIOLATION" | "NOT_FOUND" | "VALIDATION_ERROR" | "DB_ERROR",
  "message": "resource_id가 존재하지 않습니다"
}
```

---

## 공통 함수

```javascript
async function callDatabase(table, operation, data = null, filter = null) {
  try {
    let query = supabase.from(table);

    switch (operation) {
      case "create": {
        const { data: rows, error } = await query.insert(data).select();
        if (error) throw error;
        return { success: true, rows };
      }
      case "read": {
        let q = query.select("*");
        if (filter) Object.entries(filter).forEach(([k, v]) => (q = q.eq(k, v)));
        const { data: rows, error } = await q;
        if (error) throw error;
        return { success: true, rows };
      }
      case "update": {
        let q = query.update(data);
        if (filter) Object.entries(filter).forEach(([k, v]) => (q = q.eq(k, v)));
        const { data: rows, error } = await q.select();
        if (error) throw error;
        return { success: true, rows };
      }
      case "delete": {
        let q = query.delete();
        if (filter) Object.entries(filter).forEach(([k, v]) => (q = q.eq(k, v)));
        const { data: rows, error } = await q.select();
        if (error) throw error;
        return { success: true, rows };
      }
      default:
        throw new Error(`알 수 없는 operation: ${operation}`);
    }
  } catch (error) {
    return { success: false, error: classifyDbError(error), message: error.message };
  }
}
```

---

## 저장 순서 (매우 중요! FK 위반 방지)

**반드시 이 순서로 저장한다** (부모 → 자식 순서). backend-agent가 이 순서를 지켜서 호출한다.

```
1️⃣ resources (create)        — resourceId 생성, status: "analyzing"
   ↓ (Step 1: resource-analyzer 완료 후)
2️⃣ resources (update)         — metadata 채움, status: "analyzed"
   ↓ (Step 2: character-generator 완료 후)
3️⃣ characters (create × 3)    — resource_id로 연결, 1번째를 selected: true
   ↓ (Step 4: shortform-scenario-writer 완료 후)
4️⃣ scenarios (create)         — resource_id + character_id로 연결
   ↓ (Step 5: naming-generator 완료 후)
5️⃣ naming (create)            — resource_id로 연결
   ↓ (Step 6~7: writer + compliance 완료 후)
6️⃣ contents (create)          — resource_id로 연결, validation_status/score 포함
   ↓ (Step 8: Higgsfield 완료 후)
7️⃣ videos (create)            — resource_id로 연결, status: "completed"
   ↓ (전체 완료)
8️⃣ resources (update)         — status: "completed"

⚠️ generation_logs는 위 순서와 무관하게 매 Agent 호출마다 즉시 기록됨 (성공/실패 모두)
```

---

## 각 단계별 실제 호출 예시

### 1️⃣ resources 생성 (Step 1 시작)

```javascript
const created = await callDatabase("resources", "create", {
  product_name: productName,
  product_info: productInfo,
  keywords: keywords || [],
  status: "analyzing"
});
if (!created.success) {
  return res.status(500).json({ success: false, message: "자료 저장 실패", detail: created });
}
const resourceId = created.rows[0].id;
```

### 2️⃣ resources 메타데이터 업데이트 (Step 1 완료 후)

```javascript
await callDatabase("resources", "update",
  { metadata: metadata, status: "analyzed" },
  { id: resourceId }
);
```

### 3️⃣ characters 3개 저장 (Step 2 완료 후)

```javascript
const characterRows = characters.map((c, idx) => ({
  resource_id: resourceId,
  name: c.name,
  description: c.description,
  reason: c.reason,
  score: c.score,
  selected: idx === 0   // 1순위(가장 높은 점수)를 기본 선택으로
}));

await callDatabase("characters", "create", characterRows);
```

### 4️⃣ scenarios 저장 (Step 4 완료 후)

```javascript
await callDatabase("scenarios", "create", {
  resource_id: resourceId,
  character_id: selectedCharacterId,
  title: scenario.title,
  total_duration: scenario.total_duration,
  acts: scenario.acts   // JSONB
});
```

### 5️⃣ naming 저장 (Step 5 완료 후)

```javascript
await callDatabase("naming", "create", {
  resource_id: resourceId,
  product_names: namingResult.product_names.map(p => p.name),   // text[]
  content_names: namingResult.content_names.map(c => c.name)    // text[]
});
```

### 6️⃣ contents 저장 (Step 6~7 완료 후)

```javascript
await callDatabase("contents", "create", {
  resource_id: resourceId,
  content_type: requestType,             // "intro" | "detail"
  generated_content: generatedContent,
  tone: complianceResult.validation.tone || null,
  length: generatedContent.length,
  validation_status: complianceResult.validation.status,
  validation_score: complianceResult.validation.score
});
```

### 7️⃣ videos 저장 (Step 8, Higgsfield 완료 후)

```javascript
await callDatabase("videos", "create", {
  resource_id: resourceId,
  video_url: higgsfieldResult.videoUrl,
  thumbnail_url: higgsfieldResult.thumbnailUrl,
  duration: 120,
  status: "completed"
});

await callDatabase("resources", "update", { status: "completed" }, { id: resourceId });
```

### 8️⃣ 필터 조회 (FilterUI.jsx → routes/resources.js → database-agent)

```javascript
// GET /api/resources/filter?categories=식품&ageGroups=40~60대
// metadata는 JSONB이므로 Supabase의 containedBy/contains 연산자 사용

async function getResourcesByFilter(filters) {
  let query = supabase.from("resources").select("*").eq("status", "completed");

  if (filters.categories?.length) {
    query = query.contains("metadata->categories", filters.categories);
  }
  if (filters.ageGroups?.length) {
    query = query.contains("metadata->ageGroups", filters.ageGroups);
  }
  if (filters.targets?.length) {
    query = query.contains("metadata->targets", filters.targets);
  }

  const { data: rows, error } = await query.order("created_at", { ascending: false });
  if (error) return { success: false, error: "DB_ERROR", message: error.message };
  return { success: true, rows };
}
```

---

## generation_logs 기록 (backend-agent가 호출)

database-agent는 스스로 로그를 남기지 않는다 (무한 루프 방지). **backend-agent가 매 Agent 호출 후 database-agent를 통해 기록**한다.

```javascript
// backend-agent.md의 logStep()이 이렇게 호출함
await callDatabase("generation_logs", "create", {
  resource_id: resourceId,
  step: "resource-analyzer",
  status: "success",
  error_message: null,
  duration_ms: 1240,
  attempt: 1
});
```

---

## 롤백 정책

Supabase 무료 플랜에서는 **다중 테이블 트랜잭션(BEGIN/COMMIT)을 애플리케이션 레벨에서 직접 제어하기 어렵다.**
따라서 완전한 롤백 대신 **"실패 지점까지 기록 + status로 상태 추적"** 방식을 쓴다.

```javascript
// 예: characters 저장까지 성공했는데 scenarios 저장이 실패한 경우
// → characters는 그대로 두고, resources.status를 "failed"로 변경
// → generation_logs에 실패 step과 error_message 기록
// → 사용자는 AdminMode에서 해당 resource를 보고 "재시도" 가능

async function markFailed(resourceId, failedStep, errorMessage) {
  await callDatabase("resources", "update",
    { status: "failed" },
    { id: resourceId }
  );
  await callDatabase("generation_logs", "create", {
    resource_id: resourceId,
    step: failedStep,
    status: "fail",
    error_message: errorMessage,
    duration_ms: null,
    attempt: null
  });
}
```

> **완전 삭제(hard delete)는 하지 않는다.** 실패해도 데이터는 남기고 status만 바꾼다.
> 이유: 디버깅 시 "어디까지 됐었는지" 확인 가능해야 하고, Day 3 RLS 정책 적용 전까지는 데이터 보존이 우선.

---

## 에러 분류 (classifyDbError)

| 분류 | 조건 | 처리 |
|---|---|---|
| `FK_VIOLATION` | resource_id가 resources에 없음 (23503) | 즉시 실패 반환, 재시도 안 함 |
| `VALIDATION_ERROR` | NOT NULL 컬럼 누락 (23502) | 즉시 실패 반환 |
| `NOT_FOUND` | update/delete 대상 행 없음 | 즉시 실패 반환 |
| `DB_ERROR` | 그 외 (연결 끊김 등) | backend-agent 재시도 정책 따름 |

---

## 체크리스트

- [ ] resources → characters → scenarios → naming → contents → videos 순서 준수
- [ ] resources.status가 analyzing → analyzed → completed(또는 failed)로 정확히 전이하는가
- [ ] characters 저장 시 1순위를 selected: true로 표시했는가
- [ ] metadata, acts는 JSONB, product_names/content_names는 text[]로 저장했는가
- [ ] 실패 시 hard delete 하지 않고 status만 "failed"로 변경했는가
- [ ] generation_logs는 database-agent가 아니라 backend-agent가 기록 주체인가 (역할 분리)
- [ ] 필터 조회 시 metadata JSONB 필드에 `.contains()` 사용했는가

---

✅ **완성! routes/resources.js(저장), routes/admin.js(수정), routes/generation.js(전체 파이프라인 저장)에서 이 인터페이스를 사용합니다.**
