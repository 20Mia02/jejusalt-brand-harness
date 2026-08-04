# compliance-reviewer-agent.md

**에이전트 이름**: compliance-reviewer-agent  
**버전**: v1.0  
**작성일**: 2026.08.03  
**담당 라인**: 제품 라인 (박주미)  
**연결 Skill**: SKILL_claim-safety-checker  

---

## 1. 에이전트의 역할

**SKILL_claim-safety-checker를 호출하여 생성된 콘텐츠를 검증하는 에이전트**

product-intro-writer-agent 또는 product-detail-page-writer-agent에서 생성된 콘텐츠의 법적·윤리적 안전성을 검증합니다.

웹앱 사용자가 생성된 콘텐츠를 확인할 때, 이 에이전트는 다음을 수행합니다:

1. 입력 데이터 검증
2. SKILL_claim-safety-checker 호출
3. 검증 결과 분석 및 판정
4. 수정안 제시 (필요시)

즉, **"생성된 콘텐츠 → 입력 검증 → Skill 호출 → 검증 결과 반환"의 품질 보증 게이트키퍼**입니다.

---

## 2. 입력 (Input) 명세

### 입력 데이터 구조 (JSON)

```javascript
{
  // 필수 항목
  "generatedContent": "## 식품 | 용암이와 함께하는 제주용암프리미엄솔트\n\n## 이 영상이 담은 이야기\n70년을 제주 바다에서 지켜온 용암이가...",
  "category": "식품|뷰티|헬스케어",
  "productName": "제주용암프리미엄솔트"
}
```

### 입력 필드 상세

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| **generatedContent** | String | ✅ 필수 | 검증할 생성된 콘텐츠 (마크다운) | "## 식품 \| 용암이..." |
| **category** | String | ✅ 필수 | 사업 영역 | "식품", "뷰티", "헬스케어" |
| **productName** | String | ✅ 필수 | 제품 공식명 | "제주용암프리미엄솔트" |

---

## 3. 출력 (Output) 명세

### 출력 형식 (마크다운)

```markdown
## ✅/⚠️/❌ 검증 결과 (PASSED / NEEDS REVISION / REJECTED)

### 검사 항목

#### 1. 의료 표현 검사
**상태**: ✅ PASSED / ⚠️ WARNING / ❌ FAILED

발견된 문제:
- (문제 있는 표현): (이유) → (추천 수정)

#### 2. 과장 표현 검사
**상태**: ✅ PASSED / ⚠️ WARNING / ❌ FAILED

발견된 문제:
- (문제 있는 표현): (이유) → (추천 수정)

#### 3. brand-voice 준수도
**상태**: ✅ PASSED / ⚠️ WARNING / ❌ FAILED

분석:
- 정직하게 (근거 있는 수치): [상태] [분석]
- 제주와 기술의 만남: [상태] [분석]
- 일상 속 함께함: [상태] [분석]

### 최종 판정

**종합 점수**: X/100

**판정**: APPROVED / NEEDS REVISION / REJECTED

**추천 조치**: [조치 방법]

### 수정 사항 (필요시)

| 원문 | 문제 | 수정안 |
|---|---|---|
| (원문) | (문제점) | (수정된 텍스트) |
```

### 출력 섹션 상세

| 섹션 | 분량 | 목적 | 톤 |
|------|------|------|-----|
| **검사 항목** | 3개 항목 | 상세한 검증 | 객관적 |
| **의료표현** | 5개 항목 | 법적 안전성 | 명확함 |
| **과장표현** | 5개 항목 | 윤리성 | 명확함 |
| **brand-voice** | 3개 항목 | 브랜드 정체성 | 분석적 |
| **최종 판정** | 점수+판정+조치 | 명확한 결정 | 명확함 |
| **수정안** | 테이블 (필요시) | 구체적 개선 | 건설적 |

---

## 4. 검증 판정 기준

### APPROVED (85점 이상)

```
의료 표현: 0개 위반
과장 표현: 0개 위반
신조어: 0개 위반
brand-voice: 3/3 준수

→ 바로 사용 가능
```

