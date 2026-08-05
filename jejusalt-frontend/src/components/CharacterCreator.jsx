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

export default function CharacterCreator({ characters = [], resourceId, onSelect }) {
  const videoTypes = getVideoTypes();
  const [localCharacters, setLocalCharacters] = useState(characters);
  const [selectedId, setSelectedId] = useState(
    characters.find((c) => c.selected)?.id || characters[0]?.id
  );
  const [videoType, setVideoType] = useState(videoTypes[1] || '제품스토리');
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
      <p className="text-gray-600 mb-6">
        AI가 추천한 캐릭터 중 1개를 선택하고 편집하세요.
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

      {/* 캐릭터 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {localCharacters.map((char, idx) => (
          <div
            key={char.id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedId === char.id}
            aria-label={`${idx + 1}순위 캐릭터 ${char.character_name}${
              selectedId === char.id ? ' (선택됨)' : ''
            }`}
            className={`border-2 rounded-lg p-5 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${
              selectedId === char.id
                ? 'border-brand-blue bg-brand-wave'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => handleSelectCharacter(char.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelectCharacter(char.id);
              }
            }}
          >
            {/* 순위 + 선택 표시 */}
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-semibold text-gray-600">
                🏆 {idx + 1}순위
              </div>
              {selectedId === char.id && (
                <span className="bg-brand-blue text-white text-xs px-2 py-1 rounded-full">
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
                      className="text-brand-blue hover:text-brand-ocean text-sm"
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

            {/* 레퍼런스 이미지 (있으면 표시) */}
            {char.reference_image_url && (
              <div className="mt-3 mb-3">
                <span className="text-xs font-semibold text-gray-600">🖼️ 레퍼런스 이미지:</span>
                <div className="mt-2 w-full h-32 bg-gray-200 rounded border border-gray-300 flex items-center justify-center overflow-hidden">
                  <img
                    src={char.reference_image_url}
                    alt={`${char.character_name} reference`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3E이미지 로드 실패%3C/text%3E%3C/svg%3E';
                    }}
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
        <div className="bg-brand-wave border-2 border-brand-blue/30 rounded-lg p-6 mb-6">
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
          <h4 className="font-semibold mb-3">🎬 영상유형 선택</h4>
          <div className="flex flex-wrap gap-3">
            {videoTypes.map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition ${
                  videoType === type
                    ? 'border-brand-blue bg-brand-wave text-brand-blue-dark'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="videoType"
                  checked={videoType === type}
                  onChange={() => setVideoType(type)}
                  className="w-4 h-4"
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 숏폼 길이 선택 */}
      {selectedId && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h4 className="font-semibold mb-3">⏱️ 영상 길이 선택</h4>
          <div className="flex flex-wrap gap-3">
            {DURATION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex flex-col items-start gap-0.5 px-4 py-2 border rounded-lg cursor-pointer transition ${
                  duration === opt.value
                    ? 'border-brand-blue bg-brand-wave text-brand-blue-dark'
                    : 'border-gray-200 hover:border-gray-300'
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
                <span className="text-xs text-gray-500 ml-6">{opt.hint}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 다음 단계 안내 */}
      {selectedId && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-center">
          <p className="text-green-800">
            ✨ <strong>{localCharacters.find((c) => c.id === selectedId)?.character_name}</strong>로,
            <strong> {videoType}</strong> · <strong>{duration}초</strong> 형식으로 계속 진행할 준비가 되었습니다.
          </p>
          <button
            onClick={() => {
              if (onSelect) {
                onSelect(localCharacters.find((c) => c.id === selectedId), videoType, duration);
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
