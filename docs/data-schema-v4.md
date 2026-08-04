# data-schema-v4.md — 제주소금 웹앱 데이터 구조 설계 (Supabase 기반)

**작성일**: 2026.08.04
**작성자**: 고수아
**용도**: Supabase(PostgreSQL) 기준 데이터 구조 정의 — v3(window.storage 기반)를 대체
**대상**: database-agent, frontend-agent, backend-agent

---

## 📋 v3 → v4 변경 사항 요약

| | v3 (2026.08.03) | v4 (2026.08.04, 이 문서) |
|---|---|---|
| 저장 방식 | `window.storage` (브라우저 로컬) | **Supabase (PostgreSQL, 실제 DB)** |
| 테이블 구조 | 없음 (단일 JSON 객체: resources/metadata/filters/appState) | **7개 정규화된 테이블** |
| 캐릭터 | `resources[].metadata.characters` (이름 배열만) | **`characters` 별도 테이블** (프로필, 목소리, 편집 이력 포함) |
| 시나리오/네이밍/콘텐츠/영상 | 없음 (v3 작성 시점엔 미정의) | `scenarios`, `naming`, `contents`, `videos` 테이블로 신설 |
| 진행 로그 | 없음 | `generation_logs` 테이블로 신설 |

> ⚠️ v3의 `metadata` 정의(카테고리/나이대/성별/대상/초점의 옵션 목록)는 여전히 유효합니다.
> 다만 이제는 `window.storage`가 아니라 `resources.metadata` (JSONB 컬럼)에 저장됩니다.

---

## 🗂️ 전체 테이블 구조 (Supabase, 7개)

```
resources  ──┬──> characters  ──> scenarios ──> naming ──> contents ──> videos
             │
             └──> generation_logs (전체 흐름 기록, resources 기준)
```

| 테이블 | 역할 |
|---|---|
| resources | 자료/제품 정보 + 자동 분석된 metadata |
| characters | 추천/생성/편집된 캐릭터 (⭐ 이번 v4의 핵심 추가) |
| scenarios | 120초 시나리오 |
| naming | 제품명/콘텐츠명 |
| contents | 생성된 카피/콘텐츠 + 검증 결과 |
| videos | Higgsfield 생성 영상 + 진행률 |
| generation_logs | 전체 파이프라인 단계별 로그 |

---

## 📄 테이블별 상세

### 1️⃣ resources (자료/제품 정보)

