/**
 * frontend/components/FilterUI.jsx
 * 
 * 기능2: 동적 필터 UI
 * 담당: 고수아
 * 
 * 역할:
 * 1. 메타데이터의 모든 옵션 표시 (categories, ageGroups, targets, focus 등)
 * 2. 사용자가 여러 개 선택 가능 (멀티 체크박스)
 * 3. "검색" 버튼 클릭 시 GET /api/resources/filter 호출
 * 4. 결과를 자료 목록으로 표시
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function FilterUI() {
  // 라우팅
  const navigate = useNavigate();
  
  // 상태 관리
  const [metadata, setMetadata] = useState(null);
  const [filters, setFilters] = useState({
    categories: [],
    ageGroups: [],
    targets: [],
    focus: [],
  });
  const [filteredResources, setFilteredResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 마운트 시 메타데이터 옵션 로드
  useEffect(() => {
    loadMetadata();
  }, []);

  /**
   * 메타데이터(필터 옵션) 로드
   * 실제로는 /api/metadata 엔드포인트에서 가져옵니다.
   * 일단은 더미 데이터로 시작.
   */
  const loadMetadata = async () => {
    try {
      // TODO: 실제로는 백엔드에서 메타데이터를 가져와야 함
      // const res = await axios.get('/api/metadata');
      // setMetadata(res.data);

      // 임시 더미 데이터 (data-schema-v4.md 기준)
      const dummyMetadata = {
        categories: ['식품', '뷰티', '헬스케어'],
        ageGroups: ['20~30대', '40~60대', '60대+'],
        targets: ['개인 케어', '가족 밥상', '운동 애호가', '관광객', '선물/기념품'],
        focus: ['신뢰', '기술', '건강', '자기관리', '일상', '감정', '자연성'],
      };
      setMetadata(dummyMetadata);
    } catch (err) {
      console.error('메타데이터 로드 실패:', err);
      setError('필터 옵션을 불러올 수 없습니다.');
    }
  };

  /**
   * 체크박스 변경 핸들러
   */
  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => {
      const current = prev[filterType] || [];
      const updated = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [filterType]: updated };
    });
  };

  /**
   * 검색 버튼 클릭 → API 호출
   */
  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      // GET /api/resources/filter?categories=...&ageGroups=...&targets=...
      const params = new URLSearchParams();
      if (filters.categories.length > 0) {
        params.append('categories', filters.categories.join(','));
      }
      if (filters.ageGroups.length > 0) {
        params.append('ageGroups', filters.ageGroups.join(','));
      }
      if (filters.targets.length > 0) {
        params.append('targets', filters.targets.join(','));
      }
      if (filters.focus.length > 0) {
        params.append('focus', filters.focus.join(','));
      }

      const res = await axios.get(`/api/resources/filter?${params.toString()}`);
      setFilteredResources(res.data.resources || []);
    } catch (err) {
      console.error('필터 검색 실패:', err);
      setError('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 필터 초기화
   */
  const handleReset = () => {
    setFilters({
      categories: [],
      ageGroups: [],
      targets: [],
      focus: [],
    });
    setFilteredResources([]);
  };

  if (!metadata) {
    return <div className="text-center py-8">필터를 불러오는 중...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 제목 */}
      <h1 className="text-3xl font-bold mb-8">🔍 자료 필터링</h1>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* 필터 섹션 */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        {/* 카테고리 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">카테고리</h3>
          <div className="flex flex-wrap gap-3">
            {metadata.categories.map((cat) => (
              <label key={cat} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(cat)}
                  onChange={() => handleFilterChange('categories', cat)}
                  className="w-4 h-4"
                />
                <span>{cat}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 나이대 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">나이대</h3>
          <div className="flex flex-wrap gap-3">
            {metadata.ageGroups.map((age) => (
              <label key={age} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.ageGroups.includes(age)}
                  onChange={() => handleFilterChange('ageGroups', age)}
                  className="w-4 h-4"
                />
                <span>{age}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 대상 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">대상</h3>
          <div className="flex flex-wrap gap-3">
            {metadata.targets.map((target) => (
              <label key={target} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.targets.includes(target)}
                  onChange={() => handleFilterChange('targets', target)}
                  className="w-4 h-4"
                />
                <span>{target}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 강조점 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">강조점</h3>
          <div className="flex flex-wrap gap-3">
            {metadata.focus.map((f) => (
              <label key={f} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.focus.includes(f)}
                  onChange={() => handleFilterChange('focus', f)}
                  className="w-4 h-4"
                />
                <span>{f}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '검색 중...' : '🔍 검색'}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 결과 섹션 */}
      {filteredResources.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">
            검색 결과 ({filteredResources.length}개)
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {filteredResources.map((resource) => (
              <div
                key={resource.id}
                className="bg-white shadow rounded-lg p-4 hover:shadow-lg cursor-pointer transition"
                onClick={() => navigate(`/admin/${resource.id}`)}
              >
                <h3 className="text-lg font-semibold text-blue-600">
                  {resource.product_name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {resource.product_info.substring(0, 100)}...
                </p>
                {resource.metadata && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {resource.metadata.categories?.map((cat) => (
                      <span
                        key={cat}
                        className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  생성일: {new Date(resource.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 검색 후 결과 없음 */}
      {filteredResources.length === 0 && Object.values(filters).some((f) => f.length > 0) && (
        <div className="text-center py-8 text-gray-500">
          해당하는 자료가 없습니다.
        </div>
      )}
    </div>
  );
}
