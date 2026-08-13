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
Step 4: 캐릭터 설계 (character-designer-agent)
├── 입력: 선택된 캐릭터, 제품정보
├── Skill 호출: Character Designer Skill
└── 출력: 캐릭터 브리프 (성격, 외형, 말투)
    ↓ [마케터 검토/수정] ← 🎣 Hook 1 (/api/generate/:rid/character/confirm)

    ↓ (template_select → AI 추천 or 직접 작성)
Step 5: 시나리오 작성 (shortform-scenario-writer-agent)
├── 입력: 캐릭터 브리프, 제품정보, 길이선택
├── Skill 호출: Shortform Scenario Writer Skill
└── 출력: 시나리오 (제목, 스토리, Act[] with duration)
    ↓ [마케터 검토/수정] ← 🎣 Hook 2 (/api/generate/:rid/scenario/:sid/confirm)

    ↓
Step 6: 영상 제목 생성 (naming-generator-agent)
├── 입력: 시나리오, 강조점
├── Skill 호출: Naming Generator Skill
└── 출력: 영상 제목 3개 (제목, 의미, 점수)
    ↓ [마케터 선택] ← 🎣 Hook 3 (/api/generate/:rid/naming/confirm)

    ↓
Step 7: 카피 작성 (product-intro-writer-agent / product-detail-page-writer-agent)
├── 입력: 제품명, 카피타입(intro/detail), 시나리오
├── 처리: AI가 제품 소개/상세 페이지 카피 작성
└── 출력: 생성된 카피
    ↓ [마케터 검토/수정] ← 🎣 Hook 4 (/api/generate/:rid/copy/:cid/confirm)

    ↓
Step 8: 컴플라이언스 검토 (compliance-reviewer-agent)
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

## 🎣 Hook 시스템 (마케터 검증 체크포인트)

각 Step 후 **마케터의 개입 지점**:

| Hook | Step | 마케터 작업 | 파일 |
|------|------|-----------|------|
| 🎣 Hook 1 | 4→template_select | 캐릭터 설계 승인/수정/반려 | `hooks/HOOKS.md` |
| 🎣 Hook 2 | 5→6 | 시나리오 작성 승인/수정/반려 | `hooks/HOOKS.md` |
| 🎣 Hook 3 | 6→7 | 영상 제목 선택 (3개 중) | `hooks/HOOKS.md` |
| 🎣 Hook 4 | 7→8 | 카피 작성 승인/수정/반려 | `hooks/HOOKS.md` |

**상세 정의**: `hooks/HOOKS.md` 참조

---

## 분기 처리

컴플라이언스 검토 후:

- **APPROVED**: Step 8 (영상 생성) 진행
- **WARNING**: 수정 후 재검토
- **REJECTED**: 카피 재작성 (Step 6으로 돌아가기)

---

## 📋 Step별 상세 정보

### **Step 1: 자료 분석 (Resource Analyzer Agent)**
- **에이전트**: `resource-analyzer-agent.md`
- **Skill**: 없음 (TimelyAI 직접 호출)
- **입력**: productName, productInfo, keywords
- **출력**: metadata (categories, ageGroups, targets, focus)
- **시간**: 10~20초
- **다음**: Step 2

### **Step 2: 캐릭터 추천 (Character Selector Agent)**
- **에이전트**: `character-selector-agent.md`
- **처리**: config.json의 8개 캐릭터 스코어링
- **입력**: metadata (Step 1 결과)
- **출력**: 추천 캐릭터 3개 (이름, 성격, 점수, 이유)
- **시간**: 1초 (로컬 계산)
- **마케터 선택**: 3개 중 1개 선택 필수
- **다음**: Step 3

### **Step 3: 캐릭터 설계 (Character Designer Agent)** ⭐
- **에이전트**: `character-designer-agent.md`
- **Skill**: `SKILL_character-designer.md`
- **입력**: 선택된 캐릭터, metadata
- **TimelyAI 호출**:
  ```
  System Prompt: 캐릭터 상세 정의 (성격, 외형, 말투, 표현)
  Model: upstage/solar-pro4
  Output: 캐릭터 브리프 (5-6 필드)
  ```
- **Reference Image 생성**:
  ```
  1. TimelyAI 결과로 이미지 프롬프트 작성
  2. Higgsfield text2image_soul_v2 호출
  3. 생성된 이미지 URL → Supabase 저장
  ```
- **출력**: 캐릭터 상세 + reference_image_url
- **시간**: 30~60초 (TimelyAI) + 15~30초 (이미지)
- **🎣 Hook 1**: 마케터가 reference_image 검토 → 승인/수정/반려
- **다음**: Step 4 (승인 시) 또는 Step 2 (반려 시)

### **Step 4: 시나리오 작성 (Shortform Scenario Writer Agent)**
- **에이전트**: `shortform-scenario-writer-agent.md`
- **Skill**: `SKILL_shortform-scenario-writer.md`
- **입력**: 확정된 캐릭터, 제품정보, 길이(15초)
- **TimelyAI 호출**:
  ```
  System Prompt: 15초 쇼트폼 시나리오 (Act 기반)
  Model: upstage/solar-pro4
  Output: title, story, acts[] (duration_seconds 명시)
  ```
