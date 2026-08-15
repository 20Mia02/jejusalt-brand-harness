/**
 * backend/agents/qa-agent.js
 * 제주소금 AI 콘텐츠 생성 엔진 - 품질 검사(QA) 에이전트
 *
 * 역할:
 * 1. Step 9: 카테고리별 상세 검증 (식품/뷰티/헬스)
 * 2. compliance-rules-v2.json 기반 자동/수동 검증
 * 3. 최종 판정 (PASS / WARNING / REJECTED) + 상세 피드백
 * 4. 마케터 수동 검증 지점 안내
 *
 * 의존성: compliance-rules-v2.json, TimelyAI API
 */

const fs = require("fs");
const path = require("path");
const { callDatabase } = require("./database-agent");

let complianceRulesV2 = null;

function loadComplianceRulesV2() {
  if (complianceRulesV2) return complianceRulesV2;
  try {
    const rulesPath = path.join(
      __dirname,
      "../../../..",
      "config",
      "compliance-rules-v2.json"
    );
    complianceRulesV2 = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  } catch (e) {
    console.warn(
      "⚠️ compliance-rules-v2.json 로드 실패:",
      e.message
    );
    complianceRulesV2 = { compliance_rules: {} };
  }
  return complianceRulesV2;
}

/**
 * 카테고리별 자동 검증 (금지 키워드 스캔)
 */
function performAutoValidation(category, content) {
  const rules = loadComplianceRulesV2();
  const categoryRules = rules.compliance_rules[category];
  if (!categoryRules) {
    return {
      passed: true,
      warnings: [],
      message: "카테고리 규칙을 찾을 수 없음",
    };
  }

  const results = {
    auto_checks: [],
    critical_issues: [],
    warnings: [],
  };

  const allRules = [
    ...categoryRules.critical_rules,
    ...categoryRules.high_priority_rules,
  ];

  allRules.forEach((rule) => {
    if (rule.automation !== "auto") return;

    const contentLower = content.toLowerCase();

    if (rule.keywords_to_block) {
      rule.keywords_to_block.forEach((keyword) => {
        if (contentLower.includes(keyword.toLowerCase())) {
          const issue = {
            rule_id: rule.rule_id,
            rule_name: rule.rule_name,
            severity: rule.risk_level,
            found_keyword: keyword,
            message: `금지 표현 감지: "${keyword}"`,
          };
          if (rule.risk_level === "critical") {
            results.critical_issues.push(issue);
          } else {
            results.warnings.push(issue);
          }
        }
      });
    }

    if (rule.keywords_to_limit) {
      rule.keywords_to_limit.forEach((keyword) => {
        if (contentLower.includes(keyword.toLowerCase())) {
          results.warnings.push({
            rule_id: rule.rule_id,
            rule_name: rule.rule_name,
            severity: "medium",
            found_keyword: keyword,
            message: `제한 표현 감지: "${keyword}" - 다음으로 대체하세요: ${rule.compliant_alternatives.join(
              ", "
            )}`,
          });
        }
      });
    }
  });

  return results;
}

/**
 * 카테고리별 수동 검증 체크리스트 생성
 */
function generateManualChecklistForCategory(category) {
  const rules = loadComplianceRulesV2();
  const categoryRules = rules.compliance_rules[category];
  if (!categoryRules) return null;

  const checklist = categoryRules.qa_checklist.map((item, idx) => ({
    id: idx + 1,
    item: item,
    status: "pending",
    notes: "",
  }));

  return {
    category: category,
    total_items: checklist.length,
    checklist: checklist,
  };
}

/**
 * 메인 QA 함수
 */
