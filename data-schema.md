# data-schema.md — 제주소금 웹앱 데이터 구조 설계 (수정본)

**작성일**: 2026.08.03  
**수정일**: 2026.08.03 (사용자 생성 캐릭터 저장 구조 추가)  
**용도**: window.storage에 저장할 데이터 구조 정의  
**대상**: database-agent, frontend-agent (내일 구현 기준)

---

## 📋 목적

제주소금 웹앱에서 다음을 저장하고 관리하기 위한 스키마:
- 사용자 입력 자료 (제품 정보, 기술 정보 등)
- 자동 생성된 메타데이터 (카테고리, 나이대, 대상 등)
- **사용자가 생성한 캐릭터** ⭐ (새로 추가)
- 필터링 옵션 (동적 추가 가능)

---

## 🗂️ 전체 데이터 구조

```javascript
{
  "resources": [...],           // 자료 목록
  "metadata": {...},            // 메타데이터 정의
  "characters": [...],          // 기본 캐릭터 8개
  "generatedCharacters": [...], // ⭐ 새로 추가: 사용자 생성 캐릭터
  "filters": {...},             // 필터 옵션들
  "appState": {...}             // 앱 상태
}
```

---

## 📄 상세 스키마

### 1️⃣ Resources (자료 목록)

```javascript
"resources": [
  {
    "id": "uuid_or_timestamp",           // 고유 ID (생성 시각 또는 UUID)
    "title": "제주용암프리미엄솔트",      // 자료 제목
    "content": "나트륨 24.1g/100g...",   // 자료 내용 (텍스트)
    "createdAt": "2026-08-04T10:30:00Z", // 생성 시각
    "source": "web_input",                // 출처 (web_input / api / import)
    "metadata": {
      // resource-analyzer Skill이 자동 생성
      "categories": ["식품", "헬스케어"],
      "ageGroups": ["40~60대"],
      "genders": ["무관"],
      "targets": ["가족밥상", "건강관심층"],
      "characters": ["용암이", "결이"],  // 추천 캐릭터 (기본)
      "focus": ["신뢰", "건강", "기술"],  // 콘텐츠 초점
      "confidence": 0.95                  // 자동 분석 신뢰도
    },
    "isApproved": true,                   // 관리자 승인 여부
    "approvedAt": "2026-08-04T11:00:00Z", // 승인 시각
    "notes": "프리미엄 라인 신상품"         // 관리자 메모
  }
]
```

---

### 2️⃣ Metadata (메타데이터 정의)

이 부분은 **필터 옵션의 모든 선택지를 정의**합니다.  
**필터 옵션은 계속 추가 가능**합니다.

```javascript
"metadata": {
  // 카테고리: 사업 영역
  "categories": {
    "options": [
      "식품",
      "뷰티",
      "헬스케어"
    ],
    "description": "제품의 주요 사업 영역",
    "addable": true  // 새로운 카테고리 추가 가능
  },

  // 나이대: 타겟 고객 연령
  "ageGroups": {
    "options": [
      "20~30대",
      "40~60대",
      "60대+"
    ],
    "description": "주요 타겟 고객 연령대",
    "addable": true  // 새로운 나이대 추가 가능
  },

  // 성별: 타겟 성별
  "genders": {
    "options": [
      "여성",
      "남성",
      "무관"
    ],
    "description": "타겟 고객 성별",
    "addable": false  // 성별은 고정
  },

  // 대상: 타겟 고객 유형
  "targets": {
    "options": [
      "개인 케어",
      "가족 밥상",
      "운동 애호가",
      "관광객",
      "선물/기념품"
    ],
    "description": "고객 유형 또는 사용 목적",
    "addable": true  // 새로운 대상 추가 가능
  },

  // 캐릭터: 브랜드 캐릭터들 (기본 8개)
  "characters": {
    "options": [
      "결이",       // 당찬 소금알갱이
      "용암이",     // 따뜻한 아버지
      "해수",       // 신비롭고 우아한 여성
      "미내",       // 포용적인 누나
      "현무",       // 신뢰로운 형
      "가마할방",   // 따뜻한 할아버지
      "불이",      // 발랄한 또래
      "한라"        // 지혜로운 할머니
    ],
    "description": "사용할 수 있는 캐릭터들",
    "addable": true  // 새로운 캐릭터 추가 가능
  },

  // 초점: 콘텐츠의 주요 강조점
  "focus": {
    "options": [
      "신뢰",
      "기술",
      "건강",
      "자기관리",
      "일상",
      "감정",
      "자연성"
    ],
    "description": "콘텐츠의 주요 강조 방향",
    "addable": true  // 새로운 초점 추가 가능
  }
}
```

