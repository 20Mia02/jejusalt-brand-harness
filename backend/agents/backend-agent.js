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

      // 마지막 시도면 기록
      if (attempt >= maxAttempts && resourceId) {
        await callDatabase("generation_logs", "create", {
          resource_id: resourceId,
          step: step || agentName,
          status: "fail",
          error_message: error.message,
          attempt,
        });
      }

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
// [시스템 프롬프트 & 출력 사양]
// ============================================================================

function getSystemPromptForAgent(agentName) {
  const prompts = {
    "resource-analyzer-agent": `당신은 제품 정보를 분석하는 AI 에이전트입니다.
제공된 제품명, 설명, 키워드를 기반으로:
- 상품 카테고리 (식품, 뷰티, 패션 등)
- 타겟 연령대 (10대, 20대, 30대, 40대, 50대+)
- 타겟 고객층 (가족, 직장인, 학생 등)
- 마케팅 포커스 (건강, 친환경, 프리미엄 등)
- 신뢰도 점수 (0~100)

를 분석하여 반환하세요.`,

    "character-generator-agent": `당신은 제품 마케팅을 위한 캐릭터 3개를 추천하는 AI 에이전트입니다.
각 캐릭터마다:
- 이름
- 설명 (외형, 성격, 역할)
- 추천 이유
- 점수 (90~80)

를 포함하여 정확히 3개를 생성하세요.`,

    "character-designer-agent": `당신은 선택된 캐릭터를 상세 설계하는 AI 에이전트입니다.
다음을 포함한 완전한 캐릭터 브리프를 작성하세요:
- 캐릭터명
- 음성 톤 설명 (따뜻함, 신뢰감, 에너지 등)
- 성격 특성 (배열)
- 시각적 묘사 (의상, 표정, 외형)`,

    "shortform-scenario-writer-agent": `당신은 120초 영상 시나리오를 작성하는 AI 에이전트입니다.
다음을 포함하세요:
- 시나리오 제목
- 전체 스토리 텍스트
- Act 분할 (각 Act는 지속시간 초 포함)
- 영상 스타일 & 분위기 (Higgsfield 스펙)
- 타이밍 검증 (정확히 120초, 대사/나레이션 시간)`,

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

    "compliance-reviewer-agent": `당신은 제품 마케팅 콘텐츠를 검증하는 AI 에이전트입니다.
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
    if (!videoConfig.character || !videoConfig.generatedContent) {
      throw new Error("character 또는 generatedContent가 비어있습니다");
    }

    console.log(`[Step 9] Higgsfield API 호출 시작`);
    console.log(`  캐릭터: ${videoConfig.character}`);
    console.log(`  음성톤: ${videoConfig.voiceTone}`);
    console.log(`  지속시간: ${videoConfig.duration}초`);

    const response = await axios.post(
      `${process.env.HIGGSFIELD_API_URL}/v1/videos`,
      {
        character: videoConfig.character,
        script: videoConfig.generatedContent,
        voiceTone: videoConfig.voiceTone || "기본",
        duration: videoConfig.duration || 120,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY_SECRET}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const higgsfieldId = response.data.id;
    console.log(`[✓] Higgsfield 요청 성공: ${higgsfieldId}`);

    const videoResult = await callDatabase("videos", "create", {
      resource_id: resourceId,
      content_id: contentId,
      higgsfield_id: higgsfieldId,
      generation_status: "processing",
      generation_progress: 0,
      generation_start_time: new Date(),
    });

    console.log(`[✓] videos 테이블 INSERT 완료`);

    return {
      success: true,
      data: {
        higgsfield_id: higgsfieldId,
        video_url: null,
        generation_status: "processing",
        generation_progress: 0,
        videos_row_id: videoResult.rows?.[0]?.id,
      },
    };
  } catch (error) {
    console.error(`[✗] Higgsfield API 호출 실패: ${error.message}`);

    let errorType = "NETWORK_ERROR";
    if (error.response?.status === 401) {
      errorType = "UNAUTHORIZED";
    } else if (error.response?.status === 402) {
      errorType = "INSUFFICIENT_CREDITS";
    } else if (error.response?.status === 422) {
      errorType = "INVALID_REQUEST";
    }

    return {
      success: false,
      error: errorType,
      message: error.message,
      statusCode: error.response?.status,
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

  while (attempt < maxAttempts) {
    try {
      attempt++;

      const response = await axios.get(
        `${process.env.HIGGSFIELD_API_URL}/v1/videos/${higgsfieldId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY_SECRET}`,
          },
          timeout: 30000,
        }
      );

      const { progress, status, video_url } = response.data;

      console.log(`  [${attempt}회차] 진행률: ${progress}% | 상태: ${status}`);

      const updateData = {
        generation_progress: progress || 0,
        generation_status: status || "processing",
        updated_at: new Date(),
      };

      if (video_url) {
        updateData.video_url = video_url;
      }

      if (status === "completed" || status === "failed") {
        updateData.generation_end_time = new Date();
      }

      await callDatabase("videos", "update", updateData, { id: videoRowId });

      if (status === "completed") {
        console.log(`[✓] 영상 생성 완료! URL: ${video_url}`);
        return {
          success: true,
          generation_progress: progress || 100,
          generation_status: "completed",
          video_url: video_url || null,
        };
      }

      if (status === "failed") {
        console.log(`[✗] 영상 생성 실패`);
        return {
          success: false,
          generation_progress: progress || 0,
          generation_status: "failed",
          error: "HIGGSFIELD_GENERATION_FAILED",
          message: "Higgsfield 서버에서 영상 생성에 실패했습니다",
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`  [폴링 에러] ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log(`[✗] 폴링 타임아웃 (10분 초과)`);
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
