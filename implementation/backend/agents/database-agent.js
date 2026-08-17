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
 * 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   ⚠️ api-integration-plan-v4.md 원칙: "서버는 service_role 키 사용, anon key는 미사용"
 *   서버(백엔드)에서는 RLS를 우회해야 하므로 반드시 SERVICE_KEY를 사용한다.
 *   (SUPABASE_ANON_KEY는 프론트엔드 전용 — 여기서 쓰면 RLS 정책에 막혀 쓰기가 실패할 수 있음)
 */

const { createClient } = require("@supabase/supabase-js");

// ============================================================================
// Mock 모드: Supabase 미설정(placeholder) 시 인메모리 DB로 전체 파이프라인 동작 보장
// ============================================================================
// 실제 발표/개발 환경에서 Supabase 키를 아직 안 넣었어도 Step 1~9 전체 흐름이
// 끊기지 않고 시연 가능하도록, 모든 테이블 CRUD를 서버 메모리에서 동일한 인터페이스로 처리한다.
// SUPABASE_URL이 유효한 값으로 설정되면 자동으로 실제 Supabase를 사용한다.
const isMockMode =
  !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("your-project");

if (isMockMode) {
  console.warn(
    "⚠️ SUPABASE_URL이 설정되지 않아 Mock DB(인메모리) 모드로 동작합니다. 서버 재시작 시 데이터가 초기화됩니다."
  );
} else if (!process.env.SUPABASE_SERVICE_KEY) {
  console.warn(
    "⚠️ SUPABASE_SERVICE_KEY가 .env에 없습니다. RLS가 켜져 있으면 쓰기 작업이 실패할 수 있습니다."
  );
}

const supabase = isMockMode
  ? null
  : createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
    );

// ── 인메모리 Mock 스토어 ──────────────────────────────────
const mockStore = {}; // { tableName: [row, ...] }
let mockIdCounter = 1;

function mockTable(table) {
  if (!mockStore[table]) mockStore[table] = [];
  return mockStore[table];
}

// character_library는 config.json의 기본 캐릭터로 미리 시딩 (기본 캐릭터가 항상 존재해야 하므로)
function seedCharacterLibrary() {
  try {
    const { getCharacters } = require("../utils/config-loader");
    return getCharacters().map((c, idx) => ({
      id: `default-${idx}`,
      character_name: c.name,
      role: c.role || "",
      tone_trait: c.toneTrait || "",
      character_profile: [c.role, c.toneTrait].filter(Boolean).join(" · "),
      voice_tone: c.toneTrait || "",
      personality_traits: c.toneTrait ? c.toneTrait.split(/,\s*/) : [],
      visual_description: c.visualIdentity || "",
      gender: c.gender || null,
      character_type: c.type || null,
      reference_image_url: null,
      generation_count: 0,
      source: "default",
      created_at: new Date().toISOString(),
    }));
  } catch (e) {
    return [];
  }
}

if (isMockMode) {
  mockStore.character_library = seedCharacterLibrary();
}

function matchesFilter(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (Array.isArray(value)) return value.includes(row[key]);
    return row[key] === value;
  });
}

