/**
 * backend/routes/generation.js
 * 
 * 기능4: AI 콘텐츠 생성 + Higgsfield 영상 생성
 * 담당: 박주미
 * 의존: backend-agent.md (callAgent, callHiggsfield), database-agent.md (callDatabase)
 * 
 * Step 4~9:
 * Step 4: character-designer-agent (고수아)
 * Step 5: shortform-scenario-writer-agent (고수아)
 * Step 6: naming-generator-agent (고수아)
 * Step 7: product-intro-writer-agent 또는 product-detail-page-writer-agent (박주미)
 * Step 8: compliance-reviewer-agent (박주미)
 * Step 9: Higgsfield 호출 (박주미)
 */

const express = require("express");
const router = express.Router();

const { callAgent, callHiggsfield } = require("../agents/backend-agent");
const { callDatabase } = require("../agents/database-agent");

// ─────────────────────────────────────────────────────
// 호환성: POST /api/generate (resourceId in body)
// ─────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { resourceId, requestType } = req.body;

  if (!resourceId) {
    return res.status(400).json({
      success: false,
      message: "필수 항목 누락: resourceId가 필요합니다",
    });
  }

  // 302 리다이렉트: 새 엔드포인트로 이동
  return res.redirect(302, `/api/generate/${resourceId}/start`);
});

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/start
// AI 콘텐츠 생성 (Step 4~9)
// ─────────────────────────────────────────────────────

/**
 * 입력: { requestType: "intro"|"detail"|"both", videoType?: "캐릭터소개"|"제품스토리"|"일상밥상" } in body
 * URL params: { resourceId }
 * 출력: {
 *   success: true,
 *   contentId,
 *   validationStatus,
 *   validationScore,
 *   higgsfieldId,
 *   generationStatus,
 *   generationProgress,
 *   videoUrl
 * }
 */
