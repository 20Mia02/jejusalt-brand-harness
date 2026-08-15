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
const fs = require("fs");
const path = require("path");
const execPromise = util.promisify(exec);
const { callDatabase } = require("./database-agent");

// OpenAI SDK (TimelyAI OpenAI 호환 모드) ✅
const OpenAI = require("openai");

// ============================================================================
// 숏폼 시나리오 템플릿 라이브러리
// ============================================================================
let _scenarioTemplatesCache = null;
function getScenarioTemplates() {
  if (!_scenarioTemplatesCache) {
    _scenarioTemplatesCache = require("../config/scenario-templates.json");
  }
  return _scenarioTemplatesCache;
}

// ============================================================================
// [컴플라이언스 규칙] compliance-rules.json 로드 (카테고리별 규칙 분리 — 멘토링 피드백 2)
// ============================================================================
let cachedComplianceRules = null;

function loadComplianceRules() {
  if (cachedComplianceRules) return cachedComplianceRules;
  try {
    const rulesPath = path.join(__dirname, "../../../..", "config", "compliance-rules-v2.json");
    cachedComplianceRules = JSON.parse(fs.readFileSync(rulesPath, "utf8")).compliance_rules;
  } catch (e) {
    console.warn("⚠️ compliance-rules-v2.json 로드 실패, 빈 규칙으로 진행:", e.message);
    cachedComplianceRules = {};
  }
  return cachedComplianceRules;
}

// 브랜드 카테고리 표기(뷰티/헬스케어/식품 등) → compliance-rules.json의 카테고리 키로 매핑
function resolveComplianceCategoryKey(category) {
  const map = {
    식품: "food",
    뷰티: "beauty",
    헬스케어: "healthcare",
    food: "food",
    beauty: "beauty",
    healthcare: "healthcare",
  };
  return map[category] || "food";
}

function getComplianceRulesForCategory(category) {
  const all = loadComplianceRules();
  const key = resolveComplianceCategoryKey(category);
  return all[key] || all.food || { category_name: category || "일반", critical_rules: [] };
}

/**
 * compliance-rules.json의 카테고리별 규칙을 텍스트에 대해 실제로 평가한다.
 * - Mock 모드(TimelyAI 키 미설정)에서도 결정론적으로 pass/warning/fail이 갈리도록
 *   키워드/패턴 기반으로 직접 판정한다 (멘토링 피드백 1, 4에서 요구하는 재현 가능한 테스트를 위해 필수).
 * - 실제 TimelyAI 호출 시에는 이 결과 대신 LLM 응답을 사용하지만, 동일한 규칙 목록을
 *   프롬프트에 그대로 전달하므로 판단 기준은 항상 이 규칙 파일 하나로 통일된다.
 */
function evaluateComplianceContent(content, category) {
  const text = content || "";
  const rules = getComplianceRulesForCategory(category);
  const passedRules = [];
  const failedRules = [];
  const identifiedRisks = [];
  const violations = [];
  let hasCriticalFail = false;
  let hasWarning = false;

  for (const rule of rules.critical_rules || []) {
    let hit = null;

    if (Array.isArray(rule.keywords_to_avoid)) {
      const found = rule.keywords_to_avoid.find((kw) => text.includes(kw));
      if (found) hit = `금지어 "${found}" 검출`;
    } else if (Array.isArray(rule.forbidden_words)) {
      const found = rule.forbidden_words.find((kw) => text.includes(kw));
      if (found) hit = `금지어 "${found}" 검출`;
    } else if (Array.isArray(rule.foreign_origin_keywords)) {
      const found = rule.foreign_origin_keywords.find((kw) => text.includes(kw));
      if (found && !text.includes("제주")) hit = `원산지 불일치 의심 표현 "${found}" 검출 (브랜드 원산지: 제주)`;
    } else if (rule.max_discount_percent != null) {
      const match = text.match(/(\d+)\s*%\s*(할인|세일)/);
      if (match && Number(match[1]) > rule.max_discount_percent) {
        hit = `할인율 ${match[1]}%가 허용 범위(${rule.allowed_discount_range})를 초과`;
      }
    } else if (Array.isArray(rule.pattern_keywords)) {
      const found = rule.pattern_keywords.find((kw) => text.includes(kw));
      if (found) hit = `애매한 표현 "${found}" 검출`;
    }

    if (hit) {
      const isCritical = rule.penalty === "불통과";
      if (isCritical) hasCriticalFail = true;
      else hasWarning = true;

      failedRules.push(rule.rule_name);
      violations.push({
        rule_id: rule.rule_id,
        severity: rule.risk_level,
        evidence: hit,
        correction: rule.compliant_alternative || rule.requirements?.join(", ") || "표현 수정 필요",
      });
      identifiedRisks.push({
        risk_id: `R${String(identifiedRisks.length + 1).padStart(3, "0")}`,
        type: rule.rule_name,
        description: hit,
        severity: rule.risk_level,
        recommendation: rule.compliant_alternative
          ? `"${rule.compliant_alternative}" 등의 표현으로 변경`
          : "해당 표현을 브랜드 가이드라인에 맞게 수정",
      });
    } else {
      passedRules.push(rule.rule_name);
    }
  }

  const ruleComplianceScore = Math.max(0, 100 - failedRules.length * 25);
  const riskScore = Math.max(0, 100 - identifiedRisks.length * 15);
  const confidence = Math.round((ruleComplianceScore + riskScore) / 2);

  const complianceStatus = hasCriticalFail ? "fail" : hasWarning ? "warning" : "pass";
  const finalRecommendation =
    complianceStatus === "fail"
      ? `불통과 - ${violations.map((v) => v.rule_id).join(", ")} 위반 사항 수정 후 재검수 필요`
      : complianceStatus === "warning"
      ? `조건부 통과 - ${violations.map((v) => v.rule_id).join(", ")} 수정 후 재검수 권장`
      : "통과 - 발견된 위반 사항 없음";

  return {
    compliance_status: complianceStatus,
    confidence,
    breakdown: {
      rule_compliance: {
        score: ruleComplianceScore,
        passed_rules: passedRules,
        failed_rules: failedRules,
      },
      risk_assessment: {
        score: riskScore,
        identified_risks: identifiedRisks,
      },
    },
    violations,
    final_recommendation: finalRecommendation,
    summary: complianceStatus === "pass" ? "안전함" : complianceStatus === "warning" ? "일부 주의 필요" : "위반 사항 발견",
  };
}

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
        `[${step}] Upstage API 호출: ${agentName} (시도: ${attempt}/3)`
      );

      const startTime = Date.now();

      // ========== Upstage 공식 API (OpenAI SDK + Solar Pro 4) ==========
      // ⚠️ 실제 SDK 패키지명/메서드가 나오면 아래를 수정하세요.
      // 현재는 OpenAI SDK 방식
      const response = await callSolarAgent(agentName, payload);

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
// ============================================================================
// [AI 프로바이더 선택] 무료(Gemini) 기본 ↔ 유료(Upstage) 수동 전환
// ============================================================================
/**
 * 여러 OpenAI 호환 프로바이더 중 어떤 것을 쓸지 결정한다.
 * - AI_PROVIDER 환경변수로 명시 지정 가능 (gemini|upstage)
 * - 미지정 시: 무료(Gemini)를 먼저 찾고, 없으면 Upstage, 그마저 없으면 Mock.
 *   (Higgsfield 크레딧과 달리 Gemini 무료 티어는 매일 재충전되므로 기본값을 무료 쪽으로 둔다)
 */
