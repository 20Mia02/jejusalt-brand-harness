/**
 * frontend/components/CharacterCreator.jsx
 * 
 * 캐릭터 생성/편집/선택 UI
 * 담당: 고수아(UI) + 박주미(API)
 * 
 * 역할:
 * 1. AI가 추천한 캐릭터 3개를 카드로 표시
 * 2. 각 캐릭터의 voice_tone, personality_traits 편집
 * 3. 한 개만 "선택" 가능 (selected = true)
 * 4. 캐릭터 프로필 전체 보기/숨기기
 * 5. 저장 및 다음 단계로 진행
 */

import React, { useState } from 'react';
import axios from 'axios';

export default function CharacterCreator({ characters = [], resourceId, onSelect }) {
  const [localCharacters, setLocalCharacters] = useState(characters);
  const [selectedId, setSelectedId] = useState(
    characters.find((c) => c.selected)?.id || characters[0]?.id
  );
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * 캐릭터 선택 (selected = true)
   */
  const handleSelectCharacter = async (characterId) => {
    try {
      setLoading(true);
      
      // PUT /api/admin/characters/:id → selected: true
      await axios.put(`/api/admin/characters/${characterId}`, {
        selected: true,
      });

      // 로컬 상태 업데이트
      const updated = localCharacters.map((c) => ({
        ...c,
        selected: c.id === characterId,
      }));
      setLocalCharacters(updated);
      setSelectedId(characterId);

      setSuccessMessage('캐릭터가 선택되었습니다.');
      setTimeout(() => setSuccessMessage(null), 2000);

      if (onSelect) {
        onSelect(localCharacters.find((c) => c.id === characterId));
      }
    } catch (err) {
      console.error('캐릭터 선택 실패:', err);
      setError('선택에 실패했습니다.');
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

      {/* 다음 단계 안내 */}
      {selectedId && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-center">
          <p className="text-green-800">
            ✨ <strong>{localCharacters.find((c) => c.id === selectedId)?.character_name}</strong>로
            계속 진행할 준비가 되었습니다.
          </p>
          <button
            onClick={() => {
              if (onSelect) {
                onSelect(localCharacters.find((c) => c.id === selectedId));
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
          <p className="mb-4">아직 캐릭터가 생성되지 않았습니다.</p>
          <p className="text-sm">먼저 자료를 업로드하고 AI 분석을 완료하세요.</p>
        </div>
      )}
    </div>
  );
}
