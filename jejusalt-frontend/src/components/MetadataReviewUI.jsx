/**
 * frontend/components/MetadataReviewUI.jsx
 *
 * Step 2: AI 분석 결과(메타데이터) 검토 및 수정
 * 역할: 사용자가 AI가 추천한 메타데이터(카테고리, 나이대, 대상, 강조점)를 확인하고 수정
 *
 * 플로우:
 * 1. AI 분석 결과 표시 (신뢰도 포함)
 * 2. "AI 추천 그대로 사용" 또는 "수정하겠습니다" 선택
 * 3. 수정 모드에서 체크박스로 항목 선택/제거
 * 4. 저장하면 Step 3(캐릭터 추천)으로 진행
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

// 사업 우선순위 카테고리 (뷰티 > 헬스케어) — UI에서 ⭐ 우선순위 뱃지로 강조
const PRIORITY_CATEGORIES = ['뷰티', '헬스케어'];

const ALL_OPTIONS = {
  categories: ['뷰티', '헬스케어', '식품', '의류', '가전', '디지털'],
  ageGroups: ['10대', '20대', '30대', '40대', '50대', '60대+'],
  targets: ['개인', '가족', '직장인', '학생', '관광객', '기업'],
  focus: ['신뢰', '기술', '건강', '감정', '자연', '감각', '연관', '가성비', '프리미엠'],
};

export default function MetadataReviewUI({ resourceId, initialMetadata, onComplete, onError }) {
  const [metadata, setMetadata] = useState(initialMetadata || null);
  const [editing, setEditing] = useState(false);
  const [tempMetadata, setTempMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 각 카테고리별로 사용자가 직접 입력 중인 커스텀 키워드 텍스트
  const [customInputs, setCustomInputs] = useState({
    categories: '',
    ageGroups: '',
    targets: '',
    focus: '',
  });

  // 에러 배너 자동 소멸 (다른 화면들과 통일된 4초 규칙)
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  // initialMetadata가 이미 있으면(자료 생성 직후) 재조회하지 않고 바로 사용.
  // 없을 때만(예: 새로고침 등으로 이 화면에 직접 진입한 경우) API로 조회한다.
  useEffect(() => {
    if (initialMetadata) {
      setMetadata(initialMetadata);
      return;
    }
    loadMetadata();
  }, [resourceId, initialMetadata]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/resources/${resourceId}`);
      if (res.data.resource && res.data.resource.metadata) {
        setMetadata(res.data.resource.metadata);
      }
    } catch (err) {
      console.error('메타데이터 로드 실패:', err);
      setError('메타데이터를 불러올 수 없습니다.');
      if (onError) onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseAIRecommendation = async () => {
    try {
      setLoading(true);
      if (onComplete) {
        onComplete(metadata);
      }
    } catch (err) {
      console.error('AI 추천 사용 실패:', err);
      setError('처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditing = () => {
    setTempMetadata(JSON.parse(JSON.stringify(metadata || {})));
    setEditing(true);
  };

  const handleToggleOption = (category, value) => {
    if (!tempMetadata) return;

    const current = tempMetadata[category] || [];
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    setTempMetadata({
      ...tempMetadata,
      [category]: updated,
    });
  };

  const handleSaveEdits = async () => {
    try {
      setLoading(true);
      setError(null);

      await axios.put(`/api/admin/resources/${resourceId}`, {
        metadata: tempMetadata,
      });

      setMetadata(tempMetadata);
      setEditing(false);

      if (onComplete) {
        onComplete(tempMetadata);
      }
    } catch (err) {
      console.error('메타데이터 저장 실패:', err);
      setError('메타데이터 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setTempMetadata(null);
  };

  /**
   * 직접 입력한 키워드를 해당 카테고리에 추가 (이미 있으면 무시, 쉼표로 여러 개 한번에 추가 가능)
   */
  const handleAddCustomKeyword = (category) => {
    const raw = customInputs[category].trim();
    if (!raw || !tempMetadata) return;

    const newValues = raw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const current = tempMetadata[category] || [];
    const merged = [...current];
    newValues.forEach((v) => {
      if (!merged.includes(v)) merged.push(v);
    });

    setTempMetadata({ ...tempMetadata, [category]: merged });
    setCustomInputs({ ...customInputs, [category]: '' });
  };

  const handleCustomInputKeyDown = (category, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomKeyword(category);
    }
  };

  const handleRemoveKeyword = (category, value) => {
    if (!tempMetadata) return;
    setTempMetadata({
      ...tempMetadata,
      [category]: (tempMetadata[category] || []).filter((v) => v !== value),
    });
  };

  if (loading && !metadata) {
    return (
      <div className="max-w-4xl mx-auto p-6 ui-card">
        <div className="text-center py-12">
          <div className="inline-block">
            <svg className="animate-spin h-8 w-8 text-brand-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="mt-4 text-dark-text-muted">메타데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="max-w-4xl mx-auto p-6 ui-card">
        <div className="text-center py-8 text-status-rejected">
          메타데이터를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 ui-card animate-fade-in">
      <h2 className="text-2xl font-bold mb-2">🔍 Step 2: 메타데이터 검토</h2>
      <p className="text-dark-text-muted mb-6">AI가 분석한 결과를 확인하고 필요하면 수정하세요.</p>

      {error && (
        <div className="bg-status-rejected/10 border border-status-rejected/30 text-status-rejected px-4 py-3 rounded mb-4 animate-fade-in">
          {error}
        </div>
      )}

      {!editing ? (
        // 검토 모드
        <div className="space-y-6">
          {/* 신뢰도 표시 */}
          {metadata.confidence && (
            <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-brand-blue">AI 분석 신뢰도</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-dark-chip rounded-full h-2">
                    <div
                      className="bg-brand-blue h-2 rounded-full"
                      style={{ width: `${metadata.confidence}%` }}
                    />
                  </div>
                  <span className="font-bold text-brand-blue">{metadata.confidence}%</span>
                </div>
              </div>
            </div>
          )}

          {/* 메타데이터 항목 표시 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 카테고리 */}
            <div className="border border-brand-blue/10 bg-dark-bg rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">📦 카테고리</h3>
              <div className="flex flex-wrap gap-2">
                {(metadata.categories || []).map((cat) => (
                  <span
                    key={cat}
                    className="bg-brand-blue/10 text-brand-blue text-sm px-3 py-1 rounded-full"
                  >
                    {PRIORITY_CATEGORIES.includes(cat) && '⭐ '}
                    {cat}
                  </span>
                ))}
              </div>
              {(!metadata.categories || metadata.categories.length === 0) && (
                <p className="text-dark-text-muted text-sm">선택된 카테고리 없음</p>
              )}
            </div>

            {/* 나이대 */}
            <div className="border border-brand-blue/10 bg-dark-bg rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">👥 나이대</h3>
              <div className="flex flex-wrap gap-2">
                {(metadata.ageGroups || []).map((age) => (
                  <span
                    key={age}
                    className="bg-status-approved/10 text-status-approved text-sm px-3 py-1 rounded-full"
                  >
                    {age}
                  </span>
                ))}
              </div>
              {(!metadata.ageGroups || metadata.ageGroups.length === 0) && (
                <p className="text-dark-text-muted text-sm">선택된 나이대 없음</p>
              )}
            </div>

            {/* 대상 */}
            <div className="border border-brand-blue/10 bg-dark-bg rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">🎯 대상</h3>
              <div className="flex flex-wrap gap-2">
                {(metadata.targets || []).map((target) => (
                  <span
                    key={target}
                    className="bg-status-pending/10 text-status-pending text-sm px-3 py-1 rounded-full"
                  >
                    {target}
                  </span>
                ))}
              </div>
              {(!metadata.targets || metadata.targets.length === 0) && (
                <p className="text-dark-text-muted text-sm">선택된 대상 없음</p>
              )}
            </div>

            {/* 강조점 */}
            <div className="border border-brand-blue/10 bg-dark-bg rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">⭐ 강조점</h3>
              <div className="flex flex-wrap gap-2">
                {(metadata.focus || []).map((f) => (
                  <span
                    key={f}
                    className="bg-dark-chip text-dark-text text-sm px-3 py-1 rounded-full"
                  >
                    {f}
                  </span>
                ))}
              </div>
              {(!metadata.focus || metadata.focus.length === 0) && (
                <p className="text-dark-text-muted text-sm">선택된 강조점 없음</p>
              )}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <button
              onClick={handleUseAIRecommendation}
              disabled={loading}
              className="px-6 py-3 bg-status-approved text-white rounded-lg hover:brightness-110 disabled:opacity-50 font-semibold"
            >
              ✅ AI 추천 그대로 사용
            </button>
            <button
              onClick={handleStartEditing}
              disabled={loading}
              className="px-6 py-3 btn-primary disabled:opacity-50 font-semibold"
            >
              ✏️ 수정하겠습니다
            </button>
          </div>
        </div>
      ) : (
        // 수정 모드
        <div className="space-y-6 animate-fade-in">
          <div className="bg-status-pending/10 border border-status-pending/30 rounded-lg p-4">
            <p className="text-status-pending">
              💡 각 항목을 체크박스로 추가/제거할 수 있습니다.
            </p>
          </div>

          {/* 카테고리 수정 */}
          <CategoryEditor
            icon="📦" title="카테고리" category="categories"
            options={ALL_OPTIONS.categories} tempMetadata={tempMetadata}
            customInput={customInputs.categories}
            priorityValues={PRIORITY_CATEGORIES}
            onToggle={handleToggleOption}
            onCustomInputChange={(v) => setCustomInputs({ ...customInputs, categories: v })}
            onCustomInputKeyDown={(e) => handleCustomInputKeyDown('categories', e)}
            onAddCustom={() => handleAddCustomKeyword('categories')}
            onRemove={handleRemoveKeyword}
          />

          {/* 나이대 수정 */}
          <CategoryEditor
            icon="👥" title="나이대" category="ageGroups"
            options={ALL_OPTIONS.ageGroups} tempMetadata={tempMetadata}
            customInput={customInputs.ageGroups}
            onToggle={handleToggleOption}
            onCustomInputChange={(v) => setCustomInputs({ ...customInputs, ageGroups: v })}
            onCustomInputKeyDown={(e) => handleCustomInputKeyDown('ageGroups', e)}
            onAddCustom={() => handleAddCustomKeyword('ageGroups')}
            onRemove={handleRemoveKeyword}
          />

          {/* 대상 수정 */}
          <CategoryEditor
            icon="🎯" title="대상" category="targets"
            options={ALL_OPTIONS.targets} tempMetadata={tempMetadata}
            customInput={customInputs.targets}
            onToggle={handleToggleOption}
            onCustomInputChange={(v) => setCustomInputs({ ...customInputs, targets: v })}
            onCustomInputKeyDown={(e) => handleCustomInputKeyDown('targets', e)}
            onAddCustom={() => handleAddCustomKeyword('targets')}
            onRemove={handleRemoveKeyword}
          />

          {/* 강조점 수정 */}
          <CategoryEditor
            icon="⭐" title="강조점" category="focus"
            options={ALL_OPTIONS.focus} tempMetadata={tempMetadata}
            customInput={customInputs.focus}
            onToggle={handleToggleOption}
            onCustomInputChange={(v) => setCustomInputs({ ...customInputs, focus: v })}
            onCustomInputKeyDown={(e) => handleCustomInputKeyDown('focus', e)}
            onAddCustom={() => handleAddCustomKeyword('focus')}
            onRemove={handleRemoveKeyword}
          />

          {/* 액션 버튼 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-6 py-3 bg-dark-chip text-dark-text rounded-lg hover:brightness-125 disabled:opacity-50 font-semibold"
            >
              ❌ 취소
            </button>
            <button
              onClick={handleSaveEdits}
              disabled={loading}
              className="px-6 py-3 bg-status-approved text-white rounded-lg hover:brightness-110 disabled:opacity-50 font-semibold"
            >
              {loading ? '저장 중...' : '💾 저장 및 계속'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 카테고리 하나(카테고리/나이대/대상/강조점)의 편집 UI
 * - 미리 정의된 옵션은 체크박스로 선택/해제
 * - AI가 추천했거나 사용자가 직접 추가한 커스텀 키워드는 옵션 목록에 없어도
 *   별도의 칩으로 표시되고 X로 제거 가능
 * - 하단 입력창 + "추가" 버튼(또는 Enter)으로 새 키워드를 자유롭게 추가
 */
function CategoryEditor({
  icon,
  title,
  category,
  options,
  tempMetadata,
  customInput,
  priorityValues = [],
  onToggle,
  onCustomInputChange,
  onCustomInputKeyDown,
  onAddCustom,
  onRemove,
}) {
  const selected = tempMetadata?.[category] || [];
  const customSelected = selected.filter((v) => !options.includes(v));

  return (
    <div className="border border-brand-blue/10 bg-dark-bg rounded-lg p-4">
      <h3 className="font-semibold text-lg mb-3">{icon} {title}</h3>

      {/* 미리 정의된 옵션 */}
      <div className="space-y-2 mb-3">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => onToggle(category, opt)}
              className="w-4 h-4"
            />
            <span>{opt}</span>
            {priorityValues.includes(opt) && (
              <span className="text-xs bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded-full">
                ⭐ 우선순위
              </span>
            )}
          </label>
        ))}
      </div>

      {/* 직접 추가한(또는 AI가 추천한 목록 외) 커스텀 키워드 */}
      {customSelected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {customSelected.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 bg-brand-blue/10 text-brand-blue text-sm px-3 py-1 rounded-full"
            >
              {v}
              <button
                type="button"
                onClick={() => onRemove(category, v)}
                className="text-brand-blue hover:brightness-125 font-bold"
                aria-label={`${v} 제거`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 새 키워드 직접 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => onCustomInputChange(e.target.value)}
          onKeyDown={onCustomInputKeyDown}
          placeholder="직접 입력 (쉼표로 여러 개 가능)"
          className="flex-1 input-field text-sm py-1.5"
        />
        <button
          type="button"
          onClick={onAddCustom}
          className="px-3 py-1.5 btn-primary text-sm"
        >
          + 추가
        </button>
      </div>
    </div>
  );
}