---

### 2-1️⃣ GeneratedCharacters (사용자가 생성한 캐릭터) ⭐ 새로 추가

```javascript
"generatedCharacters": [
  {
    "id": "char_uuid_20260804_001",      // 고유 ID
    "name": "마리아",                     // 캐릭터명
    "type": "생성됨",                     // "기본" 또는 "생성됨"
    "description": "제주의 역사를 전하는 따뜻한 할머니", // 한 문단 설명
    "traits": [                           // 캐릭터의 주요 특징
      "따뜻함",
      "지혜",
      "이야기꾼",
      "제주 문화"
    ],
    "focus": [                            // 이 캐릭터의 강조점
      "감정",
      "역사",
      "자연성"
    ],
    "originResource": "1725364200000",    // 생성된 계기가 된 자료 ID
    "createdAt": "2026-08-04T14:30:00Z",  // 생성 시각
    "isActive": true,                     // 현재 사용 중인가?
    "usageCount": 2,                      // 사용 횟수
    "notes": "제주 토속 문화를 강조하는 캐릭터"  // 메모
  },
  {
    "id": "char_uuid_20260804_002",
    "name": "프리미엄 솔트맨",
    "type": "생성됨",
    "description": "모던하고 세련된 프리미엄 느낌의 캐릭터",
    "traits": ["세련됨", "신뢰", "프리미엄", "기술"],
    "focus": ["기술", "신뢰"],
    "originResource": "1725364200000",
    "createdAt": "2026-08-04T15:00:00Z",
    "isActive": true,
    "usageCount": 0,
    "notes": "프리미엄 라인용 캐릭터"
  }
]
```

---

### 3️⃣ Filters (필터 상태)

사용자가 현재 선택한 필터 상태를 저장합니다.

```javascript
"filters": {
  "selectedCategories": ["식품"],                    // 현재 선택된 카테고리
  "selectedAgeGroups": ["40~60대"],                  // 현재 선택된 나이대
  "selectedGenders": ["여성", "무관"],                // 현재 선택된 성별
  "selectedTargets": ["가족밥상"],                    // 현재 선택된 대상
  "sortBy": "createdAt",                             // 정렬 기준 (createdAt / title)
  "sortOrder": "desc"                                // 정렬 순서 (asc / desc)
}
```

---

### 4️⃣ AppState (앱 상태)

앱의 현재 상태를 추적합니다.

```javascript
"appState": {
  "isAdminMode": false,                         // 관리자 모드 여부
  "lastSavedAt": "2026-08-04T15:30:00Z",       // 마지막 저장 시각
  "selectedResourceId": "uuid_123",             // 현재 선택된 자료 ID
  "selectedCharacter": "용암이",                 // 선택된 캐릭터 (기본)
  "selectedGeneratedCharacterId": null,         // ⭐ 새로 추가: 생성된 캐릭터 선택
  "selectedVideoType": "제품스토리",             // 선택된 영상 타입
  "generatedStory": "...",                      // 생성된 스토리 텍스트
  "isGenerating": false,                        // API 호출 중인지
  "errorMessage": null,                         // 에러 메시지
  "generatedCharacterOptions": [                // ⭐ 새로 추가: character-generator 결과
    {
      "name": "마리아",
      "description": "제주 역사를 전하는 할머니",
      "traits": ["따뜻함", "지혜"],
      "recommendation": "제품의 전통성과 역사성을 잘 표현할 수 있습니다"
    }
  ]
}
```

