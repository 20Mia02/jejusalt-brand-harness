# claude-api-integration-plan.md — Claude API 웹앱 통합 계획 (수정본)

**작성일**: 2026.08.03  
**수정일**: 2026.08.03 (character-generator 호출 함수 추가)  
**용도**: 웹앱(React)에서 Claude API를 직접 호출하는 방법 정의  
**대상**: backend-agent (내일 구현 기준)

---

## 📋 목적

내일(8/4) 웹앱 기능1, 기능4에서 다음을 실시간으로 처리하기 위함:
- **기능1**: 자료 업로드 시 → resource-analyzer Skill 호출 → 자동 메타데이터 생성
- **기능1**: 메타데이터 생성 후 → character-generator Skill 호출 → 추천 캐릭터 생성 ⭐
- **기능4**: "AI 생성" 버튼 클릭 시 → product-intro-writer Skill 호출 → 실시간 스토리 생성

---

## 🔑 1. API 키 설정

### Step 1: Anthropic API 키 발급받기

**1️⃣ Anthropic 계정 생성**
```
주소: https://console.anthropic.com
1. "Sign Up" 클릭
2. 이메일 + 비밀번호 입력
3. 이메일 인증
```

**2️⃣ API 키 생성**
```
1. 로그인 후 왼쪽 메뉴: "API Keys" 클릭
2. "Create Key" 버튼 클릭
3. 키 복사 (한 번만 보임! ⚠️)
4. 안전한 곳에 저장
```

**3️⃣ Billing 설정 (선택사항)**
```
만약 프리티어 크레딧이 다 쓰면:
1. 왼쪽 메뉴: "Billing"
2. "Add Payment Method" 클릭
3. 신용카드 등록
4. 월 한도 설정 권장 (예: $5)

📊 비용 기준:
- Haiku: $0.80/백만 토큰
- Sonnet: $3/백만 토큰
- 월 100번 호출: 약 $0.30~1
```

---

### Step 2: 프로젝트에 .env 파일 생성

**파일 위치**: `jejusalt-brand-harness/.env`

```bash
# .env (Git에 커밋하면 안 됨!)
REACT_APP_CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

**예시**:
```bash
REACT_APP_CLAUDE_API_KEY=sk-ant-6abcdef1234567890ghijklmnopqrst
```

---

### Step 3: .gitignore에 추가 (보안! 절대 필수!)

```bash
# .gitignore
.env
.env.local
.env.*.local
node_modules/
.DS_Store
```

⚠️ **중요**: API 키를 GitHub에 올리면 누구나 볼 수 있어서 악용 가능!

---

### Step 4: .env.example 파일 생성 (기업 인수인계용)

**파일 위치**: `jejusalt-brand-harness/.env.example`

```bash
# .env.example (Git에 커밋 OK! 실제 키는 없음)

# 제주소금이 자신의 API 키로 교체할 템플릿
REACT_APP_CLAUDE_API_KEY=your_api_key_here
```

**인수인계 시 제주소금에게 설명**:
```
"이 .env.example 파일을 .env로 이름을 바꾸고,
your_api_key_here 부분을 자신의 API 키로 교체하면 됩니다."
```

---

### 🔄 모델 선택 (현재 설정)

**현재 추천**: `claude-sonnet-4-6`
- 정확도 높음 (복잡한 지시사항도 잘 이해)
- 가격 중간
- 우리 작업 (카피라이팅, 검증, 캐릭터 생성)에 최적

```javascript
model: "claude-sonnet-4-6"
```

**나중에 변경하고 싶으면**:
```javascript
// Haiku로 빠르게 (비용 저렴)
model: "claude-haiku-4-5"

// Opus로 매우 정확하게 (비용 비쌈)
model: "claude-opus-4-1"
```

---

## 🛠️ 2. API 호출 함수 설계

### 기본 호출 함수 (공통) - 강화된 버전

```javascript
// utils/claudeApi.js

