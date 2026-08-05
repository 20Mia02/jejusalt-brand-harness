# character-generator-agent.md

**에이전트 이름**: character-generator-agent  
**버전**: v2.0 (v3 설계 시스템 통합)  
**작성일**: 2026.08.03 | 업데이트: 2026.08.06  
**담당 라인**: 제품 라인 (박주미)  
**연결 Skill**: SKILL_character-generator  
**참조 파일**: `config.json` (v3 캐릭터 데이터), `SYSTEM_PROMPT_CHARACTER_CREATOR_V3.md` (AI 지침)  

---

## 1. 에이전트의 역할

**SKILL_character-generator를 호출하여 AI가 자동으로 제품에 맞는 캐릭터를 생성하는 에이전트**

🌟 **발표 핵심 기능**: "AI가 제품 정보를 분석하여 자동으로 최적의 캐릭터를 추천하거나 새로운 캐릭터를 만듭니다!"

웹앱 사용자가 제품을 입력하면, 이 에이전트는 다음을 수행합니다:

1. 입력 데이터 검증 (특히 resource-analyzer 결과인 metadata 확인)
2. SKILL_character-generator 호출
3. 생성된 3개 캐릭터 분석 및 정렬 (기본 → 새로운 캐릭터)
4. 선택 가이드와 함께 반환

즉, **"제품 정보 + 메타데이터 → AI 분석 → 최적 캐릭터 3개 자동 추천"의 스마트 캐릭터 매칭 시스템**입니다.

---

## 2. 입력 (Input) 명세

### 입력 데이터 구조 (JSON)

```javascript
{
  // 필수 항목
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증, 70년 전통 기술로 생산",
  
  // 선택 항목
  "keywords": ["프리미엄", "건강", "가족"],
  
  // 필수: resource-analyzer의 결과물
  "metadata": {
    "categories": ["식품", "헬스케어"],
    "ageGroups": ["40~60대"],
    "genders": ["무관"],
    "targets": ["가족밥상", "건강관심층"],
    "focus": ["신뢰", "건강", "기술"]
  }
}
```

### 입력 필드 상세

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| **productName** | String | ✅ 필수 | 제품 공식명 | "제주용암프리미엄솔트" |
| **productInfo** | String | ✅ 필수 | 제품 상세 정보 | "나트륨 24.1g/100g..." |
| **metadata** | Object | ✅ 필수 | resource-analyzer 결과 | {categories, ageGroups, targets, focus} |
| **keywords** | Array[String] | ⚪ 선택 | 추가 키워드 | ["프리미엄", "건강"] |

### metadata 필수 필드

```javascript
{
  "categories": ["식품"|"뷰티"|"헬스케어"],      // 1~2개
  "ageGroups": ["40~60대"|"20~30대"|"무관"],      // 1~2개
  "genders": ["남성"|"여성"|"무관"],               // 1개
  "targets": ["가족밥상"|"개인케어"|...],        // 1~3개
  "focus": ["신뢰"|"건강"|"기술"|...],           // 2~5개
  "characters": ["용암이"|"현무"|...],            // (선택) 기본 캐릭터 선호도
  "confidence": 0.85                              // (선택) 분석 신뢰도
}
```

---

## 3. 출력 (Output) 명세

### 출력 형식 (마크다운)

```markdown
## 추천 캐릭터 (3개)

### 캐릭터 1: [캐릭터명]
**타입**: 기본 / 새로운 캐릭터

**프로필**
- **이름**: [캐릭터명]
- **한 줄 설명**: [간단한 소개]
- **특징**: [특징 3~4개]
- **강조점**: [강조점 2~3개]
- **목소리 톤**: [톤 설명]

**프로필 상세**
[2~3문단: 캐릭터의 깊이 있는 설명]

**이 제품과의 어울림**
[3~4개 포인트: 왜 이 캐릭터가 이 제품에 맞는가]

**추천 메시지**
> "[이 캐릭터라면 이렇게 표현할 메시지]"

---

## 선택 가이드

| 캐릭터 | 추천 상황 | 어울리는 키워드 |
|---|---|---|
| [캐릭터1] | [어떤 경우에 선택할까] | [관련 키워드] |
```

