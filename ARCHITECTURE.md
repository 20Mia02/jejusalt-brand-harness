# 제주소금 AI 콘텐츠 생성 시스템 아키텍처

## 📐 시스템 개요

```
마케터 입력
    ↓
┌─────────────────────────────────────────────────────────────┐
│         HARNESS 6요소 (정의 & 원칙)                        │
├─────────────────────────────────────────────────────────────┤
│ 1️⃣ spec/      → 프로젝트 정의, 원칙, PRD (불변)          │
│ 2️⃣ skills/    → 3개 Skill: 캐릭터설계, 시나리오, 제목생성 │
│ 3️⃣ agents/    → 9개 Agent: Step별 실행자                  │
│ 4️⃣ orchestrator/ → 9단계 파이프라인 정의                   │
│ 5️⃣ config/    → 검증 규칙, 설정값                         │
│ 6️⃣ hooks/     → 4개 마케터 검증 체크포인트                │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│    IMPLEMENTATION (실제 구현)                               │
├─────────────────────────────────────────────────────────────┤
│ backend/     → Node.js Express 서버                         │
│ ├─ agents/   → TimelyAI 호출 구현                          │
│ ├─ routes/   → API 엔드포인트                              │
│ └─ services/ → Supabase, Higgsfield 통합                  │
│                                                             │
│ frontend/    → React UI (마케터 인터페이스)                │
└─────────────────────────────────────────────────────────────┘
    ↓
   영상 생성 (Higgsfield CLI)
    ↓
✅ 완성된 콘텐츠
```

---

## 🎯 9단계 파이프라인 상세 흐름

### **Step 1: 자료 분석 (Resource Analyzer Agent)**

**입력**: 마케터가 제공한 제품 정보
```json
{
  "productName": "제주 소금",
  "productInfo": "제주 바다에서...",
  "keywords": ["제주산", "미네랄"]
}
```

**처리 흐름**:
1. `backend-agent.js` → `callAgent("resource-analyzer-agent")`
2. **TimelyAI (upstage/solar-pro4)** 호출
3. 시스템 프롬프트: 메타데이터 추출 (카테고리, 타겟, 톤)
4. 결과 저장: `Supabase.resources` 테이블

**출력**: 
```json
{
  "metadata": {
    "categories": ["식품"],
    "ageGroups": ["40~60대"],
    "targets": ["개인", "가족"],
    "focus": ["자연", "건강", "신뢰"]
  }
}
```

---

### **Step 2: 캐릭터 추천 (Character Selector Agent)**

**입력**: Step 1의 메타데이터

**처리 흐름**:
1. `character_library` 에서 기본 8개 캐릭터 로드
   - Mock 모드: `database-agent.js`의 `seedCharacterLibrary()`
   - 실제 모드: Supabase `character_library` 테이블
   
2. **스코어링**: 제품 특성과 캐릭터 매칭
   ```
   각 캐릭터의 점수 = 
   (카테고리 일치도 * 0.4) + 
   (타겟층 일치도 * 0.4) + 
   (톤 어울림 * 0.2)
   ```

3. **Top 3 선택**: 가장 높은 점수 3개

**기본 캐릭터 라이브러리** (8명):
- **결이**: 긍정적, 활발한 소년 (밝은 미네랄)
- **용암이**: 신비로운 제주 정체성 (검은 현무암)
- **해수**: 따뜻한 바다 (푸른색)
- 등 8명 (config/config.json에 정의)

**출력**:
```json
{
  "characters": [
    {
      "character_name": "결이",
      "personality": "꿈과 희망...",
      "match_score": 9.5,
      "reason": "제주 자연과 희망의 톤이 제품과 완벽 매칭"
    },
    ...
  ]
}
```

---

### **Step 3: 캐릭터 설계 (Character Designer Agent)**

**입력**: 
- 선택된 캐릭터 기본 정보
- Step 1 메타데이터

**처리 흐름**:

#### 1️⃣ **캐릭터 상세 프롬프트 생성**

TimelyAI 호출로 다음을 생성:
```
성격, 외형, 말투, 주요 표현, 레퍼런스 이미지 프롬프트
```

#### 2️⃣ **참고 이미지 생성** (선택사항)

