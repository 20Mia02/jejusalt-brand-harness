# 재현성/일관성 데모 가이드

## 개요
같은 캐릭터로 여러 번 영상을 생성해도 **일관된 비주얼 스타일**을 유지하는 기능입니다.

## 기술 원리

### 1단계: 캐릭터 설계 저장
- **character-designer-agent** 호출 시 생성된 정보를 DB에 저장
  - `voice_tone`: 목소리 톤 (예: "낮고 차분한 아버지 목소리")
  - `visual_description`: 시각적 묘사 (예: "70년의 바다 경험을 담은 눈빛, 주름진 손")
  - `personality_traits`: 성격 특징들 (배열)

### 2단계: 첫 영상 생성 → 레퍼런스 이미지 저장
- Higgsfield에서 영상 생성 완료
- 생성된 **영상 URL을 `reference_image_url`로 저장** (프레임으로 활용)
- `image_generated_at` 타임스탐프 기록
- `generation_count = 1`로 초기화

### 3단계: 같은 캐릭터 재생성 → 레퍼런스 이미지 전달
- 같은 캐릭터 선택 후 "AI 생성"
- Higgsfield 호출 시 `--image-references` 파라미터로 기존 영상 URL 전달
  ```bash
  higgsfield generate create seedance1_5 \
    --prompt "character metadata..." \
    --image-references "https://..." \
    --duration 8 \
    --resolution 720p \
    --wait
  ```
- 생성된 영상이 동일 스타일로 유지됨
- `generation_count` 증가 (2, 3, ...)

## 발표 데모 시나리오

### 준비물
- 발표 PC에 Higgsfield CLI 로그인 완료 (`higgsfield auth login`)
- 서버 실행 중 (`npm start`)
- 프론트 준비 완료

### 시연 순서

#### 1️⃣ 캐릭터 선택 & 첫 영상 생성 (약 2분)
```
FilterUI 에서:
  제품명: "제주용암프리미엄솔트"
  제품 정보: "나트륨 24.1g/100g, 마그네슘 6370mg, 제주 청정 인증..."
  → "AI 분석 시작"
    ↓ (Step 1-2 분석)
MetadataReviewUI에서:
  → "AI 추천 그대로 사용"
    ↓
CharacterCreator에서:
  → "용암이" 선택
  → "제품스토리" 선택
  → "다음 단계로"
    ↓
GenerationUI에서:
  → "AI 콘텐츠 생성 시작"
    ↓ (Step 4-9 진행, 약 1-2분)
    [Step 4: 캐릭터 상세 설계 → voice_tone, visual_description 저장]
    [Step 9: Higgsfield CLI로 영상 생성 → reference_image_url 저장]
  ✅ 영상 생성 완료, 재생
```

#### 2️⃣ 같은 캐릭터로 2번째 영상 생성 (약 1-2분)
```
GenerationUI 화면:
  "🔄 다시 생성" 버튼 클릭
    ↓
  → "AI 콘텐츠 생성 시작"
    ↓ (Step 4-9 진행)
    [Step 9: Higgsfield CLI 호출 시]
    [--image-references "https://..." (첫 영상 URL)]
    [(같은 캐릭터 스타일 유지)]
  ✅ 2번째 영상 생성 완료
```

#### 3️⃣ 같은 캐릭터로 3번째 영상 생성 (약 1-2분)
```
GenerationUI 화면:
  "🔄 다시 생성" 버튼 클릭
    ↓
  → [같은 프로세스]
    [reference_image_url (2번째 영상 URL) 전달]
  ✅ 3번째 영상 생성 완료
```

### 검증 포인트
- **CharacterCreator 탭**에서: "🖼️ 레퍼런스 이미지" 표시, "✓ 3회 생성됨 (일관된 스타일 유지)" 라벨
- **AdminMode**에서: 같은 캐릭터의 `reference_image_url`, `generation_count` 확인 가능
- **3개 영상 나란히 재생**: 시각적 일관성을 직접 보여줌