**조치**: 
```
✅ 검증 완료 - 바로 사용 가능
문제 없이 SNS/쇼핑몰에 게시하셔도 됩니다.
```

---

### NEEDS REVISION (50~84점)

```
의료 표현: 1~3개 위반 (경고 수준)
또는
과장 표현: 1개 위반 (경고 수준)
또는
brand-voice: 2개 이상 미충족

→ 수정 후 재검증 필요
```

**조치**:
```
⚠️ 수정 필요
하단 수정 사항을 적용한 후 다시 검증해주세요.
수정 후 재제출하면 최종 승인하겠습니다.
```

---

### REJECTED (50점 미만)

```
의료 표현: 4개 이상 위반 (심각)
또는
과장 표현: 2개 이상 위반 (심각)
또는
brand-voice: 3개 모두 미충족

→ 전체 재작성 필요
```

**조치**:
```
❌ 재작성 필요
법적·윤리적 문제가 심각합니다.
전체 콘텐츠를 다시 작성해주세요.

다시 작성할 때:
- productInfo를 더 상세하게 제공
- 의료 표현 완전 제거
- brand-voice 3원칙 준수 확인
```

---

## 5. 프로세스

### Step 1: 입력 유효성 검증

**목표**: 입력 데이터의 완전성과 유효성 확인

#### 1-1. 필수 항목 확인

```javascript
const requiredFields = ["generatedContent", "category", "productName"];

for (const field of requiredFields) {
  if (!input[field] || input[field].trim().length === 0) {
    throw new ValidationError(`필수 항목 누락: ${field}이(가) 필요합니다`);
  }
}
```

**에러 메시지**:
```
❌ 필수 항목 누락: generatedContent이(가) 필요합니다

필수 항목:
- generatedContent (검증할 콘텐츠)
- category (식품 / 뷰티 / 헬스케어)
- productName (제품명)
```

---

#### 1-2. 콘텐츠 길이 확인

```javascript
const MIN_CONTENT_LENGTH = 50;

if (generatedContent.length < MIN_CONTENT_LENGTH) {
  throw new ValidationError(
    `검증할 콘텐츠가 너무 짧습니다 (${generatedContent.length}자)\n` +
    `최소 ${MIN_CONTENT_LENGTH}자 이상의 콘텐츠가 필요합니다`
  );
}
```

**에러 메시지**:
```
❌ 콘텐츠 길이 부족

검증할 콘텐츠가 너무 짧습니다 (25자).
최소 50자 이상의 콘텐츠가 필요합니다.
```

---

#### 1-3. 카테고리 유효성 확인

```javascript
const validCategories = ["식품", "뷰티", "헬스케어"];

if (!validCategories.includes(category)) {
  throw new ValidationError(
    `유효하지 않은 카테고리: ${category}\n` +
    `유효한 값: ${validCategories.join(", ")}`
  );
}
```

**에러 메시지**:
```
❌ 유효하지 않은 카테고리: [입력값]

유효한 카테고리:
- 식품
- 뷰티
- 헬스케어
```

---

### Step 2: SKILL_claim-safety-checker 호출

**목표**: 검증된 입력으로 Skill 호출하여 콘텐츠 검증

#### 2-1. 입력 데이터 정리

```javascript
const validationInput = {
  generatedContent: generatedContent.trim(),
  category: category.trim(),
  productName: productName.trim()
};
```

#### 2-2. Skill 호출

```javascript
let validationResult;

try {
  validationResult = await callSkill("claim-safety-checker", validationInput);
} catch (error) {
  throw new SkillExecutionError(
    `검증 실패: ${error.message}\n` +
    `다시 시도해주세요. 지속적으로 실패하면 시스템 관리자에게 문의해주세요`
  );
}
```

#### 2-3. 결과 검증