---

## 📊 저장 구조 예시 (실제 데이터)

```javascript
// window.storage에 실제로 저장되는 형태

{
  "resources": [
    {
      "id": "1725364200000",
      "title": "제주용암프리미엄솔트",
      "content": "나트륨 24.1g/100g, 마그네슘 6,370mg/100g, 제주청정인증",
      "createdAt": "2026-08-04T10:30:00Z",
      "source": "web_input",
      "metadata": {
        "categories": ["식품", "헬스케어"],
        "ageGroups": ["40~60대"],
        "genders": ["무관"],
        "targets": ["가족밥상"],
        "characters": ["용암이"],
        "focus": ["신뢰", "기술"],
        "confidence": 0.96
      },
      "isApproved": true,
      "approvedAt": "2026-08-04T11:00:00Z",
      "notes": "프리미엄 라인 신상품"
    }
  ],

  "metadata": {
    "categories": {
      "options": ["식품", "뷰티", "헬스케어"],
      "description": "제품의 주요 사업 영역",
      "addable": true
    }
  },

  "generatedCharacters": [
    {
      "id": "char_uuid_20260804_001",
      "name": "마리아",
      "type": "생성됨",
      "description": "제주의 역사를 전하는 따뜻한 할머니",
      "traits": ["따뜻함", "지혜"],
      "focus": ["감정", "역사"],
      "originResource": "1725364200000",
      "createdAt": "2026-08-04T14:30:00Z",
      "isActive": true,
      "usageCount": 2,
      "notes": "제주 토속 문화 강조"
    }
  ],

  "filters": {
    "selectedCategories": ["식품"],
    "selectedAgeGroups": ["40~60대"],
    "selectedGenders": [],
    "selectedTargets": [],
    "sortBy": "createdAt",
    "sortOrder": "desc"
  },

  "appState": {
    "isAdminMode": false,
    "lastSavedAt": "2026-08-04T11:30:00Z",
    "selectedResourceId": "1725364200000",
    "selectedCharacter": "용암이",
    "selectedGeneratedCharacterId": "char_uuid_20260804_001",
    "selectedVideoType": "제품스토리",
    "generatedStory": null,
    "isGenerating": false,
    "errorMessage": null,
    "generatedCharacterOptions": [
      {
        "name": "마리아",
        "description": "제주 역사를 전하는 할머니",
        "traits": ["따뜻함", "지혜", "이야기꾼"],
        "recommendation": "제품의 전통성을 잘 표현합니다"
      }
    ]
  }
}
```

---

## 🔄 데이터 흐름 (웹앱에서) — 수정됨

```
1️⃣ 사용자가 자료 입력
   ↓
2️⃣ resource-analyzer Skill 호출 (Claude API)
   ↓
3️⃣ 메타데이터 자동 생성 (JSON)
   ↓
4️⃣ character-generator Skill 호출 (Claude API) ⭐ 새로 추가!
   ↓
5️⃣ 추천 캐릭터 2~3개 생성 ⭐
   ↓
6️⃣ 사용자가 캐릭터 선택/편집 ⭐
   ↓
7️⃣ window.storage에 저장 ({id, content, metadata, generatedCharacter})
   ↓
8️⃣ 사용자가 필터 선택
   ↓
9️⃣ 필터링된 자료 표시
   ↓
🔟 생성된 캐릭터 + 영상유형 선택 ⭐
   ↓
1️⃣1️⃣ "AI 생성" 클릭 → product-intro-writer 호출 (Claude API)
   ↓
1️⃣2️⃣ 스토리 생성 & 화면 표시
   ↓
1️⃣3️⃣ "확정" → Higgsfield 연동
```

---