router.post("/:resourceId/start", async (req, res) => {
  const { resourceId } = req.params;
  const { requestType, videoType } = req.body;

  // ── 0. 입력 검증 ────────────────────────────────
  if (!resourceId || !requestType) {
    return res.status(400).json({
      success: false,
      message: "필수 항목 누락: resourceId와 requestType이 필요합니다",
    });
  }

  if (!["intro", "detail", "both"].includes(requestType)) {
    return res.status(400).json({
      success: false,
      message: 'requestType은 "intro", "detail", 또는 "both"이어야 합니다',
    });
  }

  try {
    // ── 1. 필요한 정보 조회 ──────────────────────────
    console.log(`[POST /api/generate] resourceId: ${resourceId}, type: ${requestType}`);

    // resources 조회
    const resourceResult = await callDatabase("resources", "read", null, { id: resourceId });
    if (!resourceResult.success || resourceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "해당 자료를 찾을 수 없습니다",
      });
    }

    const resource = resourceResult.rows[0];
    const metadata = resource.metadata || {};

    // 선택된 캐릭터 조회
    const charactersResult = await callDatabase("characters", "read", null, {
      resource_id: resourceId,
      selected: true,
    });

    if (!charactersResult.success || charactersResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "선택된 캐릭터가 없습니다. 먼저 캐릭터를 선택해주세요",
      });
    }

    const selectedCharacter = charactersResult.rows[0];

    // ── 2. Step 4: character-designer-agent 호출 (고수아) ──
    console.log("[Step 4] character-designer-agent 호출...");
    const designerResult = await callAgent(
      "character-designer-agent",
      {
        character: selectedCharacter.character_name,
        productName: resource.product_name,
        productInfo: resource.product_info,
        metadata,
      },
      { resourceId, step: "character-designer" }
    );

    if (!designerResult.success) {
      console.warn("[Step 4] character-designer 실패, 기본 정보로 계속");
    }

    const completeBrief = designerResult.data?.brief || {
      character: selectedCharacter.character_name,
      voice_tone: selectedCharacter.voice_tone || "기본",
    };

    // ── 3. Step 5: shortform-scenario-writer-agent 호출 (고수아) ──
    console.log("[Step 5] shortform-scenario-writer-agent 호출...");
    const scenarioResult = await callAgent(
      "shortform-scenario-writer-agent",
      {
        brief: completeBrief,
        final_characters: [selectedCharacter],
        scenario_context: requestType,
      },
      { resourceId, step: "shortform-scenario-writer" }
    );

    if (!scenarioResult.success) {
      return res.status(502).json({
        success: false,
        message: "시나리오 생성에 실패했습니다",
        resourceId,
      });
    }

    const scenario = scenarioResult.data.scenario;
    const higgsfieldSpecs = scenarioResult.data.higgsfield_specifications;

    // 시나리오가 정확히 120초인지 확인
    if (scenarioResult.data.timing_verification?.total_duration !== 120) {
      console.warn(
        `⚠️ 시나리오가 ${scenarioResult.data.timing_verification?.total_duration}초입니다`
      );
    }

    // scenarios 테이블에 저장
    // ⚠️ schema.sql 컬럼명과 정확히 일치시킴:
    //    scenario_title, story_content, scenario_json,
    //    total_duration_seconds, dialogue_seconds, narration_seconds, timing_valid
    const scenarioDBResult = await callDatabase("scenarios", "create", {
      resource_id: resourceId,
      character_id: selectedCharacter.id,
      scenario_title: scenario.title,
      story_content: scenario.story_content || scenario.content || "",
      scenario_json: scenario.acts || scenario,
      total_duration_seconds: scenarioResult.data.timing_verification?.total_duration || 120,
      dialogue_seconds: scenarioResult.data.timing_verification?.dialogue_seconds || null,
      narration_seconds: scenarioResult.data.timing_verification?.narration_seconds || null,
      timing_valid: scenarioResult.data.timing_verification?.total_duration === 120,
    });

    if (!scenarioDBResult.success) {
      console.error("[Step 5] scenarios 저장 실패");
      return res.status(500).json({
        success: false,
        message: "시나리오 저장에 실패했습니다",
      });
    }

    // ── 4. Step 6: naming-generator-agent 호출 (고수아) ──
    console.log("[Step 6] naming-generator-agent 호출...");
    const namingResult = await callAgent(
      "naming-generator-agent",
      {
        scenario_id: scenarioDBResult.rows?.[0]?.id || null,
        primary_message: metadata.focus?.join(", ") || "제품의 가치",
        tone_analysis: metadata.focus || ["기본"],
        business_area: metadata.categories?.[0] || "일반",
        has_new_character: false,
      },
      { resourceId, step: "naming-generator" }
    );

    if (!namingResult.success) {
      console.warn("[Step 6] naming-generator 실패, 기본 이름으로 계속");
    }

    // 1순위 이름 선택
    const productNameOptions = namingResult.data?.product_name_options || [];
    const contentNameOptions = namingResult.data?.content_name_options || [];

    const selectedProductName = productNameOptions[0]?.name || resource.product_name;
    const selectedContentName = contentNameOptions[0]?.name || scenario.title;

    // naming 테이블에 저장
    const namingDBResult = await callDatabase("naming", "create", {
      resource_id: resourceId,
      product_name_1: productNameOptions[0]?.name || "",
      product_name_1_score: productNameOptions[0]?.score || 0,
      product_name_1_meaning: productNameOptions[0]?.meaning || "",
      product_name_2: productNameOptions[1]?.name || "",
      product_name_2_score: productNameOptions[1]?.score || 0,
      product_name_2_meaning: productNameOptions[1]?.meaning || "",
      product_name_3: productNameOptions[2]?.name || "",
      product_name_3_score: productNameOptions[2]?.score || 0,
      product_name_3_meaning: productNameOptions[2]?.meaning || "",
      content_name_1: contentNameOptions[0]?.name || "",
      content_name_1_score: contentNameOptions[0]?.score || 0,
      content_name_1_meaning: contentNameOptions[0]?.meaning || "",
      content_name_2: contentNameOptions[1]?.name || "",
      content_name_2_score: contentNameOptions[1]?.score || 0,
      content_name_2_meaning: contentNameOptions[1]?.meaning || "",
      content_name_3: contentNameOptions[2]?.name || "",
      content_name_3_score: contentNameOptions[2]?.score || 0,
      content_name_3_meaning: contentNameOptions[2]?.meaning || "",
    });

    // ── 5. Step 7: product-intro-writer-agent 또는 product-detail-page-writer-agent ──
    let agentName;
    if (requestType === "intro") {
      agentName = "product-intro-writer-agent";
    } else if (requestType === "detail") {
      agentName = "product-detail-page-writer-agent";
    } else {
      // both: 일단 intro로 진행 (또는 둘 다 할 수도 있음)
      agentName = "product-intro-writer-agent";
    }

    console.log(`[Step 7] ${agentName} 호출... (videoType: ${videoType || "제품스토리"})`);
    const contentResult = await callAgent(
      agentName,
      {
        category: metadata.categories?.[0] || "일반",
        character: selectedCharacter.character_name,
        productName: selectedProductName,
        productInfo: resource.product_info,
        keywords: resource.keywords || [],
        scenario,
        videoType: videoType || "제품스토리",
      },
      { resourceId, step: agentName }
    );

    if (!contentResult.success) {
      return res.status(502).json({
        success: false,
        message: "콘텐츠 생성에 실패했습니다",
        resourceId,
      });
    }

    const generatedContent = contentResult.data.content;

    // ── 6. Step 8: compliance-reviewer-agent (검증) ──
    console.log("[Step 8] compliance-reviewer-agent 호출...");
    const complianceResult = await callAgent(
      "compliance-reviewer-agent",
      {
        content: generatedContent,
        category: metadata.categories?.[0] || "일반",
        productName: selectedProductName,
      },
      { resourceId, step: "compliance-reviewer" }
    );

    if (!complianceResult.success) {
      return res.status(502).json({
        success: false,
        message: "컴플라이언스 검증에 실패했습니다",
        resourceId,
      });
    }

    const validationStatus = complianceResult.data.validation?.status || "UNKNOWN";
    const validationScore = complianceResult.data.validation?.score || 0;

    console.log(`[Step 8] 검증 결과: ${validationStatus} (점수: ${validationScore})`);

    // REJECTED는 경고이지만 계속 진행 (선택사항)
    if (validationStatus === "REJECTED") {
      console.warn("⚠️ 컴플라이언스 검증 REJECTED - 그대로 진행");
    }

    // contents 테이블에 저장
    const contentDBResult = await callDatabase("contents", "create", {
      resource_id: resourceId,
      scenario_id: scenarioDBResult.rows?.[0]?.id || null,
      naming_id: namingDBResult.rows?.[0]?.id || null,
      content_type: requestType === "intro" ? "intro" : "detail",
      generated_content: generatedContent,
      validation_status: validationStatus,
      validation_score: validationScore,
    });

    if (!contentDBResult.success) {
      console.error("[Step 7/8] contents 저장 실패");
    }

    const contentId = contentDBResult.rows?.[0]?.id || null;
    const scenarioId = scenarioDBResult.rows?.[0]?.id || null;
    const namingId = namingDBResult.rows?.[0]?.id || null;

    // ── 7. Step 9: Higgsfield 호출 ──
    console.log("[Step 9] Higgsfield 영상 생성 요청...");
    let higgsfieldId = null;
    let videoUrl = null;
    let generationStatus = "pending";
    let generationProgress = 0;
    let videosRowId = null;
    let higgsfieldError = null;

    const higgsfieldResult = await callHiggsfield(
      {
        character: selectedCharacter.character_name,
        generatedContent,
        voiceTone: selectedCharacter.voice_tone || "기본",
        duration: 120,
      },
      resourceId,
      contentId
    );

    if (higgsfieldResult.success) {
      higgsfieldId = higgsfieldResult.data.higgsfield_id;
      videoUrl = higgsfieldResult.data.video_url;
      generationStatus = higgsfieldResult.data.generation_status;
      generationProgress = higgsfieldResult.data.generation_progress;
      videosRowId = higgsfieldResult.data.videos_row_id;
      console.log(`[Step 9] Higgsfield ID: ${higgsfieldId}, 진행률: ${generationProgress}%`);
    } else {
      higgsfieldError = higgsfieldResult.error || "Unknown error";
      console.warn(`[Step 9] Higgsfield 호출 실패: ${higgsfieldError}`);
    }

    // ── 7-1. 최종 상태 업데이트 ──
    // ✅ CLI의 --wait 플래그로 완료까지 기다렸으므로 pollHiggsfield 불필요
    if (higgsfieldResult.success && videosRowId) {
      await callDatabase("videos", "update", {
        id: videosRowId,
        generation_status: "completed",
        generation_progress: 100,
        video_url: higgsfieldResult.data.video_url,
      }).catch((e) => console.error("[영상 상태 업데이트 실패]", e));
    }

    // ── 8. 최종 응답 ──────────────────────────────
    console.log(`✅ POST /api/generate 완료`);

    return res.status(201).json({
      success: true,
      contentId,
      validationStatus,
      validationScore,
      videoUrl: higgsfieldResult.success ? higgsfieldResult.data.video_url : null,
      videoStatus: higgsfieldResult.success ? "completed" : "failed",
      higgsfieldError: higgsfieldError,
    });
  } catch (error) {
    console.error("[POST /api/generate] 예외 발생:", error);

    return res.status(500).json({
      success: false,
      message: "서버 내부 오류가 발생했습니다",
      resourceId: resourceId || null,
    });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/generate/:resourceId/status
// 생성 진행 상태 조회 (프론트엔드 폴링용)
// ─────────────────────────────────────────────────────
router.get("/:resourceId/status", async (req, res) => {
  const { resourceId } = req.params;

  try {
    // generation_logs에서 최근 상태 조회
    const logsResult = await callDatabase("generation_logs", "read", null, {
      resource_id: resourceId,
    });

    if (!logsResult.success || !logsResult.rows || logsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "생성 이력을 찾을 수 없습니다",
        resourceId,
      });
    }

    const logs = logsResult.rows;
    const currentStep = logs[0];
    const successCount = logs.filter((l) => l.status === "success").length;
    const totalSteps = 10; // Step 1~9 + Higgsfield

    return res.json({
      success: true,
      resourceId,
      currentStep: currentStep.step,
      currentStatus: currentStep.status,
      progress: Math.round((successCount / totalSteps) * 100),
      completedSteps: successCount,
      totalSteps,
      lastUpdate: currentStep.created_at,
    });
  } catch (error) {
    console.error("[GET /api/generate/:resourceId/status] 예외:", error);
    return res.status(500).json({
      success: false,
      message: "상태 조회 중 오류가 발생했습니다",
      resourceId,
    });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/generate/:resourceId/result
// 생성 완료 결과 조회
// ─────────────────────────────────────────────────────
router.get("/:resourceId/result", async (req, res) => {
  const { resourceId } = req.params;

  try {
    // 1. Contents 조회
    const contents = await callDatabase("contents", "read", {
      filter: { resource_id: resourceId },
    });

    // 2. Videos 조회
    const videos = await callDatabase("videos", "read", {
      filter: { resource_id: resourceId },
    });

    // 3. Scenarios 조회
    const scenarios = await callDatabase("scenarios", "read", {
      filter: { resource_id: resourceId },
    });

    // 4. Characters 조회
    const characters = await callDatabase("characters", "read", {
      filter: { resource_id: resourceId },
    });

    if (!contents || contents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "생성 결과를 찾을 수 없습니다",
        resourceId,
      });
    }

    return res.json({
      success: true,
      resourceId,
      contents: contents || [],
      videos: videos || [],
      scenarios: scenarios || [],
      characters: characters || [],
      generatedAt: contents[0]?.created_at || null,
    });
  } catch (error) {
    console.error("[GET /api/generate/:resourceId/result] 예외:", error);
    return res.status(500).json({
      success: false,
      message: "결과 조회 중 오류가 발생했습니다",
      resourceId,
    });
  }
});

// ─────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────

module.exports = router;
