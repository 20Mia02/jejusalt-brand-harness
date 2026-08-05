# product-intro-writer-agent.md

**에이전트 이름**: product-intro-writer-agent  
**버전**: v1.0  
**작성일**: 2026.08.03  
**담당 라인**: 제품 라인 (박주미)  
**연결 Skill**: SKILL_product-intro-writer  

---

## 1. 에이전트의 역할

**SKILL_product-intro-writer를 호출하여 제품 소개 카피를 생성하는 에이전트**

웹앱 사용자가 제품 정보를 입력하면, 이 에이전트는 다음을 수행합니다:

1. 입력 데이터 검증
2. SKILL_product-intro-writer 호출
3. 생성된 카피를 마크다운 형식으로 정렬하여 반환

즉, **"사용자 입력 → 입력 검증 → Skill 호출 → 결과 반환"의 간단한 오케스트레이터 역할**입니다.

---

## 2. 입력 (Input) 명세

### 입력 데이터 구조 (JSON)

```javascript
{
  // 필수 항목
  "category": "식품|뷰티|헬스케어",
  "character": "결이|용암이|해수|미내|현무|가마할방|불이|한라 또는 사용자 정의 캐릭터명",
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증, 70년 전통 기술로 생산",
  "videoType": "캐릭터소개|제품스토리|일상밥상 또는 동적으로 추가된 영상유형",
  
  // 선택 항목
  "keywords": ["프리미엄", "건강", "가족"]
}
```

### 입력 필드 상세

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| **category** | String | ✅ 필수 | 사업 영역 | "식품", "뷰티", "헬스케어" |
| **character** | String | ✅ 필수 | 브랜드 캐릭터명 | "용암이", "해수" |
| **productName** | String | ✅ 필수 | 제품 공식명 | "제주용암프리미엄솔트" |
| **productInfo** | String | ✅ 필수 | 제품 상세 정보 | "나트륨 24.1g/100g..." |
| **videoType** | String | ✅ 필수 | 영상 유형 | "제품스토리" |
| **keywords** | Array[String] | ⚪ 선택 | 강조 키워드 (1~3개) | ["프리미엄", "건강"] |

---

## 3. 출력 (Output) 명세

### 출력 형식 (마크다운)

```markdown
## [카테고리] | [캐릭터명]과 함께하는 [제품명]

## 이 영상이 담은 이야기
[1~2문단: 캐릭터와 제품의 만남, 영상유형에 맞는 스토리]

## 제품 핵심
[2~3개 불릿: 핵심 수치와 특징]

## 추천 사용법
[1~2줄: 구체적인 사용 시나리오]

## SNS 캡션
[1줄: 공유용 캡션]

## 온라인 몰 상품 설명
[3~4줄: 쿠팡/마켓컬리용 설명]
```

### 출력 섹션 상세

| 섹션 | 분량 | 목적 | 톤 |
|------|------|------|-----|
| **제목** | 1줄 | 영상 타이틀 | 명확함 |
| **이 영상이 담은 이야기** | 1~2문단 | 스토리텔링 | 감정적 |
| **제품 핵심** | 2~3개 불릿 | 정보 전달 | 객관적 |
| **추천 사용법** | 1~2줄 | 활용 방법 | 구체적 |
| **SNS 캡션** | 1줄 | SNS 공유 | 임팩트 있게 |
| **온라인 몰 설명** | 3~4줄 | 판매 지원 | 신뢰감 있게 |

---

## 4. 프로세스

### Step 1: 입력 유효성 검증

**목표**: 입력 데이터의 완전성과 유효성 확인

#### 1-1. 필수 항목 확인

```javascript
const requiredFields = [
  "category",
  "character", 
  "productName",
  "productInfo",
  "videoType"
];

for (const field of requiredFields) {
  if (!input[field] || input[field].trim().length === 0) {
    throw new ValidationError(`필수 항목 누락: ${field}이(가) 필요합니다`);
  }
}
```

**에러 메시지**:
```
❌ 필수 항목 누락: category이(가) 필요합니다

필수 항목:
- category (식품 / 뷰티 / 헬스케어)
- character (캐릭터명)
- productName (제품명)
- productInfo (제품 정보)
- videoType (영상 유형)
```

---

#### 1-2. 카테고리 유효성 확인

```javascript
const validCategories = ["식품", "뷰티", "헬스케어"];

if (!validCategories.includes(category)) {
  throw new ValidationError(
    `유효하지 않은 카테고리: ${category}\n` +
    `유효한 값: ${validCategories.join(", ")}`
  );
}
```

