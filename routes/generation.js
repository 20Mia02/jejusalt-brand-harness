/**
 * routes/generation.js
 *
 * 기능4: AI 생성 (orchestrator.md Step 3~8을 실제로 실행하는 파일)
 *
 *   POST /api/generation/:resourceId/start     - 생성 파이프라인 시작 (비동기, 즉시 응답)
 *   GET  /api/generation/:resourceId/status    - 진행 상태 조회 (GenerationUI.jsx가 5초마다 폴링)
 *   GET  /api/generation/:resourceId/result     - 완료된 최종 결과 조회
 *
 * 담당: 박주미(백엔드) / 고수아(GenerationUI.jsx가 이 API를 소비)
 * 의존: backend-agent.md (callAgent, requestHiggsfieldVideo, pollHiggsfieldStatus)
 *       database-agent.md (callDatabase)
 *       frontend-agent.md (이 API의 status 응답을 5초 폴링해서 화면 갱신)
 *
 * ⚠️ HIGGSFIELD 크레딧 주의 ⚠️
 * Higgsfield는 유료 API이며 크레딧이 한정되어 있습니다!
 * - POST /api/generation/:resourceId/start 은 실제 영상 생성 요청입니다.
 * - 꼭 필요한 경우에만 호출하세요.
 * - 디버깅 시에는 pollHiggsfieldStatus() 폴링만 테스트하거나,
 *   jobId를 mock해서 테스트하세요.
 *
 * 파이프라인 (orchestrator.md와 동일 순서, Step 1~2는 routes/resources.js에서 이미 완료됨):
 *   Step 3: character-designer-agent           (고수아, 실패해도 진행)
 *   Step 4: shortform-scenario-writer-agent     (고수아, 120초 검증 + 1회 자동 재생성)
 *   Step 5: naming-generator-agent              (고수아, 1순위 자동 채택)
 *   Step 6: product-intro-writer-agent
 *           / product-detail-page-writer-agent  (박주미, requestType에 따라 분기)
 *   Step 7: compliance-reviewer-agent            (박주미, REJECTED면 즉시 중단)
 *   Step 8: Higgsfield 영상 생성 (요청 + 폴링)   (공동)
 *
 * ⚠️ 이 파이프라인은 전체가 수십 초~수 분 걸릴 수 있으므로,
 *    POST는 즉시 202를 반환하고 백그라운드에서 실행한다.
 *    실제 진행 상황은 generation_logs 테이블을 근거로 계산해서 GET .../status로 보여준다.
 */

const express = require("express");
const router = express.Router();

const {
  callAgent,
  requestHiggsfieldVideo,
  pollHiggsfieldStatus,
} = require("../agents/backend-agent");
const { callDatabase } = require("../agents/database-agent");

// generation_logs 기준으로 진행률(%)을 계산할 때 사용하는 전체 단계 목록
// (Step 1~2는 routes/resources.js에서 이미 끝났으므로 여기서는 Step 3~8만 카운트)
const PIPELINE_STEPS = [
  "character-designer",
  "shortform-scenario-writer",
  "naming-generator",
  "content-writer", // product-intro-writer-agent 또는 product-detail-page-writer-agent
  "compliance-reviewer",
  "higgsfield-request",
  "higgsfield-video", // 폴링 완료 시점
];

