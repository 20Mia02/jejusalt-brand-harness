# orchestrator.md

## 역할
**모든 Agent를 조율하는 마스터 에이전트** ⭐ 가장 중요!
사용자 입력부터 최종 결과까지 전체 워크플로우를 관리

## 입력
```javascript
{
  "userRequest": "제주용암프리미엄솔트 제품 카피 생성해줘",
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증, 70년 전통 기술로 생산",
  "keywords": ["프리미엄", "건강", "가족"],  // 선택사항
  "requestType": "intro|detail|both",  // 어떤 카피를 원하는가?
  "contentType": "캐릭터소개|제품스토리|일상밥상"  // 선택사항
}
```

## 출력
```markdown
# [제품명] 최종 콘텐츠 생성 결과

## 📊 분석 단계 (resource-analyzer-agent)
[메타데이터 분석 결과]

## 🎭 캐릭터 추천 (character-generator-agent)
[추천 캐릭터 3개]

## ✍️ 카피 생성 (product-intro-writer-agent 또는 product-detail-page-writer-agent)
[생성된 카피]

## ✅ 검증 결과 (compliance-reviewer-agent)
[검증 상태: APPROVED / NEEDS REVISION / REJECTED]

## 🎬 최종 승인
[최종 결과 정리]
```

---

## 프로세스 (5단계 워크플로우)

### Step 1: 입력 유효성 검증
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
```

### Step 2: resource-analyzer-agent 호출
```javascript
// 메타데이터 생성
const analysisResult = await resourceAnalyzerAgent({
  productName: productName,
  productInfo: productInfo,
  keywords: keywords || []
});

if (analysisResult.status !== "success") {
  throw new Error("분석 실패");
}

const metadata = analysisResult.metadata;
```

### Step 3: character-generator-agent 호출
```javascript
// 메타데이터를 기반으로 캐릭터 추천
const characterResult = await characterGeneratorAgent({
  productName: productName,
  productInfo: productInfo,
  keywords: keywords || [],
  metadata: metadata
});

if (characterResult.status !== "success") {
  throw new Error("캐릭터 생성 실패");
}

// 첫 번째 추천 캐릭터 자동 선택 (또는 사용자가 선택 가능)
const selectedCharacter = characterResult.characters[0].name;
```

### Step 4: product-intro-writer-agent 또는 product-detail-page-writer-agent 호출
```javascript
// requestType에 따라 적절한 Agent 호출
let contentResult;

if (requestType === "intro" || requestType === "both") {
  contentResult = await productIntroWriterAgent({
    category: metadata.categories[0],
    character: selectedCharacter,
    productName: productName,
    productInfo: productInfo,
    keywords: keywords || [],
    videoType: contentType || "제품스토리"
  });
}

if (requestType === "detail" || requestType === "both") {
  contentResult = await productDetailPageWriterAgent({
    category: metadata.categories[0],
    character: selectedCharacter,
    productName: productName,
    productInfo: productInfo,
    keywords: keywords || [],
    videoType: contentType || "제품스토리"
  });
}

if (contentResult.status !== "success") {
  throw new Error("콘텐츠 생성 실패");
}

const generatedContent = contentResult.content;
```

### Step 5: compliance-reviewer-agent 호출 (검증)
```javascript
// 생성된 콘텐츠 검증
const complianceResult = await complianceReviewerAgent({
  generatedContent: generatedContent,
  category: metadata.categories[0],
  productName: productName
});

// 검증 결과 확인
const validationStatus = complianceResult.validation.status;

if (validationStatus === "REJECTED") {
  throw new Error("검증 실패: 콘텐츠를 재생성해주세요");
}

if (validationStatus === "NEEDS REVISION") {
  // 수정 사항 제시
  console.log("수정 권장사항:", complianceResult.validation.corrections);
}
```

### Step 6: 최종 결과 반환
```javascript
return {
  status: "success",
  result: {
    productName: productName,
    analysis: metadata,
    selectedCharacter: selectedCharacter,
    generatedContent: generatedContent,
    validation: {
      status: validationStatus,
      score: complianceResult.validation.score,
      corrections: complianceResult.validation.corrections || []
    },
    readyForProduction: validationStatus === "APPROVED",
    timestamp: new Date().toISOString()
  }
};
```

---

## 사용 예시

### 입력
```javascript
{
  "userRequest": "제주용암프리미엄솔트 제품 소개 카피 생성",
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증, 70년 전통 기술로 생산",
  "keywords": ["프리미엄", "건강", "가족"],
  "requestType": "intro",
  "contentType": "제품스토리"
}
```

### 출력
```markdown
# 제주용암프리미엄솔트 최종 콘텐츠 생성 결과

## 📊 분석 단계 (resource-analyzer-agent)
✅ 메타데이터 자동 생성 완료
- 카테고리: 식품, 헬스케어
- 나이대: 40~60대
- 대상: 가족밥상, 건강관심층
- 강조점: 신뢰, 건강, 기술
- 신뢰도: 0.96/1.0 (매우 높음)

## 🎭 캐릭터 추천 (character-generator-agent)
✅ 3개 캐릭터 추천 완료
1️⃣ **용암이** (기본) - 70년을 제주 바다에서 지켜온 따뜻한 아버지
   → 선택됨! (가족밥상 + 신뢰 강조에 최적)
2️⃣ **가마할방** (기본) - 전통의 지혜와 따뜻함을 담은 할아버지
3️⃣ **현무** (기본) - 신뢰로운 형, 확실한 선택을 함께하는 파트너

## ✍️ 카피 생성 (product-intro-writer-agent)
✅ 영상 스토리 생성 완료

