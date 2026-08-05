/**
 * backend/routes/characters.js
 *
 * 캐릭터 라이브러리 (기본 캐릭터 풀) 관리
 *
 * 배경: config.json의 characters(결이, 용암이, 해수, 미내, 현무, 가마할방, 불이, 한라)는
 * "기본 캐릭터"로서 어떤 자료에서도 재사용 가능해야 한다. 이 라우트는:
 *   1. 기본 캐릭터 목록 조회 (config 기반 시드 + 이후 추가된 캐릭터)
 *   2. 사용자가 원하는 방향성을 입력하면 AI로 새 캐릭터 생성
 *   3. 생성된 캐릭터를 라이브러리에 영구 추가 (다음에도 재사용)
 *   4. 라이브러리에서 캐릭터 삭제
 *   5. 라이브러리 캐릭터를 특정 자료(resource)에 연결(선택) — reference_image_url 등
 *      재현성 정보를 그대로 복사해서, 다른 자료에서도 같은 캐릭터는 같은 스타일 유지
 *   6. 재현성 자체 테스트: 같은 캐릭터를 N번 조회해도 프로필이 흔들리지 않는지 확인
 *
 * 저장: database-agent의 callDatabase를 그대로 사용한다. Supabase가 설정되어 있으면 실제 DB,
 * 없으면(placeholder) database-agent 내부의 통합 Mock DB(인메모리)로 자동 전환된다.
 * → 이 파일에는 별도의 mock 분기/폴백을 두지 않는다 (단일 소스 오브 트루스).
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const { callAgent, generateCharacterReferenceImage } = require("../agents/backend-agent");
const { callDatabase } = require("../agents/database-agent");

// v3 설계 시스템 config 로드
let config = {};
try {
  config = require(path.join(__dirname, "../../config.json"));
} catch (err) {
  console.warn("⚠️  config.json을 찾을 수 없습니다. 기본값 사용:", err.message);
  config = { characters: [] };
}

// ─────────────────────────────────────────────
// GET /api/characters/library — 전체 라이브러리 조회
// v3 설계 시스템: config.json의 캐릭터를 기본값으로 포함
// ─────────────────────────────────────────────
router.get("/library", async (req, res) => {
  try {
    // 1단계: config.json의 v3 기본 캐릭터 로드 및 필드 변환
    const baseCharacters = (config.characters || []).map(char => ({
      // database 필드명으로 변환
      id: char.id,
      character_name: char.name,
      character_profile: char.visualIdentity,
      voice_tone: char.toneTrait || "",
      personality_traits: char.role ? [char.role] : [],
      is_base_character: true,
      generation_count: char.generation_count || 0,

      // v3 설계 데이터 포함 (프론트엔드에서 표시 가능하도록)
      gender: char.gender,
      ageGroup: char.ageGroup,
      type: char.type,
      role: char.role,
      toneTrait: char.toneTrait,
      bodyStructure: char.bodyStructure,
      genderExpression: char.genderExpression,
      animationNotes: char.animationNotes,
      symbolism: char.symbolism,
      visualIdentity: char.visualIdentity,
      higgsfieldPrompt: char.higgsfieldPrompt,
      reference_image_url: char.reference_image_url,
    }));

    // 2단계: 데이터베이스에서 추가 캐릭터 조회
    const result = await callDatabase("character_library", "read", null, {});

    let additionalCharacters = [];
    if (result.success && result.rows) {
      // 중복 제거: config의 캐릭터와 다른 것들만 추가
      const baseIds = new Set(baseCharacters.map(c => c.id || c.character_name));
      additionalCharacters = result.rows.filter(
        c => !baseIds.has(c.id || c.character_name)
      );
    }

    // 3단계: 기본 캐릭터 + 추가 캐릭터 합치기
    const allCharacters = [...baseCharacters, ...additionalCharacters];

    return res.json({
      success: true,
      characters: allCharacters,
      designSystemVersion: config.brand?.designSystemVersion || "v3",
      stats: {
        baseCharacters: baseCharacters.length,
        additionalCharacters: additionalCharacters.length,
        total: allCharacters.length
      }
    });
  } catch (error) {
    console.error("캐릭터 라이브러리 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "캐릭터 라이브러리 조회에 실패했습니다.",
      detail: error.message,
    });
  }
});

// ─────────────────────────────────────────────
// POST /api/characters/library — 새 캐릭터 생성 (수동 입력 또는 AI 생성) 후 라이브러리에 추가
//
// body:
//   { characterName, direction, useAI: true }              → AI가 direction(방향성)을 바탕으로 캐릭터 상세 생성
//   { useAI: true, surprise: true }                        → 이름/방향성 모두 AI가 알아서 창작 ("AI가 알아서 만들기")
//   { characterName, characterProfile, voiceTone, personalityTraits, useAI: false } → 수동 입력 그대로 저장
// ─────────────────────────────────────────────
router.post("/library", async (req, res) => {
  const { characterName, direction, useAI, surprise, characterProfile, voiceTone, personalityTraits } = req.body;

  if (!surprise && (!characterName || !characterName.trim())) {
    return res.status(400).json({
      success: false,
      message: "캐릭터 이름을 입력해주세요.",
    });
  }

  try {
    let newCharacter;

    if (useAI) {
      const effectiveDirection = surprise
        ? "브랜드 톤에 어울리는 매력적인 마스코트 캐릭터를 자유롭게 창작해주세요. 이름도 새로 지어주세요."
        : direction;

      if (!surprise && (!direction || direction.trim().length < 5)) {
        return res.status(400).json({
          success: false,
          message: "AI 생성을 위한 방향성 설명을 5자 이상 입력해주세요. (예: 유쾌하고 젊은 20대 여성)",
        });
      }

      // AI(TimelyAI/mock)로 캐릭터 상세 생성 — 사용자가 입력한 이름/방향성을 반영
      // surprise 모드에서는 characterName을 비워 보내 AI가 이름까지 창작하게 한다
      const result = await callAgent(
        "character-creator-agent",
        { characterName: surprise ? "" : characterName, direction: effectiveDirection, surprise: !!surprise },
        { step: "character-library-create" }
      );

      if (!result.success) {
        return res.status(502).json({
          success: false,
          message: "AI 캐릭터 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
          detail: result,
        });
      }

      const brief = result.data?.brief || {};
      newCharacter = {
        character_name: brief.character || characterName || "새 캐릭터",
        character_profile: brief.visual_description || effectiveDirection,
        voice_tone: brief.voice_tone || "",
        personality_traits: brief.personality_traits || [],
        visual_description: brief.visual_description || "",
        reference_image_url: null,
        generation_count: 0,
        source: "ai_generated",
      };
    } else {
      newCharacter = {
        character_name: characterName,
        character_profile: characterProfile || "",
        voice_tone: voiceTone || "",
        personality_traits: Array.isArray(personalityTraits)
          ? personalityTraits
          : (personalityTraits || "").split(",").map((t) => t.trim()).filter(Boolean),
        visual_description: characterProfile || "",
        reference_image_url: null,
        generation_count: 0,
        source: "user_created",
      };
    }

    const saved = await callDatabase("character_library", "create", newCharacter);

    if (!saved.success) {
      return res.status(500).json({
        success: false,
        message: "캐릭터 저장에 실패했습니다.",
        detail: saved,
      });
    }

    return res.status(201).json({ success: true, character: saved.rows[0] });
  } catch (error) {
    console.error("[POST /api/characters/library] 예외:", error);
    return res.status(500).json({
      success: false,
      message: "캐릭터 생성 중 오류가 발생했습니다.",
    });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/characters/library/:id — 라이브러리에서 캐릭터 제거
// (기본 캐릭터 포함 삭제 가능 — 사용자가 원하는 구성으로 자유롭게 관리)
// ─────────────────────────────────────────────
router.delete("/library/:id", async (req, res) => {
  const { id } = req.params;

  const result = await callDatabase("character_library", "delete", null, { id });

  if (!result.success || result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "해당 캐릭터를 찾을 수 없습니다.",
    });
  }

  return res.json({ success: true, message: "캐릭터가 라이브러리에서 삭제되었습니다." });
});

// ─────────────────────────────────────────────
// POST /api/characters/library/:id/use — 라이브러리 캐릭터를 특정 자료(resource)에 연결
//
// ⭐ 재현성 핵심: 라이브러리에 저장된 voice_tone/visual_description/reference_image_url을
// 그대로 복사해서 이 자료의 characters row를 만든다. 이렇게 하면:
//   - Step 4(character-designer-agent) 재호출 없이 기존 프로필을 바로 재사용 (동일 결과 보장)
//   - Step 9(Higgsfield) 첫 생성부터 레퍼런스 이미지가 있어 다른 자료에서도 동일 스타일 유지
//
// body: { resourceId }
// ─────────────────────────────────────────────
router.post("/library/:id/use", async (req, res) => {
  const { id } = req.params;
  const { resourceId } = req.body;

  if (!resourceId) {
    return res.status(400).json({ success: false, message: "resourceId가 필요합니다." });
  }

  const libResult = await callDatabase("character_library", "read", null, { id });
  if (!libResult.success || libResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "라이브러리 캐릭터를 찾을 수 없습니다." });
  }
  const lib = libResult.rows[0];

  // 이 자료의 기존 캐릭터들은 선택 해제
  const existing = await callDatabase("characters", "read", null, { resource_id: resourceId });
  if (existing.success) {
    await Promise.all(
      existing.rows
        .filter((c) => c.selected)
        .map((c) => callDatabase("characters", "update", { selected: false }, { id: c.id }))
    );
  }

  // 라이브러리 프로필을 그대로 복사해서 이 자료의 캐릭터로 생성 (재현성 유지)
  const created = await callDatabase("characters", "create", {
    resource_id: resourceId,
    character_name: lib.character_name,
    character_profile: lib.character_profile,
    voice_tone: lib.voice_tone,
    personality_traits: lib.personality_traits,
    visual_description: lib.visual_description,
    reference_image_url: lib.reference_image_url || null,
    generation_count: lib.generation_count || 0,
    library_character_id: lib.id,
    is_base_character: lib.source === "default",
    selected: true,
  });

  if (!created.success) {
    return res.status(500).json({ success: false, message: "캐릭터 연결에 실패했습니다.", detail: created });
  }

  return res.status(201).json({ success: true, character: created.rows[0] });
});

// ─────────────────────────────────────────────
// GET /api/characters/library/:id — 특정 캐릭터 상세 조회
// v3 설계 시스템: config.json의 캐릭터 우선 반환
// ─────────────────────────────────────────────
router.get("/library/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1단계: config.json에서 찾기
    const configCharacter = config.characters?.find(
      c => String(c.id) === String(id) || c.name === id
    );

    if (configCharacter) {
      return res.json({
        success: true,
        character: configCharacter,
        source: "config-v3",
        designSystemVersion: config.brand?.designSystemVersion || "v3"
      });
    }

    // 2단계: 데이터베이스에서 찾기
    const result = await callDatabase("character_library", "read", null, { id });

    if (!result.success || !result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "해당 캐릭터를 찾을 수 없습니다.",
      });
    }

    return res.json({
      success: true,
      character: result.rows[0],
      source: "database"
    });
  } catch (error) {
    console.error("캐릭터 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "캐릭터 조회에 실패했습니다.",
      detail: error.message,
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/characters/library/:id/consistency-check?rounds=3
//
// ⭐ 재현성 자체 테스트: 같은 캐릭터를 N번 반복 조회해서
// voice_tone/visual_description/personality_traits가 매번 동일하게 나오는지 확인.
// (라이브러리에 저장된 프로필을 "재사용"하는 구조이므로, AI를 매번 다시 호출하지 않는 한
//  항상 동일해야 정상 — 이 엔드포인트는 그 보장을 눈으로 확인시켜주는 용도)
// ─────────────────────────────────────────────
router.get("/library/:id/consistency-check", async (req, res) => {
  const { id } = req.params;
  const rounds = Math.min(parseInt(req.query.rounds) || 3, 10);

  const snapshots = [];
  for (let i = 0; i < rounds; i++) {
    const result = await callDatabase("character_library", "read", null, { id });
    if (!result.success || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "해당 캐릭터를 찾을 수 없습니다." });
    }
    const c = result.rows[0];
    snapshots.push({
      round: i + 1,
      voice_tone: c.voice_tone,
      visual_description: c.visual_description,
      personality_traits: c.personality_traits,
    });
  }

  const first = JSON.stringify(snapshots[0]);
  const consistent = snapshots.every((s) => JSON.stringify({ ...s, round: 0 }) === JSON.stringify({ ...JSON.parse(first), round: 0 }));

  await callDatabase("generation_logs", "create", {
    resource_id: null,
    step: "consistency-check",
    status: consistent ? "success" : "fail",
    error_message: consistent ? null : "반복 조회 결과가 서로 다릅니다",
    attempt: rounds,
  }).catch(() => {});

  return res.json({
    success: true,
    characterId: id,
    rounds,
    consistent,
    snapshots,
    message: consistent
      ? `✅ ${rounds}회 반복 조회 결과가 모두 동일합니다 (일관성 확인됨)`
      : `⚠️ ${rounds}회 반복 조회 결과가 서로 다릅니다 (일관성 문제 발견)`,
  });
});

// ─────────────────────────────────────────────
// POST /api/characters/library/:id/generate-reference
//
// 라이브러리 캐릭터의 레퍼런스 영상(이미지)을 실제로 1회 생성해서 영구 저장한다.
// - visual_description이 없으면 먼저 character-creator-agent로 채운다
//   (이때 표절 방지 지침이 시스템 프롬프트에 항상 포함됨)
// - Higgsfield로 실제 레퍼런스 생성 (실제 크레딧 소모)
// - reference_image_url / image_generated_at / generation_count(=1)을 저장
//   이후 이 캐릭터를 쓰는 모든 자료는 이 레퍼런스를 그대로 재사용 (일관성 핵심)
//
// body: { forceRegenerateProfile?: boolean, direction?: string }
// ─────────────────────────────────────────────
router.post("/library/:id/generate-reference", async (req, res) => {
  const { id } = req.params;
  const { direction, forceRegenerateProfile, referencePrompt } = req.body || {};

  const libResult = await callDatabase("character_library", "read", null, { id });
  if (!libResult.success || libResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "해당 캐릭터를 찾을 수 없습니다." });
  }
  let lib = libResult.rows[0];

  try {
    // 1) 시각적 묘사가 없거나, forceRegenerateProfile로 재생성을 요청한 경우 다시 채운다
    //    (표절 방지 지침이 항상 포함된 프롬프트 사용)
    if (!lib.visual_description || forceRegenerateProfile) {
      const designResult = await callAgent(
        "character-creator-agent",
        {
          characterName: lib.character_name,
          direction: direction || `${lib.role || ""} ${lib.tone_trait || ""}`.trim(),
        },
        { step: "character-library-backfill" }
      );

      if (!designResult.success) {
        return res.status(502).json({
          success: false,
          message: "캐릭터 프로필 생성에 실패했습니다.",
          detail: designResult,
        });
      }

      const brief = designResult.data?.brief || {};
      const updated = await callDatabase(
        "character_library",
        "update",
        {
          voice_tone: brief.voice_tone || lib.voice_tone,
          personality_traits: brief.personality_traits || lib.personality_traits,
          visual_description: brief.visual_description,
          character_profile: brief.visual_description,
        },
        { id }
      );
      lib = updated.rows?.[0] || { ...lib, visual_description: brief.visual_description };
    }

    // 2) 실제 Higgsfield 레퍼런스 생성 (실제 크레딧 소모)
    //
    // ⚠️ 주의: AI가 만든 상세한 한국어 visual_description을 그대로 Higgsfield 프롬프트에
    // 쓰면 길고 복잡한 문장 때문에 콘텐츠 필터에 오탐(nsfw)으로 걸리는 경우가 있었다.
    // referencePrompt(짧고 안전한 영어 요약)가 주어지면 그것을 실제 생성에 사용하고,
    // 화면에 보여주는 상세 한국어 visual_description은 그대로 유지한다.
    const genResult = await generateCharacterReferenceImage({
      characterName: lib.character_name,
      voiceTone: lib.voice_tone,
      visualDescription: referencePrompt || lib.visual_description,
    });

    if (!genResult.success) {
      return res.status(502).json({
        success: false,
        message: "레퍼런스 생성(Higgsfield)에 실패했습니다.",
        detail: genResult,
      });
    }

    // 3) 결과를 라이브러리에 영구 저장 -> 앞으로 이 캐릭터를 쓰는 모든 자료가 재사용
    const finalUpdate = await callDatabase(
      "character_library",
      "update",
      {
        reference_image_url: genResult.video_url,
        image_generated_at: new Date().toISOString(),
        generation_count: (lib.generation_count || 0) + 1,
      },
      { id }
    );

    return res.json({ success: true, character: finalUpdate.rows?.[0] });
  } catch (error) {
    console.error(`[POST /api/characters/library/:id/generate-reference] 예외:`, error);
    return res.status(500).json({ success: false, message: "레퍼런스 생성 중 오류가 발생했습니다." });
  }
});

module.exports = router;
