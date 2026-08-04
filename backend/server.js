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

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================================
// Middleware
// ============================================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use("/api/resources", resourcesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/generate", generationRouter);

// ============================================================================
// Health Check
// ============================================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    env: {
      supabase: !!process.env.SUPABASE_URL,
      higgsfield: !!process.env.HIGGSFIELD_API_KEY_SECRET,
      timelyai: !!process.env.TIMELY_AI_API_KEY,
    },
  });
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
