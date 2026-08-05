const fs = require("fs");
const path = require("path");

let cachedConfig = null;

function loadConfig() {
  if (cachedConfig) return cachedConfig;

  const configPath = path.join(__dirname, "../../config.json");

  if (!fs.existsSync(configPath)) {
    console.warn(
      `⚠️ config.json not found at ${configPath}, using defaults`
    );
    cachedConfig = getDefaultConfig();
    return cachedConfig;
  }

  try {
    const rawConfig = fs.readFileSync(configPath, "utf8");
    cachedConfig = JSON.parse(rawConfig);

    // Validate required fields
    if (!cachedConfig.brand) cachedConfig.brand = {};
    if (!cachedConfig.characters) cachedConfig.characters = [];
    if (!cachedConfig.generation) cachedConfig.generation = {};
    if (!cachedConfig.apiEndpoints) cachedConfig.apiEndpoints = {};

    // Substitute environment variables
    cachedConfig = substituteEnvVariables(cachedConfig);

    console.log("✅ config.json loaded successfully");
    return cachedConfig;
  } catch (err) {
    console.error(`❌ Error loading config.json: ${err.message}`);
    cachedConfig = getDefaultConfig();
    return cachedConfig;
  }
}

function substituteEnvVariables(obj) {
  const json = JSON.stringify(obj);
  const substituted = json.replace(/\$\{(\w+)\}/g, (match, envVar) => {
    return process.env[envVar] || match;
  });
  return JSON.parse(substituted);
}

function getDefaultConfig() {
  return {
    brand: {
      name: "제주소금",
      nameKorean: "제주도 라바 씨솔트",
      nameEnglish: "JEJU LAVA SEA SALT",
      description: "제주 청정 해역에서 채취한 천연 소금",
      // 사업 우선순위: 뷰티 > 헬스케어(웰스케어) > 식품 순으로 정렬 (프론트에서 이 순서를 우선순위 뱃지 기준으로 사용)
      categories: ["뷰티", "웰스케어", "식품"],
      targetAges: ["20~30대", "40~60대", "60대+"],
      targetAudience: ["개인", "가족", "단체", "관광객", "기업"],
      focus: ["신뢰", "기술", "건강", "감정", "자연", "감각", "연관"],
      voiceTone: "정직하고 따뜨한 제주",
      toneValues: [
        "정직함: 근거 없는 의학 표현 금지, 수치 기반 설명",
        "제주+기술: 70년 전통 기술과 제주 자연의 조합",
        "일상 속 함께함: 가족의 밥상, 따뜻함",
      ],
      absoluteNos: [
        "의료표현 (치료, 질병 치료 등)",
        "과도한 유행어",
        "자극적 비교 (가장 좋은, 유일무이 등)",
        "근거 없는 기술 과장",
      ],
    },
    characters: [
      { name: "결이", role: "당찬 소년", toneTrait: "도전적, 에너지 넘침" },
      { name: "용암이", role: "따뜨한 아버지", toneTrait: "신뢰감, 보호본능" },
      { name: "해수", role: "자유로운 영혼", toneTrait: "경쾌함, 순수함" },
      { name: "미내", role: "지혜로운 할머니", toneTrait: "안정감, 포용력" },
      { name: "현무", role: "묵직한 장인", toneTrait: "신뢰성, 기술력" },
      {
        name: "가마할방",
        role: "제주 전통의 수호자",
        toneTrait: "정통성, 가치 전승",
      },
      { name: "불이", role: "에너지의 화신", toneTrait: "활력, 긍정성" },
      { name: "한라", role: "제주 자연의 상징", toneTrait: "웅장함, 안정성" },
    ],
    generation: {
      videoDefaultDuration: 120,
      videoDefaultResolution: "720p",
      videoTypes: ["캐릭터소개", "제품스토리", "일상밥상"],
      retryAttempts: 3,
      retryBackoffMs: 1000,
    },
  };
}

function getConfig() {
  return loadConfig();
}

function getBrandName() {
  return getConfig().brand.nameKorean;
}

function getBrandNameEnglish() {
  return getConfig().brand.nameEnglish;
}

function getCharacters() {
  return getConfig().characters || [];
}

function getCharacterByName(name) {
  return getCharacters().find((c) => c.name === name);
}

function getGenerationConfig() {
  return getConfig().generation || {};
}

function getApiEndpoints() {
  return getConfig().apiEndpoints || {};
}

module.exports = {
  loadConfig,
  getConfig,
  getBrandName,
  getBrandNameEnglish,
  getCharacters,
  getCharacterByName,
  getGenerationConfig,
  getApiEndpoints,
};
