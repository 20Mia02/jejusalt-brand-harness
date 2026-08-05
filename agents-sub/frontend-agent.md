# frontend-agent (프론트엔드 상태 관리 에이전트)

## 📌 목적

제주소금 웹앱의 **UI 상태를 자동으로 업데이트**하는 에이전트로서:
1. **백엔드/DB의 최신 상태를 주기적으로 확인** (폴링)
2. **컴포넌트별 UI 상태 업데이트** (로딩/성공/에러 반영)
3. **Higgsfield 영상 생성 진행률(%)을 실시간으로 표시**
4. **에러 발생 시 사용자 친화적 메시지로 변환해서 표시**

---

## 🔄 전체 프로세스 흐름

```
백엔드 처리 시작 (예: "AI 생성" 버튼 클릭 → 영상 생성 요청)
        ↓
[Agent Step 1]
componentId + status 수신
  - 어느 UI 컴포넌트를 업데이트할지 확인
  - 현재 상태(loading/success/error) 확인
        ↓
[Agent Step 2]
5초 간격으로 최신 상태 폴링
  - videos 테이블의 generation_progress, generation_status 확인
  - 0% → 25% → 50% → 75% → 100% 순차 업데이트
        ↓
[Agent Step 3]
상태별 UI 렌더링
  - loading: 진행률 바 + "생성 중... (N%)"
  - success: 완료 메시지 + 결과(영상 등) 표시
  - error: 사용자 친화적 에러 메시지 + 재시도 버튼
        ↓
[Agent Step 4]
에러 발생 시 → 친화적 메시지로 변환
        ↓
[Agent Output]
  → rendered: true 반환 (화면 업데이트 완료)
```

---

## 📋 Agent 작업 상세

### Step 1: 입력 수신 및 검증

**입력**:
```json
{
  "componentId": "video-generation-progress",
  "newData": { "generation_progress": 45, "video_url": null },
  "status": "loading"
}
```

**검증**:
- `componentId`, `status`가 없으면 에러 처리
- `status`는 `loading` / `success` / `error` 중 하나여야 함

### Step 2: Higgsfield 진행률 실시간 폴링 (5초 간격)

- **5초마다** 자동으로 현재 진행 상태를 다시 확인
- Day2 통합계획의 `videos` 테이블 필드를 그대로 사용:
  - `generation_progress` (0~100)
  - `generation_status` (`created` / `processing` / `completed` / `failed` 등)
  - `video_url`, `thumbnail_url`
- `generation_status`가 `completed` 또는 `failed`가 될 때까지 반복
- 완료되거나 실패하면 폴링 자동 중단

### Step 3: 상태별 UI 렌더링

| status | 화면에 보여줄 것 |
|---|---|
| `loading` | 진행률 바 + "생성 중... (N%)" 문구 |
| `success` | "✅ 생성 완료!" + 영상 재생/다운로드 UI |
| `error` | 사용자 친화적 에러 메시지 + 🔄 재시도 버튼 |

### Step 4: 에러 메시지를 사용자 친화적으로 변환

내부 에러 상황을 그대로 노출하지 않고, 사용자가 이해할 수 있는 문구로 바꿔서 보여줍니다.

| 내부 에러 상황 | 사용자에게 보여줄 문구 |
|---|---|
| 응답 지연/타임아웃 | "생성 시간이 너무 오래 걸리고 있어요. 다시 시도해주세요." |
| 영상 생성 서버 오류 | "영상 생성 서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해주세요." |
| 네트워크 문제 | "네트워크 연결을 확인해주세요." |
| 그 외 알 수 없는 오류 | "일시적인 오류가 발생했어요. 다시 시도해주세요." |

---

## 📤 Agent Output (완전)

```json
{
  "agent": "frontend-agent",
  "status": "completed",
  "timestamp": "2026-08-04T14:20:00Z",
  "componentId": "video-generation-progress",
  "rendered": true,
  "displayed_state": {
    "current_status": "loading",
    "progress": 45,
    "message": "생성 중... (45%)"
  },
  "polling_info": {
    "interval_seconds": 5,
    "polling_active": true,
    "source_table": "videos",
    "watched_fields": ["generation_progress", "generation_status", "video_url", "thumbnail_url"]
  }
}
```

### 완료 시 출력 예시
```json
{
  "agent": "frontend-agent",
  "status": "completed",
  "componentId": "video-generation-progress",
  "rendered": true,
  "displayed_state": {
    "current_status": "success",
    "progress": 100,
    "message": "✅ 생성 완료!",
    "video_url": "https://higgsfield.ai/videos/abc123.mp4"
  },
  "polling_info": {
    "polling_active": false
  }
}
```

### 에러 시 출력 예시
```json
{
  "agent": "frontend-agent",
  "status": "completed",
  "componentId": "video-generation-progress",
  "rendered": true,
  "displayed_state": {
    "current_status": "error",
    "message": "생성 시간이 너무 오래 걸리고 있어요. 다시 시도해주세요.",
    "show_retry_button": true
  },
  "polling_info": {
    "polling_active": false
  }
}
```

---

## 🛡️ 에러 처리

**에러 1: 필수 입력 누락**
```
componentId 또는 status가 없음
  ↓
Agent: 업데이트 취소, 에러 로그만 남김 (화면에는 이전 상태 유지)
```

**에러 2: 상태 조회 실패 (네트워크/DB 문제)**
```
폴링 중 상태 조회 실패
  ↓
Agent: "네트워크 연결을 확인해주세요" 표시
  ↓
폴링은 중단하지 않고 다음 5초 주기에 재시도
```

**에러 3: 영상 생성 자체가 실패 (generation_status = "failed")**
```
generation_status: "failed" 수신
  ↓
Agent: 폴링 중단
  ↓
"영상 생성 서버에 일시적인 문제가 있어요" 표시 + 재시도 버튼 노출
```

---

## ✅ 역할 및 책임

| 책임 | 구현 |
|------|------|
| UI 상태 자동 업데이트 | ✅ componentId 기준으로 화면 갱신 |
| Higgsfield 진행률 실시간 표시 | ✅ 5초 간격 폴링, 0~100% 순차 표시 |
| 에러 메시지 사용자 친화적 처리 | ✅ 내부 에러 → 이해하기 쉬운 문구로 변환 |
| 폴링 자동 종료 | ✅ completed / failed 시 중단 |
| 로딩 중 중복 요청 방지 | ✅ 로딩 중 다른 액션 비활성화 |

---

## 📋 관련 연결

- **입력 출처**: Day2 통합계획서 기준 `videos` 테이블 (`generation_progress`, `generation_status`, `video_url`, `thumbnail_url`)
- **관련 Agent/Skill**: shortform-scenario-writer-agent, naming-generator-agent (진행 상황을 화면에 반영하는 대상)
- **다음 단계**: 사용자가 영상 URL을 최종 확인 → 통합테스트 체크리스트 9~10번 항목 확인용 UI로 사용

---

**완성! 이 파일을 agents-sub/frontend-agent.md로 저장해주세요.**
