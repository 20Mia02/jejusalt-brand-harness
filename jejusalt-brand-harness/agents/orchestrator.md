---
title: orchestrator
role: Master Agent (모든 Agent를 조율하는 마스터 에이전트)
type: Agent
version: 2.0
implementation: TimelyAI Sub-agents
sub-agents:
  - resource-analyzer-agent (Step 2)
  - character-generator-agent (Step 3)
  - character-designer-agent (Step 4)
  - shortform-scenario-writer-agent (Step 5)
  - naming-generator-agent (Step 6)
  - product-intro-writer-agent (Step 7)
  - product-detail-page-writer-agent (Step 7)
  - compliance-reviewer-agent (Step 8)
---

# orchestrator.md

## 역할
**모든 Agent를 조율하는 마스터 에이전트** ⭐ 가장 중요!
사용자 입력부터 최종 결과까지 전체 워크플로우를 관리
(박주미 5개 + 고수아 3개 = 총 8개 Agent 통합)

TimelyAI의 sub-agent 호출을 통해 완전 자동화된 파이프라인 구성

## 입력
```javascript
{
  "userRequest": "제주용암프리미엄솔트 제품 카피 생성해줘",
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증, 70년 전통 기술로 생산",
  "keywords": ["프리미엄", "건강", "가족"],
  "requestType": "intro|detail|both",
  "contentType": "캐릭터소개|제품스토리|일상밥상"
}
```

## 출력
```json
{
  "success": true,
  "resourceId": "uuid",
  "metadata": { "categories": [...], "confidence": 0.9+ },
  "selectedCharacter": { "name": "용암이", "detail": {...} },
  "scenario": { "duration": "120초", "acts": [...] },
  "productName_generated": "70년 제주의 약속",
  "contentName_generated": "용암이가 전하는 제주 소금의 맛",
  "generatedContent": "카피 텍스트",
  "validationStatus": "APPROVED",
  "validationScore": 96,
  "readyForHiggsfield": true,
  "timestamp": "ISO 8601"
}
```

---

## 프로세스 (8단계 파이프라인)

### Step 1: 입력 유효성 검증

【직접 실행, TimelyAI 호출 없음】

```javascript
// 필수 항목 확인
if (!productName || !productInfo) {
  throw new Error("필수 항목: productName, productInfo");
}

// requestType 확인
const validRequestTypes = ["intro", "detail", "both"];
if (!validRequestTypes.includes(requestType)) {
  throw new Error("requestType: intro / detail / both");
}

// 통과하면 Step 2로
console.log("✅ 입력 검증 완료, Step 2 시작");
```

---

### Step 2: resource-analyzer-agent 호출

【TimelyAI Sub-agent 호출】

**호출 방식:**
```
run_subagent("resource-analyzer-agent", {
  productName: "제주용암프리미엄솔트",
  productInfo: "나트륨 24.1g/100g...",
  keywords: ["프리미엄", "건강", "가족"]
})
```

**담당**: 박주미  
**역할**: 제품정보 → 메타데이터 자동 생성

**입력 조건:**
- `productName` (필수): 제품명 (문자열, 최소 5자)
- `productInfo` (필수): 제품 설명 (문자열, 최소 50자)
- `keywords` (선택): 강조점 (배열, 최대 5개)

**기대 출력:**
```json
{
  "status": "success",
  "metadata": {
    "categories": ["식품", "헬스케어"],
    "ageGroups": ["40~60대"],
    "targets": ["가족밥상", "건강관심층"],
    "focus": ["신뢰", "건강", "기술"],
    "confidence": 0.96
  }
}
```

**실패 대응:**
```javascript
if (analysisResult.status !== "success") {
  throw new Error("❌ 분석 실패: 제품 정보를 다시 확인하고 더 자세히 입력해주세요");
}
const metadata = analysisResult.metadata;
console.log("✅ Step 2 완료: 메타데이터 생성됨");
```

---

### Step 3: character-generator-agent 호출

【TimelyAI Sub-agent 호출】

