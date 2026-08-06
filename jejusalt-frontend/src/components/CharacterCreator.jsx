/**
 * frontend/components/CharacterCreator.jsx
 *
 * 캐릭터 생성/편집/선택 UI
 * 담당: 고수아(UI) + 박주미(API)
 *
 * 역할:
 * 1. AI가 추천한 캐릭터 3개를 카드로 표시 (characters prop이 비어 있으면 resourceId로 직접 조회)
 * 2. 각 캐릭터의 voice_tone, personality_traits 편집
 * 3. ⭐ 여러 개 동시 "선택" 가능 (selected = true, 멀티 캐릭터 시나리오) — 시나리오 작성 시
 *    선택된 캐릭터 전원이 함께 등장하는 이야기로 AI가 반영한다.
 * 4. 캐릭터 프로필 전체 보기/숨기기
 * 5. 영상유형(캐릭터소개/제품스토리/일상밥상) + 숏폼 길이 선택
 * 6. 저장 및 다음 단계로 진행 → onSelect(characters[], videoType, duration)
 * 7. 캐릭터 라이브러리(기본 캐릭터 풀) 열람/생성/재사용 — 여러 자료 간 재현성 핵심 기능
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const getVideoTypes = () => {
  if (window.appConfig?.generation?.videoTypes) {
    return window.appConfig.generation.videoTypes;
  }
  return ['캐릭터소개', '제품스토리', '일상밥상'];
};

// 새 캐릭터 생성 시 방향성을 빠르게 조합할 수 있는 스타일 카테고리 칩
const STYLE_CATEGORIES = [
  '귀여운', '유쾌한', '신뢰감 있는', '우아한',
  '용감한', '차분한', '장난기 많은', '따뜻한',
];

// Higgsfield가 생성하는 레퍼런스는 실제로는 영상(.mp4)이라 <img>로는 렌더링되지 않는다.
// 확장자를 보고 video/img 태그를 구분해서 렌더링한다.
const isVideoUrl = (url) => /\.(mp4|webm|mov)(\?|$)/i.test(url || '');

function ReferenceMedia({ url, className, alt }) {
  if (!url) return null;
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        className={className}
        muted
        loop
        autoPlay
        playsInline
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}

export default function CharacterCreator({ characters = [], resourceId, onSelect }) {
  const configVideoTypes = getVideoTypes();
  const [localCharacters, setLocalCharacters] = useState(characters);
  const [selectedIds, setSelectedIds] = useState(() => {
    const preSelected = characters.filter((c) => c.selected).map((c) => c.id);
    return preSelected.length > 0 ? preSelected : (characters[0] ? [characters[0].id] : []);
  });
  const [videoType, setVideoType] = useState(configVideoTypes[1] || '제품스토리');
  const [customVideoType, setCustomVideoType] = useState('');
  const [useCustomVideoType, setUseCustomVideoType] = useState(false);
  const [recommendingVideoType, setRecommendingVideoType] = useState(false);
  const [videoTypeRecommendation, setVideoTypeRecommendation] = useState(null);
  const DURATION_OPTIONS = [
    { value: 15, label: '15초', hint: 'TikTok/릴스 임팩트형' },
    { value: 30, label: '30초', hint: '숏폼 표준' },
    { value: 60, label: '60초', hint: '유튜브 쇼츠' },
    { value: 120, label: '120초', hint: '풀 스토리텔링' },
  ];
  const [duration, setDuration] = useState(30);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // ── 캐릭터 라이브러리 (기본 캐릭터 풀) ──
  const [library, setLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDirection, setNewCharDirection] = useState('');
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [deleteConfirmLibId, setDeleteConfirmLibId] = useState(null);

  // 성공/실패 배너 자동 소멸 (전 화면 통일 규칙: 성공 2.5초, 에러 4초)
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

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      setLibraryLoading(true);
      const res = await axios.get('/api/characters/library');
      setLibrary(res.data.characters || []);
    } catch (err) {
      console.error('캐릭터 라이브러리 로드 실패:', err);
    } finally {
      setLibraryLoading(false);
    }
  };

  /**
   * 라이브러리 캐릭터를 이 자료에 연결 → 그대로 선택 상태로 전환
   * (레퍼런스 이미지/프로필을 그대로 복사해서 재현성 유지)
   */
  const handleUseLibraryCharacter = async (libChar) => {
    if (!resourceId) {
      setError('자료가 준비되지 않았습니다.');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post(`/api/characters/library/${libChar.id}/use`, { resourceId });
      const newCharacter = res.data.character;
      setLocalCharacters((prev) => [...prev, newCharacter]);
      setSelectedIds((prev) => [...prev, newCharacter.id]);
      setSuccessMessage(`"${libChar.character_name}" 캐릭터를 추가했습니다.`);
    } catch (err) {
      console.error('라이브러리 캐릭터 사용 실패:', err);
      setError('캐릭터를 연결하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 방향성 입력 → AI로 새 캐릭터 생성 → 라이브러리에 영구 추가
   */
  const handleCreateLibraryCharacter = async () => {
    if (!newCharName.trim()) {
      setError('캐릭터 이름을 입력해주세요.');
      return;
    }
    if (!newCharDirection.trim() || newCharDirection.trim().length < 5) {
      setError('원하는 방향성을 5자 이상 입력해주세요. (예: 유쾌하고 젊은 20대 여성)');
      return;
    }

    try {
      setCreatingCharacter(true);
      setError(null);
      const res = await axios.post('/api/characters/library', {
        characterName: newCharName.trim(),
        direction: newCharDirection.trim(),
        useAI: true,
      });
      setLibrary((prev) => [...prev, res.data.character]);
      setNewCharName('');
      setNewCharDirection('');
      setSelectedStyles([]);
      setShowCreateForm(false);
      setSuccessMessage(`"${res.data.character.character_name}" 캐릭터가 라이브러리에 추가되었습니다.`);
    } catch (err) {
      console.error('캐릭터 생성 실패:', err);
      setError(err.response?.data?.message || '캐릭터 생성에 실패했습니다.');
    } finally {
      setCreatingCharacter(false);
    }
  };

  /**
   * 스타일 카테고리 칩 토글 → 방향성 텍스트에 자동으로 추가/제거
   */
  const handleToggleStyle = (style) => {
    setSelectedStyles((prev) => {
      const isSelected = prev.includes(style);
      const updated = isSelected ? prev.filter((s) => s !== style) : [...prev, style];

      // 방향성 텍스트를 선택된 칩들 기준으로 재구성 (사용자가 추가로 입력한 자유 텍스트는 유지)
      setNewCharDirection((prevText) => {
        const freeText = prevText
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t && !STYLE_CATEGORIES.includes(t))
          .join(', ');
        const chips = updated.join(', ');
        return [chips, freeText].filter(Boolean).join(', ');
      });

      return updated;
    });
  };

  /**
   * "AI가 알아서 만들어줘" — 이름/방향성 없이 AI가 전부 창작 (surprise 모드)
   */
  const handleSurpriseCharacter = async () => {
    try {
      setSurpriseLoading(true);
      setError(null);
      const res = await axios.post('/api/characters/library', {
        useAI: true,
        surprise: true,
      });
      setLibrary((prev) => [...prev, res.data.character]);
      setSuccessMessage(`"${res.data.character.character_name}" 캐릭터가 AI에 의해 창작되어 라이브러리에 추가되었습니다.`);
    } catch (err) {
      console.error('AI 자동 생성 실패:', err);
      setError(err.response?.data?.message || 'AI 캐릭터 생성에 실패했습니다.');
    } finally {
      setSurpriseLoading(false);
    }
  };

  /**
   * 라이브러리에서 캐릭터 삭제 (기본 캐릭터 포함)
   */
  const handleDeleteLibraryCharacter = async (libId) => {
    try {
      await axios.delete(`/api/characters/library/${libId}`);
      setLibrary((prev) => prev.filter((c) => c.id !== libId));
      setDeleteConfirmLibId(null);
      setSuccessMessage('캐릭터가 라이브러리에서 삭제되었습니다.');
    } catch (err) {
      console.error('라이브러리 캐릭터 삭제 실패:', err);
      setError('삭제에 실패했습니다.');
    }
  };

  /**
   * 규칙 기반 영상유형 추천 (결정론적 — 같은 자료엔 항상 같은 추천)
   */
  const handleRecommendVideoType = async () => {
    if (!resourceId) return;
    try {
      setRecommendingVideoType(true);
      const res = await axios.get(`/api/generate/${resourceId}/recommend-video-type`);
      setVideoTypeRecommendation(res.data);
      setUseCustomVideoType(false);
      setVideoType(res.data.recommended);
    } catch (err) {
      console.error('영상유형 추천 실패:', err);
      setError('영상유형 추천에 실패했습니다.');
    } finally {
      setRecommendingVideoType(false);
    }
  };

  // characters prop이 비어 있으면 resourceId로 직접 조회 (App.jsx가 캐릭터를 안 넘겨줘도 동작)
  useEffect(() => {
    if (characters.length > 0 || !resourceId) return;

    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/resources/${resourceId}`);
        const fetched = res.data.characters || [];
        setLocalCharacters(fetched);
        setSelectedId(fetched.find((c) => c.selected)?.id || fetched[0]?.id);
      } catch (err) {
        console.error('캐릭터 목록 조회 실패:', err);
        setError('캐릭터 목록을 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [resourceId, characters.length]);

  /**
   * 캐릭터 선택 토글 (여러 개 동시 선택 가능 — 멀티 캐릭터 시나리오)
   * 최소 1개는 항상 선택되어 있어야 하므로, 마지막 남은 1개는 해제할 수 없다.
   */
  const handleSelectCharacter = async (characterId) => {
    const isCurrentlySelected = selectedIds.includes(characterId);
    if (isCurrentlySelected && selectedIds.length <= 1) {
      setError('최소 1명의 캐릭터는 선택되어 있어야 합니다.');
      return;
    }
    const nextSelected = isCurrentlySelected
      ? selectedIds.filter((id) => id !== characterId)
      : [...selectedIds, characterId];

    // 로컬 상태는 먼저 낙관적으로 업데이트 (API 실패해도 화면 선택은 유지되도록)
    setLocalCharacters((prev) =>
      prev.map((c) => (c.id === characterId ? { ...c, selected: !isCurrentlySelected } : c))
    );
    setSelectedIds(nextSelected);

    try {
      setLoading(true);

      // PUT /api/admin/characters/:id → 이 캐릭터의 선택 여부만 변경 (다른 캐릭터는 그대로 유지)
      await axios.put(`/api/admin/characters/${characterId}`, {
        selected: !isCurrentlySelected,
      });

      setSuccessMessage(isCurrentlySelected ? '캐릭터 선택이 해제되었습니다.' : '캐릭터가 선택되었습니다.');
      // 다음 단계로의 진행은 "다음 단계로" 버튼에서만 트리거 (카드 클릭만으로 자동 진행하지 않음)
    } catch (err) {
      // mock 자료(id가 서버 DB에 없는 경우) 등 저장 실패해도 화면상 선택은 유지하고 진행 가능하게 둔다
      console.warn('캐릭터 선택 서버 저장 실패 (로컬 선택은 유지됨):', err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 캐릭터 정보 저장 (voice_tone, personality_traits)
   */
  const handleSaveCharacter = async (character) => {
    try {
      setLoading(true);

      // PUT /api/admin/characters/:id
      await axios.put(`/api/admin/characters/${character.id}`, {
        voice_tone: character.voice_tone,
        personality_traits: character.personality_traits,
        edited_by: 'user',
      });

      setEditingId(null);
      setSuccessMessage('캐릭터가 저장되었습니다.');
    } catch (err) {
      console.error('캐릭터 저장 실패:', err);
      setError('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 캐릭터 정보 변경 (UI만)
   */
  const handleCharacterChange = (characterId, field, value) => {
    setLocalCharacters((prev) =>
      prev.map((c) =>
        c.id === characterId ? { ...c, [field]: value } : c
      )
    );
  };

  // ─────────────────────────────────────────────────────
  // UI 렌더링
  // ─────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 제목 */}
      <h2 className="text-3xl font-bold mb-2">🎭 캐릭터 선택</h2>
      <p className="text-dark-text-muted mb-6">
        AI가 캐릭터 라이브러리 중에서 이 제품에 가장 잘 맞는 캐릭터를 추천합니다. 그대로 선택하거나,
        아래 라이브러리에서 다른 캐릭터를 직접 골라도 됩니다.
      </p>

      {/* 메시지 */}
      {error && (
        <div className="bg-status-rejected/10 border border-status-rejected/30 text-status-rejected px-4 py-3 rounded mb-4 animate-fade-in">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-status-approved/10 border border-status-approved/30 text-status-approved px-4 py-3 rounded mb-4 animate-fade-in">
          {successMessage}
        </div>
      )}

      {/* ── 캐릭터 라이브러리 (기본 캐릭터 풀) ── */}
      <div className="ui-card p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold">📚 캐릭터 라이브러리 (기본 캐릭터)</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-sm px-3 py-1 btn-primary"
          >
            {showCreateForm ? '✕ 닫기' : '+ 새 캐릭터 만들기'}
          </button>
        </div>
        <p className="text-sm text-dark-text-muted mb-4">
          여러 자료에서 재사용 가능한 기본 캐릭터입니다. 마음에 드는 캐릭터를 선택해서 바로 사용하거나,
          원하는 방향성을 입력해 AI로 새로 만들어 라이브러리에 추가할 수 있습니다.
        </p>

        {showCreateForm && (
          <div className="bg-dark-bg border border-brand-blue/10 rounded-lg p-4 mb-4 space-y-4 animate-fade-in">
            {/* 방법 1: AI가 전부 알아서 창작 */}
            <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-3">
              <p className="text-sm text-dark-text mb-2">
                🎲 이름과 컨셉을 정하기 어렵다면, AI가 브랜드 톤에 맞는 매력적인 캐릭터를 통째로 창작하게 할 수 있습니다.
              </p>
              <button
                onClick={handleSurpriseCharacter}
                disabled={surpriseLoading}
                className="w-full px-4 py-2 btn-primary disabled:opacity-50"
              >
                {surpriseLoading ? '🤖 AI가 창작 중...' : '🎲 AI가 알아서 만들어줘'}
              </button>
            </div>

            <div className="text-center text-xs text-dark-text-muted">또는 직접 방향을 정해서 만들기</div>

            {/* 방법 2 + 3: 카테고리 선택 + 직접 프롬프트 */}
            <div>
              <label className="block text-sm font-semibold mb-1">캐릭터 이름</label>
              <input
                type="text"
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                placeholder="예: 소한"
                className="w-full input-field text-sm py-1.5"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">스타일 선택 (여러 개 가능)</label>
              <div className="flex flex-wrap gap-2">
                {STYLE_CATEGORIES.map((style) => (
                  <button
                    type="button"
                    key={style}
                    onClick={() => handleToggleStyle(style)}
                    className={`filter-chip text-xs px-3 py-1 ${
                      selectedStyles.includes(style) ? 'is-selected' : ''
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                원하는 방향성 (직접 프롬프트 작성 가능)
              </label>
              <textarea
                value={newCharDirection}
                onChange={(e) => setNewCharDirection(e.target.value)}
                placeholder="위 스타일 칩을 선택하면 자동으로 채워지며, 직접 자유롭게 더 적어도 됩니다"
                className="w-full input-field text-sm h-20"
              />
              <p className="text-xs text-dark-text-muted mt-1">
                입력한 내용은 AI가 분석해서 일관된 캐릭터 프로필로 정리하고, 이후 계속 같은 모습으로 재사용됩니다.
              </p>
            </div>

            <button
              onClick={handleCreateLibraryCharacter}
              disabled={creatingCharacter}
              className="w-full px-4 py-2 btn-primary disabled:opacity-50"
            >
              {creatingCharacter ? '🤖 AI가 캐릭터를 만들고 있습니다...' : '🤖 AI로 캐릭터 생성 & 라이브러리에 추가'}
            </button>
          </div>
        )}

        {libraryLoading ? (
          <p className="text-sm text-dark-text-muted">라이브러리 불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {library.map((libChar) => (
              <div
                key={libChar.id}
                className="border border-brand-blue/10 bg-dark-bg rounded-lg p-3 hover:border-brand-blue/40 transition relative group"
              >
                <div className="font-semibold text-sm mb-1">
                  {libChar.character_name}
                  {libChar.source === 'default' && (
                    <span className="ml-1 text-xs bg-status-pending/10 text-status-pending px-1 rounded">기본</span>
                  )}
                  {libChar.source === 'ai_generated' && (
                    <span className="ml-1 text-xs bg-brand-blue/10 text-brand-blue px-1 rounded">AI생성</span>
                  )}
                </div>
                {/* 레퍼런스: 있으면 실제 영상, 없으면 "아직 없음" placeholder로 일관성 상태를 항상 보이게 함 */}
                <div className="w-full h-20 bg-dark-chip rounded border border-brand-blue/10 flex items-center justify-center overflow-hidden mb-2">
                  {libChar.reference_image_url ? (
                    <ReferenceMedia
                      url={libChar.reference_image_url}
                      alt={`${libChar.character_name} reference`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-dark-text-muted text-center">🖼️ 레퍼런스 없음<br/>(첫 생성 후 저장됨)</span>
                  )}
                </div>
                <div className="text-xs text-dark-text-muted mb-2 line-clamp-2">
                  {libChar.character_profile || libChar.role || '-'}
                </div>
                {libChar.generation_count > 0 && (
                  <div className="text-xs text-status-approved mb-2">✓ {libChar.generation_count}회 생성됨 (일관된 스타일 유지)</div>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleUseLibraryCharacter(libChar)}
                    disabled={!resourceId || loading}
                    className="flex-1 text-xs px-2 py-1 bg-brand-blue text-black rounded hover:brightness-110 disabled:opacity-50 font-semibold"
                  >
                    이 캐릭터 사용
                  </button>
                  {deleteConfirmLibId === libChar.id ? (
                    <button
                      onClick={() => handleDeleteLibraryCharacter(libChar.id)}
                      className="text-xs px-2 py-1 bg-status-rejected text-white rounded"
                    >
                      확인?
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmLibId(libChar.id)}
                      className="text-xs px-2 py-1 bg-dark-chip text-dark-text rounded hover:bg-status-rejected/20"
                      title="라이브러리에서 삭제"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 캐릭터 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {localCharacters.map((char, idx) => (
          <div
            key={char.id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedIds.includes(char.id)}
            aria-label={`${idx + 1}순위 캐릭터 ${char.character_name}${
              selectedIds.includes(char.id) ? ' (선택됨)' : ''
            }`}
            className={`border-2 rounded-lg p-5 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${
              selectedIds.includes(char.id)
                ? 'border-brand-blue bg-brand-blue/10'
                : 'border-brand-blue/10 bg-dark-card hover:border-brand-blue/40'
            }`}
            onClick={() => handleSelectCharacter(char.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelectCharacter(char.id);
              }
            }}
          >
            {/* 순위 + 선택 표시 (체크박스 — 여러 개 동시 선택 가능) */}
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-semibold text-dark-text-muted">
                🏆 {idx + 1}순위
              </div>
              <span className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(char.id)}
                  onChange={() => handleSelectCharacter(char.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4"
                />
                {selectedIds.includes(char.id) && (
                  <span className="bg-brand-blue text-black text-xs px-2 py-1 rounded-full font-semibold">
                    ✓ 선택됨
                  </span>
                )}
              </span>
            </div>

            {/* 캐릭터 이름 */}
            <h3 className="text-xl font-bold mb-4">
              {char.character_name}
              {char.is_base_character ? (
                <span className="text-xs bg-status-pending/10 text-status-pending px-2 py-1 rounded ml-2">
                  ⭐ 기본 캐릭터
                </span>
              ) : (
                <span className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-1 rounded ml-2">
                  ✨ 새로 생성됨
                </span>
              )}
            </h3>

            {/* 프로필 요약 */}
            {char.character_profile && (
              <div className="mb-4">
                {editingId === char.id ? (
                  // 편집 모드
                  <div className="space-y-3">
                    {/* Voice Tone */}
                    <div>
                      <label className="block text-sm font-semibold mb-1">
                        목소리 톤
                      </label>
                      <input
                        type="text"
                        value={char.voice_tone || ''}
                        onChange={(e) =>
                          handleCharacterChange(char.id, 'voice_tone', e.target.value)
                        }
                        placeholder="예: 따뜨한 아버지"
                        className="w-full input-field text-sm py-1.5"
                      />
                    </div>

                    {/* Personality Traits */}
                    <div>
                      <label className="block text-sm font-semibold mb-1">
                        성격 특징
                      </label>
                      <input
                        type="text"
                        value={
                          Array.isArray(char.personality_traits)
                            ? char.personality_traits.join(', ')
                            : char.personality_traits || ''
                        }
                        onChange={(e) => {
                          const traits = e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter((t) => t);
                          handleCharacterChange(char.id, 'personality_traits', traits);
                        }}
                        placeholder="예: 유머감각, 신뢰성"
                        className="w-full input-field text-sm py-1.5"
                      />
                    </div>

                    {/* 저장/취소 버튼 */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleSaveCharacter(char)}
                        disabled={loading}
                        className="flex-1 px-2 py-1 bg-status-approved text-white text-sm rounded hover:brightness-110 disabled:opacity-50"
                      >
                        💾 저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 px-2 py-1 bg-dark-chip text-dark-text text-sm rounded hover:brightness-125"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  // 표시 모드
                  <div>
                    {char.voice_tone && (
                      <div className="text-sm mb-2">
                        <span className="font-semibold">🎤 목소리:</span> {char.voice_tone}
                      </div>
                    )}
                    {char.personality_traits && (
                      <div className="text-sm mb-3">
                        <span className="font-semibold">✨ 특징:</span>{' '}
                        {Array.isArray(char.personality_traits)
                          ? char.personality_traits.join(', ')
                          : char.personality_traits}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(char.id);
                      }}
                      className="text-brand-blue hover:brightness-125 text-sm"
                    >
                      ✏️ 편집
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 전체 프로필 보기/숨기기 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedId(expandedId === char.id ? null : char.id);
              }}
              className="text-xs text-dark-text-muted hover:text-dark-text underline"
            >
              {expandedId === char.id ? '▼ 상세정보 숨기기' : '▶ 상세정보 보기'}
            </button>

            {/* 레퍼런스 (있으면 표시) */}
            {char.reference_image_url && (
              <div className="mt-3 mb-3">
                <span className="text-xs font-semibold text-dark-text-muted">🖼️ 레퍼런스:</span>
                <div className="mt-2 w-full h-32 bg-dark-chip rounded border border-brand-blue/20 flex items-center justify-center overflow-hidden">
                  <ReferenceMedia
                    url={char.reference_image_url}
                    alt={`${char.character_name} reference`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs text-dark-text-muted mt-2 break-all">
                  {char.generation_count && char.generation_count > 0 && (
                    <span className="text-status-approved font-semibold">
                      ✓ {char.generation_count}회 생성됨 (일관된 스타일 유지)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 전체 프로필 (확장) - v3 설계 데이터 표시 */}
            {expandedId === char.id && (
              <div className="mt-4 pt-4 border-t border-brand-blue/10 space-y-4">
                {/* 기본 정보 */}
                <div className="bg-dark-bg p-3 rounded text-sm">
                  <h5 className="font-semibold text-dark-text mb-2">👤 기본 정보</h5>
                  {char.gender && <div><span className="font-semibold">성별:</span> {char.gender}</div>}
                  {char.type && <div><span className="font-semibold">타입:</span> {char.type}</div>}
                  {char.role && <div><span className="font-semibold">역할:</span> {char.role}</div>}
                </div>

                {/* 신체 구조 */}
                {char.bodyStructure && (
                  <div className="bg-dark-bg p-3 rounded text-sm">
                    <h5 className="font-semibold text-dark-text mb-2">🦴 신체 구조</h5>
                    <div className="space-y-1 text-xs text-dark-text-muted">
                      {char.bodyStructure.headRatio && (
                        <div><span className="text-dark-text">머리 비율:</span> {char.bodyStructure.headRatio}</div>
                      )}
                      {char.bodyStructure.bodyShape && (
                        <div><span className="text-dark-text">신체 형태:</span> {char.bodyStructure.bodyShape}</div>
                      )}
                      {char.bodyStructure.arms && (
                        <div><span className="text-dark-text">팔:</span> {char.bodyStructure.arms}</div>
                      )}
                      {char.bodyStructure.legs && (
                        <div><span className="text-dark-text">다리:</span> {char.bodyStructure.legs}</div>
                      )}
                      {char.bodyStructure.proportionType && (
                        <div><span className="text-dark-text">프로포션:</span> {char.bodyStructure.proportionType}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 성별 표현 */}
                {char.genderExpression && (
                  <div className="bg-dark-bg p-3 rounded text-sm">
                    <h5 className="font-semibold text-dark-text mb-2">👗 성별 표현</h5>
                    <div className="space-y-1 text-xs text-dark-text-muted">
                      {char.genderExpression.hair && (
                        <div><span className="text-dark-text">머리:</span> {char.genderExpression.hair}</div>
                      )}
                      {char.genderExpression.eyebrows && (
                        <div><span className="text-dark-text">눈썹:</span> {char.genderExpression.eyebrows}</div>
                      )}
                      {char.genderExpression.eyelashes && (
                        <div><span className="text-dark-text">속눈썹:</span> {char.genderExpression.eyelashes}</div>
                      )}
                      {char.genderExpression.bodyShape && (
                        <div><span className="text-dark-text">신체:</span> {char.genderExpression.bodyShape}</div>
                      )}
                      {char.genderExpression.accessories && (
                        <div><span className="text-dark-text">액세서리:</span> {char.genderExpression.accessories}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 애니메이션 노트 */}
                {char.animationNotes && (
                  <div className="bg-dark-bg p-3 rounded text-sm">
                    <h5 className="font-semibold text-dark-text mb-2">🎬 애니메이션</h5>
                    <div className="space-y-1 text-xs text-dark-text-muted">
                      {char.animationNotes.jointsRequired && (
                        <div><span className="text-dark-text">관절:</span> {Array.isArray(char.animationNotes.jointsRequired) ? char.animationNotes.jointsRequired.join(', ') : char.animationNotes.jointsRequired}</div>
                      )}
                      {char.animationNotes.facialExpressions && (
                        <div><span className="text-dark-text">표정:</span> {Array.isArray(char.animationNotes.facialExpressions) ? char.animationNotes.facialExpressions.join(', ') : char.animationNotes.facialExpressions}</div>
                      )}
                      {char.animationNotes.movements && (
                        <div><span className="text-dark-text">동작:</span> {Array.isArray(char.animationNotes.movements) ? char.animationNotes.movements.join(', ') : char.animationNotes.movements}</div>
                      )}
                      {char.animationNotes.specialNotes && (
                        <div><span className="text-dark-text">특수:</span> {char.animationNotes.specialNotes}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 상징성 */}
                {char.symbolism && (
                  <div className="bg-dark-bg p-3 rounded text-sm">
                    <h5 className="font-semibold text-dark-text mb-2">✨ 상징성</h5>
                    <div className="space-y-1 text-xs text-dark-text-muted">
                      {char.symbolism.color && (
                        <div><span className="text-dark-text">색상:</span> {char.symbolism.color}</div>
                      )}
                      {char.symbolism.shape && (
                        <div><span className="text-dark-text">형태:</span> {char.symbolism.shape}</div>
                      )}
                      {char.symbolism.texture && (
                        <div><span className="text-dark-text">텍스처:</span> {char.symbolism.texture}</div>
                      )}
                      {char.symbolism.expression && (
                        <div><span className="text-dark-text">표현:</span> {char.symbolism.expression}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 프롬프트 */}
                {char.higgsfieldPrompt && (
                  <div className="bg-dark-bg p-3 rounded text-xs">
                    <h5 className="font-semibold text-dark-text mb-2">📝 생성 프롬프트</h5>
                    <pre className="whitespace-pre-wrap text-dark-text-muted overflow-hidden">
                      {char.higgsfieldPrompt.substring(0, 300)}
                      {char.higgsfieldPrompt.length > 300 ? '...' : ''}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 선택된 캐릭터 정보 (큰 화면) — 여러 명이면 모두 나열 */}
      {selectedIds.length > 0 && (
        <div className="bg-brand-blue/10 border-2 border-brand-blue/30 rounded-lg p-6 mb-6 animate-fade-in space-y-4">
          {selectedIds.map((id) => {
            const selected = localCharacters.find((c) => c.id === id);
            if (!selected) return null;
            return (
              <div key={id}>
                <h4 className="text-xl font-bold mb-3">
                  ✅ 선택된 캐릭터: {selected.character_name}
                </h4>
                {selected.voice_tone && (
                  <div className="text-sm mb-2">
                    <strong>목소리 톤:</strong> {selected.voice_tone}
                  </div>
                )}
                {selected.personality_traits && (
                  <div className="text-sm">
                    <strong>성격 특징:</strong>{' '}
                    {Array.isArray(selected.personality_traits)
                      ? selected.personality_traits.join(', ')
                      : selected.personality_traits}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-sm text-dark-text-muted">
            {selectedIds.length > 1
              ? '이 캐릭터들이 함께 등장하는 시나리오를 생성하게 됩니다.'
              : '이 캐릭터로 시나리오를 생성하게 됩니다.'}
          </p>
        </div>
      )}

      {/* 영상유형 선택 */}
      {selectedIds.length > 0 && (
        <div className="ui-card p-6 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold">🎬 영상유형 선택</h4>
            <button
              onClick={handleRecommendVideoType}
              disabled={recommendingVideoType || !resourceId}
              className="text-sm px-3 py-1 btn-primary disabled:opacity-50"
            >
              {recommendingVideoType ? '분석 중...' : '🤖 AI 추천 받기'}
            </button>
          </div>

          {videoTypeRecommendation && (
            <div className="bg-brand-blue/10 border border-brand-blue/30 rounded p-2 mb-3 text-sm text-dark-text">
              추천: <strong className="text-brand-blue">{videoTypeRecommendation.recommended}</strong> — {videoTypeRecommendation.reason}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-3">
            {configVideoTypes.map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition ${
                  !useCustomVideoType && videoType === type
                    ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                    : 'border-brand-blue/10 hover:border-brand-blue/40'
                }`}
              >
                <input
                  type="radio"
                  name="videoType"
                  checked={!useCustomVideoType && videoType === type}
                  onChange={() => {
                    setUseCustomVideoType(false);
                    setVideoType(type);
                  }}
                  className="w-4 h-4"
                />
                <span>{type}</span>
              </label>
            ))}
          </div>

          {/* 직접 입력 */}
          <label
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition ${
              useCustomVideoType ? 'border-brand-blue bg-brand-blue/10' : 'border-brand-blue/10 hover:border-brand-blue/40'
            }`}
          >
            <input
              type="radio"
              name="videoType"
              checked={useCustomVideoType}
              onChange={() => {
                setUseCustomVideoType(true);
                if (customVideoType) setVideoType(customVideoType);
              }}
              className="w-4 h-4"
            />
            <span>직접 입력:</span>
            <input
              type="text"
              value={customVideoType}
              onChange={(e) => {
                setCustomVideoType(e.target.value);
                if (useCustomVideoType) setVideoType(e.target.value);
              }}
              onFocus={() => setUseCustomVideoType(true)}
              placeholder="예: 창립자 인터뷰, 언박싱"
              className="flex-1 input-field text-sm py-1"
            />
          </label>
        </div>
      )}

      {/* 숏폼 길이 선택 */}
      {selectedIds.length > 0 && (
        <div className="ui-card p-6 mb-6">
          <h4 className="font-semibold mb-3">⏱️ 영상 길이 선택</h4>
          <div className="flex flex-wrap gap-3">
            {DURATION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex flex-col items-start gap-0.5 px-4 py-2 border rounded-lg cursor-pointer transition ${
                  duration === opt.value
                    ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                    : 'border-brand-blue/10 hover:border-brand-blue/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="duration"
                    checked={duration === opt.value}
                    onChange={() => setDuration(opt.value)}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold">{opt.label}</span>
                </span>
                <span className="text-xs text-dark-text-muted ml-6">{opt.hint}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 다음 단계 안내 */}
      {selectedIds.length > 0 && (
        <div className="bg-status-approved/10 border border-status-approved/30 rounded-lg p-4 text-center">
          <p className="text-status-approved">
            ✨ <strong>{selectedIds.map((id) => localCharacters.find((c) => c.id === id)?.character_name).filter(Boolean).join(', ')}</strong>
            {selectedIds.length > 1 ? ' 캐릭터들이 함께 등장하는 시나리오로' : '로'},
            <strong> {videoType}</strong> · <strong>{duration}초</strong> 형식으로 계속 진행할 준비가 되었습니다.
          </p>
          <button
            onClick={() => {
              if (onSelect) {
                const selectedCharacters = selectedIds
                  .map((id) => localCharacters.find((c) => c.id === id))
                  .filter(Boolean);
                onSelect(selectedCharacters, videoType, duration);
              }
            }}
            className="mt-3 px-6 py-2 bg-status-approved text-white rounded hover:brightness-110"
          >
            🚀 다음 단계로
          </button>
        </div>
      )}

      {/* 캐릭터가 없는 경우 */}
      {localCharacters.length === 0 && (
        <div className="text-center py-12 text-dark-text-muted">
          {loading ? (
            <p>캐릭터를 불러오는 중...</p>
          ) : (
            <>
              <p className="mb-4">아직 캐릭터가 생성되지 않았습니다.</p>
              <p className="text-sm">먼저 자료를 업로드하고 AI 분석을 완료하세요.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
