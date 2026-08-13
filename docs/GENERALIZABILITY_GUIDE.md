# 범용성 설명서 (2D: 다른 브랜드 적용)

## 개요
config.json을 수정하여 다른 브랜드/제품에도 쉽게 적용할 수 있는 구조입니다.

---

## 1단계: config.json 설정

### 파일 위치
```
프로젝트 루트/
  └─ config.json  (설정 파일, 없으면 기본값 사용)
```

### 생성 방법
```bash
# 루트 디렉토리에서
cp config.json.example config.json
```

---

## 2단계: 브랜드 정보 수정

### 기본 정보
```json
{
  "brand": {
    "name": "새로운브랜드",
    "nameKorean": "새로운 브랜드 한글명",
    "nameEnglish": "NEW BRAND ENGLISH NAME",
    "description": "제품 또는 브랜드 소개 문구",
    "categories": ["카테고리1", "카테고리2", "카테고리3"],
    "targetAges": ["연령층1", "연령층2", "연령층3"],
    "targetAudience": ["타겟1", "타겟2", "타겟3"],
    "focus": ["포커스1", "포커스2", "포커스3"],
    "voiceTone": "브랜드 톤앤보이스 설명",
    "toneValues": [
      "핵심 가치 1",
      "핵심 가치 2",
      "핵심 가치 3"
    ],
    "absoluteNos": [
      "피해야 할 표현 1",
      "피해야 할 표현 2"
    ]
  }
}
```

### 예시 1: 커피 브랜드
```json
{
  "brand": {
    "name": "콩향커피",
    "nameKorean": "원두의 정성, 콩향커피",
    "nameEnglish": "BEAN AROMA COFFEE",
    "description": "에티오피아 야르가 체프 100% 원두를 사용한 프리미엄 커피",
    "categories": ["음료", "건강식품", "선물"],
    "targetAges": ["20~40대", "40~60대"],
    "targetAudience": ["직장인", "커피 애호가", "선물 구매자"],
    "focus": ["품질", "전통", "건강", "프리미엄"],
    "voiceTone": "정직하고 프리미엄한 느낌",
    "toneValues": [
      "정직함: 원산지, 로스팅 정보 투명 공개",
      "프리미엄: 수작업 로스팅, 신선함",
      "공동체: 커피 문화 확산"
    ],
    "absoluteNos": [
      "의료 표현 (카페인이 질병 치료한다 등)",
      "과장 (세계 최고 품질 등)",
      "환경 문제 무시"
    ]
  }
}
```

### 예시 2: 건강식품 브랜드
```json
{
  "brand": {
    "name": "자연숨",
    "nameKorean": "자연의 숨결, 자연숨",
    "nameEnglish": "NATURE'S BREATH WELLNESS",
    "description": "100% 유기농 한약재로 만든 웰니스 음료",
    "categories": ["건강식품", "음료", "웰니스"],
    "targetAges": ["30~50대", "50대+"],
    "targetAudience": ["건강 관심층", "자연 제품 선호층", "가족"],
    "focus": ["자연", "건강", "전통", "신뢰"],
    "voiceTone": "따뜻하고 신뢰감 있는 톤",
    "toneValues": [
      "자연성: 유기농 원재료 100%",
      "신뢰: 임상 검증된 효능",
      "가족애: 함께 건강해지는 경험"
    ],
    "absoluteNos": [
      "의료 표현 (질병 치료, 예방 등)",
      "과학적 근거 없는 효능",
      "과도한 마케팅"
    ]
  }
}
```

---

## 3단계: 캐릭터 설정 (선택사항)

### 캐릭터 정의
```json
{
  "characters": [
    {
      "name": "캐릭터명",
      "role": "역할 (예: 따뜻한 엄마)",
      "toneTrait": "특징 (예: 신뢰감, 안정성)"
    },
    {
      "name": "캐릭터명2",
      "role": "역할2",
      "toneTrait": "특징2"
    }
  ]
}
```

### 예시: 커피 브랜드 캐릭터
```json
{
  "characters": [
    {
      "name": "원두지",
      "role": "원두의 정성 전도자",
      "toneTrait": "열정적, 전문가"
    },
    {
      "name": "향미",
      "role": "감각적인 커피 애호가",
      "toneTrait": "우아함, 섬세함"
    },
    {
      "name": "따뜨미",
      "role": "아침 일상의 친구",
      "toneTrait": "친근함, 따뜻함"
    }
  ]
}
```

---

## 4단계: 생성 설정 수정

### 영상 설정
```json
{
  "generation": {
    "videoDefaultDuration": 120,            // 영상 길이 (초)
    "videoDefaultResolution": "720p",       // 해상도
    "videoTypes": [                         // 영상 유형
      "제품소개",
      "사용법",
      "고객후기"
    ],
    "retryAttempts": 3,                     // 재시도 횟수
    "retryBackoffMs": 1000                  // 재시도 대기 시간 (ms)
  }
}
```

### 예시: 커피 브랜드
```json
{
  "generation": {
    "videoDefaultDuration": 120,
    "videoDefaultResolution": "1080p",      // 더 고품질로
    "videoTypes": [
      "원두 소개",
      "추출법 튜토리얼",
      "마스터 인터뷰"
    ],
    "retryAttempts": 3,
    "retryBackoffMs": 1000
  }
}
```

---

