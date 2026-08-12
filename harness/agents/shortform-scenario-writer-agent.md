# shortform-scenario-writer-agent (숏폼 시나리오 라이터 에이전트)

## 📌 목적

TimelyAI Harness의 **두 번째 Agent**로서:
1. **character-designer-agent의 결과 받기** (최종 캐릭터 확정)
2. **SKILL_shortform-scenario-writer 호출** (스토리 자동 생성)
3. **마케터와의 검토/수정** (최대 2회 재생성)
4. **최종 승인 후 다음 Agent에 전달**

---

## 🔄 전체 프로세스 흐름

```
character-designer-agent로부터
최종 캐릭터 리스트 + 브리프 수신
        ↓
[Agent Step 1]
SKILL_shortform-scenario-writer 호출
  - 4막 구조 스토리 생성
  - 캐릭터별 대사 자동 작성
  - 결이 내레이션 생성
  - 120초 정확한 타이밍
  - Higgsfield 스펙 준비
        ↓
[Agent Step 2]
마케터에게 시나리오 제시
  - 스토리 개요 표시
  - 5개 세그먼트 상세 표시
  - 타이밍 검증 표시
  - 대사/내레이션 균형 표시
        ↓
   마케터의 선택
  ┌─────────┬─────────┐
  ↓         ↓         ↓
 승인    부분수정   전체생성
  │         │         │
  ↓         ↓         ↓
 [3]      [1]       [1]
최종    SKILL재호출  SKILL재호출
확정    (부분수정)   (새로운)
        
[최대 2회 재시도]
        ↓
[Agent Step 3]
최종 검증 & 확정
  ✓ 총 120초?
  ✓ 4막 구조?
  ✓ 캐릭터 톤?
  ✓ Higgsfield 준비?
        ↓
[Agent Output]
  → naming-generator-agent에 전달
```

---

## 📋 Agent 작업 상세

### Step 1: SKILL_shortform-scenario-writer 호출

**입력**:
```json
{
  "brief": { /* character-designer-agent에서 받은 완전한 브리프 */ },
  "final_characters": [ /* 최종 확정된 캐릭터 */ ],
  "scenario_context": "마케터가 선택한 콘텐츠 방향"
}
```

**처리**: SKILL 호출 → 완성된 120초 시나리오 반환

### Step 2: 마케터에게 제시

**마케터가 보는 화면** (대시보드 UI):

```
┌───────────────────────────────────────────────────┐
│  🎬 STEP 2: 120초 시나리오 검토                   │
├───────────────────────────────────────────────────┤
│                                                   │
│  📖 스토리 개요                                    │
│  제목: "제주의 바다가 주는 따뜬한 선물"            │
│  전제: "제주 여행 중 만난 소금이 40만 년..."       │
│                                                   │
│  4막 구조:                                         │
│  ├─ Act 1: 제주에서의 첫 만남 (0-30초)           │
│  ├─ Act 2: 40만 년 화산지형의 신비 (30-60초)     │
│  ├─ Act 3: 70년 정성의 가치 (60-90초)            │
│  └─ Act 4: 따뜬한 선물의 의미 (90-120초)         │
│                                                   │
│  감정 호: 호기심 → 경이로움 → 감동 → 만족감      │
│                                                   │
│  ─────────────────────────────────────────────   │
│                                                   │
│  ⏱️ 타이밍 검증:                                  │
│  총 120초 ✓                                        │
│  대사: 28초, 내레이션: 70초, 침묵: 22초 ✓       │
│                                                   │
│  ─────────────────────────────────────────────   │
│                                                   │
│  📹 5개 세그먼트 상세:                            │
│                                                   │
│  [Segment 1] Opening (0-15초)                     │
│  결이: "와, 이 바다 정말 아름다워요!" (3초)      │
│  내레이션: "제주의 바다에 도착한..." (8초)       │
│  침묵: 4초                                         │
│  [시각: 제주 해변 일출]                           │
│  [+ 상세 보기]                                    │
│                                                   │
│  [Segment 2] Body 1 (15-45초)                     │
│  [+ 상세 보기]                                    │
│                                                   │
│  ... (Segment 3, 4, 5)                           │
│                                                   │
│  ─────────────────────────────────────────────   │
│                                                   │
│  🎬 Higgsfield 준비:                              │
│  캐릭터: 결이, 가마할방, 한라                     │
│  배경: 5개 (해변→화산→가마→소금)                 │
│  음성: 내레이션 톤 설정 완료                      │
│                                                   │
│  ─────────────────────────────────────────────   │
│                                                   │
│  마케터의 선택:                                   │
│  ☐ 이대로 진행 (100% 만족)                       │
│  ☐ 부분 수정 (예: Act 3 더 길게)                │
│  ☐ 전체 다시 생성 (새로운 스토리)               │
│                                                   │
│  [✓ 확정]  [✏️ 수정요청]  [🔄 다시생성]         │
│                                                   │
└───────────────────────────────────────────────────┘
```

### Step 3: 마케터 수정 또는 최종 확정

**상황 1: 마케터가 확정**
```
마케터: "이대로 진행할래"
  ↓
검증 통과
  ↓
Agent Output 생성
  ↓
naming-generator-agent에 전달
```

**상황 2: 마케터가 부분 수정 요청**
```
마케터: "Act 3를 더 짧게 해줘"
  ↓
SKILL 재호출 (부분 수정 모드)
  ↓
수정된 시나리오 제시
  ↓
마케터: 다시 확정/거부
  ↓
[최대 1회만 가능]
```

