# compliance-reviewer-agent (컴플라이언스 검토 에이전트)

## 📌 목적

파이프라인의 **일곱 번째 Agent** (Step 7):
- 생성된 카피와 영상 시나리오의 규제 준수 검토
- 카테고리별 컴플라이언스 규칙 적용
- APPROVED / WARNING / REJECTED 판정

---

## 🎯 역할

| 구성 | 내용 |
|------|------|
| **입력** | 생성된 카피, 시나리오, 제품 카테고리 |
| **처리** | 규칙 기반 검증 (compliance-rules-v2.json) |
| **출력** | APPROVED / WARNING / REJECTED |
| **결과** | APPROVED → Step 8 진행 / WARNING/REJECTED → Step 6 재작업 |
| **다음** | Step 8: Higgsfield 영상 생성 |

---

## 💼 처리 로직

```javascript
Step 7: Compliance Reviewer Agent
├─ 입력받기
│  ├─ copy: (카피 텍스트)
│  ├─ scenario: (시나리오)
│  └─ category: "food" | "beauty" | "health"
│
├─ 규칙 로드
│  └─ config/compliance-rules-v2.json
│
├─ 카테고리별 검증
│  ├─ Critical 규칙 체크
│  │  ├─ 의약품 표현 금지
│  │  ├─ 거짓 주장 감지
│  │  └─ 미인증 클레임 감지
│  │
│  ├─ High 규칙 체크
│  │  └─ 경고 수준 이상의 표현
│  │
│  └─ Medium 규칙 체크
│     └─ 개선 권장 사항
│
├─ 판정
│  ├─ APPROVED: 모든 Critical/High 통과
│  ├─ WARNING: High 이상 경고 있음
│  └─ REJECTED: Critical 위반
│
└─ 결과 저장
   ├─ generation_logs 기록
   └─ Step 8 또는 Step 6으로 진행
```

---

## 📋 출력 예시

```json
{
  "generation_id": "gen_12345",
  "step": 7,
  "compliance_result": {
    "status": "APPROVED",
    "category": "food",
    "critical_violations": [],
    "high_violations": [],
    "medium_warnings": [
      "원산지가 명시되었으나, 더 구체적인 설명 추천"
    ],
    "details": {
      "medical_claims": "PASS",
      "false_statements": "PASS",
      "unverified_claims": "PASS",
      "misleading_language": "PASS"
    }
  }
}
```

---

## ✅ 체크사항

- [ ] compliance-rules-v2.json 로드 완료
- [ ] 카테고리 정확하게 식별
- [ ] Critical 규칙 검증 완료
- [ ] 판정 결과 저장
- [ ] Step 8 또는 Step 6으로 라우팅
