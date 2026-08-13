CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS character_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  character_name TEXT NOT NULL,
  character_profile TEXT,
  voice_tone TEXT,
  personality_traits TEXT[],
  visual_description TEXT,
  reference_image_url TEXT,
  generation_seed TEXT,
  generation_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_character_library_name ON character_library(character_name);

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

INSERT INTO character_library (
  character_name, character_profile, voice_tone, personality_traits,
  visual_description, reference_image_url, generation_seed, generation_count, source
)
SELECT
  character_name, character_profile, voice_tone, personality_traits,
  visual_description, reference_image_url, generation_seed, generation_count, 'default'
FROM characters
WHERE character_name IN ('용암이', '결이', '가마할방', '해수', '현무', '미내', '불이', '한라')
ON CONFLICT DO NOTHING;

ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_base_character BOOLEAN DEFAULT FALSE;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS library_character_id UUID;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_characters_resource_id ON characters(resource_id);
CREATE INDEX IF NOT EXISTS idx_characters_library_id ON characters(library_character_id);
CREATE INDEX IF NOT EXISTS idx_characters_selected ON characters(resource_id, selected);
