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

const { callAgent } = require("../agents/backend-agent");
const { callDatabase } = require("../agents/database-agent");

// ─────────────────────────────────────────────
// GET /api/characters/library — 전체 라이브러리 조회
// ─────────────────────────────────────────────
router.get("/library", async (req, res) => {
  const result = await callDatabase("character_library", "read", null, {});

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: "캐릭터 라이브러리 조회에 실패했습니다.",
      detail: result,
    });
  }

  return res.json({ success: true, characters: result.rows });
});

// ─────────────────────────────────────────────
// POST /api/characters/library — 새 캐릭터 생성 (수동 입력 또는 AI 생성) 후 라이브러리에 추가
//
// body:
//   { characterName, direction, useAI: true }   → AI가 direction(방향성)을 바탕으로 캐릭터 상세 생성
//   { characterName, characterProfile, voiceTone, personalityTraits, useAI: false } → 수동 입력 그대로 저장
// ─────────────────────────────────────────────
router.post("/library", async (req, res) => {
  const { characterName, direction, useAI, characterProfile, voiceTone, personalityTraits } = req.body;

  if (!characterName || !characterName.trim()) {
    return res.status(400).json({
      success: false,
      message: "캐릭터 이름을 입력해주세요.",
    });
  }

  try {
    let newCharacter;

    if (useAI) {
      if (!direction || direction.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: "AI 생성을 위한 방향성 설명을 5자 이상 입력해주세요. (예: 유쾌하고 젊은 20대 여성)",
        });
      }

      // AI(TimelyAI/mock)로 캐릭터 상세 생성 — 사용자가 입력한 이름/방향성을 반영
      const result = await callAgent(
        "character-creator-agent",
        { characterName, direction },
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
        character_name: characterName,
        character_profile: brief.visual_description || direction,
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

module.exports = router;
