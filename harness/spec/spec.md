# 제주소금 Harness 스펙

## 프로젝트 개요

제주소금 브랜드의 AI 콘텐츠 생성 시스템. 자료 → 캐릭터 설계 → 시나리오 → 카피 → 영상 생성의 End-to-End 파이프라인

---

## Harness 구조

### Skill (단일 책임 함수)
각 Skill은 **정확히 하나의 일**만 수행:

1. **Character Designer Skill**
   - 입력: 제품명, 카테고리, 강조점
   - 처리: AI가 최적의 캐릭터 3개 추천
   - 출력: 캐릭터명, 성격, 외형, 말투

2. **Naming Generator Skill**
   - 입력: 시나리오, 강조점
   - 처리: AI가 영상 제목 3개 생성
   - 출력: 제목, 의미, 점수

3. **Shortform Scenario Writer Skill**
   - 입력: 캐릭터, 제품, 강조점, 길이(15/30/60/120초)
   - 처리: AI가 스토리 작성 (Act 분할)
   - 출력: 제목, 스토리, Act[] (duration_seconds 포함)

### Agent (Skill 실행자)
TimelyAI가 Skill을 호출하고 결과를 처리:

1. **Character Designer Agent**
   - Character Designer Skill 호출
   - 마케터 검토 → 확정 또는 수정

2. **Naming Generator Agent**
   - Naming Generator Skill 호출
   - 영상 제목 확정

3. **Shortform Scenario Writer Agent**
   - Shortform Scenario Writer Skill 호출
   - 시나리오 검토 → 확정

4. **Post-Generation QA Agent**
   - 생성된 영상 품질 검사
   - 일관성/시간/오류 확인

### Orchestrator (마스터 지휘자)
Step 1 → Step 2 → ... → 최종 결과:

```
Step 1: 자료 분석 (resource-analyzer-agent)
   ↓
Step 2: 캐릭터 선택 (character-selector-agent)
   ↓
Step 3: 캐릭터 설계 (character-designer-agent)
   ↓ [마케터 검토]
Step 4: 시나리오 작성 (shortform-scenario-writer-agent)
   ↓ [마케터 검토]
Step 5: 영상 제목 생성 (naming-generator-agent)
   ↓ [마케터 검토]
Step 6: 카피 작성 (product-writer-agent)
   ↓ [마케터 검토]
Step 7: 컴플라이언스 검토 (compliance-reviewer-agent)
   ↓
Step 8: 영상 생성 (Higgsfield CLI)
   ↓
Step 9: 품질 검사 (post-generation-qa-agent)
   ↓
✅ 완료
```

---

## Brand Voice (헌법)

모든 Skill/Agent가 따라야 할 **불변의 원칙**:
→ `brand-voice.md` 참조

---

## 성공 기준

✅ 모든 Skill이 정확히 하나의 책임만 수행  
✅ 모든 Agent가 Skill을 정확히 호출 + 결과 처리  
✅ 모든 생성 결과가 brand-voice 준수  
✅ End-to-End 파이프라인이 자동화  
✅ 마케터 검토 지점이 명확  

---

## 설정

- `config.json`: 캐릭터, 템플릿, 규칙 정의
- `compliance-rules.json`: 카테고리별 컴플라이언스 규칙
- `agent-schemas.json`: 각 Agent 입출력 스키마