```javascript
if (!validationResult || !validationResult.status) {
  throw new SkillExecutionError(
    `검증 결과 오류: Skill에서 유효한 결과를 반환하지 않았습니다`
  );
}

// 유효한 상태 확인
const validStatuses = ["APPROVED", "NEEDS REVISION", "REJECTED"];
if (!validStatuses.includes(validationResult.status)) {
  throw new SkillExecutionError(
    `검증 상태 오류: 유효하지 않은 상태입니다 (${validationResult.status})`
  );
}
```

---

### Step 3: 결과 분석 및 판정

**목표**: 검증 결과를 분석하여 최종 판정 결정

#### 3-1. 검증 결과 분석

```javascript
const analysisResult = {
  status: validationResult.status,
  score: validationResult.confidence * 100 || 0,
  
  // 항목별 상세 결과
  medicalExpressions: {
    status: validationResult.medicalExpressions?.status || "UNKNOWN",
    issues: validationResult.medicalExpressions?.issues || []
  },
  
  overstatements: {
    status: validationResult.overstatements?.status || "UNKNOWN",
    issues: validationResult.overstatements?.issues || []
  },
  
  brandVoice: {
    status: validationResult.brandVoiceCompliance?.status || "UNKNOWN",
    analysis: validationResult.brandVoiceCompliance?.analysis || {}
  },
  
  corrections: validationResult.corrections || []
};
```

#### 3-2. 권장 조치 생성

```javascript
let recommendation = "";

if (analysisResult.status === "APPROVED") {
  recommendation = "✅ 검증 완료 - 바로 사용 가능\n" +
    "문제 없이 SNS/쇼핑몰에 게시하셔도 됩니다.";
} 
else if (analysisResult.status === "NEEDS REVISION") {
  recommendation = "⚠️ 수정 필요\n" +
    "하단 수정 사항을 적용한 후 다시 검증해주세요.\n" +
    "수정 후 재제출하면 최종 승인하겠습니다.";
} 
else if (analysisResult.status === "REJECTED") {
  recommendation = "❌ 재작성 필요\n" +
    "법적·윤리적 문제가 심각합니다.\n" +
    "전체 콘텐츠를 다시 작성해주세요.";
}
```

---

### Step 4: 결과 반환

**목표**: 분석 결과를 최종 형식으로 반환

#### 4-1. 메타데이터 추가

```javascript
const finalResult = {
  status: "success",
  validation: {
    status: analysisResult.status,
    score: analysisResult.score,
    medicalExpressions: analysisResult.medicalExpressions,
    overstatements: analysisResult.overstatements,
    brandVoice: analysisResult.brandVoice,
    corrections: analysisResult.corrections,
    recommendation: recommendation
  },
  metadata: {
    category: category,
    productName: productName,
    contentLength: generatedContent.length,
    validatedAt: new Date().toISOString(),
    skillVersion: "v1.0",
    agentVersion: "v1.0"
  }
};
```

#### 4-2. 결과 반환

```javascript
return {
  success: true,
  data: finalResult,
  message: `검증 완료: ${analysisResult.status}`
};
```

#### 4-3. 반환 형식

```javascript
{
  success: true,
  data: {
    status: "success",
    validation: {
      status: "APPROVED",
      score: 96,
      medicalExpressions: {
        status: "PASSED",
        issues: []
      },
      overstatements: {
        status: "PASSED",
        issues: []
      },
      brandVoice: {
        status: "PASSED",
        analysis: { ... }
      },
      corrections: [],
      recommendation: "✅ 검증 완료 - 바로 사용 가능..."
    },
    metadata: {
      category: "식품",
      productName: "제주용암프리미엄솔트",
      contentLength: 1200,
      validatedAt: "2026-08-03T14:40:00Z",
      skillVersion: "v1.0",
      agentVersion: "v1.0"
    }
  },
  message: "검증 완료: APPROVED"
}
```

---

## 6. 사용 예시

### 예시 1: 검증 통과 (APPROVED)

#### 입력