## 🛠️ 함수 인터페이스 (내일 구현)

database-agent가 구현할 함수들:

### **자료 저장**
```javascript
async function saveResource(resource, metadata) {
  // resource: {title, content}
  // metadata: 자동 생성된 메타데이터
  // 반환: 저장된 resource ID
}
```

### **캐릭터 저장** ⭐ 새로 추가
```javascript
async function saveGeneratedCharacter(character) {
  // character: {name, description, traits, focus, originResource}
  // 반환: 저장된 character ID
}
```

### **캐릭터 활성화/비활성화** ⭐ 새로 추가
```javascript
async function updateCharacterStatus(characterId, isActive) {
  // characterId: 캐릭터 ID
  // isActive: 사용 여부
  // 반환: 업데이트된 character
}
```

### **캐릭터 삭제** ⭐ 새로 추가
```javascript
async function deleteGeneratedCharacter(characterId) {
  // characterId: 삭제할 캐릭터 ID
  // 반환: 삭제 성공 여부
}
```

### **필터링**
```javascript
async function getResourcesByFilter(filters) {
  // filters: {selectedCategories, selectedAgeGroups, ...}
  // 반환: 필터링된 resources 배열
}
```

### **자료 업데이트**
```javascript
async function updateResource(resourceId, updates) {
  // resourceId: 자료 ID
  // updates: {title, metadata, isApproved, ...}
  // 반환: 업데이트된 resource
}
```

---

## ⚡ 주요 특징

### 1️⃣ **메타데이터 자동 생성**
- resource-analyzer Skill이 자료를 분석해서 자동으로 태깅
- 신뢰도 점수 포함 (관리자가 검증 용이)

### 2️⃣ **캐릭터 자동 생성** ⭐
- character-generator Skill이 자료의 특성에 맞춰 새로운 캐릭터 생성
- 추천 이유와 함께 제시
- 사용자가 선택/편집 가능

### 3️⃣ **동적 필터 확장**
- 새로운 카테고리/나이대/대상을 언제든 추가 가능
- `addable: true` 플래그로 구분

### 4️⃣ **캐릭터 관리**
- 기본 캐릭터 8개 + 생성된 캐릭터 무제한
- 사용 횟수 추적
- 활성화/비활성화 가능

### 5️⃣ **초점(Focus) 추적**
- 콘텐츠의 주요 강조점 (신뢰/기술/건강/일상 등)
- brand-voice.md와 연계

### 6️⃣ **승인 워크플로우**
- 관리자가 자료를 검토 후 승인
- `isApproved` 플래그로 표시

---

## 📈 향후 확장 (뷰티/헬스케어 시)

현재는 **식품 중심**이지만, 다음과 같이 쉽게 확장 가능:

```javascript
// 새로운 카테고리 추가
"categories": {
  "options": [
    "식품",
    "뷰티",
    "헬스케어",
    "헤어케어",     // ← 새로 추가
    "펫케어"        // ← 새로 추가
  ]
}

// 새로운 대상 추가
"targets": {
  "options": [
    "개인케어",
    "가족밥상",
    "운동애호가",
    "임산부",       // ← 새로 추가
    "아이용품"      // ← 새로 추가
  ]
}
```

같은 구조이므로 resource-analyzer와 character-generator를 약간만 수정하면 즉시 확장 가능!

---

## ✅ 확인 사항

- [x] 모든 필드가 명확한가?
- [x] 확장 가능한 구조인가? (새로운 캐릭터 추가 가능)
- [x] window.storage에 저장하기 좋은 구조인가?
- [x] 내일 database-agent가 이것을 보고 구현할 수 있는가?
- [x] product-intro-writer가 이 메타데이터를 활용할 수 있는가?
- [x] character-generator가 생성한 캐릭터를 저장/관리할 수 있는가? ⭐

---

**이 스키마를 기반으로 내일 database-agent가 저장/검색/필터링/캐릭터 관리를 구현합니다!** 🚀
