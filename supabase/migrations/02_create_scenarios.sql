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