```javascript
{
  "generatedContent": "## 식품 | 용암이와 함께하는 제주용암프리미엄솔트\n\n## 이 영상이 담은 이야기\n70년을 제주 바다에서 지켜온 용암이가 당신의 가족 밥상을 건강하게 만드는 방법을 알려줍니다.\n일반 소금보다 40% 낮은 나트륨과 풍부한 미네랄로, 매일의 밥상이 더 건강하고 맛있게 변하는 경험을 해보세요.\n\n## 제품 핵심\n- 나트륨 24.1g/100g (일반 소금 대비 40% 감소)\n- 마그네슘 6,370mg/100g\n- 제주 청정 인증",
  "category": "식품",
  "productName": "제주용암프리미엄솔트"
}
```

#### 출력

```markdown
## ✅ 검증 결과 (PASSED)

### 검사 항목

#### 1. 의료 표현 검사
**상태**: ✅ PASSED

발견된 문제: 없음

검증:
- "건강하게 만드는" → 일상적 표현으로 의료 의미 아님 ✅
- "건강하고 맛있게" → 일반 형용사로 사용 ✅
- 의료 효능 표현 (효과, 개선, 치유 등) → 0개 ✅

---

#### 2. 과장 표현 검사
**상태**: ✅ PASSED

발견된 문제: 없음

검증:
- 최상급 표현 (최고, 유일, 기적 등) → 0개 ✅
- 절대적 표현 (모두, 누구나, 확실히 등) → 0개 ✅
- 근거 있는 비교 (40% 낮은 나트륨) → 객관적 수치 기반 ✅

---

#### 3. brand-voice 준수도
**상태**: ✅ PASSED

분석:
- **정직하게 (근거 있는 수치)**: ✅ PASSED
  - "40% 낮은 나트륨" → 제품정보와 일치 ✅
  - "마그네슘 6,370mg" → 객관적 설명 ✅
  - 근거 없는 표현 → 0개 ✅

- **제주와 기술의 만남**: ✅ PASSED
  - "제주 바다" → 제주 언급 ✅
  - "70년" → 전통 기술 강조 ✅
  - 자연과 기술의 조화 표현 ✅

- **일상 속 함께함**: ✅ PASSED
  - "당신의 가족 밥상" → 일상 시나리오 ✅
  - "매일" → 일상 표현 ✅
  - "함께" → 포함성 표현 ✅
  - 따뜻한 톤 → "용암이가 당신의 밥상을" ✅

### 최종 판정

**종합 점수**: 96/100

**판정**: APPROVED

**판정 근거**:
- 의료 표현: 0개 ✅
- 과장 표현: 0개 ✅
- 신조어: 0개 ✅
- brand-voice: 3/3 준수 ✅

**추천 조치**: 
✅ 검증 완료 - 바로 사용 가능

문제 없이 SNS/쇼핑몰에 게시하셔도 됩니다.
매우 우수한 콘텐츠입니다.
```

---

### 예시 2: 검증 실패 (NEEDS REVISION)

#### 입력

```javascript
{
  "generatedContent": "이 제품은 기적의 미네랄로 당신의 모든 건강 문제를 해결합니다. 효과가 입증된 최고의 소금으로, 혈압을 낮추고 면역력을 높입니다.",
  "category": "식품",
  "productName": "제주용암프리미엄솔트"
}
```

#### 출력

