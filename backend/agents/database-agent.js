/**
 * backend/agents/database-agent.js
 * 제주소금 AI 콘텐츠 생성 엔진 - 데이터베이스 에이전트
 * 
 * 역할:
 * 1. Supabase CRUD 작업 (callDatabase)
 * 2. 자료 필터링 조회 (getResourcesByFilter)
 * 3. FK 관계 검증 및 데이터 일관성 관리
 * 
 * 의존성: @supabase/supabase-js
 * 환경변수: SUPABASE_URL, SUPABASE_ANON_KEY
 */

const { createClient } = require("@supabase/supabase-js");

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============================================================================
// [함수 1] callDatabase - 일반 CRUD 작업
// ============================================================================
/**
 * Supabase 데이터베이스 CRUD 작업 (CREATE, READ, UPDATE, DELETE)
 * 
 * @param {string} table - 테이블 이름 (예: "resources", "characters", "contents", "videos")
 * @param {string} operation - "create" | "read" | "update" | "delete"
 * @param {object} data - 저장/수정할 데이터
 * @param {object} filter - WHERE 조건 (read/update/delete 시 필요)
 * @returns {object} {success, rows, error}
 */
async function callDatabase(table, operation, data, filter) {
  try {
    // ========== CREATE (INSERT) ==========
    if (operation === "create") {
      if (!Array.isArray(data)) {
        data = [data];
      }
      
      console.log(`[DB] INSERT into ${table}: ${data.length}개 row`);
      
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select();
      
      if (error) {
        console.error(`  [FK 오류?] ${error.message}`);
        return { success: false, error: "FK_OR_CONSTRAINT_VIOLATION", message: error.message };
      }
      
      console.log(`  [✓] ${result.length}개 row 생성됨`);
      return { success: true, rows: result || [] };
    }
    
    // ========== READ (SELECT) ==========
    if (operation === "read") {
      let query = supabase.from(table).select("*");
      
      // filter 적용
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            // IN 쿼리 (예: status in ('completed', 'pending'))
            query = query.in(key, value);
          } else {
            // 단순 equals
            query = query.eq(key, value);
          }
        });
      }
      
      // 최신순 정렬
      query = query.order("created_at", { ascending: false });
      
      const { data: result, error } = await query;
      
      if (error) {
        console.error(`[DB] SELECT 실패: ${error.message}`);
        return { success: false, error: "NOT_FOUND", message: error.message };
      }
      
      console.log(`[DB] SELECT from ${table}: ${result.length}개 row`);
      return { success: true, rows: result || [] };
    }
    
    // ========== UPDATE ==========
    if (operation === "update") {
      if (!filter || Object.keys(filter).length === 0) {
        throw new Error("UPDATE는 filter(WHERE 조건)이 필수입니다");
      }
      
      console.log(`[DB] UPDATE ${table} WHERE ${JSON.stringify(filter)}`);
      
      let query = supabase.from(table).update(data);
      
      // filter 적용
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      const { data: result, error } = await query.select();
      
      if (error) {
        console.error(`  [오류] ${error.message}`);
        return { success: false, error: "UPDATE_FAILED", message: error.message };
      }
      
      console.log(`  [✓] ${result.length}개 row 업데이트됨`);
      return { success: true, rows: result || [] };
    }
    
    // ========== DELETE ==========
    if (operation === "delete") {
      if (!filter || Object.keys(filter).length === 0) {
        throw new Error("DELETE는 filter(WHERE 조건)이 필수입니다");
      }
      
      console.log(`[DB] DELETE from ${table} WHERE ${JSON.stringify(filter)}`);
      
      let query = supabase.from(table).delete();
      
      // filter 적용
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      const { data: result, error } = await query.select();
      
      if (error) {
        console.error(`  [오류] ${error.message}`);
        return { success: false, error: "DELETE_FAILED", message: error.message };
      }
      
      console.log(`  [✓] ${result.length}개 row 삭제됨`);
      return { success: true, rows: result || [] };
    }
    
    return { success: false, error: "INVALID_OPERATION", message: "CREATE/READ/UPDATE/DELETE 중 하나를 선택하세요" };
    
  } catch (error) {
    console.error(`[DB] 예외: ${error.message}`);
    return { success: false, error: "DB_ERROR", message: error.message };
  }
}