### 출력 섹션 상세

| 섹션 | 분량 | 목적 | 톤 |
|------|------|------|-----|
| **캐릭터 1~3** | 3개 캐릭터 | 선택지 제공 | 매력적으로 |
| **프로필** | 5개 항목 | 캐릭터 기본 정보 | 명확함 |
| **상세설명** | 2~3문단 | 캐릭터 깊이 | 감정적 |
| **어울림** | 3~4포인트 | 제품과의 일치 | 논리적 |
| **추천메시지** | 1줄 | 톤 예시 | 캐릭터 스타일 |
| **선택가이드** | 테이블 | 선택 기준 | 실용적 |

---

## 4. 캐릭터 타입

### 기본 캐릭터 (8개)

```
1. 결이 (당찬 소금알갱이, 12세 소년)
   → 시작, 변화, 희망 강조할 때

2. 용암이 (따뜨한 아버지, 50대)
   → 가족, 함께, 밥상 강조할 때

3. 해수 (신비롭고 우아한 여성, 40대)
   → 정성, 우아함, 뷰티 강조할 때

4. 미내 (밝고 포용적인 누나, 30대)
   → 응원, 공감, 함께 강조할 때

5. 현무 (신뢰로운 형, 40대)
   → 신뢰, 건강, 과학 강조할 때

6. 가마할방 (따뜬한 할아버지, 70대)
   → 전통, 기술, 역사 강조할 때

7. 불이 (발랄한 친구, 25세 여성)
   → 활기, 에너지, 재미 강조할 때

8. 한라 (지혜로운 할머니, 70대)
   → 역사, 신화, 자연 강조할 때
```

### 새로운 캐릭터 ⭐ 발표 핵심!

```
AI가 제품의 metadata를 분석하여 기존 8개 캐릭터로 부족할 때
새로운 캐릭터를 동적으로 생성합니다.

예: "소한" (20대 감성, 미니멀 철학)
예: "태양" (에너지, 활기 중심)
예: "달빛" (차분함, 밤 시간 중심)

→ 발표 데모에서 보여주기 좋은 기능!
```

---

## 5. 프로세스

### Step 1: 입력 유효성 검증

**목표**: 입력 데이터의 완전성과 유효성 확인

#### 1-1. 필수 항목 확인

```javascript
const requiredFields = ["productName", "productInfo", "metadata"];

for (const field of requiredFields) {
  if (!input[field] || input[field].toString().trim().length === 0) {
    throw new ValidationError(`필수 항목 누락: ${field}이(가) 필요합니다`);
  }
}
```

**에러 메시지**:
```
❌ 필수 항목 누락: metadata이(가) 필요합니다

필수 항목:
- productName (제품명)
- productInfo (제품 정보)
- metadata (resource-analyzer 결과)
  - categories
  - ageGroups
  - targets
  - focus
```

---

#### 1-2. 메타데이터 완전성 확인

```javascript
const requiredMetadataFields = ["categories", "ageGroups", "targets", "focus"];

const missingFields = requiredMetadataFields.filter(
  field => !metadata[field] || 
  (Array.isArray(metadata[field]) && metadata[field].length === 0)
);

if (missingFields.length > 0) {
  throw new ValidationError(
    `메타데이터가 불완전합니다\n` +
    `누락된 필드: ${missingFields.join(", ")}\n` +
    `resource-analyzer를 먼저 실행해주세요`
  );
}
```

**에러 메시지**:
```
❌ 메타데이터 불완전

필수 메타데이터 필드:
- categories (사업 영역)
- ageGroups (타겟 나이대)
- targets (타겟 고객)
- focus (강조점)

resource-analyzer를 먼저 실행해주세요.
```