```markdown
## ⚠️ 검증 결과 (NEEDS REVISION)

### 검사 항목

#### 1. 의료 표현 검사
**상태**: ❌ FAILED

발견된 문제:
- **"혈압을 낮추고"** (문제 심각도: CRITICAL)
  - 이유: 의료 효능 표현, 식품표시광고법 위반
  - 추천 수정: "마그네슘 6,370mg/100g의 풍부한 미네랄을 담고 있습니다"

- **"면역력을 높입니다"** (문제 심각도: CRITICAL)
  - 이유: 의료 효능 표현, 건강기능식품법 위반
  - 추천 수정: "제주 청정 인증으로 검증된 제품입니다"

- **"모든 건강 문제를 해결합니다"** (문제 심각도: CRITICAL)
  - 이유: 절대적 의료 표현, 의료법 위반
  - 추천 수정: "건강한 식습관의 기본이 되어줍니다"

- **"효과가 입증된"** (문제 심각도: HIGH)
  - 이유: 의료 효능 표현
  - 추천 수정: "과학적으로 검증된" (근거 있으면) 또는 제거

**위반 개수**: 4개 → CRITICAL ❌

---

#### 2. 과장 표현 검사
**상태**: ❌ FAILED

발견된 문제:
- **"기적의 미네랄"** (문제 심각도: CRITICAL)
  - 이유: 근거 없는 과장 + 신조어
  - 추천 수정: "제주 해수의 미네랄"

- **"최고의 소금"** (문제 심각도: HIGH)
  - 이유: 근거 없는 최상급 표현
  - 추천 수정: "70년 전통 기술의 소금"

**위반 개수**: 2개 (2개 이상 = FAILED) ❌

---

#### 3. brand-voice 준수도
**상태**: ❌ FAILED

분석:
- **정직하게 (근거 있는 수치)**: ❌ FAILED
  - 제품 정보 기준과 맞는 표현: 0개 / 4개
  - "모든 건강 문제" → 근거 불명확 ❌
  - "혈압을 낮추고" → 제품 정보에 없음 ❌
  - 추측 표현 → 1개 ("변화시킬 것입니다") ⚠️
  - **판정**: ❌ FAILED (0% 일치도)

- **제주와 기술의 만남**: ❌ FAILED
  - 제주 언급 → 0개 ❌
  - 기술/전통 언급 → 0개 ❌
  - 자연과 과학의 조화 → 없음 ❌
  - **판정**: ❌ FAILED (필수 요소 부재)

- **일상 속 함께함**: ❌ FAILED
  - 일상 표현 ("당신", "함께", "매일" 등) → 0개 ❌
  - 구체적 시나리오 (밥, 국, 반찬 등) → 0개 ❌
  - 따뜻하고 공감하는 톤 → "문제 해결" 중심으로 거창함 ❌
  - **판정**: ❌ FAILED (필수 요소 부재)

### 최종 판정

**종합 점수**: 30/100

**판정**: NEEDS REVISION

**판정 근거**:
- 의료 표현: 4개 (CRITICAL 위반)
- 과장 표현: 2개 (CRITICAL 위반)
- brand-voice: 0/3 준수 (모두 미충족)
- **법적 위험성**: 매우 높음 (식품표시광고법 위반 3건)

**추천 조치**: 
⚠️ 수정 필요

하단 수정 사항을 모두 적용한 후 다시 검증해주세요.
수정 후 재제출하면 최종 승인하겠습니다.

### 수정 사항

| 원문 | 문제 | 수정안 |
|---|---|---|
| "기적의 미네랄" | 근거 없는 과장 + 신조어 | "제주 해수의 미네랄" |
| "모든 건강 문제를 해결합니다" | 의료 표현 + 절대성 | "건강한 식습관의 기본이 되어줍니다" |
| "효과가 입증된" | 의료 효능 표현 | "과학적으로 검증된" (근거 있으면) 또는 제거 |
| "최고의 소금" | 근거 없는 최상급 | "70년 전통 기술의 소금" |
| "혈압을 낮추고" | 의료 효능 표현 (법적 위반) | "마그네슘 6,370mg/100g의 풍부한 미네랄" |
| "면역력을 높입니다" | 의료 효능 표현 (법적 위반) | "제주 청정 인증으로 안전합니다" |

**수정 후 다시 검증하기**:
1. 위 수정안을 모두 적용
2. brand-voice 3원칙 확인 (제주, 기술, 일상 포함)
3. compliance-reviewer-agent로 재검증
4. APPROVED 판정 후 게시

---
```

---

## 7. 에러 처리

### 에러 타입 및 응답

#### 7-1. ValidationError (입력 검증 실패)

```
❌ 검증 실패: 필수 항목 누락

필수 항목을 확인해주세요:
- generatedContent (검증할 콘텐츠)
- category (식품 / 뷰티 / 헬스케어)
- productName (제품명)
```

---

#### 7-2. ContentLengthError

