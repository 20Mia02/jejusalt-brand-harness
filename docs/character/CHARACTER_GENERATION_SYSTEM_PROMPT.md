캐릭터 생성 시스템을 고도화해줘. **귀여움이 최우선**인 키링/피규어 수준의 캐릭터를 만들되, 누가 봐도 매력적으로 느낄 수 있게 구현하고, 한번 확정된 캐릭터는 다음 사용시마다 일관성 있게 유지되어야 해.

## 배경

현재 캐릭터 생성이 매번 다르게 나오는 문제가 있음. 이를 해결하기 위해:
1. 캐릭터 설정을 중앙화 (Character Design Library) - **귀여움 중심**
2. 자동으로 개선해주는 에이전트 추가 (Character Refinement Agent) - **귀여움 스코어 최우선**
3. 일관성 유지 시스템 구축 (Reference Image + 프롬프트 버전 관리)

## 핵심 원칙: **귀여움이 모든 결정의 중심**

이 시스템의 최우선 목표:
- 누가 봐도 "아, 귀여워!" 라고 느낄 수 있는 캐릭터
- 손에 집고 싶은 피규어, 키링 같은 느낌
- 보는 사람의 마음을 따뜻하게 만드는 표정과 눈
- 디테일은 귀여움을 해치지 않는 범위에서만

## 요구사항

### 1. Character Design Library (신규 파일: backend/config/characters.json)

8개 캐릭터 각각에 대해 다음 정보를 JSON으로 정의:

```json
{
  "characters": [
    {
      "id": 1,
      "name": "용암이",
      "description": "70년 제주 바다의 기술을 담은 따뜻한 아버지 캐릭터",
      "personalityKeywords": ["따뜻함", "신뢰감", "낮은 목소리", "경험많음"],
      "colorPalette": {
        "primary": "#2C5282",
        "secondary": "#8B6F47",
        "accent": "#F5E6D3"
      },
      "accessories": {
        "hair": "흰머리 섞인 검은머리, 내려앉은 스타일",
        "clothing": "전통 남색 옷, 주름 많은 손",
        "scarf": "요트 색 남색 스카프",
        "others": "시계, 낡은 반지"
      },
      "worldviewTags": ["제주", "따뜻함", "70년전통", "바다", "장인정신"],
      "higgsfieldPromptTemplate": "EXTREMELY CUTE Korean figurine character, warm gentle expression with sparkling eyes, soft rounded face, cozy deep sea-blue traditional outfit, adorable smile that makes people smile when they see it, keychain quality cute illustration, warm golden hour lighting, Jeju ocean background, merchandise/figurine level adorableness, no text overlay",
      "versionHistory": [
        {
          "version": "v1.0",
          "date": "2026-08-07",
          "improvements": "Initial design - basic character outline",
          "referenceImageUrl": "/character-references/1/v1.0.png"
        }
      ],
      "currentVersion": "v1.0",
      "referenceImageUrl": "/character-references/1/v1.0.png"
    },
    {
      "id": 2,
      "name": "결이",
      "description": "제주 해수의 첫 인상을 닮은 맑은 캐릭터",
      "personalityKeywords": ["맑음", "청순", "밝음", "희망"],
      "colorPalette": {
        "primary": "#FFFFFF",
        "secondary": "#4A90E2",
        "accent": "#FFD700"
      },
      "accessories": {
        "hair": "긴 생머리, 소금결 같은 하이라이트",
        "clothing": "순백 드레스, 소금결 모티프",
        "scarf": "옅은 파란색 투명 스카프",
        "others": "소금결 팔찌, 진주 귀걸이"
      },
      "worldviewTags": ["제주", "청정", "희망", "바다", "맑음"],
      "higgsfieldPromptTemplate": "ADORABLE cute Korean girl figurine character, big sparkling innocent eyes, soft smiling expression with warmth and hope, pure white elegant dress with subtle salt crystal patterns, long beautiful hair, standing on Jeju beach with golden sunlight, keychain quality merchandise-grade cuteness, absolutely charming illustration style, makes everyone's heart warm when they see it, no text overlay",
      "versionHistory": [
        {
          "version": "v1.0",
          "date": "2026-08-07",
          "improvements": "Initial design",
          "referenceImageUrl": "/character-references/2/v1.0.png"
        }
      ],
      "currentVersion": "v1.0",
      "referenceImageUrl": "/character-references/2/v1.0.png"
    },
    {
      "id": 3,
      "name": "가마할방",
      "description": "70년 기술의 무게를 짊어진 장인 캐릭터",
      "personalityKeywords": ["장인정신", "견고함", "따뜻함", "헌신"],
      "colorPalette": {
        "primary": "#3D2817",
        "secondary": "#8B4513",
        "accent": "#FF6B35"
      },
      "accessories": {
        "hair": "흰머리, 단정한 단발",
        "clothing": "갈색 앞치마, 전통 옷",
        "scarf": "주황색 리본",
        "others": "목걸이, 손가락 반지"
      },
      "worldviewTags": ["장인", "전통", "제주", "따뜻함", "기술"],
      "higgsfieldPromptTemplate": "LOVABLE CUTE elderly Korean craftsperson figurine, warm kind grandmotherly expression with twinkling eyes, soft round face showing wisdom and gentleness, brown apron, standing before traditional iron pot with steam rising, warm firelight glow, detailed hands showing 70 years of love and care, hanok traditional background, keychain quality merchandise cuteness, heartwarming cozy illustration style, makes people feel comforted when they see it, no text overlay",
      "versionHistory": [
        {
          "version": "v1.0",
          "date": "2026-08-07",
          "improvements": "Initial design",
          "referenceImageUrl": "/character-references/3/v1.0.png"
        }
      ],
      "currentVersion": "v1.0",
      "referenceImageUrl": "/character-references/3/v1.0.png"
    }
  ]
}
```