async function performComprehensiveQA(videoMetadata) {
  const {
    videoId,
    category,
    generatedPrompt,
    videoUrl,
    resourceId,
    contentId,
  } = videoMetadata;

  console.log(`\n[Step 9] 종합 품질 검사 시작`);
  console.log(`  영상: ${videoId}`);
  console.log(`  카테고리: ${category}`);

  const qaResult = {
    video_id: videoId,
    category: category,
    timestamp: new Date().toISOString(),
    auto_validation: null,
    manual_checklist: null,
    final_verdict: null,
    issues: [],
    recommendations: [],
  };

  // ========== Phase 1: 자동 검증 ==========
  console.log(`\n  [Phase 1] 자동 검증 (금지 키워드 스캔)...`);
  const autoResult = performAutoValidation(category, generatedPrompt);
  qaResult.auto_validation = autoResult;

  if (autoResult.critical_issues.length > 0) {
    console.log(
      `  ❌ Critical 이슈 ${autoResult.critical_issues.length}개 감지`
    );
    autoResult.critical_issues.forEach((issue) => {
      console.log(`    - [${issue.rule_id}] ${issue.message}`);
      qaResult.issues.push(issue);
    });
    qaResult.final_verdict = "REJECTED";
    qaResult.recommendations.push(
      "Critical 이슈를 수정한 후 다시 생성해주세요."
    );
  } else {
    console.log(`  ✅ Critical 이슈 없음`);
  }

  if (autoResult.warnings.length > 0) {
    console.log(`  ⚠️ 경고 ${autoResult.warnings.length}개 감지`);
    autoResult.warnings.forEach((warning) => {
      console.log(`    - [${warning.rule_id}] ${warning.message}`);
      qaResult.issues.push(warning);
    });
  }

  // ========== Phase 2: 수동 검증 체크리스트 ==========
  console.log(`\n  [Phase 2] 수동 검증 체크리스트 생성...`);
  const checklist = generateManualChecklistForCategory(category);
  if (checklist) {
    qaResult.manual_checklist = checklist;
    console.log(
      `  📋 ${category} 카테고리 ${checklist.total_items}개 항목 체크리스트 생성`
    );

    qaResult.recommendations.push(
      `마케터가 다음 ${checklist.total_items}개 항목을 수동으로 검토해주세요:`
    );
    checklist.checklist.slice(0, 5).forEach((item) => {
      qaResult.recommendations.push(`  - ${item.item}`);
    });
    if (checklist.total_items > 5) {
      qaResult.recommendations.push(
        `  ... 외 ${checklist.total_items - 5}개 항목`
      );
    }
  }

  // ========== Phase 3: 최종 판정 ==========
  console.log(`\n  [Phase 3] 최종 판정...`);
  if (!qaResult.final_verdict) {
    if (autoResult.warnings.length > 0) {
      qaResult.final_verdict = "WARNING";
      console.log(`  ⚠️ 최종 판정: WARNING (경고, 마케터 검토 필수)`);
    } else {
      qaResult.final_verdict = "PASS_AUTO";
      console.log(`  ✅ 최종 판정: PASS (자동 검증 완료, 수동 검증 대기)`);
    }
  }

  // ========== 데이터베이스 저장 ==========
  try {
    await callDatabase("insert", "quality_assurance_logs", {
      video_id: videoId,
      resource_id: resourceId,
      content_id: contentId,
      category: category,
      auto_validation: JSON.stringify(autoResult),
      manual_checklist: JSON.stringify(checklist),
      final_verdict: qaResult.final_verdict,
      issues_count: qaResult.issues.length,
      created_at: new Date(),
    });
    console.log(`  💾 QA 결과 저장 완료 (quality_assurance_logs)`);
  } catch (e) {
    console.warn(`  ⚠️ QA 로그 저장 실패:`, e.message);
  }

  return qaResult;
}

/**
 * 마케터가 수동 검증 완료 후 호출
 */
async function submitManualVerification(videoId, checklist, makerNotes) {
  console.log(`\n[Step 9-수동] 마케터 검증 결과 제출`);
  console.log(`  영상: ${videoId}`);

  const passedItems = checklist.filter((item) => item.status === "pass").length;
  const totalItems = checklist.length;
  const passRate = ((passedItems / totalItems) * 100).toFixed(1);

  console.log(`  검증 완료: ${passedItems}/${totalItems} (${passRate}%)`);

  const finalVerdict = passRate >= 90 ? "PASS_MANUAL" : "WARNING";
  console.log(`  최종 판정: ${finalVerdict}`);

  return {
    video_id: videoId,
    manual_verification: {
      passed_items: passedItems,
      total_items: totalItems,
      pass_rate: parseFloat(passRate),
      checker_notes: makerNotes,
    },
    final_verdict: finalVerdict,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// [Export]
// ============================================================================

module.exports = {
  performComprehensiveQA,
  submitManualVerification,
  generateManualChecklistForCategory,
  performAutoValidation,
};