```
❌ 콘텐츠 길이 부족

검증할 콘텐츠가 너무 짧습니다 (25자).
최소 50자 이상의 콘텐츠가 필요합니다.

현재: 25자
필요: 50자 이상
```

---

#### 7-3. InvalidCategoryError

```
❌ 유효하지 않은 카테고리: [입력값]

유효한 카테고리:
- 식품
- 뷰티
- 헬스케어
```

---

#### 7-4. SkillExecutionError (Skill 호출 실패)

```
❌ 검증 실패

다시 시도해주세요.

지속적으로 실패하면 시스템 관리자에게 문의해주세요.
```

---

### 경고 메시지 (정보 제공)

#### 검증 중 경고

```
⏳ 검증 중입니다...

검증에는 약 3~5초가 소요됩니다.
기다려주세요.
```

---

## 8. 프로세스 플로우 다이어그램

```
┌──────────────────────────────────┐
│  product-intro/detail 생성       │
│  (마크다운 콘텐츠 생성)           │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  compliance-reviewer-agent 호출   │
│  (사용자가 "검증" 버튼 클릭)      │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│   Step 1: 입력 검증              │
├──────────────────────────────────┤
│ ✓ 필수 항목 확인                  │
│ ✓ 콘텐츠 길이 확인 (최소 50자)   │
│ ✓ 카테고리 유효성                │
└────────────┬─────────────────────┘
             │
        ┌────┴────┐
        │          │
     실패 ──────→ 에러 반환
        │
        성공
        │
        ▼
┌──────────────────────────────────┐
│   Step 2: SKILL 호출             │
│   SKILL_claim-safety-checker     │
├──────────────────────────────────┤
│ 검사 항목:                        │
│ - 의료 표현                       │
│ - 과장 표현                       │
│ - brand-voice                    │
└────────────┬─────────────────────┘
             │
        ┌────┴────┐
        │          │
     실패 ──────→ 에러 반환
        │
        성공
        │
        ▼
┌──────────────────────────────────┐
│   Step 3: 결과 분석 & 판정       │
├──────────────────────────────────┤
│ - APPROVED (85점 이상)            │
│ - NEEDS REVISION (50~84점)       │
│ - REJECTED (50점 미만)            │
└────────────┬─────────────────────┘
             │
        ┌────┴────┴────┐
        │               │
   APPROVED        REVISION
        │               │
        ▼               ▼
   바로 사용     수정안 제시
   가능          재검증 요청
        │               │
        └───────┬───────┘
                │
                ▼
        ┌──────────────────┐
        │ 최종 검증 결과   │
        │ 테이블 포함      │
        └──────────────────┘
```

---

## 9. 웹앱 통합 시나리오

### 사용자 입장에서의 흐름

```
1️⃣ 콘텐츠 생성 (product-intro 또는 product-detail)
   ↓
   
2️⃣ 생성된 콘텐츠 확인
   ↓
   
3️⃣ "검증" 버튼 클릭
   ↓
   
4️⃣ compliance-reviewer-agent 호출
   ├─ Step 1: 입력 검증 (1초)
   ├─ Step 2: Skill 호출 (2~3초)
   └─ Step 3: 결과 분석 (1초)
   ↓ (총 4~5초)
   
5️⃣ 검증 결과 표시
   ├─ APPROVED: 바로 사용 가능
   ├─ NEEDS REVISION: 수정안 표시 (테이블)
   └─ REJECTED: 전체 재작성 필요
   ↓
   
6️⃣ 사용자 선택
   ├─ APPROVED → "게시" 버튼 활성화
   ├─ NEEDS REVISION → "수정" 또는 "다시 생성" 선택
   └─ REJECTED → "처음부터 생성" 권장
```

---

## 10. 다른 에이전트와의 연동

### 통합 워크플로우

