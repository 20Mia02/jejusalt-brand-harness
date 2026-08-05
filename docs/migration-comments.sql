-- ============================================================================
-- 마이그레이션: comments 테이블 (팀 협업 - 코멘트 스레드)
-- 목적: 자료(resource)별로 마케터/담당자가 검토 코멘트를 남기고 이력을 추적
-- 적용 방법: Supabase 대시보드 > SQL Editor에서 실행
-- ============================================================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT '담당자',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_resource_id ON comments(resource_id);