---

#### 1-3. 제품 정보 길이 확인

```javascript
const MIN_PRODUCT_INFO_LENGTH = 30;

if (productInfo.length < MIN_PRODUCT_INFO_LENGTH) {
  throw new ValidationError(
    `제품 정보가 너무 짧습니다 (${productInfo.length}자)\n` +
    `최소 ${MIN_PRODUCT_INFO_LENGTH}자 이상의 정보가 필요합니다`
  );
}
```

---

### Step 2: SKILL_character-generator 호출

**목표**: 검증된 입력으로 Skill 호출하여 캐릭터 생성

#### 2-1. 입력 데이터 정리

```javascript
const skillInput = {
  productName: productName.trim(),
  productInfo: productInfo.trim(),
  keywords: (keywords && keywords.length > 0) ? keywords : [],
  metadata: {
    categories: metadata.categories,
    ageGroups: metadata.ageGroups,
    genders: metadata.genders || ["무관"],
    targets: metadata.targets,
    focus: metadata.focus,
    characters: metadata.characters || [],        // 기존 캐릭터 선호도
    confidence: metadata.confidence || 0.5        // 분석 신뢰도
  }
};
```

#### 2-2. Skill 호출

```javascript
let generatedCharacters;

try {
  generatedCharacters = await callSkill("character-generator", skillInput);
} catch (error) {
  throw new SkillExecutionError(
    `캐릭터 생성 실패: ${error.message}\n` +
    `다시 시도해주세요.\n` +
    `지속적으로 실패하면 제품 정보를 확인해주세요:\n` +
    `- productInfo가 충분히 상세한가?\n` +
    `- metadata가 정확한가? (categories, ageGroups, targets, focus)`
  );
}
```

#### 2-3. 결과 검증

```javascript
if (!generatedCharacters || generatedCharacters.length === 0) {
  throw new SkillExecutionError(
    `캐릭터 생성 실패: Skill에서 결과를 반환하지 않았습니다\n` +
    `다시 시도해주세요`
  );
}

if (generatedCharacters.length < 3) {
  console.warn(
    `⚠️ 경고: 생성된 캐릭터가 3개 미만입니다 (${generatedCharacters.length}개)`
  );
}

// 각 캐릭터의 필수 필드 확인
for (const char of generatedCharacters) {
  if (!char.name || !char.description || !char.type) {
    throw new SkillExecutionError(
      `캐릭터 데이터 오류: 필수 필드가 누락되었습니다`
    );
  }
}
```

---

### Step 3: 결과 분석 및 정렬

**목표**: 생성된 캐릭터를 분석하고 최적으로 정렬

#### 3-1. 캐릭터 정렬 (기본 → 새로운 캐릭터)

```javascript
const baseCharacters = generatedCharacters.filter(c => c.type === "기본");
const newCharacters = generatedCharacters.filter(c => c.type === "새로운 캐릭터");

// 기본 캐릭터 순서 보존, 새 캐릭터는 뒤에
const sortedCharacters = [...baseCharacters, ...newCharacters].slice(0, 3);
```

#### 3-2. 선택 가이드 생성

```javascript
const selectionGuide = buildSelectionGuide(sortedCharacters);
// → 각 캐릭터의 추천 상황, 키워드를 테이블로 구성
```

#### 3-3. 메타데이터 추가

```javascript
const analysisResult = {
  characters: sortedCharacters,
  selectionGuide: selectionGuide,
  analysis: {
    bestMatch: sortedCharacters[0],        // 최적 매칭
    baseCharacterCount: baseCharacters.length,
    newCharacterCount: newCharacters.length,
    recommendation: generateRecommendation(sortedCharacters[0])
  }
};
```

---

### Step 4: 결과 반환

**목표**: 분석 결과를 최종 형식으로 반환

#### 4-1. 메타데이터 추가