**유효한 카테고리**:
- ✅ "식품" (소금 등 식품 라인)
- ✅ "뷰티" (비누, 스크럽 등 뷰티 라인)
- ✅ "헬스케어" (웰니스 제품)

**에러 메시지**:
```
❌ 유효하지 않은 카테고리: [입력값]

유효한 카테고리:
- 식품
- 뷰티
- 헬스케어
```

---

#### 1-3. 캐릭터 유효성 확인

```javascript
const baseCharacters = ["결이", "용암이", "해수", "미내", "현무", "가마할방", "불이", "한라"];

// 기본 캐릭터 또는 사용자 정의 캐릭터 (길이 > 0)
if (!baseCharacters.includes(character) && character.length === 0) {
  throw new ValidationError(
    `유효하지 않은 캐릭터: ${character}\n` +
    `기본 캐릭터: ${baseCharacters.join(", ")}\n` +
    `또는 새로운 캐릭터명을 입력하세요`
  );
}
```

**유효한 캐릭터**:
- ✅ 기본 8개: 결이, 용암이, 해수, 미내, 현무, 가마할방, 불이, 한라
- ✅ 사용자 정의: 새로운 캐릭터명 (길이 > 0)

**에러 메시지**:
```
❌ 유효하지 않은 캐릭터: [입력값]

기본 캐릭터: 결이, 용암이, 해수, 미내, 현무, 가마할방, 불이, 한라
또는 새로운 캐릭터명을 입력하세요
```

---

#### 1-4. VideoType 유효성 확인

```javascript
const validVideoTypes = ["캐릭터소개", "제품스토리", "일상밥상"];

// 정확한 매칭이 아니라, 포함 여부 확인 (새로운 유형 추가 가능)
if (validVideoTypes.length > 0 && !validVideoTypes.some(t => videoType.includes(t))) {
  // 사용자 정의 videoType도 허용 (길이 > 0)
  if (videoType.length === 0) {
    throw new ValidationError(
      `유효하지 않은 videoType: ${videoType}\n` +
      `유효한 값: ${validVideoTypes.join(", ")}\n` +
      `또는 사용자 정의 영상유형을 입력하세요`
    );
  }
}
```

**유효한 영상유형**:
- ✅ "캐릭터소개" - 캐릭터 자체를 소개
- ✅ "제품스토리" - 제품의 탄생 스토리
- ✅ "일상밥상" - 실제 사용 장면
- ✅ 사용자 정의 (길이 > 0)

---

#### 1-5. ProductInfo 길이 확인

```javascript
const MIN_PRODUCT_INFO_LENGTH = 30; // 최소 30자

if (productInfo.length < MIN_PRODUCT_INFO_LENGTH) {
  console.warn(
    `⚠️ 경고: productInfo가 매우 짧습니다 (${productInfo.length}자)\n` +
    `더 상세한 정보를 제공하면 더 나은 카피가 생성됩니다`
  );
  // 경고만 하고 계속 진행
}
```

**최소 요구사항**: 30자 이상 권장

---

### Step 2: SKILL_product-intro-writer 호출

**목표**: 검증된 입력으로 Skill 호출하여 카피 생성

#### 2-1. 입력 데이터 정리

```javascript
const skillInput = {
  category: category.trim(),
  character: character.trim(),
  productName: productName.trim(),
  productInfo: productInfo.trim(),
  keywords: (keywords && keywords.length > 0) ? keywords : [],
  videoType: videoType.trim()
};
```

#### 2-2. Skill 호출

```javascript
// SKILL_product-intro-writer 호출
// 이 함수는 TimelyAI에서 자동으로 제공됨
let generatedStory;

try {
  generatedStory = await callSkill("product-intro-writer", skillInput);
} catch (error) {
  throw new SkillExecutionError(
    `Skill 호출 실패: ${error.message}\n` +
    `다시 시도해주세요. 지속적으로 실패하면 입력 정보를 확인해주세요:\n` +
    `- productInfo가 충분히 상세한가?\n` +
    `- keywords가 적절한가?\n` +
    `- character가 존재하는가?`
  );
}
```

#### 2-3. 결과 검증

```javascript
if (!generatedStory || generatedStory.trim().length === 0) {
  throw new SkillExecutionError(
    `카피 생성 실패: Skill에서 빈 결과를 반환했습니다\n` +
    `다시 시도해주세요`
  );
}

if (!generatedStory.includes("##")) {
  throw new SkillExecutionError(
    `카피 형식 오류: 마크다운 형식이 아닙니다\n` +
    `Skill의 출력 형식을 확인해주세요`
  );
}
```

---

### Step 3: 결과 포맷팅 및 반환