async function callClaudeAPI(prompt, maxTokens = 1000) {
  // 1️⃣ API 키 확인 (필수!)
  const apiKey = process.env.REACT_APP_CLAUDE_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "❌ API 키가 없습니다!\n" +
      "프로젝트 루트에 .env 파일을 만들고 다음을 입력해주세요:\n" +
      "REACT_APP_CLAUDE_API_KEY=sk-ant-xxxx\n\n" +
      "API 키 발급: https://console.anthropic.com"
    );
  }

  if (!apiKey.startsWith("sk-ant-")) {
    throw new Error(
      "❌ API 키 형식이 잘못되었습니다.\n" +
      "sk-ant- 로 시작해야 합니다.\n" +
      "https://console.anthropic.com에서 확인해주세요."
    );
  }

  try {
    // 2️⃣ API 호출
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,  // ← 박주미 또는 제주소금 키 자동 사용
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",  // ← 필요시 변경 가능
        max_tokens: maxTokens,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    // 3️⃣ 에러 처리
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error(
          "❌ API 키가 잘못되었습니다.\n" +
          "https://console.anthropic.com에서 확인하고 .env를 수정해주세요."
        );
      } else if (response.status === 429) {
        throw new Error(
          "⏳ 요청이 너무 많습니다.\n" +
          "30초 후 다시 시도해주세요."
        );
      } else {
        throw new Error(`API 호출 실패: ${response.status}`);
      }
    }

    // 4️⃣ 응답 처리
    const data = await response.json();
    if (!data.content || !data.content[0]) {
      throw new Error("응답 형식이 올바르지 않습니다.");
    }

    return data.content[0].text;

  } catch (error) {
    console.error("Claude API 오류:", error.message);
    throw error;
  }
}

export default callClaudeAPI;
```

---

### 함수 1: resource-analyzer 호출 (기능1용)

```javascript
// utils/resourceAnalyzer.js
import callClaudeAPI from './claudeApi';

async function analyzeResource(resourceText) {
  const prompt = `
# 역할
너는 제주소금 자료를 분석해서 메타데이터를 자동 생성하는 AI야.

# 입력 자료
${resourceText}

# 분류 기준 (data-schema.md 참고)
- categories: 식품 / 뷰티 / 헬스케어
- ageGroups: 20~30대 / 40~60대 / 60대+
- genders: 여성 / 남성 / 무관
- targets: 개인케어 / 가족밥상 / 운동애호가 / 관광객 / 선물기념품
- characters: 결이 / 용암이 / 해수 / 미내 / 현무 / 가마할방 / 불이 / 한라
- focus: 신뢰 / 기술 / 건강 / 자기관리 / 일상 / 감정 / 자연성

# 출력 형식 (JSON만 출력, 다른 텍스트 없이)
{
  "categories": [...],
  "ageGroups": [...],
  "genders": [...],
  "targets": [...],
  "characters": [...],
  "focus": [...],
  "confidence": 0.0~1.0
}
`;

  const result = await callClaudeAPI(prompt, 500);
  
  try {
    // JSON 파싱 (```json 태그 제거)
    const cleaned = result.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("메타데이터 파싱 실패:", e);
    // 파싱 실패 시 기본값 반환
    return {
      categories: ["식품"],
      ageGroups: ["40~60대"],
      genders: ["무관"],
      targets: ["가족밥상"],
      characters: ["결이"],
      focus: ["일상"],
      confidence: 0.5
    };
  }
}

export default analyzeResource;
```

---

### 함수 2: character-generator 호출 (기능1용 - 캐릭터 자동 생성) ⭐ 새로 추가

```javascript
// utils/characterGenerator.js
import callClaudeAPI from './claudeApi';

async function generateCharacter(resourceMetadata, productName) {
  const { categories, ageGroups, targets, focus } = resourceMetadata;

  const prompt = `
# 역할
너는 제주소금의 새로운 캐릭터를 만드는 AI야.
자료의 특성에 맞는 고유한 캐릭터를 창조하거나 기존 캐릭터 중 최적의 특징을 조합해서 추천해.

# 입력
- 제품명: ${productName}
- 카테고리: ${categories.join(', ')}
- 타겟 나이대: ${ageGroups.join(', ')}
- 타겟 고객: ${targets.join(', ')}
- 강조점: ${focus.join(', ')}

# 기존 기본 캐릭터 8개
- 결이: 당찬 소금알갱이, 주인공, 변화와 신뢰 강조
- 용암이: 따뜻한 아버지, 보호자, 포근함과 함께 강조
- 해수: 신비롭고 우아한 여성, 지혜자, 정성과 자연성 강조
- 미내: 포용적인 누나, 격려자, 밝음과 공감 강조
- 현무: 신뢰로운 형, 실행자, 안정감과 신뢰 강조
- 가마할방: 따뜻한 할아버지, 안정감 제공자, 전통과 따뜻함 강조
- 불이: 발랄한 친구, 응원자, 에너지와 활기 강조
- 한라: 지혜로운 할머니, 수호자, 역사와 지혜 강조

# 출력 형식 (JSON만 출력, 다른 텍스트 없이)
[
  {
    "name": "캐릭터명",
    "description": "한 문장 설명",
    "traits": ["특징1", "특징2", "특징3"],
    "focus": ["강조점1", "강조점2"],
    "recommendation": "이 캐릭터를 추천하는 구체적인 이유",
    "baseCharacter": "결이|용암이|해수|미내|현무|가마할방|불이|한라|새로운캐릭터"
  }
]
`;

  const result = await callClaudeAPI(prompt, 800);
  
  try {
    // JSON 파싱
    const cleaned = result.replace(/```json|```/g, '').trim();
    const characters = JSON.parse(cleaned);
    return Array.isArray(characters) ? characters : [characters];
  } catch (e) {
    console.error("캐릭터 생성 파싱 실패:", e);
    // 파싱 실패 시 기본 추천
    return [
      {
        name: "결이",
        description: "당찬 소금알갱이",
        traits: ["신뢰", "변화", "당찬"],
        focus: ["신뢰", "기술"],
        recommendation: "기본 캐릭터로 시작합니다",
        baseCharacter: "결이"
      }
    ];
  }
}

