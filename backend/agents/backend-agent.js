/**
 * backend/agents/backend-agent.js
 * 제주소금 AI 콘텐츠 생성 엔진 - 백엔드 에이전트
 * 
 * 역할:
 * 1. TimelyAI 에이전트 호출 (callAgent)
 * 2. Higgsfield API 영상 생성 요청 (callHiggsfield)
 * 3. Higgsfield 진행률 5초 폴링 (pollHiggsfield)
 * 4. generation_logs에 전체 과정 기록
 * 
 * 의존성: axios, database-agent.js
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { callDatabase } = require("./database-agent");

// ============================================================================
// [설정] 에이전트 제공자 전환 스위치
// ============================================================================
/**
 * AGENT_PROVIDER 환경변수로 전환:
 *   "claude"    → Claude API로 직접 호출 (지금 당장 사용, TimelyAI 키 불필요)
 *   "timelyai"  → TimelyAI 실제 연동 (나중에 TimelyAI 호출 방식 확정되면 전환)
 *
 * .env에 추가:
 *   AGENT_PROVIDER=claude
 *   ANTHROPIC_API_KEY=여기에_Claude_API_키
 *   CLAUDE_MODEL=claude-sonnet-5   (선택, 기본값 claude-sonnet-5)
 */
const AGENT_PROVIDER = (process.env.AGENT_PROVIDER || "claude").toLowerCase();

// ============================================================================
// [함수 1] callAgent - 에이전트 호출 (진입점, 제공자에 따라 분기)
// ============================================================================
/**
 * @param {string} agentName - 에이전트 이름 (예: "character-generator-agent")
 * @param {object} payload - 에이전트에 전달할 데이터
 * @param {object} context - 컨텍스트 {resourceId, step}
 * @returns {object} {success, data, error, attempt}
 */
async function callAgent(agentName, payload, context = {}) {
  if (AGENT_PROVIDER === "timelyai") {
    return callAgentViaTimelyAI(agentName, payload, context);
  }
  return callAgentViaClaude(agentName, payload, context);
}

// ============================================================================
// [함수 1-A] callAgentViaClaude - Claude API로 직접 에이전트 흉내내기
// ============================================================================
/**
 * 각 TimelyAI 에이전트의 역할을 Claude API 호출로 대신 수행한다.
 * agents/*.md, .claude/agents/*.md 에 있는 에이전트 정의서를 시스템 프롬프트에
 * 포함시키고, routes/*.js가 기대하는 JSON 구조로만 응답하도록 강제한다.
 */

