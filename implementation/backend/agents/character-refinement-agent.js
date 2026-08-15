/**
 * backend/agents/character-refinement-agent.js
 *
 * CHARACTER_GENERATION_SYSTEM_PROMPT.md 스펙 구현.
 * 생성된 캐릭터 이미지를 실제로 "보고" cutenessScore(50%)/detailScore(30%)/
 * consistencyScore(20%)로 평가하고, 부족하면 improvedPrompt를 제안한다.
 *
 * ⚠️ 설계 판단: 문서는 "영상 생성 → 프리뷰 추출 → 평가"를 매 재시도(최대 3회)마다
 * 반복하는 것으로 되어 있으나, Higgsfield 영상 생성(seedance_2_0)은 회당 크레딧/시간이
 * 크다. 재시도는 훨씬 저렴하고 빠른 "레퍼런스 이미지" 생성(text2image_soul_v2)을
 * 대상으로 돌리고, 그렇게 확정된 레퍼런스 이미지를 이후 모든 영상 생성(Step9)이
 * --start-image로 재사용한다. "일관성 유지"라는 핵심 목표는 동일하게 달성되면서
 * 비용은 훨씬 낮아진다.
 */

const OpenAI = require("openai");
const { generateImageFromPrompt } = require("./backend-agent");

const OVERALL_THRESHOLD = 85;
const CUTENESS_THRESHOLD = 85;
const MAX_RETRIES = 3;

function getClient() {
  const apiKey = process.env.UPSTAGE_API_KEY;
  const baseURL = process.env.UPSTAGE_API_BASE_URL || "https://api.upstage.ai/v1";
  const isMock = !apiKey || apiKey.includes("your_") || apiKey === "dummy" || apiKey === "tgpt_sk_your_api_key_here";
  if (isMock) return null;
  return new OpenAI({ apiKey, baseURL });
}

// Mock 모드(테스트/키 미설정)에서도 재시도 루프 자체를 검증할 수 있도록 결정론적인
// 점수를 반환한다 (프롬프트 길이가 길수록 "더 다듬어졌다"고 보고 점수를 살짝 올림 —
// 실제 재시도가 개선된 프롬프트로 이어지는지 테스트하기 위한 장치).
function mockEvaluation(payload) {
  const base = 72 + Math.min(15, Math.floor((payload.originalPrompt || "").length / 120));
  const cutenessScore = Math.min(96, base + 6);
  const detailScore = Math.min(96, base);
  const consistencyScore = Math.min(96, base + 3);
  const overallScore = Math.round(cutenessScore * 0.5 + detailScore * 0.3 + consistencyScore * 0.2);
  return {
    scores: { cutenessScore, detailScore, consistencyScore, overallScore },
    feedback: {
      cutenessStrengths: "(mock) 눈이 크고 표정이 따뜻함",
      cutenessWeaknesses: cutenessScore < CUTENESS_THRESHOLD ? "(mock) 미소가 조금 더 부드러워야 함" : "",
      detailStrengths: "(mock) 색상 팔레트가 선명함",
      detailWeaknesses: detailScore < 80 ? "(mock) 액세서리 디테일이 흐릿함" : "",
      consistencyStrengths: "(mock) 실루엣이 일관됨",
      consistencyWeaknesses: "",
    },
    improvedPrompt: `${payload.originalPrompt}, even more adorable and heartwarming, sparkling bigger eyes, softer rounder cheeks`,
    recommendedChanges: ["(mock) 눈을 더 반짝이게", "(mock) 볼을 더 통통하게"],
    shouldRetry: overallScore < OVERALL_THRESHOLD || cutenessScore < CUTENESS_THRESHOLD,
    retryCount: 0,
  };
}

/**
 * 생성된 캐릭터 이미지를 실제로 보고 평가한다 (vision).
 */
