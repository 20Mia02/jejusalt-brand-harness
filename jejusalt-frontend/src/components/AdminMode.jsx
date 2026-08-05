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
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [generationLogs, setGenerationLogs] = useState([]);

  // 🆕 코멘트 스레드 State
  const [comments, setComments] = useState([]);
  const [newCommentAuthor, setNewCommentAuthor] = useState('담당자');
  const [newCommentMessage, setNewCommentMessage] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

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

      // 🆕 네이밍 조회
      try {
        const namingRes = await axios.get(`/api/admin/naming/${resource.id}`);
        if (namingRes.data.naming) {
          setNaming(namingRes.data.naming);
          setSelectedProductIdx(0);
          setSelectedContentIdx(0);
        } else {
          setNaming(null);
        }
      } catch (namingErr) {
        setNaming(null);
      }

      // 🆕 생성 이력 조회
      try {
        const logsRes = await axios.get(`/api/generate/${resource.id}/logs`);
        if (logsRes.data.logs) {
          setGenerationLogs(logsRes.data.logs);
        }
      } catch (logsErr) {
        setGenerationLogs([]);
      }

      // 🆕 코멘트 스레드 조회
      await loadComments(resource.id);
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
    } catch (err) {
      console.error('네이밍 저장 실패:', err);
      setError('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🆕 코멘트 스레드 조회
   */
  const loadComments = async (resourceId) => {
    try {
      const res = await axios.get(`/api/resources/${resourceId}/comments`);
      setComments(res.data.comments || []);
    } catch (err) {
      // comments 테이블이 아직 마이그레이션되지 않았을 수 있으므로 조용히 빈 목록 처리
      console.warn('코멘트 조회 실패 (마이그레이션 미적용일 수 있음):', err.message);
      setComments([]);
    }
  };

  /**
   * 🆕 코멘트 작성
   */
  const handleAddComment = async () => {
    if (!selectedResource || !newCommentMessage.trim()) return;

    try {
      setCommentLoading(true);
      await axios.post(`/api/resources/${selectedResource.id}/comments`, {
        author: newCommentAuthor.trim() || '담당자',
        message: newCommentMessage.trim(),
      });
      setNewCommentMessage('');
      await loadComments(selectedResource.id);
      setSuccessMessage('코멘트가 등록되었습니다.');
    } catch (err) {
      console.error('코멘트 작성 실패:', err);
      setError(
        err.response?.data?.message ||
          '코멘트 저장에 실패했습니다. comments 테이블 마이그레이션이 필요할 수 있습니다.'
      );
    } finally {
      setCommentLoading(false);
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

      {/* 2열 레이아웃: 자료 목록 + 상세 편집 (모바일: 1열 스택) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 좌측: 자료 목록 */}
        <div className="md:col-span-1 bg-white shadow rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">자료 목록</h2>
          {loading ? (
            <div className="text-center py-8 flex items-center justify-center gap-2 text-gray-500">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              로드 중...
            </div>
          ) : resources.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              아직 등록된 자료가 없습니다.<br />
              "자료 입력" 화면에서 새 자료를 추가해보세요.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {resources.map((resource) => (
                <button
                  key={resource.id}
                  onClick={() => handleSelectResource(resource)}
                  className={`w-full text-left p-3 rounded transition ${
                    selectedResource?.id === resource.id
                      ? 'bg-brand-blue text-white'
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

        {/* 우측: 상세 편집 (2열, 모바일에서는 전체 폭) */}
        <div className="md:col-span-2 space-y-6">
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
                    className="w-full px-4 py-2 bg-brand-blue text-white rounded hover:bg-brand-blue-dark disabled:opacity-50"
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
                        className="border-l-4 border-brand-blue pl-4 py-3 bg-gray-50 rounded"
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

                        {/* ⭐ 레퍼런스 이미지 & 생성 횟수 (재현성 추적) */}
                        <div className="mt-3 p-3 bg-brand-wave rounded border border-brand-blue/30">
                          <div className="text-xs font-semibold text-brand-ocean mb-2">
                            🖼️ 레퍼런스 이미지 (재현성)
                          </div>
                          {char.reference_image_url && (
                            <>
                              <div className="w-full h-20 bg-gray-200 rounded border border-gray-300 flex items-center justify-center overflow-hidden mb-2">
                                <img
                                  src={char.reference_image_url}
                                  alt={`${char.character_name} reference`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3C/svg%3E';
                                  }}
                                />
                              </div>
                              <div className="text-xs text-gray-600 break-all mb-2">
                                <strong>URL:</strong> {char.reference_image_url.substring(0, 50)}...
                              </div>
                              {char.generation_count && char.generation_count > 0 && (
                                <div className="text-xs text-green-700 font-semibold">
                                  ✓ {char.generation_count}회 생성됨
                                </div>
                              )}
                            </>
                          ) || (
                            <div className="text-xs text-gray-600">
                              아직 이미지 생성 안 됨. 첫 영상 생성 후 자동으로 저장됩니다.
                            </div>
                          )}
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
                            className="flex items-start gap-3 p-3 border rounded hover:bg-brand-wave cursor-pointer"
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
                            className="flex items-start gap-3 p-3 border rounded hover:bg-brand-wave cursor-pointer"
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
                <div className="bg-brand-wave border border-brand-blue/30 rounded-lg p-4 text-center">
                  <p className="text-brand-ocean">
                    📝 아직 네이밍이 생성되지 않았습니다.
                  </p>
                  <p className="text-sm text-brand-blue mt-1">
                    먼저 "AI 생성" 버튼을 클릭해서 Step 6(네이밍 생성)까지 완료하세요.
                  </p>
                </div>
              )}

              {/* 섹션 4: 코멘트 스레드 (팀 협업) */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">💬 코멘트 스레드</h3>

                {/* 코멘트 목록 */}
                <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">
                      아직 코멘트가 없습니다. 첫 코멘트를 남겨보세요.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-brand-ocean">
                            {c.author}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.message}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* 코멘트 작성 폼 */}
                <div className="space-y-2 border-t pt-4">
                  <input
                    type="text"
                    value={newCommentAuthor}
                    onChange={(e) => setNewCommentAuthor(e.target.value)}
                    placeholder="작성자 이름"
                    className="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-brand-blue"
                  />
                  <textarea
                    value={newCommentMessage}
                    onChange={(e) => setNewCommentMessage(e.target.value)}
                    placeholder="이 자료에 대한 검토 의견을 남겨주세요..."
                    className="w-full px-3 py-2 border rounded text-sm h-20 focus:ring-2 focus:ring-brand-blue"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={commentLoading || !newCommentMessage.trim()}
                    className="w-full px-4 py-2 bg-brand-blue text-white rounded hover:bg-brand-blue-dark disabled:opacity-50 text-sm font-semibold"
                  >
                    {commentLoading ? '등록 중...' : '💬 코멘트 등록'}
                  </button>
                </div>
              </div>
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