**호출 방식:**
```
run_subagent("character-generator-agent", {
  productName: "제주용암프리미엄솔트",
  productInfo: "...",
  keywords: ["프리미엄", "건강", "가족"],
  metadata: {
    categories: ["식품"],
    ageGroups: ["40~60대"],
    targets: ["가족밥상"],
    focus: ["신뢰", "건강"]
  }
})
```

**담당**: 박주미  
**역할**: 메타데이터 기반 최적 캐릭터 3개 추천

**입력:**
- `productName` (필수)
- `productInfo` (필수)
- `metadata` (필수): Step 2에서 받은 메타데이터

**기대 출력:**
```json
{
  "status": "success",
  "characters": [
    {
      "name": "용암이",
      "description": "70년을 제주 바다에서 지켜온 따뜨한 아버지",
      "reason": "신뢰감과 건강을 표현하기에 최적",
      "score": 95
    },
    { "name": "가마할방", ... },
    { "name": "현무", ... }
  ]
}
```

**실패 대응:**
```javascript
if (characterResult.status !== "success") {
  console.warn("⚠️ 캐릭터 생성 실패, 기본 캐릭터 '결이' 사용");
  selectedCharacter = { name: "결이" };
} else {
  selectedCharacter = characterResult.characters[0];
  console.log(`✅ Step 3 완료: '${selectedCharacter.name}' 선택됨`);
}
```

---

### Step 4: character-designer-agent 호출 (고수아) ⭐

【TimelyAI Sub-agent 호출】

**호출 방식:**
```
run_subagent("character-designer-agent", {
  character: "용암이",
  productName: "제주용암프리미엄솔트",
  productInfo: "...",
  metadata: metadata
})
```

**담당**: 고수아  
**역할**: 선택된 캐릭터의 비주얼·성격·목소리 톤 상세화  
**중요도**: 선택사항 (실패해도 진행 가능)

**입력:**
- `character` (필수): 선택된 캐릭터명
- `productName` (필수)
- `metadata` (필수)

**기대 출력:**
```json
{
  "status": "success",
  "detail": {
    "characterName": "용암이",
    "voiceTone": "낮고 차분한 아버지 목소리",
    "personalityTraits": ["따뜨함", "신뢰", "보호 본능"],
    "visualDescription": "70년의 바다 경험을 담은 눈빛, 주름진 손",
    "preferredExpressions": ["함께", "이 맛", "우리 가족"]
  }
}
```

**실패 대응:**
```javascript
try {
  const designerResult = await run_subagent("character-designer-agent", {...});
  if (designerResult.status === "success") {
    selectedCharacter.detail = designerResult.detail;
    console.log("✅ Step 4 완료: 캐릭터 상세화됨");
  }
} catch (error) {
  console.warn("⚠️ Step 4 스킵 (캐릭터 상세화는 선택사항)");
}
```

---

### Step 5: shortform-scenario-writer-agent 호출 (고수아) ⭐

【TimelyAI Sub-agent 호출】

**호출 방식:**
```
run_subagent("shortform-scenario-writer-agent", {
  character: "용암이",
  productName: "제주용암프리미엄솔트",
  productInfo: "...",
  metadata: metadata,
  contentType: "제품스토리"
})
```

**담당**: 고수아  
**역할**: 캐릭터 + 메타데이터 기반 120초 시나리오 생성

**입력:**
- `character` (필수): 선택된 캐릭터명
- `productName` (필수)
- `metadata` (필수)
- `contentType` (필수): 시나리오 유형

**기대 출력:**
```json
{
  "status": "success",
  "scenario": {
    "title": "70년 제주 바다의 기술, 이제 당신 가족 밥상의 지킴이",
    "total_duration": 120,
    "acts": [
      {
        "act": 1,
        "duration": "0-30초",
        "scene": "용암이가 제주 바다에서 소금을 건져내는 장면"
      },
      { "act": 2, ... },
      { "act": 3, ... },
      { "act": 4, ... }
    ]
  }
}
```