**목표**: 생성된 카피를 정렬하여 사용자에게 반환

#### 3-1. 메타데이터 추가

```javascript
const result = {
  status: "success",
  content: generatedStory,
  metadata: {
    category: category,
    character: character,
    productName: productName,
    videoType: videoType,
    generatedAt: new Date().toISOString(),
    skillVersion: "v1.0",
    agentVersion: "v1.0"
  }
};
```

#### 3-2. 결과 반환

```javascript
return {
  success: true,
  data: result,
  message: `${productName}의 ${category} 카피가 생성되었습니다`
};
```

#### 3-3. 반환 형식

```javascript
{
  success: true,
  data: {
    status: "success",
    content: "## 식품 | 용암이와 함께하는 제주용암프리미엄솔트\n\n...",
    metadata: {
      category: "식품",
      character: "용암이",
      productName: "제주용암프리미엄솔트",
      videoType: "제품스토리",
      generatedAt: "2026-08-03T14:30:00Z",
      skillVersion: "v1.0",
      agentVersion: "v1.0"
    }
  },
  message: "제주용암프리미엄솔트의 식품 카피가 생성되었습니다"
}
```

---

## 5. 사용 예시

### 예시 1: 식품 + 용암이 + 제품스토리

#### 입력

```javascript
{
  "category": "식품",
  "character": "용암이",
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증, 70년 전통 기술로 생산",
  "keywords": ["프리미엄", "건강", "가족"],
  "videoType": "제품스토리"
}
```

#### 출력

```markdown
## 식품 | 용암이와 함께하는 제주용암프리미엄솔트

## 이 영상이 담은 이야기

70년을 제주 바다에서 지켜온 용암이가 처음으로 우리 가족 밥상에 올라가는 날입니다.
당신의 밥상을 포근하게 감싸주고, 모든 밥이 맛있어지는 순간을 경험하세요.

## 제품 핵심
- 나트륨 24.1g/100g (일반 소금 대비 40% 감소) — 더 가볍게, 더 건강하게
- 마그네슘 6,370mg/100g, 규소 90mg/100g — 제주 해수에만 있는 자연의 선물
- 제주 청정 인증 — 병원균·중금속 검출 안 됨 / 70년 전통 기술의 신뢰

## 추천 사용법
아침 밥, 점심 국, 저녁 반찬. 모든 밥상에 올려보세요.
당신의 가족이 "이거 뭐야?" 하는 순간이 올 거예요.

## SNS 캡션
"70년 제주 바다의 기술, 이제 당신 가족 밥상의 지킴이가 되어줍니다 🧂"

## 온라인 몰 상품 설명
제주의 용암해수에서 건져낸 프리미엄 소금입니다.
70년의 기술력으로 나트륨은 낮추고 마그네슘은 높였습니다.
병원균·중금속 검출 없는 제주 인증 제품이며, 모든 밥상의 기본이 되어줍니다.
```

---

### 예시 2: 뷰티 + 해수 + 캐릭터소개

#### 입력

```javascript
{
  "category": "뷰티",
  "character": "해수",
  "productName": "제주용암솔트비누",
  "productInfo": "멜로시라 함유 (항염증·항산화, 자연 유래), 부드러운 스크럽 효과, 마그네슘·칼슘으로 피부 보습, 제주 용암해수 추출",
  "keywords": ["자연유래", "정성", "미니멀"],
  "videoType": "캐릭터소개"
}
```

#### 출력

```markdown
## 뷰티 | 해수의 정성스러운 스크럽 케어

## 이 영상이 담은 이야기

신비롭고 우아한 해수가 당신의 피부에 정성을 담아 봅니다.
제주 해수의 미네랄과 자연 유래 성분으로, 주 1~2회 당신을 위한 시간을 만들어보세요.
과하지 않은 미니멀 케어로, 피부는 더 건강하게 빛나기 시작할 거예요.

## 제품 핵심
- 멜로시라 함유 (항염증·항산화, 자연 유래) — 자연이 주는 보살핌
- 부드러운 스크럽 효과 — 자극 최소, 각질은 명확하게
- 마그네슘·칼슘의 깊은 보습 — 제주 해수의 미네랄이 피부 깊숙이 전달됨

## 추천 사용법
주 1~2회, 얼굴과 목에 부드럽게 마사지해주세요.
제주 해수의 미네랄이 피부 깊숙이 보습을 전달합니다.

## SNS 캡션
"제주 해수의 정성, 이제 당신 피부를 정성스럽게 보살깁니다 ✨"

## 온라인 몰 상품 설명
제주 용암해수의 미네랄과 멜로시라를 담은 자연 유래 솔트비누입니다.
부드러운 스크럽으로 주 1~2회, 당신의 피부를 미니멀하고 정성스럽게 관리하세요.
자극 최소의 스크럽 효과로 각질은 명확하게, 보습은 깊게 전달됩니다.
```

