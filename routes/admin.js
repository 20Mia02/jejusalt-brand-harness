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
//  (a) selected: true 로 넘기면 → 같은 resource_id의 다른 캐릭터는 자동으로 selected: false 처리
//  (b) name/description/reason 등을 직접 수정
// ─────────────────────────────────────────────
router.put("/characters/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, reason, score, selected } = req.body;

  // 캐릭터가 존재하는지 + resource_id 확인 (다른 캐릭터 selected 해제할 때 필요)
  const existing = await callDatabase("characters", "read", null, { id });
  if (!existing.success || existing.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "해당 캐릭터를 찾을 수 없습니다.",
    });
  }
  const resourceId = existing.rows[0].resource_id;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (reason !== undefined) updateData.reason = reason;
  if (score !== undefined) updateData.score = score;
  if (selected !== undefined) updateData.selected = selected;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "수정할 항목이 없습니다.",
    });
  }

  // ── selected: true로 바꾸는 경우 → 같은 resource의 다른 캐릭터는 false로 ──
  if (selected === true) {
    const others = await callDatabase("characters", "read", null, {
      resource_id: resourceId,
    });
    if (others.success) {
      const otherIds = others.rows.filter((c) => c.id !== id).map((c) => c.id);
      for (const otherId of otherIds) {
        await callDatabase(
          "characters",
          "update",
          { selected: false },
          { id: otherId }
        );
      }
    }
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
      productNames: namingResult.rows[0].product_names,
      contentNames: namingResult.rows[0].content_names,
    },
  });
});

module.exports = router;