```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name VARCHAR(255) NOT NULL,
  product_info TEXT NOT NULL,
  keywords JSONB,
  metadata JSONB,
  status VARCHAR(50) DEFAULT 'created',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**`metadata` 컬럼 안에 저장되는 내용** (v3에서 이어지는 구조, resource-analyzer-agent 출력 그대로):
```json
{
  "categories": ["식품", "헬스케어"],
  "ageGroups": ["40~60대"],
  "genders": ["무관"],
  "targets": ["가족밥상", "건강관심층"],
  "characters": ["용암이", "현무"],
  "focus": ["신뢰", "건강", "기술"],
  "confidence": 0.96
}
```
> 여기서 `metadata.characters`는 **추천 캐릭터 이름만 담은 참고용 배열**입니다.
> 실제 캐릭터의 상세 정보(목소리, 성격, 편집 이력 등)는 아래 `characters` 테이블에 별도로 저장됩니다.

---

### 2️⃣ characters (선택/생성된 캐릭터) ⭐ v4 핵심 변경

```sql
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  character_name VARCHAR(100) NOT NULL,
  is_base_character BOOLEAN DEFAULT true,
  character_profile JSONB NOT NULL,
  voice_tone VARCHAR(255),
  personality_traits JSONB,
  visual_description TEXT,
  selection_order INTEGER,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  edited_at TIMESTAMP,
  edited_by VARCHAR(255)
);
```

#### 필드 설명

| 필드 | 설명 |
|---|---|
| `is_base_character` | 8개 기본 캐릭터 중 하나면 `true`, character-generator-agent가 새로 만든 캐릭터면 `false` |
| `character_profile` | 이름, 나이, 특징 등을 담은 JSON (아래 예시 참고) |
| `voice_tone` | 예: "따뜻함", "신뢰로움" — character-designer-agent/frontend UI에서 편집 가능 |
| `personality_traits` | 예: `["유머감각", "신뢰성"]` — 편집 가능 |
| `selection_order` | AI가 추천한 순위 (1순위, 2순위, 3순위) |
| `selected` | 사용자가 최종 선택했는지 여부 |
| `edited_at` / `edited_by` | 사용자가 캐릭터 정보를 수정한 이력 (캐릭터 편집 기능에서 사용) |

#### 기본 캐릭터 8종 (character-generator-agent.md 기준)

| 이름 | 설정 | 강조 상황 |
|---|---|---|
| 결이 | 당찬 소금결정, 12세 소년 | 시작, 변화, 희망 |
| 용암이 | 따뜻한 아버지, 50대 | 가족, 함께, 밥상 |
| 해수 | 신비롭고 우아한 여성, 40대 | 정성, 우아함, 뷰티 |
| 미내 | 밝고 포용적인 누나, 30대 | 응원, 공감, 함께 |
| 현무 | 신뢰로운 형, 40대 | 신뢰, 건강, 과학 |
| 가마할방 | 따뜻한 할아버지, 70대 | 전통, 기술, 역사 |
| 불이 | 발랄한 친구, 25세 여성 | 활기, 에너지, 재미 |
| 한라 | 지혜로운 할머니, 70대 | 역사, 신화, 자연 |

> 위 8개 외에 **새로운 캐릭터가 동적으로 생성될 수 있음** (character-generator-agent.md 참고: 예 "소한", "태양", "달빛"). 이 경우 `is_base_character = false`로 저장.

#### `character_profile` JSON 예시
> SKILL_character-generator.md의 실제 캐릭터 정의 구조를 그대로 반영 (예: "소한" 캐릭터 기준)
```json
{
  "age": "20대",
  "role": "미니멀 라이프를 추구하는 감성가",
  "one_line_intro": "미니멀 라이프를 추구하는 20대 여성, 자연과 정성을 사랑하는 감성가",
  "type_tags": ["미니멀", "감성", "자연친화", "정성", "자신감"],
  "core_features": ["미니멀", "감성", "자연", "정성", "자신감", "감정"],
  "detailed_description": "소한은 20대 감성의 상징입니다. '과하지 않은 것의 아름다움'을 알고 있으며...",
  "product_fit": [
    "미니멀 철학과 정성의 만남 표현에 최적",
    "20~30대 감성층에 완벽히 부합"
  ],
  "focus_points": ["미니멀한 정성", "자신을 사랑하는 방식", "자연에서 온 것", "감성과 감정"],
  "representative_message": "자연의 정성, 당신을 위한 미니멀 시간. 주 1~2회, 그것으로 충분합니다.",
  "required_expressions": ["미니멀", "정성", "당신을 위해", "자연", "감성"],
  "avoid_expressions": ["최고", "유일", "완벽", "문제 해결", "피부 치료"]
}
```
> 위 필드들 중 `voice_tone`, `personality_traits`(≈ `core_features`)는 편집 편의를 위해 `characters` 테이블의 **별도 컬럼**으로도 분리해 저장 (캐릭터 편집 UI에서 자주 바뀌는 값이라 JSON 안에 묻지 않음). 나머지 필드는 `character_profile` JSONB에 그대로 보관.

#### 사용 흐름 (character-designer-agent.md 기준)
```
resource-analyzer가 metadata 생성
   ↓
character-generator-agent / character-designer-agent가 8개 중 top 3 추천
   ↓
characters 테이블에 3개 row 생성 (is_base_character=true, selection_order=1~3, selected=false)
   ↓
마케터가 UI에서 1개 선택 → selected=true
   ↓
(선택) 목소리/성격 편집 → voice_tone, personality_traits, edited_at, edited_by 업데이트
   ↓
