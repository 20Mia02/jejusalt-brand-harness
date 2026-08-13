# data-schema-v4.md — 제주소금 웹앱 데이터 구조 설계 (Supabase 기반)

**작성일**: 2026.08.04
**작성자**: 고수아 + Claude (수정)
**용도**: Supabase(PostgreSQL) 기준 데이터 구조 정의 — 최신 Option A 기준
**대상**: database-agent, frontend-agent, backend-agent

---

## 📋 v3 → v4 변경 사항 요약

| | v3 (2026.08.03) | v4 (2026.08.04, 이 문서) |
|---|---|---|
| 저장 방식 | `window.storage` (브라우저 로컬) | **Supabase (PostgreSQL, 실제 DB)** |
| 테이블 구조 | 없음 (단일 JSON 객체) | **7개 정규화된 테이블** |
| 캐릭터 | 이름 배열만 | **별도 테이블** (voice_tone, personality_traits, edited_at 등) |
| 영상 진행률 | 없음 | **generation_progress, generation_status 포함** |
| Naming 구조 | 배열 | **3개 단일값 + 점수 + 의미** |
| FK 관계 | 없음 | **contents: scenario_id, naming_id FK 추가** |

---

## 🗂️ 전체 테이블 구조 (7개, Supabase)

```
resources  ──┬──> characters  ──> scenarios ──> naming
             │                                    ↓
             └────────────────> contents <─────┘
                                   ↓
                                videos
             ──> generation_logs
```

| 테이블 | 역할 | 주요 변경 |
|---|---|---|
| resources | 자료/제품 정보 + metadata | - |
| characters | 추천/생성/편집 캐릭터 | voice_tone, personality_traits, edited_by 추가 |
| scenarios | 120초 시나리오 | - |
| naming | 제품명/콘텐츠명 3개 옵션 | 배열 → 3개 단일값 구조 |
| contents | 생성 카피 + 검증 | scenario_id, naming_id FK 추가 |
| videos | Higgsfield 영상 + 진행률 | generation_progress, generation_status 추가 |
| generation_logs | 파이프라인 로그 | - |

---

## 📄 테이블별 상세

### 1️⃣ resources (자료/제품 정보)

```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name VARCHAR(255) NOT NULL,
  product_info TEXT NOT NULL,
  keywords JSONB,
  metadata JSONB,                    -- {categories, ageGroups, targets, focus, confidence}
  status VARCHAR(50) DEFAULT 'created',  -- created | analyzed | completed | failed
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 2️⃣ characters (선택/생성 캐릭터) ⭐ v4 핵심

```sql
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id),
  
  -- 기본 정보
  character_name VARCHAR(100) NOT NULL,
  is_base_character BOOLEAN DEFAULT true,
  character_profile JSONB,
  score INTEGER,
  reason TEXT,
  
  -- Step 4: character-designer-agent 생성 필드
  voice_tone VARCHAR(255),               -- ⭐ "따뜻한 아버지 목소리"
  personality_traits JSONB,              -- ⭐ ["따뜨함", "신뢰", "보호본능"]
  visual_description TEXT,               -- ⭐ "주름진 손, 밝은 눈빛..."
  preferred_expressions TEXT[],          -- ⭐ ["함께", "이 맛"]
  avoid_expressions TEXT[],              -- ⭐ ["최고", "유일"]
  
  -- 선택 정보
  selection_order INTEGER,
  selected BOOLEAN DEFAULT false,
  
  -- ⭐ 편집 이력
  edited_at TIMESTAMP,
  edited_by VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 3️⃣ scenarios (120초 시나리오)

```sql
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id),
  character_id UUID NOT NULL REFERENCES characters(id),
  
  -- Step 5: shortform-scenario-writer-agent 생성
  scenario_title VARCHAR(255),
  story_content TEXT,
  scenario_json JSONB,                  -- {acts: [...], dialogue, narration, silence}
  
  -- 타이밍
  total_duration_seconds INTEGER DEFAULT 120,
  dialogue_seconds INTEGER,
  narration_seconds INTEGER,
  silence_seconds INTEGER,
  timing_valid BOOLEAN,
  
  -- 마케터 검증
  marketer_approved BOOLEAN DEFAULT false,
  marketer_feedback TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 4️⃣ naming (제품명/콘텐츠명 3개) ⭐ 구조 변경

```sql
CREATE TABLE naming (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id),
  
  -- Step 6: naming-generator-agent 생성 (각 3개씩)
  -- 제품명 1순위
  product_name_1 VARCHAR(255),
  product_name_1_score INTEGER,
  product_name_1_meaning TEXT,
  
  -- 제품명 2순위
  product_name_2 VARCHAR(255),
  product_name_2_score INTEGER,
  product_name_2_meaning TEXT,
  
  -- 제품명 3순위
  product_name_3 VARCHAR(255),
  product_name_3_score INTEGER,
  product_name_3_meaning TEXT,
  
  -- 콘텐츠명 1순위
  content_name_1 VARCHAR(255),
  content_name_1_score INTEGER,
  content_name_1_meaning TEXT,
  
  -- 콘텐츠명 2순위
  content_name_2 VARCHAR(255),
  content_name_2_score INTEGER,
  content_name_2_meaning TEXT,
  
  -- 콘텐츠명 3순위
  content_name_3 VARCHAR(255),
  content_name_3_score INTEGER,
  content_name_3_meaning TEXT,
  
  -- 선택
  selected_product_name VARCHAR(255),
  selected_content_name VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 5️⃣ contents (생성 카피) ⭐ FK 추가