```javascript
const finalResult = {
  status: "success",
  characters: sortedCharacters,
  selectionGuide: selectionGuide,
  metadata: {
    productName: productName,
    count: sortedCharacters.length,
    baseCharacterCount: baseCharacters.length,
    newCharacterCount: newCharacters.length,
    generatedAt: new Date().toISOString(),
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
  message: `${productName}에 최적화된 ${sortedCharacters.length}개의 캐릭터가 생성되었습니다` +
    (newCharacters.length > 0 ? ` (새로운 캐릭터 ${newCharacters.length}개 포함!)` : "")
};
```

---

## 6. 사용 예시

### 예시 1: 식품 + 기본 캐릭터 3개

#### 입력

```javascript
{
  "productName": "제주용암프리미엄솔트",
  "productInfo": "나트륨 24.1g/100g (일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g, 규소 90mg/100g, 제주 청정 인증, 70년 전통 기술로 생산",
  "keywords": ["프리미엄", "건강", "가족"],
  "metadata": {
    "categories": ["식품"],
    "ageGroups": ["40~60대"],
    "genders": ["무관"],
    "targets": ["가족밥상", "건강관심층"],
    "focus": ["신뢰", "건강", "기술"],
    "confidence": 0.96
  }
}
```

#### 출력

```markdown
## 추천 캐릭터 (3개)

### 캐릭터 1: 용암이
**타입**: 기본

**프로필**
- **이름**: 용암이
- **한 줄 설명**: 70년을 제주 바다에서 지켜온 따뜨한 아버지
- **특징**: 포근함, 신뢰, 보호, 전통
- **강조점**: 가족, 함께, 건강한 밥상
- **목소리 톤**: 따뜨하고 포근하게, 가족을 보호하는 느낌

**프로필 상세**
제주 해수에서 70년을 지켜온 용암이는 당신의 가족 밥상을 보호하는 역할을 합니다.
프리미엄 품질의 낮은 나트륨으로 가족의 건강을 먼저 생각하는 아버지 같은 존재입니다.
"당신의 가족 밥상을 내가 지켜주겠습니다"라는 따뜻한 약속을 전합니다.

**이 제품과의 어울림**
- ✅ 40~60대 가족 타겟에 완벽히 부합
- ✅ "가족밥상" 강조점과 정확히 일치
- ✅ 70년 전통 기술과 아버지 이미지 일맥상통
- ✅ 건강(나트륨 감소) + 신뢰(제주 청정) 동시 표현

**추천 메시지**
> "70년 제주 바다의 기술, 이제 당신 가족 밥상의 지킴이가 되어줍니다."

---

### 캐릭터 2: 가마할방
**타입**: 기본

**프로필**
- **이름**: 가마할방
- **한 줄 설명**: 전통의 지혜와 따뜨함을 담은 할아버지
- **특징**: 전통, 지혜, 따뜨함, 신뢰
- **강조점**: 기술, 오래된 경험, 가족의 건강
- **목소리 톤**: 할아버지 같은 따뜨함, 깊이 있고 진지하게

**프로필 상세**
제주의 역사를 담은 가마할방은 70년 전통 기술의 진정한 의미를 알려줍니다.
"좋은 소금을 찾는 것은 가족의 건강을 생각하는 마음"이라고 전하는 캐릭터입니다.
오랜 시간 검증된 기술과 신뢰도를 강조할 때 최적입니다.

**이 제품과의 어울림**
- ✅ "70년 전통 기술" 강조에 최적
- ✅ 신뢰와 기술의 만남을 완벽히 표현
- ✅ 40~60대 이상 연령층에 큰 호소력
- ✅ 건강한 밥상의 기초라는 메시지 전달

**추천 메시지**
> "할아버지가 70년 지켜온 기술, 이제 당신 가족의 건강한 밥상을 만들어줍니다."

---

### 캐릭터 3: 현무
**타입**: 기본

**프로필**
- **이름**: 현무
- **한 줄 설명**: 신뢰로운 형, 확실한 선택을 함께하는 파트너
- **특징**: 신뢰, 실행, 안정감, 과학
- **강조점**: 건강, 확실함, 기술의 신뢰성
- **목소리 톤**: 신뢰감 있고 명확하게, 과학적이고 책임감 있게

**프로필 상세**
현무는 "건강한 선택"을 객관적 근거와 함께 제시합니다.
나트륨 수치, 마그네슘 함량, 제주 청정 인증 같은 과학적 근거를 강조하는 캐릭터입니다.
"당신의 건강한 결정을 나는 책임지겠습니다"는 신뢰의 메시지를 전합니다.

**이 제품과의 어울림**
- ✅ "나트륨 40% 감소" 정량적 수치 강조에 최적
- ✅ "제주 청정 인증" 기술·과학 요소 강조
- ✅ 건강관심층(40~60대)에 큰 호소력
- ✅ 객관적 신뢰도 제시에 효과적

**추천 메시지**
> "나트륨 24.1g/100g, 마그네슘 6,370mg/100g. 확실한 수치, 확실한 건강입니다."

---

## 선택 가이드

| 캐릭터 | 추천 상황 | 어울리는 키워드 |
|---|---|---|
| 용암이 | 가족 밥상, 함께함, 포근함 강조할 때 | 가족, 일상, 함께, 보호, 밥상 |
| 가마할방 | 전통 기술, 오래된 신뢰 강조할 때 | 기술, 전통, 기초, 세대, 오래됨 |
| 현무 | 건강, 과학적 근거 강조할 때 | 건강, 신뢰, 수치, 과학, 확실함 |

---
```

