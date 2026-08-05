/**
 * backend/agents/backend-agent.js (TimelyAI SDK 버전)
 * 제주소금 AI 콘텐츠 생성 엔진 - 백엔드 에이전트
 * 
 * 역할:
 * 1. TimelyAI SDK로 에이전트 호출 (callAgent)
 * 2. Higgsfield API 영상 생성 요청 (callHiggsfield)
 * 3. Higgsfield 진행률 5초 폴링 (pollHiggsfield)
 * 4. generation_logs에 전체 과정 기록
 * 
 * 의존성: axios, timelyai-sdk (또는 timelyai 패키지), database-agent.js
 */

const axios = require("axios");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const { callDatabase } = require("./database-agent");

// OpenAI SDK (TimelyAI OpenAI 호환 모드) ✅
const OpenAI = require("openai");

// ============================================================================
// [함수 1] callAgent - TimelyAI SDK를 통한 에이전트 호출
// ============================================================================
/**
 * TimelyAI 에이전트 호출 + 자동 재시도(3회)
 * 
 * @param {string} agentName - 에이전트 이름 (예: "character-generator-agent")
 * @param {object} payload - 에이전트에 전달할 데이터
 * @param {object} context - 컨텍스트 {resourceId, step}
 * @returns {object} {success, data, error, attempt}
 */
async function callAgent(agentName, payload, context = {}) {
  const { resourceId, step } = context;

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      attempt++;

      console.log(
        `[${step}] TimelyAI 호출: ${agentName} (시도: ${attempt}/3)`
      );

      const startTime = Date.now();

      // ========== TimelyAI SDK 초기화 및 호출 ==========
      // ⚠️ 실제 SDK 패키지명/메서드가 나오면 아래를 수정하세요.
      // 현재는 REST API 폴백 방식으로 구현
      const response = await callTimelyAIAgent(agentName, payload);

      const duration = Date.now() - startTime;

      // generation_logs 기록
      if (resourceId) {
        await callDatabase("generation_logs", "create", {
          resource_id: resourceId,
          step: step || agentName,
          status: "success",
          duration_ms: duration,
          attempt,
        });
      }

      console.log(`[✓] ${agentName} 성공 (${duration}ms)`);

      return {
        success: true,
        data: response,
        attempt,
      };
    } catch (error) {
      console.error(
        `[✗] ${agentName} 실패 (시도 ${attempt}): ${error.message}`
      );

      // 매 시도마다 실패 기록 (재시도 이력 추적)
      await callDatabase("generation_logs", "create", {
        resource_id: resourceId,
        step: step || agentName,
        status: attempt >= maxAttempts ? "fail" : "retrying",
        error_message: error.message,
        error_code: error.code || "UNKNOWN",
        error_stack: error.stack || "",
        attempt,
        total_attempts: maxAttempts,
        retry_delay_ms: attempt < maxAttempts ? Math.pow(2, attempt) * 1000 : 0,
        timestamp: new Date(),
      }).catch(e => console.error("[로그 저장 실패]", e));

      // 지수백오프: 1초, 2초, 4초 대기
      if (attempt < maxAttempts) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`  ${waitMs}ms 후 재시도...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  // 3회 모두 실패
  return {
    success: false,
    error: "MAX_RETRIES_EXCEEDED",
    message: `${agentName} 호출 3회 모두 실패`,
    attempt: maxAttempts,
  };
}

// ============================================================================
// [헬퍼] callTimelyAIAgent - TimelyAI 실제 호출
// ============================================================================
/**
 * TimelyAI SDK 또는 REST API로 에이전트 호출
 * 
 * 현재 상태:
 * - SDK가 import되면: SDK 메서드 사용
 * - SDK가 없으면: REST API (axios) 폴백
 */
async function callTimelyAIAgent(agentName, payload) {
  // ========== OpenAI SDK (TimelyAI OpenAI 호환 모드) ✅ ==========
  const apiKey = process.env.TIMELY_AI_API_KEY;
  const baseURL = "https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai";

  // Mock 모드: 테스트용 더미 응답 반환
  if (apiKey && (apiKey.includes("your_") || apiKey === "dummy" || apiKey === "tgpt_sk_your_api_key_here")) {
    console.warn(`[Mock Mode] ${agentName} - 테스트 더미 응답 반환`);
    return getMockResponseForAgent(agentName, payload);
  }

  if (!apiKey) {
    throw new Error("TIMELY_AI_API_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const systemPrompt = getSystemPromptForAgent(agentName);
  const outputSpec = getOutputSpecForAgent(agentName);

  console.log(`  [OpenAI SDK] 에이전트 호출: ${agentName}`);
  console.log(`    모델: openai/gpt-4.1-mini`);

  try {
    const completion = await client.chat.completions.create({
      model: "openai/gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\n${outputSpec}`,
        },
        {
          role: "user",
          content: JSON.stringify(payload, null, 2),
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    console.log(`  [✓] 응답 수신 성공`);

    const responseText = completion.choices?.[0]?.message?.content || "";

    if (!responseText) {
      console.error(`  [TimelyAI 빈 응답]`);
      throw new Error("TimelyAI 응답이 비어있습니다");
    }

    // JSON 파싱
    const cleaned = responseText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    console.log(`  [✓] JSON 파싱 성공`);
    return parsed;

  } catch (error) {
    console.error(`  [✗ OpenAI API 호출 실패]`);

    // TimelyAI 특정 에러 처리
    if (error.status === 401) {
      console.error(`    401 인증 실패: API 키를 확인하세요`);
    } else if (error.status === 402) {
      console.error(`    402 크레딧 부족: 크레딧을 충전하세요`);
    } else if (error.status === 429) {
      console.error(`    429 Rate Limit 초과: 잠시 후 다시 시도하세요`);
    } else if (error.status === 404) {
      console.error(`    404 모델을 찾을 수 없음: 모델 이름을 확인하세요`);
    } else if (error.message) {
      console.error(`    ${error.message}`);
    }

    throw error;
  }
}