**검증:**
```javascript
if (Math.abs(scenarioResult.scenario.total_duration - 120) > 5) {
  console.warn("⚠️ 시나리오가 정확히 120초가 아님:", scenarioResult.scenario.total_duration, "초");
}
```

**실패 대응:**
```javascript
if (scenarioResult.status !== "success") {
  throw new Error("❌ 시나리오 생성 실패. 다시 시도해주세요.");
}
const scenario = scenarioResult.scenario;
console.log("✅ Step 5 완료: 120초 시나리오 생성됨");
```

---

### Step 6: naming-generator-agent 호출 (고수아) ⭐

【TimelyAI Sub-agent 호출】

**호출 방식:**
```
run_subagent("naming-generator-agent", {
  scenario: scenario,
  productName: "제주용암프리미엄솔트",
  metadata: metadata
})
```

**담당**: 고수아  
**역할**: 시나리오 기반 제품명·콘텐츠명 자동 생성 (각 3개 옵션)

**입력:**
- `scenario` (필수): Step 5에서 받은 시나리오
- `productName` (필수)
- `metadata` (필수)

**기대 출력:**
```json
{
  "status": "success",
  "product_names": [
    "제주용암프리미엄솔트 (기존 유지)",
    "70년 제주의 약속",
    "바다의 선물, 우리 가족의 선택"
  ],
  "content_names": [
    "용암이가 전하는 제주 소금의 맛",
    "70년 기술, 한 숟가락의 신뢰",
    "우리 가족 밥상을 지키는 방법"
  ]
}
```

**실패 대응:**
```javascript
if (namingResult.status !== "success") {
  console.warn("⚠️ 네이밍 생성 실패, 기본값 사용");
  const productName_generated = productName;
  const contentName_generated = "제품 스토리";
} else {
  const productName_generated = namingResult.product_names[0];
  const contentName_generated = namingResult.content_names[0];
  console.log("✅ Step 6 완료: 네이밍 생성됨");
}
```

---

### Step 7: product-intro-writer-agent 또는 product-detail-page-writer-agent 호출

【TimelyAI Sub-agent 호출】

**호출 방식 (requestType = "intro"):**
```
run_subagent("product-intro-writer-agent", {
  category: metadata.categories[0],
  character: selectedCharacter.name,
  productName: productName,
  productInfo: productInfo,
  keywords: keywords,
  videoType: contentType,
  scenario: scenario
})
```

**호출 방식 (requestType = "detail"):**
```
run_subagent("product-detail-page-writer-agent", {
  category: metadata.categories[0],
  character: selectedCharacter.name,
  productName: productName,
  productInfo: productInfo,
  keywords: keywords,
  videoType: contentType,
  scenario: scenario
})
```

**담당**: 박주미  
**역할**: 캐릭터 + 시나리오 기반 카피 생성 (SNS용 또는 상세용)

**입력:**
- `category` (필수): 제품 카테고리
- `character` (필수): 선택된 캐릭터명
- `scenario` (필수): Step 5에서 받은 시나리오
- 기타: productName, productInfo, keywords, videoType

**기대 출력:**
```json
{
  "status": "success",
  "content": "70년 제주 바다의 기술, 이제 당신 가족 밥상의 지킴이...",
  "tone": "따뜨함, 신뢰감",
  "length": 150,
  "includes_medical_claim": false
}
```

**실패 대응:**
```javascript
if (contentResult.status !== "success") {
  throw new Error("❌ 카피 생성 실패. 다시 시도해주세요.");
}
const generatedContent = contentResult.content;
console.log("✅ Step 7 완료: 카피 생성됨");
```

---

### Step 8: compliance-reviewer-agent 호출

【TimelyAI Sub-agent 호출】

**호출 방식:**
```
run_subagent("compliance-reviewer-agent", {
  generatedContent: "70년 제주 바다의 기술...",
  category: metadata.categories[0],
  productName: "제주용암프리미엄솔트"
})
```

**담당**: 박주미  
**역할**: 생성된 카피의 브랜드 가이드 준수 여부 검증