---

### 예시 2: 뷰티 + 새로운 캐릭터 포함 ⭐

#### 입력

```javascript
{
  "productName": "제주용암솔트비누",
  "productInfo": "멜로시라 함유 (항염증·항산화, 자연 유래), 부드러운 스크럽 효과, 마그네슘·칼슘으로 피부 보습, 제주 용암해수 추출, 주 1~2회 사용",
  "keywords": ["정성", "자연유래", "미니멀"],
  "metadata": {
    "categories": ["뷰티"],
    "ageGroups": ["20~30대", "40~60대"],
    "genders": ["여성"],
    "targets": ["개인케어"],
    "focus": ["감정", "자연성", "정성"],
    "confidence": 0.88
  }
}
```

#### 출력

```markdown
## 추천 캐릭터 (3개) - 새로운 캐릭터 포함! ⭐

### 캐릭터 1: 해수
**타입**: 기본

**프로필**
[프로필 생략...]

**추천 메시지**
> "제주 해수의 정성이 담긴 부드러운 스크럽. 당신을 위한 미니멀한 시간이 됩니다."

---

### 캐릭터 2: 미내
**타입**: 기본

**프로필**
[프로필 생략...]

**추천 메시지**
> "자연이 주는 정성, 함께 응원하며 건강한 피부를 만들어요."

---

### 캐릭터 3: 소한 (새로운 캐릭터) ⭐
**타입**: 새로운 캐릭터

**프로필**
- **이름**: 소한
- **한 줄 설명**: 미니멀 라이프를 추구하는 20대 여성, 자연과 정성을 사랑하는 감성가
- **특징**: 미니멀, 감성, 자연친화, 정성
- **강조점**: 감정, 자연성, 일상의 작은 기쁨
- **목소리 톤**: 감성적이고 차분하게, 감정과 공감 중심

**프로필 상세**
20대 감성의 소한은 "과하지 않은 것의 아름다움"을 알고 있습니다.
자연에서 온 성분으로 주 1~2회 자신을 위한 시간을 소중히 여기며,
스스로를 사랑하는 작은 실천을 우아하게 표현합니다.
제주 자연과 정성 있는 선택이 만나는 순간을 경험하게 합니다.

**이 제품과의 어울림**
- ✅ 미니멀 철학과 정성의 만남 표현에 최적
- ✅ 20~30대 감성층에 완벽히 부합
- ✅ "감정", "감성", "자연성" 강조점 완벽히 표현
- ✅ "당신을 위한 작은 정성"이라는 unique 메시지

**추천 메시지**
> "자연의 정성, 당신을 위한 미니멀 시간. 주 1~2회, 그것으로 충분합니다."

---

## 선택 가이드

| 캐릭터 | 추천 상황 | 어울리는 키워드 |
|---|---|---|
| 해수 | 정성과 우아함, 깊은 보습 강조 | 정성, 자연, 우아함, 미니멀, 깊이 |
| 미내 | 밝고 친근한 응원, 함께함 강조 | 응원, 공감, 함께, 즐거움, 친구 |
| 소한 | 20대 감성, 자신을 사랑하는 마음 강조 | 감성, 일상, 자신감, 감정, 의도적 |

💡 **주목**: 소한은 AI가 이 제품의 특성(미니멀, 정성, 감성)을 분석하여 새로 만든 캐릭터입니다!

---
```