각 캐릭터마다:
- **id**: 고유 번호 (1-8)
- **name**: 캐릭터명
- **description**: 한줄 설명
- **personalityKeywords**: 성격 키워드 배열
- **colorPalette**: primary/secondary/accent 색상코드
- **accessories**: 머리카락, 옷, 스카프, 기타 액세서리 상세 설명
- **worldviewTags**: 공통 세계관 태그 ("제주", "따뜻함", "70년전통" 등)
- **higgsfieldPromptTemplate**: Higgsfield 영상 생성용 고도화 프롬프트
- **versionHistory**: 버전별 개선 내용 기록
- **currentVersion**: 현재 적용 버전
- **referenceImageUrl**: 현재 버전의 reference 이미지 경로

모든 8개 캐릭터를 위와 같은 구조로 정의.

### 2. Character Refinement Agent (신규 파일: backend/agents/character-refinement-agent.js)

입력:
- generatedImageUrl: 생성된 캐릭터 이미지 URL
- originalPrompt: 원본 Higgsfield 프롬프트
- characterId: 캐릭터 ID
- characterConfig: characters.json에서 로드한 캐릭터 설정

역할 (3가지 평가 기준) - **귀여움이 최우선**:

1. **cutenessScore** (0-100) - **최우선 기준 (50% 비중)**
   - 캐릭터가 얼마나 귀여운가? (누가 봐도 매력적인가?)
   - 평가 항목 (점수 높은 순):
     * 눈: 크고 살아있고 따뜻한 느낌 (30점)
     * 얼굴 비율: 둥근 얼굴, 큰 눈, 작은 입, 부드러운 곡선 (15점)
     * 표정: 따뜻하고 친근하고 다가가고 싶은 미소 (15점)
     * 전체 매력: 피규어/키링처럼 손에 집고 싶은 느낌 (20점)
     * 색상: 따뜻하고 부드러운 톤 (10점)
     * 포즈: 자연스럽고 사랑스러운 자세 (10점)

2. **detailScore** (0-100) - **보조 기준 (30% 비중)**
   - 액세서리, 의상, 특징이 얼마나 선명하고 디테일 있는가?
   - 평가 항목: 머리카락 질감, 스카프/액세서리 선명도, 손 주름, 의류 패턴
   - 단, "귀여움을 해치지 않는 범위 내에서"

3. **consistencyScore** (0-100) - **필수 기준 (20% 비중)**
   - 이전 버전(reference)과 얼마나 일관성 있는가?
   - 평가 항목: 얼굴 형태, 색상 팔레트, 특징
   - 귀여움이 유지되었는가가 중요

**overallScore** = (cutenessScore × 0.50) + (detailScore × 0.30) + (consistencyScore × 0.20)

출력:
```json
{
  "scores": {
    "cutenessScore": 85,
    "detailScore": 78,
    "consistencyScore": 92,
    "overallScore": 85
  },
  "feedback": {
    "cutenessStrengths": "눈의 표현이 귀엽다",
    "cutenessWeaknesses": "입술이 너무 큼",
    "detailStrengths": "머리카락 질감이 좋다",
    "detailWeaknesses": "스카프 디테일이 부족하다",
    "consistencyStrengths": "색상 팔레트가 일치한다",
    "consistencyWeaknesses": "얼굴 형태가 약간 다르다"
  },
  "improvedPrompt": "더 개선된 Higgsfield 프롬프트",
  "recommendedChanges": [
    "입술을 조금 더 작게",
    "스카프의 자수 패턴 더 선명하게",
    "눈의 크기는 유지"
  ],
  "shouldRetry": true,
  "retryCount": 1
}
```