// routes/*.js가 실제로 읽는 필드와 정확히 일치시킨 출력 스펙
const AGENT_OUTPUT_SPEC = {
  "resource-analyzer-agent": `
반드시 아래 JSON 형태로만 응답하세요 (다른 텍스트/설명/코드블록 없이 JSON만):
{
  "metadata": {
    "categories": ["문자열", "..."],
    "ageGroups": ["문자열", "..."],
    "targets": ["문자열", "..."],
    "focus": ["문자열", "..."],
    "confidence": 0.0
  }
}`,
  "character-generator-agent": `
반드시 아래 JSON 형태로만 응답하세요 (characters는 정확히 3개):
{
  "characters": [
    { "name": "캐릭터명", "description": "캐릭터 설명", "reason": "추천 이유", "score": 90 },
    { "name": "캐릭터명", "description": "캐릭터 설명", "reason": "추천 이유", "score": 85 },
    { "name": "캐릭터명", "description": "캐릭터 설명", "reason": "추천 이유", "score": 80 }
  ]
}`,
  "character-designer-agent": `
반드시 아래 JSON 형태로만 응답하세요:
{
  "brief": {
    "character": "캐릭터명",
    "voice_tone": "음성 톤 설명",
    "personality_traits": ["특성1", "특성2"],
    "visual_description": "시각적 묘사"
  }
}`,
  "shortform-scenario-writer-agent": `
반드시 아래 JSON 형태로만 응답하세요 (total_duration은 정확히 120):
{
  "scenario": {
    "title": "시나리오 제목",
    "story_content": "전체 스토리 텍스트",
    "acts": [ { "act": 1, "duration_seconds": 30, "content": "..." } ]
  },
  "higgsfield_specifications": { "style": "영상 스타일", "mood": "분위기" },
  "timing_verification": {
    "total_duration": 120,
    "dialogue_seconds": 60,
    "narration_seconds": 60
  }
}`,
  "naming-generator-agent": `
반드시 아래 JSON 형태로만 응답하세요 (각각 정확히 3개):
{
  "product_name_options": [
    { "name": "이름1", "score": 90, "meaning": "의미 설명" },
    { "name": "이름2", "score": 85, "meaning": "의미 설명" },
    { "name": "이름3", "score": 80, "meaning": "의미 설명" }
  ],
  "content_name_options": [
    { "name": "이름1", "score": 90, "meaning": "의미 설명" },
    { "name": "이름2", "score": 85, "meaning": "의미 설명" },
    { "name": "이름3", "score": 80, "meaning": "의미 설명" }
  ]
}`,
  "product-intro-writer-agent": `
반드시 아래 JSON 형태로만 응답하세요:
{ "content": "생성된 제품 소개 카피 전체 텍스트" }`,
  "product-detail-page-writer-agent": `
반드시 아래 JSON 형태로만 응답하세요:
{ "content": "생성된 상세페이지 카피 전체 텍스트" }`,
  "compliance-reviewer-agent": `
반드시 아래 JSON 형태로만 응답하세요:
{
  "validation": {
    "status": "APPROVED 또는 REJECTED",
    "score": 90,
    "issues": ["발견된 문제점(없으면 빈 배열)"]
  }
}`,
};

/**
 * agents/*.md 또는 .claude/agents/*.md 에서 에이전트 정의서를 찾아서 읽어옴
 * (프로젝트 폴더 구조상 두 위치 모두 시도, 없으면 null 반환하고 기본 프롬프트만 사용)
 */
function loadAgentDefinition(agentName) {
  const candidates = [
    path.join(process.cwd(), "agents", `${agentName}.md`),
    path.join(process.cwd(), ".claude", "agents", `${agentName}.md`),
    path.join(process.cwd(), "..", "agents", `${agentName}.md`),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf-8");
      }
    } catch (e) {
      // 무시하고 다음 후보 시도
    }
  }
  return null;
}