```javascript
// backend-agent.js: generateImageFromPrompt()
const refImage = await generateImageFromPrompt({
  prompt: "결이라는 캐릭터, 밝은 미네랄 형태, 희망적인 표정...",
  model: "text2image_soul_v2"  // Higgsfield 이미지 모델
});
// 출력: {url: "https://...", metadata: {...}}
```

**이미지 저장 방식**:
- Supabase `character_library.reference_image_url` ← 이미지 URL 저장
- 이후 모든 Step에서 재사용 (일관성 유지)

#### 3️⃣ **결과 저장**

```json
{
  "character_name": "결이",
  "personality": "꿈과 희망으로 가득 찬 당찬 소년",
  "appearance": "작은 소금 결정 형태, 밝은 흰색",
  "voice_tone": "희망적이고 정직함",
  "key_phrases": ["우리 함께라면", "작지만 중요함"],
  "reference_image_url": "https://...",  ← 썸네일/참고 이미지
  "reference_image_metadata": {
    "generated_by": "text2image_soul_v2",
    "prompt": "결이라는...",
    "created_at": "2026-08-13T..."
  }
}
```

🎣 **Hook 1: 캐릭터 승인**
- 마케터: 승인 / 수정 요청 / 반려
- AI 추천 사용 시: 자동 승인

---

### **Step 4: 시나리오 작성 (Shortform Scenario Writer Agent)**

**입력**:
- 확정된 캐릭터 (Step 3 + Hook 1)
- 제품 정보
- 길이 (15초)

**처리 흐름**:

#### Skill: Shortform Scenario Writer

```
입력:
- 캐릭터 (성격, 외형, 말투)
- 제품명, 설명
- 강조점 (미네랄, 건강 등)
- 길이 (15초)

TimelyAI 프롬프트:
"이 캐릭터로 15초 쇼트폼 영상의 시나리오를 만들어주세요.
오프닝: 2초 | 메인: 10초 | 클로징: 3초
각 씬별 duration_seconds 명시"

출력 형식:
{
  "title": "제주 바다의 결정",
  "story": "제주 바다에서 태어난 작은 결정들의 이야기...",
  "acts": [
    {
      "sequence": 1,
      "duration_seconds": 2,
      "description": "오프닝: 제주 바다 장면",
      "visual_cues": "파도, 햇빛, 미네랄 입자"
    },
    ...
  ],
  "total_duration": 15
}
```

🎣 **Hook 2: 시나리오 승인**
- 검증: 길이 정확성, 브랜드 톤 일치도, 자연스러움
- AI 추천 사용 시: 자동 승인

---

### **Step 5: 영상 제목 생성 (Naming Generator Agent)**

**입력**: Step 4 시나리오

**처리**: TimelyAI 호출
```
3개의 제목 생성:
1. "제주 바다의 결정" (점수: 9.2)
2. "소금 한 알의 이야기" (점수: 8.7)
3. "밥상 위의 제주" (점수: 8.4)

각 제목마다:
- 의미 설명
- 점수 (관련성, 임팩트, 기억성)
```

🎣 **Hook 3: 제목 선택**
- 마케터: 3개 중 1개 선택
- AI 추천 사용 시: 가장 높은 점수 자동 선택

---

### **Step 6: 카피 작성 (Product Writer Agent)**

**입력**:
- 확정된 제목 (Step 5 + Hook 3)
- 제품 정보
- 선택한 시나리오

**처리**: TimelyAI 호출

```
시스템 프롬프트:
- brand-voice.md 원칙 준수
- 15초 분량의 카피
- 의약품 표현 금지
- 과장 금지

출력:
{
  "title": "제주 바다의 결정",
  "body": "제주의 용암해수에서 탄생한 소금입니다.\n70년 기술력으로 조절된 나트륨·마그네슘 비율.\n밥상 위의 작은 결정이, 우리 가족의 맛을 더합니다."
}
```

🎣 **Hook 4: 카피 승인**
- 검증: 톤, 정확성, 길이 적합도
- AI 추천 사용 시: 자동 승인

---

### **Step 7: 컴플라이언스 검토 (Compliance Reviewer Agent)**

**입력**: Step 6 카피

**처리 흐름**:

```javascript
// config/compliance-rules-v2.json 로드
규칙 = {
  "food": {
    "critical_rules": [
      "의약품 표현 금지",
      "거짓 원산지 금지",
      "부정확한 영양소 금지"
    ],
    "high_priority_rules": [...]
  },
  "beauty": {...},
  "health": {...}
}

// 자동 검증 (Phase 1)
critical_violations = 0
high_violations = 0
for each rule:
  if content.includes(forbidden_keyword):
    violations++

// 결과 판정
if critical_violations > 0:
  status = "REJECTED"  → Step 6으로 돌아가기
elif high_violations > 0:
  status = "WARNING"   → 수정 후 재검토
else:
  status = "APPROVED"  → Step 8 진행
```

---

### **Step 8: 영상 생성 (Higgsfield CLI)**

**입력**:
- 확정된 캐릭터 (reference_image_url)
- 최종 카피
- 길이 (15초)

**처리 흐름**:

```bash
# backend/services/higgsfield-service.js

higgsfield generate create seedance_2_0 \
  --prompt "
    [CHARACTER]: 결이 (참고이미지: {reference_image_url})
    [VOICE]: {캐릭터의voice_tone}
    [SCRIPT]: {카피 텍스트}
    [SCENE]: {시나리오 acts[]}
    [DURATION]: 15 seconds
  " \
  --duration 15 \
  --resolution 720p \
  --start-image {reference_image_url} \
  --wait
```

**출력**:
```json
{
  "video_id": "vid_xxxxx",
  "video_url": "https://higgsfield.com/...",
  "duration": 15,
  "resolution": "720p",
  "character_image_url": "{reference_image_url}",
  "generated_at": "2026-08-13T..."
}
```

---

### **Step 9: 품질 검사 (QA Agent) v2.0**

**입력**: Step 8 영상

**처리 흐름**:

#### Phase 1️⃣: 자동 검증
```javascript
// qa-agent.js

카테고리 = "food"  // 또는 beauty, health

// 금지 키워드 스캔
forbidden_keywords = [
  "치료", "완치", "약효", "질병 예방", ...
]
for keyword in forbidden_keywords:
  if video_script.includes(keyword):
    critical_issue++

// 판정
if critical_issue > 0:
  phase1_result = "REJECTED"
else:
  phase1_result = "PASS_AUTO"
```

#### Phase 2️⃣: 수동 검증 (마케터)
```
카테고리별 체크리스트:

🍳 식품 (14개 항목):
□ 의약품 표현 없는가? (의약품표시법 제14조)
□ 원산지가 정확한가? (식품표시법 제6조)
□ 영양소 수치가 맞는가? (검사 성적서 확인)
□ 위생 기준을 충족하는가?
...

💄 뷰티 (13개 항목):
□ 천연 인증서 있는가?
□ 성분 안전성이 확인됐는가?
□ 부작용이 공시되었는가?
...

💊 헬스 (15개 항목):
□ 기능식품 인증 있는가?
□ GMP 인증이 있는가?
...
```

#### Phase 3️⃣: 최종 판정
```
결과:
- PASS_AUTO: 자동 검증만으로 통과
- WARNING: 마케터 확인 필요 (경고 수준)
- REJECTED: 불통과, Step 6으로 돌아가기
```

---

## 🔧 Harness 6요소별 역할

### 1️⃣ **spec/** (정의 & 원칙)

```
spec.md → 전체 스펙, Skill/Agent 정의
brand-voice.md → 3가지 불변 원칙:
  1. 정직하게, 과장 없이
  2. 제주와 기술의 만남
  3. 일상 속 소소한 함께함
```

### 2️⃣ **skills/** (단일 책임 함수)

```
SKILL_character-designer.md
  입력: 제품명, 카테고리, 강조점
  출력: 캐릭터명, 성격, 외형, 말투

SKILL_shortform-scenario-writer.md
  입력: 캐릭터, 제품정보, 길이
  출력: 제목, 스토리, Act[]

SKILL_naming-generator.md
  입력: 시나리오, 강조점
  출력: 제목 3개 (의미, 점수)
```

### 3️⃣ **agents/** (Skill 실행자)