**입력:**
- `generatedContent` (필수): Step 7에서 받은 카피
- `category` (필수)
- `productName` (필수)

**기대 출력:**
```json
{
  "status": "success",
  "validation": {
    "status": "APPROVED",
    "score": 96,
    "issues": [],
    "corrections": []
  }
}
```

**검증 기준:**
- ✅ 의료표현 0개
- ✅ 과장 키워드 ≤ 3개
- ✅ 브랜드보이스 준수도 ≥ 85%
- ✅ 최종 점수 ≥ 80점

**실패 대응:**
```javascript
const validationStatus = complianceResult.validation.status;

if (validationStatus === "REJECTED") {
  throw new Error("❌ 검증 실패: 생성된 콘텐츠를 재검토해주세요");
}

if (validationStatus === "NEEDS REVISION") {
  console.warn("⚠️ 수정 권장:", complianceResult.validation.corrections);
}

console.log("✅ Step 8 완료: 검증 완료, 상태 =", validationStatus);
```

---

### Step 9: 최종 결과 반환

【직접 실행, TimelyAI 호출 없음】

```javascript
return {
  success: true,
  resourceId: resourceId,
  metadata: metadata,
  selectedCharacter: selectedCharacter,
  characterDetail: selectedCharacter.detail || {},
  scenario: scenario,
  productName_generated: productName_generated,
  contentName_generated: contentName_generated,
  generatedContent: generatedContent,
  validation: {
    status: validationStatus,
    score: complianceResult.validation.score,
    corrections: complianceResult.validation.corrections || []
  },
  readyForProduction: validationStatus === "APPROVED",
  readyForHiggsfield: validationStatus === "APPROVED" ? true : false,
  timestamp: new Date().toISOString()
};
```

---

## 전체 호출 순서 (매우 중요!)

```
【Step 1】입력 검증 (TimelyAI 호출 없음)
   ↓
【Step 2】 run_subagent("resource-analyzer-agent", {...})
   ↓
【Step 3】 run_subagent("character-generator-agent", {...})
   ↓
【Step 4】 run_subagent("character-designer-agent", {...}) ⭐ 고수아
   ↓
【Step 5】 run_subagent("shortform-scenario-writer-agent", {...}) ⭐ 고수아
   ↓
【Step 6】 run_subagent("naming-generator-agent", {...}) ⭐ 고수아
   ↓
【Step 7】 run_subagent("product-intro-writer-agent" 또는 "product-detail-page-writer-agent", {...})
   ↓
【Step 8】 run_subagent("compliance-reviewer-agent", {...})
   ↓
【Step 9】 최종 결과 반환
```

---

## 주요 특징

- ✅ **TimelyAI Sub-agent 명시**: 각 단계에서 정확히 어떤 agent를 호출하는지 명확
- ✅ **입출력 구조화**: 각 agent의 입력값과 기대 출력값이 JSON으로 정의됨
- ✅ **에러 처리 명확**: 각 단계에서 실패 시 정확한 대응 방법 명시
- ✅ **선택사항 구분**: character-designer는 선택사항으로 명시되어 실패해도 진행 가능
- ✅ **TimelyAI 호출 방식**: `run_subagent()` 형식으로 TimelyAI 연동 용이

---

## TimelyAI에 이 파일을 업로드할 때 주의사항

1. **Frontmatter 포함**: YAML 형식의 메타데이터도 함께 인식시키기
2. **Sub-agent 목록 명확**: "sub-agents" 섹션에서 호출 순서 명시
3. **각 Step의 호출 방식 명확**: `run_subagent("agent-name", {...})` 형식 일관성
4. **에러 처리 로직**: try-catch와 대체 로직(fallback) 명시

---

✅ **완성! 이 파일을 orchestrator.md로 사용하세요.**

**주요 개선사항**:
- TimelyAI sub-agent 호출 방식 명시
- 각 단계의 입출력 구조 JSON으로 정의
- 에러 처리 및 실패 대응 명확화
- 박주미/고수아 역할 명확화
- Day 2 웹앱 개발 시 이 구조를 따를 수 있도록 설계
