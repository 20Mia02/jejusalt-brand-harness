/**
 * routes/admin.js
 *
 * 기능3: 관리자 모드
 *   PUT    /api/admin/resources/:id        - 자료(메타데이터/제품정보) 수정
 *   PUT    /api/admin/characters/:id        - 캐릭터 선택 변경 / 내용 편집
 *   DELETE /api/admin/characters/:id        - 캐릭터 삭제
 *   PUT    /api/admin/naming/:resourceId     - 제품명/콘텐츠명 최종 선택 변경
 *
 * 담당: 박주미
 * 의존: database-agent.md (callDatabase) — backend-agent(TimelyAI Agent 호출) 사용 안 함
 *       (backend-agent.md 매핑표: "routes/admin.js — Agent 호출 없음, DB 직접 수정")
 *
 * 전제:
 *   - routes/resources.js에서 이미 resources + characters가 저장되어 있음
 *   - routes/generation.js에서 naming(제품명/콘텐츠명 3개 옵션)이 저장되어 있음
 *   - 이 파일은 TimelyAI를 다시 호출하지 않고, 사용자가 이미 생성된 결과를 수정/선택만 함
 */

const express = require("express");
const router = express.Router();

const { callDatabase } = require("../agents/database-agent"); // database-agent.md의 callDatabase()
const { callAgent, getComplianceRulesForCategory } = require("../agents/backend-agent");

