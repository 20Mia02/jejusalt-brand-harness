# backend-agent.md

## 1. 역할 (Role)

**TimelyAI와 Higgsfield API를 중개하는 백엔드 자동화 에이전트**

- TimelyAI의 8개 Sub-Agent를 호출
- 각 Agent 호출 결과를 검증
- Higgsfield 영상 생성 요청 및 진행률 폴링
- generation_logs에 모든 단계 기록

---

## 2. TimelyAI Agent 호출 (callAgent)

### 2-1. 함수 목적
TimelyAI의 Sub-Agent를 호출하고, 실패 시 자동 재시도

### 2-2. 입력 (Input)
```
agentName: string
  - "resource-analyzer-agent"
  - "character-generator-agent"
  - "product-intro-writer-agent"
  - "product-detail-page-writer-agent"
  - "compliance-reviewer-agent"
  - "character-designer-agent"
  - "shortform-scenario-writer-agent"
  - "naming-generator-agent"

payload: object
  - Agent별 고유 입력값

context: object
  - resourceId: UUID (generation_logs 연결용)
  - step: string (단계명)
```

### 2-3. 처리 로직

#### 재시도 전략
```
최대 시도: 3회
대기 시간: 지수백오프
  - 1차 실패 → 1초 대기 후 재시도
  - 2차 실패 → 2초 대기 후 재시도
  - 3차 실패 → 종료

타임아웃: 60초 (TimelyAI)
```

#### 에러 분류
```
TIMEOUT
  - Agent가 60초 이상 걸림
  - 처리: 자동 재시도

NETWORK_ERROR
  - 네트워크 연결 실패
  - 처리: 자동 재시도

AUTH_ERROR
  - API 키 잘못됨 (401/403)
  - 처리: 즉시 실패 (재시도 X)

RATE_LIMIT
  - 요청 한도 초과 (429)
  - 처리: 자동 재시도

UNKNOWN_ERROR
  - 그 외 에러
  - 처리: 자동 재시도
```

### 2-4. 출력 (Output)
```
성공 시:
{
  success: true,
  data: { ... Agent 결과물 ... },
  duration: 1240,  // 밀리초
  attempt: 1       // 시도 횟수
}

실패 시:
{
  success: false,
  error: "TIMEOUT|NETWORK_ERROR|AUTH_ERROR|...",
  message: "상세 에러 메시지",
  duration: 65000,
  attempt: 3
}
```

### 2-5. generation_logs 기록
```
각 callAgent() 호출 후:
INSERT INTO generation_logs (
  resource_id,
  step,
  status,        // "success" | "fail"
  error_message, // null 또는 에러 메시지
  duration_ms,   // 소요 시간
  attempt        // 시도 횟수
)
```

---

## 3. Higgsfield 영상 생성 (callHiggsfield)

### 3-1. 함수 목적
Higgsfield API를 호출하여 영상 생성 요청

### 3-2. 입력 (Input)
```
videoConfig: object
  - character: string (캐릭터명)
  - generatedContent: string (생성된 카피)
  - voiceTone: string (목소리 톤)
  - duration: number (120초)

resourceId: UUID (generation_logs 연결용)
```

### 3-3. 처리 로직

#### Higgsfield API 호출
```
POST https://api.higgsfield.ai/v1/videos
{
  character: "용암이",
  script: "생성된 카피 텍스트...",
  voiceTone: "따뜻한 아버지 목소리",
  duration: 120
}
```

#### videos 테이블 저장
```
INSERT INTO videos (
  resource_id,
  higgsfield_id,       // Higgsfield에서 반환
  generation_status,   // "processing"
  generation_progress, // 0
  generation_start_time // NOW()
)
```

### 3-4. 출력 (Output)
```
성공 시:
{
  success: true,
  data: {
    higgsfield_id: "abc123",
    video_url: null,           // 생성 중이므로 null
    generation_status: "processing",
    generation_progress: 0
  }
}

실패 시:
{
  success: false,
  error: "NETWORK_ERROR|...",
  message: "상세 에러 메시지"
}
```

### 3-5. generation_logs 기록
```
각 callHiggsfield() 호출 후:
INSERT INTO generation_logs (
  resource_id,
  step: "higgsfield-generation",
  status: "success" | "fail",
  error_message: null | "에러메시지",
  duration_ms,
  attempt: 1
)
```

---

## 4. Higgsfield 폴링 (pollHiggsfield)

### 4-1. 함수 목적
Higgsfield 영상 생성 진행률을 모니터링하고, videos 테이블 업데이트