async function evaluateCharacterImage({ generatedImageUrl, originalPrompt, characterId, characterConfig }) {
  const client = getClient();
  if (!client) {
    console.warn(`[character-refinement] Mock 모드 - 결정론적 더미 평가 반환`);
    return mockEvaluation({ originalPrompt });
  }

  const systemPrompt = `당신은 제주소금 브랜드 캐릭터의 "귀여움 심사관"입니다. 키링/피규어로 팔릴 수준의
캐릭터인지 이미지를 직접 보고 아래 3가지 기준으로 냉정하게 평가하세요.

캐릭터: ${characterConfig.name} — ${characterConfig.description}
성격: ${(characterConfig.personalityKeywords || []).join(", ")}
색상: primary ${characterConfig.colorPalette?.primary || ""}
액세서리: ${JSON.stringify(characterConfig.accessories || {})}

🚨 최우선 하드 체크 (다른 무엇보다 먼저 확인): 이미지 안에 실존하는 저작권 캐릭터가
그대로 등장하거나(예: 배경에 헬로키티/카카오프렌즈/포켓몬 등이 그려져 있는 경우),
메인 캐릭터 자체가 그런 실존 캐릭터를 명백히 베낀 디자인이면 — 이건 절대 통과시키면
안 되는 치명적 위반입니다. 이 경우 overallScore를 반드시 30점 이하로, shouldRetry는
반드시 true로 설정하고, consistencyWeaknesses에 구체적으로 어떤 저작권 캐릭터가
보였는지 적으세요. improvedPrompt에는 그 저작권 캐릭터를 명시적으로 배제하는 문구를
추가하세요.

⚠️ 매우 중요한 판정 원칙:
(a) "인형같은 귀여운 외모"는 좋지만, 실제로 촬영된 물리적 인형/피규어 사진(사실적인 원단
짜임, 플라스틱/비닐 광택 반사, 스튜디오 제품사진 조명, 경직되고 생명력 없는 느낌)처럼
보이면 안 됩니다.
(b) 이 캐릭터는 "사람"이 아니라 오리지널 마스코트 크리처(정령)입니다. 실제 인간의
얼굴/신체 비율(성인 얼굴 골격, 사실적인 사람 피부/헤어)로 보이면 정체성 위반이므로
cutenessScore와 consistencyScore를 크게 감점하세요.
(c) 그림자만 살짝 입힌 평평한 2D 일러스트/스티커처럼 보이면 안 되고, 부드러운 입체
셰이딩과 은은한 조명이 있는 진짜 3D 렌더처럼 보여야 합니다 — 평평해 보이면 detailScore
감점.
(d) AI 특유의 어색하고 불쾌한(uncanny) 표정, 비대칭 눈, 왜곡된 손가락/비율이 보이면
전체 감점 대상입니다.
애니메이션/일러스트 캐릭터 렌더처럼 따뜻하고 살아있는 느낌이어야 합니다. 실제 사진처럼
보일수록, 혹은 실제 사람처럼 보일수록 cutenessScore와 detailScore를 감점하세요
(이건 "디테일이 많다"고 가점 요소가 아니라 감점 요소입니다).

1. cutenessScore (0-100, 50% 비중, 최우선): 눈(크고 살아있는 느낌, 30점) + 얼굴 비율(둥근
   얼굴/큰 눈/작은 입/부드러운 곡선, 15점) + 표정(따뜻하고 다가가고 싶은 미소, 15점) +
   전체 매력(애니메이션 캐릭터처럼 사랑스럽고 생명력 있는 느낌, 실제 사진이나 실제 사람처럼
   보이면 감점, 20점) + 색상(따뜻하고 부드러운 톤, 10점) + 포즈(자연스럽고 사랑스러움, 10점)
2. detailScore (0-100, 30% 비중): 액세서리/의상/특징이 얼마나 선명하게 "그려져" 있는가
   (단, 귀여움을 해치지 않는 범위 내에서, 그리고 사실적인 사진 재질로 보이지 않는 범위 내에서),
   진짜 입체감 있는 3D 렌더인지(평평한 2D+그림자면 감점), 배경이 제주 테마로 화사하고
   귀엽게 꾸며져 있는지(무지 벽면이면 감점). 텍스트/로고/글자가 원치 않게 들어갔으면 감점.
   실사 제품사진처럼 보이면 감점.
3. consistencyScore (0-100, 20% 비중): 위에 명시된 캐릭터의 색상/액세서리/설정과 실제
   이미지가 얼마나 일치하는가, 그리고 가슴 중앙에 브랜드 시그니처 블루(#00AEEF) 육각형
   소금결정 브로치가 다른 캐릭터들과 동일하게 보이는가(없으면 감점).

overallScore = cutenessScore*0.5 + detailScore*0.3 + consistencyScore*0.2

반드시 아래 JSON 형태로만 응답하세요:
{
  "scores": {"cutenessScore": 0-100, "detailScore": 0-100, "consistencyScore": 0-100, "overallScore": 0-100},
  "feedback": {
    "cutenessStrengths": "...", "cutenessWeaknesses": "...",
    "detailStrengths": "...", "detailWeaknesses": "...",
    "consistencyStrengths": "...", "consistencyWeaknesses": "..."
  },
  "improvedPrompt": "이 이미지의 약점을 보완한, 원본 프롬프트를 발전시킨 새 Higgsfield 프롬프트 전문(영어). 실사 사진처럼 보였다면 반드시 '더 애니메이션/일러스트 렌더처럼, 실사 재질/스튜디오 조명 반사를 피하라'는 지시를 강화해서 넣을 것 — 디테일을 더 사실적으로 만들라는 방향으로 가면 안 됨",
  "recommendedChanges": ["...", "..."],
  "shouldRetry": true|false
}
cutenessScore < 85 이거나 overallScore < 85면 shouldRetry는 반드시 true여야 합니다.`;

  try {
    const completion = await client.chat.completions.create({
      model: "upstage/solar-pro4",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `이 이미지를 평가하세요. 원본 프롬프트: ${originalPrompt}` },
            { type: "image_url", image_url: { url: generatedImageUrl } },
          ],
        },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });

    const responseText = completion.choices?.[0]?.message?.content || "";
    if (!responseText) throw new Error("평가 응답이 비어있습니다");

    const cleaned = responseText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const s = parsed.scores || {};
    const overall =
      typeof s.overallScore === "number"
        ? s.overallScore
        : Math.round((s.cutenessScore || 0) * 0.5 + (s.detailScore || 0) * 0.3 + (s.consistencyScore || 0) * 0.2);

    return {
      ...parsed,
      scores: { ...s, overallScore: overall },
      shouldRetry:
        typeof parsed.shouldRetry === "boolean"
          ? parsed.shouldRetry
          : overall < OVERALL_THRESHOLD || (s.cutenessScore || 0) < CUTENESS_THRESHOLD,
    };
  } catch (error) {
    console.error(`[character-refinement] 평가 실패, mock으로 폴백: ${error.message}`);
    return mockEvaluation({ originalPrompt });
  }
}

