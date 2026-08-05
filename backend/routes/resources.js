/**
 * routes/resources.js
 *
 * 기능1: 자료 업로드 & 분석
 *   POST   /api/resources           - 자료 업로드 + 분석 (Step 1~2)
 *   GET    /api/resources           - 전체 자료 목록 조회
 *   GET    /api/resources/filter    - 동적 필터 조회 (FilterUI.jsx가 호출)
 *   GET    /api/resources/:id       - 단일 자료 상세 조회
 *
 * 담당: 박주미
 * 의존: backend-agent.md (callAgent), database-agent.md (callDatabase)
 *
 * 파이프라인 (orchestrator.md Step 1~2와 동일):
 *   Step 1: resource-analyzer-agent   → SKILL_resource-analyzer
 *   Step 2: character-generator-agent → SKILL_character-generator
 *
 * ⚠️ Step 3(character-designer) 이후부터는 routes/generation.js에서 처리한다.
 *    이 파일은 "업로드 시점에 빠르게 분석 결과 + 캐릭터 추천까지"만 담당한다.
 */

const express = require("express");
const router = express.Router();

const { callAgent } = require("../agents/backend-agent");     // backend-agent.md의 callAgent()
const { callDatabase } = require("../agents/database-agent"); // database-agent.md의 callDatabase()

// ─────────────────────────────────────────────
// POST /api/resources — 자료 업로드 + 분석 (Step 1~2)
// ─────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { productName, productInfo, keywords, referenceMaterials } = req.body;

  // ── 0. 입력 유효성 검증 ──────────────────────────
  if (!productName || !productInfo) {
    return res.status(400).json({
      success: false,
      message: "필수 항목 누락: productName과 productInfo가 필요합니다",
    });
  }
  if (productName.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: "제품명이 너무 짧습니다 (최소 3자)",
    });
  }
  if (productInfo.trim().length < 30) {
    return res.status(400).json({
      success: false,
      message: "제품 정보가 너무 짧습니다. 더 상세히 입력해주세요. (최소 30자)",
    });
  }

  // 키워드 문자열/배열 모두 허용 (resource-analyzer-agent.md 규칙과 동일)
  const keywordsArray = keywords
    ? Array.isArray(keywords)
      ? keywords
      : String(keywords)
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
    : [];

  // 추가 참고자료 (기업자료_요약.md 등) — [{filename, content}] 형태로 업로드됨
  const referenceMaterialsArray = Array.isArray(referenceMaterials)
    ? referenceMaterials.filter((f) => f && f.content && f.content.trim().length > 0)
    : [];

  let resourceId;

  try {
    // ── 1. resources 생성 (database-agent) ──────────
    const created = await callDatabase("resources", "create", {
      product_name: productName,
      product_info: productInfo,
      keywords: keywordsArray,
      reference_materials: referenceMaterialsArray,
      status: "analyzing",
    });

    if (!created.success) {
      return res.status(500).json({
        success: false,
        message: "자료 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
        detail: created,
      });
    }
    resourceId = created.rows[0].id;

    // ── 2. Step 1: resource-analyzer-agent 호출 (backend-agent) ──
    const step1 = await callAgent(
      "resource-analyzer-agent",
      { productName, productInfo, keywords: keywordsArray },
      { resourceId, step: "resource-analyzer" }
    );

    if (!step1.success) {
      // 분석 실패 → resources를 failed로 표시하고 종료
      await callDatabase(
        "resources",
        "update",
        { status: "failed" },
        { id: resourceId }
      );
      return res.status(502).json({
        success: false,
        message:
          "제품 정보 분석에 실패했습니다. 더 자세한 정보를 입력한 뒤 다시 시도해주세요.",
        resourceId,
        detail: step1,
      });
    }

    const metadata = step1.data.metadata;

    // ── 3. resources 메타데이터 업데이트 ─────────────
    await callDatabase(
      "resources",
      "update",
      { metadata, status: "analyzed" },
      { id: resourceId }
    );

    // ── 4. Step 2: character-generator-agent 호출 (backend-agent) ──
    // metadata를 그대로 전달 (character-generator-agent.md 입력 스펙과 동일)
    const step2 = await callAgent(
      "character-generator-agent",
      { productName, productInfo, keywords: keywordsArray, metadata },
      { resourceId, step: "character-generator" }
    );

    if (!step2.success) {
      // 캐릭터 추천 실패해도 분석 결과는 이미 있으니 완전 실패로 처리하지 않고,
      // status는 "analyzed"로 유지 (캐릭터는 나중에 AdminMode에서 재시도 가능)
      return res.status(207).json({
        success: true,
        partial: true,
        message:
          "제품 분석은 완료됐지만 캐릭터 추천에는 실패했습니다. 잠시 후 다시 시도해주세요.",
        resourceId,
        metadata,
        characters: [],
        detail: step2,
      });
    }

    const characters = step2.data.characters; // [{name, description, reason, score}, ...]

    // ── 5. characters 3개 저장 (1순위를 selected: true로) ──
    const characterRows = characters.map((c, idx) => ({
      resource_id: resourceId,
      character_name: c.name,
      character_profile: c.description,
      reason: c.reason,
      score: c.score,
      selected: idx === 0,
    }));

    const savedCharacters = await callDatabase(
      "characters",
      "create",
      characterRows
    );

    if (!savedCharacters.success) {
      return res.status(500).json({
        success: false,
        message: "캐릭터 저장에 실패했습니다.",
        resourceId,
        metadata,
        characters, // DB 저장은 실패했지만 분석 결과는 프론트에 보여줄 수 있게 반환
        detail: savedCharacters,
      });
    }

    // ── 6. 최종 응답 ─────────────────────────────────
    return res.status(201).json({
      success: true,
      resourceId,
      metadata,
      characters: savedCharacters.rows, // DB에 저장된 형태로 반환 (id 포함)
      referenceMaterials: referenceMaterialsArray, // 업로드된 참고자료 (있으면 파일명만 프론트에서 확인용으로 사용)
    });
  } catch (error) {
    // 예상치 못한 에러 → resources를 failed로 표시 (resourceId가 있을 때만)
    if (resourceId) {
      await callDatabase(
        "resources",
        "update",
        { status: "failed" },
        { id: resourceId }
      ).catch(() => {}); // 로깅 실패는 무시 (2차 에러로 응답 지연시키지 않음)
    }

    console.error("[routes/resources.js] POST / 처리 중 예외:", error);
    return res.status(500).json({
      success: false,
      message: "서버 내부 오류가 발생했습니다.",
      resourceId: resourceId || null,
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/resources — 전체 자료 목록 (최신순)
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  const result = await callDatabase("resources", "read", null, {
    // 필터 없이 전체 조회. 정렬은 database-agent 내부에서 created_at desc 처리
  });

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: "자료 목록 조회에 실패했습니다.",
      detail: result,
    });
  }

  return res.json({ success: true, resources: result.rows });
});