async function callAgentViaClaude(agentName, payload, context = {}) {
  const { resourceId, step } = context;

  const agentDefinition = loadAgentDefinition(agentName);
  const outputSpec =
    AGENT_OUTPUT_SPEC[agentName] || "반드시 순수 JSON 형태로만 응답하세요.";

  const systemPrompt = `당신은 "${agentName}" 역할을 수행하는 AI 에이전트입니다.
${agentDefinition ? `\n[에이전트 정의서]\n${agentDefinition}\n` : ""}
${outputSpec}

⚠️ 매우 중요: 응답은 순수 JSON 객체 하나만 반환하세요.
코드블록(\`\`\`), 설명 문장, 인사말 등 어떤 텍스트도 JSON 앞뒤에 붙이지 마세요.`;

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      attempt++;

      console.log(`[${step}] Claude API 호출: ${agentName} (시도: ${attempt}/3)`);

      const startTime = Date.now();
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: process.env.CLAUDE_MODEL || "claude-sonnet-5",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            { role: "user", content: JSON.stringify(payload, null, 2) },
          ],
        },
        {
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          timeout: 60000,
        }
      );

      const duration = Date.now() - startTime;
      const rawText = response.data?.content?.[0]?.text || "";

      // 혹시 모를 코드블록(```json ... ```) 제거 후 JSON 파싱
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      const parsedData = JSON.parse(cleaned);

      if (resourceId) {
        await callDatabase("generation_logs", "create", {
          resource_id: resourceId,
          step: step || agentName,
          status: "success",
          duration_ms: duration,
          attempt,
        });
      }

      console.log(`[✓] ${agentName} (Claude API) 성공 (${duration}ms)`);

      return {
        success: true,
        data: parsedData,
        attempt,
      };
    } catch (error) {
      const isParseError = error instanceof SyntaxError;
      console.error(
        `[✗] ${agentName} (Claude API) 실패 (시도 ${attempt}): ${
          isParseError ? "응답이 JSON 형식이 아님 - " : ""
        }${error.message}`
      );

      if (attempt >= maxAttempts && resourceId) {
        await callDatabase("generation_logs", "create", {
          resource_id: resourceId,
          step: step || agentName,
          status: "fail",
          error_message: error.message,
          attempt,
        });
      }

      if (attempt < maxAttempts) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`  ${waitMs}ms 후 재시도...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  return {
    success: false,
    error: "MAX_RETRIES_EXCEEDED",
    message: `${agentName} (Claude API) 호출 3회 모두 실패`,
    attempt: maxAttempts,
  };
}

// ============================================================================
// [함수 1-B] callAgentViaTimelyAI - TimelyAI 실제 연동 (나중에 전환할 것)
// ============================================================================
/**
 * ⚠️ 주의: 이 함수는 TimelyAI의 정확한 호출 방식(엔드포인트, 파라미터)이
 *    아직 확정되지 않아 검증되지 않았습니다. TimelyAI SDK 문서를 확인한 뒤
 *    실제 방식(client.chat.completions.create 등)에 맞게 다시 작성해야 합니다.
 *    (예: TIMELY_BASE_URL, TIMELY_API_KEY 환경변수, session_id/messages/model 파라미터 등)
 *
 * 전환하려면 .env에서 AGENT_PROVIDER=timelyai 로 바꾸기만 하면 됨.
 */
async function callAgentViaTimelyAI(agentName, payload, context = {}) {
  const { resourceId, step } = context;

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    try {
      attempt++;

      console.log(`[${step}] TimelyAI 호출: ${agentName} (시도: ${attempt}/3)`);

      const startTime = Date.now();
      const response = await axios.post(
        `${process.env.TIMELY_AI_BASE_URL}/api/agents/${agentName}/run`,
        {
          payload,
          apiKey: process.env.TIMELY_AI_API_KEY,
        },
        { timeout: 60000 }
      );

      const duration = Date.now() - startTime;

      if (resourceId) {
        await callDatabase("generation_logs", "create", {
          resource_id: resourceId,
          step: step || agentName,
          status: "success",
          duration_ms: duration,
          attempt,
        });
      }

      console.log(`[✓] ${agentName} (TimelyAI) 성공 (${duration}ms)`);

      return {
        success: true,
        data: response.data,
        attempt,
      };
    } catch (error) {
      console.error(`[✗] ${agentName} (TimelyAI) 실패 (시도 ${attempt}): ${error.message}`);

      if (attempt >= maxAttempts && resourceId) {
        await callDatabase("generation_logs", "create", {
          resource_id: resourceId,
          step: step || agentName,
          status: "fail",
          error_message: error.message,
          attempt,
        });
      }

      if (attempt < maxAttempts) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`  ${waitMs}ms 후 재시도...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  return {
    success: false,
    error: "MAX_RETRIES_EXCEEDED",
    message: `${agentName} (TimelyAI) 호출 3회 모두 실패`,
    attempt: maxAttempts,
  };
}