**자동 개선 루프** - **cutenessScore가 핵심**:
- **cutenessScore < 80**: 반드시 재시도 (귀여움이 부족함)
- overallScore < 80: 반드시 재시도
- 80 ≤ overallScore < 85: 재시도 권장 (cutenessScore 개선 여지 있음)
- overallScore ≥ 85 AND cutenessScore ≥ 85: 만족 (저장)
- 최대 3회 재시도

**귀여움 재시도 전략**:
- cutenessScore가 낮으면 프롬프트에 CUTE 관련 키워드 추가
- "adorable", "charming", "lovable", "melts hearts" 등 강조
- 눈, 표정, 얼굴 비율에 더 집중
- 디테일은 귀여움을 해치지 않는 범위 내에서만

### 3. Character Consistency Manager (신규 파일: backend/services/character-consistency.js)

영상 생성 전 호출하는 서비스:

**getCharacterReferenceData(characterId, versionOverride?)**
- 캐릭터의 최신 (또는 지정된) 버전 정보 로드
- reference image URL 제공
- 현재 프롬프트 템플릿 제공
- 액세서리 정보 제공

**addVersionToPrompt(basePrompt, characterId, version)**
- 프롬프트에 자동으로 버전 정보 추가
- 예: "Reference v2.1, consistent with previous designs, signature color: #2C5282"

**updateCharacterVersion(characterId, newVersion, improvements, newReferenceImageUrl)**
- 새 버전 생성시 호출
- versionHistory에 추가
- currentVersion 업데이트
- referenceImageUrl 변경

### 4. Frontend UI 개선 (jejusalt-frontend/src/components/GenerationUI.jsx)

캐릭터 선택 화면:
- 각 캐릭터의 최신 생성 이미지를 프리뷰로 표시
- 버전 정보 표시 (예: "v2.1")
- "캐릭터 진화 보기" 버튼 → 클릭시 이전 버전들 슬라이드 쇼
- 버전 선택 옵션:
  * "최신 버전 사용" (기본)
  * "특정 버전 선택" (드롭다운)

캐릭터 선택 후:
- 선택된 캐릭터의 reference image를 영상 생성 화면에 작게 표시
- "이 캐릭터의 최신 버전(v2.1)으로 생성됩니다" 텍스트 표시

### 5. Backend API 변경 (backend/routes/generation.js)

**POST /api/generate/character** (신규 또는 기존 수정)

요청:
```json
{
  "characterId": 1,
  "resourceId": "uuid",
  "versionOverride": null, // optional, 특정 버전 강제
  "videoType": "제품스토리",
  "duration": 15
}
```

처리:
1. Character Consistency Manager에서 reference data 로드
2. Refinement Agent 초기화 (reference image 설정)
3. Higgsfield로 영상 생성 (--image-references 자동 추가)
4. 생성된 영상 프리뷰 이미지 추출
5. Refinement Agent 자동 평가
6. 만족도 < 85% → improvedPrompt로 재시도 (최대 3회)
7. 최종 결과가 85% 이상 또는 3회 시도 완료:
   - characters.json의 versionHistory에 기록
   - 새 버전 생성 (v1.1, v2.0 등)
   - reference image 저장
   - 사용자에게 반환

응답:
```json
{
  "success": true,
  "videoUrl": "https://...",
  "characterId": 1,
  "characterName": "용암이",
  "currentVersion": "v2.0",
  "cutenessMessage": "정말 귀여워요! 누구나 사랑할 만한 매력이 있어요 ❤️",
  "overallScore": 87,
  "refinementFeedback": {
    "cutenessScore": 88,
    "cutenessDetails": "눈이 정말 따뜻하고 표정이 사랑스러워요",
    "detailScore": 86,
    "detailDetails": "스카프와 손의 세부 표현이 예뻐요",
    "consistencyScore": 87,
    "consistencyDetails": "이전 버전과 일관성 있게 귀여움이 유지돼요"
  },
  "versionHistory": [
    { "version": "v1.0", "date": "2026-08-07", "score": 78, "cutenessScore": 75 },
    { "version": "v1.1", "date": "2026-08-07", "score": 82, "cutenessScore": 82 },
    { "version": "v2.0", "date": "2026-08-07", "score": 87, "cutenessScore": 88 }
  ],
  "nextVersionSuggestion": "v2.1 (눈의 반짝임을 더 강조해서 더 매력적으로)"
}
```

### 6. 자동 개선 루프 상세

