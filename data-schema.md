# data-schema.md — 제주소금 웹앱 데이터 구조 설계 (v3)

**작성일**: 2026.08.03  
**수정일**: 2026.08.03 (videoTypes, keywords 필드 추가 / "스펙"→"제품 정보" 용어 통일)  
**용도**: window.storage에 저장할 데이터 구조 정의  
**대상**: database-agent, frontend-agent (내일 구현 기준)

---

## 📋 목적

제주소금 웹앱에서 다음을 저장하고 관리하기 위한 스키마:
- 사용자 입력 자료 (제품 정보, 기술 정보 등)
- 자동 생성된 메타데이터 (카테고리, 나이대, 대상 등)
- **사용자가 생성한 캐릭터** (사용자 생성 가능)
- 필터링 옵션 (동적 추가 가능)
- **영상유형 옵션** ⭐ (새로 추가, 동적 추가 가능)

---

## 📝 용어 정리

| 용어 | 의미 |
|---|---|
| **제품 정보** (기존 "스펙") | 사용자가 입력하는 제품에 대한 모든 텍스트 설명 (수치, 인증, 특징 등) |
| **키워드** ⭐ | 제품 정보에서 강조하고 싶은 핵심 단어들 (선택 입력) |
| **메타데이터** | AI가 제품 정보를 분석해서 자동으로 추출한 분류 정보 |

---

## 🗂️ 전체 데이터 구조

```javascript
{
  "resources": [...],           // 자료 목록 (제품 정보 포함)
  "metadata": {...},            // 메타데이터 정의 (카테고리/나이대/영상유형 등)
  "characters": [...],          // 기본 캐릭터 8개
  "generatedCharacters": [...], // 사용자 생성 캐릭터
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
    "id": "uuid_or_timestamp",              // 고유 ID (생성 시각 또는 UUID)
    "title": "제주용암프리미엄솔트",         // 제품명
    "productInfo": "나트륨 24.1g/100g...",  // ⭐ 제품 정보 (기존 "content"에서 이름 변경)
    "keywords": ["프리미엄", "건강", "가족"], // ⭐ 새로 추가: 강조 키워드 (선택 입력)
    "createdAt": "2026-08-04T10:30:00Z",     // 생성 시각
    "source": "web_input",                   // 출처 (web_input / api / import)
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

**💡 입력 예시** (사용자가 실제로 입력하는 형태):
```
제품명: 제주용암프리미엄솔트

제품 정보:
나트륨 24.1g/100g (일반 소금 대비 40% 감소)
마그네슘 6,370mg/100g
규소 90mg/100g
제주 청정 인증 획득
70년 전통 기술로 생산

