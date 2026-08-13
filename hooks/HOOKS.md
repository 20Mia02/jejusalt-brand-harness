# Harness Hook 시스템 (검증 & 검토 체크포인트)

**버전**: v1.0 (2026.08.13)  
**목표**: 9단계 파이프라인에서 마케터의 개입 지점을 명확히 정의

---

## 📌 Hook이란?

**Hook** = **Checkpoint** = **승인 지점** 

AI가 생성한 결과를 마케터가 확인하고, 진행/수정/반려를 결정하는 지점입니다.

---

## 🎯 9단계 파이프라인과 Hook 매핑

```
Step 1: 자료 분석                 (자동 - AI만 함)
   ↓
Step 2: 캐릭터 선택               (자동 - AI가 3개 추천)
   ↓
Step 3: 캐릭터 설계               (AI 생성)
   ↓ 🎣 HOOK 1️⃣ (/api/generate/:rid/character/confirm)
   ↓ [마케터 검토/수정] → 확정
   ↓
   ↓ (template_select 화면 → AI 추천 or 직접 작성 선택)
Step 4: 시나리오 작성             (AI 생성)
   ↓ 🎣 HOOK 2️⃣ (/api/generate/:rid/scenario/:sid/confirm)
   ↓ [마케터 검토/수정] → 확정
   ↓
Step 5: 영상 제목 생성            (AI 생성)
   ↓ 🎣 HOOK 3️⃣ (/api/generate/:rid/naming/confirm)
   ↓ [마케터 선택 (3개 중)] → 결정
   ↓
Step 6: 카피 작성                 (AI 생성)
   ↓ 🎣 HOOK 4️⃣ (/api/generate/:rid/copy/:cid/confirm)
   ↓ [마케터 검토/수정] → 확정
   ↓
Step 7: 컴플라이언스 검토         (자동 - 규칙 기반)
   ├─ APPROVED    → Step 8로 진행
   ├─ WARNING     → 수정 후 재검토
   └─ REJECTED    → Step 6으로 돌아가기
   ↓
Step 8: 영상 생성                 (자동 - Higgsfield)
   ↓
Step 9: 품질 검사                 (자동 + 수동)
   ├─ Phase 1: 자동 검증 (금지 키워드 스캔)
   ├─ Phase 2: 수동 검증 (마케터 체크리스트)
   └─ Phase 3: 최종 판정 (PASS/WARNING/REJECTED)
   ↓
   ✅ 완료 또는 → 재작업
```
※ 실제 구현에서는 Step4(캐릭터 설계) → Hook1 → template_select → Step5(시나리오) 순서로 진행되며,
  HOOKS.md의 Step 번호는 구현과 1단계 차이가 있습니다 (이 문서는 개념적 개요임).

---

## 🎣 4개 Hook 상세 정의

### Hook 1️⃣: Step 4 → template_select (캐릭터 설계 승인)

**타이밍**: Step 4 (캐릭터 설계, character-designer-agent) 완료 후

**AI가 제공하는 것**:
```json
{
  "character_name": "결이",
  "personality": "꿈과 희망으로 가득 찬 당찬 소년",
  "appearance": "작은 소금 결정 형태, 밝은 흰색",
  "voice_tone": "희망적이고 정직함",
  "key_phrases": ["우리 함께라면", "작지만 중요함"]
}
```

**마케터가 할 일**:
```
□ 캐릭터가 브랜드 원칙(brand-voice.md)과 일치하는가?
□ 성격 & 외형이 타겟(40~60대 여성)에 맞는가?
□ 말투가 제주 방언/톤을 반영했는가?
□ 기타 피드백: _______________

선택:
○ 승인 → Step 4 진행
○ 수정 필요 → AI에게 피드백 (다시 생성)
○ 반려 → Step 2로 돌아가서 다른 캐릭터 선택
```

**Hook 처리**:
- ✅ 승인 → Step 4로 자동 진행
- ⚠️ 수정 필요 → callAgent()에 피드백 전달 → 재생성 → Hook 1 재진행
- ❌ 반려 → 다른 캐릭터 선택 후 Step 3 재시작

---

### Hook 2️⃣: Step 5 → Step 6 (시나리오 승인)

**타이밍**: Step 5 (shortform-scenario-writer-agent, 시나리오 작성) 완료 후

**AI가 제공하는 것**:
```json
{
  "title": "제주 바다의 결정",
  "story": "제주 바다에서 태어난 작은 결정들의 이야기...",
  "acts": [
    {"duration": 5, "description": "오프닝: 제주 바다 장면"},
    {"duration": 5, "description": "메인: 결이의 여정"},
    {"duration": 5, "description": "클로징: 밥상 위의 소금"}
  ],
  "total_duration": 15
}
```

**마케터가 할 일**:
```
□ 시나리오가 제품(제주소금)을 잘 표현하는가?
□ 길이(15초)가 적절한가?
□ 각 Act가 자연스럽게 연결되는가?
□ brand-voice 3원칙을 따르는가?
   □ 정직하게, 과장 없이
   □ 제주와 기술의 만남
   □ 일상 속 소소한 함께함
□ 기타 피드백: _______________

선택:
○ 승인 → Step 5 진행
○ 수정 필요 → AI에게 피드백 (재작성)
○ 반려 → Step 3으로 돌아가서 캐릭터 변경
```

---

### Hook 3️⃣: Step 6 → Step 7 (영상 제목 선택)

**타이밍**: Step 6 (naming-generator-agent, 영상 제목 생성) 완료 후

**AI가 제공하는 것**:
```json
{
  "candidates": [
    {
      "title": "제주 바다의 결정",
      "meaning": "자연과 인간이 만드는 작은 기적",
      "score": 9.2
    },
    {
      "title": "소금 한 알의 이야기",
      "meaning": "소수자의 가치를 담다",
      "score": 8.7
    },
    {
      "title": "밥상 위의 제주",
      "meaning": "일상이 되는 특별함",
      "score": 8.4
    }
  ]
}
```