export default generateCharacter;
```

---

### 함수 3: product-intro-writer 호출 (기능4용)

```javascript
// utils/productIntroWriter.js
import callClaudeAPI from './claudeApi';

async function generateProductIntro(params) {
  const { category, character, productName, productSpec, videoType } = params;

  const prompt = `
# 역할
너는 제주소금의 웹앱 "제품 추천 엔진"의 카테고리별 백엔드 카피 생성자야.
brand-voice.md의 3원칙(정직하게·제주와 기술·일상)을 반드시 지켜.

# 입력
- 카테고리: ${category}
- 캐릭터: ${character}
- 제품명: ${productName}
- 제품 스펙: ${productSpec}
- 영상유형: ${videoType}

# 출력 (마크다운 형식)
## [카테고리] | [캐릭터명]과 함께하는 [제품명]
## 이 영상이 담은 이야기
(1~2문단)
## 제품 핵심 (2~3개 불릿)
## 추천 사용법
## SNS 캡션
## 온라인 몰 상품 설명

# 검증 필수
- 의학적 효능 표현 금지
- 과장 표현 금지 ("최고", "기적", "유일무이" 등)
`;

  const result = await callClaudeAPI(prompt, 1500);
  return result;
}

export default generateProductIntro;
```

---

## 🎨 3. React 컴포넌트에서 사용 예시

### 기능1: UploadCategorizer.jsx (자료 업로드 & 자동 분류 & 캐릭터 생성) ⭐ 수정됨

```javascript
import React, { useState } from 'react';
import analyzeResource from '../utils/resourceAnalyzer';
import generateCharacter from '../utils/characterGenerator';