선택된 캐릭터 정보가 scenarios 테이블 생성 시 character_id로 참조됨
```

---

### 3️⃣ scenarios (120초 시나리오)

```sql
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id),
  scenario_title VARCHAR(255) NOT NULL,
  story_content TEXT NOT NULL,
  scenario_json JSONB NOT NULL,
  total_duration_seconds INTEGER,
  dialogue_seconds INTEGER,
  narration_seconds INTEGER,
  timing_valid BOOLEAN,
  status VARCHAR(50) DEFAULT 'created',
  marketer_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```
> `character_id`로 위 `characters` 테이블의 `selected=true`인 캐릭터를 참조 (shortform-scenario-writer-agent 출력 결과 저장용).

---

### 4️⃣ naming (제품명/콘텐츠명)

```sql
CREATE TABLE naming (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  product_name_score INTEGER,
  product_meaning TEXT,
  content_name VARCHAR(255) NOT NULL,
  content_name_score INTEGER,
  content_meaning TEXT,
  selection_log JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```
> naming-generator-agent가 제시하는 3개 옵션 중 마케터가 선택한 최종 결과 저장.

---

### 5️⃣ contents (생성된 카피/콘텐츠)

```sql
CREATE TABLE contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id),
  naming_id UUID NOT NULL REFERENCES naming(id),
  content_type VARCHAR(50),
  generated_content TEXT NOT NULL,
  validation_status VARCHAR(50),
  validation_score INTEGER,
  validation_details JSONB,
  status VARCHAR(50) DEFAULT 'created',
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```
> `validation_status`는 compliance-reviewer-agent의 판정 결과(`APPROVED`/`NEEDS REVISION`/`REJECTED`) 저장.

#### `validation_details` JSON 예시
> compliance-reviewer-agent.md의 실제 반환 구조 그대로
```json
{
  "medicalExpressions": { "status": "PASSED", "issues": [] },
  "overstatements": { "status": "PASSED", "issues": [] },
  "brandVoice": { "status": "PASSED", "analysis": {} },
  "corrections": [],
  "recommendation": "✅ 검증 완료 - 바로 사용 가능\n문제 없이 SNS/쇼핑몰에 게시하셔도 됩니다."
}
```
> `validation_score` = compliance-reviewer-agent의 `score`(0~100)를 그대로 저장.

---

### 6️⃣ videos (Higgsfield 생성 영상)

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id),
  higgsfield_id VARCHAR(255) NOT NULL UNIQUE,
  video_url TEXT,
  thumbnail_url TEXT,
  character_used VARCHAR(100),
  video_style VARCHAR(100),
  duration_seconds INTEGER,
  quality VARCHAR(50),
  generation_status VARCHAR(50),
  generation_progress INTEGER,
  generation_start_time TIMESTAMP,
  generation_end_time TIMESTAMP,
  status VARCHAR(50) DEFAULT 'created',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```
> `generation_progress`/`generation_status`는 **frontend-agent.md가 5초마다 폴링해서 화면에 표시**하는 필드.

---

### 7️⃣ generation_logs (전체 흐름 로그)

```sql
CREATE TABLE generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  step VARCHAR(100),
  step_status VARCHAR(50),
  step_details JSONB,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```
> backend-agent가 각 단계(자료분석 → 캐릭터 → 시나리오 → 네이밍 → 콘텐츠 → 영상)마다 자동 기록.

---

## 🔄 전체 데이터 흐름

```
1️⃣ 사용자가 자료 입력 → resources row 생성
   ↓
2️⃣ resource-analyzer-agent 호출 → resources.metadata 자동 생성
   ↓
3️⃣ character-generator-agent / character-designer-agent 호출
   → characters row 3개 생성 (is_base_character, selection_order)
   ↓
4️⃣ 마케터가 캐릭터 1개 선택 (+선택적 편집) → characters.selected=true
   ↓
5️⃣ shortform-scenario-writer-agent 호출 → scenarios row 생성 (character_id 참조)
   ↓
6️⃣ naming-generator-agent 호출 → naming row 생성 (scenario_id 참조)
   ↓
7️⃣ product-intro/detail-writer-agent 호출 → contents row 생성
   ↓
8️⃣ compliance-reviewer-agent 호출 → contents.validation_status 업데이트
   ↓
9️⃣ Higgsfield 호출 → videos row 생성, generation_progress 실시간 업데이트
   ↓
🔟 frontend-agent가 5초마다 videos 폴링 → 화면에 진행률 표시
   ↓
1️⃣1️⃣ 매 단계마다 generation_logs에 기록
```

---

## ✅ 확인 사항

- [x] 모든 테이블이 resource_id로 연결되어 추적 가능한가? → 예
- [x] characters 구조가 캐릭터 생성/편집/관리 기능을 지원하는가? → 예 (`voice_tone`, `personality_traits`, `edited_by` 포함)
- [x] frontend-agent(5초 폴링)가 참조할 필드가 명확한가? → 예 (`generation_progress`, `generation_status`)
- [x] v3의 metadata 옵션 구조와 호환되는가? → 예 (resources.metadata JSONB에 그대로 저장 가능)
- [ ] database-agent 구현 시 이 스키마와 실제 SQL이 100% 일치하는지 박주미님 확인 필요

---

**이 스키마를 기준으로 database-agent가 CRUD를 구현하고, frontend-agent가 videos 테이블을 폴링합니다.**
