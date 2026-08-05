# resource-analyzer-agent.md

## 역할
SKILL_resource-analyzer를 호출하여 **사용자 입력 제품 정보를 자동 분석**하는 에이전트
(메타데이터 자동 생성: 카테고리, 나이대, 대상, 캐릭터, 강조점, 신뢰도)
⭐ 웹앱 시작점! (사용자 입력 → 메타데이터 생성 → character-generator & product-intro-writer로 연결)

## 입력
```javascript
{
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증, 70년 전통 기술로 생산",
  "keywords": ["프리미엄", "건강", "가족"]  // 선택사항
}
```

## 출력
JSON 형식의 메타데이터 + 분석 결과
```json
{
  "categories": ["식품", "헬스케어"],
  "ageGroups": ["40~60대"],
  "genders": ["무관"],
  "targets": ["가족밥상", "건강관심층"],
  "characters": ["용암이", "현무"],
  "focus": ["신뢰", "건강", "기술"],
  "confidence": 0.96,
  "analysis": {
    "reasoning": "명확한 수치, 제주 청정 인증, 70년 기술 등 구체적 근거 다수"
  }
}
```

## 출력 (마크다운 형식 분석 결과 포함)
```markdown
## 📊 제품 분석 결과

### 자동 분석 결과 (JSON)
```json
{...}
```

### 분석 상세 설명

#### 1. 카테고리 (Categories)
분석: [왜 이 카테고리들을 선택했는가?]

#### 2. 나이대 (Age Groups)
분석: [타겟 나이대 추정 이유]

#### 3. 성별 (Genders)
분석: [성별 관계 분석]

#### 4. 대상 (Targets)
분석: [고객 유형/사용 목적 분석]

#### 5. 캐릭터 (Characters)
분석: [추천 캐릭터와 이유]

#### 6. 강조점 (Focus)
분석: [콘텐츠의 주요 강조 방향]

#### 7. 신뢰도 (Confidence)
분석 신뢰도: X/100
```

---

## 프로세스

### Step 1: 입력 유효성 검증
```javascript
// 필수 항목 확인
if (!productName || !productInfo) {
  throw new Error("필수 항목 누락: productName과 productInfo가 필요합니다");
}

// productName이 충분한 길이인지 확인
if (productName.length < 3) {
  throw new Error("제품명이 너무 짧습니다 (최소 3자)");
}

// productInfo가 충분한 길이인지 확인
if (productInfo.length < 30) {
  throw new Error("제품 정보가 너무 짧습니다. 더 상세히 입력해주세요.");
}

// 키워드 텍스트를 배열로 변환 (선택사항)
const keywordsArray = keywords 
  ? (typeof keywords === 'string' 
      ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : keywords)
  : [];
```

### Step 2: SKILL_resource-analyzer 호출
```javascript
// 분석 입력 데이터 정리
const analysisInput = {
  productName: productName,
  productInfo: productInfo,
  keywords: keywordsArray
};

// SKILL 호출 (메타데이터 자동 생성)
const analysisResult = await analyzeResource(analysisInput);
```

### Step 3: 결과 검증 및 포맷팅
```javascript
// 필수 필드 확인
const requiredFields = ["categories", "ageGroups", "targets", "focus", "confidence"];
const hasAllFields = requiredFields.every(field => analysisResult[field]);
if (!hasAllFields) {
  throw new Error("분석 결과가 불완전합니다");
}

// 신뢰도 범위 확인 (0.0 ~ 1.0)
if (analysisResult.confidence < 0 || analysisResult.confidence > 1) {
  throw new Error("신뢰도 값이 유효하지 않습니다");
}

// 배열 필드가 비어있지 않은지 확인
if (analysisResult.categories.length === 0 || 
    analysisResult.focus.length === 0) {
  throw new Error("분석 결과에 필수 정보가 누락되었습니다");
}
```

### Step 4: 결과 반환
```javascript
return {
  status: "success",
  metadata: analysisResult,
  productInfo: {
    name: productName,
    info: productInfo,
    keywords: keywordsArray
  },
  formattedResult: {
    // 다음 단계 (character-generator, product-intro-writer)에서 사용
    readyForCharacterGeneration: true,
    readyForContentGeneration: true
  },
  timestamp: new Date().toISOString()
};
```

---

## 사용 예시

### 입력 1 (상세한 제품 정보 + 키워드)
```javascript
{
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증 획득, 70년 전통 기술로 생산",
  "keywords": ["프리미엄", "건강", "가족"]
}
```