// ============================================================================
// [Mock 응답 제공자]
// ============================================================================

function getMockResponseForAgent(agentName, payload) {
  // character-creator-agent는 사용자가 입력한 이름/방향성에 따라 매번 결과가 달라져야 하므로
  // (라이브러리 신규 캐릭터 생성 데모가 실제로 반영되는 것처럼 보이도록) 정적 맵 대신 payload 기반으로 생성
  if (agentName === "character-creator-agent") {
    const characterName = payload?.characterName || "새 캐릭터";
    const direction = payload?.direction || "";
    return {
      brief: {
        character: characterName,
        voice_tone: direction ? `${direction}에 어울리는 톤` : "친근하고 신뢰감 있는 톤",
        personality_traits: direction
          ? direction.split(/[,\s]+/).filter((w) => w.length > 1).slice(0, 4)
          : ["친근함", "신뢰감"],
        visual_description: direction
          ? `${direction} 컨셉을 반영한 외형과 표정`
          : "브랜드 톤에 맞는 표준적인 외형",
      },
    };
  }

  // shortform-scenario-writer-agent도 참고자료(referenceMaterials)가 있으면
  // 데모에서 실제로 반영되는 것처럼 보이도록 payload 기반으로 스토리 텍스트에 반영한다.
  if (agentName === "shortform-scenario-writer-agent" && payload?.referenceMaterials?.length > 0) {
    const fileNames = payload.referenceMaterials.map((f) => f.filename).join(", ");
    const excerpt = payload.referenceMaterials[0]?.content?.slice(0, 80) || "";
    return {
      scenario: {
        title: "제주소금으로 시작하는 건강한 하루",
        story_content: `[참고자료 반영: ${fileNames}] ${excerpt}... 이 내용을 바탕으로 아침 밥상에 제주소금을 올리는 장면으로 시작합니다.`,
        acts: [
          { act: 1, duration_seconds: 40, content: `아침 오프닝 (참고자료: ${fileNames} 반영)` },
          { act: 2, duration_seconds: 50, content: "제품 소개" },
          { act: 3, duration_seconds: 30, content: "클로징" },
        ],
      },
      higgsfield_specifications: {
        style: "전문적이고 세련된",
        mood: "신뢰감 있고 따뜻함",
      },
      timing_verification: {
        total_duration: 120,
        dialogue_seconds: 60,
        narration_seconds: 60,
      },
    };
  }

  const mockData = {
    "resource-analyzer-agent": {
      metadata: {
        categories: ["식품", "뷰티"],
        ageGroups: ["20~30대", "40~60대"],
        targets: ["개인", "가족"],
        focus: ["신뢰", "건강"],
        confidence: 85
      }
    },
    "character-generator-agent": {
      characters: [
        {
          name: "결이",
          description: "당찬 소년, 도전적이고 에너지 넘침",
          reason: "타겟층의 긍정적 이미지 대표",
          score: 90
        },
        {
          name: "용암이",
          description: "따뜻한 아버지, 신뢰감과 보호본능",
          reason: "제품의 신뢰성 강조",
          score: 85
        },
        {
          name: "해수",
          description: "자유로운 영혼, 경쾌함과 순수함",
          reason: "자연스러운 제품 특성",
          score: 80
        }
      ]
    },
    "character-designer-agent": {
      brief: {
        character: "결이",
        voice_tone: "밝고 도전적인 톤, 에너지 있는 어린이 목소리",
        personality_traits: ["도전적", "긍정적", "친근한"],
        visual_description: "파란색 옷, 밝은 눈빛, 활발한 표정"
      }
    },
    "shortform-scenario-writer-agent": {
      scenario: {
        title: "제주소금으로 시작하는 건강한 하루",
        story_content: "아침 밥상에 제주소금을...",
        acts: [
          { act: 1, duration_seconds: 40, content: "아침 오프닝" },
          { act: 2, duration_seconds: 50, content: "제품 소개" },
          { act: 3, duration_seconds: 30, content: "클로징" }
        ]
      },
      higgsfield_specifications: {
        style: "전문적이고 세련된",
        mood: "신뢰감 있고 따뜻함"
      },
      timing_verification: {
        total_duration: 120,
        dialogue_seconds: 60,
        narration_seconds: 60
      }
    },
    "naming-generator-agent": {
      product_name_options: [
        { name: "제주 청염", score: 90, meaning: "청정한 제주의 소금" },
        { name: "해바람 소금", score: 85, meaning: "바다바람을 담은" },
        { name: "제주 자연", score: 80, meaning: "자연 그대로" }
      ],
      content_name_options: [
        { name: "제주의 선물", score: 90, meaning: "자연의 축복" },
        { name: "바다의 정성", score: 85, meaning: "정성 어린" },
        { name: "소금 이야기", score: 80, meaning: "스토리텔링" }
      ]
    },
    "product-intro-writer-agent": {
      content: "제주의 청정 해역에서 자연 그대로 채취한 제주소금입니다. 70년의 전통과 기술이 담겨있습니다."
    },
    "product-detail-page-writer-agent": {
      content: "제주소금은 세 가지 특징을 가지고 있습니다: 1. 순수함 2. 건강함 3. 신뢰성"
    },
    "compliance-reviewer-agent": {
      validation: {
        status: "APPROVED",
        score: 90,
        issues: []
      }
    }
  };

  return mockData[agentName] || { message: "Mock response" };
}

