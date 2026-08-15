# resource-analyzer-agent (자료 분석 에이전트)

## 📌 목적

Harness 파이프라인의 **첫 번째 Agent**로서 (Step 1):
- 마케터가 입력한 제품 자료 수집
- 메타데이터 추출 (카테고리, 강조점, 특성)
- 분석 결과를 다음 Step에 전달

---

## 🎯 역할

| 구성 | 내용 |
|------|------|
| **입력** | 제품명, 설명, 카테고리, 강조점 (마케터 입력) |
| **처리** | 자료 분석 & 메타데이터 추출 |
| **출력** | 분석된 자료 정보 (JSON) |
| **다음** | Step 2: Character Selector Agent |

---

## 💼 처리 로직

```javascript
Step 1: Resource Analyzer Agent
├─ 입력받기
│  ├─ resourceName: "제주 바다의 미네랄"
│  ├─ category: "food"
│  ├─ description: "제주 바다에서 얻은 천연 미네랄"
│  └─ highlights: ["미네랄 풍부", "천연"]
│
├─ 분석 처리
│  ├─ 주요 강조점 추출
│  ├─ 카테고리 정규화 (food/beauty/health)
│  ├─ 타겟 오디언스 파악
│  └─ 잠재적 규제 사항 파악
│
└─ 결과 저장
   ├─ generation_logs에 기록
   └─ Step 2로 전달
```

---

## 📋 출력 예시

```json
{
  "generation_id": "gen_12345",
  "step": 1,
  "resource_analysis": {
    "resource_name": "제주 바다의 미네랄",
    "category": "food",
    "description": "제주 바다에서 얻은 천연 미네랄",
    "highlights": ["미네랄 풍부", "천연"],
    "target_audience": "40~60대 여성",
    "potential_regulations": ["식품 표시", "건강기능식품 관련법"],
    "tone_hints": "정직하고 따뜻함"
  }
}
```

---

## ✅ 체크사항

- [ ] 입력 데이터 유효성 검사
- [ ] 카테고리 올바르게 파싱
- [ ] 메타데이터 추출 완료
- [ ] Step 2에 데이터 전달
