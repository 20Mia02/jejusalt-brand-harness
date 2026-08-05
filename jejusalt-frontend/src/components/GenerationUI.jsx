/**
 * frontend/components/GenerationUI.jsx
 *
 * 기능4: AI 콘텐츠 생성 + Higgsfield 영상화
 * 담당: 고수아(UI) + 박주미(API)
 *
 * 역할:
 * 1. Step 3 메타데이터 검토 완료 후 "AI 생성" 버튼 클릭
 * 2. POST /api/generate 호출 (Step 5~10)
 * 3. frontend-agent.md 기준 5초 폴링으로 진행률 조회
 * 4. 진행률 바(%) 실시간 표시
 * 5. 완료 시 비디오 URL 표시 및 재생 UI
 *
 * 파이프라인 (Step 3 메타데이터 검토 후):
 * Step 4: 캐릭터 추천 (character-generator-agent)
 * Step 5: 캐릭터 상세 설계 (character-designer-agent)
 * Step 6: 120초 시나리오 작성 (shortform-scenario-writer-agent)
 * Step 7: 제품명/콘텐츠명 생성 (naming-generator-agent)
 * Step 8: 마케팅 카피 작성 (product-intro/detail-writer-agent)
 * Step 9: 컴플라이언스 검증 (compliance-reviewer-agent)
 * Step 10: Higgsfield 영상 생성 + 폴링
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function GenerationUI({ resourceId, onSuccess, requestType = 'intro', videoType }) {
  // 상태 관리
  const [generating, setGenerating] = useState(false);
  const [generationData, setGenerationData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoErrorDetail, setVideoErrorDetail] = useState(null);
  const [failedStep, setFailedStep] = useState(null);
  const pollingInterval = useRef(null);

  /**
   * "AI 생성" 버튼 클릭
   *
   * routes/generation.js는 Higgsfield CLI --wait로 완료까지 기다린 뒤
   * videoUrl/videoStatus를 응답에 바로 담아 반환한다 (higgsfieldId를 별도로 주지 않음).
   * 이 POST는 1~2분 걸릴 수 있으므로, 응답을 기다리는 동안
   * GET /api/generate/:resourceId/status(generation_logs 기반 실제 진행률)를 병렬로 폴링해서
   * 진행률 바에 실제 단계 정보를 보여준다.
   */
  const handleGenerate = async () => {
    if (!resourceId) {
      setError('자료를 먼저 선택해주세요.');
      return;
    }

    setGenerating(true);
    setError(null);
    setProgress(0);
    setCurrentStep('초기화 중...');
    setVideoFailed(false);
    setVideoErrorDetail(null);

    startStatusPolling();

    try {
      // Step 4~9: POST /api/generate/:resourceId/start
      const res = await axios.post(`/api/generate/${resourceId}/start`, {
        requestType,
        videoType,
      });

      stopStatusPolling();

      if (!res.data.success) {
        throw new Error(res.data.message || '생성 실패');
      }

      setGenerationData(res.data);
      setProgress(100);
      setGenerating(false);

      if (res.data.videoStatus === 'failed' || res.data.higgsfieldError) {
        // 콘텐츠(카피)는 생성됐지만 Higgsfield 영상화는 실패한 경우
        setCurrentStep('⚠️ 콘텐츠는 생성됨 (영상 생성 실패)');
        setVideoFailed(true);
        setVideoErrorDetail(res.data.higgsfieldError || '영상 생성에 실패했습니다.');
        setVideoUrl(null);
      } else {
        setCurrentStep('✅ 완료!');
        setSuccessMessage('영상이 생성되었습니다!');
        setVideoUrl(res.data.videoUrl);
      }

      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      stopStatusPolling();
      console.error('AI 생성 실패:', err);
      setError(
        err.response?.data?.message || err.message || '생성 중 오류가 발생했습니다.'
      );
      setGenerating(false);
    }
  };

  /**
   * 생성 진행 중 실제 백엔드 진행률(GET /status)을 3초 간격으로 폴링.
   * POST /start 응답이 오면(성공/실패 모두) stopStatusPolling으로 정리한다.
   */
  const startStatusPolling = () => {
    pollingInterval.current = setInterval(async () => {
      try {
        const res = await axios.get(`/api/generate/${resourceId}/status`);
        const {
          progress: progressPercent,
          completedSteps,
          totalSteps,
          currentStep: stepName,
          failureDetails,
          failureMessage,
          retiringDetails
        } = res.data;

        setProgress((prev) => Math.max(prev, progressPercent || 0, 5));

        // 상세한 단계 정보 표시
        if (stepName) {
          setCurrentStep(`${stepName} 진행 중... (${completedSteps || 0}/${totalSteps || 9} 단계)`);
        } else {
          setCurrentStep(`AI 생성 중... (${completedSteps || 0}/${totalSteps || 9} 단계)`);
        }

        // 실패 정보 수집
        if (failureDetails && failureDetails.length > 0) {
          const failStep = failureDetails[0];
          setFailedStep(failStep.step);
          setErrorDetails({
            step: failStep.step,
            error_message: failStep.error_message,
            error_code: failStep.error_code,
            attempt: failStep.attempt,
          });
          // 실패 시 에러 메시지도 업데이트
          setError(`⚠️ ${failStep.step}에서 실패: ${failureMessage || failStep.error_message}`);
        }

        // 재시도 중인 단계 정보
        if (retiringDetails && retiringDetails.length > 0) {
          console.log('재시도 중:', retiringDetails);
        }
      } catch (err) {
        // 404 또는 네트워크 오류: 아직 생성이 시작 안 된 상태 → 무시
        if (err.response?.status !== 404) {
          console.warn('상태 폴링 오류:', err.message);
        }
      }
    }, 3000);
  };

  const stopStatusPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  // 언마운트 시 폴링 중지
  useEffect(() => {
    return () => stopStatusPolling();
  }, []);

  // ─────────────────────────────────────────────────────
  // UI 렌더링
  // ─────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg">
      {/* 제목 */}
      <h2 className="text-2xl font-bold mb-6">🎬 AI 콘텐츠 생성</h2>

      {/* 에러/성공 메시지 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="font-semibold">{error}</div>
          {errorDetails && (
            <div className="text-sm mt-2 space-y-1">
              <div className="text-red-600">
                <strong>Step:</strong> {errorDetails.step}
              </div>
              <div className="text-red-600">
                <strong>에러 코드:</strong> {errorDetails.error_code || 'UNKNOWN'}
              </div>
              <div className="text-red-600">
                <strong>재시도 횟수:</strong> {errorDetails.attempt || 0}회
              </div>
            </div>
          )}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      {/* 생성 중 UI */}
      {generating ? (
        <div className="space-y-6">
          {/* 현재 단계 */}
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">{currentStep}</div>
            <div className="text-3xl font-bold text-blue-600">{progress}%</div>
          </div>

          {/* 진행률 바 */}
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 text-center">
              {progress < 100
                ? '이 과정은 1~2분 정도 소요됩니다...'
                : '완료되었습니다!'}
            </div>
          </div>

          {/* 단계별 체크리스트 */}
          <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
            <StepItem label="Step 1-3: 자료 분석 & 메타데이터" done={true} />
            <StepItem label="Step 4: 캐릭터 설계" done={progress > 15} />
            <StepItem label="Step 5: 시나리오 작성" done={progress > 25} />
            <StepItem label="Step 6: 제품명 생성" done={progress > 35} />
            <StepItem label="Step 7: 카피 작성" done={progress > 45} />
            <StepItem label="Step 8: 컴플라이언스" done={progress > 55} />
            <StepItem label="Step 9: 영상 생성" done={progress > 70} />
          </div>

          {/* 실패 정보 표시 */}
          {failedStep && errorDetails && (
            <div className="bg-orange-50 border border-orange-300 p-4 rounded">
              <div className="font-semibold text-orange-700 mb-2">⚠️ 현재 단계 재시도 중</div>
              <div className="text-sm text-orange-800 space-y-1">
                <div><strong>단계:</strong> {errorDetails.step}</div>
                <div><strong>에러:</strong> {errorDetails.error_message}</div>
                <div><strong>코드:</strong> {errorDetails.error_code}</div>
                <div><strong>시도:</strong> {errorDetails.attempt}회 / 3회</div>
                <div className="text-xs text-orange-600 mt-2">
                  자동으로 재시도 중입니다. 잠시만 기다려주세요...
                </div>
              </div>
            </div>
          )}

          {/* 취소 버튼 (진행률 폴링만 중단 — 백엔드 생성 자체는 계속 진행됨) */}
          <button
            onClick={() => {
              setGenerating(false);
              setProgress(0);
              setCurrentStep(null);
              stopStatusPolling();
            }}
            className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            취소 (폴링만 중단)
          </button>
        </div>
      ) : (
        <>
          {/* 생성 전/후 UI */}
          {videoFailed ? (
            // 콘텐츠(카피)는 생성됐지만 Higgsfield 영상화는 실패한 상태
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded border border-yellow-300">
                <div className="text-lg font-bold text-yellow-800 mb-2">
                  ⚠️ 콘텐츠는 생성됐지만 영상 생성에 실패했습니다
                </div>
                {generationData && (
                  <div className="text-sm text-gray-700 space-y-1 mb-2">
                    <div>
                      <strong>검증 상태:</strong> {generationData.validationStatus}
                    </div>
                    <div>
                      <strong>검증 점수:</strong> {generationData.validationScore}/100
                    </div>
                  </div>
                )}
                <div className="text-sm text-yellow-800 bg-yellow-100 rounded p-2 mt-2">
                  {videoErrorDetail}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                🔄 영상 다시 생성
              </button>
            </div>
          ) : videoUrl ? (
            // 완료 상태: 비디오 표시
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded border border-green-200">
                <div className="text-lg font-bold text-green-800 mb-2">
                  ✅ 영상이 생성되었습니다!
                </div>
                {generationData && (
                  <div className="text-sm text-gray-700 space-y-1">
                    <div>
                      <strong>검증 상태:</strong> {generationData.validationStatus}
                    </div>
                    <div>
                      <strong>검증 점수:</strong> {generationData.validationScore}/100
                    </div>
                  </div>
                )}
              </div>

              {/* 비디오 재생 */}
              <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                  onError={() => console.error('비디오 재생 불가')}
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* 비디오 정보 */}
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm text-gray-700 space-y-2">
                  <div>
                    <strong>비디오 URL:</strong>{' '}
                    <code className="bg-white px-2 py-1 rounded text-xs break-all">
                      {videoUrl}
                    </code>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(videoUrl);
                      setSuccessMessage('URL이 복사되었습니다.');
                      setTimeout(() => setSuccessMessage(null), 2000);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    📋 복사
                  </button>
                </div>
              </div>

              {/* 다시 생성 버튼 */}
              <button
                onClick={() => {
                  setVideoUrl(null);
                  setVideoFailed(false);
                  setVideoErrorDetail(null);
                  setGenerationData(null);
                  setProgress(0);
                  setCurrentStep(null);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                🔄 다시 생성
              </button>
            </div>
          ) : (
            <>
              {/* 생성 전: 정보 표시 */}
              <div className="bg-blue-50 p-4 rounded mb-4 text-sm">
                <div className="font-semibold mb-2">📌 이제 시작할 생성 과정</div>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Step 4: 캐릭터 추천</li>
                  <li>Step 5: 캐릭터 상세 설계</li>
                  <li>Step 6: 120초 시나리오 작성</li>
                  <li>Step 7: 제품명/콘텐츠명 생성</li>
                  <li>Step 8: 마케팅 카피 작성</li>
                  <li>Step 9: 컴플라이언스 검증</li>
                  <li>Step 10: Higgsfield에서 숏폼 영상 생성</li>
                </ul>
              </div>

              {/* 생성 버튼 */}
              <button
                onClick={handleGenerate}
                disabled={!resourceId}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                🚀 AI 콘텐츠 생성 시작
              </button>

              {!resourceId && (
                <div className="mt-3 text-sm text-gray-500 text-center">
                  자료를 먼저 선택하세요.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 단계별 체크리스트 항목
 */
function StepItem({ label, done }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
        done
          ? 'bg-green-500 text-white'
          : 'bg-gray-300 text-gray-500'
      }`}>
        {done ? '✓' : '-'}
      </div>
      <span className={done ? 'text-gray-800 line-through' : 'text-gray-600'}>
        {label}
      </span>
    </div>
  );
}
