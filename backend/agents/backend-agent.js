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
const { callDatabase } = require("./database-agent");

// ============================================================================
// [함수 1] callAgent - TimelyAI 에이전트 호출
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
      
      console.log(`[${step}] TimelyAI 호출: ${agentName} (시도: ${attempt}/3)`);
      
      const startTime = Date.now();
      const response = await axios.post(
        `${process.env.TIMELY_AI_BASE_URL}/api/agents/${agentName}/run`,
        {
          payload,
          apiKey: process.env.TIMELY_AI_API_KEY,
        },
        { timeout: 60000 } // 60초 타임아웃
      );
      
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
        data: response.data,
        attempt,
      };
      
    } catch (error) {
      console.error(`[✗] ${agentName} 실패 (시도 ${attempt}): ${error.message}`);
      
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
        await new Promise(resolve => setTimeout(resolve, waitMs));
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