## 5단계: API 엔드포인트 설정 (선택사항)

### 커스텀 API 설정
```json
{
  "apiEndpoints": {
    "supabase": {
      "url": "${SUPABASE_URL}",
      "anonKey": "${SUPABASE_ANON_KEY}",
      "serviceKey": "${SUPABASE_SERVICE_KEY}"
    },
    "timelyai": {
      "baseUrl": "${TIMELY_AI_BASE_URL}",
      "apiKey": "${TIMELY_AI_API_KEY}"
    },
    "higgsfield": {
      "apiUrl": "${HIGGSFIELD_API_URL}",
      "apiKey": "${HIGGSFIELD_API_KEY}"
    }
  }
}
```

**참고**: `${변수명}` 형식으로 환경변수 참조 가능 (`.env` 파일에서 읽음)

---

## 프론트엔드에서 사용하는 방식

### 1. App.jsx (헤더)
```javascript
// 자동으로 config에서 브랜드명 로드
const [brandName, setBrandName] = useState('기본값');

useEffect(() => {
  const res = await fetch('/api/config');
  const data = await res.json();
  setBrandName(data.brand.nameKorean);
  // 영어명, 캐릭터, 생성 설정도 동일하게 로드
}, []);
```

### 2. FilterUI.jsx (필터)
```javascript
// config의 categories, targetAges, focus 등으로 필터 옵션 생성
const metadata = {
  categories: window.appConfig?.brand?.categories || [...],
  ageGroups: window.appConfig?.brand?.targetAges || [...],
  targets: window.appConfig?.brand?.targetAudience || [...],
  focus: window.appConfig?.brand?.focus || [...]
};
```

### 3. CharacterCreator.jsx (캐릭터)
```javascript
// config에서 캐릭터 목록 로드
const characters = window.appConfig?.characters || [
  { name: '기본캐릭터1', role: '역할1', toneTrait: '특징1' },
  ...
];
```

### 4. GenerationUI.jsx (영상 유형)
```javascript
// config의 videoTypes 사용
const videoTypes = window.appConfig?.generation?.videoTypes || [
  '제품소개', '사용법', '고객후기'
];
```

---

## 적용 체크리스트

### Before (제주소금만 지원)
```
✗ 하드코딩된 "제주도 라바 씨솔트"
✗ 고정된 캐릭터 8명
✗ 고정된 필터 옵션
✗ 새 브랜드 추가 시 코드 수정 필요
```

### After (모든 브랜드 지원)
```
✅ config.json만 수정하면 됨
✅ 캐릭터 자유롭게 정의 가능
✅ 필터 옵션 동적으로 로드
✅ 영상 유형 커스터마이징 가능
✅ 새 브랜드 적용 시 코드 변경 없음
```

---

## 실제 적용 예시

### 제주소금 → 커피 브랜드로 변경

#### Step 1: config.json 수정
```bash
# 기존 config.json 백업
cp config.json config.json.jeju-salt.backup

# 새 설정 작성
# nameKorean: "원두의 정성, 콩향커피"
# nameEnglish: "BEAN AROMA COFFEE"
# characters: ["원두지", "향미", "따뜨미"]
```

#### Step 2: 환경변수 확인
```bash
# .env 파일의 Supabase, TimelyAI, Higgsfield 키는 그대로 사용
# (다른 브랜드도 같은 AI 플랫폼 사용)
```

#### Step 3: 서버 재시작
```bash
npm start
# 자동으로 config.json 로드
# 프론트에서 /api/config 호출하면 새 설정 적용
```

#### Step 4: 프론트 확인
```
✅ 헤더: "원두의 정성, 콩향커피" / "BEAN AROMA COFFEE"
✅ 필터: "음료", "건강식품", "선물" 카테고리
✅ 캐릭터: "원두지", "향미", "따뜨미" 3명
✅ 영상유형: "원두 소개", "추출법 튜토리얼", "마스터 인터뷰"
```

---

## 고급: 여러 브랜드 동시 관리

### 디렉토리 구조
```
프로젝트/
  ├─ config.json              (현재 활성 설정)
  ├─ configs/
  │  ├─ jeju-salt.json       (제주소금)
  │  ├─ bean-aroma.json      (콩향커피)
  │  └─ nature-breath.json   (자연숨)
```

### 런타임 스위칭 (추후 구현)
```javascript
// API 엔드포인트
GET /api/config?brand=bean-aroma
  → configs/bean-aroma.json 로드

GET /api/config?brand=jeju-salt
  → configs/jeju-salt.json 로드
```

---

## 주의사항

1. **config.json 누락 시**: 기본값(제주소금) 사용
2. **필수 필드**: brand, characters, generation만 필수 (apiEndpoints는 선택)
3. **문자 인코딩**: UTF-8로 저장 (한글 포함)
4. **이미지 참조**: 캐릭터 레퍼런스 이미지는 첫 생성 후 자동 저장
5. **AI 에이전트 프롬프트**: TimelyAI 에이전트는 여전히 제주소금 기준으로 설정됨 (config 반영 아직 미구현)

---

## 향후 개선

- [ ] TimelyAI 에이전트 프롬프트 동적화 (config 기반)
- [ ] 여러 브랜드 동시 관리 UI
- [ ] 브랜드별 톤앤보이스 자동 검증
- [ ] 캐릭터 이미지 데이터베이스 통합