// ============================================================================
// [시스템 프롬프트 & 출력 사양]
// ============================================================================

function getSystemPromptForAgent(agentName) {
  // config.json에서 브랜드 정보 로드
  const { getConfig } = require("../utils/config-loader");
  const config = getConfig();
  const brand = config.brand || {};

  const prompts = {
    "resource-analyzer-agent": `당신은 제품 정보를 분석하는 AI 에이전트입니다.
제품: ${brand.nameKorean || "제주소금"}
브랜드 톤: ${brand.voiceTone || "정직하고 따뜻함"}

제공된 제품명, 설명, 키워드를 기반으로:
- 상품 카테고리 (${(brand.categories || []).join(", ") || "식품, 뷰티, 웰스케어"})
- 타겟 연령대 (${(brand.targetAges || []).join(", ") || "20~30대, 40~60대, 60대+"})
- 타겟 고객층 (${(brand.targetAudience || []).join(", ") || "개인, 가족, 단체"})
- 마케팅 포커스 (${(brand.focus || []).join(", ") || "신뢰, 기술, 건강"})
- 신뢰도 점수 (0~100)

를 분석하여 반환하세요.`,

    "character-generator-agent": `당신은 ${brand.nameKorean || "제주소금"} 제품 마케팅을 위한 캐릭터 3개를 추천하는 AI 에이전트입니다.
브랜드 톤: ${brand.voiceTone || "정직하고 따뜻함"}
각 캐릭터는 다음을 포함해야 합니다:
- 이름
- 설명 (외형, 성격, 역할)
- 추천 이유
- 점수 (90~80)

정확히 3개를 생성하세요.`,

    "character-designer-agent": `당신은 선택된 캐릭터를 상세 설계하는 AI 에이전트입니다.
브랜드: ${brand.nameKorean || "제주소금"}
브랜드 톤: ${brand.voiceTone || "정직하고 따뜻함"}

다음을 포함한 완전한 캐릭터 브리프를 작성하세요:
- 캐릭터명
- 음성 톤 설명 (예: ${brand.voiceTone || "정직함, 신뢰감, 친근함"})
- 성격 특성 (배열)
- 시각적 묘사 (의상, 표정, 외형)
- 피해야 할 표현: ${(brand.absoluteNos || []).join(", ") || "의료표현, 과장"}`,

    "character-creator-agent": `당신은 사용자가 입력한 방향성(direction)을 바탕으로 완전히 새로운 캐릭터를 설계하는 AI 에이전트입니다.
브랜드: ${brand.nameKorean || "제주소금"}
브랜드 톤: ${brand.voiceTone || "정직하고 따뜻함"}

사용자가 입력한 캐릭터 이름과 방향성 설명을 최대한 반영해서:
- 음성 톤 설명
- 성격 특성 (배열)
- 시각적 묘사 (의상, 표정, 외형)
을 작성하세요. 이 캐릭터는 이후 여러 자료(제품)에서 재사용되는 "기본 캐릭터"로 라이브러리에 저장되므로,
한 번 정해지면 계속 일관되게 재사용될 수 있도록 구체적이고 명확하게 작성하세요.`,

    "shortform-scenario-writer-agent": `당신은 120초 영상 시나리오를 작성하는 AI 에이전트입니다.
다음을 포함하세요:
- 시나리오 제목
- 전체 스토리 텍스트
- Act 분할 (각 Act는 지속시간 초 포함)
- 영상 스타일 & 분위기 (Higgsfield 스펙)
- 타이밍 검증 (정확히 120초, 대사/나레이션 시간)

만약 입력에 referenceMaterials(참고자료)가 포함되어 있다면, 그 내용을 반드시 스토리와 대사에 반영하세요.`,

    "naming-generator-agent": `당신은 제품명과 콘텐츠명 각 3개를 생성하는 AI 에이전트입니다.
각각 정확히 3개씩, 각 항목마다:
- 이름
- 점수 (90~80)
- 의미 설명

을 포함하세요.`,

    "product-intro-writer-agent": `당신은 제품 소개 카피를 작성하는 AI 에이전트입니다.
제품명, 설명, 캐릭터를 기반으로 매력적이고 설득력 있는 소개글을 작성하세요.`,

    "product-detail-page-writer-agent": `당신은 상세페이지 카피를 작성하는 AI 에이전트입니다.
제품의 상세한 혜택, 사용법, 특징을 강조하는 긴 형식의 카피를 작성하세요.`,

    "compliance-reviewer-agent": `당신은 ${brand.nameKorean || "제주소금"} 제품의 마케팅 콘텐츠를 검증하는 AI 에이전트입니다.

검증 기준:
- 피해야 할 표현: ${(brand.absoluteNos || []).join(", ") || "의료표현, 과도한 유행어"}
- 필수 포함 가치: ${(brand.toneValues || []).join(", ") || "정직함, 신뢰성"}

제공된 카피를 검토하고:
- 승인 여부 (APPROVED / REJECTED)
- 신뢰도 점수 (0~100)
- 발견된 문제점 (없으면 빈 배열)

을 반환하세요.`,
  };

  return prompts[agentName] || `당신은 AI 에이전트입니다. 주어진 입력을 분석하고 JSON 형식으로 반환하세요.`;
}