function UploadCategorizer() {
  const [inputText, setInputText] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [generatedCharacters, setGeneratedCharacters] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Step 1: 메타데이터 분석
      const result = await analyzeResource(inputText);
      setMetadata(result);

      // Step 2: 캐릭터 생성 ⭐
      setIsGeneratingCharacter(true);
      const characters = await generateCharacter(result, inputTitle);
      setGeneratedCharacters(characters);
      
    } catch (e) {
      setError(e.message);
    } finally {
      setIsAnalyzing(false);
      setIsGeneratingCharacter(false);
    }
  };

  return (
    <div>
      <input 
        type="text"
        value={inputTitle}
        onChange={(e) => setInputTitle(e.target.value)}
        placeholder="제품명을 입력하세요..."
      />
      <textarea 
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="제품 정보를 입력하세요..."
      />
      <button onClick={handleAnalyze} disabled={isAnalyzing || isGeneratingCharacter}>
        {isAnalyzing ? "분석 중..." : isGeneratingCharacter ? "캐릭터 생성 중..." : "분석 & 캐릭터 생성"}
      </button>

      {error && <p style={{color: 'red'}}>{error}</p>}
      
      {metadata && (
        <div>
          <h3>자료 분석 결과</h3>
          <p>카테고리: {metadata.categories.join(', ')}</p>
          <p>나이대: {metadata.ageGroups.join(', ')}</p>
          <p>대상: {metadata.targets.join(', ')}</p>
          <p>신뢰도: {(metadata.confidence * 100).toFixed(0)}%</p>
        </div>
      )}

      {generatedCharacters && (
        <div>
          <h3>추천 캐릭터</h3>
          {generatedCharacters.map((char, idx) => (
            <div key={idx} style={{border: '1px solid #ccc', padding: '10px', marginBottom: '10px'}}>
              <h4>{char.name}</h4>
              <p>{char.description}</p>
              <p>특징: {char.traits.join(', ')}</p>
              <p>추천 이유: {char.recommendation}</p>
              <button>이 캐릭터 선택</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UploadCategorizer;
```

---

### 기능4: StoryToVideoFlow.jsx ("AI 생성" 버튼)

```javascript
import React, { useState } from 'react';
import generateProductIntro from '../utils/productIntroWriter';

function StoryToVideoFlow({ selectedResource }) {
  const [character, setCharacter] = useState('결이');
  const [videoType, setVideoType] = useState('제품스토리');
  const [generatedStory, setGeneratedStory] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const story = await generateProductIntro({
        category: selectedResource.metadata.categories[0],
        character: character,
        productName: selectedResource.title,
        productSpec: selectedResource.content,
        videoType: videoType
      });
      setGeneratedStory(story);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <select value={character} onChange={(e) => setCharacter(e.target.value)}>
        <option value="결이">결이</option>
        <option value="용암이">용암이</option>
        <option value="해수">해수</option>
      </select>

      <select value={videoType} onChange={(e) => setVideoType(e.target.value)}>
        <option value="캐릭터소개">캐릭터 소개</option>
        <option value="제품스토리">제품 스토리</option>
        <option value="일상밥상">일상 밥상</option>
      </select>

      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? "AI 생성 중..." : "AI 생성"}
      </button>

      {error && <p style={{color: 'red'}}>{error}</p>}

      {generatedStory && (
        <div>
          <h3>생성된 스토리</h3>
          <textarea 
            value={generatedStory}
            onChange={(e) => setGeneratedStory(e.target.value)}
            rows={15}
          />
          <button>확정 → Higgsfield 연동</button>
        </div>
      )}
    </div>
  );
}

export default StoryToVideoFlow;
```

---

## ⚠️ 4. 에러 처리 전략

### 시나리오별 처리

| 상황 | 처리 방법 |
|---|---|
| **API 키 없음/잘못됨** | ".env 파일을 확인하세요" 메시지 |
| **네트워크 오류** | "인터넷 연결을 확인해주세요" + 재시도 |
| **타임아웃 (10초 이상)** | 로딩 표시 지속, 30초 후 자동 취소 |
| **JSON 파싱 실패** | 기본값으로 대체 + 콘솔 에러 로깅 |
| **API 요청 한도 초과 (429)** | "잠시 후 다시 시도해주세요" |

---

## 🔒 5. 보안 고려사항

### ⚠️ 프로토타입 단계의 한계

**현재 방식 (클라이언트에서 직접 API 호출)의 문제**:
- API 키가 브라우저에 노출됨 (개발자 도구로 확인 가능)
- 프로덕션에서는 절대 사용하면 안 됨

**부트캠프 프로토타입에서는 허용**:
- 시연 목적이므로 임시로 사용 가능
- 발표 시 "실제 운영 시에는 백엔드 서버를 통해 API 호출해야 함"을 언급

### 향후 실제 운영 시 (제주소금이 도입할 때)

```
현재 (프로토타입):
브라우저 → Claude API 직접 호출 (API 키 노출 위험)

향후 (실제 운영):
브라우저 → 자체 백엔드 서버 → Claude API 호출
                ↑
        (API 키는 서버에만 저장, 안전)
```

---

## ✅ 6. 요약: .env 설정 확인표

**오늘(8/3)**: 클로드가 이 문서 작성 ✅

**내일(8/4) 아침**:
- [ ] Anthropic 계정 생성
- [ ] API 키 발급
- [ ] `.env` 파일 생성 (`REACT_APP_CLAUDE_API_KEY=sk-ant-xxxx`)
- [ ] `.env.example` 파일 생성 (템플릿용)
- [ ] `.gitignore`에 `.env` 추가
- [ ] 웹앱 코드에서 API 호출 연결

**발표 후**: 
- `.env.example` 문서와 함께 제주소금에 인수인계

---

## 📊 호출 함수 요약

| 함수 | 용도 | 입력 | 출력 |
|---|---|---|---|
| **callClaudeAPI** | 공통 호출 | prompt, maxTokens | 텍스트 |
| **analyzeResource** ⭐ | 메타데이터 생성 | 자료 텍스트 | JSON metadata |
| **generateCharacter** ⭐ | 캐릭터 생성 | metadata, productName | 캐릭터 배열 |
| **generateProductIntro** | 스토리 생성 | params | 마크다운 텍스트 |

---

**이 계획을 기반으로 내일 backend-agent가 실제 API 통합 코드를 구현합니다!** 🚀
