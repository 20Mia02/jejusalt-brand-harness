/**
 * 8개 기본 캐릭터의 레퍼런스 이미지(영상)를 실제 Higgsfield로 재생성해서
 * character_library에 영구 저장하는 부트스트랩 스크립트 (v2: 브랜드 색상 + 공통 시그니처 반영).
 *
 * v2 변경 사항:
 * - 실제 브랜드 CSS 팔레트(App.css)의 색상을 캐릭터 이름 의미에 맞게 1:1로 매칭
 *   (예: 해수→ocean-deep/wave-white, 한라→hallasan-green, 용암이→lava-black 등)
 * - 8개 전체가 공유하는 시그니처 요소를 명시: 알(egg) 모양 몸통, 이마의 소금 결정 브로치,
 *   단순한 점 눈 — "같은 회사 캐릭터"라는 게 한눈에 보이도록
 * - 저작권/표절 방지 지침 강화 (backend-agent.js의 character-creator-agent 프롬프트에 반영됨)
 * - forceRegenerateProfile: true 로 기존 프로필을 덮어쓰고 완전히 새로 생성
 *
 * 실행: node backend/scripts/bootstrap_library_references.js
 */

const http = require("http");

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path,
        method,
        headers: data
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data, "utf8") }
          : {},
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(b) });
          } catch (e) {
            resolve({ status: res.statusCode, body: b });
          }
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

// 공통 시그니처 (모든 캐릭터가 공유, 화면 표시용 한국어)
const COMMON_MOTIF_KO =
  "알(egg) 모양의 동글동글한 몸통, 이마 위에 작은 육각형 소금 결정 브로치(제주소금 시그니처), " +
  "단순한 검은 점 눈동자에 흰색 하이라이트 하나, 은은한 볼터치";

// 공통 시그니처 (실제 생성용, 짧은 영어)
const COMMON_MOTIF_EN =
  "egg-shaped round body, small hexagonal salt crystal gem on forehead, simple dot eyes with one white highlight, blush cheeks";

// 8개 기본 캐릭터 - 실제 브랜드 CSS 팔레트를 이름 의미에 맞게 1:1 매칭
// (App.css: primary-blue #00AEEF, ocean-deep #003D7A, wave-white #E6F7FF, salt-cream #FFFEF9,
//  salt-gray #F5F5F5, lava-black #1A1A1A, volcanic-gray #5A5A5A, hallasan-green #2D7A3E,
//  earth-brown #8B6F47, sandy-beige #E8D4B8)
const DIRECTIONS = {
  "결이": `${COMMON_MOTIF_KO}. 브랜드 시그니처 컬러인 프라이머리 블루(#00AEEF)를 몸통 메인 컬러로 사용, 화이트 포인트. 도전적이고 에너지 넘치는 느낌의 활기찬 포즈`,
  "용암이": `${COMMON_MOTIF_KO}. 라바 블랙(#1A1A1A) 몸통에 은은하게 빛나는 주황빛 균열 무늬. 든든하고 신뢰감 있는 따뜬한 표정`,
  "해수": `${COMMON_MOTIF_KO}. 오션 딥(#003D7A)과 웨이브 화이트(#E6F7FF)가 그라데이션으로 어우러진 몸통. 자유롭고 경쾌하며 순수한 느낌`,
  "미내": `${COMMON_MOTIF_KO}. 솔트 크림(#FFFEF9)과 솔트 그레이(#F5F5F5)의 부드러운 톤. 작은 동그란 안경. 지혜롭고 포근한 느낌`,
  "현무": `${COMMON_MOTIF_KO}. 볼케닉 그레이(#5A5A5A)에 라바 블랙 포인트. 각진 듯 든든한 몸통. 묵직하고 신뢰감 있는 느낌`,
  "가마할방": `${COMMON_MOTIF_KO}. 어스 브라운(#8B6F47)과 샌디 베이지(#E8D4B8) 톤. 전통 갓 모양의 작은 모자 장식. 근엄하지만 친근한 느낌`,
  "불이": `${COMMON_MOTIF_KO}. 라바 블랙 베이스에 밝게 빛나는 주황-노랑 균열 무늬가 강조된 몸통. 활력 넘치고 긍정적인 느낌`,
  "한라": `${COMMON_MOTIF_KO}. 할라산 그린(#2D7A3E) 몸통에 솔트 크림 화이트로 표현한 설산 산 모양 머리 장식. 웅장하면서도 안정적인 느낌`,
};

const REFERENCE_PROMPTS = {
  "결이": `cute mascot doll character, ${COMMON_MOTIF_EN}, bright cyan-blue body color (#00AEEF) with white accents, energetic cheerful pose, simple plain background`,
  "용암이": `cute mascot doll character, ${COMMON_MOTIF_EN}, deep charcoal black body color (#1A1A1A) with subtle glowing orange cracks, warm gentle expression, simple plain background`,
  "해수": `cute mascot doll character, ${COMMON_MOTIF_EN}, deep navy blue to icy white gradient body color (#003D7A to #E6F7FF), cheerful breezy expression, simple plain background`,
  "미내": `cute mascot doll character, ${COMMON_MOTIF_EN}, soft cream and light grey body color (#FFFEF9, #F5F5F5), small round glasses, gentle warm expression, simple plain background`,
  "현무": `cute mascot doll character, ${COMMON_MOTIF_EN}, slate grey body color (#5A5A5A) with dark charcoal accents, sturdy angular silhouette, calm expression, simple plain background`,
  "가마할방": `cute mascot doll character, ${COMMON_MOTIF_EN}, earthy brown and beige body color (#8B6F47, #E8D4B8), small traditional hat accessory, dignified friendly expression, simple plain background`,
  "불이": `cute mascot doll character, ${COMMON_MOTIF_EN}, dark charcoal body base with bright glowing orange-yellow cracks, energetic bright expression, simple plain background`,
  "한라": `cute mascot doll character, ${COMMON_MOTIF_EN}, deep forest green body color (#2D7A3E) with white mountain-peak shaped hair accessory, calm majestic expression, simple plain background`,
};

async function main() {
  const lib = await req("GET", "/api/characters/library");
  if (!lib.body.success) {
    console.error("라이브러리 조회 실패:", lib.body);
    process.exit(1);
  }

  const defaults = lib.body.characters.filter((c) => c.source === "default");
  console.log(`기본 캐릭터 ${defaults.length}개 대상 (브랜드 색상 반영 재생성, 기존 것 덮어씀)`);

  for (const char of defaults) {
    const direction = DIRECTIONS[char.character_name];
    const referencePrompt = REFERENCE_PROMPTS[char.character_name];
    console.log(`\n[재생성 시작] ${char.character_name} (id: ${char.id})`);
    console.log(`  방향성(표시용): ${direction || "(기본 role/tone_trait 사용)"}`);
    console.log(`  안전 프롬프트(생성용): ${referencePrompt || "(visual_description 그대로 사용)"}`);

    const startTime = Date.now();
    const result = await req("POST", `/api/characters/library/${char.id}/generate-reference`, {
      direction,
      referencePrompt,
      forceRegenerateProfile: true,
    });
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (result.body.success) {
      console.log(`[✓ 완료] ${char.character_name} (${elapsed}초)`);
      console.log(`  레퍼런스 URL: ${result.body.character?.reference_image_url}`);
    } else {
      console.error(`[✗ 실패] ${char.character_name}:`, JSON.stringify(result.body).slice(0, 300));
    }
  }

  console.log("\n=== 전체 부트스트랩(v2) 완료 ===");
}

main().catch((err) => {
  console.error("스크립트 예외:", err);
  process.exit(1);
});
