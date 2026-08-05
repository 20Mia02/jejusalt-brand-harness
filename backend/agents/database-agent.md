# database-agent.md

## 1. 역할 (Role)

**Supabase(PostgreSQL)와의 모든 CRUD를 담당하는 데이터베이스 에이전트**

- 7개 테이블의 모든 쓰기/읽기 작업
- 저장 순서 보장 (FK 위반 방지)
- 에러 분류 및 처리
- 롤백 정책 (hard delete 금지)

---

## 2. 통합 CRUD 함수 (callDatabase)

### 2-1. 함수 목적
Supabase의 모든 데이터베이스 작업을 단일 인터페이스로 처리

### 2-2. 입력 (Input)
```
table: string
  - "resources"
  - "characters"
  - "scenarios"
  - "naming"
  - "contents"
  - "videos"
  - "generation_logs"

operation: string
  - "create" (INSERT)
  - "read" (SELECT)
  - "update" (UPDATE)
  - "delete" (DELETE)

data: object (create/update 시 필수)
  - {product_name: "...", metadata: {...}, ...}

filter: object (read/update/delete 시 필수)
  - {id: "uuid"}
  - {resource_id: "uuid", selected: true}
```

### 2-3. 출력 (Output)
```
성공 시:
{
  success: true,
  rows: [...]  // INSERT/UPDATE/DELETE한 행들
}

실패 시:
{
  success: false,
  error: "FK_VIOLATION|NOT_FOUND|VALIDATION_ERROR|...",
  message: "상세 에러 메시지",
  rows: []
}
```

### 2-4. 작업별 상세

#### CREATE (삽입)
```
입력:
callDatabase("resources", "create", {
  product_name: "제주용암프리미엄솔트",
  product_info: "...",
  metadata: {...}
})

처리: INSERT INTO resources (...)

출력:
{
  success: true,
  rows: [{id: "uuid", product_name: "...", ...}]
}
```

#### READ (조회)
```
입력:
callDatabase("resources", "read", null, {
  id: "uuid"
})

처리: SELECT * FROM resources WHERE id = "uuid"
     ORDER BY created_at DESC

출력:
{
  success: true,
  rows: [{...}, {...}, ...]
}
```

#### UPDATE (수정)
```
입력:
callDatabase("resources", "update", 
  {metadata: {...}, status: "completed"},
  {id: "uuid"}
)

처리: UPDATE resources SET metadata=..., status=... 
     WHERE id = "uuid"

출력:
{
  success: true,
  rows: [{id: "uuid", metadata: {...}, ...}]
}

실패 시 (해당 행이 없음):
{
  success: false,
  error: "NOT_FOUND",
  message: "업데이트할 행이 없습니다",
  rows: []
}
```

#### DELETE (삭제)
```
입력:
callDatabase("characters", "delete", null, {
  id: "uuid"
})

처리: DELETE FROM characters WHERE id = "uuid"

출력:
{
  success: true,
  rows: [{id: "uuid", ...}]  // 삭제한 행
}

주의: hard delete (복구 불가)
```

---

## 3. 저장 순서 보장 (매우 중요!)

### 3-1. 필수 순서
```
1️⃣ resources 생성
   INSERT INTO resources (product_name, product_info, metadata, ...)

2️⃣ resources 메타데이터 업데이트
   UPDATE resources SET metadata = {...}, status = "analyzed"

3️⃣ characters 저장 (1순위부터)
   INSERT INTO characters (resource_id, name, selected=true, ...)

4️⃣ scenarios 저장
   INSERT INTO scenarios (resource_id, character_id, ...)

5️⃣ naming 저장
   INSERT INTO naming (resource_id, ...)

6️⃣ contents 저장
   INSERT INTO contents (resource_id, ...)

7️⃣ videos 저장
   INSERT INTO videos (resource_id, ...)

8️⃣ resources 최종 상태 업데이트
   UPDATE resources SET status = "completed"
```

### 3-2. 왜 순서가 중요한가?

**FK(Foreign Key) 제약**
```
❌ characters를 resources 이전에 생성
   → FK 위반 에러 (resource_id가 존재하지 않음)

✅ resources 생성 → characters 생성
   → 정상 작동
```

### 3-3. 각 테이블의 FK
```
characters → resources (resource_id)
scenarios → resources (resource_id)
scenarios → characters (character_id)
naming → resources (resource_id)
contents → resources (resource_id)
videos → resources (resource_id)
generation_logs → resources (resource_id)
```

---

## 4. 에러 분류 (errorCode별)

### 4-1. FK_VIOLATION (23503)
```
원인: 참조하는 부모 행이 없음
예시: characters를 resources 이전에 생성
해결: 저장 순서 확인 후 재시도
```

### 4-2. VALIDATION_ERROR (23502)
```
원인: NOT NULL 필드가 비워져 있음
예시: product_name = null인 resources 생성
해결: 필수 필드 확인 후 재시도
```

### 4-3. UNIQUE_VIOLATION (23505)
```
원인: Unique 제약 위반 (중복)
해결: 중복 값 제거 후 재시도
```

### 4-4. NOT_FOUND
```
원인: UPDATE/DELETE할 행이 없음
예시: 존재하지 않는 UUID 업데이트
해결: ID 확인 후 재시도
```

### 4-5. DB_ERROR
```
원인: 그 외 데이터베이스 에러
해결: 로그 확인 후 원인 파악
```

---