// ─────────────────────────────────────────────
// POST /api/generation/:resourceId/start — 생성 파이프라인 시작
// ─────────────────────────────────────────────
router.post("/:resourceId/start", async (req, res) => {
  const { resourceId } = req.params;
  const { requestType = "intro", contentType = "제품스토리" } = req.body;

  const validRequestTypes = ["intro", "detail", "both"];
  if (!validRequestTypes.includes(requestType)) {
    return res.status(400).json({
      success: false,
      message: "requestType은 intro / detail / both 중 하나여야 합니다.",
    });
  }

  // ── 자료 + 선택된 캐릭터 조회 ──────────────────────
  const resourceResult = await callDatabase("resources", "read", null, {
    id: resourceId,
  });
  if (!resourceResult.success || resourceResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "해당 자료를 찾을 수 없습니다. 먼저 자료를 업로드해주세요.",
    });
  }
  const resource = resourceResult.rows[0];

  if (!resource.metadata) {
    return res.status(400).json({
      success: false,
      message: "이 자료는 아직 분석(Step 1)이 완료되지 않았습니다.",
    });
  }

  const charactersResult = await callDatabase("characters", "read", null, {
    resource_id: resourceId,
    selected: true,
  });
  if (!charactersResult.success || charactersResult.rows.length === 0) {
    return res.status(400).json({
      success: false,
      message: "선택된 캐릭터가 없습니다. 먼저 캐릭터를 선택해주세요.",
    });
  }
  const selectedCharacter = charactersResult.rows[0];

  // 이미 생성 중이면 중복 시작 방지
  if (resource.status === "generating") {
    return res.status(409).json({
      success: false,
      message: "이미 생성이 진행 중입니다. 완료될 때까지 기다려주세요.",
    });
  }

  // ── 상태를 generating으로 변경 후 즉시 응답 ──────────
  await callDatabase(
    "resources",
    "update",
    { status: "generating" },
    { id: resourceId }
  );

  res.status(202).json({
    success: true,
    message: "생성을 시작했습니다. /status 엔드포인트로 진행 상황을 확인하세요.",
    resourceId,
  });

  // ── 백그라운드 파이프라인 실행 (응답 이후 계속 진행) ──
  runGenerationPipeline({
    resourceId,
    resource,
    selectedCharacter,
    requestType,
    contentType,
  }).catch((error) => {
    console.error(`[generation:${resourceId}] 파이프라인 예외:`, error);
  });
});