### 식품 | 용암이와 함께하는 제주용암프리미엄솔트

**이 영상이 담은 이야기**
70년을 제주 바다에서 지켜온 용암이가 처음으로 우리 가족 밥상에 올라가는 날입니다.
당신의 밥상을 포근하게 감싸주고, 모든 밥이 맛있어지는 순간을 경험하세요.

**제품 핵심**
- 나트륨 24.1g/100g (일반 소금 대비 40% 감소) — 더 가볍게, 더 건강하게
- 마그네슘 6,370mg/100g, 규소 90mg/100g — 제주 해수에만 있는 자연의 선물
- 제주 청정 인증 — 병원균·중금속 검출 안 됨 / 70년 전통 기술의 신뢰

**추천 사용법**
아침 밥, 점심 국, 저녁 반찬. 모든 밥상에 올려보세요.
당신의 가족이 맛의 차이를 느끼는 순간이 올 거예요.

**SNS 캡션**
"70년 제주 바다의 기술, 이제 당신 가족 밥상의 지킴이가 되어줍니다 🧂"

**온라인 몰 상품 설명**
제주의 용암해수에서 건져낸 프리미엄 소금입니다.
70년의 기술력으로 나트륨은 낮추고 마그네슘은 높였습니다.
병원균·중금속 검출 없는 제주 인증 제품이며, 모든 밥상의 기본이 되어줍니다.

## ✅ 검증 결과 (compliance-reviewer-agent)
✅ 최종 검증 완료 (APPROVED)

**종합 점수**: 96/100
**판정**: APPROVED (바로 사용 가능!)

검증 항목:
- ✅ 의료 표현 검사: PASSED
- ✅ 과장 표현 검사: PASSED
- ✅ brand-voice 준수도: PASSED
  - 정직하게: ✅ 객관적 수치 사용
  - 제주와 기술: ✅ 70년 기술 강조
  - 일상 함께함: ✅ 가족 밥상 시나리오

## 🎬 최종 승인

✅ **이 콘텐츠는 바로 사용 가능합니다!**

**다음 단계**:
1. 선택된 캐릭터: **용암이**
2. 생성된 콘텐츠: **영상 스토리** (위 참조)
3. 상태: **APPROVED** (검증 완료)
4. 생산 준비: **완료!**

---
**Higgsfield 영상 생성 또는 마케팅에 바로 사용하실 수 있습니다!**
```

---

## 에러 처리 및 재시도 로직

### 메타데이터 생성 실패 → 재시도
```javascript
try {
  const analysisResult = await resourceAnalyzerAgent(...);
} catch (error) {
  console.log("❌ 분석 실패:", error.message);
  throw new Error("제품 정보를 다시 확인하고 더 자세히 입력해주세요");
}
```

### 캐릭터 생성 실패 → 기본 캐릭터 사용
```javascript
try {
  const characterResult = await characterGeneratorAgent(...);
} catch (error) {
  console.log("⚠️ 캐릭터 생성 실패, 기본 캐릭터 사용");
  const selectedCharacter = "결이";  // 기본값
}
```

### 콘텐츠 생성 실패 → 사용자에게 알림
```javascript
try {
  contentResult = await productIntroWriterAgent(...);
} catch (error) {
  throw new Error("카피 생성 실패. 다시 시도해주세요.");
}
```

### 검증 실패 (REJECTED) → 재생성 권유
```javascript
if (validationStatus === "REJECTED") {
  throw new Error(
    "❌ 검증 실패\n" +
    "문제: " + complianceResult.validation.corrections.map(c => c.문제).join(", ") + "\n" +
    "조치: 카피를 다시 생성해주세요"
  );
}
```

---

## 상세 설명

### 역할 요약
- **마스터 에이전트**: 모든 Agent를 순차적으로 호출
- **워크플로우 관리**: 6단계 프로세스 자동 실행
- **에러 처리**: 각 단계에서 실패하면 적절히 대응
- **최종 검증**: compliance-reviewer-agent로 품질 보증

### 호출 순서 (매우 중요!)
```
1️⃣ resource-analyzer-agent (메타데이터 생성)
   ↓
2️⃣ character-generator-agent (캐릭터 추천, 메타데이터 사용)
   ↓
3️⃣ product-intro-writer-agent 또는 product-detail-page-writer-agent (카피 생성, 캐릭터 사용)
   ↓
4️⃣ compliance-reviewer-agent (검증)
   ↓
5️⃣ 최종 결과 반환
```

### 주요 특징
- ✅ **완전 자동화**: 사용자가 제품명 + 제품정보만 입력하면 끝!
- ✅ **5단계 워크플로우**: 분석 → 캐릭터 → 생성 → 검증 → 승인
- ✅ **에러 처리**: 각 단계에서 안전하게 대응
- ✅ **최종 품질 보증**: compliance-reviewer-agent로 검증
- ✅ **웹앱의 완성형**: 모든 Agent가 조화를 이루는 마지막 단계

### 웹앱 전체 시스템
```
사용자 입력 (제품명 + 제품정보)
   ↓
✅ Orchestrator (최종 마스터 에이전트)
   ├─ resource-analyzer-agent
   ├─ character-generator-agent
   ├─ product-intro-writer-agent
   ├─ product-detail-page-writer-agent
   └─ compliance-reviewer-agent
   ↓
최종 검증된 콘텐츠 반환
   ↓
Higgsfield 영상 생성 또는 마케팅에 사용!
```

---

✅ **완성! 이 파일을 orchestrator.md로 저장해주세요.**
