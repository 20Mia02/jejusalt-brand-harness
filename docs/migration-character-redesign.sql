-- 캐릭터 8개 완전 리디자인 반영 마이그레이션
-- 실행 방법: Supabase 대시보드 -> SQL Editor -> 전체 복사 -> Run
-- 기존 행은 삭제되지 않고, 컬럼 추가 + 8개 기본 캐릭터(source='default') 행만 갱신됩니다.
-- 참고 문서: docs/character-concept.md

-- 1. character_library에 gender / character_type 컬럼 추가 (없으면)
ALTER TABLE character_library ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE character_library ADD COLUMN IF NOT EXISTS character_type VARCHAR(50);

-- 2. 8개 기본 캐릭터 리디자인 데이터 반영
UPDATE character_library SET
  gender = 'M',
  character_type = 'SALT',
  role = '주인공/마스코트',
  tone_trait = '활발함, 밝음, 에너지, 희망',
  personality_traits = '["활발함","밝음","에너지","희망"]'::jsonb,
  visual_description = '밝은 파랑(#00AEEF) 정육면체 몸, 파란 모자, 큰 생기 있는 눈, 빨간 미소, 빨간 물방울 귀',
  character_profile = '주인공/마스코트 · 활발함, 밝음, 에너지, 희망',
  updated_at = NOW()
WHERE character_name = '결이' AND source = 'default';

UPDATE character_library SET
  gender = 'F',
  character_type = 'LAVA',
  role = '세계관 설명자/할머니',
  tone_trait = '신비로움, 지혜, 역사, 포용',
  personality_traits = '["신비로움","지혜","역사","포용"]'::jsonb,
  visual_description = '어두운 파랑(#1A3A52) 둥근 산 모양, 흰 머리, 지혜로운 눈, 포근한 미소, 목걸이',
  character_profile = '세계관 설명자/할머니 · 신비로움, 지혜, 역사, 포용',
  updated_at = NOW()
WHERE character_name = '한라' AND source = 'default';

UPDATE character_library SET
  gender = 'M',
  character_type = 'LAVA',
  role = '기술 설명자/아버지',
  tone_trait = '신뢰감, 보호, 기술, 따뜻함',
  personality_traits = '["신뢰감","보호","기술","따뜻함"]'::jsonb,
  visual_description = '진한 파랑(#0D1B2A) 둥근 몸+각진 어깨, 검은 머리, 따뜻한 눈, 신뢰감 있는 미소, 목 스카프',
  character_profile = '기술 설명자/아버지 · 신뢰감, 보호, 기술, 따뜻함',
  updated_at = NOW()
WHERE character_name = '용암이' AND source = 'default';

UPDATE character_library SET
  gender = 'F',
  character_type = 'MINERAL',
  role = '프리미엄 감성/여성',
  tone_trait = '우아함, 미네랄, 프리미엄, 신비',
  personality_traits = '["우아함","미네랄","프리미엄","신비"]'::jsonb,
  visual_description = '보라색(#6B4C9A) 우아한 S자 곡선, 분홍 리본, 초록색 눈, 세련된 미소, 귀걸이+목걸이, 크리스탈 무늬',
  character_profile = '프리미엄 감성/여성 · 우아함, 미네랄, 프리미엄, 신비',
  updated_at = NOW()
WHERE character_name = '해수' AND source = 'default';

UPDATE character_library SET
  gender = 'F',
  character_type = 'SALT',
  role = '응원자/누나',
  tone_trait = '격려, 함께함, 활발함, 포용',
  personality_traits = '["격려","함께함","활발함","포용"]'::jsonb,
  visual_description = '노랑(#FFD700) 동그랗고 활발한 형태, 노랑 머리+리본, 크고 밝은 눈, 큰 웃음, 분홍 리본',
  character_profile = '응원자/누나 · 격려, 함께함, 활발함, 포용',
  updated_at = NOW()
WHERE character_name = '미내' AND source = 'default';

UPDATE character_library SET
  gender = 'M',
  character_type = 'LAVA',
  role = '신뢰성/형',
  tone_trait = '신뢰, 기술, 정확성, 견고',
  personality_traits = '["신뢰","기술","정확성","견고"]'::jsonb,
  visual_description = '다크 파랑(#1F3A52) 기하학적 정직한 형태, 검은 머리, 묵직한 눈, 신뢰감 있는 표정, 액세서리 없음',
  character_profile = '신뢰성/형 · 신뢰, 기술, 정확성, 견고',
  updated_at = NOW()
WHERE character_name = '현무' AND source = 'default';

UPDATE character_library SET
  gender = 'F',
  character_type = 'FIRE',
  role = '정성/할머니',
  tone_trait = '장인정신, 따뜻함, 경험, 사랑',
  personality_traits = '["장인정신","따뜻함","경험","사랑"]'::jsonb,
  visual_description = '갈색(#8B4513) 동그랗고 포근한 할머니 형태, 흰 머리, 따뜻한 눈, 포근한 웃음, 앞치마+수건',
  character_profile = '정성/할머니 · 장인정신, 따뜻함, 경험, 사랑',
  updated_at = NOW()
WHERE character_name = '가마할방' AND source = 'default';

UPDATE character_library SET
  gender = 'M',
  character_type = 'FIRE',
  role = '에너지/친구',
  tone_trait = '열정, 에너지, 공유, 긍정',
  personality_traits = '["열정","에너지","공유","긍정"]'::jsonb,
  visual_description = '주황빨강(#FF4500) 역동적 불꽃 모양, 빨강/주황 머리, 크고 반짝이는 눈, 큰 웃음, 활발한 분위기',
  character_profile = '에너지/친구 · 열정, 에너지, 공유, 긍정',
  updated_at = NOW()
WHERE character_name = '불이' AND source = 'default';

-- 3. 인덱스 (조회 최적화)
CREATE INDEX IF NOT EXISTS idx_character_library_gender ON character_library(gender);
CREATE INDEX IF NOT EXISTS idx_character_library_character_type ON character_library(character_type);

-- 완료. 아래 쿼리로 확인해보세요:
-- SELECT character_name, gender, character_type, role, tone_trait, visual_description FROM character_library WHERE source = 'default' ORDER BY character_name;
