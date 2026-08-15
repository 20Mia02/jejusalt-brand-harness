# product-writer-agent (제품 카피 작성 에이전트)

## 📌 목적

파이프라인의 **여섯 번째 Agent** (Step 6):
- 제품명, 시나리오, 강조점을 바탕으로 카피 작성
- brand-voice 준수 확인
- 마케터 검토 후 Step 7로 진행

---

## 🎯 역할

| 구성 | 내용 |
|------|------|
| **입력** | 제품명, 시나리오, 선택된 제목 |
| **처리** | TimelyAI를 통한 카피 생성 |
| **출력** | 완성된 카피 (제목 + 본문) |
| **마케터 작업** | 검토 & 수정 (Hook 4) |
| **다음** | Step 7: Compliance Reviewer Agent |

---

## 💼 처리 로직

```javascript
Step 6: Product Writer Agent
├─ 입력받기
│  ├─ resourceName: "제주 바다의 미네랄"
│  ├─ scenario: (Step 4 시나리오)
│  └─ selectedTitle: "제주 바다의 결정"
│
├─ TimelyAI 호출
│  ├─ System Prompt: product-writer-prompt.md
│  ├─ 모델: solar-pro-4
│  └─ 제약: brand-voice 준수
│
├─ 카피 생성
│  ├─ 제목: "제주 바다의 결정"
│  ├─ 본문: 제품 설명 + 강조점
│  └─ Call-to-Action
│
└─ 결과 저장
   ├─ 마케터 검토 대기
   └─ Hook 4: 카피 승인
```

---

## 📋 출력 예시

```json
{
  "generation_id": "gen_12345",
  "step": 6,
  "copy": {
    "title": "제주 바다의 결정",
    "body": "제주의 용암해수에서 탄생한 소금입니다.\n70년 기술력으로 조절된 나트륨·마그네슘 비율.\n밥상 위의 작은 결정이, 우리 가족의 맛을 더합니다.",
    "cta": "지금 확인해보세요"
  }
}
```

---

## ✅ 체크사항

- [ ] TimelyAI 연동 성공
- [ ] brand-voice 준수 확인
- [ ] 카피 생성 완료
- [ ] Hook 4: 마케터 검토 대기