async function callDatabaseMock(table, operation, data, filter) {
  const rows = mockTable(table);

  if (operation === "create") {
    const items = Array.isArray(data) ? data : [data];
    const inserted = items.map((item) => ({
      id: `${table}-${mockIdCounter++}`,
      ...item,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    rows.push(...inserted);
    console.log(`[Mock DB] INSERT into ${table}: ${inserted.length}개 row`);
    return { success: true, rows: inserted };
  }

  if (operation === "read") {
    let result = filter && Object.keys(filter).length > 0
      ? rows.filter((r) => matchesFilter(r, filter))
      : [...rows];
    result = result.slice().sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    console.log(`[Mock DB] SELECT from ${table}: ${result.length}개 row`);
    return { success: true, rows: result };
  }

  if (operation === "update") {
    if (!filter || Object.keys(filter).length === 0) {
      throw new Error("UPDATE는 filter(WHERE 조건)이 필수입니다");
    }
    const updated = [];
    for (const row of rows) {
      if (matchesFilter(row, filter)) {
        Object.assign(row, data, { updated_at: new Date().toISOString() });
        updated.push(row);
      }
    }
    console.log(`[Mock DB] UPDATE ${table}: ${updated.length}개 row`);
    return { success: true, rows: updated };
  }

  if (operation === "delete") {
    if (!filter || Object.keys(filter).length === 0) {
      throw new Error("DELETE는 filter(WHERE 조건)이 필수입니다");
    }
    const remaining = [];
    const deleted = [];
    for (const row of rows) {
      if (matchesFilter(row, filter)) deleted.push(row);
      else remaining.push(row);
    }
    mockStore[table] = remaining;
    console.log(`[Mock DB] DELETE from ${table}: ${deleted.length}개 row`);
    return { success: true, rows: deleted };
  }

  return { success: false, error: "INVALID_OPERATION" };
}

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
  if (isMockMode) {
    return callDatabaseMock(table, operation, data, filter);
  }

  try {
    // ========== CREATE (INSERT) ==========
    if (operation === "create") {
      if (!data) {
        throw new Error("INSERT 작업에 data가 필요합니다");
      }
      if (!Array.isArray(data)) {
        data = [data];
      }
      
      console.log(`[DB] INSERT into ${table}: ${data.length}개 row`);

      let { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select();

      // 컬럼 오류 시 해당 필드 제외하고 재시도
      const forbiddenColumns = ["reference_materials", "generation_seed"];
      for (const col of forbiddenColumns) {
        if (error && error.message && error.message.includes(col)) {
          console.warn(`  [⚠️] ${col} 컬럼 없음, 제외 후 재시도...`);
          const cleanedData = data.map(row => {
            const cleaned = { ...row };
            delete cleaned[col];
            return cleaned;
          });
          ({ data: result, error } = await supabase
            .from(table)
            .insert(cleanedData)
            .select());
          break;
        }
      }

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
// 검색 가능한 상태 — "analyzing"(진행 중)/"failed"(실패)는 메타데이터가 없거나
// 신뢰할 수 없으므로 제외한다. 실제 파이프라인은 resources.status를 "completed"로
// 바꾸는 지점이 없고 Step1~2 성공 시 "analyzed"에서 멈추므로, "completed"만 찾던
// 예전 로직은 실사용 조건에서 단 하나의 결과도 반환할 수 없는 버그였다.
const SEARCHABLE_RESOURCE_STATUSES = ["analyzed", "completed"];

/**
 * 자료를 카테고리/나이대/키워드로 필터링해서 조회
 *
 * @param {object} filters - {categories: [...], ageGroups: [...], targets: [...], focus: [...], keyword?: string}
 * @returns {object} {success, rows, total}
 */
async function getResourcesByFilter(filters = {}) {
  try {
    const { categories, ageGroups, targets, focus, keyword } = filters;
    const kw = (keyword || "").trim().toLowerCase();

    console.log(`[DB] 자료 필터링 조회: ${JSON.stringify(filters)}`);

    if (isMockMode) {
      const rows = mockTable("resources").filter((r) => {
        if (!SEARCHABLE_RESOURCE_STATUSES.includes(r.status)) return false;
        const md = r.metadata || {};
        // 필터 그룹 간(카테고리 vs 나이대 vs...)은 AND, 그룹 내 선택값끼리는 OR
        const has = (arr, want) =>
          !want || want.length === 0 || (arr || []).some((v) => want.includes(v));
        const matchesFilters =
          has(md.categories, categories) &&
          has(md.ageGroups, ageGroups) &&
          has(md.targets, targets) &&
          has(md.focus, focus);
        if (!matchesFilters) return false;
        if (!kw) return true;
        return (
          (r.product_name || "").toLowerCase().includes(kw) ||
          (r.product_info || "").toLowerCase().includes(kw)
        );
      });
      // 최신순 정렬 (mock 테이블은 삽입 순서 보장 안 하므로 명시적으로 정렬)
      rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      console.log(`  [Mock] ${rows.length}개 자료 조회됨`);
      return { success: true, rows, total: rows.length };
    }

    let query = supabase.from("resources").select("*");

    query = query.in("status", SEARCHABLE_RESOURCE_STATUSES);

    // metadata JSONB 필터링 — 그룹 내 OR: 선택된 값 중 하나라도 포함하면 매치.
    // (PostgREST의 .filter()를 같은 컬럼에 여러 번 체이닝하면 AND로 묶여서, 카테고리를
    // 2개 이상 선택하면 "둘 다 포함"을 요구하는 반대 의미가 되는 버그가 있었다 —
    // .or()로 "값1 포함 OR 값2 포함 OR ..."을 명시적으로 구성해서 고친다.)
    const orContains = (column, values) => {
      if (!values || values.length === 0) return;
      const clause = values.map((v) => `${column}.cs.${JSON.stringify([v])}`).join(",");
      query = query.or(clause);
    };
    orContains("metadata->categories", categories);
    orContains("metadata->ageGroups", ageGroups);
    orContains("metadata->targets", targets);
    orContains("metadata->focus", focus);

    if (kw) {
      query = query.or(`product_name.ilike.%${kw}%,product_info.ilike.%${kw}%`);
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