// ============================================================================
// [함수 2] getResourcesByFilter - 자료 필터링 조회
// ============================================================================
/**
 * 자료를 카테고리/나이대로 필터링해서 조회
 * 
 * @param {object} filters - {categories: [...], ageGroups: [...], targets: [...], status: '...'}
 * @returns {object} {success, rows, total}
 */
async function getResourcesByFilter(filters = {}) {
  try {
    const { categories, ageGroups, targets, status } = filters;
    
    console.log(`[DB] 자료 필터링 조회: ${JSON.stringify(filters)}`);
    
    let query = supabase.from("resources").select("*");
    
    // status 필터 (기본값: 'completed')
    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.eq("status", "completed");
    }
    
    // metadata JSONB 필터링 (categories)
    if (categories && categories.length > 0) {
      // JSONB contains 쿼리 (PostgreSQL 문법)
      // metadata->>'categories'가 특정 값을 포함하는지 확인
      categories.forEach((cat) => {
        query = query.ilike("metadata->categories", `%${cat}%`);
      });
    }
    
    // metadata JSONB 필터링 (ageGroups)
    if (ageGroups && ageGroups.length > 0) {
      ageGroups.forEach((age) => {
        query = query.ilike("metadata->ageGroups", `%${age}%`);
      });
    }
    
    // metadata JSONB 필터링 (targets)
    if (targets && targets.length > 0) {
      targets.forEach((target) => {
        query = query.ilike("metadata->targets", `%${target}%`);
      });
    }
    
    // 최신순 정렬
    query = query.order("created_at", { ascending: false });
    
    const { data: result, error } = await query;
    
    if (error) {
      console.error(`  [오류] ${error.message}`);
      return { success: false, error: "FILTER_FAILED", message: error.message };
    }
    
    console.log(`  [✓] ${result.length}개 자료 조회됨`);
    return { success: true, rows: result || [], total: result.length };
    
  } catch (error) {
    console.error(`[DB] 필터링 조회 예외: ${error.message}`);
    return { success: false, error: "DB_ERROR", message: error.message };
  }
}

// ============================================================================
// [헬퍼 함수] getCharactersByResourceId
// ============================================================================
/**
 * 특정 자료의 캐릭터들 조회
 */
async function getCharactersByResourceId(resourceId) {
  return callDatabase("characters", "read", null, { resource_id: resourceId });
}

// ============================================================================
// [헬퍼 함수] getSelectedCharacter
// ============================================================================
/**
 * 특정 자료에서 selected=true인 캐릭터 조회
 */
async function getSelectedCharacter(resourceId) {
  const result = await callDatabase("characters", "read", null, { resource_id: resourceId, selected: true });
  return result.rows?.[0] || null;
}

// ============================================================================
// [헬퍼 함수] getVideoByResourceId
// ============================================================================
/**
 * 특정 자료의 최신 영상 조회
 */
async function getVideoByResourceId(resourceId) {
  const result = await callDatabase("videos", "read", null, { resource_id: resourceId });
  return result.rows?.[0] || null;
}

// ============================================================================
// [헬퍼 함수] checkFK
// ============================================================================
/**
 * FK 참조 무결성 확인 (디버깅용)
 * @param {string} table - 참조하는 테이블
 * @param {string} fkColumn - FK 컬럼명
 * @param {string} refTable - 참조 테이블
 * @param {string} id - 참조값
 */
async function checkFK(table, fkColumn, refTable, id) {
  try {
    const { data: refExists } = await supabase
      .from(refTable)
      .select("id")
      .eq("id", id)
      .limit(1);
    
    if (!refExists || refExists.length === 0) {
      console.error(
        `[FK 실패] ${table}.${fkColumn} = ${id}는 ${refTable}.id에 존재하지 않음`
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`[FK 검사 오류] ${error.message}`);
    return false;
  }
}

// ============================================================================
// [Export]
// ============================================================================

module.exports = {
  callDatabase,
  getResourcesByFilter,
  getCharactersByResourceId,
  getSelectedCharacter,
  getVideoByResourceId,
  checkFK,
  supabase, // 필요시 직접 사용용
};