```
resource-analyzer-agent.md (Step 1)
character-selector-agent.md (Step 2)
character-designer-agent.md (Step 3)
shortform-scenario-writer-agent.md (Step 4)
naming-generator-agent.md (Step 5)
product-writer-agent.md (Step 6)
compliance-reviewer-agent.md (Step 7)
post-generation-qa-agent.md (Step 9)
master-orchestrator-agent.md (Step 0 - 전체 조정)
```

### 4️⃣ **orchestrator/** (9단계 파이프라인)

```
orchestrator.md → 전체 흐름 정의
  각 Step의:
  - 입력/출력
  - Skill 호출
  - 다음 Step으로의 전달

Hook 통합:
  Step 3→4: Hook 1 (캐릭터 승인)
  Step 4→5: Hook 2 (시나리오 승인)
  Step 5→6: Hook 3 (제목 선택)
  Step 6→7: Hook 4 (카피 승인)
```

### 5️⃣ **config/** (설정 & 규칙)

```
compliance-rules-v2.json
  - 식품 (14개): 의약품 표현, 원산지, 영양소 등
  - 뷰티 (13개): 천연 인증, 성분 안전성 등
  - 헬스 (15개): 기능식품 인증, 부작용 공시 등
  
  각 규칙:
  - rule_id, rule_name
  - risk_level (critical/high/medium)
  - automation (auto/manual)
  - keywords_to_block
  - compliant_alternatives

config.json
  - 기본 8개 캐릭터 라이브러리
  - 템플릿
```

### 6️⃣ **hooks/** (4개 마케터 검증)

```
HOOKS.md

Hook 1 (Step 3→4): 캐릭터 설계 승인
  - 마케터: 승인 / 수정 요청 / 반려
  - 승인 시: 다음 Step 자동 진행
  - 반려 시: Step 2로 돌아가기

Hook 2 (Step 4→5): 시나리오 승인
  - 검증: 길이, 브랜드 톤, 자연스러움
  - 수정 필요 시: 재작성

Hook 3 (Step 5→6): 제목 선택
  - 3개 중 1개 선택만 필요

Hook 4 (Step 6→7): 카피 승인
  - 최종 검증 후 영상 생성
```

---

## 🎨 캐릭터 이미지 시스템

### **3가지 이미지 타입**

#### 1️⃣ **Reference Image** (참고 이미지 / 썸네일)

```
생성 시점: Step 3 (캐릭터 설계)
생성 방식: Higgsfield text2image_soul_v2 모델
저장 위치: Supabase character_library.reference_image_url
사용처: 
  - 마케터 검토 (Hook 1)
  - 모든 Step에서 일관성 유지
  - 최종 영상의 --start-image

프롬프트 예시:
"결이라는 캐릭터, 작은 소금 결정 형태, 
밝은 흰색, 희망적인 표정, 제주 바다 배경"
```

#### 2️⃣ **캐릭터 고정 이미지** (기본 8명)

```
저장: config/config.json
구조:
{
  "characters": [
    {
      "name": "결이",
      "visualIdentity": "작은 소금 결정 형태, 밝은 흰색",
      "toneTrait": "희망적이고 정직함",
      "role": "주인공",
      "reference_image_url": "https://..."  ← 고정 이미지
    },
    ...
  ]
}

특징:
- 프로젝트마다 동일한 8개 캐릭터 사용
- 각 캐릭터마다 고정된 참고 이미지
- 일관된 브랜드 정체성 유지
```

#### 3️⃣ **최종 영상의 캐릭터** (생성된 영상)

```
생성 시점: Step 8 (Higgsfield 영상 생성)
입력: --start-image {reference_image_url}
출력: 15초 쇼트폼 영상에 포함된 캐릭터

특징:
- Higgsfield가 reference_image를 기반으로 생성
- 모든 씬에서 동일한 캐릭터 일관성 유지
- 카피/시나리오와 자연스럽게 조화
```

### **이미지 흐름도**

```
Step 2: 기본 8개 캐릭터 추천
    ↓
Step 3: 선택된 캐릭터로 reference_image 생성
    ↓
    Hook 1: 마케터가 생성된 이미지 검토
    ↓
    승인 → reference_image_url 확정
    ↓
Step 4~7: 이 reference_image_url 사용
    ↓
Step 8: Higgsfield --start-image {reference_image_url}
    ↓
최종 영상: 일관된 캐릭터로 생성됨
```

