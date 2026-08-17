/**
 * frontend/components/GenerationUI.jsx
 *
 * 기능4: AI 콘텐츠 생성 + Higgsfield 영상화
 * 담당: 고수아(UI) + 박주미(API)
 *
 * ⭐ Step5(시나리오) / Step6(제품명) / Step7(카피)는 AI가 초안만 만들고,
 * 사용자가 검토·수정한 뒤 "확정"해야 다음 단계로 진행된다 (기업 니즈가 최종 결정권을 갖도록).
 * Step4(캐릭터설계)·Step8(컴플라이언스)·Step9(영상생성)는 지금처럼 자동 진행.
 *
 * 파이프라인:
 * POST /:resourceId/start                              → Step4 실행, 캐릭터 브리프 검토 대기
 * POST /:resourceId/character/confirm                  → 템플릿 선택 화면으로 이동
 * POST /:resourceId/scenario/loglines                  → (AI 추천) 로그라인 3개 제안
 * POST /:resourceId/scenario/generate-from-logline      → 선택한 로그라인으로 전체 시나리오 생성
 * POST /:resourceId/scenario/draft-review               → (직접 작성) 아이디어 검토 + 구조화 초안
 * POST /:resourceId/scenario/finalize-draft             → 검토된 초안 확정 저장
 * POST /:resourceId/scenario/:scenarioId/confirm        → Step6 실행, 영상 제목 검토 대기
 * POST /:resourceId/naming/confirm                      → Step7 실행, 카피 검토 대기
 * POST /:resourceId/copy/:contentId/confirm             → Step8~9 실행, 완료
 */

