const fs = require("fs");
const path = require("path");

let cachedConfig = null;

function loadConfig() {
  if (cachedConfig) return cachedConfig;

  const configPath = path.join(__dirname, "../../../config/config.json");

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
      // 사업 우선순위: 뷰티 > 헬스케어 > 식품 순으로 정렬 (프론트에서 이 순서를 우선순위 뱃지 기준으로 사용)
      categories: ["뷰티", "헬스케어", "식품"],
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
      characterStyleGuideline:
        "모든 캐릭터는 손가락 첫마디 크기, 머리 40~50%(표정 강조), 짧고 굵은 팔다리를 가진 스타성 높은 마스코트 스타일 - 실존하는 유명 캐릭터를 연상시키는 디자인은 절대 금지 (자세한 기준: docs/character-concept.md)",
      characterCommonMotif:
        "모든 캐릭터가 공유하는 눈 구조: 큰 검정 동공 + 좌상단 흰색 하이라이트 + 검은 테두리 (표정에 따라 ㄷ자/○/●/ㅜ로만 변형). 입 색상과 몸 형태(각진/유기적/곡선)는 소속 타입(SALT/LAVA/MINERAL/FIRE)에 따라 달라지며, 회전·손 제스처·고개 기울임 3가지 동작은 모든 캐릭터가 공통으로 가진다",
      characterTypeSystem: {
        SALT: {
          nameKr: "소금결정",
          symbol: "결정체, 순수함, 작지만 강함",
          colors: ["#00AEEF", "#0088CC"],
          shape: "기하학적, 각진 모서리",
          personality: "활발, 밝음, 에너지, 희망",
        },
        LAVA: {
          nameKr: "용암해수",
          symbol: "화산 활동, 40만 년, 깊이, 신뢰",
          colors: ["#0D1B2A", "#1A3A52"],
          shape: "유기적, 부드러운 곡선",
          personality: "신뢰감, 보호, 안정, 지혜",
        },
        MINERAL: {
          nameKr: "미네랄",
          symbol: "마그네슘, 자연미, 우아함, 프리미엄",
          colors: ["#6B4C9A", "#008B8B"],
          shape: "세련된 곡선, 액세서리 강조",
          personality: "우아함, 배려, 정교함, 감정 깊이",
        },
        FIRE: {
          nameKr: "불/에너지",
          symbol: "열정, 변환, 함께함, 긍정",
          colors: ["#FF4500", "#FFD700", "#FF8C00"],
          shape: "역동적, 움직임 강조",
          personality: "에너지, 공유, 긍정, 격려",
        },
      },
      characterColorPalette: {
        primaryBlue: "#00AEEF",
        oceanDeep: "#003D7A",
        waveWhite: "#E6F7FF",
        saltCream: "#FFFEF9",
        saltGray: "#F5F5F5",
        lavaBlack: "#1A1A1A",
        volcanicGray: "#5A5A5A",
        hallasanGreen: "#2D7A3E",
        earthBrown: "#8B6F47",
        sandyBeige: "#E8D4B8",
        mineralPurple: "#6B4C9A",
        mineralTeal: "#008B8B",
        fireOrange: "#FF4500",
        fireYellow: "#FFD700",
      },
    },
    // 각 캐릭터 상세 설계 근거: docs/character-concept.md
    characters: [
      {
        name: "결이",
        role: "당찬 소년",
        toneTrait: "도전적, 에너지 넘침",
        gender: "남성",
        ageGroup: "10대 초반",
        type: "SALT",
        visualIdentity:
          "밝은 파랑(#00AEEF) 정육면체 몸(모서리 약간 둥글게), 파란 모자 또는 뾰족한 소금결정 머리, 큰 검정 눈과 흰 하이라이트, 큰 웃음과 빨간 혀, 빨간 물방울 귀, 짧고 굵은 팔다리, 몸 모서리에 은은한 크리스탈 무늬",
      },
      {
        name: "용암이",
        role: "따뜻한 아버지",
        toneTrait: "신뢰감, 보호본능",
        gender: "남성",
        ageGroup: "40~50대",
        type: "LAVA+FIRE",
        visualIdentity:
          "둥근 몸에 각진 어깨, 진한 파랑(#0D1B2A), 검정/짙은 파란 머리, 따뜻한 갈색/어두운 눈, 넓은 가슴과 굵은 팔다리, 목에 스카프 또는 앞치마, 몸에 작은 불꽃 무늬",
      },
      {
        name: "해수",
        role: "우아한 자유로운 영혼",
        toneTrait: "경쾌함, 순수함",
        gender: "여성",
        ageGroup: "20~40대",
        type: "MINERAL",
        visualIdentity:
          "우아한 S자 곡선, 보라(#6B4C9A) 또는 청록(#008B8B), 길고 우아한 머리와 분홍 리본, 크고 반짝이는 초록/보라 눈, 귀걸이(별/다이아몬드)와 목걸이, 몸에 크리스탈 무늬",
      },
      {
        name: "미내",
        role: "포용적인 누나",
        toneTrait: "격려, 함께함, 활발함",
        gender: "여성",
        ageGroup: "10대 후반~20대",
        type: "SALT+FIRE",
        visualIdentity:
          "동그랗고 통통한 몸, 노랑(#FFD700) 또는 주황, 노랑/주황 머리와 리본, 크고 밝은 검정 눈, 짧고 통통한 팔다리, 몸에 불꽃 무늬",
      },
      {
        name: "현무",
        role: "신뢰로운 형 (묵직한 장인)",
        toneTrait: "신뢰성, 기술력",
        gender: "남성",
        ageGroup: "20~30대",
        type: "LAVA+SALT",
        visualIdentity:
          "각진 어깨, 튼튼한 몸, 다크 파랑(#1F3A52), 검정 짧은 머리, 묵직한 눈, 강하고 정확한 팔다리, 액세서리 없음, 몸에 기하학적 무늬",
      },
      {
        name: "가마할방",
        role: "제주 전통의 수호자 (포근한 할머니)",
        toneTrait: "정통성, 가치 전승, 따뜻함",
        gender: "여성",
        ageGroup: "60대 이상",
        type: "LAVA+FIRE",
        visualIdentity:
          "동그랗고 포근한 몸, 갈색(#8B4513), 흰/회색 머리, 따뜻하고 자상한 갈색 눈, 굵고 따뜻한 팔, 앞치마와 머리 위 흰 수건",
      },
      {
        name: "불이",
        role: "에너지의 화신",
        toneTrait: "활력, 긍정성",
        gender: "남성",
        ageGroup: "10대 후반~20대",
        type: "FIRE",
        visualIdentity:
          "각진 선, 역동적인 몸, 주황빨강(#FF4500), 빨강/주황/노랑 머리, 크고 반짝이는 검정 눈, 길고 강한 팔다리, 몸에 불꽃 흐르는 무늬",
      },
      {
        name: "한라",
        role: "신비로운 지혜자 (제주 자연의 상징)",
        toneTrait: "웅장함, 안정성, 신비로움",
        gender: "여성",
        ageGroup: "60대 이상",
        type: "LAVA",
        visualIdentity:
          "둥근 산 모양, 어두운 파랑(#1A3A52), 흰/회색 머리, 부드럽고 지혜로운 초록/밝은 파랑 눈, 이마에 주름, 목걸이 또는 스카프, 몸에 미세한 산 무늬",
      },
    ],
    generation: {
      videoDefaultDuration: 120,
      videoDefaultResolution: "720p",
      videoTypes: [
        "캐릭터소개",
        "제품스토리",
        "일상밥상",
        "브랜드스토리",
        "사용법",
        "고객후기",
        "이벤트/프로모션",
        "비하인드",
      ],
      retryAttempts: 3,
      retryBackoffMs: 1000,
    },
  };
}

function getConfig() {
  return loadConfig();
}

/**
 * 캐시를 비우고 config.json을 디스크에서 다시 읽는다. character-consistency.js처럼
 * 서버가 실행 중에 config.json에 직접 쓰는 코드가 있을 때, 그 다음 getConfig() 호출부터
 * 방금 쓴 내용이 반영되도록 쓴다 (안 부르면 서버 재시작 전까지 이전 캐시가 유지됨).
 */
function reloadConfig() {
  cachedConfig = null;
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
  reloadConfig,
  getBrandName,
  getBrandNameEnglish,
  getCharacters,
  getCharacterByName,
  getGenerationConfig,
  getApiEndpoints,
};