---

## 🔄 데이터 흐름 (DB 관점)

### **Supabase 테이블 구조** (또는 Mock 모드)

```javascript
resources {
  id: string,
  product_name: string,
  product_info: string,
  keywords: jsonb,
  metadata: jsonb,  // Step 1 분석 결과
  status: string,   // analyzing → analyzed → in_progress → complete
  reference_image_url: string,  // Step 3 생성 이미지
  created_at: timestamp
}

character_library {
  id: string,
  character_name: string,
  personality_traits: string[],
  visual_description: string,
  reference_image_url: string,  // 고정 이미지 URL
  generation_count: integer,    // 몇 개 제품에 사용됐는가
  created_at: timestamp
}

generation_logs {
  id: string,
  resource_id: string,
  step: integer (1-9),
  hook: integer (1-4, 선택사항),
  action: string,  // character_approval, scenario_approval 등
  status: string,  // completed, pending, failed
  marketer_approval: boolean,
  ai_recommendation: jsonb,
  created_at: timestamp
}
```

---

## 💻 백엔드 서비스 아키텍처

### **주요 서비스**

```
backend/
├── agents/
│   ├── backend-agent.js
│   │   └── callTimelyAIAgent(prompt, model)
│   │   └── generateImageFromPrompt(prompt)  ← Reference Image 생성
│   │
│   ├── database-agent.js
│   │   └── callDatabase(table, operation, data)
│   │
│   └── qa-agent.js
│       └── performAutoValidation(category, content)
│
├── routes/
│   ├── resources.js      (Step 1-2)
│   ├── generation.js     (Step 3-7, Hook)
│   └── characters.js     (캐릭터 라이브러리 관리)
│
└── services/
    ├── timely-ai-service.js
    │   └── OpenAI 클라이언트 설정
    │   └── Model: upstage/solar-pro4
    │
    ├── higgsfield-service.js
    │   └── higgsfield generate create seedance_2_0
    │   └── 영상 생성 & URL 반환
    │
    └── supabase-service.js
        └── 데이터베이스 연결
```

---

## 🚀 실행 흐름 요약

| Step | Agent | Skill | 입력 | 출력 | Hook |
|------|-------|-------|------|------|------|
| 1 | Resource Analyzer | - | 제품정보 | 메타데이터 | - |
| 2 | Character Selector | - | 메타데이터 | 캐릭터 3개 | - |
| 3 | Character Designer | Character Designer | 선택된 캐릭터 | 캐릭터 상세 + Reference Image | ✅ Hook 1 |
| 4 | Scenario Writer | Scenario Writer | 캐릭터 + 제품 | 시나리오 | ✅ Hook 2 |
| 5 | Naming Generator | Naming Generator | 시나리오 | 제목 3개 | ✅ Hook 3 |
| 6 | Product Writer | - | 제목 + 제품 | 카피 | ✅ Hook 4 |
| 7 | Compliance Reviewer | - | 카피 | APPROVED/WARNING/REJECTED | - |
| 8 | - | - | (Higgsfield CLI) | 영상 URL | - |
| 9 | QA Agent | - | 영상 | PASS/WARNING/REJECTED | - |

---

## 📋 마케터 작업 포인트

```
🎣 Hook 1 (Step 3 후):
  □ 생성된 Reference Image 검토
  □ 캐릭터 성격이 제품과 맞는가?
  □ 승인 / 수정 요청 / 반려

🎣 Hook 2 (Step 4 후):
  □ 시나리오 흐름 확인
  □ 길이 정확성 (15초)
  □ 브랜드 톤 일치도
  □ 승인 / 수정 / 반려

🎣 Hook 3 (Step 5 후):
  □ 3개 제목 중 선택 (점수 기반 추천)

🎣 Hook 4 (Step 6 후):
  □ 최종 카피 검토
  □ 의약품 표현 없는가?
  □ 과장 없는가?
  □ 승인 / 수정 / 반려

Step 9 QA (선택):
  □ Phase 2 수동 검증 (14~15개 항목)
  □ 근거 자료 확인 (인증서, 검사 성적서)
```

