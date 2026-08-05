-- Migration: 캐릭터 재현성/일관성 개선
-- Date: 2026-08-05
-- Purpose: 동일 캐릭터 다중 생성 시 일관된 비주얼 유지
-- Strategy: reference_image_url (Higgsfield --image-references), generation_seed 저장

-- ============================================================================
-- ALTER characters 테이블 (기존 컬럼 유지, 신규 컬럼만 추가)
-- ============================================================================

ALTER TABLE characters ADD COLUMN IF NOT EXISTS reference_image_url TEXT;
-- 캐릭터의 레퍼런스 이미지 (Higgsfield 첫 생성 시 저장된 이미지 URL)
-- 이후 같은 캐릭터 생성 시 --image-references로 전달하여 스타일 일관성 유지

ALTER TABLE characters ADD COLUMN IF NOT EXISTS generation_seed TEXT;
-- Higgsfield --seed (현재 미지원이라고 했지만 향후 지원 대비용)

ALTER TABLE characters ADD COLUMN IF NOT EXISTS image_generated_at TIMESTAMP;
-- 레퍼런스 이미지가 생성된 시각 (트래킹용)

ALTER TABLE characters ADD COLUMN IF NOT EXISTS generation_count INTEGER DEFAULT 0;
-- 이 캐릭터로 몇 번 영상을 생성했는지 추적 (재현성 검증용)

-- ============================================================================
-- ALTER videos 테이블 (영상 생성 시 사용된 캐릭터 프로필 버전 추적)
-- ============================================================================

ALTER TABLE videos ADD COLUMN IF NOT EXISTS character_reference_image_url TEXT;
-- 이 영상 생성에 사용된 캐릭터의 reference_image_url (생성 당시 값)
-- 나중에 "어떤 레퍼런스로 만들어졌나" 추적 가능

-- ============================================================================
-- 인덱스 추가 (쿼리 성능)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_characters_reference_image_url
  ON characters(reference_image_url);

CREATE INDEX IF NOT EXISTS idx_characters_generation_count
  ON characters(generation_count DESC);

-- ============================================================================
-- 코멘트 (Supabase 대시보드에서 스키마 이해 용이)
-- ============================================================================

COMMENT ON COLUMN characters.reference_image_url
  IS '첫 캐릭터 생성 시 Higgsfield가 생성한 이미지 URL. 이후 --image-references로 스타일 일관성 유지';

COMMENT ON COLUMN characters.generation_seed
  IS 'Higgsfield --seed 값 (현재 미지원, 향후 지원 대비)';

COMMENT ON COLUMN characters.image_generated_at
  IS '레퍼런스 이미지 생성 시각';

COMMENT ON COLUMN characters.generation_count
  IS '이 캐릭터로 생성한 영상 개수 (재현성 검증 지표)';

COMMENT ON COLUMN videos.character_reference_image_url
  IS '영상 생성에 사용된 캐릭터의 레퍼런스 이미지 URL (생성 당시)';

-- ============================================================================
-- 실행 방법
-- ============================================================================
-- 1. Supabase 대시보드 → SQL Editor 열기
-- 2. 위 스크립트 전체 복사
-- 3. 실행 (Execute)
-- 4. 모든 ALTER TABLE 완료 확인
-- 5. 애플리케이션 재시작

-- ============================================================================
-- 롤백 방법 (필요시)
-- ============================================================================
-- ALTER TABLE characters DROP COLUMN IF EXISTS reference_image_url;
-- ALTER TABLE characters DROP COLUMN IF EXISTS generation_seed;
-- ALTER TABLE characters DROP COLUMN IF EXISTS image_generated_at;
-- ALTER TABLE characters DROP COLUMN IF EXISTS generation_count;
-- ALTER TABLE videos DROP COLUMN IF EXISTS character_reference_image_url;
-- DROP INDEX IF EXISTS idx_characters_reference_image_url;
-- DROP INDEX IF EXISTS idx_characters_generation_count;
