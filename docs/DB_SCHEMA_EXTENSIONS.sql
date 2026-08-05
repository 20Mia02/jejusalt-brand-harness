-- DB 스키마 확장: generation_logs 강화
-- 현재 generation_logs는 기본 필드만 있으므로, 상세한 에러 추적을 위해 컬럼 추가

-- ============================================================================
-- 1. generation_logs 테이블 확장
-- ============================================================================

-- 기존 generation_logs 구조 확인:
-- CREATE TABLE generation_logs (
--   id UUID PRIMARY KEY,
--   resource_id UUID,
--   step VARCHAR,
--   status VARCHAR,        -- 'success', 'fail', 'retrying'
--   created_at TIMESTAMP
-- );

-- 필요한 추가 컬럼:
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS error_code VARCHAR(50);
-- 에러 코드 (예: ETIMEDOUT, API_ERROR, JSON_PARSE_ERROR)

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
-- 상세 에러 메시지

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS error_stack TEXT;
-- 에러 스택 트레이스 (디버깅용)

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS attempt INTEGER DEFAULT 1;
-- 현재 시도 번호 (1, 2, 3, ...)

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS total_attempts INTEGER DEFAULT 3;
-- 총 재시도 횟수 설정값

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS retry_delay_ms INTEGER DEFAULT 0;
-- 다음 재시도까지의 대기 시간 (ms)

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 0;
-- 이 단계 실행 시간 (성공 시)

ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT NOW();
-- 정확한 발생 시각

-- 인덱스 추가 (쿼리 성능)
CREATE INDEX IF NOT EXISTS idx_generation_logs_resource_id_status
  ON generation_logs(resource_id, status);

CREATE INDEX IF NOT EXISTS idx_generation_logs_error_code
  ON generation_logs(error_code);

-- ============================================================================
-- 2. generations 테이블 (선택사항: 배치 생성 추적)
-- ============================================================================

-- 여러 자료를 일괄 생성할 때 배치 ID로 추적
CREATE TABLE IF NOT EXISTS generation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name VARCHAR(255),
  resource_ids UUID[],           -- 배치에 포함된 자료들
  requestType VARCHAR(50),       -- 'intro', 'detail', 'both'
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, failed
  total_count INTEGER,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_generation_batches_status
  ON generation_batches(status);

-- ============================================================================
-- 3. 코멘트 추가 (Supabase 대시보드에서 가독성 개선)
-- ============================================================================

COMMENT ON COLUMN generation_logs.error_code IS '에러 유형 (ETIMEDOUT, API_ERROR, JSON_PARSE_ERROR, etc)';
COMMENT ON COLUMN generation_logs.error_message IS '사용자 친화적 에러 메시지';
COMMENT ON COLUMN generation_logs.error_stack IS '디버깅용 스택 트레이스';
COMMENT ON COLUMN generation_logs.attempt IS '현재 재시도 횟수 (1~N)';
COMMENT ON COLUMN generation_logs.total_attempts IS '최대 재시도 설정값';
COMMENT ON COLUMN generation_logs.retry_delay_ms IS '다음 재시도 대기 시간';
COMMENT ON COLUMN generation_logs.duration_ms IS '단계 실행 시간 (ms)';
COMMENT ON COLUMN generation_logs.timestamp IS '정확한 발생 시각';

-- ============================================================================
-- 4. 실행 방법
-- ============================================================================

-- Supabase 대시보드 → SQL Editor → 위 SQL 복사 & 실행
-- 기존 데이터는 유지되고, 새로운 컬럼만 추가됨

-- ============================================================================
-- 5. 확인 쿼리
-- ============================================================================

-- 실패한 모든 단계 조회
-- SELECT step, error_code, error_message, attempt, COUNT(*) as count
-- FROM generation_logs
-- WHERE status = 'fail'
-- GROUP BY step, error_code, error_message, attempt
-- ORDER BY count DESC;

-- 재시도 중인 단계 확인
-- SELECT resource_id, step, attempt, total_attempts,
--        EXTRACT(EPOCH FROM (NOW() - timestamp)) as seconds_ago
-- FROM generation_logs
-- WHERE status = 'retrying'
-- ORDER BY timestamp DESC;

-- 배치별 진행률
-- SELECT batch_name, status,
--        success_count || '/' || total_count as progress,
--        ROUND(100.0 * success_count / total_count, 1) as percent
-- FROM generation_batches
-- ORDER BY created_at DESC;
