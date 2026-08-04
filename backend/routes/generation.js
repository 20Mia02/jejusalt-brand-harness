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

const { callAgent, callHiggsfield, pollHiggsfield } = require("../agents/backend-agent");
const { callDatabase } = require("../agents/database-agent");

// ─────────────────────────────────────────────────────
// POST /api/generate
// AI 콘텐츠 생성 (Step 4~9)
// ─────────────────────────────────────────────────────

/**
 * 입력: { resourceId, requestType: "intro"|"detail"|"both" }
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
router.post("/", async (req, res) => {
  const { resourceId, requestType } = req.body;

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
        character: selectedCharacter.name,
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
      character: selectedCharacter.name,
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
    const scenarioDBResult = await callDatabase("scenarios", "create", {
      resource_id: resourceId,
      character_id: selectedCharacter.id,
      title: scenario.title,
      total_duration: 120,
      acts: scenario.acts, // JSONB로 저장
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
        scenario_id: scenario.id,
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
      product_names: productNameOptions.map(p => p.name),
      content_names: contentNameOptions.map(c => c.name),
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

    console.log(`[Step 7] ${agentName} 호출...`);
    const contentResult = await callAgent(
      agentName,
      {
        category: metadata.categories?.[0] || "일반",
        character: selectedCharacter.name,
        productName: selectedProductName,
        productInfo: resource.product_info,
        keywords: resource.keywords || [],
        scenario,
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
      content_type: requestType === "intro" ? "intro" : "detail",
      generated_content: generatedContent,
      validation_status: validationStatus,
      validation_score: validationScore,
    });

    if (!contentDBResult.success) {
      console.error("[Step 7/8] contents 저장 실패");
    }

    const contentId = contentDBResult.rows?.[0]?.id || null;

    // ── 7. Step 9: Higgsfield 호출 ──
    console.log("[Step 9] Higgsfield 영상 생성 요청...");
    const higgsfieldResult = await callHiggsfield(
      {
        character: selectedCharacter.name,
        generatedContent,
        voiceTone: selectedCharacter.voice_tone || "기본",
        duration: 120,
      },
      resourceId
    );

    if (!higgsfieldResult.success) {
      return res.status(502).json({
        success: false,
        message: "Higgsfield 영상 생성 요청에 실패했습니다",
        resourceId,
        contentId,
      });
    }

    const higgsfieldId = higgsfieldResult.data.higgsfield_id;
    const videoUrl = higgsfieldResult.data.video_url;
    const generationStatus = higgsfieldResult.data.generation_status;
    const generationProgress = higgsfieldResult.data.generation_progress;

    console.log(`[Step 9] Higgsfield ID: ${higgsfieldId}, 진행률: ${generationProgress}%`);

    // ── 8. 최종 응답 ──────────────────────────────
    console.log(`✅ POST /api/generate 완료`);

    return res.status(201).json({
      success: true,
      contentId,
      validationStatus,
      validationScore,
      higgsfieldId,
      generationStatus,
      generationProgress,
      videoUrl: videoUrl || null,
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
// Export
// ─────────────────────────────────────────────────────

module.exports = router;