// ─────────────────────────────────────────────
// 백그라운드 파이프라인 (Step 3~8)
// ─────────────────────────────────────────────
async function runGenerationPipeline({
  resourceId,
  resource,
  selectedCharacter,
  requestType,
  contentType,
}) {
  const { metadata, product_name: productName, product_info: productInfo } =
    resource;

  try {
    // ── Step 3: character-designer-agent (선택사항, 실패해도 진행) ──
    const step3 = await callAgent(
      "character-designer-agent",
      { character: selectedCharacter.name, productName, metadata },
      { resourceId, step: "character-designer" }
    );
    const characterDetail = step3.success ? step3.data.detail : null;

    // ── Step 4: shortform-scenario-writer-agent (120초 검증 + 1회 자동 재생성) ──
    const scenarioPayload = {
      character: selectedCharacter.name,
      productName,
      productInfo,
      metadata,
      contentType,
    };

    let step4 = await callAgent(
      "shortform-scenario-writer-agent",
      scenarioPayload,
      { resourceId, step: "shortform-scenario-writer" }
    );

    if (
      step4.success &&
      Math.abs(step4.data.scenario.total_duration - 120) > 5
    ) {
      step4 = await callAgent("shortform-scenario-writer-agent", scenarioPayload, {
        resourceId,
        step: "shortform-scenario-writer-retry",
      });
    }

    if (!step4.success) {
      return await markFailed(resourceId, "shortform-scenario-writer", step4.message);
    }
    const scenario = step4.data.scenario;

    await callDatabase("scenarios", "create", {
      resource_id: resourceId,
      character_id: selectedCharacter.id,
      title: scenario.title,
      total_duration: scenario.total_duration,
      acts: scenario.acts,
    });

    // ── Step 5: naming-generator-agent (1순위 자동 채택) ──
    const step5 = await callAgent(
      "naming-generator-agent",
      { scenario, productName, metadata },
      { resourceId, step: "naming-generator" }
    );

    let productNameGenerated = productName;
    let contentNameGenerated = "제품 스토리";

    if (step5.success) {
      await callDatabase("naming", "create", {
        resource_id: resourceId,
        product_names: step5.data.product_names.map((p) => p.name),
        content_names: step5.data.content_names.map((c) => c.name),
      });
      productNameGenerated = step5.data.product_names[0].name;
      contentNameGenerated = step5.data.content_names[0].name;
    }
    // naming 실패는 치명적이지 않음: 기본값(원래 제품명)으로 계속 진행

    // ── Step 6: product-intro-writer-agent / product-detail-page-writer-agent ──
    const writerAgent =
      requestType === "detail"
        ? "product-detail-page-writer-agent"
        : "product-intro-writer-agent";

    const step6 = await callAgent(
      writerAgent,
      {
        category: metadata.categories[0],
        character: selectedCharacter.name,
        productName,
        productInfo,
        videoType: contentType,
        keywords: resource.keywords || [],
      },
      { resourceId, step: "content-writer" }
    );

    if (!step6.success) {
      return await markFailed(resourceId, "content-writer", step6.message);
    }
    const generatedContent = step6.data.content;

    // ── Step 7: compliance-reviewer-agent ──
    const step7 = await callAgent(
      "compliance-reviewer-agent",
      { generatedContent, category: metadata.categories[0], productName },
      { resourceId, step: "compliance-reviewer" }
    );

    if (!step7.success) {
      return await markFailed(resourceId, "compliance-reviewer", step7.message);
    }

    const validation = step7.data.validation;

    await callDatabase("contents", "create", {
      resource_id: resourceId,
      content_type: requestType,
      generated_content: generatedContent,
      tone: validation.tone || null,
      length: generatedContent.length,
      validation_status: validation.status,
      validation_score: validation.score,
    });

    if (validation.status === "REJECTED") {
      return await markFailed(
        resourceId,
        "compliance-reviewer",
        `검증 거부됨 (score: ${validation.score}): ${(validation.issues || []).join(", ")}`
      );
    }
    // NEEDS REVISION은 경고만 남기고 계속 진행 (영상까지는 생성)

    // ── Step 8: Higgsfield 영상 생성 (요청 + 폴링) ──
    const higgsfieldRequest = await requestHiggsfieldVideo(
      {
        scenario,
        character: selectedCharacter.name,
        characterDetail,
        productName: productNameGenerated,
        contentName: contentNameGenerated,
      },
      { resourceId, step: "higgsfield-request" }
    );

    if (!higgsfieldRequest.success) {
      return await markFailed(
        resourceId,
        "higgsfield-request",
        higgsfieldRequest.message
      );
    }

    const jobId = higgsfieldRequest.data.jobId;
    const pollResult = await pollHiggsfieldStatus(jobId, resourceId);

    if (!pollResult.success) {
      return await markFailed(resourceId, "higgsfield-video", pollResult.message);
    }

    await callDatabase("videos", "create", {
      resource_id: resourceId,
      video_url: pollResult.videoUrl,
      thumbnail_url: pollResult.thumbnailUrl,
      duration: scenario.total_duration,
      status: "completed",
    });

    await callDatabase(
      "generation_logs",
      "create",
      {
        resource_id: resourceId,
        step: "higgsfield-video",
        status: "success",
        error_message: null,
        duration_ms: null,
        attempt: 1,
      }
    );

    // ── 최종: resources 상태 완료로 변경 ──
    await callDatabase(
      "resources",
      "update",
      {
        status: "completed",
        metadata: {
          ...metadata,
          selected_product_name: productNameGenerated,
          selected_content_name: contentNameGenerated,
        },
      },
      { id: resourceId }
    );

    console.log(`[generation:${resourceId}] ✅ 전체 파이프라인 완료`);
  } catch (error) {
    await markFailed(resourceId, "unknown", error.message);
  }
}

// ─────────────────────────────────────────────
// 실패 처리 공통 함수 (database-agent.md 롤백 정책과 동일: hard delete 안 함)
// ─────────────────────────────────────────────
async function markFailed(resourceId, failedStep, errorMessage) {
  await callDatabase("resources", "update", { status: "failed" }, { id: resourceId });
  await callDatabase("generation_logs", "create", {
    resource_id: resourceId,
    step: failedStep,
    status: "fail",
    error_message: errorMessage,
    duration_ms: null,
    attempt: null,
  });
  console.warn(`[generation:${resourceId}] ❌ 실패 (step: ${failedStep}): ${errorMessage}`);
}