// ─────────────────────────────────────────────
// PUT /api/admin/resources/:id — 메타데이터 / 제품정보 수정
//
// 사용 예: AdminMode.jsx에서 categories, ageGroups 등을 수동으로 고칠 때
//          또는 productInfo 오타를 발견해서 고칠 때
// ─────────────────────────────────────────────
router.put("/resources/:id", async (req, res) => {
  const { id } = req.params;
  const { productName, productInfo, keywords, metadata, status } = req.body;

  // 최소 하나의 필드는 있어야 함
  if (
    productName === undefined &&
    productInfo === undefined &&
    keywords === undefined &&
    metadata === undefined &&
    status === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: "수정할 항목이 없습니다. (productName/productInfo/keywords/metadata/status 중 최소 1개 필요)",
    });
  }

  // status는 정해진 값만 허용 (database-agent.md 저장 순서 문서와 일치)
  const validStatuses = ["analyzing", "analyzed", "generating", "completed", "failed"];
  if (status !== undefined && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status는 다음 중 하나여야 합니다: ${validStatuses.join(", ")}`,
    });
  }

  const updateData = {};
  if (productName !== undefined) updateData.product_name = productName;
  if (productInfo !== undefined) updateData.product_info = productInfo;
  if (keywords !== undefined) updateData.keywords = keywords;
  if (metadata !== undefined) updateData.metadata = metadata;
  if (status !== undefined) updateData.status = status;

  const result = await callDatabase("resources", "update", updateData, { id });

  if (!result.success) {
    const statusCode = result.error === "NOT_FOUND" ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message:
        result.error === "NOT_FOUND"
          ? "해당 자료를 찾을 수 없습니다."
          : "자료 수정에 실패했습니다.",
      detail: result,
    });
  }

  return res.json({ success: true, resource: result.rows[0] });
});

// ─────────────────────────────────────────────
// PUT /api/admin/characters/:id — 캐릭터 선택 변경 / 내용 편집
//
// 두 가지 용도:
//  (a) selected: true/false 로 넘기면 → 이 캐릭터의 선택 여부만 바뀐다
//      ⭐ 여러 캐릭터가 한 자료에 동시에 selected: true일 수 있다 (멀티 캐릭터 시나리오 지원).
//         다른 캐릭터를 자동으로 해제하지 않으므로, 단일 선택이 필요한 화면에서는
//         프론트에서 명시적으로 이전 선택을 selected: false로 먼저 보내야 한다.
//  (b) name/description/reason 등을 직접 수정
// ─────────────────────────────────────────────
router.put("/characters/:id", async (req, res) => {
  const { id } = req.params;
  const { character_name, character_profile, reason, score, selected, voice_tone, personality_traits, edited_by } = req.body;

  // 캐릭터가 존재하는지 확인
  const existing = await callDatabase("characters", "read", null, { id });
  if (!existing.success || existing.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "해당 캐릭터를 찾을 수 없습니다.",
    });
  }

  const updateData = {};
  if (character_name !== undefined) updateData.character_name = character_name;
  if (character_profile !== undefined) updateData.character_profile = character_profile;
  if (reason !== undefined) updateData.reason = reason;
  if (score !== undefined) updateData.score = score;
  if (selected !== undefined) updateData.selected = selected;
  if (voice_tone !== undefined) updateData.voice_tone = voice_tone;
  if (personality_traits !== undefined) updateData.personality_traits = personality_traits;
  if (edited_by !== undefined) {
    updateData.edited_at = new Date();
    updateData.edited_by = edited_by;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "수정할 항목이 없습니다.",
    });
  }

  const result = await callDatabase("characters", "update", updateData, { id });

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: "캐릭터 수정에 실패했습니다.",
      detail: result,
    });
  }

  return res.json({ success: true, character: result.rows[0] });
});

// ─────────────────────────────────────────────
// DELETE /api/admin/characters/:id — 캐릭터 삭제
//
// 주의: selected: true인 캐릭터를 삭제하면 다른 캐릭터를 자동으로 selected: true로
//       올리지 않는다 (사용자가 명시적으로 다시 선택하도록 유도 — 실수 방지)
// ─────────────────────────────────────────────
router.delete("/characters/:id", async (req, res) => {
  const { id } = req.params;

  const result = await callDatabase("characters", "delete", null, { id });

  if (!result.success) {
    const statusCode = result.error === "NOT_FOUND" ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      message:
        result.error === "NOT_FOUND"
          ? "해당 캐릭터를 찾을 수 없습니다."
          : "캐릭터 삭제에 실패했습니다.",
      detail: result,
    });
  }

  return res.json({ success: true, deleted: result.rows[0] });
});

// ─────────────────────────────────────────────
// GET /api/admin/naming/:resourceId — 네이밍 옵션 조회 (AdminMode.jsx)
//
// naming 테이블에서 주어진 resourceId의 네이밍 결과를 조회한다.
// ─────────────────────────────────────────────
router.get("/naming/:resourceId", async (req, res) => {
  const { resourceId } = req.params;

  try {
    // naming 테이블에서 조회
    const namingResult = await callDatabase("naming", "read", null, {
      resource_id: resourceId,
    });

    if (!namingResult.success || namingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "해당 자료의 네이밍 결과를 찾을 수 없습니다.",
      });
    }

    const namingData = namingResult.rows[0];

    // naming 데이터를 AdminMode.jsx 형식으로 변환
    const naming = {
      product_name_1: namingData.product_name_1,
      product_name_1_score: namingData.product_name_1_score,
      product_name_1_meaning: namingData.product_name_1_meaning,
      product_name_2: namingData.product_name_2,
      product_name_2_score: namingData.product_name_2_score,
      product_name_2_meaning: namingData.product_name_2_meaning,
      product_name_3: namingData.product_name_3,
      product_name_3_score: namingData.product_name_3_score,
      product_name_3_meaning: namingData.product_name_3_meaning,
      content_name_1: namingData.content_name_1,
      content_name_1_score: namingData.content_name_1_score,
      content_name_1_meaning: namingData.content_name_1_meaning,
      content_name_2: namingData.content_name_2,
      content_name_2_score: namingData.content_name_2_score,
      content_name_2_meaning: namingData.content_name_2_meaning,
      content_name_3: namingData.content_name_3,
      content_name_3_score: namingData.content_name_3_score,
      content_name_3_meaning: namingData.content_name_3_meaning,
    };

    return res.json({
      success: true,
      naming: naming,
    });
  } catch (error) {
    console.error("[GET /api/admin/naming/:resourceId] 예외:", error);
    return res.status(500).json({
      success: false,
      message: "네이밍 조회 중 오류가 발생했습니다.",
    });
  }
});

// ─────────────────────────────────────────────
// PUT /api/admin/naming/:resourceId — 제품명/콘텐츠명 최종 선택 변경
//
// naming-generator-agent.md 원본 설계는 "마케터가 3개 중 1개 선택"하는 UI 흐름.
// backend-agent.md에서는 1순위를 자동 채택하지만, 여기서 사용자가
// 2순위/3순위로 바꾸거나 직접 이름을 입력할 수 있게 한다.
//
// naming 테이블 구조: product_names(text[]), content_names(text[])
// → "선택된 이름"은 naming 테이블에 별도 컬럼이 없으므로,
//   resources.metadata에 selected_product_name / selected_content_name으로 보관한다.
// ─────────────────────────────────────────────
router.put("/naming/:resourceId", async (req, res) => {
  const { resourceId } = req.params;
  const { selectedProductName, selectedContentName } = req.body;

  if (!selectedProductName && !selectedContentName) {
    return res.status(400).json({
      success: false,
      message: "selectedProductName 또는 selectedContentName 중 최소 1개가 필요합니다.",
    });
  }

  // naming 테이블에서 옵션 목록 확인 (직접 입력이 아니라면 3개 옵션 안에 있는지 검증)
  const namingResult = await callDatabase("naming", "read", null, {
    resource_id: resourceId,
  });

  if (!namingResult.success || namingResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "해당 자료의 네이밍 결과를 찾을 수 없습니다. 먼저 AI 생성을 실행해주세요.",
    });
  }

  // 현재 resources.metadata를 읽어서 선택값만 덧붙임 (metadata 전체를 덮어쓰지 않기 위해)
  const resourceResult = await callDatabase("resources", "read", null, {
    id: resourceId,
  });
  if (!resourceResult.success || resourceResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "해당 자료를 찾을 수 없습니다.",
    });
  }

  const currentMetadata = resourceResult.rows[0].metadata || {};
  const updatedMetadata = {
    ...currentMetadata,
    ...(selectedProductName && { selected_product_name: selectedProductName }),
    ...(selectedContentName && { selected_content_name: selectedContentName }),
  };

  const updateResult = await callDatabase(
    "resources",
    "update",
    { metadata: updatedMetadata },
    { id: resourceId }
  );

  if (!updateResult.success) {
    return res.status(500).json({
      success: false,
      message: "네이밍 선택 저장에 실패했습니다.",
      detail: updateResult,
    });
  }

  return res.json({
    success: true,
    resource: updateResult.rows[0],
    availableOptions: {
      productNames: [
        { name: namingResult.rows[0].product_name_1, score: namingResult.rows[0].product_name_1_score, meaning: namingResult.rows[0].product_name_1_meaning },
        { name: namingResult.rows[0].product_name_2, score: namingResult.rows[0].product_name_2_score, meaning: namingResult.rows[0].product_name_2_meaning },
        { name: namingResult.rows[0].product_name_3, score: namingResult.rows[0].product_name_3_score, meaning: namingResult.rows[0].product_name_3_meaning },
      ],
      contentNames: [
        { name: namingResult.rows[0].content_name_1, score: namingResult.rows[0].content_name_1_score, meaning: namingResult.rows[0].content_name_1_meaning },
        { name: namingResult.rows[0].content_name_2, score: namingResult.rows[0].content_name_2_score, meaning: namingResult.rows[0].content_name_2_meaning },
        { name: namingResult.rows[0].content_name_3, score: namingResult.rows[0].content_name_3_score, meaning: namingResult.rows[0].content_name_3_meaning },
      ],
    },
  });
});

// ─────────────────────────────────────────────
// GET /api/admin/compliance-test — 컴플라이언스 실패 케이스 테스트 실행 (멘토링 피드백 4)
//
// compliance-reviewer-agent에 고정된 6개 테스트 케이스를 실제로 통과시켜
// "이 카피가 규칙에 걸리는지"를 검증한다. TimelyAI가 Mock 모드일 때는
// backend-agent.js의 evaluateComplianceContent()가 결정론적으로 판정하므로
// 항상 같은 입력엔 같은 결과가 나온다 (재현 가능한 테스트).
// ─────────────────────────────────────────────
const COMPLIANCE_TEST_CASES = [
  {
    id: "FAIL_001",
    label: "허위 효능",
    category: "식품",
    content: "이 소금을 먹으면 암을 치료할 수 있습니다.",
    expected: "fail",
  },
  {
    id: "FAIL_002",
    label: "원산지 거짓 표시",
    category: "식품",
    content: "프랑스 최고급 소금으로 만든 프리미엄 제품입니다.",
    expected: "fail",
  },
  {
    id: "FAIL_003",
    label: "과장된 할인율",
    category: "식품",
    content: "지금 구매하시면 95% 할인!",
    expected: "warning",
  },
  {
    id: "FAIL_004",
    label: "애매한 건강 표현",
    category: "식품",
    content: "꾸준히 섭취하면 건강을 개선할 수 있습니다.",
    expected: "warning",
  },
  {
    id: "FAIL_005",
    label: "뷰티 의학 용어",
    category: "뷰티",
    content: "매일 바르면 피부 재생력을 회복시켜 줍니다.",
    expected: "fail",
  },
  {
    id: "PASS_001",
    label: "올바른 표현",
    category: "식품",
    content: "100% 제주산 자연 미네랄 소금입니다.",
    expected: "pass",
  },
];

router.get("/compliance-test", async (req, res) => {
  try {
    const results = await Promise.all(
      COMPLIANCE_TEST_CASES.map(async (testCase) => {
        const complianceRules = getComplianceRulesForCategory(testCase.category);
        const result = await callAgent(
          "compliance-reviewer-agent",
          {
            content: testCase.content,
            category: testCase.category,
            productName: "테스트 제품",
            complianceRules,
          },
          { step: "compliance-test" } // resourceId 없이 호출 → generation_logs 기록 생략
        );

        const actual = result.success ? result.data.compliance_status : "ERROR";
        return {
          id: testCase.id,
          label: testCase.label,
          category: testCase.category,
          input: testCase.content,
          expected: testCase.expected,
          actual,
          passed: actual === testCase.expected,
          detail: result.success ? result.data : result,
        };
      })
    );

    const passCount = results.filter((r) => r.passed).length;

    return res.json({
      success: true,
      total: results.length,
      passCount,
      passRate: Math.round((passCount / results.length) * 100),
      results,
    });
  } catch (error) {
    console.error("[GET /api/admin/compliance-test] 예외:", error);
    return res.status(500).json({
      success: false,
      message: "컴플라이언스 테스트 실행 중 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