### 4-2. 입력 (Input)
```
higgsfieldId: string (Higgsfield 작업 ID)
videoRowId: UUID (videos 테이블 row ID)
```

### 4-3. 처리 로직

#### 폴링 간격
```
간격: 5초 (5000ms)
최대 시간: 10분 (600000ms)
```

#### 각 폴링 단계
```
GET https://api.higgsfield.ai/v1/videos/{higgsfieldId}
응답:
{
  status: "processing" | "completed" | "failed",
  generation_progress: 0 | 25 | 50 | 75 | 100,
  video_url: "https://..." | null
}

↓

videos 테이블 업데이트:
UPDATE videos SET
  generation_progress = 응답의 generation_progress,
  generation_status = 응답의 status,
  video_url = 응답의 video_url (있으면),
  generation_end_time = NOW() (완료 시)
WHERE id = videoRowId
```

#### 종료 조건
```
1. status = "completed" → 성공 반환
2. status = "failed" → 실패 반환
3. 10분 이상 → 타임아웃 반환
```

### 4-4. 출력 (Output)
```
성공 시:
{
  success: true,
  generation_progress: 100,
  generation_status: "completed",
  video_url: "https://..."
}

실패 시:
{
  success: false,
  error: "TIMEOUT|...",
  message: "에러 메시지"
}
```

---

## 5. 에러 처리 전략

### 5-1. Step별 에러 처리

```
Step 2 (resource-analyzer) 실패
  → resources.status = "failed"
  → 사용자 응답: "분석 실패"
  → 계속 진행 X (종료)

Step 3 (character-generator) 실패
  → resources.status = "failed"
  → 사용자 응답: "캐릭터 생성 실패"
  → 계속 진행 X (종료)

Step 7 (product-intro-writer) 실패
  → 사용자 응답: "콘텐츠 생성 실패"
  → 계속 진행 X (종료)

Step 8 (compliance-reviewer) 실패
  → 사용자 응답: "검증 실패"
  → 계속 진행 X (종료)

Step 9 (Higgsfield) 실패
  → 사용자 응답: "영상 생성 요청 실패"
  → 계속 진행 X (종료)
```

### 5-2. 재시도 정책
```
TimelyAI Agent 호출 실패 (Step 2~8)
  → 자동 재시도 (3회, 지수백오프)
  → 3회 모두 실패 → 최종 실패 반환

Higgsfield 호출 실패 (Step 9)
  → 재시도 없음 (즉시 실패 반환)
  
Higgsfield 폴링 실패
  → 5초마다 재시도 (최대 10분)
  → 10분 이상 → 타임아웃 반환
```

---

## 6. generation_logs 기록

### 6-1. 기록 주체
**backend-agent가 각 Agent 호출 후 기록**

### 6-2. 기록 내용
```
INSERT INTO generation_logs (
  resource_id,    // 자료 UUID
  step,           // "resource-analyzer" | "character-generator" | ...
  status,         // "success" | "fail"
  error_message,  // null 또는 에러 메시지
  duration_ms,    // 소요 시간 (밀리초)
  attempt         // 시도 횟수 (1~3)
)
```

### 6-3. 기록 타이밍
```
Step 2~8: 각 Agent 호출 후 즉시 기록
Step 9: Higgsfield 호출 후 즉시 기록
Higgsfield 폴링: 완료/타임아웃 후 기록
```

---

## 7. 필드명 일관성

### 7-1. Higgsfield 응답 필드명
```
❌ status
✅ generation_status (DB 테이블 컬럼명)

❌ progress
✅ generation_progress (DB 테이블 컬럼명)

❌ videoUrl
✅ video_url (snake_case)
```

### 7-2. API 응답 필드명
```
POST /api/generate 응답:
{
  success: true,
  higgsfieldId: "abc123",
  generationStatus: "processing",
  generationProgress: 0,
  videoUrl: null
}
```

---

## 8. 요약 (Summary)

| 기능 | 입력 | 처리 | 출력 |
|------|------|------|------|
| **callAgent** | agentName, payload | TimelyAI 호출 (재시도 3회) | {success, data} |
| **callHiggsfield** | videoConfig | Higgsfield 호출 + videos 저장 | {success, higgsfieldId} |
| **pollHiggsfield** | higgsfieldId | 5초마다 진행률 조회 + 업데이트 | {success, progress, status, videoUrl} |

---

## 9. 참고 사항

- TimelyAI 타임아웃: 60초
- Higgsfield API 호출: 30초 타임아웃
- 폴링 최대 시간: 10분
- generation_logs는 database-agent가 아니라 **backend-agent가 기록**
- FK 순서는 database-agent가 보장
