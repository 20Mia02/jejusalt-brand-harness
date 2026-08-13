-- ============================================================================
-- 마이그레이션: 누락된 테이블 생성 (Supabase SQL Editor에서 실행)
-- 실행 방법: Supabase 대시보드 > SQL Editor > 전체 코드 붙여넣기 > 실행
-- 프로젝트: ptlekzyouirucvweuytg
-- ============================================================================

-- UUID 함수 활성화 (이미 되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. character_library: 기본 캐릭터 풀 (재사용 가능한 캐릭터 라이브러리)
-- ============================================================================

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

-- ============================================================================
-- 2. contents: 생성된 콘텐츠 저장
-- ============================================================================

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

-- ============================================================================
-- 3. videos: 영상 생성 결과/상태
-- ============================================================================

CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
  generation_status TEXT DEFAULT 'pending',
  generation_progress INTEGER DEFAULT 0,
  video_url TEXT,
  character_reference_image_url TEXT,
  generation_start_time TIMESTAMP WITH TIME ZONE,
  generation_end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_resource_id ON videos(resource_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(generation_status);

-- ============================================================================
-- 4. scenarios: 시나리오 저장
-- ============================================================================

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

-- ============================================================================
-- 5. quality_assurance_logs: QA 로그
-- ============================================================================

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
-- character_library에 기존 characters 테이블 데이터를 시드로 복사
-- ============================================================================

INSERT INTO character_library (
  character_name,
  role,
  tone_trait,
  character_profile,
  voice_tone,
  personality_traits,
  visual_description,
  source,
  generation_count,
  reference_image_url
)
SELECT
  character_name,
  role,
  tone_trait,
  character_profile,
  voice_tone,
  personality_traits,
  visual_description,
  'default',
  generation_count,
  reference_image_url
FROM characters
WHERE character_name IN (
  '용암이', '결이', '가마할방', '해수', '현무', '미내', '불이', '한라'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 완료 확인 쿼리 (실행 후 결과 확인)
-- ============================================================================

-- 1) 테이블 생성 확인:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('character_library', 'contents', 'videos', 'scenarios', 'quality_assurance_logs')
-- ORDER BY table_name;

-- 2) character_library 데이터 확인:
-- SELECT character_name, source, generation_count, reference_image_url IS NOT NULL AS has_image
-- FROM character_library ORDER BY character_name;
