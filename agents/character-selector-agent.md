# character-selector-agent (캐릭터 선택 에이전트)

## 📌 목적

파이프라인의 **두 번째 Agent** (Step 2):
- 제품 특성에 맞는 캐릭터 3개 추천
- 캐릭터 라이브러리에서 최적 조합 선택
- 마케터가 선택하도록 제시

---

## 🎯 역할

| 구성 | 내용 |
|------|------|
| **입력** | Step 1 분석 결과 (자료 정보) |
| **처리** | 라이브러리에서 캐릭터 매칭 & 추천 |
| **출력** | 추천 캐릭터 3개 + 선택 UI |
| **마케터 작업** | 3개 중 1개 선택 |
| **다음** | Step 3: Character Designer Agent |

---

## 💼 처리 로직

```javascript
Step 2: Character Selector Agent
├─ 입력받기 (Step 1 결과)
│
├─ 캐릭터 라이브러리 조회
│  ├─ 모든 기본 캐릭터 8개 리스트업
│  └─ 제품 카테고리와 강조점으로 스코어링
│
├─ Top 3 추천
│  ├─ 스코어 높은 순 정렬
│  └─ 다양성 고려
│
└─ 마케터에게 제시
   ├─ 캐릭터 설명 (성격, 외형, 음성톤)
   ├─ 추천 이유
   └─ 선택 옵션
```

---

## 📋 출력 예시

```json
{
  "generation_id": "gen_12345",
  "step": 2,
  "character_recommendations": [
    {
      "rank": 1,
      "character_id": "char_001",
      "name": "결이",
      "personality": "긍정적, 활발함",
      "appearance": "밝은 미네랄 형태",
      "voice_tone": "희망적이고 따뜻함",
      "match_score": 9.5,
      "reason": "제주 자연과 희망의 톤이 제품과 완벽 매칭"
    },
    {
      "rank": 2,
      "character_id": "char_003",
      "name": "소금이",
      "personality": "신뢰할 수 있는, 담백함",
      "appearance": "깨끗한 결정체",
      "voice_tone": "성숙하고 정직함",
      "match_score": 8.8,
      "reason": "건강함과 신뢰성이 강조"
    },
    {
      "rank": 3,
      "character_id": "char_005",
      "name": "미르",
      "personality": "신비로운, 자유로움",
      "appearance": "유동하는 해수 형태",
      "voice_tone": "몽환적이고 부드러움",
      "match_score": 8.2,
      "reason": "제주의 신비로운 바다 이미지 강조"
    }
  ]
}
```

---

## ✅ 체크사항

- [ ] 캐릭터 라이브러리 로드 완료
- [ ] 스코어링 알고리즘 작동
- [ ] Top 3 추천 완료
- [ ] 마케터 선택 대기
