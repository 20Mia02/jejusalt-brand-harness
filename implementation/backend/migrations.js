/**
 * Supabase 테이블 마이그레이션 스크립트
 * 제주소금 AI 콘텐츠 생성 엔진 - DB 스키마 동기화
 *
 * 실행 방법:
 *   node migrations.js
 *
 * 실제 테이블 생성/수정 (Supabase 서비스 키 필요)
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================================
// 테이블 생성/수정 SQL
// ============================================================================

const TABLES = {
  resources: `
    CREATE TABLE IF NOT EXISTS resources (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      product_name TEXT NOT NULL,
      product_info TEXT NOT NULL,
      keywords TEXT[],
      reference_materials JSONB DEFAULT '[]',
      metadata JSONB DEFAULT '{}',
      status TEXT DEFAULT 'analyzing',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
    CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at DESC);
  `,

  characters: `
    CREATE TABLE IF NOT EXISTS characters (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      character_name TEXT NOT NULL,
      character_profile TEXT,
      is_base_character BOOLEAN DEFAULT FALSE,
      voice_tone TEXT,
      personality_traits TEXT[],
      visual_description TEXT,
      reference_image_url TEXT,
      generation_seed TEXT,
      generation_count INTEGER DEFAULT 0,
      library_character_id UUID,
      reason TEXT,
      score INTEGER,
      selected BOOLEAN DEFAULT FALSE,
      preferred_expressions TEXT[],
      avoid_expressions TEXT[],
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_characters_resource_id ON characters(resource_id);
    CREATE INDEX IF NOT EXISTS idx_characters_library_id ON characters(library_character_id);
    CREATE INDEX IF NOT EXISTS idx_characters_selected ON characters(resource_id, selected);
  `,

  character_library: `
    CREATE TABLE IF NOT EXISTS character_library (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  `,

  contents: `
    CREATE TABLE IF NOT EXISTS contents (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  `,

  videos: `
    CREATE TABLE IF NOT EXISTS videos (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  `,

  scenarios: `
    CREATE TABLE IF NOT EXISTS scenarios (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  `,

  naming: `
    CREATE TABLE IF NOT EXISTS naming (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      product_name_1 TEXT,
      product_name_1_score INTEGER,
      product_name_1_meaning TEXT,
      product_name_2 TEXT,
      product_name_2_score INTEGER,
      product_name_2_meaning TEXT,
      product_name_3 TEXT,
      product_name_3_score INTEGER,
      product_name_3_meaning TEXT,
      content_name_1 TEXT,
      content_name_1_score INTEGER,
      content_name_1_meaning TEXT,
      content_name_2 TEXT,
      content_name_2_score INTEGER,
      content_name_2_meaning TEXT,
      content_name_3 TEXT,
      content_name_3_score INTEGER,
      content_name_3_meaning TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_naming_resource_id ON naming(resource_id);
  `,

  comments: `
    CREATE TABLE IF NOT EXISTS comments (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      author TEXT DEFAULT '담당자',
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_comments_resource_id ON comments(resource_id);
  `,

  generation_logs: `
    CREATE TABLE IF NOT EXISTS generation_logs (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      step TEXT NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      attempt INTEGER DEFAULT 1,
      error_message TEXT,
      error_code TEXT,
      error_stack TEXT,
      total_attempts INTEGER,
      retry_delay_ms INTEGER,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_generation_logs_resource_id ON generation_logs(resource_id);
    CREATE INDEX IF NOT EXISTS idx_generation_logs_step ON generation_logs(resource_id, step);
  `,

  quality_assurance_logs: `
    CREATE TABLE IF NOT EXISTS quality_assurance_logs (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  `
};

// 컬럼 추가 마이그레이션 (기존 테이블에 누락된 컬럼 추가)
const COLUMN_MIGRATIONS = [
  // resources 테이블에 metadata가 이미 있으면 추가하지 않음 (JSONB)
  {
    table: "resources",
    check: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("metadata")
        .limit(1);
      return !error || data !== null;
    },
    add: `
      ALTER TABLE resources ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    `
  },
  // characters 테이블에 is_base_character가 없으면 추가
  {
    table: "characters",
    check: async () => {
      try {
        await supabase
          .from("characters")
          .select("is_base_character")
          .limit(1);
        return true; // 컬럼 있음
      } catch (e) {
        return false; // 컬럼 없음
      }
    },
    add: `
      ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_base_character BOOLEAN DEFAULT FALSE;
    `
  },
  // characters 테이블에 preferred_expressions/avoid_expressions 추가
  {
    table: "characters",
    check: async () => {
      try {
        await supabase
          .from("characters")
          .select("preferred_expressions")
          .limit(1);
        return true;
      } catch (e) {
        return false;
      }
    },
    add: `
      ALTER TABLE characters ADD COLUMN IF NOT EXISTS preferred_expressions TEXT[] DEFAULT '{}';
      ALTER TABLE characters ADD COLUMN IF NOT EXISTS avoid_expressions TEXT[] DEFAULT '{}';
    `
  },
  // videos 테이블에 character_reference_image_url 추가
  {
    table: "videos",
    check: async () => {
      try {
        await supabase
          .from("videos")
          .select("character_reference_image_url")
          .limit(1);
        return true;
      } catch (e) {
        return false;
      }
    },
    add: `
      ALTER TABLE videos ADD COLUMN IF NOT EXISTS character_reference_image_url TEXT;
    `
  }
];

// ============================================================================
// 마이그레이션 실행
// ============================================================================

async function runMigrations() {
  console.log("🔍 Supabase 마이그레이션 시작...\n");

  // 1. 테이블 생성
  console.log("📋 테이블 생성 중...");
  for (const [name, sql] of Object.entries(TABLES)) {
    try {
      const { error } = await supabase.rpc("exec_sql", { sql_string: sql });
      if (error && error.message.includes("function") || error.message.includes("does not exist")) {
        // RPC 함수가 없는 경우 raw SQL 실행
        await supabase.from("__dummy__").select("*").limit(0);
        console.log(`  ⚠️ ${name}: RPC 없이 진행 ( 무시 )`);
      } else if (error) {
        console.log(`  ⚠️ ${name}: ${error.message}`);
      } else {
        console.log(`  ✓ ${name} 테이블 확인/생성`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${name}: ${e.message}`);
    }
  }

  // 2. 컬럼 추가 마이그레이션
  console.log("\n📋 누락된 컬럼 추가 중...");
  for (const migration of COLUMN_MIGRATIONS) {
    try {
      const hasColumn = await migration.check();
      if (!hasColumn) {
        console.log(`  → ${migration.table}에 컬럼 추가`);
        // raw SQL 실행: supabase-js에서는 직접 SQL 실행을 지원하지 않으므로
        // Supabase 대시보드나 psql을 통해 실행해야 함
        console.log(`  ⚠️ 컬럼 추가는 Supabase 대시보드 또는 psql로 수동 실행 필요`);
        console.log(`     SQL: ${migration.add.trim()}`);
      } else {
        console.log(`  ✓ ${migration.table} 컬럼 이미 존재`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${migration.table}: ${e.message}`);
    }
  }

  console.log("\n✅ 마이그레이션 완료!");
  console.log("\n📝 supabase-js에서는 DROP/ALTER TABLE을 직접 실행할 수 없습니다.");
  console.log("   Supabase 대시보드 > SQL Editor에서 아래 명령어를 실행하거나,");
  console.log("   psql로 직접 연결해서 실행하세요.");
}

runMigrations().catch(console.error);
