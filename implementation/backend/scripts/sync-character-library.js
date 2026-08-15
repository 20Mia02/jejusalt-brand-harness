/**
 * backend/scripts/sync-character-library.js
 *
 * 일회성 마이그레이션: characters.json에 이미 리파인된 referenceImageUrl/
 * generation_seed를 character_library DB 테이블로 복사한다.
 * (앞으로는 POST /api/generate/character가 매번 자동으로 동기화하지만,
 * 이미 리파인해둔 8개는 이 스크립트로 한 번만 맞춰준다.)
 */
require("dotenv").config();
const path = require("path");
const { callDatabase } = require("../agents/database-agent");
const { loadCharactersFile } = require("../services/character-consistency");

async function main() {
  const data = loadCharactersFile();
  for (const character of data.characters) {
    if (!character.reference_image_url) {
      console.log(`[skip] ${character.name}: reference_image_url 없음`);
      continue;
    }
    const jobId = character.reference_image_url.match(/([0-9a-f-]{36})\.png/i)?.[1] || null;
    const result = await callDatabase(
      "character_library",
      "update",
      { reference_image_url: character.reference_image_url, generation_seed: jobId },
      { character_name: character.name }
    );
    console.log(
      `[${result.success && result.rows.length > 0 ? "OK" : "FAIL"}] ${character.name} → ${character.currentVersion} (job: ${jobId})`
    );
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
