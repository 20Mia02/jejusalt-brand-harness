import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function FilterUI() {
  const navigate = useNavigate();

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

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      const dummyMetadata = {
        categories: ["식품", "뷰티", "웰스케어"],
        ageGroups: ["20~30대", "40~60대", "60대+"],
        targets: ["개인", "가족", "단체", "관광객", "기업"],
        focus: ["신뢰", "기술", "건강", "감정", "자연", "감각", "연관"],
      };
      setMetadata(dummyMetadata);
    } catch (err) {
      console.error("메타데이터 로드 실패:", err);
      setError("필터 데이터 로드 실패");
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => {
      const current = prev[filterType] || [];
      const updated = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [filterType]: updated };
    });
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.categories.length > 0) {
        params.append("categories", filters.categories.join(","));
      }
      if (filters.ageGroups.length > 0) {
        params.append("ageGroups", filters.ageGroups.join(","));
      }
      if (filters.targets.length > 0) {
        params.append("targets", filters.targets.join(","));
      }
      if (filters.focus.length > 0) {
        params.append("focus", filters.focus.join(","));
      }

      const res = await axios.get(`/api/resources/filter?${params.toString()}`);
      setFilteredResources(res.data.resources || []);
    } catch (err) {
      console.error("필터 검색 실패:", err);
      setError("검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

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
    <div>
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* 필터 섹션 */}
      <div className="filter-section">
        {/* 카테고리 */}
        <div className="filter-group category">
          <label className="filter-label">카테고리</label>
          <div className="flex flex-wrap gap-3">
            {metadata.categories.map((cat) => (
              <label key={cat} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(cat)}
                  onChange={() => handleFilterChange("categories", cat)}
                  className="w-4 h-4"
                />
                <span>{cat}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 나이대 */}
        <div className="filter-group age">
          <label className="filter-label">나이대</label>
          <div className="flex flex-wrap gap-3">
            {metadata.ageGroups.map((age) => (
              <label key={age} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.ageGroups.includes(age)}
                  onChange={() => handleFilterChange("ageGroups", age)}
                  className="w-4 h-4"
                />
                <span>{age}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 대상 */}
        <div className="filter-group target">
          <label className="filter-label">대상</label>
          <div className="flex flex-wrap gap-3">
            {metadata.targets.map((target) => (
              <label key={target} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.targets.includes(target)}
                  onChange={() => handleFilterChange("targets", target)}
                  className="w-4 h-4"
                />
                <span>{target}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 강조점 */}
        <div className="filter-group emphasis">
          <label className="filter-label">강조점</label>
          <div className="flex flex-wrap gap-3">
            {metadata.focus.map((f) => (
              <label key={f} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.focus.includes(f)}
                  onChange={() => handleFilterChange("focus", f)}
                  className="w-4 h-4"
                />
                <span>{f}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="button-group">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                검색 중...
              </span>
            ) : (
              "검색"
            )}
          </button>
          <button onClick={handleReset} disabled={loading} className="btn btn-secondary">
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

      {/* 결과 없음 */}
      {filteredResources.length === 0 &&
        Object.values(filters).some((f) => f.length > 0) && (
          <div className="text-center py-8 text-gray-500">
            해당하는 자료가 없습니다.
          </div>
        )}
    </div>
  );
}
