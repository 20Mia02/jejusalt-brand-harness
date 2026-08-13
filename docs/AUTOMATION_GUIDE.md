# 반복 작업 자동화 가이드 (2C: Harness Engineering)

## 개요
여러 자료를 효율적으로 처리하기 위한 배치 처리 및 부분 재실행 기능입니다.

## 기능 1: 배치 처리 (Batch Processing)

### API 엔드포인트
```
POST /api/generate/batch
```

### 요청 형식
```json
{
  "resourceIds": ["resource-id-1", "resource-id-2", "resource-id-3"],
  "requestType": "intro"
}
```

### 파라미터
- `resourceIds` (배열, 필수): 생성할 자료의 ID 목록
- `requestType` (문자열, 필수): "intro", "detail", "both" 중 하나

### 응답
```json
{
  "success": true,
  "batchSize": 3,
  "results": [
    {
      "resourceId": "resource-id-1",
      "status": "queued",
      "message": "생성 큐에 추가되었습니다"
    }
  ],
  "message": "모든 자료가 생성 큐에 추가되었습니다. 진행 상황은 각 resourceId의 /status로 확인하세요"
}
```

### 사용 예시

#### Node.js
```javascript
const resources = [
  { id: "salt-product-001", name: "제주소금 프리미엄" },
  { id: "salt-product-002", name: "제주소금 클래식" },
  { id: "salt-product-003", name: "제주소금 스페셜" },
];

const resourceIds = resources.map(r => r.id);

const response = await fetch('http://localhost:5000/api/generate/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resourceIds,
    requestType: 'intro'
  })
});

const data = await response.json();
console.log(`${data.batchSize}개 자료 일괄 생성 시작`);

// 각 자료의 진행 상황 모니터링
for (const resourceId of resourceIds) {
  const status = await fetch(`http://localhost:5000/api/generate/${resourceId}/status`)
    .then(r => r.json());
  console.log(`${resourceId}: ${status.progress}% 완료`);
}
```

#### cURL
```bash
curl -X POST http://localhost:5000/api/generate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "resourceIds": ["salt-001", "salt-002", "salt-003"],
    "requestType": "intro"
  }'
```

### 특징
- **비동기 처리**: 각 자료는 독립적으로 백그라운드에서 생성됨
- **개별 모니터링**: 각 자료의 `/status` 엔드포인트로 진행 상황 확인 가능
- **실패 격리**: 한 자료의 실패가 다른 자료에 영향을 주지 않음

---

## 기능 2: 부분 재실행 (Partial Retry)

### API 엔드포인트
```
POST /api/generate/:resourceId/retry-from/:step
```

### 파라미터
- `resourceId` (경로, 필수): 재실행할 자료의 ID
- `step` (경로, 필수): 재실행 시작 단계 (4~9)
  - Step 4: character-designer-agent (캐릭터 상세 설계)
  - Step 5: shortform-scenario-writer-agent (120초 시나리오)
  - Step 6: naming-generator-agent (제품명/콘텐츠명)
  - Step 7: product-writer-agent (카피)
  - Step 8: compliance-reviewer-agent (검증)
  - Step 9: Higgsfield (영상 생성)

### 응답
```json
{
  "success": true,
  "resourceId": "salt-product-001",
  "retryFrom": 5,
  "message": "Step 5부터 재시도를 시작했습니다",
  "nextAction": "POST /api/generate/salt-product-001/start에서 계속 진행"
}
```

### 사용 예시

#### Step 5 (시나리오 작성)부터 재실행
```bash
curl -X POST http://localhost:5000/api/generate/salt-product-001/retry-from/5 \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Step 9 (영상 생성)부터 재실행 (이미지만 다시 생성)
```bash
curl -X POST http://localhost:5000/api/generate/salt-product-001/retry-from/9 \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 사용 시나리오

**시나리오 1: Step 5 실패 후 재실행**
```
1. 초기 생성: POST /api/generate/salt-001/start
   → Step 4 성공
   → Step 5 실패 (API 오류)
   → Step 5부터 재시도 필요

2. 부분 재실행: POST /api/generate/salt-001/retry-from/5
   → Step 5~9만 다시 실행
   → Step 1~4는 재실행하지 않음 (시간 절약)

3. 결과 확인: GET /api/generate/salt-001/result
```

**시나리오 2: 영상 품질 재생성**
```
1. 초기 생성 완료, 영상 생성됨
2. Higgsfield 품질 개선 후 재생성 필요

3. 부분 재실행: POST /api/generate/salt-001/retry-from/9
   → Step 9 (Higgsfield)만 재실행
   → 이전의 캐릭터 설계, 시나리오, 카피는 재사용

4. 새로운 영상 URL 반환
```

---

## 기능 3: 향상된 생성 로그 추적

### 생성 로그 스키마
```sql
CREATE TABLE generation_logs (
  id UUID PRIMARY KEY,
  resource_id UUID NOT NULL,
  step INTEGER,                    -- Step 1~9
  status TEXT,                     -- 'success', 'fail', 'retrying'
  details TEXT,                    -- 에러 메시지 또는 상세 정보
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 로그 추적 예시

#### 전체 진행 상황 조회
```bash
GET /api/generate/salt-001/status
→ progress: 45%, completedSteps: 5, totalSteps: 10
```

#### 실패 분석
```json
{
  "status": "fail",
  "step": 5,
  "details": "shortform-scenario-writer-agent: TimelyAI API timeout",
  "created_at": "2026-08-05T10:30:00Z"
}
```

#### 재시도 히스토리
```json
[
  { "step": 5, "status": "fail", "details": "API timeout" },
  { "step": 5, "status": "retrying", "details": "Step 5부터 재시도 시작" },
  { "step": 5, "status": "success", "details": "재시도 성공" }
]
```

---

## 성능 고려사항

### 배치 처리 시 권장사항
- **일괄 생성 수**: 3~5개 자료 권장 (각 자료마다 Step 4~9 진행)
- **동시 실행 제한**: 현재 무제한이지만, 서버 리소스 고려해 순차 처리 권장
- **모니터링**: 각 자료의 `/status`를 폴링하여 진행 상황 추적

### 부분 재실행 시 비용 절감
```
전체 재생성:     Step 1~9 (10~15분)
부분 재생성:     Step 5~9 (5~8분)  ← 40% 시간 단축

Step 9만 재생성: Step 9 (1~2분)     ← 90% 시간 단축
```

---

## 향후 개선 사항

1. **우선순위 큐**: 자료별 우선순위 지정 가능
2. **배치 스케줄링**: 지정된 시간에 배치 생성 시작
3. **병렬 처리**: 여러 자료를 동시에 처리 (현재는 순차)
4. **재시도 자동화**: 실패 시 자동으로 지정된 횟수만큼 재시도
5. **할당량 관리**: 일일/월간 생성 횟수 제한

---

## 주의사항

- **부분 재실행은 Step 4부터만 가능**: Step 1~3은 필터링 단계로, 이미 완료된 상태
- **무한 재시도 방지**: 최대 재시도 횟수는 `config.json`의 `generation.retryAttempts`로 설정
- **비동기 특성**: 배치 생성은 즉시 응답하지만, 실제 생성은 백그라운드에서 진행