키워드 (선택): 프리미엄, 건강, 가족, 전통
```

---

### 2️⃣ Metadata (메타데이터 정의)

이 부분은 **필터 옵션의 모든 선택지를 정의**합니다.  
**필터 옵션은 계속 추가 가능**합니다.

```javascript
"metadata": {
  // 카테고리: 사업 영역
  "categories": {
    "options": ["식품", "뷰티", "헬스케어"],
    "description": "제품의 주요 사업 영역",
    "addable": true  // 새로운 카테고리 추가 가능
  },

  // 나이대: 타겟 고객 연령
  "ageGroups": {
    "options": ["20~30대", "40~60대", "60대+"],
    "description": "주요 타겟 고객 연령대",
    "addable": true
  },

  // 성별: 타겟 성별
  "genders": {
    "options": ["여성", "남성", "무관"],
    "description": "타겟 고객 성별",
    "addable": false
  },

  // 대상: 타겟 고객 유형
  "targets": {
    "options": ["개인 케어", "가족 밥상", "운동 애호가", "관광객", "선물/기념품"],
    "description": "고객 유형 또는 사용 목적",
    "addable": true
  },

  // 캐릭터: 브랜드 캐릭터들 (기본 8개)
  "characters": {
    "options": ["결이", "용암이", "해수", "미내", "현무", "가마할방", "불이", "한라"],
    "description": "사용할 수 있는 기본 캐릭터들",
    "addable": true
  },

  // 초점: 콘텐츠의 주요 강조점
  "focus": {
    "options": ["신뢰", "기술", "건강", "자기관리", "일상", "감정", "자연성"],
    "description": "콘텐츠의 주요 강조 방향",
    "addable": true
  },

  // ⭐ 새로 추가: 영상유형
  "videoTypes": {
    "options": [
      "캐릭터소개",
      "제품스토리",
      "일상밥상"
    ],
    "description": "생성할 영상의 유형",
    "addable": true  // 새로운 영상유형 추가 가능
  }
}
```

---

### 2-1️⃣ GeneratedCharacters (사용자가 생성한 캐릭터)

```javascript
"generatedCharacters": [
  {
    "id": "char_uuid_20260804_001",
    "name": "마리아",
    "type": "생성됨",                     // "기본" 또는 "생성됨"
    "description": "제주의 역사를 전하는 따뜻한 할머니",
    "traits": ["따뜻함", "지혜", "이야기꾼", "제주 문화"],
    "focus": ["감정", "역사", "자연성"],
    "originResource": "1725364200000",    // 생성된 계기가 된 자료 ID
    "createdAt": "2026-08-04T14:30:00Z",
    "isActive": true,
    "usageCount": 2,
    "notes": "제주 토속 문화를 강조하는 캐릭터"
  }
]
```

---

### 3️⃣ Filters (필터 상태)

```javascript
"filters": {
  "selectedCategories": ["식품"],
  "selectedAgeGroups": ["40~60대"],
  "selectedGenders": ["여성", "무관"],
  "selectedTargets": ["가족밥상"],
  "selectedVideoTypes": ["제품스토리"],   // ⭐ 새로 추가
  "sortBy": "createdAt",
  "sortOrder": "desc"
}
```

---

### 4️⃣ AppState (앱 상태)

```javascript
"appState": {
  "isAdminMode": false,
  "lastSavedAt": "2026-08-04T15:30:00Z",
  "selectedResourceId": "uuid_123",
  "selectedCharacter": "용암이",
  "selectedGeneratedCharacterId": null,
  "selectedVideoType": "제품스토리",
  "generatedStory": "...",
  "isGenerating": false,
  "errorMessage": null,
  "generatedCharacterOptions": [
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
{
  "resources": [
    {
      "id": "1725364200000",
      "title": "제주용암프리미엄솔트",
      "productInfo": "나트륨 24.1g/100g, 마그네슘 6,370mg/100g, 제주청정인증, 70년 전통 기술",
      "keywords": ["프리미엄", "건강", "가족", "전통"],
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
      "addable": true
    },
    "videoTypes": {
      "options": ["캐릭터소개", "제품스토리", "일상밥상"],
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
    "selectedVideoTypes": [],
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
    "generatedCharacterOptions": []
  }
}
```

---

## 🔄 데이터 흐름 (웹앱에서)

```
1️⃣ 사용자가 제품명 + 제품 정보 + 키워드(선택) 입력 ⭐
   ↓
2️⃣ resource-analyzer Skill 호출 (Claude API)
   ↓
3️⃣ 메타데이터 자동 생성 (JSON: 카테고리/나이대/대상/초점)
   ↓
4️⃣ character-generator Skill 호출 (Claude API)
   ↓
5️⃣ 추천 캐릭터 2~3개 생성
   ↓
6️⃣ 사용자가 캐릭터 선택/편집
   ↓
7️⃣ window.storage에 저장
   ↓
8️⃣ 사용자가 필터 선택 (카테고리/나이대/영상유형 등) ⭐
   ↓
9️⃣ 필터링된 자료 표시
   ↓
🔟 생성된 캐릭터 + 영상유형 선택
   ↓
1️⃣1️⃣ "AI 생성" 클릭 → product-intro-writer 호출 (Claude API)
   ↓
1️⃣2️⃣ 스토리 생성 & 화면 표시
   ↓
1️⃣3️⃣ "확정" → Higgsfield 연동
```

---

## 🛠️ 함수 인터페이스 (내일 구현)

### **자료 저장**
```javascript
async function saveResource(resource, metadata) {
  // resource: {title, productInfo, keywords}
  // metadata: 자동 생성된 메타데이터
  // 반환: 저장된 resource ID
}
```

### **캐릭터 저장**
```javascript
async function saveGeneratedCharacter(character) {
  // character: {name, description, traits, focus, originResource}
  // 반환: 저장된 character ID
}
```

### **캐릭터 활성화/비활성화**
```javascript
async function updateCharacterStatus(characterId, isActive) {
  // 반환: 업데이트된 character
}
```

### **캐릭터 삭제**
```javascript
async function deleteGeneratedCharacter(characterId) {
  // 반환: 삭제 성공 여부
}
```

### **필터링**
```javascript
async function getResourcesByFilter(filters) {
  // filters: {selectedCategories, selectedVideoTypes, ...}
  // 반환: 필터링된 resources 배열
}
```

### **자료 업데이트**
```javascript
async function updateResource(resourceId, updates) {
  // 반환: 업데이트된 resource
}
```

### **필터/영상유형 옵션 추가** ⭐ 새로 추가
```javascript
async function addMetadataOption(fieldName, newOption) {
  // fieldName: 'categories' | 'ageGroups' | 'targets' | 'videoTypes' | 'focus'
  // newOption: 새로운 옵션 (예: "헤어케어" 또는 "인터뷰형")
  // 반환: 업데이트된 metadata
}
```

---

## ⚡ 주요 특징

### 1️⃣ **제품 정보 자유 입력** ⭐ (용어 명확화)
- "스펙"이 아닌 **"제품 정보"**로 통일
- 자유 텍스트로 입력 (수치, 인증, 특징 등 모두 포함)
- 선택적으로 **키워드**를 별도 입력 가능

### 2️⃣ **메타데이터 자동 생성**
- resource-analyzer Skill이 제품 정보를 분석해서 자동으로 태깅
- 신뢰도 점수 포함

### 3️⃣ **캐릭터 자동 생성**
- character-generator Skill이 제품 정보의 특성에 맞춰 새로운 캐릭터 생성

### 4️⃣ **모든 옵션 동적 확장 가능** ⭐
- 카테고리, 나이대, 대상, 초점 **+ 영상유형까지** 모두 추가 가능
- `addable: true` 플래그로 구분

### 5️⃣ **캐릭터 관리**
- 기본 캐릭터 8개 + 생성된 캐릭터 무제한
- 사용 횟수 추적, 활성화/비활성화 가능

### 6️⃣ **승인 워크플로우**
- 관리자가 자료를 검토 후 승인

---

## 📈 향후 확장 예시

```javascript
// 새로운 카테고리 추가
"categories": {
  "options": ["식품", "뷰티", "헬스케어", "헤어케어", "펫케어"]
}

// 새로운 영상유형 추가
"videoTypes": {
  "options": ["캐릭터소개", "제품스토리", "일상밥상", "인터뷰형", "챌린지형"]
}

// 새로운 대상 추가
"targets": {
  "options": ["개인케어", "가족밥상", "운동애호가", "임산부", "아이용품"]
}
```

같은 구조이므로 resource-analyzer와 product-intro-writer 프롬프트를 약간만 수정하면 즉시 확장 가능!

---

## ✅ 확인 사항

- [x] "제품 정보" 용어로 통일했는가? (기존 "스펙" → 수정)
- [x] 키워드 필드가 추가되었는가?
- [x] 영상유형(videoTypes)이 동적으로 추가 가능한가?
- [x] 모든 필드가 명확한가?
- [x] 확장 가능한 구조인가?
- [x] window.storage에 저장하기 좋은 구조인가?
- [x] character-generator가 생성한 캐릭터를 저장/관리할 수 있는가?

---

**이 스키마를 기반으로 내일 database-agent가 저장/검색/필터링/캐릭터 관리를 구현합니다!** 🚀