---

## 6. 에러 처리

### 에러 타입 및 응답

#### 6-1. ValidationError (입력 검증 실패)

```
❌ 검증 실패

필수 항목 누락: category이(가) 필요합니다

필수 항목:
- category (식품 / 뷰티 / 헬스케어)
- character (캐릭터명)
- productName (제품명)
- productInfo (제품 정보)
- videoType (영상 유형)
```

**원인**:
- 필수 필드 누락
- 잘못된 카테고리
- 잘못된 캐릭터명
- 잘못된 videoType

**해결 방법**:
- 모든 필수 항목 확인
- 유효한 값 목록 확인
- 다시 입력

---

#### 6-2. InvalidCategoryError

```
❌ 유효하지 않은 카테고리: [입력값]

유효한 카테고리:
- 식품
- 뷰티
- 헬스케어
```

---

#### 6-3. InvalidCharacterError

```
❌ 유효하지 않은 캐릭터: [입력값]

기본 캐릭터: 결이, 용암이, 해수, 미내, 현무, 가마할방, 불이, 한라
또는 새로운 캐릭터명을 입력하세요
```

---

#### 6-4. SkillExecutionError (Skill 호출 실패)

```
❌ Skill 호출 실패

카피 생성 과정에서 오류가 발생했습니다.
다시 시도해주세요.

지속적으로 실패하면 입력 정보를 확인해주세요:
- productInfo가 충분히 상세한가? (최소 30자 이상)
- keywords가 적절한가?
- character가 존재하는가?
```

**원인**:
- Skill 내부 오류
- 불충분한 productInfo
- Skill 서버 문제

**해결 방법**:
- productInfo를 더 상세하게 입력
- keywords 추가
- 다시 시도

---

#### 6-5. OutputFormatError (출력 형식 오류)

```
❌ 카피 형식 오류

생성된 카피의 마크다운 형식이 올바르지 않습니다.
Skill의 출력 형식을 확인해주세요.
```

---

### 경고 메시지 (계속 진행 가능)

#### 짧은 productInfo 경고

```
⚠️ 경고: productInfo가 매우 짧습니다 (15자)

더 상세한 정보를 제공하면 더 나은 카피가 생성됩니다:
- 제품 성분과 함량
- 기술/인증 정보
- 사용 방법
- 특징/효능

계속하시겠습니까? (Y/N)
```

---

## 7. 프로세스 플로우 다이어그램

```
┌─────────────────────┐
│   사용자 입력       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│   Step 1: 입력 유효성 검증      │
├─────────────────────────────────┤
│ ✓ 필수 항목 확인                 │
│ ✓ 카테고리 유효성                │
│ ✓ 캐릭터 유효성                  │
│ ✓ VideoType 유효성               │
│ ✓ ProductInfo 길이               │
└──────────┬──────────────────────┘
           │
      ┌────┴────┐
      │          │
   실패 ───────→ 에러 반환
      │
      성공
      │
      ▼
┌──────────────────────────────────┐
│   Step 2: SKILL 호출             │
├──────────────────────────────────┤
│ → SKILL_product-intro-writer     │
│ ← 마크다운 카피                   │
└──────────┬───────────────────────┘
           │
      ┌────┴────┐
      │          │
   실패 ───────→ 에러 반환
      │
      성공
      │
      ▼
┌──────────────────────────────────┐
│   Step 3: 결과 포맷팅            │
├──────────────────────────────────┤
│ + 메타데이터 추가                 │
│ + 성공 메시지                     │
│ + 출력 정렬                       │
└──────────┬───────────────────────┘
           │
           ▼
┌─────────────────────┐
│   최종 결과 반환    │
└─────────────────────┘
```

---

## 8. 사용 흐름

### 웹앱 입장에서의 사용 흐름

```
웹앱 사용자가 제품 정보 입력
   ↓
입력 폼 검증 (프론트엔드)
   ↓
product-intro-writer-agent 호출
   │
   ├─ Step 1: 입력 유효성 검증
   │   └─ 실패 → 에러 메시지 표시
   │
   ├─ Step 2: SKILL_product-intro-writer 호출
   │   └─ 실패 → 재시도 옵션
   │
   └─ Step 3: 결과 포맷팅
       └─ 성공 → 마크다운 카피 표시
   ↓
사용자가 생성된 카피 확인
   ↓
"SNS 게시", "몰 복사", "수정" 버튼 제공
```

