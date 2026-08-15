# master-orchestrator-agent (마스터 지휘자 에이전트)

## 📌 목적

전체 파이프라인의 **총괄 조정자** (Step 0):
- 모든 Step 에이전트 호출 순서 관리
- Hook 시스템 관리 (마케터 검토 지점)
- 파이프라인 상태 추적
- 오류 처리 및 롤백

---

## 🎯 역할

| 구성 | 내용 |
|------|------|
| **책임** | Step 1~9 전체 조정 |
| **입력** | 사용자의 제품 정보 입력 |
| **처리** | 각 Step 에이전트 순차 호출 |
| **Hook 관리** | Hook 1~4에서 마케터 대기 |
| **상태 관리** | generation_logs 테이블 업데이트 |
| **출력** | 최종 영상 및 메타데이터 |

---

## 💼 마스터 파이프라인

```
사용자 입력
    ↓
┌─────────────────────────────────────┐
│ Master Orchestrator Agent           │
├─────────────────────────────────────┤
│ ├─ Step 1: Resource Analyzer        │
│ ├─ Step 2: Character Selector       │
│ │   ↓ [마케터 선택]                  │
│ ├─ Step 3: Character Designer       │
│ │   ↓ Hook 1: 캐릭터 승인           │
│ ├─ Step 4: Shortform Scenario Writer│
│ │   ↓ Hook 2: 시나리오 승인         │
│ ├─ Step 5: Naming Generator         │
│ │   ↓ Hook 3: 제목 선택             │
│ ├─ Step 6: Product Writer           │
│ │   ↓ Hook 4: 카피 승인             │
│ ├─ Step 7: Compliance Reviewer      │
│ ├─ Step 8: Higgsfield (영상 생성)   │
│ ├─ Step 9: QA Agent (품질 검사)     │
│ └─ ✅ 완료 또는 재작업              │
└─────────────────────────────────────┘
    ↓
  최종 영상
```

---

## 💼 처리 로직

```javascript
async function orchestratePipeline(resourceInput) {
  const generationId = generateId()
  
  // Step 1: 자료 분석
  const analyzed = await resourceAnalyzerAgent(resourceInput)
  logStep(generationId, 1, analyzed)
  
  // Step 2: 캐릭터 선택
  const characters = await characterSelectorAgent(analyzed)
  logStep(generationId, 2, characters)
  
  // 마케터 선택 대기
  const selected = await waitForMarketerSelection()
  
  // Step 3: 캐릭터 설계
  const designed = await characterDesignerAgent(selected)
  logStep(generationId, 3, designed)
  
  // Hook 1: 캐릭터 승인
  const hook1Result = await waitForHook1Approval()
  if (hook1Result.status === 'reject') {
    return await orchestratePipeline(resourceInput) // 재시작
  }
  
  // Step 4: 시나리오 작성
  const scenario = await shortformScenarioWriterAgent(designed)
  logStep(generationId, 4, scenario)
  
  // Hook 2: 시나리오 승인
  const hook2Result = await waitForHook2Approval()
  if (hook2Result.status === 'request_changes') {
    scenario = await shortformScenarioWriterAgent({...designed, feedback: hook2Result.feedback})
  }
  
  // ... 계속 Step 5~9
  
  return finalVideo
}
```

---

## 🎣 Hook 시스템 통합

| Hook | Step | 마케터 작업 |
|------|------|-----------|
| Hook 1 | 3→4 | 캐릭터 승인/수정/반려 |
| Hook 2 | 4→5 | 시나리오 승인/수정/반려 |
| Hook 3 | 5→6 | 제목 선택 (3개 중) |
| Hook 4 | 6→7 | 카피 승인/수정/반려 |

---

## 📊 상태 관리

```json
{
  "generation_id": "gen_12345",
  "status": "in_progress",
  "current_step": 4,
  "current_hook": 2,
  "timeline": [
    {"step": 1, "status": "completed", "timestamp": "2026-08-13T10:00:00Z"},
    {"step": 2, "status": "completed", "timestamp": "2026-08-13T10:05:00Z"},
    {"hook": 1, "status": "approved", "timestamp": "2026-08-13T10:10:00Z"},
    {"step": 3, "status": "completed", "timestamp": "2026-08-13T10:15:00Z"},
    {"step": 4, "status": "completed", "timestamp": "2026-08-13T10:25:00Z"},
    {"hook": 2, "status": "pending", "timestamp": "2026-08-13T10:30:00Z"}
  ]
}
```

---

## ✅ 책임사항

- [ ] 모든 Step 에이전트 호출
- [ ] Hook 시스템 관리
- [ ] generation_logs 업데이트
- [ ] 오류 처리 및 롤백
- [ ] 타임아웃 관리
- [ ] 최종 결과 반환