**마케터가 할 일**:
```
□ 3개 제목 중 가장 좋은 것은?

선택:
○ 제목 1 선택 → Step 6 진행
○ 제목 2 선택 → Step 6 진행
○ 제목 3 선택 → Step 6 진행
○ 모두 마음에 안 듦 → Step 5 재시작
```

---

### Hook 4️⃣: Step 7 → Step 8 (카피 승인)

**타이밍**: Step 7 (product-intro-writer-agent / product-detail-page-writer-agent, 카피 작성) 완료 후

**AI가 제공하는 것**:
```
제목: "제주 바다의 결정"

카피:
"제주의 용암해수에서 탄생한 소금입니다.
70년 기술력으로 조절된 나트륨·마그네슘 비율.
밥상 위의 작은 결정이, 우리 가족의 맛을 더합니다."
```

**마케터가 할 일**:
```
□ 카피가 brand-voice를 따르는가?
□ 의약품 표현이 없는가? (치료, 예방 등)
□ 과장이 없는가?
□ 제주와 기술력이 균형있게 표현되었는가?
□ 40~60대 타겟이 공감할 언어인가?
□ 기타 피드백: _______________

선택:
○ 승인 → Step 8 (컴플라이언스 검토)로 진행
○ 수정 필요 → AI에게 피드백 (재작성) → Hook 4 재진행
○ 반려 → Step 5로 돌아가서 시나리오 변경
```

---

## 🔄 Hook 처리 로직

### 1. 승인 (Approve)
```
마케터: "OK, 진행"
↓
시스템: callAgent() 결과 저장 → 다음 Step 자동 진행
↓
로그: generation_logs 테이블에 "APPROVED_BY_MARKETER" 기록
```

### 2. 수정 필요 (Request Changes)
```
마케터: "이 부분 수정해줘: ___"
↓
시스템: 피드백 + 기존 결과를 callAgent()에 전달
↓
AI: "피드백을 받았습니다. 수정하겠습니다."
↓
생성: 수정된 결과 반환
↓
Hook 재진행: 마케터가 다시 검토
```

### 3. 반려 (Reject)
```
마케터: "이건 마음에 안 들어. 처음부터 다시."
↓
시스템: 이전 Step으로 롤백
↓
AI: 완전히 새로운 접근으로 재시작
```

---

## 📊 Hook 통계

| Hook | Step | 유형 | 소요 시간 |
|------|------|------|---------|
| Hook 1️⃣ | 4→template_select | 검토/확정 | 3분 |
| Hook 2️⃣ | 5→6 | 검토/확정 | 5분 |
| Hook 3️⃣ | 6→7 | 선택 | 2분 |
| Hook 4️⃣ | 7→8 | 검토/확정 | 3분 |
| **합계** | - | - | **13분** |

---

## 🎯 Hook 시스템의 역할

### Hook 없으면:
```
자료 입력 → AI가 자동으로 생성 → 영상 완성
❌ 마케터 의도 반영 불가
❌ 품질 보증 불가
❌ 브랜드 정체성 유지 불가
```

### Hook 있으면:
```
자료 입력 → Step 1,2 자동 → Hook 1️⃣ (마케터 OK?)
           → Step 3,4 자동 → Hook 2️⃣ (마케터 OK?)
           → Step 5 자동   → Hook 3️⃣ (마케터 선택)
           → Step 6 자동   → Hook 4️⃣ (마케터 OK?)
           → Step 7,8,9 자동 → 완성!
✅ 마케터가 4번 개입 (총 13분)
✅ 품질 보증
✅ 브랜드 정체성 유지
```

---

## 💻 Hook 구현 (Backend)

### Hook 1~4 처리 함수

```javascript
// implementation/backend/routes/generation.js

// Hook 1: 캐릭터 승인
POST /api/hook/character-approval
{
  "generation_id": "gen_12345",
  "character_id": "char_001",
  "status": "approve" | "request_changes" | "reject",
  "feedback": "이 부분을 수정해주세요..."
}

// Hook 2: 시나리오 승인
POST /api/hook/scenario-approval
{
  "generation_id": "gen_12345",
  "scenario_id": "scen_001",
  "status": "approve" | "request_changes" | "reject",
  "feedback": "..."
}

// Hook 3: 제목 선택
POST /api/hook/title-selection
{
  "generation_id": "gen_12345",
  "selected_title_index": 0,  // 3개 중 선택
  "status": "approve"
}

// Hook 4: 카피 승인
POST /api/hook/copy-approval
{
  "generation_id": "gen_12345",
  "copy_id": "copy_001",
  "status": "approve" | "request_changes" | "reject",
  "feedback": "..."
}
```

---

## 📝 Hook 처리 기록

모든 Hook 승인/거부는 `generation_logs` 테이블에 기록됨:

```json
{
  "generation_id": "gen_12345",
  "step": 3,
  "hook": 1,
  "action": "character_approval",
  "status": "APPROVED",
  "marketer": "park-joomi",
  "feedback": null,
  "timestamp": "2026-08-13T10:30:00Z"
}
```

---

## ✅ 적용 체크리스트

- [ ] orchestrator.md의 모든 Hook 구현됨
- [ ] 각 Hook별 마케터 체크리스트 준비됨
- [ ] Hook 거부 시 롤백 로직 구현됨
- [ ] Hook 기록이 generation_logs에 저장됨
- [ ] Hook UI가 프론트엔드에 표시됨
- [ ] Hook 타이미로운 통보 시스템 구현됨 (이메일, 슬랙 등)

