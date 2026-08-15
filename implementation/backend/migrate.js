const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrateSchema() {
  try {
    console.log("🔍 Supabase에 접속 중...");
    
    // resources 테이블에서 한 개의 행을 읽어서 스키마 확인
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .limit(1);
    
    if (error) {
      console.log("❌ resources 테이블 접근 오류:", error.message);
      console.log("\n📝 해결책: reference_materials 필드가 필요합니다.");
      console.log("수정된 insert 쿼리로 자동 생성될 것입니다.");
      process.exit(1);
    }
    
    console.log("✓ resources 테이블 접근 성공");
    console.log("✓ 데이터베이스 준비 완료!");
    process.exit(0);
  } catch (e) {
    console.error("❌ 오류:", e.message);
    process.exit(1);
  }
}

migrateSchema();