---

## 7. 에러 처리

### 에러 타입 및 응답

#### 7-1. ValidationError (입력 검증 실패)

```
❌ 검증 실패: 필수 항목 누락

필수 항목을 확인해주세요:
- productName (제품명)
- productInfo (제품 정보)
- metadata (resource-analyzer 결과)
```

---

#### 7-2. IncompleteMetadataError

```
❌ 메타데이터 불완전

필수 메타데이터 필드:
- categories (사업 영역)
- ageGroups (타겟 나이대)
- targets (타겟 고객)
- focus (강조점)

resource-analyzer를 먼저 실행해주세요.

현재 상태:
- categories: ✅ 완료
- ageGroups: ❌ 누락
- targets: ✅ 완료
- focus: ✅ 완료
```

---

#### 7-3. InsufficientProductInfoError

```
❌ 제품 정보 부족

제품 정보가 너무 짧습니다 (15자)
최소 30자 이상의 정보가 필요합니다

더 상세한 정보:
- 주요 성분과 함량
- 기술/인증 정보
- 사용 방법
- 타겟 사용자
```

---

#### 7-4. SkillExecutionError (Skill 호출 실패)

```
❌ 캐릭터 생성 실패

다시 시도해주세요.

지속적으로 실패하면 다음을 확인해주세요:
- productInfo가 충분히 상세한가? (최소 30자)
- metadata가 정확한가?
  - categories 설정됨?
  - ageGroups 설정됨?
  - targets 설정됨?
  - focus 설정됨?
```

---

### 경고 메시지

#### 부족한 캐릭터 경고

```
⚠️ 경고: 생성된 캐릭터가 3개 미만입니다 (2개)

더 나은 캐릭터 추천을 위해:
- productInfo를 더 상세하게 작성
- metadata의 focus에 더 많은 강조점 추가
- keywords 추가

계속하시겠습니까? (2개로 진행 / 다시 시도)
```

---

## 8. 프로세스 플로우 다이어그램

```
┌──────────────────────────────────┐
│  resource-analyzer 완료          │
│  (metadata 생성)                 │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│  character-generator-agent 호출  │
│  (사용자가 "캐릭터 추천" 요청)    │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│   Step 1: 입력 검증              │
├──────────────────────────────────┤
│ ✓ 필수 항목 확인                  │
│ ✓ metadata 완전성 확인            │
│ ✓ productInfo 길이 확인           │
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
│   SKILL_character-generator      │
├──────────────────────────────────┤
│ 입력: productInfo + metadata     │
│ 출력: 3개 캐릭터 (기본 또는 新)  │
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
│   Step 3: 결과 분석 & 정렬       │
├──────────────────────────────────┤
│ - 기본 캐릭터와 新 캐릭터 분류  │
│ - 기본 → 新 순서로 정렬         │
│ - 선택 가이드 생성              │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│   Step 4: 결과 반환              │
├──────────────────────────────────┤
│ 3개 캐릭터 프로필              │
│ + 선택 가이드 테이블           │
│ + 새로운 캐릭터 표시 ⭐        │
└─────────────────────────────────┘
```

