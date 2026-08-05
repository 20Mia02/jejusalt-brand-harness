/**
 * frontend/components/CharacterCreator.jsx
 *
 * 캐릭터 생성/편집/선택 UI
 * 담당: 고수아(UI) + 박주미(API)
 *
 * 역할:
 * 1. AI가 추천한 캐릭터 3개를 카드로 표시 (characters prop이 비어 있으면 resourceId로 직접 조회)
 * 2. 각 캐릭터의 voice_tone, personality_traits 편집
 * 3. 한 개만 "선택" 가능 (selected = true)
 * 4. 캐릭터 프로필 전체 보기/숨기기
 * 5. 영상유형(캐릭터소개/제품스토리/일상밥상) 선택
 * 6. 저장 및 다음 단계로 진행 → onSelect(character, videoType)
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
  const [selectedId, setSelectedId] = useState(
    characters.find((c) => c.selected)?.id || characters[0]?.id
  );
  const [videoType, setVideoType] = useState(configVideoTypes[1] || '제품스토리');
  const [customVideoType, setCustomVideoType] = useState('');
  const [useCustomVideoType, setUseCustomVideoType] = useState(false);
  const [recommendingVideoType, setRecommendingVideoType] = useState(false);
  const [videoTypeRecommendation, setVideoTypeRecommendation] = useState(null);
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
      setLocalCharacters((prev) => [
        ...prev.map((c) => ({ ...c, selected: false })),
        newCharacter,
      ]);
      setSelectedId(newCharacter.id);
      setSuccessMessage(`"${libChar.character_name}" 캐릭터를 사용합니다.`);
      setTimeout(() => setSuccessMessage(null), 2000);
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
      setTimeout(() => setSuccessMessage(null), 3000);
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
      setTimeout(() => setSuccessMessage(null), 3000);
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
      setTimeout(() => setSuccessMessage(null), 2000);
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
   * 캐릭터 선택 (selected = true)
   */
  const handleSelectCharacter = async (characterId) => {
    // 로컬 상태는 먼저 낙관적으로 업데이트 (API 실패해도 화면 선택은 유지되도록)
    const updated = localCharacters.map((c) => ({
      ...c,
      selected: c.id === characterId,
    }));
    setLocalCharacters(updated);
    setSelectedId(characterId);

    try {
      setLoading(true);

      // PUT /api/admin/characters/:id → selected: true
      await axios.put(`/api/admin/characters/${characterId}`, {
        selected: true,
      });

      setSuccessMessage('캐릭터가 선택되었습니다.');
      setTimeout(() => setSuccessMessage(null), 2000);
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
      setTimeout(() => setSuccessMessage(null), 2000);
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
      <p className="text-gray-600 mb-6">
        AI가 캐릭터 라이브러리 중에서 이 제품에 가장 잘 맞는 캐릭터를 추천합니다. 그대로 선택하거나,
        위 라이브러리에서 다른 캐릭터를 직접 골라도 됩니다.
      </p>

      {/* 메시지 */}
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

      {/* ── 캐릭터 라이브러리 (기본 캐릭터 풀) ── */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold">📚 캐릭터 라이브러리 (기본 캐릭터)</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showCreateForm ? '✕ 닫기' : '+ 새 캐릭터 만들기'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          여러 자료에서 재사용 가능한 기본 캐릭터입니다. 마음에 드는 캐릭터를 선택해서 바로 사용하거나,
          원하는 방향성을 입력해 AI로 새로 만들어 라이브러리에 추가할 수 있습니다.
        </p>

        {showCreateForm && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
            {/* 방법 1: AI가 전부 알아서 창작 */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm text-purple-800 mb-2">
                🎲 이름과 컨셉을 정하기 어렵다면, AI가 브랜드 톤에 맞는 매력적인 캐릭터를 통째로 창작하게 할 수 있습니다.
              </p>
              <button
                onClick={handleSurpriseCharacter}
                disabled={surpriseLoading}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {surpriseLoading ? '🤖 AI가 창작 중...' : '🎲 AI가 알아서 만들어줘'}
              </button>
            </div>

            <div className="text-center text-xs text-gray-400">또는 직접 방향을 정해서 만들기</div>

            {/* 방법 2 + 3: 카테고리 선택 + 직접 프롬프트 */}
            <div>
              <label className="block text-sm font-semibold mb-1">캐릭터 이름</label>
              <input
                type="text"
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                placeholder="예: 소한"
                className="w-full px-3 py-2 border rounded text-sm"
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
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      selectedStyles.includes(style)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
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
                className="w-full px-3 py-2 border rounded text-sm h-20"
              />
              <p className="text-xs text-gray-500 mt-1">
                입력한 내용은 AI가 분석해서 일관된 캐릭터 프로필로 정리하고, 이후 계속 같은 모습으로 재사용됩니다.
              </p>
            </div>

            <button
              onClick={handleCreateLibraryCharacter}
              disabled={creatingCharacter}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingCharacter ? '🤖 AI가 캐릭터를 만들고 있습니다...' : '🤖 AI로 캐릭터 생성 & 라이브러리에 추가'}
            </button>
          </div>
        )}

        {libraryLoading ? (
          <p className="text-sm text-gray-500">라이브러리 불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {library.map((libChar) => (
              <div
                key={libChar.id}
                className="border rounded-lg p-3 hover:border-blue-400 transition relative group"
              >
                <div className="font-semibold text-sm mb-1">
                  {libChar.character_name}
                  {libChar.source === 'default' && (
                    <span className="ml-1 text-xs bg-yellow-100 text-yellow-800 px-1 rounded">기본</span>
                  )}
                  {libChar.source === 'ai_generated' && (
                    <span className="ml-1 text-xs bg-purple-100 text-purple-800 px-1 rounded">AI생성</span>
                  )}
                </div>
                {/* 레퍼런스: 있으면 실제 영상, 없으면 "아직 없음" placeholder로 일관성 상태를 항상 보이게 함 */}
                <div className="w-full h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden mb-2">
                  {libChar.reference_image_url ? (
                    <ReferenceMedia
                      url={libChar.reference_image_url}
                      alt={`${libChar.character_name} reference`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-gray-400">🖼️ 레퍼런스 없음<br/>(첫 생성 후 저장됨)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-2 line-clamp-2">
                  {libChar.character_profile || libChar.role || '-'}
                </div>
                {libChar.generation_count > 0 && (
                  <div className="text-xs text-green-600 mb-2">✓ {libChar.generation_count}회 생성됨 (일관된 스타일 유지)</div>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleUseLibraryCharacter(libChar)}
                    disabled={!resourceId || loading}
                    className="flex-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    이 캐릭터 사용
                  </button>
                  {deleteConfirmLibId === libChar.id ? (
                    <button
                      onClick={() => handleDeleteLibraryCharacter(libChar.id)}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded"
                    >
                      확인?
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmLibId(libChar.id)}
                      className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-red-100"
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
            className={`border-2 rounded-lg p-5 transition cursor-pointer ${
              selectedId === char.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => handleSelectCharacter(char.id)}
          >
            {/* 순위 + 선택 표시 */}
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-semibold text-gray-600">
                🏆 {idx + 1}순위
              </div>
              {selectedId === char.id && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  ✓ 선택됨
                </span>
              )}
            </div>

            {/* 캐릭터 이름 */}
            <h3 className="text-xl font-bold mb-4">
              {char.character_name}
              {char.is_base_character ? (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">
                  ⭐ 기본 캐릭터
                </span>
              ) : (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded ml-2">
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
                        className="w-full px-2 py-1 border rounded text-sm"
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
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>

                    {/* 저장/취소 버튼 */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleSaveCharacter(char)}
                        disabled={loading}
                        className="flex-1 px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        💾 저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 px-2 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
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
                      className="text-blue-600 hover:text-blue-800 text-sm"
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
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {expandedId === char.id ? '▼ 상세정보 숨기기' : '▶ 상세정보 보기'}
            </button>

            {/* 레퍼런스 (있으면 표시) */}
            {char.reference_image_url && (
              <div className="mt-3 mb-3">
                <span className="text-xs font-semibold text-gray-600">🖼️ 레퍼런스:</span>
                <div className="mt-2 w-full h-32 bg-gray-200 rounded border border-gray-300 flex items-center justify-center overflow-hidden">
                  <ReferenceMedia
                    url={char.reference_image_url}
                    alt={`${char.character_name} reference`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs text-gray-500 mt-2 break-all">
                  {char.generation_count && char.generation_count > 0 && (
                    <span className="text-green-600 font-semibold">
                      ✓ {char.generation_count}회 생성됨 (일관된 스타일 유지)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 전체 프로필 (확장) */}
            {expandedId === char.id && char.character_profile && (
              <div className="mt-4 pt-4 border-t bg-gray-50 p-3 rounded text-xs text-gray-700 max-h-48 overflow-y-auto">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(char.character_profile, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 선택된 캐릭터 정보 (큰 화면) */}
      {selectedId && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          {(() => {
            const selected = localCharacters.find((c) => c.id === selectedId);
            return selected ? (
              <div>
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
                <p className="text-sm text-gray-600 mt-3">
                  이 캐릭터로 시나리오를 생성하게 됩니다.
                </p>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* 영상유형 선택 */}
      {selectedId && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold">🎬 영상유형 선택</h4>
            <button
              onClick={handleRecommendVideoType}
              disabled={recommendingVideoType || !resourceId}
              className="text-sm px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {recommendingVideoType ? '분석 중...' : '🤖 AI 추천 받기'}
            </button>
          </div>

          {videoTypeRecommendation && (
            <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-3 text-sm text-purple-800">
              추천: <strong>{videoTypeRecommendation.recommended}</strong> — {videoTypeRecommendation.reason}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-3">
            {configVideoTypes.map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition ${
                  !useCustomVideoType && videoType === type
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
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
              useCustomVideoType ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
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
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
          </label>
        </div>
      )}

      {/* 다음 단계 안내 */}
      {selectedId && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-center">
          <p className="text-green-800">
            ✨ <strong>{localCharacters.find((c) => c.id === selectedId)?.character_name}</strong>로,
            <strong> {videoType}</strong> 형식으로 계속 진행할 준비가 되었습니다.
          </p>
          <button
            onClick={() => {
              if (onSelect) {
                onSelect(localCharacters.find((c) => c.id === selectedId), videoType);
              }
            }}
            className="mt-3 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            🚀 다음 단계로
          </button>
        </div>
      )}

      {/* 캐릭터가 없는 경우 */}
      {localCharacters.length === 0 && (
        <div className="text-center py-12 text-gray-500">
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
