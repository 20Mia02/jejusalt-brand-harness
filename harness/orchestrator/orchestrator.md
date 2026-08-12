# Harness Orchestrator - 전체 파이프라인

제주소금 AI 콘텐츠 생성 시스템의 **마스터 지휘자**

---

## 파이프라인 구조

```
사용자 입력
    ↓
Step 1: 자료 분석 (resource-analyzer-agent)
├── 입력: 제품명, 설명, 카테고리, 강조점
├── 처리: 메타데이터 추출
└── 출력: 분석된 자료 정보

    ↓
Step 2: 캐릭터 선택 (character-selector-agent)
├── 입력: 자료 정보
├── 처리: 라이브러리에서 최적 캐릭터 3개 추천
└── 출력: 추천 캐릭터 리스트
    ↓ [마케터 선택]

    ↓
Step 3: 캐릭터 설계 (character-designer-agent)
├── 입력: 선택된 캐릭터, 제품정보
├── Skill 호출: Character Designer Skill
└── 출력: 캐릭터 브리프 (성격, 외형, 말투)
    ↓ [마케터 검토/수정]

    ↓
Step 4: 시나리오 작성 (shortform-scenario-writer-agent)
├── 입력: 캐릭터 브리프, 제품정보, 길이선택
├── Skill 호출: Shortform Scenario Writer Skill
└── 출력: 시나리오 (제목, 스토리, Act[] with duration)
    ↓ [마케터 검토/수정]

    ↓
Step 5: 영상 제목 생성 (naming-generator-agent)
├── 입력: 시나리오, 강조점
├── Skill 호출: Naming Generator Skill
└── 출력: 영상 제목 3개 (제목, 의미, 점수)
    ↓ [마케터 선택]

    ↓
Step 6: 카피 작성 (product-writer-agent)
├── 입력: 제품명, 카피타입(intro/detail), 시나리오
├── 처리: AI가 제품 소개/상세 페이지 카피 작성
└── 출력: 생성된 카피
    ↓ [마케터 검토/수정]

    ↓
Step 7: 컴플라이언스 검토 (compliance-reviewer-agent)
├── 입력: 생성된 카피
├── 처리: 카테고리별 규칙으로 검증
└── 출력: APPROVED / WARNING / REJECTED
    ↓

    ↓
Step 8: 영상 생성 (Higgsfield CLI)
├── 입력: 캐릭터, 카피, 길이
├── 처리: higgsfield generate create seedance_2_0 --prompt "..." --duration 15 --wait
└── 출력: 영상 URL
    ↓

    ↓
Step 9: 종합 품질 검사 (qa-agent) 🆕
├── Phase 1: 자동 검증 (규칙 기반)
│   ├── 카테고리별 금지 키워드 스캔
│   ├── 위험도 별 분류 (Critical/High/Medium)
│   └── 자동 불통과 조건 감지
├── Phase 2: 수동 검증 체크리스트
│   ├── 카테고리별 10~15개 항목
│   ├── 마케터 수동 검토 지점 제시
│   └── 근거 자료 확인 (인증서, 검사 성적서 등)
├── Phase 3: 최종 판정
│   ├── PASS_AUTO (자동 검증 완료)
│   ├── WARNING (경고, 수동 검토 필수)
│   └── REJECTED (불통과, 재작성 필수)
└── 검증 대상 카테고리
    ├── 🍳 식품 (제주소금) - 14개 검증 항목
    ├── 💄 뷰티 (미네랄 제품) - 13개 검증 항목
    └── 💊 헬스/영양제 - 15개 검증 항목

    ↓
✅ 완료
```

---

## 검토 지점

각 Step 후에 **마케터 검토**가 있어야 함:

- Step 3 후: 캐릭터 브리프 확정
- Step 4 후: 시나리오 확정
- Step 5 후: 영상 제목 선택
- Step 6 후: 카피 확정

---

## 분기 처리

컴플라이언스 검토 후:

- **APPROVED**: Step 8 (영상 생성) 진행
- **WARNING**: 수정 후 재검토
- **REJECTED**: 카피 재작성 (Step 6으로 돌아가기)

---

## 설정 및 규칙

- `harness/config/config.json`: 캐릭터 라이브러리, 템플릿
- `harness/config/compliance-rules.json`: 카테고리별 규칙
- `harness/spec/brand-voice.md`: 모든 생성 결과가 따를 원칙