function getOutputSpecForAgent(agentName) {
  const specs = {
    "resource-analyzer-agent": `반드시 아래 JSON 형태로만 응답하세요:
{
  "metadata": {
    "categories": ["문자열", "..."],
    "ageGroups": ["10대", "20대", ...],
    "targets": ["가족", "직장인", ...],
    "focus": ["건강", "친환경", ...],
    "confidence": 85
  }
}`,

    "character-generator-agent": `반드시 아래 JSON 형태로만 응답하세요 (characters는 정확히 3개):
{
  "characters": [
    { "name": "캐릭터명", "description": "설명", "reason": "이유", "score": 90 },
    { "name": "캐릭터명", "description": "설명", "reason": "이유", "score": 85 },
    { "name": "캐릭터명", "description": "설명", "reason": "이유", "score": 80 }
  ]
}`,

    "character-designer-agent": `반드시 아래 JSON 형태로만 응답하세요:
{
  "brief": {
    "character": "캐릭터명",
    "voice_tone": "따뜻하고 신뢰감 있는 톤",
    "personality_traits": ["특성1", "특성2", "특성3"],
    "visual_description": "시각적 묘사..."
  }
}`,

    "character-creator-agent": `반드시 아래 JSON 형태로만 응답하세요:
{
  "brief": {
    "character": "캐릭터명",
    "voice_tone": "방향성을 반영한 톤",
    "personality_traits": ["특성1", "특성2", "특성3"],
    "visual_description": "방향성을 반영한 시각적 묘사..."
  }
}`,

    "shortform-scenario-writer-agent": `반드시 아래 JSON 형태로만 응답하세요 (total_duration은 정확히 120):
{
  "scenario": {
    "title": "시나리오 제목",
    "story_content": "전체 스토리 텍스트...",
    "acts": [
      { "act": 1, "duration_seconds": 40, "content": "오프닝..." },
      { "act": 2, "duration_seconds": 50, "content": "메인..." },
      { "act": 3, "duration_seconds": 30, "content": "클로징..." }
    ]
  },
  "higgsfield_specifications": {
    "style": "전문적이고 세련된",
    "mood": "신뢰감 있고 따뜻함"
  },
  "timing_verification": {
    "total_duration": 120,
    "dialogue_seconds": 60,
    "narration_seconds": 60
  }
}`,

    "naming-generator-agent": `반드시 아래 JSON 형태로만 응답하세요 (각각 정확히 3개):
{
  "product_name_options": [
    { "name": "이름1", "score": 90, "meaning": "의미설명" },
    { "name": "이름2", "score": 85, "meaning": "의미설명" },
    { "name": "이름3", "score": 80, "meaning": "의미설명" }
  ],
  "content_name_options": [
    { "name": "이름1", "score": 90, "meaning": "의미설명" },
    { "name": "이름2", "score": 85, "meaning": "의미설명" },
    { "name": "이름3", "score": 80, "meaning": "의미설명" }
  ]
}`,

    "product-intro-writer-agent": `반드시 아래 JSON 형태로만 응답하세요:
{ "content": "생성된 제품 소개 카피 전체 텍스트..." }`,

    "product-detail-page-writer-agent": `반드시 아래 JSON 형태로만 응답하세요:
{ "content": "생성된 상세페이지 카피 전체 텍스트..." }`,

    "compliance-reviewer-agent": `반드시 아래 JSON 형태로만 응답하세요:
{
  "validation": {
    "status": "APPROVED",
    "score": 85,
    "issues": []
  }
}`,
  };

  return specs[agentName] || "반드시 순수 JSON 객체만 반환하세요.";
}

