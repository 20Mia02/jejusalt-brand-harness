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
const fs = require("fs");

const { callAgent, generateCharacterReferenceImage } = require("../agents/backend-agent");
const { callDatabase } = require("../agents/database-agent");

// v3 설계 시스템 config 로드
let config = {};
try {
  config = require(path.join(__dirname, "../../../config/config.json"));
} catch (err) {
  console.warn("⚠️  config.json을 찾을 수 없습니다. 기본값 사용:", err.message);
  config = { characters: [] };
}

// ─────────────────────────────────────────────
// GET /api/characters/library — 전체 라이브러리 조회
// v3 설계 시스템: config.json의 캐릭터를 기본값으로 포함
// ─────────────────────────────────────────────
router.get("/library", async (req, res) => {
  // ⭐ 캐릭터 사진이 실제로 갱신됐는데도 브라우저가 이전 응답을 캐시해서 옛날 캐릭터로
  // 보이는 문제가 실사용자 테스트에서 발견됨 — 항상 최신 상태를 받도록 명시적으로 막는다.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    // 1단계: config.json의 v3 기본 캐릭터 로드 및 필드 변환 (이름으로 조회할 수 있도록 Map)
    const baseCharacterMap = new Map(
      (config.characters || []).map((char) => [
        char.name,
        {
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
          worldviewStory: char.worldviewStory,
          worldviewQuote: char.worldviewQuote,
          bodyStructure: char.bodyStructure,
          genderExpression: char.genderExpression,
          animationNotes: char.animationNotes,
          symbolism: char.symbolism,
          visualIdentity: char.visualIdentity,
          appearancePrompt: char.appearancePrompt,
          thumbnailStagingPrompt: char.thumbnailStagingPrompt,
          reference_image_url: char.reference_image_url,
          keyring_image_url: char.keyring_image_url || null,
        },
      ])
    );

    // 2단계: 데이터베이스에서 캐릭터 조회
    const result = await callDatabase("character_library", "read", null, {});
    const dbRows = result.success && result.rows ? result.rows : [];

    // ⭐ 중복 노출 버그 수정: config.json 기본 캐릭터와 DB(character_library)에 시드된
    // 동명의 캐릭터가 서로 다른 id를 가지고 있어(config는 1~8 정수, DB는 UUID) 기존
    // 중복 제거 로직(`baseIds.has(c.id || c.character_name)`)이 걸러내지 못하고 8개
    // 캐릭터가 전부 2개씩(총 16개) 노출되고 있었다. 실제로 모든 자료 생성 파이프라인
    // (routes/resources.js)은 DB 쪽만 읽으므로 DB가 진짜 소스이며, 오늘 8명 전원에게
    // 실제 Higgsfield 3D 마스코트 레퍼런스 이미지도 DB 쪽에 채워 넣었다. 반면 config.json
    // 쪽은 v3 설계 문서의 정적 스냅샷이라 사진이 없거나 옛날 2D 컨셉 스케치만 남아있을
    // 수 있다(예: 결이). 그래서 이름이 겹치면 DB 쪽 값(사진/생성이력)을 우선하되,
    // config.json에만 있는 v3 설계 메타데이터(higgsfieldPrompt, bodyStructure 등)는
    // 함께 병합해서 보존한다.
    const mergedByName = new Map();
    for (const row of dbRows) {
      const base = baseCharacterMap.get(row.character_name);
      mergedByName.set(row.character_name, base ? { ...base, ...row } : row);
    }
    // DB에 아직 한 번도 시드되지 않은 config 기본 캐릭터만 폴백으로 추가
    for (const [name, base] of baseCharacterMap) {
      if (!mergedByName.has(name)) mergedByName.set(name, base);
    }

    const allCharacters = Array.from(mergedByName.values());
    const baseCount = baseCharacterMap.size;

    return res.json({
      success: true,
      characters: allCharacters,
      designSystemVersion: config.brand?.designSystemVersion || "v3",
      stats: {
        baseCharacters: baseCount,
        additionalCharacters: allCharacters.length - baseCount,
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

  // ⭐ 멀티 캐릭터 지원: 이 자료의 기존 선택된 캐릭터를 해제하지 않는다 — 여러 캐릭터를
  // 동시에 라이브러리에서 가져와 함께 등장시킬 수 있어야 하기 때문이다.

  // 라이브러리 프로필을 그대로 복사해서 이 자료의 캐릭터로 생성 (재현성 유지)
  const created = await callDatabase("characters", "create", {
    resource_id: resourceId,
    character_name: lib.character_name,
    character_profile: lib.character_profile,
    voice_tone: lib.voice_tone,
    personality_traits: lib.personality_traits,
    visual_description: lib.visual_description,
    reference_image_url: lib.reference_image_url || null,
    generation_seed: lib.generation_seed || null,
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
    // ⭐ 버그 수정: 기본 8개 캐릭터는 config.json의 appearancePrompt(+thumbnailStagingPrompt)가
    // "일관성을 위한 확정 프롬프트"인데, 이 라우트가 읽는 character_library DB row에는
    // 그 필드가 없다(merge는 GET /library에서만 일어남) — referencePrompt를 매번 명시적으로
    // 넘기지 않으면 옛날 lib.visual_description(짧은 초안 문구)으로 조용히 생성돼버린다.
    // 그래서 base character면 config.json에서 직접 찾아 자동으로 조합한다.
    const baseConfigChar = lib.is_base_character
      ? (config.characters || []).find((c) => c.id === lib.id || c.name === lib.character_name)
      : null;
    const autoReferencePrompt =
      baseConfigChar?.appearancePrompt
        ? [baseConfigChar.appearancePrompt, baseConfigChar.thumbnailStagingPrompt].filter(Boolean).join(", ")
        : null;
    const finalReferencePrompt = referencePrompt || autoReferencePrompt;

    const genResult = await generateCharacterReferenceImage({
      characterName: lib.character_name,
      voiceTone: lib.voice_tone,
      visualDescription: finalReferencePrompt || lib.visual_description,
      // 완성된 프롬프트(appearancePrompt+thumbnailStagingPrompt)를 쓸 때는 공통 요소가
      // 이미 다 포함되어 있으므로 중복 삽입을 막는다.
      skipCommonRules: !!finalReferencePrompt,
    });

    if (!genResult.success) {
      return res.status(502).json({
        success: false,
        message: "레퍼런스 생성(Higgsfield)에 실패했습니다.",
        detail: genResult,
      });
    }

    // 3) 결과를 라이브러리에 영구 저장 -> 앞으로 이 캐릭터를 쓰는 모든 자료가 재사용
    // generation_seed: Higgsfield job id — 영상 생성 시 --start-image에 URL 대신 이 값을 넘겨야
    // 실제로 적용된다 (media 플래그는 원격 URL을 받지 않고 UUID/job id/로컬 경로만 받음)
    const finalUpdate = await callDatabase(
      "character_library",
      "update",
      {
        reference_image_url: genResult.image_url,
        generation_seed: genResult.image_job_id,
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

// ─────────────────────────────────────────────
// POST /api/characters/library/:id/set-reference — 레퍼런스 이미지를 직접 고정
//
// ⭐ 용도: 여러 번 재생성한 결과 중 사용자가 이미 마음에 든 특정 결과물(과거 생성본)을
// "이걸로 최종 확정"하고 싶을 때, 다시 생성하지 않고 그 이미지/시드를 그대로 저장한다.
// body: { referenceImageUrl: string, generationSeed?: string }
// ─────────────────────────────────────────────
router.post("/library/:id/set-reference", async (req, res) => {
  const { id } = req.params;
  const { referenceImageUrl, generationSeed } = req.body || {};

  if (!referenceImageUrl) {
    return res.status(400).json({ success: false, message: "referenceImageUrl이 필요합니다." });
  }

  const libResult = await callDatabase("character_library", "read", null, { id });
  if (!libResult.success || libResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "해당 캐릭터를 찾을 수 없습니다." });
  }
  const lib = libResult.rows[0];

  const finalUpdate = await callDatabase(
    "character_library",
    "update",
    {
      reference_image_url: referenceImageUrl,
      generation_seed: generationSeed || lib.generation_seed || null,
      image_generated_at: new Date().toISOString(),
      generation_count: (lib.generation_count || 0) + 1,
    },
    { id }
  );

  return res.json({ success: true, character: finalUpdate.rows?.[0] });
});

// ─────────────────────────────────────────────
// POST /api/characters/library/:id/set-keyring-image — 인형 키링 버전 이미지 고정
//
// ⭐ 키링 인형 상품화용 별도 썸네일. character_library(실제 DB) 테이블에는
// keyring_image_url 컬럼이 없으므로(스키마 변경 없이 안전하게 추가하기 위해)
// DB에는 쓰지 않고, config.json에만 캐릭터 이름으로 매칭해서 저장한다.
// body: { keyringImageUrl: string }
// ─────────────────────────────────────────────
router.post("/library/:id/set-keyring-image", async (req, res) => {
  const { id } = req.params;
  const { keyringImageUrl } = req.body || {};

  if (!keyringImageUrl) {
    return res.status(400).json({ success: false, message: "keyringImageUrl이 필요합니다." });
  }

  const libResult = await callDatabase("character_library", "read", null, { id });
  if (!libResult.success || libResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "해당 캐릭터를 찾을 수 없습니다." });
  }
  const characterName = libResult.rows[0].character_name;

  const configChar = (config.characters || []).find((c) => c.name === characterName);
  if (!configChar) {
    return res.status(404).json({ success: false, message: "config.json에서 기본 캐릭터를 찾을 수 없습니다." });
  }

  configChar.keyring_image_url = keyringImageUrl;

  try {
    const configPath = path.join(__dirname, "../../../config/config.json");
    const raw = fs.readFileSync(configPath, "utf8");
    const usesCrlf = raw.includes("\r\n");
    const json = JSON.stringify(config, null, 2) + "\n";
    fs.writeFileSync(configPath, usesCrlf ? json.replace(/\n/g, "\r\n") : json, "utf8");
  } catch (err) {
    console.error("config.json 저장 실패:", err);
    return res.status(500).json({ success: false, message: "config.json 저장 중 오류가 발생했습니다." });
  }

  return res.json({
    success: true,
    character: { character_name: characterName, keyring_image_url: keyringImageUrl },
  });
});

module.exports = router;