## 발표 스크립트

> "제주소금의 핵심 도전은 **일관된 브랜드 아이덴티티 유지**입니다. 같은 캐릭터로 여러 콘텐츠를 만들어도 '어? 이거 같은 캐릭터야?'라고 느껴지면 브랜드 신뢰가 떨어집니다."

> "우리 시스템은 첫 캐릭터 영상 생성 시 **AI가 만든 캐릭터의 시각 정보를 저장**한 다음, Higgsfield에 '이 이미지처럼 똑같은 스타일로 만들어줘'라고 지시합니다."

> "[데모: 같은 캐릭터 3회 생성 재생] 보시다시피, 같은 캐릭터인 '용암이'는 세 번 생성되어도 얼굴, 표정, 옷차림이 일관되게 유지됩니다. 이게 **반복 가능한 고품질 콘텐츠 생산**의 기초입니다."

## 구현 상세 (개발자용)

### DB 스키마 변경
```sql
-- characters 테이블에 추가된 컬럼
ALTER TABLE characters ADD COLUMN reference_image_url TEXT;
  -- Higgsfield 첫 생성 영상 URL (프레임으로 활용)
ALTER TABLE characters ADD COLUMN image_generated_at TIMESTAMP;
  -- 레퍼런스 이미지 생성 시각
ALTER TABLE characters ADD COLUMN generation_count INTEGER DEFAULT 0;
  -- 생성된 영상 개수 (재현성 검증 지표)

-- videos 테이블에 추가된 컬럼
ALTER TABLE videos ADD COLUMN character_reference_image_url TEXT;
  -- 이 영상 생성 시 사용된 캐릭터의 reference_image_url
```

### API 흐름
```javascript
// POST /api/generate/:resourceId/start

// Step 4: character-designer-agent 호출
// → voice_tone, visual_description, personality_traits 생성
// → characters 테이블 UPDATE

// Step 9: Higgsfield 호출
const higgsfieldCommand = `higgsfield generate create seedance1_5
  --prompt "${metadata}"
  ${selectedCharacter.reference_image_url ? 
    `--image-references "${selectedCharacter.reference_image_url}"` : ''}
  --duration 8
  --resolution 720p
  --wait`;

// 영상 생성 성공 시
if (firstGeneration) {
  // 첫 생성: reference_image_url에 영상 URL 저장
  UPDATE characters SET
    reference_image_url = '${videoUrl}',
    image_generated_at = NOW(),
    generation_count = 1
  WHERE id = '${characterId}';
} else {
  // 재생성: generation_count만 증가
  UPDATE characters SET generation_count = generation_count + 1;
}
```

### 프론트엔드 UI
- **CharacterCreator.jsx**: 선택된 캐릭터의 `reference_image_url` 미리보기 + `generation_count` 표시
- **AdminMode.jsx**: 모든 캐릭터의 레퍼런스 이미지 및 생성 횟수 관리 대시보드

## 주의사항

1. **Higgsfield 지원 확인**
   - `--image-references` 파라미터 지원 확인 필수
   - CLI 버전에 따라 파라미터명이 다를 수 있음 (예: `--reference-image`, `--style-reference`)

2. **레퍼런스 이미지 유효성**
   - 영상 URL이 일정 기간 유효한지 확인 (만료 대책 필요)
   - 이미지 프레임 추출 로직 추후 개선 권장 (현재는 영상 URL 사용)

3. **성능**
   - 매번 --image-references 파라미터 추가로 인한 생성 시간 영향 모니터링
   - 현재 무제한 재생성 가능 → 차후 quota 제한 고려

## 성공 지표
- ✅ 같은 캐릭터 3회 생성 시 시각 일관성 유지
- ✅ AdminMode에서 `generation_count` 순차 증가 확인
- ✅ `reference_image_url` 첫 생성 후 유지
- ✅ 프론트에서 "✓ N회 생성됨" 라벨 표시