```
[사용자가 제품 정보 입력]
        ↓
┌─────────────────┬─────────────────┐
│                 │                 │
▼                 ▼                 │
product-intro    product-detail    │
↓                 ↓                 │
카피 생성         상세페이지       │
│                 │                 │
└─────────────────┬─────────────────┘
        ↓
    [검증 버튼 클릭]
        ↓
    compliance-reviewer-agent
        ↓
    ✅ APPROVED: 게시 가능
    ⚠️ NEEDS REVISION: 수정 후 재검증
    ❌ REJECTED: 전체 재작성
        ↓
    [최종 결정]
    ├─ SNS 게시 (product-intro 기반)
    ├─ 쇼핑몰 게시 (product-detail 기반)
    └─ 재작성 요청
```

---

## 11. 주요 특징

### 11-1. 간단하고 효율적한 구조

- 단일 Skill 호출
- 복잡한 로직 없음
- 4~5초 내 검증 완료
- 유지보수 용이

### 11-2. 명확한 검증 기준

- 3가지 검사 항목 (의료, 과장, brand-voice)
- 점수 기반 판정 (0~100점)
- 명확한 상태 구분 (APPROVED/REVISION/REJECTED)

### 11-3. 실질적인 수정안 제시

- 테이블 형식으로 원문/문제/수정안 명시
- 이유를 함께 제시
- 명확한 실행 방법 제시

### 11-4. 법적·윤리적 안전성 보장

- 의료 표현 0 tolerance
- 과장 표현 2개 이상 금지
- brand-voice 3원칙 준수 확인

---

## 12. 버전 관리

| 버전 | 날짜 | 상태 | 변경사항 |
|------|------|------|---------|
| v1.0 | 2026.08.03 | 확정 | 초기 버전 완성. 4단계 프로세스, 3가지 검증 항목, 2개 완전한 예시 포함 |

---

## 13. FAQ

### Q1: 검증에 얼마나 걸리나요?

**A**: 약 4~5초입니다 (검증 1초 + Skill 호출 2~3초 + 분석 1초).

---

### Q2: NEEDS REVISION에서 수정 후 재검증이 가능한가요?

**A**: 네, 가능합니다. 테이블의 수정안을 적용한 후 다시 "검증" 버튼을 클릭하면 됩니다.

---

### Q3: REJECTED 판정을 받으면 어떻게 하나요?

**A**: 전체 콘텐츠를 다시 작성해야 합니다. product-intro-writer 또는 product-detail-page-writer에서 더 상세한 productInfo를 제공하고 다시 생성하세요.

---

### Q4: 의료 표현이란 정확히 무엇인가요?

**A**: "혈압을 낮춘다", "면역력을 높인다", "효과가 있다" 같은 의료 효능을 나타내는 표현입니다. "나트륨을 함유하고 있다"는 OK이지만 "나트륨으로 혈압을 낮춘다"는 금지입니다.

---

### Q5: 검증에 실패하면?

**A**: 다시 시도해주세요. 지속적으로 실패하면:
1. 콘텐츠가 50자 이상인지 확인
2. category가 유효한지 확인
3. productName이 정확한지 확인

그래도 실패하면 시스템 관리자에게 문의해주세요.

---

## 14. 체크리스트

### 배포 전 확인 항목

- [ ] 입력 검증이 모든 필수 항목을 확인하는가?
- [ ] 콘텐츠 길이 검증이 정확한가? (최소 50자)
- [ ] 에러 메시지가 명확하고 해결 방법을 제시하는가?
- [ ] Skill 호출 로직이 정확한가?
- [ ] 판정이 정확한가?
  - APPROVED: 85점 이상
  - NEEDS REVISION: 50~84점
  - REJECTED: 50점 미만
- [ ] 수정안 테이블이 정확하게 생성되는가?
- [ ] 메타데이터가 정확하게 추가되는가?
- [ ] 타임아웃 처리가 있는가? (권장: 10초)
- [ ] 로깅이 구현되었는가?

---

**작성 완료**: compliance-reviewer-agent.md v1.0

이 파일은 **TimelyAI의 에이전트 명세서** 형식으로 작성되었습니다.  
웹앱에서 생성된 콘텐츠를 검증하여  
법적·윤리적 안전성을 보장하는 **품질 보증 게이트키퍼**입니다. 📌