// ─────────────────────────────────────────────
// GET /api/generation/:resourceId/status — 진행 상태 조회
//
// frontend-agent.md가 이 응답을 5초마다 폴링해서 GenerationUI.jsx를 갱신한다.
// videos 테이블에 progress 컬럼이 없으므로, generation_logs의 성공 단계 수를
// PIPELINE_STEPS 대비 계산해서 progress(%)를 만든다.
// ─────────────────────────────────────────────
router.get("/:resourceId/status", async (req, res) => {
  const { resourceId } = req.params;

  const resourceResult = await callDatabase("resources", "read", null, {
    id: resourceId,
  });
  if (!resourceResult.success || resourceResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "자료를 찾을 수 없습니다." });
  }
  const resource = resourceResult.rows[0];

  const logsResult = await callDatabase("generation_logs", "read", null, {
    resource_id: resourceId,
  });
  const logs = logsResult.success ? logsResult.rows : [];

  const succeededSteps = new Set(
    logs.filter((l) => l.status === "success").map((l) => l.step)
  );
  const progress = Math.round(
    (Array.from(succeededSteps).filter((s) => PIPELINE_STEPS.includes(s)).length /
      PIPELINE_STEPS.length) *
      100
  );

  // ── 완료 ──
  if (resource.status === "completed") {
    const videosResult = await callDatabase("videos", "read", null, {
      resource_id: resourceId,
    });
    const video = videosResult.success ? videosResult.rows[0] : null;

    return res.json({
      success: true,
      status: "success",
      progress: 100,
      message: "✅ 생성 완료!",
      videoUrl: video?.video_url || null,
      thumbnailUrl: video?.thumbnail_url || null,
    });
  }

  // ── 실패 ──
  if (resource.status === "failed") {
    const lastFailLog = logs
      .filter((l) => l.status === "fail")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    return res.json({
      success: true,
      status: "error",
      progress,
      message: toFriendlyErrorMessage(lastFailLog?.error_message),
      showRetryButton: true,
    });
  }

  // ── 진행 중 ──
  return res.json({
    success: true,
    status: "loading",
    progress,
    message: `생성 중... (${progress}%)`,
  });
});

// ─────────────────────────────────────────────
// GET /api/generation/:resourceId/result — 완료된 최종 결과 상세 조회
// (scenario, naming, contents, video를 한 번에 묶어서 반환 — 결과 화면용)
// ─────────────────────────────────────────────
router.get("/:resourceId/result", async (req, res) => {
  const { resourceId } = req.params;

  const resourceResult = await callDatabase("resources", "read", null, {
    id: resourceId,
  });
  if (!resourceResult.success || resourceResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "자료를 찾을 수 없습니다." });
  }
  const resource = resourceResult.rows[0];

  if (resource.status !== "completed") {
    return res.status(409).json({
      success: false,
      message: "아직 생성이 완료되지 않았습니다.",
      currentStatus: resource.status,
    });
  }

  const [scenarios, naming, contents, videos] = await Promise.all([
    callDatabase("scenarios", "read", null, { resource_id: resourceId }),
    callDatabase("naming", "read", null, { resource_id: resourceId }),
    callDatabase("contents", "read", null, { resource_id: resourceId }),
    callDatabase("videos", "read", null, { resource_id: resourceId }),
  ]);

  return res.json({
    success: true,
    resource,
    scenario: scenarios.success ? scenarios.rows[0] : null,
    naming: naming.success ? naming.rows[0] : null,
    content: contents.success ? contents.rows[0] : null,
    video: videos.success ? videos.rows[0] : null,
  });
});

// ─────────────────────────────────────────────
// 내부 에러 메시지 → 사용자 친화적 메시지 변환 (frontend-agent.md 표와 동일)
// ─────────────────────────────────────────────
function toFriendlyErrorMessage(rawMessage = "") {
  const msg = rawMessage.toLowerCase();
  if (msg.includes("timeout")) {
    return "생성 시간이 너무 오래 걸리고 있어요. 다시 시도해주세요.";
  }
  if (msg.includes("server") || msg.includes("5")) {
    return "영상 생성 서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해주세요.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "네트워크 연결을 확인해주세요.";
  }
  return "일시적인 오류가 발생했어요. 다시 시도해주세요.";
}

module.exports = router;
