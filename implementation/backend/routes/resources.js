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
  const { productName, productInfo, keywords, trendKeywords, customStyle, referenceMaterials } = req.body;

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

  // 트렌드 키워드/커스텀 스타일 (선택 입력) — 별도 컬럼 없이 metadata JSONB에 함께 저장
  const trendKeywordsArray = Array.isArray(trendKeywords)
    ? trendKeywords
    : trendKeywords
    ? String(trendKeywords).split(",").map((k) => k.trim()).filter(Boolean)
    : [];
  const customStyleText = customStyle ? String(customStyle).trim() : null;

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
      {
        productName,
        productInfo,
        keywords: keywordsArray,
        trendKeywords: trendKeywordsArray,
        customStyle: customStyleText,
      },
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

    // 트렌드 키워드/커스텀 스타일은 AI 메타데이터에 그대로 병합해 저장 (스키마 변경 없이 JSONB 확장)
    const metadata = {
      ...step1.data.metadata,
      trendKeywords: trendKeywordsArray,
      customStyle: customStyleText,
    };

    // ── 3. resources 메타데이터 업데이트 ─────────────
    await callDatabase(
      "resources",
      "update",
      { metadata, status: "analyzed" },
      { id: resourceId }
    );

    // ── 4. Step 2: 캐릭터 추천 ──
    //
    // ⭐ 재현성 핵심: "AI가 매번 완전히 새로운 캐릭터 3명을 창작"하지 않고,
    // character_library(기본 캐릭터 풀)에서 이 제품에 가장 잘 맞는 3명을 "선별"한다.
    // 이렇게 해야 여러 제품을 거쳐도 같은 캐릭터(얼굴/톤/레퍼런스 이미지)가 재사용되어
    // 브랜드 전체의 캐릭터 일관성이 유지된다. 라이브러리에 없는 완전히 새로운 캐릭터를
    // 원할 때는 CharacterCreator의 "+ 새 캐릭터 만들기"에서 별도로 생성한다.
    const libraryResult = await callDatabase("character_library", "read", null, {});
    const library = libraryResult.success ? libraryResult.rows : [];

    let recommendedLibraryChars;

    if (library.length === 0) {
      // 라이브러리가 비어있는 극단적인 경우에만 폴백으로 새 캐릭터 생성
      const step2 = await callAgent(
        "character-generator-agent",
        { productName, productInfo, keywords: keywordsArray, metadata },
        { resourceId, step: "character-generator" }
      );
      if (!step2.success) {
        return res.status(207).json({
          success: true,
          partial: true,
          message: "제품 분석은 완료됐지만 캐릭터 추천에는 실패했습니다. 잠시 후 다시 시도해주세요.",
          resourceId,
          metadata,
          characters: [],
          detail: step2,
        });
      }
      recommendedLibraryChars = step2.data.characters.map((c) => ({
        character_name: c.name,
        character_profile: c.description,
        reason: c.reason,
        score: c.score,
      }));
    } else {
      const step2 = await callAgent(
        "character-recommender-agent",
        {
          productName,
          productInfo,
          keywords: keywordsArray,
          metadata,
          libraryCharacters: library.map((c) => ({
            id: c.id,
            name: c.character_name,
            role: c.role,
            tone_trait: c.tone_trait,
          })),
        },
        { resourceId, step: "character-recommender" }
      );

      const recommendations = step2.success ? step2.data.recommendations : null;

      if (!recommendations || recommendations.length === 0) {
        // 추천 실패 시 라이브러리 앞에서 3개를 그대로 사용 (완전 실패시키지 않음)
        recommendedLibraryChars = library.slice(0, 3).map((c, idx) => ({
          ...c,
          reason: "기본 추천 (AI 추천 실패 폴백)",
          score: 80 - idx * 5,
        }));
      } else {
        recommendedLibraryChars = recommendations
          .map((rec) => {
            const lib = library.find((c) => c.id === rec.id || c.character_name === rec.name);
            if (!lib) return null;
            return { ...lib, reason: rec.reason, score: rec.score };
          })
          .filter(Boolean);
      }
    }

    // ── 5. 추천된 라이브러리 캐릭터들을 이 자료의 characters로 복사 저장 ──
    // 프로필/레퍼런스 이미지를 그대로 복사 -> 재사용시 AI 재호출 없이 바로 일관된 결과
    const characterRows = recommendedLibraryChars.map((c, idx) => ({
      resource_id: resourceId,
      character_name: c.character_name,
      is_base_character: !!c.id, // 라이브러리 출신이면 true
      character_profile: c.character_profile || c.character_name,
      voice_tone: c.voice_tone || null,
      personality_traits: c.personality_traits || null,
      visual_description: c.visual_description || null,
      reference_image_url: c.reference_image_url || null,
      generation_seed: c.generation_seed || null, // Higgsfield job id — --start-image 재사용용
      generation_count: c.generation_count || 0,
      library_character_id: c.id || null,
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
        characters: recommendedLibraryChars, // DB 저장은 실패했지만 분석 결과는 프론트에 보여줄 수 있게 반환
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

// ─────────────────────────────────────────────
// GET /api/resources/:id/comments — 코멘트 스레드 조회 (오래된순)
// POST /api/resources/:id/comments — 코멘트 작성
// ─────────────────────────────────────────────
router.get("/:id/comments", async (req, res) => {
  const { id } = req.params;

  const result = await callDatabase("comments", "read", null, { resource_id: id });
  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: "코멘트 조회에 실패했습니다.",
      detail: result,
    });
  }

  // callDatabase는 최신순(desc)으로 반환하므로 스레드는 오래된순으로 뒤집어서 보여준다
  return res.json({ success: true, comments: [...result.rows].reverse() });
});

router.post("/:id/comments", async (req, res) => {
  const { id } = req.params;
  const { author, message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({
      success: false,
      message: "코멘트 내용을 입력해주세요.",
    });
  }

  const result = await callDatabase("comments", "create", {
    resource_id: id,
    author: author?.trim() || "담당자",
    message: message.trim(),
  });

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: "코멘트 저장에 실패했습니다. comments 테이블이 아직 없다면 docs/migration-comments.sql을 먼저 적용해주세요.",
      detail: result,
    });
  }

  return res.status(201).json({ success: true, comment: result.rows[0] });
});

module.exports = router;