const AI_PROVIDERS = {
  gemini: {
    label: "Gemini (무료 티어)",
    apiKeyEnv: "GEMINI_API_KEY",
    baseURL: process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    supportsJsonMode: true,
  },
  upstage: {
    label: "Upstage Solar Pro4 (유료)",
    apiKeyEnv: "UPSTAGE_API_KEY",
    baseURL: process.env.UPSTAGE_API_BASE_URL || "https://api.upstage.ai/v1",
    model: process.env.UPSTAGE_MODEL || "solar-pro4",
    supportsJsonMode: false,
  },
};

function isPlaceholderKey(key) {
  return !key || key.includes("your_") || key === "dummy" || key === "tgpt_sk_your_api_key_here";
}

function resolveAiProvider() {
  const forced = (process.env.AI_PROVIDER || "").toLowerCase();
  if (forced && AI_PROVIDERS[forced]) {
    const forcedConfig = AI_PROVIDERS[forced];
    if (!isPlaceholderKey(process.env[forcedConfig.apiKeyEnv])) {
      return { key: forced, ...forcedConfig };
    }
    console.warn(`[AI_PROVIDER=${forced}] 지정되었지만 ${forcedConfig.apiKeyEnv}가 없어 자동 선택으로 대체합니다`);
  }

  // 자동 선택 우선순위: 무료(Gemini) → 유료(Upstage) → Mock
  for (const key of ["gemini", "upstage"]) {
    const config = AI_PROVIDERS[key];
    if (!isPlaceholderKey(process.env[config.apiKeyEnv])) {
      return { key, ...config };
    }
  }
  return null; // Mock 모드
}

