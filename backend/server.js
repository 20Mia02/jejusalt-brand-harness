/**
 * backend/server.js
 * 제주소금 AI 콘텐츠 생성 엔진 - Express 서버 초기화
 * 
 * 역할:
 * 1. Express 서버 초기화
 * 2. 미들웨어 설정 (CORS, JSON 파싱)
 * 3. 라우트 연결 (resources, admin, generation)
 * 4. 에러 핸들링
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { getConfig } = require("./utils/config-loader");

const app = express();
const PORT = process.env.PORT || 5000;

// config.json 로드 및 검증
const config = getConfig();
console.log(`📋 브랜드 설정: ${config.brand.nameKorean}`);
console.log(`🎭 등록된 캐릭터: ${config.characters.length}명`);

// ============================================================================
// 환경변수 검증 (서버 시작 시)
// ============================================================================

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "TIMELY_AI_API_KEY",
  "HIGGSFIELD_API_KEY",
];

const missingEnvVars = requiredEnvVars.filter((env) => !process.env[env]);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ 필수 환경변수가 누락되었습니다:",
    missingEnvVars.join(", ")
  );
  console.error("❌ .env 파일을 확인하세요.");
  process.exit(1);
}

// ============================================================================
// Middleware
// ============================================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 (캐릭터 이미지/참고자료)
app.use('/docs', express.static(path.join(__dirname, '../docs')));

// 요청 로깅 (간단한 디버깅용)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================

const resourcesRouter = require("./routes/resources");
const adminRouter = require("./routes/admin");
const generationRouter = require("./routes/generation");
const charactersRouter = require("./routes/characters");

app.use("/api/resources", resourcesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/generate", generationRouter);
app.use("/api/characters", charactersRouter);

// ============================================================================
// Health Check
// ============================================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    env: {
      supabase: !!process.env.SUPABASE_URL,
      higgsfield: !!process.env.HIGGSFIELD_API_KEY,
      timelyai: !!process.env.TIMELY_AI_API_KEY,
    },
  });
});

// ============================================================================
// Config API (프론트에서 브랜드/캐릭터 설정 조회)
// ============================================================================

app.get("/api/config", (req, res) => {
  const cfg = getConfig();
  res.json({
    success: true,
    brand: cfg.brand,
    characters: cfg.characters,
    generation: cfg.generation,
  });
});

// ============================================================================
// Pipeline Status Summary (모든 리소스의 생성 상태 요약)
// ============================================================================

app.get("/api/pipeline/status", async (req, res) => {
  try {
    const { callDatabase } = require("./agents/database-agent");

    // 모든 리소스 조회
    const resourcesResult = await callDatabase("resources", "read", null, {});
    const resources = resourcesResult.success ? resourcesResult.rows : [];

    if (!resources || resources.length === 0) {
      return res.json({
        success: true,
        totalResources: 0,
        statuses: [],
      });
    }

    // 각 리소스별 생성 로그 조회
    const statusSummary = await Promise.all(
      resources.map(async (resource) => {
        const logsResult = await callDatabase("generation_logs", "read", null, {
          resource_id: resource.id,
        }).catch(() => ({ success: false, rows: [] }));
        const logs = logsResult.success ? logsResult.rows : [];

        const successCount = (logs || []).filter((l) => l.status === "success").length;
        const failureCount = (logs || []).filter((l) => l.status === "fail").length;

        return {
          resourceId: resource.id,
          productName: resource.product_name,
          status: resource.status,
          progressPercent: Math.round((successCount / 10) * 100),
          completedSteps: successCount,
          failedSteps: failureCount,
          lastUpdate: logs?.[logs.length - 1]?.created_at || null,
        };
      })
    );

    return res.json({
      success: true,
      totalResources: resources.length,
      statuses: statusSummary,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("[GET /api/pipeline/status] 예외:", error);
    return res.status(500).json({
      success: false,
      message: "파이프라인 상태 조회 중 오류가 발생했습니다",
    });
  }
});

// ============================================================================
// 404 Handler
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `경로를 찾을 수 없습니다: ${req.method} ${req.path}`,
  });
});

// ============================================================================
// Error Handler (반드시 마지막에 위치)
// ============================================================================

app.use((err, req, res, next) => {
  console.error("[Error]", err);
  res.status(500).json({
    success: false,
    message: "서버 내부 오류가 발생했습니다",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log("");
  console.log("════════════════════════════════════════════");
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
  console.log(`🏥 헬스 체크: http://localhost:${PORT}/health`);
  console.log("════════════════════════════════════════════");
  console.log("");
});

module.exports = app;
