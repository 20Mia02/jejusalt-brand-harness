/**
 * frontend/components/AdminMode.jsx (수정판)
 * 
 * 🔧 수정 사항:
 * 1. 네이밍 선택을 State 관리로 변경 (DOM 직접 조작 제거)
 * 2. naming 엔드포인트 추가 (GET /api/naming/:resourceId)
 * 3. 네이밍 섹션이 실제로 렌더링되도록 함
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminMode() {
  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [naming, setNaming] = useState(null);
  
  // 🆕 네이밍 선택 State 추가
  const [selectedProductIdx, setSelectedProductIdx] = useState(0);
  const [selectedContentIdx, setSelectedContentIdx] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // 마운트 시 자료 목록 로드
  useEffect(() => {
    loadResources();
  }, []);

  /**
   * 자료 목록 로드
   */
  const loadResources = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resources');
      setResources(res.data.resources || []);
    } catch (err) {
      console.error('자료 목록 로드 실패:', err);
      setError('자료를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 자료 선택 → 캐릭터/네이밍 정보 로드
   */
  const handleSelectResource = async (resource) => {
    try {
      setLoading(true);
      setSelectedResource(resource);

      // 캐릭터 조회
      const charRes = await axios.get(`/api/resources/${resource.id}`);
      setCharacters(charRes.data.characters || []);

      // 🆕 네이밍 조회 (GET /api/naming/:resourceId)
      try {
        const namingRes = await axios.get(`/api/naming/${resource.id}`);
        if (namingRes.data.naming) {
          setNaming(namingRes.data.naming);
          setSelectedProductIdx(0);   // 기본값: 1순위
          setSelectedContentIdx(0);   // 기본값: 1순위
        } else {
          setNaming(null);
        }
      } catch (namingErr) {
        // 네이밍이 아직 없으면 null
        setNaming(null);
      }
    } catch (err) {
      console.error('정보 로드 실패:', err);
      setError('정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 자료 메타데이터 수정
   */
  const handleUpdateResource = async () => {
    if (!selectedResource) return;

    try {
      setLoading(true);
      await axios.put(`/api/admin/resources/${selectedResource.id}`, {
        productName: selectedResource.product_name,
        productInfo: selectedResource.product_info,
        metadata: selectedResource.metadata,
      });
      setSuccessMessage('자료가 저장되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('자료 저장 실패:', err);
      setError('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 캐릭터 voice_tone/personality_traits 수정
   */
  const handleUpdateCharacter = async (characterId, updates) => {
    try {
      setLoading(true);
      await axios.put(`/api/admin/characters/${characterId}`, {
        ...updates,
        edited_by: 'admin',
      });
      
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === characterId ? { ...c, ...updates } : c
        )
      );
      setSuccessMessage('캐릭터가 저장되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('캐릭터 저장 실패:', err);
      setError('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 캐릭터 삭제
   */
  const handleDeleteCharacter = async (characterId) => {
    try {
      setLoading(true);
      await axios.delete(`/api/admin/characters/${characterId}`);
      setCharacters((prev) => prev.filter((c) => c.id !== characterId));
      setDeleteConfirm(null);
      setSuccessMessage('캐릭터가 삭제되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('캐릭터 삭제 실패:', err);
      setError('삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔧 네이밍 선택 저장 (수정판: State 기반)
   */
  const handleSelectNaming = async () => {
    if (!selectedResource || !naming) return;

    try {
      setLoading(true);
      const productNameField = `product_name_${selectedProductIdx + 1}`;
      const contentNameField = `content_name_${selectedContentIdx + 1}`;

      await axios.put(`/api/admin/naming/${selectedResource.id}`, {
        selectedProductName: naming[productNameField],
        selectedContentName: naming[contentNameField],
      });

      setSuccessMessage('네이밍이 저장되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('네이밍 저장 실패:', err);
      setError('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────
  // UI 렌더링
  // ─────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 제목 */}
      <h1 className="text-3xl font-bold mb-8">🛠️ 관리자 모드</h1>

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

      {/* 2열 레이아웃: 자료 목록 + 상세 편집 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 좌측: 자료 목록 */}
        <div className="col-span-1 bg-white shadow rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">자료 목록</h2>
          {loading ? (
            <div className="text-center py-8">로드 중...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {resources.map((resource) => (
                <button
                  key={resource.id}
                  onClick={() => handleSelectResource(resource)}
                  className={`w-full text-left p-3 rounded transition ${
                    selectedResource?.id === resource.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <div className="font-semibold">{resource.product_name}</div>
                  <div className="text-xs opacity-75">
                    {new Date(resource.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 상세 편집 (2열) */}
        <div className="col-span-2 space-y-6">
          {selectedResource ? (
            <>
              {/* 섹션 1: 자료 정보 수정 */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">📦 자료 정보</h3>

                <div className="space-y-4">
                  {/* 제품명 */}
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      제품명
                    </label>
                    <input
                      type="text"
                      value={selectedResource.product_name}
                      onChange={(e) =>
                        setSelectedResource({
                          ...selectedResource,
                          product_name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>

                  {/* 제품 정보 */}
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      제품 정보
                    </label>
                    <textarea
                      value={selectedResource.product_info}
                      onChange={(e) =>
                        setSelectedResource({
                          ...selectedResource,
                          product_info: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded h-24"
                    />
                  </div>

                  {/* 메타데이터 (JSON) */}
                  {selectedResource.metadata && (
                    <div>
                      <label className="block text-sm font-semibold mb-1">
                        메타데이터 (자동 생성됨)
                      </label>
                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-24">
                        {JSON.stringify(selectedResource.metadata, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* 저장 버튼 */}
                  <button
                    onClick={handleUpdateResource}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    💾 자료 저장
                  </button>
                </div>
              </div>

              {/* 섹션 2: 캐릭터 편집 */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">🎭 캐릭터 편집</h3>

                <div className="space-y-4">
                  {characters.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      캐릭터가 없습니다. 먼저 AI 생성을 실행하세요.
                    </div>
                  ) : (
                    characters.map((char, idx) => (
                      <div
                        key={char.id}
                        className="border-l-4 border-blue-600 pl-4 py-3 bg-gray-50 rounded"
                      >
                        {/* 캐릭터 이름 + 선택 상태 */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-lg">
                              {idx + 1}순위: {char.character_name}
                            </h4>
                            {char.selected && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                ✓ 선택됨
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setDeleteConfirm(char.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            🗑️ 삭제
                          </button>
                        </div>

                        {/* Voice Tone 편집 */}
                        <div className="mb-3">
                          <label className="text-sm font-semibold">
                            목소리 톤
                          </label>
                          <input
                            type="text"
                            value={char.voice_tone || ''}
                            onChange={(e) => {
                              const updated = { ...char, voice_tone: e.target.value };
                              setCharacters((prev) =>
                                prev.map((c) =>
                                  c.id === char.id ? updated : c
                                )
                              );
                            }}
                            onBlur={() =>
                              handleUpdateCharacter(char.id, {
                                voice_tone: char.voice_tone,
                              })
                            }
                            placeholder="예: 따뜬한 아버지"
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>

                        {/* Personality Traits 편집 */}
                        <div>
                          <label className="text-sm font-semibold">
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
                              const updated = {
                                ...char,
                                personality_traits: traits,
                              };
                              setCharacters((prev) =>
                                prev.map((c) =>
                                  c.id === char.id ? updated : c
                                )
                              );
                            }}
                            onBlur={() =>
                              handleUpdateCharacter(char.id, {
                                personality_traits: char.personality_traits,
                              })
                            }
                            placeholder="예: 유머감각, 신뢰성 (쉼표로 구분)"
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 섹션 3: 네이밍 선택 (수정판) */}
              {naming && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">📝 네이밍 선택</h3>

                  <div className="space-y-6">
                    {/* 제품명 3개 옵션 (State 기반) */}
                    <div>
                      <h4 className="font-semibold mb-3">제품명</h4>
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <label
                            key={`product_${i}`}
                            className="flex items-start gap-3 p-3 border rounded hover:bg-blue-50 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="productName"
                              checked={selectedProductIdx === i}
                              onChange={() => setSelectedProductIdx(i)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-semibold">
                                {i + 1}순위: {naming[`product_name_${i + 1}`]} (
                                {naming[`product_name_${i + 1}_score`]}점)
                              </div>
                              <div className="text-sm text-gray-600">
                                {naming[`product_name_${i + 1}_meaning`]}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 콘텐츠명 3개 옵션 (State 기반) */}
                    <div>
                      <h4 className="font-semibold mb-3">콘텐츠명</h4>
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <label
                            key={`content_${i}`}
                            className="flex items-start gap-3 p-3 border rounded hover:bg-blue-50 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="contentName"
                              checked={selectedContentIdx === i}
                              onChange={() => setSelectedContentIdx(i)}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-semibold">
                                {i + 1}순위: {naming[`content_name_${i + 1}`]} (
                                {naming[`content_name_${i + 1}_score`]}점)
                              </div>
                              <div className="text-sm text-gray-600">
                                {naming[`content_name_${i + 1}_meaning`]}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 저장 버튼 */}
                    <button
                      onClick={handleSelectNaming}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      ✅ 네이밍 저장
                    </button>
                  </div>
                </div>
              )}

              {/* 네이밍이 아직 없는 경우 */}
              {!naming && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-blue-800">
                    📝 아직 네이밍이 생성되지 않았습니다.
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    먼저 "AI 생성" 버튼을 클릭해서 Step 6(네이밍 생성)까지 완료하세요.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
              좌측에서 자료를 선택하세요.
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-bold mb-4">캐릭터를 삭제하시겠습니까?</h3>
            <p className="text-gray-600 mb-6">
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                취소
              </button>
              <button
                onClick={() => handleDeleteCharacter(deleteConfirm)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