- **출력**: 시나리오 (title, story, acts, total_duration)
- **시간**: 20~40초
- **🎣 Hook 2**: 마케터가 시나리오 검토 → 승인/수정/반려
- **다음**: Step 5 (승인 시) 또는 Step 3 (반려 시)

### **Step 5: 영상 제목 생성 (Naming Generator Agent)**
- **에이전트**: `naming-generator-agent.md`
- **Skill**: `SKILL_naming-generator.md`
- **입력**: 시나리오, 강조점
- **TimelyAI 호출**:
  ```
  System Prompt: 3개의 제목 생성 (각각 의미, 점수)
  Model: upstage/solar-pro4
  Output: candidates[] (title, meaning, score)
  ```
- **출력**: 3개 제목 (점수 내림차순)
- **시간**: 15~30초
- **🎣 Hook 3**: 마케터가 제목 선택 (3개 중 1개)
- **AI 추천 사용 시**: 가장 높은 점수 자동 선택
- **다음**: Step 6

### **Step 6: 카피 작성 (Product Writer Agent)**
- **에이전트**: `product-writer-agent.md`
- **Skill**: 없음 (TimelyAI 직접 호출)
- **입력**: 제목, 제품정보, 시나리오
- **TimelyAI 호출**:
  ```
  System Prompt: brand-voice 준수한 카피 작성
            규칙: 의약품 표현 금지, 과장 금지
  Model: upstage/solar-pro4
  Output: title, body (15초 분량)
  ```
- **출력**: 최종 카피 (title + body)
- **시간**: 15~30초
- **🎣 Hook 4**: 마케터가 카피 검토 → 승인/수정/반려
- **다음**: Step 7 (승인 시) 또는 Step 4 (반려 시)

### **Step 7: 컴플라이언스 검증 (Compliance Reviewer Agent)**
- **에이전트**: `compliance-reviewer-agent.md`
- **입력**: 최종 카피, category
- **자동 검증** (Phase 1):
  ```
  config/compliance-rules-v2.json 로드
  카테고리별 금지 키워드 스캔
  critical_violations 검사
  ```
- **수동 검증** (Phase 2):
  ```
  마케터가 14~15개 항목 체크리스트 수행
  인증서, 검사 성적서 확인
  ```
- **판정**:
  - ✅ APPROVED → Step 8
  - ⚠️ WARNING → 재검토 (Step 6으로 돌아가기)
  - ❌ REJECTED → 불통과 (Step 6으로 돌아가기)
- **시간**: 10초 (자동) + 5~10분 (수동)
- **다음**: Step 8 (APPROVED 시)

### **Step 8: 영상 생성 (Higgsfield CLI)**
- **호출**: `higgsfield generate create seedance_2_0`
- **입력**:
  ```
  --prompt: 캐릭터(reference_image_url) + 카피 + 시나리오
  --duration: 15
  --resolution: 720p
  --start-image: {reference_image_url}  ← Step 3 이미지 사용
  --wait
  ```
- **출력**: video_url, duration, resolution
- **시간**: 2~5분 (Higgsfield 처리)
- **🔐 주의**: 로컬 인증 필요 (`higgsfield auth login` 매일)
- **다음**: Step 9

### **Step 9: QA 검증 (QA Agent) v2.0** ⭐
- **에이전트**: `post-generation-qa-agent.md`
- **Phase 1: 자동 검증** (10초)
  ```
  config/compliance-rules-v2.json 재확인
  카피 + 시나리오 + 자막 금지 키워드 스캔
  PASS_AUTO / WARNING / REJECTED 판정
  ```
- **Phase 2: 수동 검증** (5~15분)
  ```
  마케터가 14~15개 항목 재검토
  영상 재생 후 비주얼 확인
  음성, 자막, 배경음악 검증
  ```
- **Phase 3: 최종 판정**
  ```
  ✅ PASS: 배포 가능
  ⚠️ WARNING: 조건부 배포 (마케터 승인 후)
  ❌ REJECTED: 불통과 (Step 6으로 돌아가기)
  ```
- **결과**: 최종 영상 URL + 검증 기록
- **다음**: 배포 완료

---

## 🎬 전체 시간 추정

```
Step 1: 10~20초 (자료 분석)
Step 2: 1초 (캐릭터 선택)
Step 3: 45~90초 (캐릭터 설계 + 이미지)
Hook 1: 3분 (마케터 검토)
Step 4: 25~45초 (시나리오)
Hook 2: 5분 (마케터 검토)
Step 5: 20~35초 (제목 생성)
Hook 3: 1분 (마케터 선택)
Step 6: 20~35초 (카피)
Hook 4: 3분 (마케터 검토)
Step 7: 15초 (자동 검증) + 10분 (수동 검증)
Step 8: 2~5분 (Higgsfield 영상 생성)
Step 9: 10초 (자동) + 15분 (수동) = 15분 10초

마케터 개입 시간: 약 16분
자동 처리 시간: 약 8분
Higgsfield: 약 5분

총 소요 시간: 약 25~30분 (완전 자동화 시 30초 + Higgsfield 5분 = 5.5분)
```

---

## 설정 및 규칙

- `spec/spec.md`: 전체 프로젝트 스펙
- `spec/brand-voice.md`: 모든 생성 결과가 따를 원칙
- `config/compliance-rules-v2.json`: 카테고리별 검증 규칙 (42개 항목)
- `hooks/HOOKS.md`: 4개 Hook 정의 및 처리 로직