---

## 9. 웹앱 통합 시나리오

### 사용자 입장에서의 흐름 (발표 데모 포인트!)

```
1️⃣ 제품 정보 입력
   ↓
   
2️⃣ resource-analyzer 자동 실행
   → 메타데이터 생성 (categories, targets, focus 등)
   ↓
   
3️⃣ "캐릭터 추천받기" 버튼 클릭
   ↓
   
4️⃣ character-generator-agent 호출
   ├─ Step 1: 입력 검증 (1초)
   ├─ Step 2: Skill 호출 (2초)
   │  → "AI가 이 제품에 최적의 캐릭터를 분석하는 중..."
   ├─ Step 3: 결과 분석 (1초)
   └─ Step 4: 결과 반환 (0.5초)
   ↓ (총 4~5초)
   
5️⃣ 추천된 3개 캐릭터 표시
   ├─ 캐릭터 1: 용암이 (기본)
   ├─ 캐릭터 2: 가마할방 (기본)
   └─ 캐릭터 3: 소한 (새로운 캐릭터!) ⭐
   ↓
   
6️⃣ 사용자가 캐릭터 선택
   "용암이를 선택합니다"
   ↓
   
7️⃣ 선택된 캐릭터를 다음 단계로 전달
   ├─ product-intro-writer-agent
   ├─ product-detail-page-writer-agent
   └─ product-detail-page-writer-agent
```

### 발표 데모 하이라이트 🌟

```
"AI가 제품 정보와 메타데이터를 분석하여...
자동으로 3개의 최적 캐릭터를 생성합니다!

기존 8개 캐릭터로 부족하면,
AI가 새로운 캐릭터를 동적으로 만들어줍니다!

[데모: 새로운 캐릭터 '소한' 생성 화면]"
```

---

## 10. 다른 에이전트와의 연동

### 통합 워크플로우

```
[사용자 입력]
    ↓
resource-analyzer-agent (메타데이터 생성)
    ↓
character-generator-agent (캐릭터 3개 추천) ⭐
    ↓ (사용자가 캐릭터 선택)
┌───┴───┬───────────┬───────────┐
│       │           │           │
↓       ↓           ↓           ↓
product-intro   product-detail  compliance
-writer-agent   -page-writer    -reviewer
                -agent          -agent
    ↓               ↓               ↓
SNS 카피        상세페이지      검증
(300단어)      (1500단어)    (의료/과장/
                            brand-voice)
    ↓               ↓               ↓
    └───────────┬───────────────┬──┘
                ↓
            [최종 콘텐츠 배포]
```

---

## 11. 주요 특징

### 11-1. AI 자동 캐릭터 생성 ⭐ 발표 핵심!

```
기존: 사용자가 8개 캐릭터 중 선택
→ 새로운: AI가 자동으로 최적 캐릭터 추천 또는 새로 생성!

메타데이터 분석:
- 카테고리 (식품/뷰티/헬스케어)
- 타겟 나이대 (20~30대 / 40~60대)
- 강조점 (신뢰/건강/감정/기술)
↓
최적 캐릭터 3개 추천!
```

### 11-2. 새로운 캐릭터 생성 기능

```
기본 8개로 부족할 때, AI가 동적으로 새로운 캐릭터 생성:
- "소한" (미니멀, 감성, 20대)
- "태양" (활기, 에너지)
- "달빛" (차분함, 밤 중심)
등 무한 확장 가능!

→ 발표에서 강조하면 좋은 기능!
```

### 11-3. 선택 가이드 제공

```
각 캐릭터가 언제 쓰이는지 명확히:

| 캐릭터 | 추천 상황 | 키워드 |
|--------|---------|--------|
| 용암이 | 가족, 함께함 | 가족, 보호, 밥상 |
```

