-- 통합 마이그레이션: 재현성/일관성 + 캐릭터 라이브러리 + 참고자료 + 로그 강화
-- 실행 방법: Supabase 대시보드 -> SQL Editor -> 전체 복사 -> Run
-- 기존 데이터는 전혀 삭제/변경되지 않고, 컬럼/테이블만 추가됩니다 (안전하게 반복 실행 가능)

-- 1. characters 테이블: 재현성 + 라이브러리 연동 컬럼
ALTER TABLE characters ADD COLUMN IF NOT EXISTS reference_image_url TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS generation_seed TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS image_generated_at TIMESTAMP;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS generation_count INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS library_character_id UUID;
-- library_character_id: 이 캐릭터가 character_library의 어떤 기본 캐릭터에서 왔는지 추적
-- (다른 자료에서도 같은 캐릭터를 쓸 때 레퍼런스 이미지/프로필을 동기화하는 데 사용)

-- 2. videos 테이블: 생성 당시 사용된 레퍼런스 이미지 추적
ALTER TABLE videos ADD COLUMN IF NOT EXISTS character_reference_image_url TEXT;

-- 3. resources 테이블: 추가 참고자료(기업자료_요약.md 등)
ALTER TABLE resources ADD COLUMN IF NOT EXISTS reference_materials JSONB DEFAULT '[]'::jsonb;
-- [{filename, content}, ...] 형태로 저장, 시나리오 작성(Step 5)에 반영됨

-- 4. generation_logs 테이블: 실패 원인 상세 추적
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS error_code VARCHAR(50);
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS error_stack TEXT;
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS attempt INTEGER DEFAULT 1;
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS total_attempts INTEGER DEFAULT 3;
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS retry_delay_ms INTEGER DEFAULT 0;
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 0;
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT NOW();

-- 5. character_library 테이블: 기본 캐릭터 풀 (신규)
CREATE TABLE IF NOT EXISTS character_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_name VARCHAR(100) NOT NULL,
  role VARCHAR(255),
  tone_trait VARCHAR(255),
  character_profile TEXT,
  voice_tone VARCHAR(255),
  personality_traits JSONB,
  visual_description TEXT,
  reference_image_url TEXT,
  generation_seed TEXT,
  image_generated_at TIMESTAMP,
  generation_count INTEGER DEFAULT 0,
  source VARCHAR(50) DEFAULT 'user_created', -- 'default' | 'user_created' | 'ai_generated'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- config.json의 8개 기본 캐릭터로 최초 1회 시딩 (이미 있으면 건너뜀)
INSERT INTO character_library (character_name, role, tone_trait, character_profile, voice_tone, personality_traits, source)
SELECT * FROM (VALUES
  ('결이', '당찬 소년', '도전적, 에너지 넘침', '당찬 소년 · 도전적, 에너지 넘침', '도전적, 에너지 넘침', '["도전적","에너지 넘침"]'::jsonb, 'default'),
  ('용암이', '따뜨한 아버지', '신뢰감, 보호본능', '따뜨한 아버지 · 신뢰감, 보호본능', '신뢰감, 보호본능', '["신뢰감","보호본능"]'::jsonb, 'default'),
  ('해수', '자유로운 영혼', '경쾌함, 순수함', '자유로운 영혼 · 경쾌함, 순수함', '경쾌함, 순수함', '["경쾌함","순수함"]'::jsonb, 'default'),
  ('미내', '지혜로운 할머니', '안정감, 포용력', '지혜로운 할머니 · 안정감, 포용력', '안정감, 포용력', '["안정감","포용력"]'::jsonb, 'default'),
  ('현무', '묵직한 장인', '신뢰성, 기술력', '묵직한 장인 · 신뢰성, 기술력', '신뢰성, 기술력', '["신뢰성","기술력"]'::jsonb, 'default'),
  ('가마할방', '제주 전통의 수호자', '정통성, 가치 전승', '제주 전통의 수호자 · 정통성, 가치 전승', '정통성, 가치 전승', '["정통성","가치 전승"]'::jsonb, 'default'),
  ('불이', '에너지의 화신', '활력, 긍정성', '에너지의 화신 · 활력, 긍정성', '활력, 긍정성', '["활력","긍정성"]'::jsonb, 'default'),
  ('한라', '제주 자연의 상징', '웅장함, 안정성', '제주 자연의 상징 · 웅장함, 안정성', '웅장함, 안정성', '["웅장함","안정성"]'::jsonb, 'default')
) AS seed(character_name, role, tone_trait, character_profile, voice_tone, personality_traits, source)
WHERE NOT EXISTS (SELECT 1 FROM character_library WHERE character_library.source = 'default');

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_characters_library_character_id ON characters(library_character_id);
CREATE INDEX IF NOT EXISTS idx_characters_reference_image_url ON characters(reference_image_url);
CREATE INDEX IF NOT EXISTS idx_generation_logs_resource_id_status ON generation_logs(resource_id, status);
CREATE INDEX IF NOT EXISTS idx_character_library_source ON character_library(source);

-- 7. 코멘트
COMMENT ON TABLE character_library IS '여러 자료(resource)에서 재사용 가능한 기본 캐릭터 풀';
COMMENT ON COLUMN characters.library_character_id IS '이 캐릭터가 유래한 character_library.id (재현성 동기화용)';
COMMENT ON COLUMN resources.reference_materials IS '업로드된 추가 참고자료 [{filename, content}] - 시나리오 작성에 반영';

-- 완료. 아래 쿼리로 확인해보세요:
-- SELECT * FROM character_library;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'characters';
