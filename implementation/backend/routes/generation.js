/**
 * backend/routes/generation.js
 *
 * 기능4: AI 콘텐츠 생성 + Higgsfield 영상 생성
 * 담당: 박주미
 * 의존: backend-agent.md (callAgent, callHiggsfield), database-agent.md (callDatabase)
 *
 * Step 4~9 (사람 검토 지점: Step4 캐릭터 브리프 / Step5 시나리오 / Step6 영상 제목 / Step7 카피):
 * Step 4: character-designer-agent (고수아) — 생성 후 사람 검토
 * Step 5: shortform-scenario-writer-agent (고수아) — 생성 후 사람 검토
 * Step 6: naming-generator-agent (고수아) — 생성 후 사람 검토 (영상 제목만. 제품명은 Step1 값 고정)
 * Step 7: product-intro/detail-writer-agent (박주미) — 생성 후 사람 검토
 * Step 8: compliance-reviewer-agent (박주미) — 자동
 * Step 9: Higgsfield 호출 (박주미) — 자동
 *
 * ⭐ 파이프라인이 한번에 끝까지 자동 실행되지 않고, Step4/5/6/7 뒤에서 각각 멈춰서
 * 프론트가 사용자 검토/수정 결과를 confirm 엔드포인트로 보내야 다음 단계로 진행된다.
 * 각 단계 사이의 "합의된 상태"(요청 옵션, 확정된 영상 제목 등)는 resources.metadata에 저장해
 * 다음 단계 호출 시 다시 조회한다.
 */

const express = require("express");
const router = express.Router();

