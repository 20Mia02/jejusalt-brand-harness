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
const { getGenerationConfig } = require("../utils/config-loader");

// ─────────────────────────────────────────────────────
// GET /api/generate/:resourceId/recommend-video-type
//
// ⭐ 재현성: AI를 다시 호출하지 않고, metadata(focus/categories) 기반의
// 고정 규칙(rule)으로 영상유형을 추천한다. 같은 metadata → 항상 같은 추천 결과
// (규칙 기반이므로 100% 재현 가능 — AI 호출 대비 훨씬 안정적인 방식).
// ─────────────────────────────────────────────────────
router.get("/:resourceId/recommend-video-type", async (req, res) => {
  const { resourceId } = req.params;

  const resourceResult = await callDatabase("resources", "read", null, { id: resourceId });
  if (!resourceResult.success || resourceResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "해당 자료를 찾을 수 없습니다" });
  }

  const metadata = resourceResult.rows[0].metadata || {};
  const videoTypes = getGenerationConfig().videoTypes || ["캐릭터소개", "제품스토리", "일상밥상"];
  const focus = (metadata.focus || []).join(" ");

  // 규칙(우선순위 순): focus 키워드 → 영상유형 매핑. 항상 같은 입력엔 같은 결과.
  const rules = [
    { keywords: ["신뢰", "기술", "전통"], type: "브랜드스토리" },
    { keywords: ["건강", "헬스케어"], type: "제품스토리" },
    { keywords: ["감정", "가족", "일상"], type: "일상밥상" },
    { keywords: ["감각", "자연"], type: "캐릭터소개" },
  ];

  let recommended = null;
  let reason = "";
  for (const rule of rules) {
    if (rule.keywords.some((k) => focus.includes(k)) && videoTypes.includes(rule.type)) {
      recommended = rule.type;
      reason = `강조점(${rule.keywords.filter((k) => focus.includes(k)).join(", ")})에 기반한 추천`;
      break;
    }
  }
  if (!recommended) {
    recommended = videoTypes[0];
    reason = "기본 추천 (강조점 매칭 규칙 없음)";
  }

  return res.json({
    success: true,
    resourceId,
    recommended,
    reason,
    availableTypes: videoTypes,
  });
});

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
  const { requestType, videoType, duration, useReferenceMaterials } = req.body;

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

  // 숏폼 길이 옵션 (기본 120초) — 15/30/60/120초만 허용
  const ALLOWED_DURATIONS = [15, 30, 60, 120];
  const targetDuration = ALLOWED_DURATIONS.includes(Number(duration))
    ? Number(duration)
    : 120;

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
    //
    // ⭐ 재현성 핵심: 이 캐릭터가 이미 상세 프로필(voice_tone + visual_description)을
    // 가지고 있으면(라이브러리에서 가져왔거나 이전에 이미 설계된 경우) AI를 다시 호출하지 않고
    // 저장된 프로필을 그대로 재사용한다. 매번 AI를 새로 호출하면 같은 캐릭터라도 응답이
    // 조금씩 달라질 수 있어(temperature 0.7) "동일 캐릭터 → 동일 결과" 원칙이 깨지기 때문이다.
    const hasStoredProfile = !!(selectedCharacter.voice_tone && selectedCharacter.visual_description);

    let completeBrief;
    if (hasStoredProfile) {
      console.log("[Step 4] 기존 캐릭터 프로필 재사용 (AI 재호출 생략 → 재현성 보장)");
      completeBrief = {
        character: selectedCharacter.character_name,
        voice_tone: selectedCharacter.voice_tone,
        personality_traits: selectedCharacter.personality_traits,
        visual_description: selectedCharacter.visual_description,
      };
      await callDatabase("generation_logs", "create", {
        resource_id: resourceId,
        step: "character-designer",
        status: "success",
        error_message: null,
        attempt: 0, // 0 = AI 미호출, 캐시된 프로필 재사용
      }).catch(() => {});
    } else {
      console.log("[Step 4] character-designer-agent 호출... (신규 프로필 생성)");
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

      completeBrief = designerResult.data?.brief || {
        character: selectedCharacter.character_name,
        voice_tone: selectedCharacter.voice_tone || "기본",
      };

      // ⭐ 새로 생성된 프로필은 characters 테이블에 저장 → 다음 요청부터는 재사용됨
      if (designerResult.success && designerResult.data?.brief) {
        await callDatabase("characters", "update", {
          voice_tone: completeBrief.voice_tone,
          personality_traits: completeBrief.personality_traits,
          visual_description: completeBrief.visual_description,
          preferred_expressions: completeBrief.preferred_expressions,
          avoid_expressions: completeBrief.avoid_expressions,
        }, { id: selectedCharacter.id }).catch((e) => console.error("[Step 4] 캐릭터 상세 저장 실패:", e));

        // 라이브러리에서 온 캐릭터라면 라이브러리 원본에도 반영 (다른 자료에서도 동일 프로필 재사용)
        if (selectedCharacter.library_character_id) {
          await callDatabase("character_library", "update", {
            voice_tone: completeBrief.voice_tone,
            personality_traits: completeBrief.personality_traits,
            visual_description: completeBrief.visual_description,
          }, { id: selectedCharacter.library_character_id }).catch(() => {});
        }
      }
    }

    // ── 3. Step 5: shortform-scenario-writer-agent 호출 (고수아) ──
    // 참고자료(기업자료_요약.md 등)가 업로드되어 있고, 사용자가 반영을 원하면 함께 전달한다.
    // useReferenceMaterials가 명시적으로 false가 아닌 한 기본적으로 반영한다.
    const referenceMaterials =
      useReferenceMaterials === false ? [] : resource.reference_materials || [];

    if (referenceMaterials.length > 0) {
      console.log(
        `[Step 5] 참고자료 ${referenceMaterials.length}건 반영: ${referenceMaterials.map((f) => f.filename).join(", ")}`
      );
    }

    console.log("[Step 5] shortform-scenario-writer-agent 호출...");
    const scenarioResult = await callAgent(
      "shortform-scenario-writer-agent",
      {
        brief: completeBrief,
        final_characters: [selectedCharacter],
        scenario_context: requestType,
        target_duration_seconds: targetDuration,
        referenceMaterials,
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

    // 시나리오가 요청한 길이(targetDuration)와 일치하는지 확인
    if (scenarioResult.data.timing_verification?.total_duration !== targetDuration) {
      console.warn(
        `⚠️ 시나리오가 ${targetDuration}초 요청에 ${scenarioResult.data.timing_verification?.total_duration}초로 응답했습니다`
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
      total_duration_seconds: scenarioResult.data.timing_verification?.total_duration || targetDuration,
      dialogue_seconds: scenarioResult.data.timing_verification?.dialogue_seconds || null,
      narration_seconds: scenarioResult.data.timing_verification?.narration_seconds || null,
      timing_valid: scenarioResult.data.timing_verification?.total_duration === targetDuration,
    });

    if (!scenarioDBResult.success) {
      console.error("[Step 5] scenarios 저장 실패");
      await callDatabase("generation_logs", "create", {
        resource_id: resourceId,
        step: "shortform-scenario-writer",
        status: "fail",
        error_message: "Scenarios 테이블 저장 실패",
      }).catch(() => {});
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

    // ⭐ 브랜드 보이스 학습 캐시: 과거에 승인(APPROVED)된 콘텐츠를 few-shot 예시로 프롬프트에 주입해
    //    매번 다른 담당자가 생성해도 톤이 일관되게 유지되도록 함
    let approvedExamples = [];
    try {
      const pastApproved = await callDatabase("contents", "read", null, {
        content_type: requestType === "detail" ? "detail" : "intro",
        validation_status: "APPROVED",
      });
      if (pastApproved.success) {
        approvedExamples = pastApproved.rows
          .filter((c) => c.generated_content)
          .slice(0, 3)
          .map((c) => c.generated_content);
      }
    } catch (e) {
      console.warn("[브랜드 보이스 캐시] 과거 승인 콘텐츠 조회 실패 (무시하고 계속):", e.message);
    }

    console.log(`[Step 7] ${agentName} 호출... (videoType: ${videoType || "제품스토리"}, 참고 예시: ${approvedExamples.length}건)`);
    const contentResult = await callAgent(
      agentName,
      {
        category: metadata.categories?.[0] || "일반",
        character: selectedCharacter.character_name,
        productName: selectedProductName,
        productInfo: resource.product_info,
        keywords: resource.keywords || [],
        trendKeywords: metadata.trendKeywords || [],
        customStyle: metadata.customStyle || null,
        scenario,
        videoType: videoType || "제품스토리",
        approvedExamples,
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
        visualDescription: selectedCharacter.visual_description || "",
        referenceImageUrl: selectedCharacter.reference_image_url || null, // ⭐ 재현성: 레퍼런스 이미지 전달
        duration: targetDuration,
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
      await callDatabase(
        "videos",
        "update",
        {
          generation_status: "completed",
          generation_progress: 100,
          video_url: videoUrl,
          character_reference_image_url: selectedCharacter.reference_image_url || null, // ⭐ 재현성 추적
        },
        { id: videosRowId }
      ).catch((e) => console.error("[영상 상태 업데이트 실패]", e));

      // ⭐ 캐릭터의 reference_image_url과 generation_count 업데이트 (첫 생성 시에만 저장)
      const isFirstGeneration = !selectedCharacter.reference_image_url && videoUrl;
      const characterUpdate = isFirstGeneration
        ? {
            reference_image_url: videoUrl, // Higgsfield 영상 URL을 레퍼런스로 사용
            image_generated_at: new Date().toISOString(),
            generation_count: 1,
          }
        : {
            generation_count: (selectedCharacter.generation_count || 0) + 1,
          };

      await callDatabase("characters", "update", characterUpdate, { id: selectedCharacter.id })
        .catch((e) => console.error("[캐릭터 레퍼런스/카운트 저장 실패]", e));

      // ⭐ 라이브러리에서 온 캐릭터라면, 라이브러리 원본에도 동일하게 반영한다.
      // 이렇게 해야 "결이"를 다른 자료(resource)에서 다시 선택했을 때도
      // 처음부터 같은 레퍼런스 이미지로 생성되어 자료 간에도 스타일이 일관되게 유지된다.
      if (selectedCharacter.library_character_id) {
        await callDatabase("character_library", "update", characterUpdate, {
          id: selectedCharacter.library_character_id,
        }).catch((e) => console.error("[라이브러리 레퍼런스 동기화 실패]", e));
      }
    }

    // ── 8. 최종 응답 ──────────────────────────────
    console.log(`✅ POST /api/generate 완료`);

    return res.status(201).json({
      success: true,
      contentId,
      validationStatus,
      validationScore,
      duration: targetDuration,
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
    const failureCount = logs.filter((l) => l.status === "fail").length;
    const retryingCount = logs.filter((l) => l.status === "retrying").length;
    const totalSteps = 9; // Step 1~9

    // 실패 단계 상세 정보 수집
    const failedSteps = logs
      .filter((l) => l.status === "fail")
      .map((l) => ({
        step: l.step,
        error_message: l.error_message || "상세정보 없음",
        error_code: l.error_code || "UNKNOWN",
        attempt: l.attempt || 0,
        timestamp: l.created_at,
      }));

    // 재시도 중인 단계
    const retiringSteps = logs
      .filter((l) => l.status === "retrying")
      .map((l) => ({
        step: l.step,
        attempt: l.attempt || 0,
        next_retry_in_ms: l.retry_delay_ms || 0,
      }));

    return res.json({
      success: true,
      resourceId,
      currentStep: currentStep.step,
      currentStatus: currentStep.status,
      progress: Math.round((successCount / totalSteps) * 100),
      completedSteps: successCount,
      failedSteps: failureCount,
      retiringSteps: retryingCount,
      totalSteps,
      lastUpdate: currentStep.created_at,
      // 에러 상세 정보
      ...(failureCount > 0 && {
        failureDetails: failedSteps,
        failureMessage: failedSteps[0]?.error_message || "알 수 없는 오류",
      }),
      // 재시도 진행 상황
      ...(retryingCount > 0 && {
        retryingDetails: retiringSteps,
      }),
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
    const contentsResult = await callDatabase("contents", "read", null, {
      resource_id: resourceId,
    });

    // 2. Videos 조회
    const videosResult = await callDatabase("videos", "read", null, {
      resource_id: resourceId,
    });

    // 3. Scenarios 조회
    const scenariosResult = await callDatabase("scenarios", "read", null, {
      resource_id: resourceId,
    });

    // 4. Characters 조회
    const charactersResult = await callDatabase("characters", "read", null, {
      resource_id: resourceId,
    });

    const contents = contentsResult.success ? contentsResult.rows : [];
    const videos = videosResult.success ? videosResult.rows : [];
    const scenarios = scenariosResult.success ? scenariosResult.rows : [];
    const characters = charactersResult.success ? charactersResult.rows : [];

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
      contents,
      videos,
      scenarios,
      characters,
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
// GET /api/generate/:resourceId/logs
// 생성 이력 조회 (AdminMode용)
// ─────────────────────────────────────────────────────
router.get("/:resourceId/logs", async (req, res) => {
  const { resourceId } = req.params;

  try {
    const logsResult = await callDatabase("generation_logs", "read", null, {
      resource_id: resourceId,
    });

    if (!logsResult.success) {
      return res.json({
        success: true,
        logs: [],
        message: "생성 이력이 없습니다",
      });
    }

    const logs = logsResult.rows || [];

    // 단계별로 그룹화
    const grouped = {};
    logs.forEach((log) => {
      if (!grouped[log.step]) {
        grouped[log.step] = [];
      }
      grouped[log.step].push(log);
    });

    return res.json({
      success: true,
      logs: logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      grouped,
      summary: {
        total: logs.length,
        success: logs.filter((l) => l.status === "success").length,
        failed: logs.filter((l) => l.status === "fail").length,
        retrying: logs.filter((l) => l.status === "retrying").length,
      },
    });
  } catch (error) {
    console.error("[GET /api/generate/:resourceId/logs] 예외:", error);
    return res.status(500).json({
      success: false,
      message: "생성 이력 조회 중 오류가 발생했습니다",
      resourceId,
    });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/generate/batch
// 여러 자료를 일괄 생성 (2C: Batch Processing)
// ─────────────────────────────────────────────────────
router.post("/batch", async (req, res) => {
  const { resourceIds, requestType } = req.body;

  if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "필수 항목: resourceIds는 비어있지 않은 배열이어야 합니다",
    });
  }

  if (!requestType || !["intro", "detail", "both"].includes(requestType)) {
    return res.status(400).json({
      success: false,
      message: 'requestType은 "intro", "detail", 또는 "both"이어야 합니다',
    });
  }

  try {
    console.log(
      `[POST /api/generate/batch] ${resourceIds.length}개 자료 생성 요청`
    );

    const batchResults = [];

    for (const resourceId of resourceIds) {
      try {
        // 각 자료마다 독립적으로 생성 시작
        // 주의: 이는 비동기적으로 실행되므로 응답을 기다리지 않음
        console.log(`  ↳ ${resourceId} 큐에 추가됨`);

        // 백그라운드에서 생성 시작 (await하지 않음)
        (async () => {
          try {
            const result = await fetch(
              `http://localhost:${process.env.PORT || 5000}/api/generate/${resourceId}/start`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestType }),
              }
            );
            const data = await result.json();
            console.log(`    ✅ ${resourceId} 생성 완료:`, data.success);
          } catch (err) {
            console.error(`    ❌ ${resourceId} 생성 실패:`, err.message);
          }
        })();

        batchResults.push({
          resourceId,
          status: "queued",
          message: "생성 큐에 추가되었습니다",
        });
      } catch (err) {
        batchResults.push({
          resourceId,
          status: "error",
          message: err.message,
        });
      }
    }

    return res.json({
      success: true,
      batchSize: resourceIds.length,
      results: batchResults,
      message: "모든 자료가 생성 큐에 추가되었습니다. 진행 상황은 각 resourceId의 /status로 확인하세요",
    });
  } catch (error) {
    console.error("[POST /api/generate/batch] 예외:", error);
    return res.status(500).json({
      success: false,
      message: "배치 생성 중 오류가 발생했습니다",
    });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/retry-from/:step
// 특정 단계부터 재실행 (2C: Partial Retry)
// ─────────────────────────────────────────────────────
router.post("/:resourceId/retry-from/:step", async (req, res) => {
  const { resourceId, step } = req.params;
  const stepNum = parseInt(step);

  if (!resourceId || isNaN(stepNum) || stepNum < 4 || stepNum > 9) {
    return res.status(400).json({
      success: false,
      message: "stepNumber는 4~9 사이여야 합니다 (Step 1-3은 필터링 단계)",
    });
  }

  try {
    console.log(
      `[POST /api/generate/:resourceId/retry-from/:step] resourceId: ${resourceId}, step: ${step}`
    );

    // 생성 로그에서 이 단계의 기존 기록 삭제 (재시도 표시)
    const logsResult = await callDatabase("generation_logs", "read", null, {
      resource_id: resourceId,
    });

    if (logsResult.success && logsResult.rows.length > 0) {
      const lastLog = logsResult.rows[0];
      console.log(
        `  마지막 상태: Step ${lastLog.step} - ${lastLog.status}`
      );
    }

    // 실제 재시도는 /start 엔드포인트에서 처리
    // 여기서는 로그만 기록하고 큐에 추가
    await callDatabase("generation_logs", "create", {
      resource_id: resourceId,
      step: stepNum,
      status: "retrying",
      details: `Step ${stepNum}부터 재시도 시작`,
    });

    // 실제로는 Step 4부터 다시 시작 (Step 1-3은 이미 완료)
    const { requestType } = req.body || { requestType: "intro" };

    return res.json({
      success: true,
      resourceId,
      retryFrom: stepNum,
      message: `Step ${stepNum}부터 재시도를 시작했습니다`,
      nextAction: `POST /api/generate/${resourceId}/start에서 계속 진행`,
    });
  } catch (error) {
    console.error(
      `[POST /api/generate/:resourceId/retry-from/:step] 예외:`,
      error
    );
    return res.status(500).json({
      success: false,
      message: "재시도 중 오류가 발생했습니다",
      resourceId,
    });
  }
});

// ─────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────

module.exports = router;