import React, { useState, useEffect, useRef } from 'react';

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function GenerationUI({ resourceId, onSuccess, requestType = 'intro', videoType, duration = 120, referenceMaterials = [] }) {
  // stage: 'idle' | 'loading' | 'character_review' | 'template_select' | 'logline_review' |
  //        'draft_review' | 'scenario_review' | 'naming_review' | 'copy_review' | 'done'
  const [stage, setStage] = useState('idle');
  const [loadingLabel, setLoadingLabel] = useState('초기화 중...');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [failedStep, setFailedStep] = useState(null);
  const [showTimeMessage, setShowTimeMessage] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);

  const [characterData, setCharacterData] = useState(null); // { characterBriefs: [{ characterId, character, voice_tone, personality_traits, visual_description }] }
  const [templateData, setTemplateData] = useState(null); // { templates: [...] }
  const [loglineData, setLoglineData] = useState(null); // { templateId, loglineOptions }
  const [draftReviewData, setDraftReviewData] = useState(null); // { userIdea, review }
  const [scenarioData, setScenarioData] = useState(null); // { scenarioId, scenario, timingVerification }
  const [namingData, setNamingData] = useState(null); // { namingId, realProductName, contentNameOptions, fallbackContentName }
  const [copyData, setCopyData] = useState(null); // { contentId, generatedContent }
  // finalResult에는 qaResult(post-generation-qa-agent 결과, 멘토링 피드백 3)도 함께 담겨온다
  const [finalResult, setFinalResult] = useState(null); // { videoUrl, videoStatus, higgsfieldError, validationStatus, validationScore, qaResult }

  // 업로드된 참고자료를 시나리오 작성에 반영할지 여부 (기본: 반영)
  const [useReferenceMaterials, setUseReferenceMaterials] = useState(true);
  const pollingInterval = useRef(null);
  const messageToggleInterval = useRef(null);

  // 성공/실패 배너 자동 소멸
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  // step 이름 → 사용자에게 보여줄 한글 라벨. "higgsfield-video"는 가장 오래 걸리는(최대 10분)
  // 구간이라 별도로 경과 시간을 붙여서 "멈춘 것처럼" 보이지 않게 한다.
  const STEP_LABELS = {
    'trend-analyzer': '자료 분석',
    'character-designer': '캐릭터 설계',
    'shortform-scenario-writer': '시나리오 작성',
    'naming-generator': '제목/제품명 생성',
    'compliance-reviewer': '컴플라이언스 검증',
    'higgsfield-video': 'AI 영상 생성',
    'post-generation-qa': '생성 영상 품질 검증',
  };

  const formatElapsed = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  const startStatusPolling = () => {
    // 남은 시간과 기존 문구 번갈아 표시 (2초 간격)
    setShowTimeMessage(false);
    messageToggleInterval.current = setInterval(() => {
      setShowTimeMessage((prev) => !prev);
    }, 2000);

    pollingInterval.current = setInterval(async () => {
      try {
        const res = await apiGet(`/api/generate/${resourceId}/status`);
        const { progress: progressPercent, completedSteps, totalSteps, currentStep: stepName, failureDetails, inProgressStep } = res;
        const stepLabel = STEP_LABELS[stepName] || stepName;

        if (inProgressStep) {
          // ⭐ Step 9(영상 생성)는 진짜로 몇 분씩 걸리는데, generation_logs 기준 진행률은
          // 그 시간 내내 8/9(≈89%)에 그대로 멈춰 있다 — 사용자에겐 "멈춘 것"처럼 보인다.
          // 경과 시간을 기준으로 89%→98% 사이를 천천히 채워서 "지금도 뭔가 진행 중"임을
          // 보여주고, 실제 완료(progress:100)가 오면 그 값이 그대로 이긴다.
          const elapsedMs = inProgressStep.elapsed_ms || 0;
          const estimatedMs = inProgressStep.step === 'higgsfield-video' ? 5 * 60 * 1000 : 60 * 1000;
          const remainingMs = Math.max(0, estimatedMs - elapsedMs);
          const base = progressPercent || 0;
          const synthetic = Math.min(98, base + (98 - base) * Math.min(1, elapsedMs / estimatedMs));
          setProgress((prev) => Math.min(100, Math.max(prev, synthetic, 5)));
          setRemainingTime(remainingMs);
          setLoadingLabel(
            `🎬 ${STEP_LABELS[inProgressStep.step] || inProgressStep.step} 진행 중... ` +
              `(경과 ${formatElapsed(elapsedMs)}${inProgressStep.step === 'higgsfield-video' ? ', 평균 3~8분 소요' : ''})`
          );
        } else {
          setProgress((prev) => Math.min(100, Math.max(prev, progressPercent || 0, 5)));
          setLoadingLabel(
            stepLabel
              ? `${stepLabel} 진행 중... (${completedSteps || 0}/${totalSteps || 9} 단계)`
              : `AI 생성 중... (${completedSteps || 0}/${totalSteps || 9} 단계)`
          );
        }

        if (failureDetails && failureDetails.length > 0) {
          const failStep = failureDetails[0];
          setFailedStep(failStep.step);
          setErrorDetails({
            step: failStep.step,
            error_message: failStep.error_message,
            error_code: failStep.error_code,
            attempt: failStep.attempt,
          });
        }
      } catch (err) {
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
    if (messageToggleInterval.current) {
      clearInterval(messageToggleInterval.current);
      messageToggleInterval.current = null;
    }
  };

  useEffect(() => {
    return () => stopStatusPolling();
  }, []);

  const beginLoading = (label) => {
    setStage('loading');
    setLoadingLabel(label);
    setProgress(0);
    setError(null);
    setErrorDetails(null);
    setFailedStep(null);
    // 단계에 따라 예상 남은 시간 설정
    if (label.includes('영상') || label.includes('컴플라이언스')) {
      setRemainingTime(5 * 60 * 1000); // 5분
    } else {
      setRemainingTime(60 * 1000); // 1분
    }
    startStatusPolling();
  };

  // ── Stage 1: 생성 시작 → Step4~5 → 시나리오 검토 ──
  const handleGenerate = async () => {
    if (!resourceId) {
      setError('자료를 먼저 선택해주세요.');
      return;
    }

    beginLoading('초기화 중...');

    try {
      const res = await apiPost(`/api/generate/${resourceId}/start`, {
        requestType,
        videoType,
        duration,
        useReferenceMaterials: referenceMaterials.length > 0 ? useReferenceMaterials : undefined,
      });

      stopStatusPolling();

      if (!res.success) {
        throw new Error(res.message || '생성 실패');
      }

      setCharacterData({
        characterBriefs: res.characterBriefs || [],
      });
      setStage('character_review');
    } catch (err) {
      stopStatusPolling();
      console.error('AI 생성 실패:', err);
      setError(err.response?.data?.message || err.message || '생성 중 오류가 발생했습니다.');
      setStage('idle');
    }
  };

  // ── Stage 1.5: 캐릭터 브리프 확정 → 시나리오 스타일 선택 화면 ──
  const handleConfirmCharacter = async ({ editedBriefs, feedback }) => {
    beginLoading('다음 단계 준비 중...');

    try {
      const res = await apiPost(`/api/generate/${resourceId}/character/confirm`, {
        editedBriefs,
        feedback,
      });

      stopStatusPolling();

      if (!res.success) {
        throw new Error(res.message || '캐릭터 확정 실패');
      }

      setTemplateData({ templates: res.templates || [] });
      setStage('template_select');
    } catch (err) {
      stopStatusPolling();
      console.error('캐릭터 확정 실패:', err);
      setError(err.response?.data?.message || err.message || '캐릭터 확정 중 오류가 발생했습니다.');
      setStage('character_review');
    }
  };

  // ── 템플릿 선택(AI 추천 경로) → 로그라인 3개 제안 ──
  const handleSelectTemplate = async (templateId) => {
    beginLoading('스토리 아이디어 구상 중...');
    try {
      const res = await apiPost(`/api/generate/${resourceId}/scenario/loglines`, { templateId });
      stopStatusPolling();
      if (!res.success) throw new Error(res.message || '로그라인 생성 실패');
      setLoglineData({ templateId, loglineOptions: res.loglineOptions || [] });
      setStage('logline_review');
    } catch (err) {
      stopStatusPolling();
      console.error('로그라인 생성 실패:', err);
      setError(err.response?.data?.message || err.message || '아이디어 구상 중 오류가 발생했습니다.');
      setStage('template_select');
    }
  };

  // ── 로그라인 선택 → 전체 시나리오 생성 ──
  const handleSelectLogline = async (selectedLogline) => {
    beginLoading('시나리오 작성 중...');
    try {
      const res = await apiPost(`/api/generate/${resourceId}/scenario/generate-from-logline`, {
        templateId: loglineData.templateId,
        selectedLogline,
      });
      stopStatusPolling();
      if (!res.success) throw new Error(res.message || '시나리오 생성 실패');
      setScenarioData({
        scenarioId: res.scenarioId,
        scenario: res.scenario,
        timingVerification: res.timingVerification,
      });
      setStage('scenario_review');
    } catch (err) {
      stopStatusPolling();
      console.error('시나리오 생성 실패:', err);
      setError(err.response?.data?.message || err.message || '시나리오 생성 중 오류가 발생했습니다.');
      setStage('logline_review');
    }
  };

  // ── 직접 작성 경로: 아이디어 제출/재검토 ──
  const handleSubmitIdea = async (userIdea) => {
    beginLoading('아이디어 검토 중...');
    try {
      const res = await apiPost(`/api/generate/${resourceId}/scenario/draft-review`, { userIdea });
      stopStatusPolling();
      if (!res.success) throw new Error(res.message || '아이디어 검토 실패');
      setDraftReviewData({ userIdea, review: res.review });
      setStage('draft_review');
    } catch (err) {
      stopStatusPolling();
      console.error('아이디어 검토 실패:', err);
      setError(err.response?.data?.message || err.message || '아이디어 검토 중 오류가 발생했습니다.');
      setStage('draft_review');
    }
  };

  // ── 직접 작성 경로: 검토된 초안 확정 ──
  const handleAcceptDraft = async (structuredDraft) => {
    beginLoading('시나리오 확정 중...');
    try {
      const res = await apiPost(`/api/generate/${resourceId}/scenario/finalize-draft`, { structuredDraft });
      stopStatusPolling();
      if (!res.success) throw new Error(res.message || '시나리오 확정 실패');
      setScenarioData({
        scenarioId: res.scenarioId,
        scenario: res.scenario,
        timingVerification: res.timingVerification,
      });
      setStage('scenario_review');
    } catch (err) {
      stopStatusPolling();
      console.error('시나리오 확정 실패:', err);
      setError(err.response?.data?.message || err.message || '시나리오 확정 중 오류가 발생했습니다.');
      setStage('draft_review');
    }
  };

  // ── Stage 2: 시나리오 확정 → Step6 → 영상 제목 검토 ──
  const handleConfirmScenario = async ({ editedStoryContent, editedActs, feedback }) => {
    beginLoading('제품명/콘텐츠명 생성 중...');

    try {
      const res = await apiPost(
        `/api/generate/${resourceId}/scenario/${scenarioData.scenarioId}/confirm`,
        { editedStoryContent, editedActs, feedback }
      );

      stopStatusPolling();

      if (!res.success) {
        throw new Error(res.message || '시나리오 확정 실패');
      }

      setNamingData({
        namingId: res.namingId,
        realProductName: res.realProductName,
        contentNameOptions: res.contentNameOptions || [],
        fallbackContentName: res.fallbackContentName,
      });
      setStage('naming_review');
    } catch (err) {
      stopStatusPolling();
      console.error('시나리오 확정 실패:', err);
      setError(err.response?.data?.message || err.message || '시나리오 확정 중 오류가 발생했습니다.');
      setStage('scenario_review');
    }
  };

  // ── Stage 3: 영상 제목 확정 → Step7 → 카피 검토 ──
  const handleConfirmNaming = async ({ selectedContentName }) => {
    beginLoading('마케팅 카피 작성 중...');

    try {
      const res = await apiPost(`/api/generate/${resourceId}/naming/confirm`, {
        selectedContentName,
      });

      stopStatusPolling();

      if (!res.success) {
        throw new Error(res.message || '제품명 확정 실패');
      }

      setCopyData({
        contentId: res.contentId,
        generatedContent: res.generatedContent,
      });
      setStage('copy_review');
    } catch (err) {
      stopStatusPolling();
      console.error('제품명 확정 실패:', err);
      setError(err.response?.data?.message || err.message || '제품명 확정 중 오류가 발생했습니다.');
      setStage('naming_review');
    }
  };

  // ── Stage 4: 카피 확정 → Step8~9 → 완료 ──
  const handleConfirmCopy = async ({ editedContent }) => {
    beginLoading('컴플라이언스 검증 중...');

    try {
      const res = await apiPost(`/api/generate/${resourceId}/copy/${copyData.contentId}/confirm`, {
        editedContent,
      });

      stopStatusPolling();

      if (!res.success) {
        throw new Error(res.message || '카피 확정 실패');
      }

      setFinalResult(res);
      setProgress(100);
      setStage('done');

      if (res.videoUrl) {
        setSuccessMessage('영상이 생성되었습니다!');
      }
      // ⚠️ 예전에는 여기서 곧바로 onSuccess(res.data)를 호출했는데, onSuccess는 App.jsx의
      // handleGenerationComplete로 이어져서 resourceId를 즉시 비우고 currentStep을 'filter'로
      // 되돌린다. setStage('done')과 onSuccess 호출이 같은 이벤트 핸들러 안에서 같은 렌더에
      // batching되면서, 사용자는 완성된 영상(DoneScreen)을 단 한 프레임도 보지 못하고 화면이
      // 곧바로 첫 화면(자료 필터링)으로 튕겨나가며 모든 데이터가 사라진 것처럼 보였다.
      // 이제는 DoneScreen을 보여주기만 하고, 사용자가 "새 자료 만들기"를 직접 눌러야만
      // onSuccess(=처음 화면으로 리셋)가 실행된다.
    } catch (err) {
      stopStatusPolling();
      console.error('카피 확정 실패:', err);
      setError(err.response?.data?.message || err.message || '카피 확정 중 오류가 발생했습니다.');
      setStage('copy_review');
    }
  };

  const handleGoHome = () => {
    if (onSuccess) onSuccess(finalResult);
  };

  const handleRestart = () => {
    setStage('idle');
    setCharacterData(null);
    setTemplateData(null);
    setLoglineData(null);
    setDraftReviewData(null);
    setScenarioData(null);
    setNamingData(null);
    setCopyData(null);
    setFinalResult(null);
    setProgress(0);
  };

  const STEP5_SUBSTAGES = ['template_select', 'logline_review', 'draft_review'];

  // 단계 인디케이터 완료 여부를 stage 기준으로 계산
  const stepDone = {
    step4: [...STEP5_SUBSTAGES, 'scenario_review', 'naming_review', 'copy_review', 'done'].includes(stage) || (stage === 'loading' && !!characterData),
    step5: ['naming_review', 'copy_review', 'done'].includes(stage) || (stage === 'loading' && !!scenarioData),
    step6: ['copy_review', 'done'].includes(stage) || (stage === 'loading' && !!namingData),
    step7: stage === 'done',
  };

  // ─────────────────────────────────────────────────────
  // UI 렌더링
  // ─────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-6 ui-card animate-fade-in">
      <h2 className="text-2xl font-bold mb-1">🎬 AI 콘텐츠 생성</h2>
      <p className="text-sm text-dark-text-muted mb-6">
        {videoType || '제품스토리'} · {duration}초 숏폼으로 생성됩니다
      </p>

      {error && (
        <div className="bg-status-rejected/10 border border-status-rejected/30 text-status-rejected px-4 py-3 rounded mb-4 animate-fade-in">
          <div className="font-semibold">{error}</div>
          {errorDetails && (
            <div className="text-sm mt-2 space-y-1">
              <div className="text-status-rejected/80"><strong>Step:</strong> {errorDetails.step}</div>
              <div className="text-status-rejected/80"><strong>에러 코드:</strong> {errorDetails.error_code || 'UNKNOWN'}</div>
            </div>
          )}
        </div>
      )}
      {successMessage && (
        <div className="bg-status-approved/10 border border-status-approved/30 text-status-approved px-4 py-3 rounded mb-4 animate-fade-in">
          {successMessage}
        </div>
      )}

      {stage === 'loading' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">{loadingLabel}</div>
            <div className="text-3xl font-bold text-brand-blue">{progress}%</div>
          </div>
          <div className="space-y-2">
            <div className="w-full bg-dark-chip rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-blue to-brand-blue-dark h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-dark-text-muted text-center">
              {showTimeMessage ? (
                remainingTime ? (
                  <>
                    ⏱️ 남은 시간: <strong>{Math.ceil(remainingTime / 1000)}초</strong>
                  </>
                ) : (
                  '거의 다 됐습니다...'
                )
              ) : (
                '잠시만 기다려주세요...'
              )}
            </div>
          </div>
          <div className="bg-dark-bg rounded-lg p-4 space-y-0 text-sm">
            <StepItem label="Step 4: 캐릭터 상세 설계" done={stepDone.step4} active={!stepDone.step4} isLast={false} />
            <StepItem label="Step 5: 시나리오 작성" done={stepDone.step5} active={stepDone.step4 && !stepDone.step5} isLast={false} />
            <StepItem label="Step 6-7: 영상 제목 & 카피 작성" done={stepDone.step6} active={stepDone.step5 && !stepDone.step6} isLast={false} />
            <StepItem label="Step 8-9: 컴플라이언스 & 영상 생성" done={stepDone.step7} active={stepDone.step6 && !stepDone.step7} isLast={true} />
          </div>
          {failedStep && errorDetails && (
            <div className="bg-status-pending/10 border border-status-pending/30 p-4 rounded">
              <div className="font-semibold text-status-pending mb-2">⚠️ 현재 단계 재시도 중</div>
              <div className="text-sm text-dark-text space-y-1">
                <div><strong>단계:</strong> {errorDetails.step}</div>
                <div><strong>에러:</strong> {errorDetails.error_message}</div>
                <div className="text-xs text-status-pending/80 mt-2">자동으로 재시도 중입니다. 잠시만 기다려주세요...</div>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'character_review' && characterData && (
        <CharacterReviewPanel characterData={characterData} onConfirm={handleConfirmCharacter} />
      )}

      {stage === 'template_select' && templateData && (
        <TemplateSelectPanel
          templates={templateData.templates}
          onSelectTemplate={handleSelectTemplate}
          onSelectDirectWrite={() => { setDraftReviewData({ userIdea: '', review: null }); setStage('draft_review'); }}
        />
      )}

      {stage === 'logline_review' && loglineData && (
        <LoglineReviewPanel
          loglineOptions={loglineData.loglineOptions}
          onSelectLogline={handleSelectLogline}
          onBack={() => setStage('template_select')}
        />
      )}

      {stage === 'draft_review' && draftReviewData && (
        <DraftReviewPanel
          draftReviewData={draftReviewData}
          onSubmitIdea={handleSubmitIdea}
          onAccept={handleAcceptDraft}
          onBack={() => setStage('template_select')}
        />
      )}

      {stage === 'scenario_review' && scenarioData && (
        <ScenarioReviewPanel
          resourceId={resourceId}
          scenarioData={scenarioData}
          onConfirm={handleConfirmScenario}
        />
      )}

      {stage === 'naming_review' && namingData && (
        <NamingReviewPanel namingData={namingData} onConfirm={handleConfirmNaming} />
      )}

      {stage === 'copy_review' && copyData && (
        <CopyReviewPanel resourceId={resourceId} copyData={copyData} onConfirm={handleConfirmCopy} />
      )}

      {stage === 'done' && finalResult && (
        <DoneScreen finalResult={finalResult} onRestart={handleRestart} onRetryVideo={handleGenerate} onGoHome={handleGoHome} />
      )}

      {stage === 'idle' && (
        <>
          <div className="bg-brand-blue/10 p-4 rounded mb-4 text-sm">
            <div className="font-semibold mb-2">📌 이제 시작할 생성 과정</div>
            <ul className="list-disc list-inside space-y-1 text-dark-text">
              <li>Step 4: 선택한 캐릭터 상세 설계(말투·성격·외형) <span className="text-brand-blue">(검토/수정 가능)</span></li>
              <li>Step 5: {duration}초 시나리오 작성 <span className="text-brand-blue">(검토/수정 가능)</span></li>
              <li>Step 6: 영상 제목 생성 <span className="text-brand-blue">(검토/수정 가능)</span> · 제품명은 그대로 유지</li>
              <li>Step 7: 마케팅 카피 작성 <span className="text-brand-blue">(검토/수정 가능)</span></li>
              <li>Step 8: 컴플라이언스 검증 <span className="text-dark-text-muted">(자동)</span></li>
              <li>Step 9: Higgsfield에서 숏폼 영상 생성 <span className="text-dark-text-muted">(자동)</span></li>
            </ul>
          </div>

          {referenceMaterials.length > 0 && (
            <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4 mb-4 text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useReferenceMaterials}
                  onChange={(e) => setUseReferenceMaterials(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <span>
                  <strong>📎 업로드한 참고자료를 시나리오에 반영할까요?</strong>
                  <ul className="mt-1 text-dark-text-muted list-disc list-inside">
                    {referenceMaterials.map((f) => (
                      <li key={f.filename}>{f.filename}</li>
                    ))}
                  </ul>
                </span>
              </label>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!resourceId}
            className="w-full px-6 py-3 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 AI 콘텐츠 생성 시작
          </button>

          {!resourceId && (
            <div className="mt-3 text-sm text-dark-text-muted text-center">자료를 먼저 선택하세요.</div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 트렌드 추천 패널 — TimelyAI(LLM) 지식 기반 추천. 실시간 검색이 아님을 항상 명시한다.
 */
function TrendPanel({ resourceId, onInsert }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [fetchError, setFetchError] = useState(null);

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (trends) return; // 이미 불러왔으면 재호출하지 않음

    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiGet(`/api/generate/${resourceId}/trends`);
      if (res.success) {
        setTrends(res.trends || []);
        setDisclaimer(res.disclaimer || '');
      } else {
        setFetchError('트렌드 추천을 불러오지 못했습니다.');
      }
    } catch (err) {
      setFetchError('트렌드 추천을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm text-brand-blue hover:text-brand-blue-dark font-semibold"
      >
        📈 {open ? '트렌드 아이디어 닫기' : 'AI 트렌드 아이디어 보기'}
      </button>

      {open && (
        <div className="mt-2 bg-dark-bg rounded-lg p-3 border border-dark-chip animate-fade-in">
          {loading && <div className="text-sm text-dark-text-muted">불러오는 중...</div>}
          {fetchError && <div className="text-sm text-status-rejected">{fetchError}</div>}
          {trends && (
            <>
              <div className="text-xs text-dark-text-muted mb-2 italic">{disclaimer}</div>
              <div className="space-y-2">
                {trends.map((t, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => onInsert(`[${t.keyword}] ${t.angle}`)}
                    className="w-full text-left bg-dark-chip hover:brightness-125 rounded p-2 text-sm"
                    title="클릭하면 편집창에 삽입됩니다"
                  >
                    <span className="font-semibold text-brand-blue">#{t.keyword}</span>{' '}
                    <span className="text-dark-text">{t.angle}</span>
                    <div className="text-xs text-dark-text-muted mt-0.5">{t.reason}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Step4: 캐릭터 브리프(말투/성격/외형) 검토/수정 패널 — 여러 캐릭터가 선택됐으면 전원 표시.
 * 각 캐릭터를 그대로 사용하거나 개별적으로 수정할 수 있다.
 */
function CharacterReviewPanel({ characterData, onConfirm }) {
  const { characterBriefs } = characterData;
  const [editingIds, setEditingIds] = useState({});
  const [drafts, setDrafts] = useState(() => {
    const initial = {};
    characterBriefs.forEach((b) => {
      initial[b.characterId] = {
        voice_tone: b.voice_tone || "",
        personality_traits: Array.isArray(b.personality_traits) ? b.personality_traits.join(", ") : (b.personality_traits || ""),
        visual_description: b.visual_description || "",
      };
    });
    return initial;
  });

  const toggleEdit = (id) => setEditingIds((prev) => ({ ...prev, [id]: !prev[id] }));
  const updateDraft = (id, field, value) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleConfirm = () => {
    const editedBriefs = {};
    characterBriefs.forEach((b) => {
      if (editingIds[b.characterId]) {
        editedBriefs[b.characterId] = {
          voice_tone: drafts[b.characterId].voice_tone,
          personality_traits: drafts[b.characterId].personality_traits.split(",").map((t) => t.trim()).filter(Boolean),
          visual_description: drafts[b.characterId].visual_description,
        };
      }
    });
    onConfirm({ editedBriefs: Object.keys(editedBriefs).length > 0 ? editedBriefs : undefined });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
        <div className="font-semibold mb-1">🎭 Step 4: 캐릭터 상세 설계 검토</div>
        <div className="text-sm text-dark-text-muted">
          {characterBriefs.length > 1
            ? `선택하신 ${characterBriefs.length}명의 캐릭터가 이 브리프를 바탕으로 함께 등장하는 시나리오가 만들어집니다.`
            : 'AI가 만든 캐릭터 브리프입니다. 그대로 사용하거나 직접 수정할 수 있어요.'}
        </div>
      </div>

      {characterBriefs.map((b) => {
        const isEditing = !!editingIds[b.characterId];
        const draft = drafts[b.characterId];
        return (
          <div key={b.characterId} className="bg-dark-bg rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="font-semibold">{b.character}</div>
              <button
                type="button"
                onClick={() => toggleEdit(b.characterId)}
                className="text-xs text-brand-blue hover:text-brand-blue-dark"
              >
                {isEditing ? '수정 취소' : '✏️ 수정하기'}
              </button>
            </div>

            {!isEditing ? (
              <div className="text-sm text-dark-text space-y-1">
                <div><strong>목소리 톤:</strong> {draft.voice_tone}</div>
                <div><strong>성격:</strong> {draft.personality_traits}</div>
                <div><strong>외형:</strong> {draft.visual_description}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-dark-text-muted">목소리 톤</label>
                  <input
                    type="text"
                    value={draft.voice_tone}
                    onChange={(e) => updateDraft(b.characterId, 'voice_tone', e.target.value)}
                    className="w-full mt-1 bg-dark-chip rounded p-2 text-sm text-dark-text"
                  />
                </div>
                <div>
                  <label className="text-xs text-dark-text-muted">성격 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={draft.personality_traits}
                    onChange={(e) => updateDraft(b.characterId, 'personality_traits', e.target.value)}
                    className="w-full mt-1 bg-dark-chip rounded p-2 text-sm text-dark-text"
                  />
                </div>
                <div>
                  <label className="text-xs text-dark-text-muted">외형 묘사</label>
                  <textarea
                    value={draft.visual_description}
                    onChange={(e) => updateDraft(b.characterId, 'visual_description', e.target.value)}
                    rows={3}
                    className="w-full mt-1 bg-dark-chip rounded p-2 text-sm text-dark-text"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={handleConfirm} className="w-full px-4 py-2 btn-primary">
        ✅ 확정하고 다음 단계로
      </button>
    </div>
  );
}

/**
 * Step5-a: "어떤 스타일로 만들까요?" 템플릿 선택 화면 (AI 추천 경로 진입점)
 * 10개 숏폼 템플릿 카드 + "직접 작성" 카드(점선 테두리로 구분)
 */
function TemplateSelectPanel({ templates, onSelectTemplate, onSelectDirectWrite }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
        <div className="font-semibold mb-1">🎨 Step 5: 어떤 스타일로 만들까요?</div>
        <div className="text-sm text-dark-text-muted">
          최신 숏폼 트렌드에 맞춘 스타일을 골라주세요. 카드를 클릭하면 예시를 미리 볼 수 있어요.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((t) => {
          const expanded = expandedId === t.id;
          return (
            <div
              key={t.id}
              className={`rounded-lg border p-4 cursor-pointer transition ${
                expanded ? 'border-brand-blue bg-brand-blue/10' : 'border-dark-chip bg-dark-bg hover:border-brand-blue/40'
              }`}
              onClick={() => setExpandedId(expanded ? null : t.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{t.icon}</span>
                <span className="font-semibold">{t.label}</span>
              </div>
              <div className="text-xs text-dark-text-muted">{t.description}</div>

              {expanded && (
                <div className="mt-3 space-y-2 animate-fade-in">
                  <div className="text-xs text-dark-text bg-dark-chip rounded p-2">
                    <strong>예시:</strong> {t.example}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.toneKeywords.map((kw) => (
                      <span key={kw} className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">
                        #{kw}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-dark-text-muted">⏱ {t.durationRange}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectTemplate(t.id); }}
                    className="w-full px-3 py-2 btn-primary text-sm"
                  >
                    이 스타일로 시작하기
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* 직접 작성 카드 — 점선 테두리로 구분 */}
        <div
          className="rounded-lg border-2 border-dashed border-dark-chip p-4 cursor-pointer hover:border-brand-blue/50 transition flex flex-col items-center justify-center text-center"
          onClick={onSelectDirectWrite}
        >
          <div className="text-xl mb-1">✏️</div>
          <div className="font-semibold">내가 직접 아이디어 낼게요</div>
          <div className="text-xs text-dark-text-muted mt-1">자유롭게 써주시면 AI가 검토하고 구조화해드려요</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step5-b: (AI 추천 경로) 로그라인 3개 중 선택
 */
function LoglineReviewPanel({ loglineOptions, onSelectLogline, onBack }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
        <div className="font-semibold mb-1">💡 어떤 이야기로 만들까요?</div>
        <div className="text-sm text-dark-text-muted">마음에 드는 아이디어를 골라주세요. 선택하면 전체 시나리오로 완성됩니다.</div>
      </div>

      <div className="space-y-3">
        {loglineOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelectLogline(opt)}
            className="w-full text-left bg-dark-bg hover:border-brand-blue/50 border border-dark-chip rounded-lg p-4 transition"
          >
            <div className="font-semibold mb-1">{opt.title}</div>
            <div className="text-sm text-dark-text-muted">{opt.logline}</div>
          </button>
        ))}
      </div>

      <button onClick={onBack} className="text-sm text-dark-text-muted hover:text-dark-text">
        ← 스타일 다시 고르기
      </button>
    </div>
  );
}

/**
 * Step5-c: (직접 작성 경로) 아이디어 입력 → AI 검토(브랜드보이스/컴플라이언스) → 구조화 초안 확정
 */
function DraftReviewPanel({ draftReviewData, onSubmitIdea, onAccept, onBack }) {
  const [idea, setIdea] = useState(draftReviewData.userIdea || '');
  const { review } = draftReviewData;

  const statusBadge = (status) => {
    const map = {
      PASS: { icon: '✅', className: 'text-status-approved' },
      WARNING: { icon: '⚠️', className: 'text-status-pending' },
      FAIL: { icon: '❌', className: 'text-status-rejected' },
    };
    return map[status] || map.WARNING;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
        <div className="font-semibold mb-1">✏️ 직접 아이디어 작성</div>
        <div className="text-sm text-dark-text-muted">
          어떤 이야기를 만들고 싶으세요? (예: 톳소금이가 헬스장에서 전해질 마시는 15초 영상)
        </div>
      </div>

      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={4}
        placeholder="어떤 이야기를 만들고 싶으세요?"
        className="w-full bg-dark-chip rounded p-3 text-sm text-dark-text"
      />

      {!review ? (
        <button
          onClick={() => onSubmitIdea(idea)}
          disabled={!idea.trim()}
          className="w-full px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🔍 AI 검토 받기
        </button>
      ) : (
        <div className="space-y-3 animate-fade-in">
          <div className="bg-dark-bg rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className={statusBadge(review.brandVoiceFit?.status).className}>
                {statusBadge(review.brandVoiceFit?.status).icon} 브랜드 보이스
              </span>
              <span className="text-dark-text-muted">{review.brandVoiceFit?.comment}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className={statusBadge(review.complianceCheck?.status).className}>
                {statusBadge(review.complianceCheck?.status).icon} 컴플라이언스
              </span>
              {review.complianceCheck?.issues?.length > 0 ? (
                <div className="text-dark-text-muted space-y-1">
                  {review.complianceCheck.issues.map((iss, idx) => (
                    <div key={idx}>
                      "{iss.text}" — {iss.reason} (제안: {iss.suggestion})
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-dark-text-muted">문제 없음</span>
              )}
            </div>
            <div className="text-sm text-dark-text-muted">
              ⏱ 추천 길이: {review.suggestedDuration}
            </div>
          </div>

          <div className="bg-dark-bg rounded-lg p-4">
            <div className="text-sm font-semibold mb-2">{review.structuredDraft?.title}</div>
            <p className="text-sm text-dark-text whitespace-pre-wrap">{review.structuredDraft?.story_content}</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => onAccept(review.structuredDraft)} className="flex-1 px-4 py-2 btn-primary">
              ✅ 이대로 진행
            </button>
            <button
              onClick={() => onSubmitIdea(idea)}
              className="flex-1 px-4 py-2 bg-dark-chip text-dark-text rounded-lg hover:brightness-125"
            >
              🔄 다시 수정해서 재검토
            </button>
          </div>
        </div>
      )}

      <button onClick={onBack} className="text-sm text-dark-text-muted hover:text-dark-text">
        ← 스타일 다시 고르기
      </button>
    </div>
  );
}

/**
 * Step5: 시나리오 검토/수정 패널 (MetadataReviewUI.jsx의 확정본+임시편집본 패턴 재사용)
 */
function ScenarioReviewPanel({ resourceId, scenarioData, onConfirm }) {
  const { scenario } = scenarioData;
  const [editing, setEditing] = useState(false);
  const [storyContent, setStoryContent] = useState(scenario.story_content || '');
  const [feedback, setFeedback] = useState('');

  const handleUseAsIs = () => {
    onConfirm({});
  };

  const handleConfirmEdit = () => {
    onConfirm({ editedStoryContent: storyContent, feedback: feedback || undefined });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
        <div className="font-semibold mb-1">📝 Step 5: 시나리오 검토</div>
        <div className="text-sm text-dark-text-muted">AI가 작성한 시나리오입니다. 그대로 사용하거나 직접 수정할 수 있어요.</div>
      </div>

      <TrendPanel resourceId={resourceId} onInsert={(text) => {
        setEditing(true);
        setStoryContent((prev) => `${prev}\n\n${text}`);
      }} />

      <div className="bg-dark-bg rounded-lg p-4">
        <div className="text-sm font-semibold mb-2">{scenario.title}</div>
        {!editing ? (
          <p className="text-sm text-dark-text whitespace-pre-wrap">{storyContent}</p>
        ) : (
          <textarea
            value={storyContent}
            onChange={(e) => setStoryContent(e.target.value)}
            rows={8}
            className="w-full bg-dark-chip rounded p-3 text-sm text-dark-text"
          />
        )}
      </div>

      {editing && (
        <div>
          <label className="text-xs text-dark-text-muted">피드백 메모 (선택)</label>
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="예: 도입부를 더 짧게 해달라고 요청했음"
            className="w-full mt-1 bg-dark-chip rounded p-2 text-sm text-dark-text"
          />
        </div>
      )}

      <div className="flex gap-3">
        {!editing ? (
          <>
            <button onClick={handleUseAsIs} className="flex-1 px-4 py-2 btn-primary">
              ✅ AI 초안 그대로 사용
            </button>
            <button
              onClick={() => setEditing(true)}
              className="flex-1 px-4 py-2 btn-primary"
            >
              ✏️ 수정하겠습니다
            </button>
          </>
        ) : (
          <>
            <button onClick={handleConfirmEdit} className="flex-1 px-4 py-2 btn-primary">
              ✅ 수정 확정하고 다음 단계로
            </button>
            <button
              onClick={() => { setEditing(false); setStoryContent(scenario.story_content || ''); }}
              className="flex-1 px-4 py-2 bg-dark-chip text-dark-text rounded-lg hover:brightness-125"
            >
              취소
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Step6: 영상 제목(콘텐츠명) 검토 패널
 *
 * ⭐ 제품명은 여기서 다루지 않는다 — Step1에서 입력한 실제 제품명은 절대 바뀌지 않으며,
 * 참고용으로만 보여준다. 이 단계에서 정하는 것은 오직 "이 시나리오/카피에 붙일 영상 제목"뿐이다.
 */
function NamingReviewPanel({ namingData, onConfirm }) {
  const { realProductName, contentNameOptions, fallbackContentName } = namingData;

  const [selectedContent, setSelectedContent] = useState(contentNameOptions[0]?.name || fallbackContentName || '');
  const [customContent, setCustomContent] = useState('');
  const [useCustomContent, setUseCustomContent] = useState(false);

  const handleConfirm = () => {
    onConfirm({
      selectedContentName: useCustomContent ? customContent : selectedContent,
    });
  };

  const isValid = useCustomContent ? customContent.trim() : selectedContent;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
        <div className="font-semibold mb-1">🏷️ Step 6: 영상 제목 검토</div>
        <div className="text-sm text-dark-text-muted">
          제품명(<strong className="text-dark-text">{realProductName}</strong>)은 그대로 유지됩니다.
          여기서는 이 시나리오/카피에 붙일 <strong className="text-dark-text">영상 제목</strong>만 고르거나 직접 입력하세요.
        </div>
      </div>

      <NameOptionGroup
        title="영상 제목"
        options={contentNameOptions}
        selected={selectedContent}
        onSelect={(name) => { setSelectedContent(name); setUseCustomContent(false); }}
        useCustom={useCustomContent}
        customValue={customContent}
        onCustomChange={setCustomContent}
        onUseCustom={() => setUseCustomContent(true)}
      />

      <button
        onClick={handleConfirm}
        disabled={!isValid}
        className="w-full px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ✅ 확정하고 다음 단계로
      </button>
    </div>
  );
}

function NameOptionGroup({ title, options, selected, onSelect, useCustom, customValue, onCustomChange, onUseCustom }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <label
            key={idx}
            className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer border ${
              !useCustom && selected === opt.name ? 'border-brand-blue bg-brand-blue/10' : 'border-dark-chip bg-dark-bg'
            }`}
          >
            <input
              type="radio"
              checked={!useCustom && selected === opt.name}
              onChange={() => onSelect(opt.name)}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-semibold text-dark-text">{opt.name}</span>{' '}
              <span className="text-xs text-dark-text-muted">({opt.score}점)</span>
              <div className="text-xs text-dark-text-muted">{opt.meaning}</div>
            </span>
          </label>
        ))}
        <label
          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer border ${
            useCustom ? 'border-brand-blue bg-brand-blue/10' : 'border-dark-chip bg-dark-bg'
          }`}
        >
          <input type="radio" checked={useCustom} onChange={onUseCustom} />
          <input
            type="text"
            value={customValue}
            onChange={(e) => { onCustomChange(e.target.value); onUseCustom(); }}
            placeholder="직접 입력..."
            className="flex-1 bg-transparent text-sm text-dark-text outline-none"
          />
        </label>
      </div>
    </div>
  );
}

/**
 * Step7: 카피 검토/수정 패널
 */
function CopyReviewPanel({ resourceId, copyData, onConfirm }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(copyData.generatedContent || '');

  const handleUseAsIs = () => onConfirm({});
  const handleConfirmEdit = () => onConfirm({ editedContent: content });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
        <div className="font-semibold mb-1">✍️ Step 7: 카피 검토</div>
        <div className="text-sm text-dark-text-muted">
          숏폼 영상을 올릴 때 <strong className="text-dark-text">영상 아래 상세 설명(캡션)</strong>으로 바로 붙여넣을 수 있는 카피예요.
          AI 초안을 그대로 쓰거나, 브랜드 톤에 맞게 직접 다듬어보세요.
        </div>
      </div>

      <TrendPanel resourceId={resourceId} onInsert={(text) => {
        setEditing(true);
        setContent((prev) => `${prev}\n\n${text}`);
      }} />

      <div className="bg-dark-bg rounded-lg p-4">
        {!editing ? (
          <p className="text-sm text-dark-text whitespace-pre-wrap">{content}</p>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full bg-dark-chip rounded p-3 text-sm text-dark-text"
          />
        )}
      </div>

      <div className="flex gap-3">
        {!editing ? (
          <>
            <button onClick={handleUseAsIs} className="flex-1 px-4 py-2 btn-primary">
              ✅ AI 초안 그대로 사용
            </button>
            <button
              onClick={() => setEditing(true)}
              className="flex-1 px-4 py-2 btn-primary"
            >
              ✏️ 수정하겠습니다
            </button>
          </>
        ) : (
          <>
            <button onClick={handleConfirmEdit} className="flex-1 px-4 py-2 btn-primary">
              ✅ 수정 확정하고 영상 생성
            </button>
            <button
              onClick={() => { setEditing(false); setContent(copyData.generatedContent || ''); }}
              className="flex-1 px-4 py-2 bg-dark-chip text-dark-text rounded-lg hover:brightness-125"
            >
              취소
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 완료 화면 (기존 videoUrl 표시 로직 유지)
 */
function DoneScreen({ finalResult, onRestart, onRetryVideo, onGoHome }) {
  const { videoUrl, validationStatus, validationScore, higgsfieldError, qaResult } = finalResult;
  const videoFailed = !videoUrl;

  if (videoFailed) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="bg-status-pending/10 p-4 rounded border border-status-pending/30">
          <div className="text-lg font-bold text-status-pending mb-2">
            ⚠️ 콘텐츠는 생성됐지만 영상 생성에 실패했습니다
          </div>
          <div className="text-sm text-dark-text space-y-1 mb-2">
            <div><strong>검증 상태:</strong> {validationStatus}</div>
            <div><strong>검증 점수:</strong> {validationScore}/100</div>
          </div>
          <div className="text-sm text-status-pending bg-status-pending/10 rounded p-2 mt-2">
            {higgsfieldError || '영상 생성에 실패했습니다.'}
          </div>
        </div>
        <button onClick={onRetryVideo} className="w-full px-4 py-2 btn-primary">
          🔄 처음부터 다시 생성
        </button>
        <button onClick={onGoHome} className="w-full px-4 py-2 bg-dark-chip rounded hover:brightness-110">
          🏠 새 자료 만들기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-status-approved/10 p-4 rounded border border-status-approved/30">
        <div className="text-lg font-bold text-status-approved mb-2">✅ 영상이 생성되었습니다!</div>
        <div className="text-sm text-dark-text space-y-1">
          <div><strong>검증 상태:</strong> {validationStatus}</div>
          <div><strong>검증 점수:</strong> {validationScore}/100</div>
        </div>
      </div>

      <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-brand-blue">
        <video src={videoUrl} controls className="w-full h-full" onError={() => console.error('비디오 재생 불가')}>
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="bg-dark-bg p-4 rounded-lg">
        <div className="text-sm text-dark-text space-y-2">
          <div>
            <strong>비디오 URL:</strong>{' '}
            <code className="bg-dark-chip px-2 py-1 rounded text-xs break-all">{videoUrl}</code>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(videoUrl)}
            className="text-brand-blue hover:text-brand-blue-dark text-sm"
          >
            📋 복사
          </button>
        </div>
      </div>

      {/* 🆕 생성 영상 QA 결과 (post-generation-qa-agent, 멘토링 피드백 3) */}
      {qaResult && (
        <div className="bg-dark-bg p-4 rounded-lg border border-brand-blue/20">
          <div className="flex items-center justify-between mb-3">
            <strong className="text-sm">🔍 생성 영상 품질 검증</strong>
            <span className="text-sm text-dark-text-muted">종합 점수: {qaResult.overall_score}/100</span>
          </div>

          {!qaResult.qa_passed && (
            <div className="bg-status-rejected/10 border border-status-rejected/30 text-status-rejected px-3 py-2 rounded mb-3 text-sm">
              ⚠️ 품질 검증 실패 — 재생성을 권장합니다.
            </div>
          )}

          <div className="space-y-1.5">
            {(qaResult.qa_checks || []).map((check) => (
              <div
                key={check.check_id}
                className="flex items-center justify-between text-xs bg-dark-chip rounded px-3 py-2"
              >
                <span>{check.check_id}</span>
                <span className="text-dark-text-muted flex-1 mx-3 truncate">{check.details}</span>
                <span
                  className={`status-badge ${
                    check.result === 'pass'
                      ? 'status-approved'
                      : check.result === 'warning'
                      ? 'status-pending'
                      : 'status-rejected'
                  }`}
                >
                  {check.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onRestart} className="flex-1 px-4 py-2 btn-primary">
          🔄 같은 자료로 다시 생성
        </button>
        <button onClick={onGoHome} className="flex-1 px-4 py-2 bg-dark-chip rounded hover:brightness-110">
          🏠 새 자료 만들기
        </button>
      </div>
    </div>
  );
}

/**
 * 단계별 체크리스트 항목 (연결선 포함 타임라인)
 */
function StepItem({ label, done, active, isLast }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            done ? 'step-circle-done' : active ? 'bg-brand-blue text-white' : 'bg-dark-chip text-dark-text-muted'
          }`}
        >
          {done ? '✓' : active ? (
            <span className="step-circle-spinner block w-2.5 h-2.5 rounded-full border-2 border-t-transparent animate-spin" />
          ) : (
            '-'
          )}
        </div>
        {!isLast && <div className={`w-0.5 flex-1 min-h-[14px] ${done ? 'bg-brand-blue' : 'bg-dark-chip'}`} />}
      </div>
      <span
        className={`pb-3 text-sm ${
          done ? 'text-dark-text-muted line-through' : active ? 'text-dark-text font-semibold' : 'text-dark-text-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