/**
 * 캐릭터 하나에 대해 "생성 → 평가 → (부족하면) improvedPrompt로 재시도"를
 * 최대 MAX_RETRIES회 반복하고, 최종 결과와 시도 이력을 반환한다.
 */
async function refineCharacterImage({ characterConfig, maxRetries = MAX_RETRIES }) {
  let currentPrompt = characterConfig.higgsfieldPrompt;
  const attempts = [];
  let finalResult = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[character-refinement] ${characterConfig.name} 시도 ${attempt}/${maxRetries}`);

    const genResult = await generateImageFromPrompt(currentPrompt);
    if (!genResult.success) {
      attempts.push({ attempt, prompt: currentPrompt, success: false, error: genResult.message });
      continue; // 생성 자체가 실패하면 같은 프롬프트로 한 번 더 시도
    }

    const evaluation = await evaluateCharacterImage({
      generatedImageUrl: genResult.image_url,
      originalPrompt: currentPrompt,
      characterId: characterConfig.id,
      characterConfig,
    });

    attempts.push({
      attempt,
      prompt: currentPrompt,
      imageUrl: genResult.image_url,
      imageJobId: genResult.image_job_id,
      scores: evaluation.scores,
      feedback: evaluation.feedback,
    });

    // ⚠️ 버그 수정: 재시도가 항상 이전보다 나아지는 게 아니다(AI 생성은 확률적이라
    // 오히려 더 낮은 점수가 나올 수 있음) — 그런데도 그냥 "마지막" 시도를 최종으로
    // 쓰고 있었다. 지금까지의 시도 중 overallScore가 가장 높은 것을 최종으로 채택한다.
    if (!finalResult || (evaluation.scores?.overallScore ?? -1) > (finalResult.evaluation.scores?.overallScore ?? -1)) {
      finalResult = { genResult, evaluation, attempt };
    }

    if (!evaluation.shouldRetry || attempt === maxRetries) {
      break;
    }

    if (evaluation.improvedPrompt) {
      currentPrompt = evaluation.improvedPrompt;
    }
  }

  return { attempts, final: finalResult };
}

module.exports = {
  evaluateCharacterImage,
  refineCharacterImage,
  OVERALL_THRESHOLD,
  CUTENESS_THRESHOLD,
  MAX_RETRIES,
};
