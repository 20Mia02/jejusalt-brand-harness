-- ============================================================================
-- 마이그레이션: characters 테이블 스키마 수정
-- 실행 방법: Supabase 대시보드 > SQL Editor > 전체 코드 붙여넣기 > 실행
-- 목적: routes/resources.js가 기대하는 컬럼들이 characters 테이블에 존재하도록 추가
-- ============================================================================

-- 1. resource_id 컬럼 추가 (FK - 어떤 자료에 속한 캐릭터인지)
--    ※ 실제 DB에는 이 컬럼이 없어서 routes/resources.js의 characterRows에 resource_id를 넣어도
--      DB에 저장되지 않았을 수 있음. 우선 컬럼 추가 후 기존 데이터는 NULL로 둠.
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES resources(id) ON DELETE CASCADE;

-- 2. is_base_character 컬럼 추가 (캐릭터 라이브러리 출신 여부)
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS is_base_character BOOLEAN DEFAULT FALSE;

-- 3. library_character_id 컬럼 추가 (원본 라이브러리 캐릭터 참조)
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS library_character_id UUID;

-- 4. reason 컬럼 추가 (추천 이유)
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS reason TEXT;

-- 5. score 컬럼 추가 (추천 점수)
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS score INTEGER;

-- 6. generation_seed 컬럼 추가 (Higgsfield job id - 재현성용)
--    ※ 실제 DB에 이미 generation_seed가 있는지 확인 후 추가
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS generation_seed TEXT;

-- 7. edited_at 컬럼 추가 (편집 시각)
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- 8. edited_by 컬럼 추가 (편집자)
--    ※ 실제 DB에 이미 edited_by가 있는지 확인
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS edited_by TEXT;

-- ============================================================================
-- 인덱스 추가 (자원별 캐릭터 조회 성능 향상)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_characters_resource_id ON characters(resource_id);
CREATE INDEX IF NOT EXISTS idx_characters_library_id ON characters(library_character_id);
CREATE INDEX IF NOT EXISTS idx_characters_selected ON characters(resource_id, selected);

-- ============================================================================
-- 기존 데이터에 resource_id 등 채우기 (가능한 경우)
-- ============================================================================
-- ※ 이 부분은 실제 데이터 상황에 따라 수동 실행 필요
-- 기존 characters 테이블의 캐릭터들이 특정 resource에 연결되지 않은 상태라면
-- resource_id는 NULL로 둠. 추후에 resources가 생성될 때 relationship 설정 필요.

-- ============================================================================
-- 완료 확인 쿼리
-- ============================================================================

-- characters 테이블 컬럼 전체 확인:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'characters'
-- ORDER BY ordinal_position;

-- migration 후 expected 컬럼 확인:
-- SELECT
--   'resource_id' AS col, EXISTS (
--     SELECT 1 FROM information_schema.columns WHERE table_name='characters' AND column_name='resource_id'
--   ) AS exists_union,
--   'is_base_character' AS col, EXISTS (
--     SELECT 1 FROM information_schema.columns WHERE table_name='characters' AND column_name='is_base_character'
--   ) AS exists_union;
