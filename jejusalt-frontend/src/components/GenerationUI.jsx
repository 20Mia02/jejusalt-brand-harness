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

export default function GenerationUI({ resourceId, onSuccess, requestType = 'intro' }) {
  // 상태 관리
  const [generating, setGenerating] = useState(false);
  const [generationData, setGenerationData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const pollingInterval = useRef(null);

  /**
   * "AI 생성" 버튼 클릭
   */
  const handleGenerate = async () => {
    if (!resourceId) {
      setError('자료를 먼저 선택해주세요.');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setProgress(0);
      setCurrentStep('초기화 중...');

      // Step 4~9: POST /api/generate/:resourceId/start
      const res = await axios.post(`/api/generate/${resourceId}/start`, {
        requestType,
      });

      if (!res.data.success) {
        throw new Error(res.data.message || '생성 실패');
      }

      setGenerationData(res.data);
      setProgress(5); // 요청 성공 후 5%
      setCurrentStep('영상 생성 중...');

      // Higgsfield 폴링 시작
      if (res.data.higgsfieldId) {
        startPolling(res.data.higgsfieldId, resourceId);
      } else {
        // 폴링 없이 바로 완료
        setProgress(100);
        setCurrentStep('완료!');
        setVideoUrl(res.data.videoUrl);
        if (onSuccess) {
          onSuccess(res.data);
        }
      }
    } catch (err) {
      console.error('AI 생성 실패:', err);
      setError(
        err.response?.data?.message || err.message || '생성 중 오류가 발생했습니다.'
      );
      setGenerating(false);
    }
  };

  /**
   * Higgsfield 진행률 5초 폴링 (frontend-agent.md 기준)
   */
  const startPolling = (higgsfieldId, resId) => {
    let pollCount = 0;
    const maxPolls = 120; // 5초 x 120 = 10분

    pollingInterval.current = setInterval(async () => {
      try {
        pollCount++;

        // 비디오 진행상황 조회 (generation_logs 조회)
        const res = await axios.get(`/api/generate/${resourceId}/status`);

        const { progress: progressPercent, currentStatus, lastUpdate } = res.data;

        // 진행률 업데이트
        setProgress(Math.max(5, progressPercent || 0));

        // 상태 메시지 업데이트
        if (currentStatus === 'processing') {
          setCurrentStep(`영상 생성 중... (${progressPercent}%)`);
        } else if (currentStatus === 'completed') {
          setProgress(100);
          setCurrentStep('✅ 완료!');
          setVideoUrl(generationData?.videoUrl || null);
          clearInterval(pollingInterval.current);
          setGenerating(false);
          setSuccessMessage('영상이 생성되었습니다!');
          if (onSuccess) {
            onSuccess({
              ...generationData,
              videoUrl: video_url,
              generationStatus: 'completed',
            });
          }
        } else if (currentStatus === 'failed') {
          setCurrentStep('❌ 생성 실패');
          setError('영상 생성에 실패했습니다. 다시 시도해주세요.');
          clearInterval(pollingInterval.current);
          setGenerating(false);
        }

        // 타임아웃: 10분 초과
        if (pollCount > maxPolls) {
          setCurrentStep('⏱️ 타임아웃 (10분 초과)');
          setError('영상 생성이 10분 이상 소요되었습니다. 다시 시도해주세요.');
          clearInterval(pollingInterval.current);
          setGenerating(false);
        }
      } catch (err) {
        console.error('폴링 실패:', err);
        
        // 404 에러면 영상을 찾을 수 없는 것이므로 즉시 중단
        if (err.response?.status === 404) {
          setCurrentStep('❌ 영상을 찾을 수 없습니다');
          setError('영상 데이터가 존재하지 않습니다. 다시 생성해주세요.');
          clearInterval(pollingInterval.current);
          setGenerating(false);
        }
        // 그 외 네트워크 에러는 재시도
      }
    }, 5000); // 5초 간격
  };

  // 언마운트 시 폴링 중지
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
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
          {error}
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
            <StepItem label="Step 3: 메타데이터 검토" done={true} />
            <StepItem label="Step 4: 캐릭터 추천" done={progress > 10} />
            <StepItem label="Step 5: 캐릭터 상세 설계" done={progress > 20} />
            <StepItem label="Step 6: 120초 시나리오 작성" done={progress > 30} />
            <StepItem label="Step 7: 제품명/콘텐츠명 생성" done={progress > 40} />
            <StepItem label="Step 8: 마케팅 카피 작성" done={progress > 50} />
            <StepItem label="Step 9: 컴플라이언스 검증" done={progress > 60} />
            <StepItem label="Step 10: Higgsfield 영상 생성" done={progress > 70} />
          </div>

          {/* 취소 버튼 (생성 중 취소는 모의: 실제로는 무시) */}
          <button
            onClick={() => {
              setGenerating(false);
              setProgress(0);
              setCurrentStep(null);
              if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
              }
            }}
            className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            취소 (폴링만 중단)
          </button>
        </div>
      ) : (
        <>
          {/* 생성 전/후 UI */}
          {videoUrl ? (
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

export const callHiggsfield = async (videoConfig) => {
  const HIGGSFIELD_API_KEY = import.meta.env.REACT_APP_HIGGSFIELD_API_KEY;
  const HIGGSFIELD_API_URL = import.meta.env.REACT_APP_HIGGSFIELD_API_URL;

  try {
    // ✅ 메타데이터만 전달 (한글/영문 텍스트 완전 제거)
    const character = videoConfig.character || 'woman';
    const voiceTone = videoConfig.voiceTone || 'professional';
    const metadata = `${character} character, ${voiceTone} tone, product promotion`;

    const response = await axios.post(
      `${HIGGSFIELD_API_URL}/generate`,
      {
        prompt: metadata,
        duration: videoConfig.duration || 8,
        style: 'short-form'
      },
      {
        headers: {
          Authorization: `Bearer ${HIGGSFIELD_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      higgsfieldId: response.data.id,
      videoUrl: response.data.video_url
    };
  } catch (error) {
    console.error('Higgsfield API Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
