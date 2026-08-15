-- ============================================================================
-- Supabase 마이그레이션 SQL
-- 제주소금 AI 콘텐츠 생성 엔진 v1.0
-- 실행: Supabase Dashboard > SQL Editor에서 전체 실행
-- 프로젝트: ptlekzyouirucvweuytg
-- ============================================================================

-- UUID 함수 활성화
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. tables: character_library, contents, videos, scenarios, quality_assurance_logs 생성
-- ============================================================================

-- character_library (이미 존재하면 ALTER로 누락된 컬럼만 추가)
CREATE TABLE IF NOT EXISTS character_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  character_name TEXT NOT NULL,
  role TEXT,
  tone_trait TEXT,
  character_profile TEXT,
  voice_tone TEXT,
  personality_traits TEXT[],
  visual_description TEXT,
  gender TEXT,
  character_type TEXT,
  reference_image_url TEXT,
  generation_seed TEXT,
  generation_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_library_name ON character_library(character_name);

-- contents
CREATE TABLE IF NOT EXISTS contents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL,
  naming_id UUID REFERENCES naming(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  generated_content TEXT NOT NULL,
  validation_status TEXT DEFAULT 'DRAFT',
  validation_score INTEGER,
  validation_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contents_resource_id ON contents(resource_id);
CREATE INDEX IF NOT EXISTS idx_contents_content_type ON contents(content_type);

-- videos
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
  generation_status TEXT DEFAULT 'pending',
  generation_progress INTEGER DEFAULT 0,
  video_url TEXT,
  character_reference_image_url TEXT,
  generation_start_time TIMESTAMP WITH TIME ZONE,
  generation_end_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_resource_id ON videos(resource_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(generation_status);

-- scenarios
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  scenario_title TEXT NOT NULL,
  story_content TEXT NOT NULL,
  scenario_json JSONB NOT NULL,
  total_duration_seconds INTEGER,
  dialogue_seconds INTEGER,
  narration_seconds INTEGER,
  timing_valid BOOLEAN DEFAULT TRUE,
  marketer_approved BOOLEAN DEFAULT FALSE,
  marketer_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_resource_id ON scenarios(resource_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_character_id ON scenarios(character_id);

-- quality_assurance_logs
CREATE TABLE IF NOT EXISTS quality_assurance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  content_id UUID,
  category TEXT NOT NULL,
  auto_validation JSONB,
  manual_checklist JSONB,
  final_verdict TEXT,
  issues_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_assurance_logs_resource_id ON quality_assurance_logs(resource_id);

-- ============================================================================
-- 2. characters 테이블에 누락된 컬럼 추가
-- ============================================================================
-- 현재 characters 컬럼: id, character_name, role, tone, character_profile, voice_tone,
--   personality_traits, visual_description, preferred_expressions, source,
--   generation_count, selected, reference_image_url, edited_by, created_at, updated_at
-- 필요 컬럼: is_base_character, library_character_id, reason, score (선택), avoid_expressions

ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_base_character BOOLEAN DEFAULT FALSE;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS library_character_id UUID;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS avoid_expressions TEXT[] DEFAULT '{}';

-- 기존 참조: character_library로의 FK 제약조건 추가 (선택사항)
-- ALTER TABLE characters ADD CONSTRAINT fk_characters_library FOREIGN KEY (library_character_id) REFERENCES character_library(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. 기존 테이블 확인 및 인덱스 생성
-- ============================================================================

-- resources 테이블에 metadata, reference_materials가 있는지 확인
ALTER TABLE resources ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
-- reference_materials는 이미 있을 수 있으니 확인
-- (Supabase에서는 ADD COLUMN IF NOT EXISTS가 지원되지 않을 수 있음 - 예외 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resources' AND column_name = 'reference_materials'
  ) THEN
    ALTER TABLE resources ADD COLUMN reference_materials JSONB DEFAULT '[]';
  END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at DESC);

-- ============================================================================
-- 4. 기타 보조 테이블 (필요시)
-- ============================================================================

-- 이미 존재하는 테이블 확인
-- naming, comments, generation_logs는 존재함 (이전 체크 결과)
-- quality_assurance_logs는 방금 생성됨

-- ============================================================================
-- 완료 메시지
-- ============================================================================
SELECT '마이그레이션 완료!' AS result;