```sql
CREATE TABLE contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id),
  scenario_id UUID NOT NULL REFERENCES scenarios(id),      -- ⭐ FK 추가
  naming_id UUID NOT NULL REFERENCES naming(id),           -- ⭐ FK 추가
  
  -- Step 7~8: 콘텐츠 생성 및 검증
  content_type VARCHAR(50),           -- "intro" | "detail" | "both"
  generated_content TEXT NOT NULL,    -- 실제 카피 텍스트
  tone VARCHAR(255),                  -- "따뜨함, 신뢰감"
  length INTEGER,                     -- 글자 수
  
  -- Step 8: compliance-reviewer-agent 검증
  validation_status VARCHAR(50),      -- "APPROVED" | "NEEDS REVISION" | "REJECTED"
  validation_score INTEGER,
  validation_details JSONB,           -- {issues: [...], corrections: [...]}
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 6️⃣ videos (Higgsfield 영상 + 진행률) ⭐ 핵심

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id),
  content_id UUID NOT NULL REFERENCES contents(id),
  
  -- Step 9: Higgsfield 호출
  higgsfield_id VARCHAR(255),
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER DEFAULT 120,
  
  -- ⭐ 진행률 추적 (5초마다 UPDATE)
  generation_status VARCHAR(50) DEFAULT 'processing',  -- "processing" | "completed" | "failed"
  generation_progress INTEGER DEFAULT 0,               -- 0 | 25 | 50 | 75 | 100
  
  generation_start_time TIMESTAMP,
  generation_end_time TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 7️⃣ generation_logs (생성 과정 기록)

```sql
CREATE TABLE generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id),
  
  step VARCHAR(100),                  -- "resource-analyzer" | "character-generator" | ...
  status VARCHAR(50),                 -- "success" | "fail"
  error_message TEXT,
  duration_ms INTEGER,
  attempt INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔑 FK (Foreign Key) 관계

```
resources
  ├─ characters.resource_id
  ├─ scenarios.resource_id
  ├─ naming.resource_id
  ├─ contents.resource_id
  ├─ videos.resource_id
  └─ generation_logs.resource_id

scenarios
  └─ characters.character_id

contents
  ├─ scenarios.scenario_id
  └─ naming.naming_id

videos
  └─ contents.content_id
```

---

## ⭐ v4의 주요 개선사항

### 1. 캐릭터 편집 추적

```
characters 테이블:
- voice_tone: character-designer-agent가 생성
- personality_traits: character-designer-agent가 생성
- edited_at: 마케터가 수정한 시각
- edited_by: 마케터 이름
```

### 2. 영상 진행률 실시간 추적

```
videos 테이블:
- generation_progress: 0 → 25 → 50 → 75 → 100
- generation_status: "processing" → "completed"

매 5초마다 UPDATE되어 프론트에서 실시간 진행률 표시 가능
```

### 3. Naming 구조 명확화

```
이전 (배열): product_names: ["이름1", "이름2", "이름3"]
현재 (3개): product_name_1, product_name_1_score, product_name_1_meaning
          product_name_2, product_name_2_score, product_name_2_meaning
          product_name_3, product_name_3_score, product_name_3_meaning

마케터가 점수를 보고 선택 가능
```

### 4. Contents의 FK 추적

```
contents 테이블:
- scenario_id: 어떤 시나리오로 생성되었는가
- naming_id: 어떤 제품명/콘텐츠명으로 생성되었는가

데이터 추적성 향상
```

---

## 📊 데이터 흐름 (8단계)

```
Step 1: resource-analyzer-agent
  → resources 생성 + metadata 저장

Step 2: character-generator-agent
  → characters 3개 저장 (1순위 selected=true)

Step 3: character-designer-agent
  → characters 업데이트 (voice_tone, personality_traits 저장)

Step 4: shortform-scenario-writer-agent
  → scenarios 저장

Step 5: naming-generator-agent
  → naming 저장 (product_name_1/2/3, content_name_1/2/3)

Step 6: product-intro/detail-writer-agent
  → contents 저장

Step 7: compliance-reviewer-agent
  → contents 업데이트 (validation_status, validation_score)

Step 8: Higgsfield API
  → videos INSERT (generation_status: "processing", progress: 0)
  → 5초마다 videos UPDATE (progress: 0→100, status: processing→completed)
```

---

## ✅ 인덱스 (성능 최적화)

```sql
CREATE INDEX idx_characters_resource_id ON characters(resource_id);
CREATE INDEX idx_characters_selected ON characters(selected);
CREATE INDEX idx_scenarios_resource_id ON scenarios(resource_id);
CREATE INDEX idx_scenarios_character_id ON scenarios(character_id);
CREATE INDEX idx_naming_resource_id ON naming(resource_id);
CREATE INDEX idx_contents_resource_id ON contents(resource_id);
CREATE INDEX idx_videos_resource_id ON videos(resource_id);
CREATE INDEX idx_videos_higgsfield_id ON videos(higgsfield_id);
CREATE INDEX idx_generation_logs_resource_id ON generation_logs(resource_id);
```

---

## 📝 필드명 일관성 (snake_case)

```
✅ generation_status (❌ generationStatus)
✅ generation_progress (❌ generationProgress)
✅ video_url (❌ videoUrl)
✅ voice_tone (❌ voiceTone)
✅ personality_traits (❌ personalityTraits)
✅ visual_description (❌ visualDescription)
✅ edited_at (❌ editedAt)
✅ edited_by (❌ editedBy)
✅ character_name (❌ characterName)
✅ character_profile (❌ characterProfile)
```

---

이것이 최신 Option A 기준 Supabase 데이터 스키마입니다! 🎉