// ============================================================================
// [함수 2] callHiggsfield - Higgsfield API 영상 생성 요청
// ============================================================================

async function callHiggsfield(videoConfig, resourceId, contentId) {
  try {
    const duration = videoConfig.duration === 120 ? 8 : 4;

    // ✅ 메타데이터 기반 프롬프트 생성 (텍스트 제거)
    const character = videoConfig.character || 'woman';
    const voiceTone = videoConfig.voiceTone || 'professional';
    const visualDescription = videoConfig.visualDescription || '';
    const metadata = `${character} character, ${voiceTone} tone, product promotion`;

    console.log(`[Step 9] Higgsfield CLI 호출 시작`);
    console.log(`  명령: higgsfield generate create seedance1_5`);
    console.log(`  메타데이터: ${metadata}`);
    console.log(`  duration: ${duration}초`);

    // ⭐ 캐릭터 레퍼런스 이미지가 있으면 --image-references 추가 (재현성)
    let command = `higgsfield generate create seedance1_5 --prompt "${metadata}" --duration ${duration} --resolution 720p`;
    if (videoConfig.referenceImageUrl) {
      console.log(`  레퍼런스 이미지: ${videoConfig.referenceImageUrl}`);
      command += ` --image-references "${videoConfig.referenceImageUrl}"`;
    }
    command += ` --wait`;

    console.log(`[Step 9] 명령 실행 중...`);
    const { stdout, stderr } = await execPromise(command, {
      timeout: 600000,
      maxBuffer: 10 * 1024 * 1024
    });

    console.log(`[✓] CLI 완료`);
    console.log(`  출력: ${stdout}`);

    const videoUrl = stdout.trim();

    if (!videoUrl.startsWith("https://")) {
      throw new Error(`유효하지 않은 URL: ${videoUrl}`);
    }

    console.log(`[✓] 영상 생성 완료`);
    console.log(`  URL: ${videoUrl}`);

    const videoResult = await callDatabase("videos", "create", {
      resource_id: resourceId,
      content_id: contentId,
      generation_status: "completed",
      generation_progress: 100,
      video_url: videoUrl,
      generation_start_time: new Date(),
      generation_end_time: new Date(),
    });

    return {
      success: true,
      data: {
        video_url: videoUrl,
        generation_status: "completed",
        generation_progress: 100,
        videos_row_id: videoResult.rows?.[0]?.id,
      },
    };
  } catch (error) {
    console.error(`[✗] Higgsfield CLI 실패: ${error.message}`);

    return {
      success: false,
      error: "HIGGSFIELD_CLI_ERROR",
      message: error.message,
      statusCode: error.code,
    };
  }
}