// ============================================================================
// [함수 2] callHiggsfield - Higgsfield API 영상 생성 요청
// ============================================================================
/**
 * Higgsfield API에 영상 생성 요청 (POST /v1/videos)
 * 
 * @param {object} videoConfig - {character, generatedContent, voiceTone, duration}
 * @param {string} resourceId - resources.id (FK)
 * @param {string} contentId - contents.id (FK)
 * @returns {object} {success, data:{higgsfield_id, ...}, error}
 */
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
          "Authorization": `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30초
      }
    );
    
    const higgsfieldId = response.data.id;
    console.log(`[✓] Higgsfield 요청 성공: ${higgsfieldId}`);
    
    // ========== videos 테이블에 INSERT (진행 중 상태) ==========
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
    
    // 에러 분류
    let errorType = "NETWORK_ERROR";
    if (error.response?.status === 401) {
      errorType = "UNAUTHORIZED"; // API 키 오류
    } else if (error.response?.status === 402) {
      errorType = "INSUFFICIENT_CREDITS"; // 크레딧 부족
    } else if (error.response?.status === 422) {
      errorType = "INVALID_REQUEST"; // 잘못된 요청
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
/**
 * Higgsfield API에서 5초마다 진행 상태 조회 (GET /v1/videos/{id})
 * videos 테이블 UPDATE (generation_progress, generation_status, video_url)
 * 
 * @param {string} higgsfieldId - Higgsfield에서 반환한 영상 ID
 * @param {string} videoRowId - videos 테이블의 row ID
 * @returns {object} {success, generation_progress, generation_status, video_url, error}
 */
async function pollHiggsfield(higgsfieldId, videoRowId) {
  const maxAttempts = 120; // 5초 x 120 = 600초(10분)
  let attempt = 0;
  
  console.log(`[Step 9-폴링] Higgsfield 진행률 폴링 시작 (최대 10분)`);
  
  while (attempt < maxAttempts) {
    try {
      attempt++;
      
      // Higgsfield API 조회
      const response = await axios.get(
        `${process.env.HIGGSFIELD_API_URL}/v1/videos/${higgsfieldId}`,
        {
          headers: {
            "Authorization": `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
          },
          timeout: 30000,
        }
      );
      
      const { progress, status, video_url } = response.data;
      
      console.log(`  [${attempt}회차] 진행률: ${progress}% | 상태: ${status}`);
      
      // ========== videos 테이블 UPDATE ==========
      const updateData = {
        generation_progress: progress || 0,
        generation_status: status || "processing",
        updated_at: new Date(),
      };
      
      // 완료 시 video_url 저장
      if (video_url) {
        updateData.video_url = video_url;
      }
      
      // 완료 또는 실패 시 end_time 기록
      if (status === "completed" || status === "failed") {
        updateData.generation_end_time = new Date();
      }
      
      await callDatabase("videos", "update", updateData, { id: videoRowId });
      
      // ========== 종료 조건 ==========
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
      
      // 5초 대기 후 재폴링
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.error(`  [폴링 에러] ${error.message}`);
      
      // 폴링 에러는 재시도 (연결 문제일 수 있음)
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // 10분 타임아웃
  console.log(`[✗] 폴링 타임아웃 (10분 초과)`);
  return {
    success: false,
    error: "TIMEOUT",
    message: "Higgsfield 영상 생성이 10분 이상 소요되었습니다",
  };
}

// ============================================================================
// [헬퍼 함수] formatError - 에러 메시지 사용자 친화적 변환
// ============================================================================
/**
 * 내부 에러를 사용자가 이해하기 쉬운 메시지로 변환
 */
function formatError(error, step) {
  const errorMap = {
    "TIMEOUT": "생성 시간이 너무 오래 걸리고 있어요. 다시 시도해주세요.",
    "INSUFFICIENT_CREDITS": "서버 크레딧이 부족해요. 관리자에게 연락해주세요.",
    "UNAUTHORIZED": "API 인증에 실패했어요. 설정을 확인해주세요.",
    "NETWORK_ERROR": "네트워크 연결을 확인해주세요.",
    "INVALID_REQUEST": "요청 데이터에 문제가 있어요. 다시 시도해주세요.",
    "MAX_RETRIES_EXCEEDED": `${step} 단계에서 여러 번 시도했으나 실패했어요.`,
  };
  
  return errorMap[error] || "알 수 없는 오류가 발생했어요. 다시 시도해주세요.";
}

// ============================================================================
// [Export]
// ============================================================================

module.exports = {
  callAgent,
  callHiggsfield,
  pollHiggsfield,
  formatError,
};
