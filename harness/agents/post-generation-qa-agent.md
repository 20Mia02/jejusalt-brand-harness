# Post-Generation QA Agent

## 역할
Higgsfield 영상 생성이 완료된 직후, 최종 결과물(영상)의 품질을 검증하는 마지막 안전망 역할을 한다.
텍스트 카피는 이미 `compliance-reviewer-agent`(Step 8)에서 검증됐지만, 실제 영상은 별도로
"결과물이 의도대로 나왔는가"를 확인해야 한다 (Higgsfield 자체 오류, 프롬프트 누락 반영, 길이 오차 등).

## 플로우 상 위치
```
텍스트 검수 (compliance-reviewer-agent, Step 8)
  → 영상 생성 (Higgsfield, Step 9)
    → 생성 영상 검수 (post-generation-qa-agent, Step 10) ⭐ 신규
```

## 검증 항목
1. **비디오 무결성**: 파일 URL이 유효하고 정상적으로 재생 가능한 형식인가?
2. **길이 검증**: 요청한 duration과 실제 영상 길이가 일치하는가? (±2초 허용)
3. **캐릭터 일관성**: 레퍼런스 이미지(character.reference_image_url)와 실제 생성된 캐릭터가
   일치하는가? (비전 모델이 있으면 이미지 비교, 없으면 메타데이터 기반 추정)
4. **텍스트 오버레이 없음 확인**: Higgsfield 프롬프트에서 의도적으로 제외했던 마케팅 문구가
   실수로 영상에 삽입되지 않았는가?
5. **오디오 품질**: 음성이 있는 경우 명확하고 잡음이 없는가?

## 입력
```json
{
  "videoUrl": "https://.../video.mp4",
  "expectedDuration": 30,
  "character": "결이",
  "referenceImageUrl": "https://.../reference.mp4",
  "generatedContent": "카피 텍스트 (오버레이 삽입 여부 대조용)"
}
```

## 출력 형식 (agent-schemas.json의 post_generation_qa_agent 스키마 준수)
```json
{
  "qa_status": "pass",
  "qa_passed": true,
  "qa_checks": [
    { "check_id": "video_integrity", "result": "pass", "details": "정상 재생 확인", "recommendation": null },
    { "check_id": "duration_match", "result": "pass", "details": "요청 30초, 실제 31초 (오차 1초)", "recommendation": null },
    { "check_id": "character_consistency", "result": "pass", "details": "레퍼런스 대비 일치도 87%", "recommendation": null },
    { "check_id": "no_text_overlay", "result": "pass", "details": "오버레이 텍스트 미검출", "recommendation": null },
    { "check_id": "audio_quality", "result": "pass", "details": "잡음 없음", "recommendation": null }
  ],
  "overall_score": 92,
  "action_required": "none"
}
```

## 실패 시 처리
- `qa_passed: false`인 경우 → `generation_logs` 테이블에 `step: "post-generation-qa"`, `status: "QA_FAILED"`로 기록
  (기존 `generation_logs.details` JSONB 컬럼에 `qa_checks` 전체를 저장 — 별도 마이그레이션 불필요)
- 프론트엔드(GenerationUI)에 "⚠️ 품질 검증 실패 — 재생성을 권장합니다" 알림 표시
- **주의**: QA 실패는 경고이며 파이프라인 자체를 중단시키지 않는다 (Higgsfield 재호출 비용이 크므로,
  실패해도 영상은 그대로 사용자에게 보여주고 재생성 여부는 사용자가 판단하게 한다)