### 11-4. 빠른 처리 (4~5초)

- Step 1: 검증 (1초)
- Step 2: Skill 호출 (2초)
- Step 3-4: 분석 & 반환 (1.5초)

---

## 12. 버전 관리

| 버전 | 날짜 | 상태 | 변경사항 |
|------|------|------|---------|
| v1.0 | 2026.08.03 | 확정 | 초기 버전 완성. AI 자동 생성, 새로운 캐릭터 기능, 2개 완전한 예시 포함 |

---

## 13. FAQ

### Q1: resource-analyzer가 필수인가요?

**A**: 네, 필수입니다. metadata를 생성하기 위해서는 반드시 resource-analyzer를 먼저 실행해야 합니다.

---

### Q2: 새로운 캐릭터가 항상 생성되나요?

**A**: 아니요. 기본 8개로 충분하면 기본 캐릭터만 추천합니다. 메타데이터 분석 결과 기본 캐릭터로 부족할 때만 새로운 캐릭터가 생성됩니다.

---

### Q3: 3개가 아닌 5개 캐릭터를 받을 수 있나요?

**A**: 아니요. 최대 3개입니다 (기본 캐릭터 우선, 새로운 캐릭터는 부족분만).

---

### Q4: 선택한 캐릭터는 어디에 사용되나요?

**A**: product-intro-writer-agent와 product-detail-page-writer-agent에 전달되어, 해당 캐릭터의 톤과 스타일로 콘텐츠가 생성됩니다.

---

### Q5: 캐릭터 생성에 실패하면?

**A**: 다음을 확인해주세요:
1. metadata가 모두 입력되었는가?
2. productInfo가 30자 이상인가?
3. 연결이 정상인가?

그래도 실패하면 시스템 관리자에게 문의해주세요.

---

## 14. 체크리스트

### 배포 전 확인 항목

- [ ] 입력 검증이 모든 필수 항목을 확인하는가?
- [ ] metadata 완전성 검증이 정확한가?
- [ ] productInfo 길이 검증이 정확한가? (최소 30자)
- [ ] Skill 호출 로직이 정확한가?
- [ ] 캐릭터 정렬 순서가 정확한가? (기본 → 새로운 캐릭터)
- [ ] 선택 가이드 테이블이 정확하게 생성되는가?
- [ ] 새로운 캐릭터 표시 (⭐)가 정확한가?
- [ ] 메타데이터가 정확하게 추가되는가?
- [ ] 타임아웃 처리가 있는가? (권장: 10초)
- [ ] 로깅이 구현되었는가?

---

## 15. 발표 하이라이트 🌟

### 핵심 메시지

```
"제주소금 AI 마케팅 엔진의 핵심은 이것입니다!

🎯 사용자가 제품을 입력하면
🤖 AI가 자동으로 최적의 캐릭터를 생성하고
✍️ 그 캐릭터의 톤으로 콘텐츠를 자동 작성합니다!

기존 8개 캐릭터 중 선택이 아니라,
AI가 제품마다 새로운 캐릭터를 만들어낼 수 있습니다!

이것이 우리의 가장 혁신적인 기능입니다!"
```

### 데모 순서

1. resource-analyzer 실행 (제품 정보 분석)
2. character-generator-agent 실행 (캐릭터 자동 생성)
3. 새로운 캐릭터 "소한" 생성 화면 표시 ⭐
4. product-intro-writer 실행 (해당 캐릭터 톤으로 카피 생성)
5. compliance-reviewer 검증 (안전성 확인)

---

**작성 완료**: character-generator-agent.md v1.0

이 파일은 **TimelyAI의 에이전트 명세서** 형식으로 작성되었습니다.  
제주소금 AI 마케팅 엔진의 **가장 혁신적인 기능**으로,  
AI가 자동으로 제품에 맞는 최적의 캐릭터를 추천하거나 새로 생성하는 스마트 시스템입니다. 🌟