// ─────────────────────────────────────────────
// GET /api/resources/filter — 동적 필터 조회 (FilterUI.jsx)
//
// 예: GET /api/resources/filter?categories=식품&ageGroups=40~60대&targets=가족밥상
//
// database-agent.md의 getResourcesByFilter()를 그대로 사용한다.
// metadata는 JSONB이므로 .contains() 연산자로 필터링한다.
// ─────────────────────────────────────────────
router.get("/filter", async (req, res) => {
  const { categories, ageGroups, targets, focus, videoTypes } = req.query;

  const toArray = (v) => (v ? (Array.isArray(v) ? v : [v]) : []);

  const filters = {
    categories: toArray(categories),
    ageGroups: toArray(ageGroups),
    targets: toArray(targets),
    focus: toArray(focus),
    videoTypes: toArray(videoTypes),
  };

  const { getResourcesByFilter } = require("../agents/database-agent");
  const result = await getResourcesByFilter(filters);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: "필터 조회에 실패했습니다.",
      detail: result,
    });
  }

  return res.json({ success: true, resources: result.rows });
});

// ─────────────────────────────────────────────
// GET /api/resources/:id — 단일 자료 상세 (metadata + characters 포함)
// ─────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const resourceResult = await callDatabase("resources", "read", null, { id });
  if (!resourceResult.success || resourceResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "해당 자료를 찾을 수 없습니다.",
    });
  }

  const charactersResult = await callDatabase("characters", "read", null, {
    resource_id: id,
  });

  return res.json({
    success: true,
    resource: resourceResult.rows[0],
    characters: charactersResult.success ? charactersResult.rows : [],
  });
});

module.exports = router;