## 5. 전체 저장 파이프라인 (saveFullPipeline)

### 5-1. 함수 목적
8개 단계의 저장을 자동으로 순서대로 처리하고, 실패 시 롤백

### 5-2. 입력
```
pipelineData: {
  productName: "...",
  productInfo: "...",
  metadata: {...},
  characters: [{name, score, ...}, ...],
  scenario: {title, acts, ...},
  naming: {product_names, content_names},
  contents: {content_type, generated_content, ...},
  videos: {higgsfield_id, ...}
}
```

### 5-3. 처리 흐름
```
Step 1: resources 생성
  IF 실패 → 종료, 에러 반환
  
Step 2: metadata 업데이트
  IF 실패 → 종료, 에러 반환
  
Step 3: characters 저장
  IF 실패 → 종료, 에러 반환
  
Step 4: scenarios 저장
  IF 실패 → 종료, 에러 반환
  
Step 5: naming 저장
  IF 실패 → 종료, 에러 반환
  
Step 6: contents 저장
  IF 실패 → 종료, 에러 반환
  
Step 7: videos 저장
  IF 실패 → 종료, 에러 반환
  
Step 8: resources 최종 상태 = "completed"
  완료!
```

### 5-4. 실패 시 처리
```
어느 단계든 실패 시:
1. 해당 step에서 멈춤
2. resources.status = "failed" 로 표시
3. 생성된 데이터는 보존 (디버깅용)
4. 에러 메시지와 함께 반환
```

### 5-5. 출력
```
성공:
{
  success: true,
  resourceId: "uuid",
  message: "모든 데이터가 정상적으로 저장되었습니다"
}

실패:
{
  success: false,
  error: "FK_VIOLATION | VALIDATION_ERROR | ...",
  message: "파이프라인 저장 중 오류가 발생했습니다"
}
```

---

## 6. 필터링 (getResourcesByFilter)

### 6-1. 함수 목적
metadata의 JSONB 필드를 기반으로 동적 필터링

### 6-2. 입력
```
filters: {
  categories: ["식품", "헬스케어"],
  ageGroups: ["40~60대"],
  targets: ["가족밥상"],
  videoTypes: [...]
}
```

### 6-3. 처리 로직
```
SELECT * FROM resources
WHERE status = "completed"
  AND metadata->>'categories' LIKE '%식품%'
  AND metadata->>'ageGroups' LIKE '%40~60대%'
  AND metadata->>'targets' LIKE '%가족밥상%'
ORDER BY created_at DESC
```

### 6-4. 출력
```
{
  success: true,
  rows: [
    {
      id: "uuid",
      product_name: "...",
      metadata: {categories: [...], ageGroups: [...], ...},
      ...
    },
    ...
  ]
}
```

---

## 7. 롤백 정책

### 7-1. Hard Delete 금지
```
❌ DELETE FROM resources WHERE id = "uuid"

✅ UPDATE resources SET status = "failed"
```

### 7-2. 이유
```
- 데이터 복구 가능성 (디버깅)
- 감사 추적 (audit trail)
- 실수에 대한 보호
```

### 7-3. Status 변경으로 논리적 삭제
```
생성됨: status = "created"
분석됨: status = "analyzed"
실패: status = "failed"
완료: status = "completed"
```

---

## 8. 필드명 일관성

### 8-1. Snake Case 사용
```
✅ generation_status (DB 컬럼명)
❌ generationStatus

✅ generation_progress
❌ generationProgress

✅ video_url
❌ videoUrl
```

### 8-2. JSONB 필드
```
resources.metadata:
{
  "categories": ["식품"],
  "ageGroups": ["40~60대"],
  "targets": ["가족밥상"],
  "focus": ["신뢰", "건강"],
  "confidence": 0.96
}

characters.personality_traits:
["따뜨함", "신뢰", "보호본능"]
```

---

## 9. 에러 처리 전략

### 9-1. 재시도 정책
```
FK_VIOLATION
  → 저장 순서 확인 필요
  → 재시도 X (구조적 문제)

VALIDATION_ERROR
  → 입력값 검증 필요
  → 재시도 X (데이터 문제)

NOT_FOUND
  → ID 확인 필요
  → 재시도 X (존재하지 않는 행)

DB_ERROR
  → 로그 확인 후 원인 파악
  → 재시도 가능 (일시적 오류일 수 있음)
```

### 9-2. 사용자 메시지
```
백엔드 로그: 상세한 에러 내용
사용자 응답: 친화적 메시지만

예:
백엔드: "FK_VIOLATION: resource_id=uuid가 존재하지 않음"
사용자: "자료 저장에 실패했습니다. 관리자에게 문의하세요."
```

---

## 10. 요약 (Summary)

| 함수 | 목적 | 입력 | 출력 |
|------|------|------|------|
| **callDatabase** | CRUD 통합 | table, operation, data, filter | {success, rows} |
| **saveFullPipeline** | 전체 저장 | pipelineData | {success, resourceId} |
| **getResourcesByFilter** | 필터링 | filters | {success, rows} |

---

## 11. 참고 사항

- **저장 순서**: 절대 변경 금지 (FK 위반)
- **Hard Delete**: 금지 (soft delete 사용)
- **generation_logs**: backend-agent가 기록 (database-agent X)
- **JSONB**: Supabase가 자동 변환 (JSON.stringify 불필요)
- **에러 분류**: DB 에러코드(23503 등)로 판단