### 출력 1
```markdown
## 📊 제품 분석 결과: 제주용암프리미엄솔트

### 자동 분석 결과 (JSON)
```json
{
  "categories": ["식품", "헬스케어"],
  "ageGroups": ["40~60대"],
  "genders": ["무관"],
  "targets": ["가족밥상", "건강관심층"],
  "characters": ["용암이", "현무"],
  "focus": ["신뢰", "건강", "기술"],
  "confidence": 0.96,
  "analysis": {
    "reasoning": "명확한 수치(나트륨, 마그네슘, 규소), 제주 청정 인증, 70년 기술 등 구체적 근거 다수"
  }
}
```

### 분석 상세 설명

#### 1. 카테고리 (Categories): 식품 + 헬스케어
분석: 
- "소금"은 기본 식품 카테고리
- "나트륨 40% 감소", "건강" 키워드로 보아 헬스케어 관점도 중요
- 따라서 식품 + 헬스케어 2개 카테고리로 분류

#### 2. 나이대 (Age Groups): 40~60대
분석:
- "가족 밥상" 키워드 → 가족을 생각하는 성인 (보통 40대 이상)
- "건강" 강조 → 건강에 신경 쓰는 연령대
- "전통 기술" → 신뢰성을 중시하는 연령대

#### 3. 성별 (Genders): 무관
분석:
- "소금"은 남녀 구분 없이 모두 사용
- "가족 밥상"은 남녀 모두에게 해당
- 성별 차이를 보여주는 키워드 없음

#### 4. 대상 (Targets): 가족밥상 + 건강관심층
분석:
- "가족 밥상" 키워드 직접 매칭
- "건강", "나트륨 감소" → 건강에 관심 있는 사람들

#### 5. 캐릭터 (Characters): 용암이 + 현무
분석:
- **용암이**: "가족 밥상"과 "함께" 강조 → 따뜻한 아버지 최적
- **현무**: "신뢰", "건강", 수치 강조 → 신뢰로운 형 최적

#### 6. 강조점 (Focus): 신뢰 + 건강 + 기술
분석:
- **신뢰**: "제주 청정 인증" → 신뢰도 강조
- **건강**: "나트륨 40% 감소" → 건강 강조
- **기술**: "70년 전통 기술" → 기술/노하우 강조

#### 7. 신뢰도 (Confidence): 0.96 (매우 높음)
분석 신뢰도 점수:
- ✅ 명확한 수치 3개 (나트륨, 마그네슘, 규소): +0.3
- ✅ 제주 청정 인증 명시: +0.2
- ✅ 70년 기술 명시: +0.2
- ✅ 키워드 3개 제공: +0.1
- ✅ 모호한 표현 없음: +0.16
- **최종**: 0.96/1.0
```

---

### 입력 2 (모호한 정보, 신뢰도 낮음)
```javascript
{
  "productName": "제주 미네랄 비누",
  "productInfo": "제주에서 만든 좋은 비누입니다",
  "keywords": []
}
```

### 출력 2
```markdown
## 📊 제품 분석 결과: 제주 미네랄 비누

### 자동 분석 결과 (JSON)
```json
{
  "categories": ["뷰티"],
  "ageGroups": ["무관"],
  "genders": ["무관"],
  "targets": ["개인케어"],
  "characters": ["해수"],
  "focus": ["자연성"],
  "confidence": 0.52,
  "analysis": {
    "reasoning": "매우 모호한 표현으로 분석 신뢰도가 낮음. 구체적 수치나 특징 부재"
  }
}
```

### 분석 상세 설명

#### 신뢰도 (Confidence): 0.52 (중간 이하)
**⚠️ 개선 권장사항**: 다음 정보를 추가하면 분석이 정확해집니다:
- 주요 성분/수치
- 용도 (얼굴용/바디용)
- 타겟 연령대/성별
- 특징 (천연재료, 항염증 등)
- 기술/인증 정보

**다시 입력하시면 더 정확한 분석 결과를 얻을 수 있습니다.**
```

---

## 에러 처리

### 필수 항목 누락
```
❌ 에러: 필수 항목 누락
필수 항목을 확인해주세요:
- productName (제품명, 최소 3자)
- productInfo (제품 정보, 최소 30자)

선택사항:
- keywords (키워드, 콤마로 구분)
```

### 제품 정보가 너무 짧음
```
❌ 에러: 제품 정보가 불충분합니다
더 자세한 정보를 입력해주세요:
- 성분 정보 또는 수치
- 특징/혜택
- 인증 정보
- 기술/기원

최소 30자 이상 입력해주세요.
```

### SKILL 호출 실패
```
❌ 에러: 분석 실패
다시 시도해주세요.
지속적으로 실패하면 제품 정보를 확인해주세요:
- 한글 또는 영문 혼용 확인
- 특수 문자 제거
- 더 자세한 설명 추가
```

### 분석 결과가 불완전
```
❌ 에러: 분석 결과가 불완전합니다
분석에 필요한 정보:
- categories (카테고리)
- ageGroups (나이대)
- targets (대상)
- focus (강조점)
- confidence (신뢰도)

제품 정보를 다시 입력하거나 더 자세히 작성해주세요.
```

---

## 상세 설명

### 역할 요약
- **입력**: 제품명 + 제품정보 + 키워드 (선택사항)
- **처리**: SKILL_resource-analyzer 호출
- **출력**: JSON 메타데이터 + 마크다운 분석 결과

### 웹앱 시스템의 시작점! ⭐
```
사용자가 제품명 + 제품정보 입력
   ↓
resource-analyzer-agent 호출 (메타데이터 자동 생성)
   ↓
character-generator-agent로 캐릭터 추천 전달
   ↓
product-intro-writer 또는 product-detail-page-writer 호출
   ↓
최종 카피 생성
```

### 신뢰도 계산 규칙

**신뢰도 높음** (0.85~1.0):
- 명확한 수치 여러 개
- 인증 정보 있음
- 기술/노하우 명시
- 구체적 설명

**신뢰도 중간** (0.65~0.84):
- 부분적인 수치
- 일부 모호한 표현
- 키워드는 많지만 구체성 부족

**신뢰도 낮음** (0.0~0.64):
- 매우 모호한 표현
- 근거 없는 주장
- 최소한의 정보만 제공

### 사용 흐름
```
사용자 입력
   ↓
입력 유효성 검증
   ↓
SKILL_resource-analyzer 호출
   ↓
JSON 메타데이터 + 분석 설명 생성
   ↓
다음 Agent (character-generator, product-intro-writer 등)에 메타데이터 전달
```

### 주요 특징
- 웹앱의 **시작점** (사용자 입력 처리)
- **메타데이터 자동 생성** (다른 Agent가 사용할 데이터)
- 신뢰도 기반 분석 (낮으면 개선 권장사항 제시)
- 명확한 에러 메시지 (사용자가 정보 보완 가능)

---

**완성! 이 파일을 resource-analyzer-agent.md로 저장해주세요.**
