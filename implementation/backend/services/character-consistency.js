/**
 * backend/services/character-consistency.js
 *
 * CHARACTER_GENERATION_SYSTEM_PROMPT.md 스펙 구현.
 * config/config.json(Harness 요소 5: config, backend-agent.js의 buildVideoPromptText가
 * 영상 생성 프롬프트로 읽는 바로 그 파일)을 캐릭터 데이터의 단일 소스로 사용해서
 * 현재(또는 특정) 버전과 버전 이력을 읽고 쓴다.
 * (예전에는 backend/config/characters.json이 따로 있어서, 레퍼런스 이미지 생성에는
 * 이 파일의 영어 프롬프트가, 실제 영상 생성에는 config.json의 한국어 프롬프트가 쓰이는
 * 두 시스템으로 나뉘어 있었다 — 이미지와 영상이 서로 다른 프롬프트로 생성되니 당연히
 * 일관성이 떨어졌다. 이제 하나로 합쳐서 이미지 생성에 쓴 프롬프트가 곧 영상 생성에도
 * 그대로 쓰인다.)
 *
 * ⚠️ config.json은 코드베이스에 커밋되는 설정 파일이라, 매 요청마다 디스크에
 * 다시 쓰는 건 배포 환경(서버리스/읽기전용 파일시스템 등)에서 위험할 수 있다.
 * 지금은 로컬 단일 서버 실행을 가정하고 파일에 직접 반영한다 — 여러 인스턴스로
 * 스케일하게 되면 이 저장소를 DB(character_library 테이블 등)로 옮겨야 한다.
 *
 * ⭐ 이 파일이 다루는 버전 이력/리파인은 기본 8개 캐릭터 전용이 아니다 —
 * routes/generation.js의 POST /character가 base 캐릭터에는 리파인을 막고
 * character_library의 커스텀(저장된) 캐릭터에만 이 모듈을 쓰도록 게이트한다.
 */

const fs = require("fs");
const path = require("path");
const { reloadConfig } = require("../utils/config-loader");

const CHARACTERS_PATH = path.join(__dirname, "../../../config/config.json");

function loadCharactersFile() {
  const raw = fs.readFileSync(CHARACTERS_PATH, "utf8");
  return JSON.parse(raw);
}

function saveCharactersFile(data) {
  fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  // config-loader가 서버 프로세스 내내 config.json을 메모리에 캐싱하므로, 디스크에 쓴 직후
  // 캐시를 갱신하지 않으면 같은 요청/이후 요청에서 getConfig()가 여전히 예전 버전을 반환한다.
  reloadConfig();
}

/**
 * 캐릭터의 최신(또는 versionOverride로 지정된) 버전 정보를 로드한다.
 */
function getCharacterReferenceData(characterId, versionOverride) {
  const data = loadCharactersFile();
  const character = data.characters.find((c) => c.id === Number(characterId));
  if (!character) {
    return { success: false, message: `캐릭터 id ${characterId}를 찾을 수 없습니다` };
  }

  if (!versionOverride || versionOverride === character.currentVersion) {
    return {
      success: true,
      character,
      version: character.currentVersion,
      referenceImageUrl: character.reference_image_url,
      promptTemplate: character.higgsfieldPrompt,
    };
  }

  const historyEntry = (character.versionHistory || []).find((v) => v.version === versionOverride);
  if (!historyEntry) {
    return { success: false, message: `버전 ${versionOverride}을 찾을 수 없습니다` };
  }
  return {
    success: true,
    character,
    version: historyEntry.version,
    referenceImageUrl: historyEntry.referenceImageUrl,
    promptTemplate: historyEntry.prompt || character.higgsfieldPrompt,
  };
}

/**
 * 프롬프트에 버전/일관성 정보를 덧붙인다.
 * 예: "Reference v2.1, consistent with previous designs, signature color: #2C5282"
 */
function addVersionToPrompt(basePrompt, characterId, version) {
  const data = loadCharactersFile();
  const character = data.characters.find((c) => c.id === Number(characterId));
  const color = character?.colorPalette?.primary || "";
  const versionNote = version
    ? `Reference ${version}, must stay consistent with the previous design${color ? `, signature color: ${color}` : ""}`
    : "";
  return versionNote ? `${basePrompt}, ${versionNote}` : basePrompt;
}

/**
 * 새 버전을 확정하고 versionHistory에 기록한다.
 */
function updateCharacterVersion(characterId, newVersion, improvements, newReferenceImageUrl, scores) {
  const data = loadCharactersFile();
  const character = data.characters.find((c) => c.id === Number(characterId));
  if (!character) {
    return { success: false, message: `캐릭터 id ${characterId}를 찾을 수 없습니다` };
  }

  character.versionHistory = character.versionHistory || [];
  character.versionHistory.push({
    version: newVersion,
    date: new Date().toISOString().slice(0, 10),
    improvements: improvements || "",
    referenceImageUrl: newReferenceImageUrl,
    scores: scores || null,
  });
  character.currentVersion = newVersion;
  character.reference_image_url = newReferenceImageUrl;

  saveCharactersFile(data);
  return { success: true, character };
}

/**
 * 다음 버전 번호를 계산한다 (v1.0 → v1.1 → v2.0 규칙: 소폭 개선은 minor, 재설계는 major —
 * 여기서는 단순하게 minor만 증가시키고, 호출부가 필요하면 major를 명시적으로 넘길 수 있게 한다).
 */
function nextVersion(currentVersion, bumpMajor = false) {
  if (!currentVersion) return "v1.0";
  const match = /^v(\d+)\.(\d+)$/.exec(currentVersion);
  if (!match) return "v1.0";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return bumpMajor ? `v${major + 1}.0` : `v${major}.${minor + 1}`;
}

module.exports = {
  getCharacterReferenceData,
  addVersionToPrompt,
  updateCharacterVersion,
  nextVersion,
  loadCharactersFile,
};