```
사용자: "용암이로 영상 생성"
  ↓
1. Consistency Manager: 용암이 v2.0 데이터 로드
   - reference image: /character-references/1/v2.0.png
   - prompt: "Warm Korean man... (v2.0 기준 프롬프트)"
  ↓
2. Refinement Agent 초기화
   - reference image 로드: v2.0.png
   - 비교 기준 설정
  ↓
3. Higgsfield 영상 생성
   - --image-references /character-references/1/v2.0.png 추가
   - 프롬프트: "Reference v2.0, consistent with signature blue scarf..."
  ↓
4. 영상 생성 완료 → 프리뷰 이미지 추출
  ↓
5. Refinement Agent 평가
   - cutenessScore: 86
   - detailScore: 82
   - consistencyScore: 89
   - overallScore: 85.5 (만족!)
  ↓
6. 만족도 >= 85%
   - versionHistory에 추가: { "version": "v2.0.1", "score": 85.5, ... }
   - currentVersion 유지 (v2.0 소수점 업데이트)
   - 사용자에게 반환
  ↓
사용자 화면: "용암이 v2.0으로 영상 생성 완료! (품질점수: 85.5/100)"
```

### 7. 프롬프트 버전 진화 예시 - **귀여움이 핵심**

**v1.0** (초기 - 귀여움 기본):
```
Cute warm Korean man in his 50s, deep sea-blue traditional clothes, 
kind expression, Jeju ocean background, keychain quality
```

**v1.1** (첫 개선 - 귀여움 강조):
```
CUTE warm Korean man figurine, big kind sparkling eyes, soft round face,
deep sea-blue traditional clothes with cozy feel,
gentle smile that makes people smile,
detailed hands showing wisdom and care,
golden hour Jeju background, warm gentle lighting,
keychain/figurine quality cute illustration style
```

**v2.0** (재설계 - 귀여움 극대화):
```
EXTREMELY ADORABLE Korean grandfather figurine character,
sparkly warm kind eyes in soft rounded face, gentle heartwarming smile,
signature deep sea-blue (#2C5282) traditional hanbok,
blue silk scarf, weathered loving hands with character wrinkles,
warm loving expression that touches the heart,
golden hour Jeju coastal setting with soft dreamy lighting,
merchandise-grade cute illustration style, keychain quality adorableness,
makes everyone's heart warm, no text overlay
```

**v2.1** (현재 - 극도의 귀여움):
```
PRECIOUS CUTE figurine character that melts people's hearts,
extremely kind warm eyes with gentle sparkle, soft chubby rounded cheeks,
perfectly adorable expression mixing wisdom and warmth,
signature deep sea-blue color (#2C5282), secondary warm brown (#8B6F47),
traditional hanbok with soft comfortable look, distinctive cozy blue scarf,
beautifully detailed weathered hands showing 70 years of loving care,
standing in golden hour Jeju ocean with magical soft lighting,
premium cute illustration style, absolutely charming and lovable,
merchandise quality keychain/figurine level detail and appeal,
consistency with v2.0 but with enhanced cute factor, no on-screen text
```

### 8. 데이터 저장 구조

```
backend/
├── config/
│   └── characters.json (중앙 캐릭터 설정)
├── agents/
│   └── character-refinement-agent.js (자동 평가 + 개선)
├── services/
│   └── character-consistency.js (일관성 관리)
├── public/
│   └── character-references/
│       ├── 1/ (용암이)
│       │   ├── v1.0.png
│       │   ├── v1.1.png
│       │   └── v2.0.png
│       ├── 2/ (결이)
│       │   └── v1.0.png
│       ├── 3/ (가마할방)
│       │   └── v1.0.png
│       └── ...
├── routes/
│   └── generation.js (위의 POST /api/generate/character 추가)
```

### 9. 검증 방법

1. 캐릭터 1(용암이) 선택 → 영상 생성
   - overallScore가 출력되는지 확인
   - characters.json에 v1.0 버전이 기록되는지 확인
   - reference image가 저장되는지 확인

2. 같은 캐릭터로 다시 생성
   - 이전 reference image를 --image-references로 사용하는지 확인
   - 같은 캐릭터가 일관성있게 나오는지 확인
   - 버전이 v1.0.1 또는 그대로 v1.0인지 확인

3. Refinement Agent 평가
   - cutenessScore, detailScore, consistencyScore가 모두 출력되는지 확인
   - overallScore < 75일 때 자동 재시도되는지 확인
   - 최대 3회 재시도 후 결과가 반환되는지 확인

4. UI에서 캐릭터 진화 보기
   - "캐릭터 진화 보기" 버튼 클릭시 이전 버전들 슬라이드 표시 확인
   - 버전별 점수 표시 확인

5. 버전 선택 기능
   - "특정 버전 선택" 드롭다운에서 v1.0, v1.1 등 선택 가능한지 확인
   - 특정 버전으로 생성시 그 버전의 reference image를 사용하는지 확인