// ============================================================================
// [함수 3] pollHiggsfield - Higgsfield 진행률 5초 폴링
// ============================================================================

async function pollHiggsfield(higgsfieldId, videoRowId) {
  const maxAttempts = 120;
  let attempt = 0;

  console.log(
    `[Step 9-폴링] Higgsfield 진행률 폴링 시작 (최대 10분)`
  );
  console.log(`  generation_id: ${higgsfieldId}`);
  console.log(`  상태 조회 엔드포인트: GET ${process.env.HIGGSFIELD_API_URL}/api/v1/status/${higgsfieldId}`);

  while (attempt < maxAttempts) {
    try {
      attempt++;

      const response = await axios.get(
        `${process.env.HIGGSFIELD_API_URL}/api/v1/status/${higgsfieldId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
          },
          timeout: 30000,
        }
      );

      const status = response.data.status;
      const progress = response.data.progress || 0;
      const videoUrl = response.data.video_url || response.data.url || null;

      console.log(`  [${attempt}/120] 진행률: ${progress}% | 상태: ${status}`);

      const updateData = {
        generation_progress: progress || 0,
        generation_status: status || "processing",
        updated_at: new Date(),
      };

      if (videoUrl) {
        updateData.video_url = videoUrl;
      }

      if (status === "completed" || status === "done" || status === "success") {
        updateData.generation_end_time = new Date();
        updateData.generation_status = "completed";

        await callDatabase("videos", "update", updateData, { id: videoRowId });

        console.log(`[✓] 영상 생성 완료!`);
        if (videoUrl) {
          console.log(`  URL: ${videoUrl}`);
        }

        return {
          success: true,
          generation_progress: 100,
          generation_status: "completed",
          video_url: videoUrl || null,
        };
      }

      if (status === "failed" || status === "error") {
        updateData.generation_end_time = new Date();
        updateData.generation_status = "failed";

        await callDatabase("videos", "update", updateData, { id: videoRowId });

        console.log(`[✗] 영상 생성 실패`);
        console.log(`  에러 정보:`, response.data.error || "상세정보 없음");

        return {
          success: false,
          generation_progress: progress || 0,
          generation_status: "failed",
          error: "HIGGSFIELD_GENERATION_FAILED",
          message: "Higgsfield 서버에서 영상 생성에 실패했습니다",
          details: response.data.error || null,
        };
      }

      await callDatabase("videos", "update", updateData, { id: videoRowId });
      await new Promise((resolve) => setTimeout(resolve, 5000));

    } catch (error) {
      console.error(`  [${attempt}/120] 폴링 에러: ${error.message}`);

      if (error.response?.status === 404) {
        console.error(`    404 Not Found - generation_id가 잘못되었을 수 있습니다`);
      } else if (error.response?.status === 401) {
        console.error(`    401 Unauthorized - API 키를 확인하세요`);
        return {
          success: false,
          error: "UNAUTHORIZED",
          message: "Higgsfield API 인증 실패",
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log(`[⚠️] 폴링 타임아웃 (10분 초과)`);
  return {
    success: false,
    error: "TIMEOUT",
    message: "Higgsfield 영상 생성이 10분 이상 소요되었습니다",
  };
}

// ============================================================================
// [Export]
// ============================================================================

module.exports = {
  callAgent,
  callHiggsfield,
  pollHiggsfield,
};