**상황 3: 마케터가 전체 다시 생성 요청**
```
마케터: "다시 생성해줘"
  ↓
SKILL 재호출 (새 시나리오 모드)
  ↓
완전히 새로운 스토리 제시
  ↓
마케터: 확정/거부
  ↓
[최대 1회만 가능]
```

**상황 4: 마케터 2회 거부**
```
마케터 1회: "다시 생성해줘"
  ↓
SKILL 재호출 (새 시나리오)
  ↓
마케터 거부: "또 이상한데..."
  ↓
Agent: "시간상 첫 시나리오로 진행하겠습니다"
  ↓
강제 확정 (효율성)
```

---

## 📤 Agent Output (완전)

```json
{
  "agent": "shortform-scenario-writer-agent",
  "status": "completed",
  "timestamp": "2026-08-03T10:45:00Z",
  "scenario_id": "SCENARIO_20260803_001",
  "story": {
    "title": "제주의 바다가 주는 따뜬한 선물",
    "premise": "제주 여행 중 우연히 만난 소금이...",
    "acts": [
      {
        "act": 1,
        "title": "제주에서의 첫 만남",
        "duration": "0-30초",
        "key_event": "결이가 제주 해변에서...",
        "emotional_beat": "호기심 발생"
      }
      /* ... 4개 Act 모두 */
    ],
    "emotional_journey": ["호기심", "경이로움", "감동", "만족감"]
  },
  "scenario_timeline": [
    {
      "segment_id": 1,
      "time_range": "0-15초",
      "scene": "Opening: 제주 해변, 결이 도착",
      "characters_in_scene": ["결이"],
      "dialogue": [
        {
          "character": "결이",
          "text": "와, 이 바다 정말 아름다워요!",
          "duration_seconds": 3
        }
      ],
      "narration": {
        "text": "제주의 바다에 도착한 한 관광객...",
        "duration_seconds": 8
      },
      "total_segment_duration": 15
    }
    /* ... 4개 세그먼트 모두 */
  ],
  "timing_verification": {
    "total_duration": 120,
    "dialogue_total": 28,
    "narration_total": 70,
    "silence_pauses": 22,
    "status": "✅ 정확히 120초"
  },
  "higgsfield_specifications": {
    "character_assignments": {
      "결이": { "model": "young_boy_salt_protagonist", "speaking_scenes": 5 },
      "가마할방": { "model": "elderly_man_artisan_70years", "speaking_scenes": 2 },
      "한라": { "model": "mystical_mountain_spirit", "speaking_scenes": 1 }
    },
    "background_sequence": [
      { "segment": 1, "setting": "jeju_beach_sunrise" },
      { "segment": 2, "setting": "jeju_beach_with_product" },
      { "segment": 3, "setting": "volcano_landscape_mystical" },
      { "segment": 4, "setting": "stone_kiln_fire" },
      { "segment": 5, "setting": "sparkling_salt_warm_light" }
    ],
    "voice_specifications": {
      "narration_voice": "결이",
      "narration_tone": "따뜸함, 순수함, 신뢰감"
    }
  },
  "marketer_interaction_log": {
    "initial_presentation_given": true,
    "modifications_requested": 0,
    "skill_rehotcalls": 0,
    "final_approval_given": true,
    "approval_timestamp": "2026-08-03T10:47:00Z"
  },
  "quality_validation": {
    "total_duration_120sec": true,
    "four_act_structure": true,
    "emotional_arc_smooth": true,
    "character_tone_maintained": true,
    "narration_sufficient": true,
    "message_delivered": true,
    "higgsfield_ready": true,
    "all_validations_passed": true
  },
  "next_agent": "naming-generator-agent",
  "next_agent_input_ready": true
}
```

---

## 🛡️ 에러 처리

**에러 1: SKILL 호출 실패**
```
SKILL_shortform-scenario-writer 호출 실패
  ↓
Agent: 마케터에게 알림
"시스템 오류가 발생했습니다. 1분 후 재시도합니다"
  ↓
자동 재시도 (1회)
  ↓
실패 → 마케터에 알림 + 기본 시나리오 제시
```

**에러 2: 시나리오 검증 실패**
```
120초 아님 / 4막 구조 아님 / 톤 유지 안 됨
  ↓
Agent: SKILL 재호출 요청
  ↓
수정된 시나리오 제시
```

**에러 3: 마케터 타임아웃**
```
30분 이상 응답 없음
  ↓
첫 시나리오로 자동 확정
  ↓
다음 Agent로 진행
```

---

## ✅ 역할 및 책임

| 책임 | 구현 |
|------|------|
| 스토리 자동 생성 | ✅ SKILL 호출 |
| 마케터 검토 제공 | ✅ 완전한 대시보드 UI |
| 수정 관리 | ✅ 최대 2회 재시도 |
| 품질 검증 | ✅ 7가지 항목 체크 |
| 에러 처리 | ✅ 3가지 상황 별 처리 |
| 다음 단계 연결 | ✅ 완전한 데이터 전달 |

---

## 📋 다음 단계

**이 Agent의 출력 → naming-generator-agent가 받음**

전달되는 데이터:
- ✅ 완전한 120초 시나리오
- ✅ 5개 세그먼트 상세 정보
- ✅ Higgsfield 스펙
- ✅ 타이밍 검증 완료
- ✅ 마케터 승인 기록