const { callAgent, callHiggsfield, generateVideo, generateImageFromPrompt, getComplianceRulesForCategory } = require("../agents/backend-agent");
const { callDatabase } = require("../agents/database-agent");
const { getGenerationConfig } = require("../utils/config-loader");
const scenarioTemplates = require("../config/scenario-templates.json");
// ⚠️ refineCharacterImage(AI가 프롬프트를 자유롭게 다시 쓰는 재시도 루프)는 기본 캐릭터에는
// 더 이상 쓰지 않는다(POST /character 참고) — 커스텀 캐릭터 리파인 기능을 만들 때 다시 사용.
const {
  getCharacterReferenceData,
  updateCharacterVersion,
  nextVersion,
} = require("../services/character-consistency");

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
// GET /api/generate/:resourceId/trends
//
// "최근 트렌드 추천" — TimelyAI(LLM)를 이용한 지식 기반 추천이며 실시간 검색이 아니다.
// ─────────────────────────────────────────────────────
router.get("/:resourceId/trends", async (req, res) => {
  const { resourceId } = req.params;

  try {
    const resourceResult = await callDatabase("resources", "read", null, { id: resourceId });
    if (!resourceResult.success || resourceResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "해당 자료를 찾을 수 없습니다" });
    }

    const resource = resourceResult.rows[0];
    const metadata = resource.metadata || {};

    const trendResult = await callAgent(
      "trend-analyzer-agent",
      {
        category: metadata.categories?.[0] || "일반",
        focus: metadata.focus || [],
        productName: resource.product_name,
      },
      { resourceId, step: "trend-analyzer" }
    );

    if (!trendResult.success) {
      return res.status(502).json({ success: false, message: "트렌드 추천에 실패했습니다" });
    }

    return res.json({
      success: true,
      resourceId,
      trends: trendResult.data.trends || [],
      disclaimer: "AI 지식 기반 추천입니다 (실시간 검색 결과가 아닙니다).",
    });
  } catch (error) {
    console.error("[GET /api/generate/:resourceId/trends] 예외:", error);
    return res.status(500).json({ success: false, message: "트렌드 추천 중 오류가 발생했습니다" });
  }
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
// Step 4(캐릭터설계) ~ Step 5(시나리오 작성)까지만 실행하고,
// 사람 검토를 위해 여기서 멈춘다. 다음 단계는 /scenario/:scenarioId/confirm.
// ─────────────────────────────────────────────────────

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

    // ⭐ 멀티 캐릭터 지원: 선택된 캐릭터가 여러 명이면 전원의 브리프를 만든다.
    const selectedCharacters = charactersResult.rows;

    // ── Step 4: character-designer-agent 호출 (고수아) — 선택된 캐릭터 각각에 대해 ──
    //
    // ⭐ 재현성 핵심: 캐릭터가 이미 상세 프로필(voice_tone + visual_description)을
    // 가지고 있으면(라이브러리에서 가져왔거나 이전에 이미 설계된 경우) AI를 다시 호출하지 않고
    // 저장된 프로필을 그대로 재사용한다.
    const characterBriefs = [];
    for (const character of selectedCharacters) {
      const hasStoredProfile = !!(character.voice_tone && character.visual_description);

      let brief;
      if (hasStoredProfile) {
        console.log(`[Step 4] "${character.character_name}" 기존 프로필 재사용 (AI 재호출 생략 → 재현성 보장)`);
        brief = {
          character: character.character_name,
          voice_tone: character.voice_tone,
          personality_traits: character.personality_traits,
          visual_description: character.visual_description,
        };
        await callDatabase("generation_logs", "create", {
          resource_id: resourceId,
          step: "character-designer",
          status: "success",
          error_message: null,
          attempt: 0, // 0 = AI 미호출, 캐시된 프로필 재사용
        }).catch(() => {});
      } else {
        console.log(`[Step 4] "${character.character_name}" character-designer-agent 호출... (신규 프로필 생성)`);
        const designerResult = await callAgent(
          "character-designer-agent",
          {
            character: character.character_name,
            productName: resource.product_name,
            productInfo: resource.product_info,
            metadata,
          },
          { resourceId, step: "character-designer" }
        );

        if (!designerResult.success) {
          console.warn(`[Step 4] "${character.character_name}" character-designer 실패, 기본 정보로 계속`);
        }

        brief = designerResult.data?.brief || {
          character: character.character_name,
          voice_tone: character.voice_tone || "기본",
        };

        // ⭐ 새로 생성된 프로필은 characters 테이블에 저장 → 다음 요청부터는 재사용됨
        if (designerResult.success && designerResult.data?.brief) {
          await callDatabase("characters", "update", {
            voice_tone: brief.voice_tone,
            personality_traits: brief.personality_traits,
            visual_description: brief.visual_description,
            preferred_expressions: brief.preferred_expressions,
            avoid_expressions: brief.avoid_expressions,
          }, { id: character.id }).catch((e) => console.error("[Step 4] 캐릭터 상세 저장 실패:", e));

          // 라이브러리에서 온 캐릭터라면 라이브러리 원본에도 반영 (다른 자료에서도 동일 프로필 재사용)
          if (character.library_character_id) {
            await callDatabase("character_library", "update", {
              voice_tone: brief.voice_tone,
              personality_traits: brief.personality_traits,
              visual_description: brief.visual_description,
            }, { id: character.library_character_id }).catch(() => {});
          }
        }
      }

      characterBriefs.push({ characterId: character.id, ...brief });
    }

    // ⭐ 이 단계에서 합의된 생성 옵션(요청 타입/영상유형/길이/참고자료 반영 여부)을
    // resources.metadata에 저장 → 뒤 단계(confirm 엔드포인트들)에서 다시 조회해서 이어간다.
    await callDatabase(
      "resources",
      "update",
      {
        metadata: {
          ...metadata,
          generation_settings: {
            requestType,
            videoType: videoType || "제품스토리",
            duration: targetDuration,
            useReferenceMaterials: useReferenceMaterials !== false,
          },
        },
      },
      { id: resourceId }
    ).catch((e) => console.error("[Step 4] generation_settings 저장 실패:", e));

    return res.status(201).json({
      success: true,
      stage: "character_review",
      resourceId,
      characterBriefs,
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
// POST /api/generate/:resourceId/character/confirm
// 캐릭터 브리프(말투/성격/외형) 검토/수정 확정 → Step 5(시나리오 작성)까지 실행
// ─────────────────────────────────────────────────────
router.post("/:resourceId/character/confirm", async (req, res) => {
  const { resourceId } = req.params;
  // editedBriefs: { [characterId]: { voice_tone?, personality_traits?, visual_description? } } — 수정된 캐릭터만 포함
  const { editedBriefs, feedback } = req.body || {};

  try {
    const charactersResult = await callDatabase("characters", "read", null, {
      resource_id: resourceId,
      selected: true,
    });
    if (!charactersResult.success || charactersResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "선택된 캐릭터를 찾을 수 없습니다" });
    }
    const selectedCharacters = charactersResult.rows;

    // ⭐ 멀티 캐릭터: 각 캐릭터마다 Step4에서 저장된 브리프를 기본값으로, 사용자가 수정한
    // 필드만 덮어쓴다. 시나리오 작성(Step5)에는 이 확정된 브리프 전원이 함께 전달된다.
    const completeBriefs = [];
    for (const character of selectedCharacters) {
      const edit = editedBriefs?.[character.id];
      const brief = {
        character: character.character_name,
        voice_tone: edit?.voice_tone || character.voice_tone,
        personality_traits: edit?.personality_traits || character.personality_traits,
        visual_description: edit?.visual_description || character.visual_description,
      };

      if (edit) {
        await callDatabase("characters", "update", {
          voice_tone: brief.voice_tone,
          personality_traits: brief.personality_traits,
          visual_description: brief.visual_description,
        }, { id: character.id }).catch((e) => console.error("[Step 4 확정] 캐릭터 수정 저장 실패:", e));

        if (character.library_character_id) {
          await callDatabase("character_library", "update", {
            voice_tone: brief.voice_tone,
            personality_traits: brief.personality_traits,
            visual_description: brief.visual_description,
          }, { id: character.library_character_id }).catch(() => {});
        }
      }

      completeBriefs.push({ ...character, ...brief });
    }

    console.log(`[Step 4 확정] resourceId: ${resourceId}, 캐릭터 수: ${completeBriefs.length}, 수정여부: ${!!editedBriefs}`);

    // ⭐ Hook 1 승인 기록: generation_logs에 마케터 승인 이력 저장
    await callDatabase("generation_logs", "create", {
      resource_id: resourceId,
      step: "character-designer",
      status: "approved_by_marketer",
      details: `Hook 1 승인: 캐릭터 설계 확정${editedBriefs ? `, ${Object.keys(editedBriefs).length}개 캐릭터 수정` : ", AI 초안 그대로 승인"}`,
      attempt: 1,
    }).catch((e) => console.error("[Hook 1 로그 기록 실패]", e));

    // ⭐ Step5는 더 이상 여기서 자동 실행하지 않는다 — "어떤 스타일로 만들까요?" 템플릿
    // 선택 화면을 먼저 보여주고, 사용자가 템플릿(AI 추천 경로) 또는 직접 작성(검토 경로)을
    // 고른 뒤에야 실제 시나리오 생성이 시작된다.
    return res.status(201).json({
      success: true,
      stage: "template_select",
      resourceId,
      templates: scenarioTemplates,
    });
  } catch (error) {
    console.error("[POST /character/confirm] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "캐릭터 확정 중 오류가 발생했습니다" });
  }
});

// ⭐ 사용자가 Step1~5에서 고른 target_duration_seconds를 shortform-scenario-writer-agent가
// 매번 정확히 지키지는 않는다(예: 45초를 요청했는데 120초짜리 Act 구성을 써서 응답한 사례가
// 실사용자 테스트에서 실제로 발견됨). 재호출로 고치기보다, compliance 규칙 기반 백스톱과
// 같은 패턴으로 — Act별 duration_seconds를 요청 길이에 비례해서 결정론적으로 재조정한다.
// 이렇게 하면 AI가 무엇을 응답하든 최종 저장되는 시나리오는 항상 사용자가 고른 길이와
// 정확히 일치한다.
function normalizeActsToTargetDuration(acts, targetDuration) {
  const list = Array.isArray(acts) ? acts : [];
  const total = list.reduce((sum, a) => sum + (Number(a.duration_seconds) || 0), 0);
  if (!targetDuration || list.length === 0 || total === targetDuration) {
    return { acts: list, totalDuration: total || targetDuration || 0 };
  }

  const scale = targetDuration / total;
  let allocated = 0;
  const rescaled = list.map((act, idx) => {
    if (idx === list.length - 1) {
      // 마지막 Act가 반올림 오차를 흡수해서 합계가 targetDuration과 정확히 일치하게 만든다.
      return { ...act, duration_seconds: Math.max(1, targetDuration - allocated) };
    }
    const scaledSeconds = Math.max(1, Math.round((Number(act.duration_seconds) || 0) * scale));
    allocated += scaledSeconds;
    return { ...act, duration_seconds: scaledSeconds };
  });

  return { acts: rescaled, totalDuration: targetDuration };
}

// ─────────────────────────────────────────────────────
// 공통 헬퍼: 완성된 시나리오(scenario)를 scenarios 테이블에 저장하고
// scenario_review 단계 응답 형태로 반환한다.
// (AI 추천 경로의 generate-from-logline과 직접 작성 경로의 finalize-draft가 공유)
// ─────────────────────────────────────────────────────
async function saveScenarioAndBuildResponse({ resourceId, characterId, scenario, timingVerification, targetDuration }) {
  if (timingVerification?.total_duration !== targetDuration) {
    console.warn(
      `⚠️ 시나리오가 ${targetDuration}초 요청에 ${timingVerification?.total_duration}초로 응답함 → Act별 길이를 ${targetDuration}초 기준으로 비례 재조정`
    );
  }

  const { acts: normalizedActs, totalDuration } = normalizeActsToTargetDuration(scenario.acts, targetDuration);
  scenario = { ...scenario, acts: normalizedActs };
  timingVerification = { ...(timingVerification || {}), total_duration: totalDuration };

  const scenarioDBResult = await callDatabase("scenarios", "create", {
    resource_id: resourceId,
    character_id: characterId,
    scenario_title: scenario.title,
    story_content: scenario.story_content || scenario.content || "",
    scenario_json: scenario.acts || scenario,
    total_duration_seconds: timingVerification.total_duration,
    dialogue_seconds: timingVerification?.dialogue_seconds || null,
    narration_seconds: timingVerification?.narration_seconds || null,
    timing_valid: true,
  });

  if (!scenarioDBResult.success) {
    console.error("[Step 5] scenarios 저장 실패");
    await callDatabase("generation_logs", "create", {
      resource_id: resourceId,
      step: "shortform-scenario-writer",
      status: "fail",
      error_message: "Scenarios 테이블 저장 실패",
    }).catch(() => {});
    return { success: false };
  }

  return {
    success: true,
    body: {
      success: true,
      stage: "scenario_review",
      resourceId,
      scenarioId: scenarioDBResult.rows?.[0]?.id || null,
      scenario: {
        title: scenario.title,
        story_content: scenario.story_content || scenario.content || "",
        acts: scenario.acts || [],
      },
      timingVerification: timingVerification || null,
    },
  };
}

// 공통 헬퍼: resource + 선택된 캐릭터(전원) + generation_settings 조회
async function loadResourceAndCharacters(resourceId) {
  const resourceResult = await callDatabase("resources", "read", null, { id: resourceId });
  if (!resourceResult.success || resourceResult.rows.length === 0) {
    return { error: { status: 404, message: "해당 자료를 찾을 수 없습니다" } };
  }
  const resource = resourceResult.rows[0];
  const metadata = resource.metadata || {};
  const generationSettings = metadata.generation_settings || {};

  const charactersResult = await callDatabase("characters", "read", null, {
    resource_id: resourceId,
    selected: true,
  });
  if (!charactersResult.success || charactersResult.rows.length === 0) {
    return { error: { status: 400, message: "선택된 캐릭터를 찾을 수 없습니다" } };
  }

  return { resource, metadata, generationSettings, selectedCharacters: charactersResult.rows };
}

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/scenario/loglines
// (AI 추천 경로 1단계) 템플릿 선택 → 로그라인 3개 제안
// ─────────────────────────────────────────────────────
router.post("/:resourceId/scenario/loglines", async (req, res) => {
  const { resourceId } = req.params;
  const { templateId } = req.body || {};

  try {
    const ctx = await loadResourceAndCharacters(resourceId);
    if (ctx.error) return res.status(ctx.error.status).json({ success: false, message: ctx.error.message });
    const { generationSettings, selectedCharacters } = ctx;
    const requestType = generationSettings.requestType || "intro";

    console.log(`[Step 5] 로그라인 생성 요청... (템플릿: ${templateId})`);
    const result = await callAgent(
      "shortform-scenario-writer-agent",
      {
        mode: "loglines",
        templateId,
        brief: selectedCharacters[0],
        final_characters: selectedCharacters,
        scenario_context: requestType,
      },
      { resourceId, step: "shortform-scenario-writer" }
    );

    if (!result.success) {
      return res.status(502).json({ success: false, message: "로그라인 생성에 실패했습니다", resourceId });
    }

    return res.json({
      success: true,
      stage: "logline_review",
      resourceId,
      templateId,
      loglineOptions: result.data.loglineOptions || [],
    });
  } catch (error) {
    console.error("[POST /scenario/loglines] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "로그라인 생성 중 오류가 발생했습니다" });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/scenario/generate-from-logline
// (AI 추천 경로 2단계) 선택한 로그라인 → 전체 시나리오 생성 → 저장
// ─────────────────────────────────────────────────────
router.post("/:resourceId/scenario/generate-from-logline", async (req, res) => {
  const { resourceId } = req.params;
  const { templateId, selectedLogline } = req.body || {};

  try {
    const ctx = await loadResourceAndCharacters(resourceId);
    if (ctx.error) return res.status(ctx.error.status).json({ success: false, message: ctx.error.message });
    const { resource, generationSettings, selectedCharacters } = ctx;
    const requestType = generationSettings.requestType || "intro";
    const targetDuration = generationSettings.duration || 120;
    const useReferenceMaterials = generationSettings.useReferenceMaterials !== false;
    const referenceMaterials = useReferenceMaterials ? resource.reference_materials || [] : [];

    console.log(`[Step 5] 전체 시나리오 생성 요청... (템플릿: ${templateId}, 로그라인: ${selectedLogline?.title})`);
    const result = await callAgent(
      "shortform-scenario-writer-agent",
      {
        mode: "full_scenario",
        templateId,
        selectedLogline,
        brief: selectedCharacters[0],
        final_characters: selectedCharacters,
        scenario_context: requestType,
        target_duration_seconds: targetDuration,
        referenceMaterials,
      },
      { resourceId, step: "shortform-scenario-writer" }
    );

    if (!result.success) {
      return res.status(502).json({ success: false, message: "시나리오 생성에 실패했습니다", resourceId });
    }

    const saved = await saveScenarioAndBuildResponse({
      resourceId,
      characterId: selectedCharacters[0].id,
      scenario: result.data.scenario,
      timingVerification: result.data.timing_verification,
      targetDuration,
    });
    if (!saved.success) {
      return res.status(500).json({ success: false, message: "시나리오 저장에 실패했습니다" });
    }
    return res.status(201).json(saved.body);
  } catch (error) {
    console.error("[POST /scenario/generate-from-logline] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "시나리오 생성 중 오류가 발생했습니다" });
  }
});

// ⭐ 재현성/신뢰성: LLM(gpt-4.1-mini)이 컴플라이언스 위반을 발견하고도 issues를 비운 채
// status만 PASS로 응답하는 경우가 관찰되어(구조화 초안에서는 알아서 표현을 순화하지만,
// 그 사실을 issues에 보고하지 않음), AI 판정과 별개로 사용자 원문을 직접 스캔하는 규칙
// 기반 안전장치를 둔다 (recommend-video-type과 같은 "AI 재호출 없는 결정론적 규칙" 패턴).
const COMPLIANCE_RED_FLAGS = [
  { pattern: /치료|완치|낫는다|낫게/, reason: "질병 치료 효능을 암시하는 의료 표현으로 금지됨", suggestion: "건강한 밸런스에 도움을 줄 수 있어요" },
  { pattern: /혈압|당뇨|암\s|고혈압/, reason: "특정 질환과의 연관성을 암시하는 표현으로 금지됨", suggestion: "질환명을 언급하지 않는 건강 관련 표현으로 순화" },
  { pattern: /유일무이|최고의|가장 좋은|넘버원|1위/, reason: "근거 없는 자극적 비교/과장 표현", suggestion: "구체적 근거가 있는 표현으로 순화" },
];

function scanComplianceRedFlags(text) {
  const issues = [];
  for (const flag of COMPLIANCE_RED_FLAGS) {
    const match = text.match(flag.pattern);
    if (match) {
      issues.push({ text: match[0], reason: flag.reason, suggestion: flag.suggestion });
    }
  }
  return issues;
}

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/scenario/draft-review
// (직접 작성 경로) 사용자 아이디어 → 브랜드보이스/컴플라이언스 검토 + 구조화 초안
// (DB에 저장하지 않음 — 사용자가 "이대로 진행"을 눌러야 finalize-draft에서 저장됨)
// ─────────────────────────────────────────────────────
router.post("/:resourceId/scenario/draft-review", async (req, res) => {
  const { resourceId } = req.params;
  const { userIdea } = req.body || {};

  if (!userIdea || !userIdea.trim()) {
    return res.status(400).json({ success: false, message: "아이디어를 입력해주세요" });
  }

  try {
    const ctx = await loadResourceAndCharacters(resourceId);
    if (ctx.error) return res.status(ctx.error.status).json({ success: false, message: ctx.error.message });
    const { generationSettings, selectedCharacters } = ctx;

    console.log(`[Step 5] 사용자 아이디어 검토 요청...`);
    const result = await callAgent(
      "shortform-scenario-writer-agent",
      {
        mode: "draft_review",
        userIdea,
        brief: selectedCharacters[0],
        final_characters: selectedCharacters,
        scenario_context: generationSettings.requestType || "intro",
        target_duration_seconds: generationSettings.duration || 120,
      },
      { resourceId, step: "shortform-scenario-writer" }
    );

    if (!result.success) {
      return res.status(502).json({ success: false, message: "아이디어 검토에 실패했습니다", resourceId });
    }

    const review = result.data.review;
    const ruleBasedIssues = scanComplianceRedFlags(userIdea);
    if (ruleBasedIssues.length > 0) {
      const existingTexts = new Set((review.complianceCheck?.issues || []).map((i) => i.text));
      const newIssues = ruleBasedIssues.filter((i) => !existingTexts.has(i.text));
      if (newIssues.length > 0) {
        console.warn(`[Step 5] 규칙 기반 컴플라이언스 스캔이 AI가 놓친 문제 표현을 발견함: ${newIssues.map((i) => i.text).join(", ")}`);
        review.complianceCheck = {
          status: review.complianceCheck?.status === "FAIL" ? "FAIL" : "WARNING",
          issues: [...(review.complianceCheck?.issues || []), ...newIssues],
        };
      }
    }

    return res.json({
      success: true,
      stage: "draft_review",
      resourceId,
      review,
    });
  } catch (error) {
    console.error("[POST /scenario/draft-review] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "아이디어 검토 중 오류가 발생했습니다" });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/scenario/finalize-draft
// (직접 작성 경로) 검토를 마친 구조화 초안을 확정 저장
// ─────────────────────────────────────────────────────
router.post("/:resourceId/scenario/finalize-draft", async (req, res) => {
  const { resourceId } = req.params;
  const { structuredDraft } = req.body || {};

  if (!structuredDraft || !structuredDraft.title) {
    return res.status(400).json({ success: false, message: "structuredDraft가 필요합니다" });
  }

  try {
    const ctx = await loadResourceAndCharacters(resourceId);
    if (ctx.error) return res.status(ctx.error.status).json({ success: false, message: ctx.error.message });
    const { generationSettings, selectedCharacters } = ctx;
    const targetDuration = generationSettings.duration || 120;

    const totalDuration =
      (structuredDraft.acts || []).reduce((sum, a) => sum + (a.duration_seconds || 0), 0) || targetDuration;

    const saved = await saveScenarioAndBuildResponse({
      resourceId,
      characterId: selectedCharacters[0].id,
      scenario: structuredDraft,
      timingVerification: { total_duration: totalDuration },
      targetDuration,
    });
    if (!saved.success) {
      return res.status(500).json({ success: false, message: "시나리오 저장에 실패했습니다" });
    }
    return res.status(201).json(saved.body);
  } catch (error) {
    console.error("[POST /scenario/finalize-draft] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "시나리오 확정 중 오류가 발생했습니다" });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/scenario/:scenarioId/confirm
// 시나리오 검토/수정 확정 → Step 6(영상 제목 생성)까지 실행
// ─────────────────────────────────────────────────────
router.post("/:resourceId/scenario/:scenarioId/confirm", async (req, res) => {
  const { resourceId, scenarioId } = req.params;
  const { editedStoryContent, editedActs, feedback } = req.body;

  try {
    const scenarioResult = await callDatabase("scenarios", "read", null, { id: scenarioId });
    if (!scenarioResult.success || scenarioResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "해당 시나리오를 찾을 수 없습니다" });
    }
    const scenarioRow = scenarioResult.rows[0];

    const resourceResult = await callDatabase("resources", "read", null, { id: resourceId });
    if (!resourceResult.success || resourceResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "해당 자료를 찾을 수 없습니다" });
    }
    const resource = resourceResult.rows[0];
    const metadata = resource.metadata || {};

    // 사용자가 수정했으면 반영, 아니면 AI 초안 그대로 확정
    const finalStoryContent = editedStoryContent || scenarioRow.story_content;
    const finalActs = editedActs || scenarioRow.scenario_json;

    await callDatabase(
      "scenarios",
      "update",
      {
        story_content: finalStoryContent,
        scenario_json: finalActs,
        marketer_approved: true,
        marketer_feedback: feedback || null,
      },
      { id: scenarioId }
    );

    console.log(`[Step 5 확정] resourceId: ${resourceId}, 수정여부: ${!!editedStoryContent || !!editedActs}`);

    // ⭐ Hook 2 승인 기록: generation_logs에 마케터 승인 이력 저장
    await callDatabase("generation_logs", "create", {
      resource_id: resourceId,
      step: "shortform-scenario-writer",
      status: "approved_by_marketer",
      details: `Hook 2 승인: 시나리오 확정${editedStoryContent || editedActs ? ", 사용자 수정 반영" : ", AI 초안 그대로 승인"}`,
      attempt: 1,
    }).catch((e) => console.error("[Hook 2 로그 기록 실패]", e));

    // ── Step 6: naming-generator-agent 호출 (고수아) ──
    // ⭐ "다음 단계에만 전달": 확정된(수정됐을 수도 있는) 시나리오 내용을 참고 컨텍스트로 함께 전달해
    // 별도의 재분석 AI 호출 없이도 다음 단계가 최신 내용을 반영하도록 한다.
    console.log("[Step 6] naming-generator-agent 호출...");
    const namingResult = await callAgent(
      "naming-generator-agent",
      {
        scenario_id: scenarioId,
        scenario_text: finalStoryContent,
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

    const productNameOptions = namingResult.data?.product_name_options || [];
    const contentNameOptions = namingResult.data?.content_name_options || [];

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

    if (!namingDBResult.success) {
      return res.status(500).json({ success: false, message: "네이밍 결과 저장에 실패했습니다" });
    }

    return res.json({
      success: true,
      stage: "naming_review",
      resourceId,
      namingId: namingDBResult.rows?.[0]?.id || null,
      // ⭐ 실제 제품명(Step1에서 사용자가 입력한 값)은 참고로만 보여준다 — Step6은 이 이름을
      // 대체하는 단계가 아니라 "이 제품명/설명을 바탕으로 한 영상 제목"만 정하는 단계다.
      realProductName: resource.product_name,
      contentNameOptions,
      fallbackContentName: scenarioRow.scenario_title,
    });
  } catch (error) {
    console.error("[POST /scenario/confirm] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "시나리오 확정 중 오류가 발생했습니다" });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/naming/confirm
// 영상 제목(콘텐츠명) 확정 → Step 7(카피 작성)까지 실행
//
// ⚠️ 제품명은 여기서 다루지 않는다. Step1에서 이미 입력한 실제 제품명(resource.product_name)이
// 유일한 제품명이며, naming-generator-agent가 만드는 "제품명 후보"는 신제품 네이밍용으로 설계된
// 필드라 이 파이프라인(기존 제품 홍보 콘텐츠 제작)과 맞지 않아 사용하지 않는다. 여기서 정하는 것은
// 오직 "영상/콘텐츠 제목"(content_name)뿐이다.
// ─────────────────────────────────────────────────────
router.post("/:resourceId/naming/confirm", async (req, res) => {
  const { resourceId } = req.params;
  const { selectedContentName } = req.body;

  try {
    const namingResult = await callDatabase("naming", "read", null, { resource_id: resourceId });
    if (!namingResult.success || namingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "해당 자료의 네이밍 결과를 찾을 수 없습니다. 먼저 시나리오를 확정해주세요.",
      });
    }
    const namingRow = namingResult.rows.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )[0];

    const resourceResult = await callDatabase("resources", "read", null, { id: resourceId });
    if (!resourceResult.success || resourceResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "해당 자료를 찾을 수 없습니다" });
    }
    const resource = resourceResult.rows[0];
    const metadata = resource.metadata || {};
    const generationSettings = metadata.generation_settings || {};
    const requestType = generationSettings.requestType || "intro";
    const videoType = generationSettings.videoType || "제품스토리";

    // 실제 제품명은 절대 대체되지 않는다 — Step1 입력값 그대로 사용
    const finalProductName = resource.product_name;
    const finalContentName = selectedContentName || namingRow.content_name_1 || resource.product_name;

    // resources.metadata에 콘텐츠명(영상 제목)만 병합 저장 (metadata 전체를 덮어쓰지 않기 위해 spread)
    await callDatabase(
      "resources",
      "update",
      {
        metadata: {
          ...metadata,
          selected_content_name: finalContentName,
        },
      },
      { id: resourceId }
    );

    console.log(`[Step 6 확정] resourceId: ${resourceId}, 영상 제목: ${finalContentName} (제품명은 변경되지 않음: ${finalProductName})`);

    // ⭐ Hook 3 승인 기록: generation_logs에 마케터 승인 이력 저장
    await callDatabase("generation_logs", "create", {
      resource_id: resourceId,
      step: "naming-generator",
      status: "approved_by_marketer",
      details: `Hook 3 승인: 영상 제목(콘텐츠명) 선택: "${finalContentName}"${selectedContentName ? ", 사용자가 직접 선택" : ", AI 1순위 기본값 사용"}`,
      attempt: 1,
    }).catch((e) => console.error("[Hook 3 로그 기록 실패]", e));

    // 최신 시나리오(사람 검토 확정본) 조회 — Step 7 카피 작성에 사용
    const scenarioResult = await callDatabase("scenarios", "read", null, { resource_id: resourceId });
    const scenarioRow = scenarioResult.success
      ? scenarioResult.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      : null;
    const scenarioForContent = scenarioRow
      ? {
          title: scenarioRow.scenario_title,
          story_content: scenarioRow.story_content,
          acts: scenarioRow.scenario_json,
        }
      : null;

    // 선택된 캐릭터 조회 (카피 작성 컨텍스트에 필요, 여러 명일 수 있음)
    const charactersResult = await callDatabase("characters", "read", null, {
      resource_id: resourceId,
      selected: true,
    });
    const selectedCharacters = charactersResult.success ? charactersResult.rows : [];
    const characterNames = selectedCharacters.map((c) => c.character_name).filter(Boolean).join(", ");

    // ── Step 7: product-intro-writer-agent 또는 product-detail-page-writer-agent ──
    let agentName;
    if (requestType === "intro") {
      agentName = "product-intro-writer-agent";
    } else if (requestType === "detail") {
      agentName = "product-detail-page-writer-agent";
    } else {
      agentName = "product-intro-writer-agent";
    }

    // ⭐ 브랜드 보이스 학습 캐시: 과거에 승인(APPROVED)된 콘텐츠를 few-shot 예시로 프롬프트에 주입
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

    console.log(`[Step 7] ${agentName} 호출... (videoType: ${videoType}, 참고 예시: ${approvedExamples.length}건)`);
    const contentResult = await callAgent(
      agentName,
      {
        category: metadata.categories?.[0] || "일반",
        character: characterNames,
        productName: finalProductName,
        productInfo: resource.product_info,
        keywords: resource.keywords || [],
        trendKeywords: metadata.trendKeywords || [],
        customStyle: metadata.customStyle || null,
        scenario: scenarioForContent,
        videoType,
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

    // contents 테이블에 초안 저장 (컴플라이언스는 아직 실행 전 → DRAFT)
    const contentDBResult = await callDatabase("contents", "create", {
      resource_id: resourceId,
      scenario_id: scenarioRow?.id || null,
      naming_id: namingRow.id,
      content_type: requestType === "intro" ? "intro" : "detail",
      generated_content: generatedContent,
      validation_status: "DRAFT",
      validation_score: null,
    });

    if (!contentDBResult.success) {
      console.error("[Step 7] contents 저장 실패");
      return res.status(500).json({ success: false, message: "콘텐츠 저장에 실패했습니다" });
    }

    return res.json({
      success: true,
      stage: "copy_review",
      resourceId,
      contentId: contentDBResult.rows?.[0]?.id || null,
      generatedContent,
    });
  } catch (error) {
    console.error("[POST /naming/confirm] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "네이밍 확정 중 오류가 발생했습니다" });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/generate/:resourceId/copy/:contentId/confirm
// 카피 검토/수정 확정 → Step 8(컴플라이언스) + Step 9(영상 생성) 실행
// ─────────────────────────────────────────────────────
router.post("/:resourceId/copy/:contentId/confirm", async (req, res) => {
  const { resourceId, contentId } = req.params;
  // ⭐ testMode: true면 Higgsfield(기본, 유료, 상업적 사용 가능) 대신 Kling(무료지만
  // 워터마크+비상업용)으로 영상을 생성한다 — Higgsfield 크레딧 소진 중에도 파이프라인
  // 연동/테스트를 계속하기 위한 용도이며, 절대 실제 마케팅 영상 대체용이 아니다.
  const { editedContent, testMode } = req.body;

  try {
    const contentResult = await callDatabase("contents", "read", null, { id: contentId });
    if (!contentResult.success || contentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "해당 콘텐츠를 찾을 수 없습니다" });
    }
    const contentRow = contentResult.rows[0];

    const resourceResult = await callDatabase("resources", "read", null, { id: resourceId });
    if (!resourceResult.success || resourceResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "해당 자료를 찾을 수 없습니다" });
    }
    const resource = resourceResult.rows[0];
    const metadata = resource.metadata || {};
    const generationSettings = metadata.generation_settings || {};
    const targetDuration = generationSettings.duration || 120;

    const finalContent = editedContent || contentRow.generated_content;
    const finalProductName = resource.product_name; // 실제 제품명은 항상 Step1 입력값 그대로

    if (editedContent) {
      await callDatabase("contents", "update", { generated_content: finalContent }, { id: contentId });
    }

    console.log(`[Step 7 확정] resourceId: ${resourceId}, 수정여부: ${!!editedContent}`);

    // ⭐ Hook 4 승인 기록: generation_logs에 마케터 승인 이력 저장
    await callDatabase("generation_logs", "create", {
      resource_id: resourceId,
      step: "product-intro-writer-agent",
      status: "approved_by_marketer",
      details: `Hook 4 승인: 카피 확정${editedContent ? ", 사용자 수정 반영" : ", AI 초안 그대로 승인"}`,
      attempt: 1,
    }).catch((e) => console.error("[Hook 4 로그 기록 실패]", e));

    // ── Step 8: compliance-reviewer-agent (검증) ──
    // ⭐ 멘토링 피드백 2: 카테고리별 규칙(compliance-rules.json)을 함께 전달해서
    //    카테고리에 맞는 기준으로만 판단하게 한다.
    const productCategory = metadata.categories?.[0] || "일반";
    const complianceRules = getComplianceRulesForCategory(productCategory);

    console.log(`[Step 8] compliance-reviewer-agent 호출... (카테고리: ${productCategory})`);
    const complianceResult = await callAgent(
      "compliance-reviewer-agent",
      {
        content: finalContent,
        category: productCategory,
        productName: finalProductName,
        complianceRules,
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

    // ⭐ 멘토링 피드백 1/5: 구조화된 응답(compliance_status/confidence/breakdown/violations)을
    //    그대로 사용하되, 기존 코드(브랜드 보이스 캐시 필터 등)와의 호환을 위해
    //    APPROVED/REJECTED 레거시 상태값도 함께 계산해서 유지한다.
    const complianceData = complianceResult.data || {};
    const complianceStatus = complianceData.compliance_status || "warning";
    const validationScore = complianceData.confidence ?? 0;
    const validationStatus = complianceStatus === "fail" ? "REJECTED" : "APPROVED";

    console.log(
      `[Step 8] 검증 결과: ${complianceStatus} (신뢰도: ${validationScore}, 위반 ${complianceData.violations?.length || 0}건)`
    );

    if (validationStatus === "REJECTED") {
      console.warn("⚠️ 컴플라이언스 검증 REJECTED - 그대로 진행");
    }

    // contents 업데이트 (validation_details에 구조화된 판단 근거 전체 보존)
    await callDatabase(
      "contents",
      "update",
      {
        validation_status: validationStatus,
        validation_score: validationScore,
        validation_details: complianceData,
      },
      { id: contentId }
    );

    // 선택된 캐릭터 재조회 (Higgsfield 호출에 필요, 여러 명일 수 있음)
    const charactersResult = await callDatabase("characters", "read", null, {
      resource_id: resourceId,
      selected: true,
    });
    if (!charactersResult.success || charactersResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "선택된 캐릭터를 찾을 수 없습니다" });
    }
    const selectedCharacters = charactersResult.rows;
    // ⭐ Higgsfield 영상 모델은 --start-image(첫 프레임 고정)를 캐릭터 1명 분량만 받을 수 있다.
    // 그래서 시각적 일관성(레퍼런스 이미지)은 "대표 캐릭터" 1명만 보장하고, 나머지 캐릭터는
    // 프롬프트 텍스트(이름+외형 묘사)로만 장면에 함께 등장하도록 반영한다.
    const primaryCharacter = selectedCharacters[0];
    const coCharacters = selectedCharacters.slice(1);
    const coCharacterDescriptions = coCharacters
      .map((c) => `${c.character_name}(${c.visual_description || "설명 없음"})`)
      .join(", ");

    // ── Step 9: 영상 생성 (기본 모드=Higgsfield / 테스트 모드=Kling) ──
    const isTestMode = !!testMode;
    console.log(
      `[Step 9] ${isTestMode ? "테스트 모드(Kling)" : "Higgsfield"} 영상 생성 요청... (대표 캐릭터: ${primaryCharacter.character_name}${coCharacters.length ? `, 공동출연: ${coCharacters.map((c) => c.character_name).join(", ")}` : ""})`
    );
    let videoUrl = null;
    let videosRowId = null;
    let higgsfieldError = null;

    // ⭐ 진행률 표시 버그 수정: callHiggsfield/callKlingVideo는 callAgent를 거치지 않아서
    // generation_logs에 아무 기록도 남기지 않았다 — 그래서 실제 영상 생성(최대 10분)이 진행되는
    // 동안 GET /status를 폴링해도 마지막 성공 기록이 Step 8(컴플라이언스, 몇 초짜리)에 멈춰
    // 있어서, 사용자 입장에선 가장 오래 걸리는 구간에서 아무 진행 표시도 없이 "멈춘 것처럼"
    // 보였다. 호출 직전에 in_progress 기록을 남겨서 폴링이 "지금 영상 생성 중"임을 알 수 있게 한다.
    await callDatabase("generation_logs", "create", {
      resource_id: resourceId,
      step: "higgsfield-video",
      status: "in_progress",
      attempt: 1,
      details: { testMode: isTestMode },
    }).catch((e) => console.error("[진행률 로그 기록 실패]", e));

    const higgsfieldResult = await generateVideo(
      {
        character: primaryCharacter.character_name,
        generatedContent: finalContent,
        voiceTone: primaryCharacter.voice_tone || "기본",
        visualDescription: coCharacterDescriptions
          ? `${primaryCharacter.visual_description || ""}, 함께 등장하는 캐릭터: ${coCharacterDescriptions}`
          : primaryCharacter.visual_description || "",
        // ⭐ 재현성: --start-image는 URL이 아니라 job id(generation_seed)를 받는다
        // (테스트 모드/Kling은 참조 이미지를 사용하지 않으므로 무시됨)
        referenceJobId: primaryCharacter.generation_seed || null,
        duration: targetDuration,
      },
      resourceId,
      contentId,
      { testMode: isTestMode }
    );

    if (higgsfieldResult.success) {
      videoUrl = higgsfieldResult.data.video_url;
      videosRowId = higgsfieldResult.data.videos_row_id;
      console.log(`[Step 9] 영상 생성 완료: ${videoUrl}`);
      await callDatabase("generation_logs", "create", {
        resource_id: resourceId,
        step: "higgsfield-video",
        status: "success",
        attempt: 1,
      }).catch((e) => console.error("[진행률 로그 기록 실패]", e));
    } else {
      higgsfieldError = higgsfieldResult.error || "Unknown error";
      console.warn(`[Step 9] Higgsfield 호출 실패: ${higgsfieldError}`);
      await callDatabase("generation_logs", "create", {
        resource_id: resourceId,
        step: "higgsfield-video",
        status: "fail",
        error_message: higgsfieldResult.message || higgsfieldError,
        error_code: higgsfieldResult.error || "UNKNOWN",
        attempt: 1,
        total_attempts: 1,
      }).catch((e) => console.error("[진행률 로그 기록 실패]", e));
    }

    // ── 최종 상태 업데이트 ──
    if (higgsfieldResult.success && videosRowId) {
      await callDatabase(
        "videos",
        "update",
        {
          generation_status: "completed",
          generation_progress: 100,
          video_url: videoUrl,
          character_reference_image_url: primaryCharacter.reference_image_url || null,
        },
        { id: videosRowId }
      ).catch((e) => console.error("[영상 상태 업데이트 실패]", e));

      // ⚠️ reference_image_url은 반드시 "이미지"여야 하므로 (Higgsfield --start-image 요구사항),
      // 방금 생성된 영상 URL을 여기서 자동으로 레퍼런스 이미지로 저장하지 않는다.
      // 레퍼런스 이미지는 오직 /api/characters/library/:id/generate-reference(이미지 모델 호출)를
      // 통해서만 설정된다. 여기서는 생성 횟수만 갱신한다.
      for (const character of selectedCharacters) {
        const characterUpdate = { generation_count: (character.generation_count || 0) + 1 };
        await callDatabase("characters", "update", characterUpdate, { id: character.id })
          .catch((e) => console.error("[캐릭터 생성 카운트 저장 실패]", e));

        if (character.library_character_id) {
          await callDatabase("character_library", "update", characterUpdate, {
            id: character.library_character_id,
          }).catch((e) => console.error("[라이브러리 생성 카운트 동기화 실패]", e));
        }
      }
    }

    // ── Step 10: post-generation-qa-agent (멘토링 피드백 3) ──
    // 텍스트 검수(Step 8) → 영상 생성(Step 9) → 생성 영상 검수(Step 10) 순서로 확장.
    // 영상이 실제로 생성됐을 때만 실행하며, 실패해도 파이프라인 자체는 막지 않는다
    // (Higgsfield 재호출 비용이 크므로 QA 실패는 경고로만 처리하고 결과는 그대로 반환).
    let qaResult = null;
    if (higgsfieldResult.success && videoUrl) {
      console.log("[Step 10] post-generation-qa-agent 호출...");
      const qaCallResult = await callAgent(
        "post-generation-qa-agent",
        {
          videoUrl,
          expectedDuration: targetDuration,
          character: primaryCharacter.character_name,
          referenceImageUrl: primaryCharacter.reference_image_url || null,
          generatedContent: finalContent,
        },
        { resourceId, step: "post-generation-qa" }
      );

      if (qaCallResult.success) {
        qaResult = qaCallResult.data;
        console.log(`[Step 10] QA 결과: ${qaResult.qa_status} (점수: ${qaResult.overall_score})`);

        if (!qaResult.qa_passed) {
          await callDatabase("generation_logs", "create", {
            resource_id: resourceId,
            step: "post-generation-qa",
            status: "QA_FAILED",
            details: qaResult,
          }).catch((e) => console.error("[QA 실패 로그 기록 실패]", e));
        }
      } else {
        console.warn("[Step 10] post-generation-qa-agent 호출 실패 - 결과 없이 진행");
      }
    }

    // ── 최종 응답 ──────────────────────────────
    console.log(`✅ POST /api/generate 완료`);

    return res.status(201).json({
      success: true,
      stage: "done",
      contentId,
      validationStatus,
      validationScore,
      complianceDetails: complianceData,
      duration: targetDuration,
      videoUrl: higgsfieldResult.success ? higgsfieldResult.data.video_url : null,
      videoStatus: higgsfieldResult.success ? "completed" : "failed",
      higgsfieldError: higgsfieldError,
      // ⭐ 테스트 모드(Kling)로 생성된 영상은 워터마크가 있고 상업적으로 사용할 수 없다 —
      // 프론트엔드는 이 값이 true면 반드시 경고 배너를 표시해야 한다.
      testMode: isTestMode,
      commercialUseAllowed: !isTestMode,
      qaResult,
    });
  } catch (error) {
    console.error("[POST /copy/confirm] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "카피 확정 중 오류가 발생했습니다" });
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
    // ⚠️ 같은 resourceId로 여러 번 재시도/재확정하면 같은 step이 여러 번 성공 기록을 남길 수 있다.
    // 전체 row 수를 그대로 세면 100%를 넘어가 버리므로, "성공한 서로 다른 step 이름의 개수"로 센다.
    const successCount = new Set(logs.filter((l) => l.status === "success").map((l) => l.step)).size;
    const failureCount = logs.filter((l) => l.status === "fail").length;
    const retryingCount = logs.filter((l) => l.status === "retrying").length;
    const totalSteps = 9; // Step 1~9

    // ⭐ Step 9(Higgsfield 영상 생성)는 최대 10분까지 걸리는데 callHiggsfield 자체는
    // callAgent를 거치지 않아 그동안 아무 로그도 안 남겼다 — 지금은 호출 직전에 "in_progress"
    // 기록을 남기므로(POST /copy/:contentId/confirm), 그 기록이 아직 success/fail로
    // 마무리되지 않았다면 "지금 이 단계가 진행 중"이라고 프론트에 알려준다.
    const activeStep = [...logs]
      .filter((l) => l.status === "in_progress")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const isActiveStepResolved =
      activeStep &&
      logs.some(
        (l) =>
          l.step === activeStep.step &&
          (l.status === "success" || l.status === "fail") &&
          new Date(l.created_at) >= new Date(activeStep.created_at)
      );
    const inProgressStep =
      activeStep && !isActiveStepResolved
        ? {
            step: activeStep.step,
            started_at: activeStep.created_at,
            elapsed_ms: Date.now() - new Date(activeStep.created_at).getTime(),
          }
        : null;

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
      progress: Math.min(100, Math.round((successCount / totalSteps) * 100)),
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
      // 지금 실제로 실행 중인 단계(주로 Step 9 영상 생성) — 경과 시간 표시용
      ...(inProgressStep && { inProgressStep }),
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
//
// ⚠️ 참고: Step5/6/7 사람 검토가 도입되면서 /start는 이제 시나리오 검토 단계에서
// 멈춘다. 배치 큐에 넣은 자료들도 각자 시나리오 검토 화면부터 사람이 이어서 진행해야 한다.
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
        console.log(`  ↳ ${resourceId} 큐에 추가됨`);

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
            console.log(`    ✅ ${resourceId} 시나리오 초안 생성 완료 (검토 대기):`, data.success);
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
      message: "모든 자료가 생성 큐에 추가되었습니다. 각 자료는 시나리오 검토부터 사람이 이어서 진행해야 합니다.",
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

    const logsResult = await callDatabase("generation_logs", "read", null, {
      resource_id: resourceId,
    });

    if (logsResult.success && logsResult.rows.length > 0) {
      const lastLog = logsResult.rows[0];
      console.log(
        `  마지막 상태: Step ${lastLog.step} - ${lastLog.status}`
      );
    }

    await callDatabase("generation_logs", "create", {
      resource_id: resourceId,
      step: stepNum,
      status: "retrying",
      details: `Step ${stepNum}부터 재시도 시작`,
    });

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
// POST /api/generate/character
//
// CHARACTER_GENERATION_SYSTEM_PROMPT.md 스펙: 캐릭터별 중앙 설정(characters.json)을
// 기준으로 "귀여움/디테일/일관성"을 AI가 직접 평가해서 기준(85점) 미달이면
// 자동으로 개선된 프롬프트로 재시도(최대 3회)하고, 확정된 결과를 버전으로 기록한다.
//
// ⚠️ 비용 최적화: 문서는 재시도마다 영상을 생성하는 것으로 되어 있으나, 영상 생성은
// 회당 비용/시간이 크다. 재시도는 훨씬 저렴한 레퍼런스 "이미지" 생성을 대상으로 돌리고,
// 확정된 레퍼런스 이미지를 영상 생성 1회에 재사용한다 — 이미 확정된 버전이 있으면
// (forceRefine이 없는 한) 재평가 없이 그 버전을 그대로 재사용해 일관성을 지킨다.
//
// body: { characterId, resourceId?, versionOverride?, videoType?, duration?, forceRefine? }
// ─────────────────────────────────────────────────────
router.post("/character", async (req, res) => {
  const { characterId, resourceId, versionOverride, videoType, duration, forceRefine, maxRetries, testMode } = req.body || {};

  if (!characterId) {
    return res.status(400).json({ success: false, message: "characterId가 필요합니다" });
  }

  // ⭐⭐ 이 라우트는 config/config.json에 고정 등록된 8개 기본 캐릭터만 다룬다(id 1~8) —
  // 즉 여기서 다루는 캐릭터는 항상 "기본 캐릭터"다. 기본 캐릭터는 브랜드의 고정 자산이라
  // 절대 리파인(AI가 프롬프트를 자유롭게 다시 써서 반복 생성)으로 매번 다른 모습이 되면
  // 안 된다 — 리파인은 기업이 새로 만들어서 라이브러리에 저장한 커스텀 캐릭터
  // (character_library, is_base_character=false)에만 적용되어야 한다.
  if (forceRefine) {
    return res.status(400).json({
      success: false,
      message: "기본 캐릭터는 리파인할 수 없습니다. 기본 캐릭터의 시각적 일관성을 위해 고정된 프롬프트만 사용합니다. 새로 만든 커스텀 캐릭터를 리파인하려면 다른 기능을 이용하세요.",
      code: "BASE_CHARACTER_REFINE_BLOCKED",
    });
  }

  try {
    const refData = getCharacterReferenceData(characterId, versionOverride);
    if (!refData.success) {
      return res.status(404).json({ success: false, message: refData.message });
    }
    const character = refData.character;

    let referenceImageUrl = refData.referenceImageUrl;
    let referenceJobId = null;
    let currentVersion = refData.version;
    let latestEvaluation = null;
    let attempts = [];

    // ⚠️ forceRefine은 위에서 이미 차단했다 — 여기서는 기본 캐릭터가 애초에 레퍼런스
    // 이미지가 없는 예외 상황(최초 셋업 등)만 처리한다. 이 경우에도 AI 평가 재시도 루프
    // (refineCharacterImage)는 쓰지 않고, 고정된 higgsfieldPrompt 그대로 1회만 생성한다
    // (평가자가 프롬프트를 다시 쓰게 두면 기본 캐릭터 디자인이 브리프에서 벗어날 수 있음).
    const needsBootstrap = !currentVersion || !referenceImageUrl;

    if (needsBootstrap) {
      console.log(`[character-bootstrap] ${character.name} 기본 캐릭터 최초 레퍼런스 이미지 생성 (AI 재작성 없이 고정 프롬프트 그대로 1회 생성)`);

      const genResult = await generateImageFromPrompt(character.higgsfieldPrompt);

      if (!genResult.success) {
        return res.status(502).json({
          success: false,
          message: "캐릭터 이미지 생성에 실패했습니다",
          detail: genResult,
        });
      }

      referenceImageUrl = genResult.image_url;
      referenceJobId = genResult.image_job_id;

      currentVersion = nextVersion(currentVersion);
      updateCharacterVersion(character.id, currentVersion, "최초 레퍼런스 이미지 생성 (고정 프롬프트)", referenceImageUrl, null);

      // ⚠️ 중요: 캐릭터 선택 화면(CharacterCreator.jsx)과 실제 영상 생성(Step9,
      // callHiggsfield --start-image)은 characters.json이 아니라 character_library
      // DB 테이블의 reference_image_url/generation_seed를 읽는다. characters.json만
      // 갱신하면 화면과 실제 영상 생성 둘 다 리파인 이전의 옛 이미지를 계속 쓰게 되므로,
      // 같은 이름의 character_library 행도 함께 갱신해서 두 시스템을 동기화한다.
      const syncResult = await callDatabase(
        "character_library",
        "update",
        { reference_image_url: referenceImageUrl, generation_seed: referenceJobId },
        { character_name: character.name }
      );
      if (!syncResult.success || syncResult.rows.length === 0) {
        console.warn(`[character-refinement] character_library 동기화 실패/대상 없음: ${character.name}`);
      }
    }

    // 영상까지 요청된 경우, 확정된 레퍼런스 이미지를 --start-image로 재사용해서 1회만 생성한다.
    // (testMode=true면 Higgsfield 대신 Kling 사용 — /copy/:contentId/confirm과 동일한 분기)
    let videoResult = null;
    const isTestMode = !!testMode;
    if (resourceId && videoType) {
      videoResult = await generateVideo(
        {
          character: character.name,
          generatedContent: character.description,
          voiceTone: (character.personalityKeywords || []).join(", "),
          visualDescription: character.higgsfieldPrompt,
          referenceJobId,
          duration: duration || 15,
        },
        resourceId,
        null,
        { testMode: isTestMode }
      );
    }

    const finalData = getCharacterReferenceData(character.id);
    const cuteness = latestEvaluation?.scores?.cutenessScore;
    const overall = latestEvaluation?.scores?.overallScore;

    return res.status(201).json({
      success: true,
      characterId: character.id,
      characterName: character.name,
      currentVersion: finalData.character.currentVersion,
      referenceImageUrl: finalData.character.referenceImageUrl,
      videoUrl: videoResult?.success ? videoResult.data.video_url : null,
      higgsfieldError: videoResult && !videoResult.success ? videoResult.message : null,
      testMode: isTestMode,
      commercialUseAllowed: !isTestMode,
      cutenessMessage:
        cuteness == null
          ? "기존 확정 버전을 그대로 사용했습니다 (일관성 유지)"
          : cuteness >= 85
          ? "정말 귀여워요! 누구나 사랑할 만한 매력이 있어요 ❤️"
          : "귀여움 기준에 아직 못 미쳐서 다음 개선이 필요해요",
      overallScore: overall ?? null,
      refinementFeedback: latestEvaluation
        ? {
            cutenessScore: latestEvaluation.scores?.cutenessScore,
            cutenessDetails: latestEvaluation.feedback?.cutenessStrengths,
            detailScore: latestEvaluation.scores?.detailScore,
            detailDetails: latestEvaluation.feedback?.detailStrengths,
            consistencyScore: latestEvaluation.scores?.consistencyScore,
            consistencyDetails: latestEvaluation.feedback?.consistencyStrengths,
          }
        : null,
      attempts: attempts.map((a) => ({
        attempt: a.attempt,
        imageUrl: a.imageUrl,
        scores: a.scores,
      })),
      versionHistory: finalData.character.versionHistory,
      nextVersionSuggestion:
        latestEvaluation?.recommendedChanges?.length
          ? `${nextVersion(currentVersion)} (${latestEvaluation.recommendedChanges[0]})`
          : null,
    });
  } catch (error) {
    console.error("[POST /api/generate/character] 예외 발생:", error);
    return res.status(500).json({ success: false, message: "캐릭터 생성/평가 중 오류가 발생했습니다" });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/generate/character/:characterId
// 캐릭터의 버전 이력(캐릭터 진화 보기) 조회
// ─────────────────────────────────────────────────────
router.get("/character/:characterId", async (req, res) => {
  const refData = getCharacterReferenceData(req.params.characterId, req.query.version);
  if (!refData.success) {
    return res.status(404).json({ success: false, message: refData.message });
  }
  return res.json({
    success: true,
    character: refData.character,
    version: refData.version,
    referenceImageUrl: refData.referenceImageUrl,
  });
});

// ─────────────────────────────────────────────────────
// GET /api/generate/characters
// 캐릭터 라이브러리 전체(중앙 설정) 조회 — 캐릭터 선택 화면용
// ─────────────────────────────────────────────────────
router.get("/characters", async (req, res) => {
  const { loadCharactersFile } = require("../services/character-consistency");
  try {
    const data = loadCharactersFile();
    return res.json({ success: true, characters: data.characters });
  } catch (error) {
    return res.status(500).json({ success: false, message: "캐릭터 목록 조회에 실패했습니다" });
  }
});

// ─────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────

module.exports = router;

// POST /api/generate/scenario
router.post("/scenario", async (req, res) => {
  const { resourceId, characterId, scenarioTitle, storyContent, scenarioJson, targetDurationSeconds } = req.body;
  if (!resourceId || !characterId) return res.status(400).json({ success: false, message: "resourceId와 characterId 필요" });
  const targetDuration = targetDurationSeconds || 60;
  try {
    const resourceResult = await callDatabase("resources", "read", null, { id: resourceId });
    if (!resourceResult.success || !resourceResult.rows.length) return res.status(404).json({ success: false, message: "자료 없음" });
    const scenario = { title: scenarioTitle || "시나리오", content: storyContent || "", acts: scenarioJson || [{ scene: 1, dialogue: "안녕하세요", duration: targetDuration }], character_name: characterId };
    res.json({ success: true, scenarioId: "test-" + Date.now(), scenario, stage: "scenario_review", message: "시나리오 생성됨" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