---

## 9. 주요 특징

### 9-1. 간단한 구조

- 단일 Skill 호출
- 복잡한 로직 없음
- 빠른 응답 시간
- 유지보수 용이

### 9-2. 철저한 입력 검증

- 필수 항목 확인
- 유효성 체크
- 사전 에러 방지
- 명확한 에러 메시지

### 9-3. 명확한 에러 처리

- 에러 타입별 분류
- 구체적인 해결 방법 제시
- 사용자 친화적 메시지
- 로깅 기능

### 9-4. 메타데이터 추가

- 생성 타임스탐프
- Skill 버전 추적
- 에이전트 버전 추적
- 사용 이력 관리 가능

---

## 10. 다른 에이전트와의 연동

### product-detail-page-writer-agent와의 차이

| 항목 | product-intro-writer-agent | product-detail-page-writer-agent |
|------|--------------------------|--------------------------------|
| **출력 길이** | 짧음 (약 500단어) | 길음 (약 1500단어) |
| **출력 형식** | 6개 섹션 | 9개 섹션 |
| **사용 목적** | SNS, 영상 스크립트 | 온라인 몰 상세페이지 |
| **Skill** | product-intro-writer | product-detail-page-writer |
| **생성 시간** | 빠름 (1~2초) | 느림 (2~3초) |

### claim-safety-checker-agent와의 연동

```
product-intro-writer-agent
        ↓ (생성된 카피)
product-intro-writer 결과
        ↓
claim-safety-checker-agent
        ↓ (검증)
✅ APPROVED / ⚠️ NEEDS REVISION / ❌ REJECTED
        ↓
사용자에게 최종 결과 반환
```

---

## 11. 버전 관리

| 버전 | 날짜 | 상태 | 변경사항 |
|------|------|------|---------|
| v1.0 | 2026.08.03 | 확정 | 초기 버전 완성. 3단계 프로세스, 상세한 입력 검증, 2개 완전한 예시 포함 |

---

## 12. FAQ

### Q1: 새로운 캐릭터를 만들 수 있나요?

**A**: 네, 가능합니다. 기본 8개 캐릭터(`결이`, `용암이`, `해수`, `미내`, `현무`, `가마할방`, `불이`, `한라`) 외에 사용자 정의 캐릭터명을 입력할 수 있습니다. 다만, 캐릭터명이 최소 1글자 이상이어야 합니다.

---

### Q2: productInfo는 얼마나 상세해야 하나요?

**A**: 최소 30자 이상을 권장합니다. 더 상세할수록 더 정확한 카피가 생성됩니다:
- 제품 성분과 함량 (수치)
- 기술/인증 정보
- 사용 방법
- 특징/효능

---

### Q3: 같은 제품으로 여러 캐릭터의 카피를 만들 수 있나요?

**A**: 네, 가능합니다. 같은 `productName`과 `productInfo`로 다른 `character`를 입력하면 각 캐릭터의 톤으로 다른 버전의 카피를 얻을 수 있습니다.

---

### Q4: 생성된 카피를 수정할 수 있나요?

**A**: 웹앱에서 "수정" 버튼을 통해 생성된 카피를 직접 편집할 수 있습니다. 다만, claim-safety-checker-agent로 다시 검증할 것을 권장합니다.

---

### Q5: 에러가 계속 발생하면 어떻게 하나요?

**A**: 다음을 확인해주세요:
1. productInfo가 30자 이상인가?
2. category, character, videoType이 유효한가?
3. productInfo에 구체적인 수치가 있는가?

여전히 실패하면 기술 지원팀에 문의해주세요.

---

## 13. 체크리스트

### 배포 전 확인 항목

- [ ] 입력 검증이 모든 필수 항목을 확인하는가?
- [ ] 에러 메시지가 명확하고 해결 방법을 제시하는가?
- [ ] Skill 호출 로직이 정확한가?
- [ ] 메타데이터가 정확하게 추가되는가?
- [ ] 모든 예시가 올바르게 작동하는가?
- [ ] 타임아웃 처리가 있는가? (권장: 10초)
- [ ] 로깅이 구현되었는가?

---

**작성 완료**: product-intro-writer-agent.md v1.0

이 파일은 **TimelyAI의 에이전트 명세서** 형식으로 작성되었습니다.  
웹앱에서 사용자 입력을 받아 SKILL_product-intro-writer를 호출하여  
마크다운 형식의 제품 카피를 생성하는 **간단하고 효율적인 오케스트레이터**입니다. 📌