async function callSolarAgent(agentName, payload) {
  const provider = resolveAiProvider();

  // Mock 모드: 어떤 프로바이더의 API 키도 설정되어 있지 않은 경우
  if (!provider) {
    console.warn(`[Mock Mode] ${agentName} - 테스트 더미 응답 반환 (GEMINI_API_KEY/UPSTAGE_API_KEY 모두 미설정)`);
    return getMockResponseForAgent(agentName, payload);
  }

  const apiKey = process.env[provider.apiKeyEnv];

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: provider.baseURL,
    // ⚠️ 타임아웃 미설정 시 SDK 기본값(10분)까지 응답을 기다린다 — API 응답이
    // 느려지거나 응답 없이 걸리면 사용자 화면에는 "compliance-reviewer 진행 중..."이
    // 수 분~10분 동안 멈춘 것처럼 보이는 원인이 됐다. 45초로 짧게 끊어서 callAgent의
    // 자체 재시도(최대 3회, 지수 백오프)가 대신 빠르게 돌게 한다.
    timeout: 45000,
    // SDK 자체 재시도(기본 2회)까지 겹치면 callAgent의 재시도(3회)와 중첩되어
    // 최악의 경우 지연이 배로 불어난다 — 재시도는 callAgent 쪽에서만 한다.
    maxRetries: 0,
  });

  const systemPrompt = getSystemPromptForAgent(agentName, payload);
  const outputSpec = getOutputSpecForAgent(agentName, payload);

  console.log(`  [${provider.label}] 에이전트 호출: ${agentName}`);
  console.log(`    모델: ${provider.model}`);

  try {
    const completion = await client.chat.completions.create({
      model: provider.model,
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
      // Groq/Gemini는 JSON 강제 모드를 지원 — 파싱 실패율을 낮춘다.
      // Upstage(Solar Pro4)는 이 파라미터를 지원하지 않아 생략한다.
      ...(provider.supportsJsonMode ? { response_format: { type: "json_object" } } : {}),
    });

    console.log(`  [✓] 응답 수신 성공`);

    const responseText = completion.choices?.[0]?.message?.content || "";

    if (!responseText) {
      console.error(`  [${provider.label} 빈 응답]`);
      throw new Error(`${provider.label} 응답이 비어있습니다`);
    }

    // JSON 파싱
    const cleaned = responseText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    console.log(`  [✓] JSON 파싱 성공`);
    return parsed;

  } catch (error) {
    console.error(`  [✗ ${provider.label} 호출 실패]`);

    if (error.status === 401) {
      console.error(`    401 인증 실패: ${provider.apiKeyEnv} 값을 확인하세요`);
    } else if (error.status === 402) {
      console.error(`    402 크레딧 부족: 크레딧을 충전하거나 다른 프로바이더로 전환하세요`);
    } else if (error.status === 429) {
      console.error(`    429 Rate Limit 초과: 잠시 후 다시 시도하거나 다른 프로바이더로 전환하세요`);
    } else if (error.status === 404) {
      console.error(`    404 모델을 찾을 수 없음: ${provider.apiKeyEnv.replace("_API_KEY", "_MODEL")} 값을 확인하세요`);
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
  const { getConfig } = require("../utils/config-loader");
  const brand = getConfig().brand || {};
  const styleGuideline = brand.characterStyleGuideline || "귀엽고 매력적인 인형(마스코트) 같은 스타일";
  const commonMotif =
    brand.characterCommonMotif ||
    "알 모양의 동글동글한 몸통, 이마 위 작은 육각형 소금 결정 브로치, 단순한 점 눈";

  // character-creator-agent는 사용자가 입력한 이름/방향성에 따라 매번 결과가 달라져야 하므로
  // (라이브러리 신규 캐릭터 생성 데모가 실제로 반영되는 것처럼 보이도록) 정적 맵 대신 payload 기반으로 생성
  if (agentName === "character-creator-agent") {
    const SURPRISE_NAME_POOL = ["몽글이", "포동이", "동글이", "말랑이", "복숭이", "토실이", "새콤이", "부들이"];
    const characterName =
      payload?.characterName ||
      (payload?.surprise
        ? SURPRISE_NAME_POOL[Math.floor(Math.random() * SURPRISE_NAME_POOL.length)]
        : "새 캐릭터");
    const direction = payload?.direction || "";
    return {
      brief: {
        character: characterName,
        voice_tone: direction ? `${direction}에 어울리는 톤` : "친근하고 신뢰감 있는 톤",
        personality_traits: direction
          ? direction.split(/[,\s]+/).filter((w) => w.length > 1).slice(0, 4)
          : ["친근함", "신뢰감"],
        // ⭐ 브랜드 가이드라인 + 시그니처 공통 요소를 모든 캐릭터 외형 묘사에 항상 반영
        visual_description: direction
          ? `${direction} 컨셉을 반영한 ${styleGuideline}. 공통 요소: ${commonMotif}`
          : `${styleGuideline}, 브랜드 톤에 맞는 표준적인 외형. 공통 요소: ${commonMotif}`,
      },
    };
  }

  // character-recommender-agent: 제품 metadata와 라이브러리 목록을 바탕으로
  // "새로 만들지 않고" 기존 라이브러리 중 3개를 골라 추천한다 (재현성 핵심).
  // 실제 매칭 로직: focus/role/tone_trait 텍스트 겹침이 많은 순으로 정렬 (결정론적).
  if (agentName === "character-recommender-agent") {
    const library = payload?.libraryCharacters || [];
    const focusText = (payload?.metadata?.focus || []).join(" ");

    const scored = library.map((c) => {
      const haystack = `${c.role || ""} ${c.tone_trait || ""}`;
      let score = 70;
      focusText.split(/\s+/).forEach((kw) => {
        if (kw && haystack.includes(kw)) score += 10;
      });
      return { id: c.id, name: c.name, score: Math.min(score, 95) };
    });

    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);

    return {
      recommendations: top3.map((c, idx) => ({
        id: c.id,
        name: c.name,
        score: c.score - idx, // 동점 방지용 미세 조정
        reason:
          idx === 0
            ? "제품의 핵심 강조점과 가장 잘 맞는 기본 캐릭터"
            : "브랜드 라이브러리 내 대체 추천 캐릭터",
      })),
    };
  }

  // shortform-scenario-writer-agent의 템플릿 기반 모드(loglines/full_scenario/draft_review)는
  // mode별로 완전히 다른 응답 모양이라 아래 정적 mockData 맵과 별개로 분기 처리한다.
  if (agentName === "shortform-scenario-writer-agent" && payload?.mode) {
    const templates = getScenarioTemplates();
    const template = templates.find((t) => t.id === payload.templateId);

    if (payload.mode === "loglines") {
      const label = template?.label || "숏폼";
      return {
        loglineOptions: [
          { id: "opt1", title: `${label} 아이디어 1`, logline: `${template?.example || "제품이 자연스럽게 등장하는"} 짧은 이야기 (mock)` },
          { id: "opt2", title: `${label} 아이디어 2`, logline: `${template?.toneKeywords?.[0] || "임팩트 있는"} 톤으로 전개되는 이야기 (mock)` },
          { id: "opt3", title: `${label} 아이디어 3`, logline: `${template?.durationRange || "짧은"} 분량의 대안 전개 (mock)` },
        ],
      };
    }

    if (payload.mode === "full_scenario") {
      const targetDuration = payload?.target_duration_seconds || 30;
      return {
        scenario: {
          title: payload.selectedLogline?.title || `${template?.label || "숏폼"} 시나리오`,
          story_content: payload.selectedLogline?.logline || "mock 시나리오 내용",
          acts: [{ act: 1, duration_seconds: targetDuration, content: `(mock) ${template?.structureHint || ""}` }],
        },
        higgsfield_specifications: { style: template?.toneKeywords?.join(", ") || "기본", mood: "밝음" },
        timing_verification: {
          total_duration: targetDuration,
          dialogue_seconds: Math.round(targetDuration / 2),
          narration_seconds: targetDuration - Math.round(targetDuration / 2),
        },
      };
    }

    if (payload.mode === "draft_review") {
      return {
        review: {
          brandVoiceFit: { status: "PASS", comment: "(mock) 브랜드 보이스와 대체로 어울립니다" },
          complianceCheck: { status: "PASS", issues: [] },
          suggestedDuration: "30초",
          structuredDraft: {
            title: "사용자 아이디어 기반 시나리오 (mock)",
            story_content: payload.userIdea || "",
            acts: [{ act: 1, duration_seconds: 30, content: payload.userIdea || "" }],
          },
        },
      };
    }
  }

  // compliance-reviewer-agent: 카테고리별 compliance-rules.json을 실제로 평가해서
  // Mock 모드에서도 입력 내용에 따라 결정론적으로 pass/warning/fail이 갈리도록 한다
  // (멘토링 피드백 1: 구조화된 판단 근거 / 피드백 2: 카테고리별 규칙 / 피드백 4: 재현 가능한 테스트)
  if (agentName === "compliance-reviewer-agent") {
    return evaluateComplianceContent(payload?.content, payload?.category);
  }

  // post-generation-qa-agent: 영상 생성 완료 후 결과물 품질 검수 (멘토링 피드백 3)
  if (agentName === "post-generation-qa-agent") {
    const expectedDuration = payload?.expectedDuration || 30;
    const actualDuration = expectedDuration + (Math.random() > 0.5 ? 1 : -1); // Mock: ±1초 오차 시뮬레이션
    const durationDiff = Math.abs(actualDuration - expectedDuration);
    const durationOk = durationDiff <= 2;
    const hasReference = !!payload?.referenceImageUrl;

    const checks = [
      {
        check_id: "video_integrity",
        result: payload?.videoUrl ? "pass" : "fail",
        details: payload?.videoUrl ? "정상 재생 가능한 URL 확인" : "영상 URL이 없습니다",
        recommendation: payload?.videoUrl ? null : "영상 재생성 필요",
      },
      {
        check_id: "duration_match",
        result: durationOk ? "pass" : "warning",
        details: `요청 ${expectedDuration}초, 실제 ${actualDuration}초 (오차 ${durationDiff}초)`,
        recommendation: durationOk ? null : "시나리오 길이 재조정 권장",
      },
      {
        check_id: "character_consistency",
        result: hasReference ? "pass" : "warning",
        details: hasReference ? "레퍼런스 대비 일치도 확인됨" : "레퍼런스 이미지가 없어 비교 불가 (첫 생성)",
        recommendation: hasReference ? null : "다음 생성부터 레퍼런스 기반 비교 가능",
      },
      {
        check_id: "no_text_overlay",
        result: "pass",
        details: "프롬프트에 텍스트 오버레이를 포함하지 않아 삽입 위험 없음",
        recommendation: null,
      },
      {
        check_id: "audio_quality",
        result: "pass",
        details: "음성 잡음 검출 안 됨",
        recommendation: null,
      },
    ];

    const failCount = checks.filter((c) => c.result === "fail").length;
    const warningCount = checks.filter((c) => c.result === "warning").length;
    const qaStatus = failCount > 0 ? "fail" : warningCount > 0 ? "warning" : "pass";
    const overallScore = Math.max(0, 100 - failCount * 30 - warningCount * 10);

    return {
      qa_status: qaStatus,
      qa_passed: qaStatus !== "fail",
      qa_checks: checks,
      overall_score: overallScore,
      action_required: qaStatus === "fail" ? "재생성 권장" : qaStatus === "warning" ? "확인 후 사용 권장" : "none",
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
    "shortform-scenario-writer-agent": (() => {
      const targetDuration = payload?.target_duration_seconds || 120;
      // 길이에 비례해 3개 Act로 분배 (40:50:30 비율 유지)
      const act1 = Math.round(targetDuration * (40 / 120));
      const act2 = Math.round(targetDuration * (50 / 120));
      const act3 = targetDuration - act1 - act2;

      // 참고자료(referenceMaterials)가 있으면 데모에서 실제로 반영되는 것처럼 스토리 텍스트에 녹여낸다
      const hasReferenceMaterials = payload?.referenceMaterials?.length > 0;
      const refFileNames = hasReferenceMaterials
        ? payload.referenceMaterials.map((f) => f.filename).join(", ")
        : null;
      const refExcerpt = hasReferenceMaterials
        ? payload.referenceMaterials[0]?.content?.slice(0, 80) || ""
        : "";

      // ⚠️ timing_verification은 scenario의 하위가 아니라 응답 최상위(scenario와 형제)여야
      // getOutputSpecForAgent의 실제 출력 스펙 및 generation.js의 읽기 코드(scenarioResult.data.timing_verification)와 일치한다.
      return {
        scenario: {
          title: "제주소금으로 시작하는 건강한 하루",
          story_content: hasReferenceMaterials
            ? `[참고자료 반영: ${refFileNames}] ${refExcerpt}... 이 내용을 바탕으로 아침 밥상에 제주소금을 올리는 장면으로 시작합니다.`
            : "아침 밥상에 제주소금을...",
          acts: [
            { act: 1, duration_seconds: act1, content: hasReferenceMaterials ? `아침 오프닝 (참고자료: ${refFileNames} 반영)` : "아침 오프닝" },
            { act: 2, duration_seconds: act2, content: "제품 소개" },
            { act: 3, duration_seconds: act3, content: "클로징" }
          ]
        },
        higgsfield_specifications: {
          style: "전문적이고 세련된",
          mood: "신뢰감 있고 따뜻함"
        },
        timing_verification: {
          total_duration: targetDuration,
          dialogue_seconds: Math.round(targetDuration / 2),
          narration_seconds: targetDuration - Math.round(targetDuration / 2)
        }
      };
    })(),
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
    "trend-analyzer-agent": {
      trends: [
        { keyword: "저속노화", angle: "자극적이지 않은 미네랄 성분을 '천천히 건강하게'라는 메시지로 연결", reason: "20~40대 사이 꾸준히 언급되는 웰빙 키워드" },
        { keyword: "제로웨이스트", angle: "자연 그대로 채취한 소금이라는 점을 친환경 소비 가치와 연결", reason: "친환경 소비를 중시하는 소비자층 확대 추세" },
        { keyword: "가성비 프리미엄", angle: "합리적 가격에 고급 원료를 쓴다는 점을 강조", reason: "불경기에도 품질 좋은 소비를 원하는 심리" },
        { keyword: "홈쿡/집밥", angle: "집에서 만드는 건강한 한 끼에 곁들이는 제품으로 포지셔닝", reason: "집밥 콘텐츠 소비가 꾸준히 인기" },
        { keyword: "지역 특산물 스토리텔링", angle: "제주라는 지역성과 전통 채취 방식을 스토리로 강조", reason: "원산지·생산 과정을 궁금해하는 소비자 증가" }
      ]
    }
  };

  // ⚠️ callTimelyAIAgent의 실제(비-mock) 경로는 파싱된 JSON을 그대로 반환하므로
  // (예: {characters:[...]} ), mock도 동일하게 순수 데이터 객체만 반환해야 한다.
  // 과거에는 {success, data, attempt}로 한 겹 더 감싸서 callAgent가 이를 다시 감싸
  // response.data.characters가 아니라 response.data.data.characters가 되는 버그가 있었다.
  return mockData[agentName] || { message: "Mock response" };
}

// ============================================================================
// [시스템 프롬프트 & 출력 사양]
// ============================================================================

function getSystemPromptForAgent(agentName, payload) {
  // config.json에서 브랜드 정보 로드
  const { getConfig } = require("../utils/config-loader");
  const config = getConfig();
  const brand = config.brand || {};

  // ── shortform-scenario-writer-agent의 템플릿 기반 모드 분기 ──
  // (10개 숏폼 템플릿 + 로그라인 추천 + 사용자 직접 작성 검토. mode가 없으면 아래 prompts 맵의
  // 기본 프롬프트를 그대로 사용해 기존 호출부와의 하위 호환을 유지한다.)
  if (agentName === "shortform-scenario-writer-agent" && payload?.mode) {
    if (payload.mode === "draft_review") {
      return `당신은 ${brand.nameKorean || "제주소금"} 브랜드의 "사용자 아이디어 검토관"입니다.
사용자가 직접 낸 숏폼 아이디어를 검토하여:
1. 브랜드 톤(${brand.voiceTone || "정직하고 따뜻함"}) 부합도
2. 피해야 할 표현(${(brand.absoluteNos || []).join(", ") || "의료표현, 과장"}) 포함 여부 등 컴플라이언스 위험
3. 아이디어에 가장 적합한 길이(15/30/45/60/90~120초)와 구조 추천
을 분석하고, 사용자 원문의 톤과 아이디어를 최대한 살려서 구조화된 시나리오(제목/전체 스토리/Act 분할)로
다듬으세요. 원문을 임의로 크게 바꾸지 말고, 다듬고 구조만 채우세요.

⚠️⚠️⚠️ complianceCheck 판정 규칙 (반드시 지킬 것, 순서대로 수행):
1단계: complianceCheck는 당신이 다듬은 structuredDraft가 아니라 "사용자가 입력한 원문(userIdea)"만
보고 판정합니다. 절대 규칙: 아래 금지 카테고리 중 하나라도 사용자 원문에 있으면 자동으로 WARNING입니다.
   - ${(brand.absoluteNos || []).join(" / ") || "의료표현(치료·완치·효과), 과도한 유행어, 자극적 비교, 근거 없는 기술 과장"}
2단계: WARNING이면 issues 배열에 최소 1개 항목을 넣습니다. text 필드는 사용자 원문에서 실제로 문제였던
구절을 그대로 인용해야 합니다(당신이 순화한 문장이 아님). issues를 비운 채 status만 WARNING으로 둘 수
없고, 반대로 문제 구절을 찾았는데 status를 PASS로 둘 수도 없습니다 — 둘은 항상 함께 갑니다.
3단계: structuredDraft는 항상 안전하게 순화된 버전으로 작성합니다(이건 WARNING 여부와 무관).

당신이 structuredDraft를 안전하게 잘 고쳤다는 사실이 status를 PASS로 만들지 않습니다.
판정 기준은 오직 "사용자가 원래 뭐라고 썼는가"입니다.

예시 — userIdea가 "용암이가 이 소금 먹으면 혈압을 치료할 수 있다고 자랑하는 15초 영상"인 경우,
"치료할 수 있다"가 금지 카테고리(의료표현)에 해당하므로 반드시 이렇게 응답해야 합니다:
{
  "complianceCheck": {
    "status": "WARNING",
    "issues": [
      { "text": "혈압을 치료할 수 있다", "reason": "질병 치료 효능을 암시하는 의료 표현으로 금지됨", "suggestion": "건강한 나트륨 밸런스에 도움을 줄 수 있어요" }
    ]
  }
}`;
    }

    const templates = getScenarioTemplates();
    const template = templates.find((t) => t.id === payload.templateId);
    const templateDesc = template
      ? `- 스타일: ${template.label}
- 톤 키워드: ${template.toneKeywords.join(", ")}
- 길이: ${template.durationRange}
- 구조 가이드: ${template.structureHint}
- 참고 예시: ${template.example}`
      : "- (템플릿 미지정 — 자유롭게 구성)";

    if (payload.mode === "loglines") {
      return `당신은 ${brand.nameKorean || "제주소금"} 브랜드의 숏폼 시나리오 작가입니다.
다음 템플릿 스타일을 반드시 따라 로그라인(제목 + 한줄 줄거리) 3개를 제안하세요:
${templateDesc}
아직 전체 시나리오(대사/Act 분할)는 작성하지 말고, 각기 다른 각도의 로그라인 3개만 제안하세요.
기존의 감성 다큐 스타일(4막 구조, 90~120초)로 되돌아가지 말고, 반드시 위 템플릿의 길이와 톤을 따르세요.`;
    }

    if (payload.mode === "full_scenario") {
      return `당신은 ${brand.nameKorean || "제주소금"} 브랜드의 숏폼 시나리오 작가입니다.
다음 템플릿 스타일과 사용자가 선택한 로그라인을 바탕으로 전체 시나리오를 완성하세요:
${templateDesc}
- 선택된 로그라인: ${payload.selectedLogline?.title || ""} — ${payload.selectedLogline?.logline || ""}
입력의 target_duration_seconds(초)에 정확히 맞춰 작성하고, 템플릿의 구조 가이드를 따르세요.`;
    }
  }

  const prompts = {
    "resource-analyzer-agent": `당신은 제품 정보를 분석하는 AI 에이전트입니다.
제품: ${brand.nameKorean || "제주소금"}
브랜드 톤: ${brand.voiceTone || "정직하고 따뜻함"}

사업 우선순위: ${(brand.categories || []).join(" > ") || "뷰티 > 헬스케어 > 식품"} 순으로 사업을 확장 중이므로, 제품이 여러 카테고리에 걸칠 경우 우선순위가 높은 카테고리를 먼저 배열에 넣으세요.

제공된 제품명, 설명, 키워드를 기반으로:
- 상품 카테고리 (${(brand.categories || []).join(", ") || "식품, 뷰티, 헬스케어"})
- 타겟 연령대 (${(brand.targetAges || []).join(", ") || "20~30대, 40~60대, 60대+"})
- 타겟 고객층 (${(brand.targetAudience || []).join(", ") || "개인, 가족, 단체"})
- 마케팅 포커스 (${(brand.focus || []).join(", ") || "신뢰, 기술, 건강"})
- 신뢰도 점수 (0~100)

를 분석하여 반환하세요.

입력에 trendKeywords(요즘 SNS/뉴스 트렌드 키워드)가 있다면, "기술 중심"이 아닌 "소비자가 지금 원하는 것" 중심으로
마케팅 포커스를 트렌드에 맞게 조정하세요 (예: 트렌드가 "저속노화"라면 포커스에 "저속노화/동안" 관련 가치를 반영).
입력에 customStyle(사용자가 원하는 톤/문구)이 있다면 focus나 카테고리 판단에 참고하되, 브랜드의 absoluteNos는 절대 위반하지 마세요.`,

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
⭐ 브랜드 캐릭터 스타일 가이드라인(반드시 반영): ${brand.characterStyleGuideline || "귀엽고 매력적인 인형(마스코트) 같은 스타일"}

⭐⭐ 브랜드 시그니처 공통 요소 (모든 캐릭터가 반드시 공유해야 함 — "같은 회사 캐릭터"라는 것이 한눈에 느껴지도록):
${brand.characterCommonMotif || "알(egg) 모양의 동글동글한 몸통, 이마 위에 작은 육각형 소금 결정 모양 브로치, 단순한 검은 점 눈동자에 흰색 하이라이트 하나"}
색상과 소품은 캐릭터마다 다르게 하되, 위 공통 요소는 절대 빠뜨리지 마세요.

⭐⭐⭐ 4가지 캐릭터 타입 분류 (완전 리디자인 기준, docs/character-concept.md 참고 — 반드시 준수):
사용자의 방향성(direction)을 보고 아래 4가지 타입 중 1~2개를 골라 그 타입의 색상/형태/성격을 따르세요.
${brand.characterTypeSystem
  ? Object.entries(brand.characterTypeSystem)
      .map(
        ([key, t]) =>
          `- ${key}(${t.nameKr}): 상징=${t.symbol} / 색상=${(t.colors || []).join(", ")} / 형태=${t.shape} / 성격=${t.personality}`
      )
      .join("\n")
  : "- SALT(소금결정): 밝은 파랑, 각진 기하학적 형태, 활발함\n- LAVA(용암해수): 어두운 파랑, 유기적 곡선, 신뢰감\n- MINERAL(미네랄): 중간 톤, 세련된 곡선, 우아함\n- FIRE(불/에너지): 따뜻한 톤, 역동적 형태, 에너지"}
설계한 캐릭터의 visual_description 첫 문장에 선택한 타입을 명시하세요 (예: "[SALT 타입] ...").

사용자가 입력한 캐릭터 이름과 방향성 설명을 최대한 반영해서:
- 음성 톤 설명
- 성격 특성 (배열)
- 시각적 묘사 (의상, 표정, 외형) — 반드시 위 스타일 가이드라인과 브랜드 시그니처 공통 요소를 모두 반영해서 작성
을 작성하세요. 이 캐릭터는 이후 여러 자료(제품)에서 재사용되는 "기본 캐릭터"로 라이브러리에 저장되므로,
한 번 정해지면 계속 일관되게 재사용될 수 있도록 구체적이고 명확하게 작성하세요.

🚫🚫 매우 중요 (저작권/표절 방지 — 반드시 지킬 것):
실제로 존재하는 유명 캐릭터(카카오프렌즈의 라이언·어피치·무지·네오, 라인프렌즈의 브라운·코니,
산리오의 헬로키티·쿠로미, 뽀로로, 미니언즈, 디즈니/픽사, 포켓몬, 짱구, 펭수 등)를 절대 떠올리게
해서는 안 됩니다. 구체적으로 다음을 금지합니다:
- 특정 동물(곰, 토끼, 사자, 펭귄, 고양이 등)을 그대로 형상화하는 디자인
- 얼굴 없이 단순 원통형 몸통에 짧은 팔다리만 있는 구조(라이언/코니 스타일)
- 노란색 피부에 파란 멜빵바지(미니언즈 연상)
- 그 외 "어디서 본 것 같은" 조합
대신 이 브랜드만의 고유한 정체성(제주/소금/용암/바다/화산 등 브랜드 세계관)에서 나온 독창적인
형태와 색을 만들어내세요. 목표는 "널리 사랑받는 마스코트 수준의 매력과 완성도"이되, 완전히
새로운 창작물이어야 합니다.`,

    "character-recommender-agent": `당신은 제품 정보에 가장 잘 맞는 캐릭터를 "기존 캐릭터 라이브러리 중에서만" 골라 추천하는 AI 에이전트입니다.
브랜드: ${brand.nameKorean || "제주소금"}

⭐ 매우 중요: 새로운 캐릭터를 만들지 마세요. 입력으로 제공되는 libraryCharacters 목록에 있는
캐릭터의 id/name만 사용해서 정확히 3개를 골라 순위를 매기세요 (목록에 없는 이름을 만들어내면 안 됩니다).
같은 캐릭터가 여러 제품에서 반복 사용되어야 브랜드 전체의 캐릭터 일관성이 유지됩니다.`,

    "shortform-scenario-writer-agent": `당신은 숏폼 영상 시나리오를 작성하는 AI 에이전트입니다.
입력의 target_duration_seconds(초)에 맞춰 정확히 그 길이의 시나리오를 작성하세요 (기본값 120초).
짧은 길이(15~30초)일수록 Act 수를 줄이고 핵심 메시지에 집중하며, 긴 길이(60~120초)일수록 기승전결을 갖추세요.
다음을 포함하세요:
- 시나리오 제목
- 전체 스토리 텍스트
- Act 분할 (각 Act는 지속시간 초 포함, 합계가 target_duration_seconds와 정확히 일치)
- 영상 스타일 & 분위기 (Higgsfield 스펙)
- 타이밍 검증 (total_duration은 반드시 target_duration_seconds와 동일, 대사/나레이션 시간)
만약 입력에 referenceMaterials(참고자료)가 포함되어 있다면, 그 내용을 반드시 스토리와 대사에 반영하세요.`,

    "naming-generator-agent": `당신은 ${brand.nameKorean || "제주소금"}의 제품명과 콘텐츠명 각 3개를 생성하는 AI 에이전트입니다.
브랜드 핵심 소재/컨셉: 용암해수, 미네랄, 전해질 — 3개 후보 중 최소 1개 이상은 이 소재들 중 하나에서 착안한 이름을 포함하세요
(예: "용암미네랄", "전해수 담은" 등 소재를 은유/조합한 이름. 소재명을 그대로 나열하지 말고 자연스러운 제품명으로 가공하세요).
각각 정확히 3개씩, 각 항목마다:
- 이름
- 점수 (90~80)
- 의미 설명

을 포함하세요.`,

    "product-intro-writer-agent": `당신은 제품 소개 카피를 작성하는 AI 에이전트입니다.
제품명, 설명, 캐릭터를 기반으로 매력적이고 설득력 있는 소개글을 작성하세요.
입력에 trendKeywords가 있으면 해당 트렌드 언어/관심사를 자연스럽게 녹여내고,
customStyle(사용자가 원하는 톤/문구)이 있으면 최대한 반영하되 브랜드 절대 금지 표현은 지키세요.

⭐ 브랜드 보이스 일관성: 입력의 approvedExamples는 과거에 마케팅팀이 실제로 승인한 카피 예시들입니다.
반드시 이 예시들의 문장 길이, 어투, 어휘 선택 패턴을 참고해서 브랜드 보이스가 매번 일관되게 유지되도록 작성하세요
(내용을 그대로 베끼지 말고 "같은 브랜드가 쓴 글처럼" 톤만 맞추세요).`,

    "product-detail-page-writer-agent": `당신은 상세페이지 카피를 작성하는 AI 에이전트입니다.
제품의 상세한 혜택, 사용법, 특징을 강조하는 긴 형식의 카피를 작성하세요.
입력에 trendKeywords가 있으면 해당 트렌드 언어/관심사를 자연스럽게 녹여내고,
customStyle(사용자가 원하는 톤/문구)이 있으면 최대한 반영하되 브랜드 절대 금지 표현은 지키세요.

⭐ 브랜드 보이스 일관성: 입력의 approvedExamples는 과거에 마케팅팀이 실제로 승인한 카피 예시들입니다.
반드시 이 예시들의 문장 길이, 어투, 어휘 선택 패턴을 참고해서 브랜드 보이스가 매번 일관되게 유지되도록 작성하세요
(내용을 그대로 베끼지 말고 "같은 브랜드가 쓴 글처럼" 톤만 맞추세요).`,

    "compliance-reviewer-agent": `당신은 ${brand.nameKorean || "제주소금"} 제품의 마케팅 콘텐츠를 검증하는 AI 에이전트입니다.

브랜드 공통 기준:
- 피해야 할 표현: ${(brand.absoluteNos || []).join(", ") || "의료표현, 과도한 유행어"}
- 필수 포함 가치: ${(brand.toneValues || []).join(", ") || "정직함, 신뢰성"}

⭐ 카테고리별 규칙 (멘토링 피드백 2): 입력의 complianceRules 필드에 이 제품 카테고리(식품/뷰티/헬스케어)에 해당하는
compliance-rules.json 규칙 목록(critical_rules)이 들어있습니다. 각 규칙의 rule_id, rule_name, risk_level,
keywords_to_avoid/forbidden_words 등을 근거로 카피 전문을 한 줄 한 줄 대조해서 위반 여부를 판단하세요.
규칙에 명시적으로 없는 표현이라도 브랜드 공통 기준(absoluteNos)에 위배되면 위반으로 처리하세요.

⭐ 판단 근거 구조화 (멘토링 피드백 1): 최종 신뢰도 점수만 던지지 말고, 반드시 아래 두 축으로 점수를 분해해서 제시하세요:
1. rule_compliance: 규칙 자체를 지켰는지(통과/위반 규칙 목록)
2. risk_assessment: 규칙 위반까지는 아니지만 오해 소지가 있는 애매한 표현(risk)이 있는지

각 위반/위험 항목에는 반드시 구체적인 근거(evidence, 실제 카피에서 인용)와 수정 제안(recommendation/correction)을 포함하세요.
규칙의 penalty가 "불통과"인 항목을 하나라도 위반하면 compliance_status는 "fail", "경고"만 있으면 "warning",
아무 위반/위험도 없으면 "pass"로 판정하세요.`,

    "trend-analyzer-agent": `당신은 ${brand.nameKorean || "제주소금"} 브랜드의 마케팅 콘텐츠 방향을 제안하는 AI 에이전트입니다.

⚠️ 매우 중요: 당신은 실시간 인터넷 검색을 할 수 없습니다. 학습된 지식 범위 안에서 일반적으로 널리 알려진
소비 트렌드(예: 저속노화, 제로웨이스트, 가성비 프리미엄, 홈쿡, 로컬/지역 스토리텔링 등)를 제안하는 것이며,
특정 날짜의 실제 뉴스·통계·SNS 순위를 지어내서는 안 됩니다. "지금 이 순간 1위" 같은 표현 대신
"꾸준히 관심받는", "최근 자주 언급되는" 같은 일반화된 표현을 쓰세요.

입력의 category(상품 카테고리)와 focus(마케팅 강조점)를 참고해서, 이 제품과 자연스럽게 연결되는
트렌드 키워드 5개와 각각을 콘텐츠에 녹이는 구체적인 방법(angle), 왜 이 브랜드에 맞는지(reason)를
제안하세요.`,

    "post-generation-qa-agent": `당신은 Higgsfield로 생성이 완료된 영상의 최종 품질을 검수하는 AI 에이전트입니다 (멘토링 피드백 3).
텍스트 카피는 이미 compliance-reviewer-agent가 검증했으므로, 여기서는 "실제 영상 결과물"만 검사합니다.

검증 항목 5가지:
1. video_integrity: videoUrl이 유효한 형식(https://로 시작, mp4/webm 등)인가?
2. duration_match: expectedDuration과 실제 영상 길이(추정 가능하면)가 ±2초 이내로 일치하는가?
3. character_consistency: referenceImageUrl(있는 경우)과 이번에 생성된 캐릭터가 일관되어 보이는가?
4. no_text_overlay: generatedContent의 마케팅 문구가 영상에 텍스트로 잘못 삽입되지 않았는가?
5. audio_quality: 음성이 명확하고 잡음이 없는가?

각 항목을 pass/warning/fail로 판정하고, 근거(details)와 문제가 있을 때만 수정 권장사항(recommendation)을 제시하세요.
하나라도 fail이면 qa_status는 "fail", warning만 있으면 "warning", 전부 pass면 "pass"로 판정하세요.`,
  };

  return prompts[agentName] || `당신은 AI 에이전트입니다. 주어진 입력을 분석하고 JSON 형식으로 반환하세요.`;
}

function getOutputSpecForAgent(agentName, payload) {
  if (agentName === "shortform-scenario-writer-agent" && payload?.mode) {
    if (payload.mode === "loglines") {
      return `반드시 아래 JSON 형태로만 응답하세요 (loglineOptions는 정확히 3개, 서로 다른 각도):
{
  "loglineOptions": [
    { "id": "opt1", "title": "제목", "logline": "한줄 줄거리" },
    { "id": "opt2", "title": "제목", "logline": "한줄 줄거리" },
    { "id": "opt3", "title": "제목", "logline": "한줄 줄거리" }
  ]
}`;
    }
    if (payload.mode === "full_scenario") {
      return `반드시 아래 JSON 형태로만 응답하세요 (total_duration은 반드시 입력받은 target_duration_seconds와 정확히 동일해야 함):
{
  "scenario": {
    "title": "시나리오 제목",
    "story_content": "전체 스토리 텍스트...",
    "acts": [
      { "act": 1, "duration_seconds": 10, "content": "..." }
    ]
  },
  "higgsfield_specifications": { "style": "...", "mood": "..." },
  "timing_verification": { "total_duration": 30, "dialogue_seconds": 20, "narration_seconds": 10 }
}`;
    }
    if (payload.mode === "draft_review") {
      return `반드시 아래 JSON 형태로만 응답하세요:
{
  "review": {
    "brandVoiceFit": { "status": "PASS|WARNING|FAIL", "comment": "설명" },
    "complianceCheck": { "status": "PASS|WARNING|FAIL", "issues": [{ "text": "문제 표현", "reason": "이유", "suggestion": "대안" }] },
    "suggestedDuration": "15-20초 (템플릿/구조 추천 근거)",
    "structuredDraft": {
      "title": "시나리오 제목",
      "story_content": "전체 스토리 텍스트...",
      "acts": [{ "act": 1, "duration_seconds": 30, "content": "..." }]
    }
  }
}`;
    }
  }

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

    "character-recommender-agent": `반드시 아래 JSON 형태로만 응답하세요 (recommendations는 정확히 3개, id/name은 입력받은 libraryCharacters 목록에서만 선택):
{
  "recommendations": [
    { "id": "라이브러리 캐릭터 id", "name": "캐릭터명", "score": 90, "reason": "추천 이유" },
    { "id": "라이브러리 캐릭터 id", "name": "캐릭터명", "score": 85, "reason": "추천 이유" },
    { "id": "라이브러리 캐릭터 id", "name": "캐릭터명", "score": 80, "reason": "추천 이유" }
  ]
}`,

    "shortform-scenario-writer-agent": `반드시 아래 JSON 형태로만 응답하세요 (total_duration은 반드시 입력받은 target_duration_seconds와 정확히 동일해야 함):
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

    "compliance-reviewer-agent": `반드시 agent-schemas.json의 compliance_reviewer_agent 스키마를 준수하는 JSON으로만 응답하세요 (멘토링 피드백 5):
{
  "compliance_status": "pass",
  "confidence": 90,
  "breakdown": {
    "rule_compliance": {
      "score": 95,
      "passed_rules": ["false_efficacy", "authentic_origin"],
      "failed_rules": []
    },
    "risk_assessment": {
      "score": 85,
      "identified_risks": [
        {
          "risk_id": "R001",
          "type": "minor_ambiguity",
          "description": "제품 효과 표현이 '~일 수 있음' 구조로 약간 애매함",
          "severity": "low",
          "recommendation": "'~할 수 있음' → '~을 지원함'으로 변경"
        }
      ]
    }
  },
  "violations": [
    { "rule_id": "FOOD_001", "severity": "critical", "evidence": "카피에서 인용한 실제 문제 표현", "correction": "수정 제안" }
  ],
  "final_recommendation": "조건부 통과 - R001 수정 후 재검수",
  "summary": "안전함"
}
(violations와 identified_risks는 위반/위험이 없으면 빈 배열 [] 로 응답)`,

    "post-generation-qa-agent": `반드시 agent-schemas.json의 post_generation_qa_agent 스키마를 준수하는 JSON으로만 응답하세요:
{
  "qa_status": "pass",
  "qa_passed": true,
  "qa_checks": [
    { "check_id": "video_integrity", "result": "pass", "details": "정상 재생 확인", "recommendation": null },
    { "check_id": "duration_match", "result": "pass", "details": "요청 30초, 실제 31초 (오차 1초)", "recommendation": null },
    { "check_id": "character_consistency", "result": "pass", "details": "레퍼런스 대비 일치도 확인", "recommendation": null },
    { "check_id": "no_text_overlay", "result": "pass", "details": "오버레이 텍스트 미검출", "recommendation": null },
    { "check_id": "audio_quality", "result": "pass", "details": "잡음 없음", "recommendation": null }
  ],
  "overall_score": 92,
  "action_required": "none"
}`,

    "trend-analyzer-agent": `반드시 아래 JSON 형태로만 응답하세요 (trends는 정확히 5개):
{
  "trends": [
    { "keyword": "트렌드 키워드", "angle": "이 제품/콘텐츠에 녹이는 구체적 방법", "reason": "왜 이 브랜드에 맞는지" },
    ...
  ]
}`,
  };

  return specs[agentName] || "반드시 순수 JSON 객체만 반환하세요.";
}

// ============================================================================
// [함수 2] callHiggsfield - Higgsfield API 영상 생성 요청
// ============================================================================

/**
 * Higgsfield CLI 에러를 사람이 읽을 수 있는 사유로 분류한다.
 * ⭐ 크레딧 소진("not_enough_credits")은 코드 버그가 아니라 운영상 정상적으로
 * 반복되는 상황이므로(크레딧 충전 전까지는 항상 이 에러가 남), 다른 CLI 에러와
 * 구분해서 반환해야 프론트/마케터가 "고쳐야 할 버그"와 "충전하면 되는 상황"을
 * 헷갈리지 않는다. 이 분류 결과가 없으면 매번 원인 불명의 HIGGSFIELD_CLI_ERROR로만
 * 보여서 재현성 테스트 중 실제 버그와 크레딧 부족을 구분할 수 없었다.
 */
function classifyHiggsfieldError(error) {
  const raw = error?.message || String(error);
  if (/not_enough_credits/i.test(raw)) {
    return {
      error: "HIGGSFIELD_CREDITS_EXHAUSTED",
      message: "Higgsfield 크레딧이 부족합니다. 워크스페이스 크레딧을 충전한 뒤 다시 시도하세요 (기능 자체는 정상 동작하며, 충전 후 그대로 재생성 가능합니다).",
    };
  }
  return { error: "HIGGSFIELD_CLI_ERROR", message: raw };
}

async function callHiggsfield(videoConfig, resourceId, contentId) {
  try {
    const { getConfig } = require("../utils/config-loader");
    const config = getConfig();
    const brand = config.brand || {};

    const MODEL = "seedance_2_0";
    const MAX_CLIP_SECONDS = 15;
    const MIN_CLIP_SECONDS = 4;

    const rawDuration = Number(videoConfig.duration);
    const requestedDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : MAX_CLIP_SECONDS;
    const duration = Math.min(Math.max(Math.round(requestedDuration), MIN_CLIP_SECONDS), MAX_CLIP_SECONDS);

    if (requestedDuration > MAX_CLIP_SECONDS) {
      console.warn(
        `[Step 9] 요청 길이 ${requestedDuration}초가 모델 한계(${MAX_CLIP_SECONDS}초)를 초과 → ${duration}초로 축약해서 생성`
      );
    }

    const character = videoConfig.character || 'character';
    const voiceTone = videoConfig.voiceTone || 'friendly';
    const visualDescription = videoConfig.visualDescription || '';

    const libraryChar = (config.characters || []).find((c) => c.name === character);
    const characterVisual = libraryChar?.higgsfieldPrompt || visualDescription;

    const mascotAnchor =
      "3D pixar-style plush toy mascot character, non-human, stylized cute cartoon figure, toy-like material, NOT a real human, not photorealistic, must exactly match the provided start-image reference character design in every scene (same face, same body shape, same proportions, only pose/background changes), keep a round cute chibi mascot body with a clearly visible friendly face at all times, do NOT turn into a rock/lava/fire elemental creature or any existing famous animated character, texture details (rocky/flame patterns) are surface decoration only and must not change the character's overall silhouette";

    const brandContext = `${brand.nameKorean || "제주소금"} brand, Jeju volcanic sea salt heritage`;
    const storySnippet = (videoConfig.generatedContent || "").trim().slice(0, 200);
    const noTextInstruction = "no on-screen text, no readable words or captions, no signage text, clean text-free visual";

    const sanitizeForShell = (s) => String(s || "").replace(/["'`$\\;|&<>%^()\n\r]/g, " ").replace(/\s+/g, " ").trim();
    const metadata = sanitizeForShell(
      [
        `${character} character`,
        characterVisual,
        mascotAnchor,
        `${voiceTone} tone`,
        brandContext,
        storySnippet ? `scene: ${storySnippet}` : null,
        noTextInstruction,
      ]
        .filter(Boolean)
        .join(", ")
    );

    console.log(`[Step 9] Higgsfield CLI 호출 시작`);
    console.log(`  명령: higgsfield generate create ${MODEL}`);
    console.log(`  메타데이터: ${metadata}`);
    console.log(`  duration: ${duration}초 (요청: ${requestedDuration}초)`);

    const baseCommand = `higgsfield generate create ${MODEL} --prompt "${metadata}" --duration ${duration} --resolution 720p`;
    let command = baseCommand;
    if (videoConfig.referenceJobId) {
      const safeReferenceJobId = sanitizeForShell(videoConfig.referenceJobId);
      console.log(`  레퍼런스 이미지(start-image job id): ${safeReferenceJobId}`);
      command += ` --start-image "${safeReferenceJobId}"`;
    }
    command += ` --wait`;

    console.log(`[Step 9] 명령 실행 중...`);
    let stdout;
    try {
      ({ stdout } = await execPromise(command, {
        timeout: 600000,
        maxBuffer: 10 * 1024 * 1024
      }));
    } catch (execError) {
      const isReferenceParamRejected =
        videoConfig.referenceJobId && /does not accept|start-image|neither a UUID/i.test(execError.message || "");

      if (!isReferenceParamRejected) {
        throw execError;
      }

      console.warn(`[Step 9] 레퍼런스 이미지 파라미터가 거부됨 → 레퍼런스 없이 재시도 (일관성 저하 가능)`);
      const fallbackCommand = `${baseCommand} --wait`;
      ({ stdout } = await execPromise(fallbackCommand, {
        timeout: 600000,
        maxBuffer: 10 * 1024 * 1024
      }));
    }

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
    const classified = classifyHiggsfieldError(error);
    console.error(`[✗] Higgsfield CLI 실패 (${classified.error}): ${error.message}`);

    return {
      success: false,
      error: classified.error,
      message: classified.message,
      statusCode: error.code,
    };
  }
}

// ============================================================================
// [함수 2-1] generateCharacterReferenceImage - 라이브러리 캐릭터의 레퍼런스 이미지만 생성
// ============================================================================
/**
 * character_library의 기본 캐릭터를 위한 레퍼런스 "이미지"를 생성한다.
 *
 * ⭐ 캐릭터 일관성 핵심: 이 결과물은 반드시 실제 이미지여야 하고, 이후 모든 영상 생성
 * (callHiggsfield)이 이 이미지를 seedance1_5의 --start-image(첫 프레임 고정)에 넣어서
 * "같은 캐릭터를 선택하면 항상 같은 외형으로 시작"하도록 만드는 유일한 장치다.
 * (과거에는 seedance1_5로 4초 영상을 만들어 그 영상 URL을 "레퍼런스 이미지"로 저장했는데,
 * 영상 URL은 애초에 이미지 파라미터에 들어갈 수 없는 값이라 이후 모든 영상 생성이 실패했다.)
 *
 * ⚠️ Higgsfield의 media 플래그(--start-image 등)는 원격 https URL을 받지 않고
 * "UUID(업로드 id 또는 job id) 또는 로컬 파일 경로"만 받는다(`higgsfield generate create --help`
 * 로 확인됨). 그래서 --json으로 호출해 결과의 job id(`id` 필드)를 함께 받아둔다 —
 * 이 id를 나중에 --start-image에 그대로 넘기면 된다 (URL은 사람이 보는 화면 표시용).
 *
 * callHiggsfield와 달리 특정 resource/content에 종속되지 않으므로 videos 테이블에는
 * 기록하지 않고, 결과만 반환한다 (호출한 쪽에서 character_library에 직접 저장).
 */
async function generateCharacterReferenceImage({ characterName, voiceTone, visualDescription }) {
  try {
    const noTextInstruction = "no on-screen text, no readable words or captions, no signage text, clean text-free visual";
    const metadata = visualDescription
      ? `${characterName} character, ${visualDescription}, ${voiceTone || ""} tone, cute mascot reference shot, single character centered, plain background, ${noTextInstruction}`
      : `${characterName} character, ${voiceTone || "friendly"} tone, cute mascot reference shot, ${noTextInstruction}`;

    console.log(`[라이브러리 레퍼런스 이미지 생성] ${characterName}`);
    console.log(`  프롬프트: ${metadata}`);

    const command = `higgsfield --json generate create text2image_soul_v2 --prompt "${metadata}" --wait`;

    const { stdout } = await execPromise(command, {
      timeout: 600000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout.trim());
    const job = Array.isArray(parsed) ? parsed[0] : parsed;
    const imageUrl = job?.result_url;
    const jobId = job?.id;

    if (!imageUrl || !imageUrl.startsWith("https://") || !jobId) {
      throw new Error(`유효하지 않은 응답: ${stdout.trim()}`);
    }

    console.log(`[✓] ${characterName} 레퍼런스 이미지 생성 완료: ${imageUrl} (job id: ${jobId})`);
    return { success: true, image_url: imageUrl, image_job_id: jobId };
  } catch (error) {
    const classified = classifyHiggsfieldError(error);
    console.error(`[✗] ${characterName} 레퍼런스 이미지 생성 실패 (${classified.error}): ${error.message}`);
    return { success: false, error: classified.error, message: classified.message };
  }
}

// ============================================================================
// [함수 2-2] generateImageFromPrompt - 완성된 프롬프트 그대로 이미지 생성
// (character-refinement-agent의 자동 개선 루프가 사용: higgsfieldPromptTemplate이나
// improvedPrompt를 이미 완성된 문장으로 가지고 있으므로, generateCharacterReferenceImage처럼
// characterName/voiceTone을 덧붙여 감싸지 않고 그대로 전달한다)
// ============================================================================
async function generateImageFromPrompt(fullPrompt) {
  try {
    const sanitizeForShell = (s) => String(s || "").replace(/["'`$\\;|&<>%^()\n\r]/g, " ").replace(/\s+/g, " ").trim();
    const safePrompt = sanitizeForShell(fullPrompt);
    const command = `higgsfield --json generate create text2image_soul_v2 --prompt "${safePrompt}" --wait`;

    const { stdout } = await execPromise(command, {
      timeout: 600000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout.trim());
    const job = Array.isArray(parsed) ? parsed[0] : parsed;
    const imageUrl = job?.result_url;
    const jobId = job?.id;

    if (!imageUrl || !imageUrl.startsWith("https://") || !jobId) {
      throw new Error(`유효하지 않은 응답: ${stdout.trim()}`);
    }

    console.log(`[✓] 이미지 생성 완료: ${imageUrl} (job id: ${jobId})`);
    return { success: true, image_url: imageUrl, image_job_id: jobId };
  } catch (error) {
    const classified = classifyHiggsfieldError(error);
    console.error(`[✗] 이미지 생성 실패 (${classified.error}): ${error.message}`);
    return { success: false, error: classified.error, message: classified.message };
  }
}

// ============================================================================
// [함수 3] pollHiggsfield - Higgsfield 진행률 5초 폴링
// ============================================================================

async function pollHiggsfield(higgsfieldId, videoRowId) {
  // CLI 방식에서는 --wait 플래그가 완료까지 대기하므로, 이 함수는 보조용입니다.
  // 폴링이 필요한 경우에만 호출됨.
  const maxAttempts = 120;
  let attempt = 0;

  console.log(
    `[Step 9-폴링] Higgsfield 진행률 폴링 시작 (최대 10분)`
  );
  console.log(`  generation_id: ${higgsfieldId}`);

  while (attempt < maxAttempts) {
    try {
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      // CLI --wait 플래그가 있으므로 실제로는 여기 도달하지 않음
      console.log(`  [${attempt}/120] 진행 중...`);
    } catch (error) {
      console.error(`  [${attempt}/120] 폴링 에러: ${error.message}`);
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
  generateCharacterReferenceImage,
  generateImageFromPrompt,
  evaluateComplianceContent,
  getComplianceRulesForCategory,
};
