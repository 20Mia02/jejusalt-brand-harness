/**
 * backend/services/character-consistency.js
 *
 * CHARACTER_GENERATION_SYSTEM_PROMPT.md 스펙 구현.
 * backend/config/characters.json을 단일 소스로 캐릭터의 현재(또는 특정) 버전과
 * 버전 이력을 읽고 쓴다.
 *
 * ⚠️ characters.json은 코드베이스에 커밋되는 설정 파일이라, 매 요청마다 디스크에
 * 다시 쓰는 건 배포 환경(서버리스/읽기전용 파일시스템 등)에서 위험할 수 있다.
 * 지금은 로컬 단일 서버 실행을 가정하고 파일에 직접 반영한다 — 여러 인스턴스로
 * 스케일하게 되면 이 저장소를 DB(character_library 테이블 등)로 옮겨야 한다.
 */

const fs = require("fs");
const path = require("path");

const CHARACTERS_PATH = path.join(__dirname, "../config/characters.json");

function loadCharactersFile() {
  const raw = fs.readFileSync(CHARACTERS_PATH, "utf8");
  return JSON.parse(raw);
}

function saveCharactersFile(data) {
  fs.writeFileSync(CHARACTERS_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
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
      referenceImageUrl: character.referenceImageUrl,
      promptTemplate: character.higgsfieldPromptTemplate,
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
    promptTemplate: historyEntry.prompt || character.higgsfieldPromptTemplate,
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
  character.referenceImageUrl = newReferenceImageUrl;

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
