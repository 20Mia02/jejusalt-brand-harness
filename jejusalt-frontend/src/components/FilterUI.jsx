import React, { useState, useEffect } from "react";
import axios from "axios";

// 사업 우선순위 카테고리 (뷰티 > 헬스케어) — UI에서 ⭐ 우선순위 뱃지로 강조
const PRIORITY_CATEGORIES = ["뷰티", "웰스케어"];

export default function FilterUI({ onResourceCreated }) {
  const [mode, setMode] = useState("input"); // 'input' 또는 'filter'
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

  // 자료 입력 폼 상태
  const [inputForm, setInputForm] = useState({
    productName: "",
    productInfo: "",
    keywords: "",
    trendKeywords: "",
    customStyle: "",
  });

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      // config에서 메타데이터 추출
      let metadata = {
        categories: ["뷰티", "웰스케어", "식품"],
        ageGroups: ["20~30대", "40~60대", "60대+"],
        targets: ["개인", "가족", "단체", "관광객", "기업"],
        focus: ["신뢰", "기술", "건강", "감정", "자연", "감각", "연관"],
      };

      if (window.appConfig?.brand) {
        const cfg = window.appConfig.brand;
        metadata = {
          categories: cfg.categories || metadata.categories,
          ageGroups: cfg.targetAges || metadata.ageGroups,
          targets: cfg.targetAudience || metadata.targets,
          focus: cfg.focus || metadata.focus,
        };
      }

      setMetadata(metadata);
    } catch (err) {
      console.error("메타데이터 로드 실패:", err);
      setError("필터 데이터 로드 실패");
    }
  };

  // ── 자료 입력 ──
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitResource = async () => {
    // 유효성 검증
    if (!inputForm.productName.trim() || !inputForm.productInfo.trim()) {
      setError("제품명과 제품 정보를 모두 입력해주세요.");
      return;
    }

    if (inputForm.productName.trim().length < 3) {
      setError("제품명은 최소 3자 이상이어야 합니다.");
      return;
    }

    if (inputForm.productInfo.trim().length < 30) {
      setError("제품 정보는 최소 30자 이상이어야 합니다.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post("/api/resources", {
        productName: inputForm.productName,
        productInfo: inputForm.productInfo,
        keywords: inputForm.keywords
          ? inputForm.keywords.split(",").map((k) => k.trim())
          : [],
        trendKeywords: inputForm.trendKeywords
          ? inputForm.trendKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : [],
        customStyle: inputForm.customStyle.trim() || null,
      });

      if (response.data.success) {
        setSuccessMessage("자료가 입력되었습니다. 메타데이터를 검토해주세요.");
        // 메타데이터 검토 단계로 즉시 이동 (POST 응답의 metadata/characters를 그대로 전달 →
        // 재조회 없이 바로 사용, mock 모드에서도 안전하게 동작)
        setTimeout(() => {
          if (onResourceCreated) {
            onResourceCreated(
              response.data.resourceId,
              response.data.metadata,
              response.data.characters
            );
          }
        }, 500);
      }
    } catch (err) {
      console.error("자료 입력 실패:", err);
      setError(
        err.response?.data?.message || "자료 입력에 실패했습니다. 정보를 확인하고 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── 필터링 ──
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
    <div className="max-w-6xl mx-auto p-6">
      {/* 로고 */}
      <div className="flex justify-center mb-6">
        <img
          src="/assets/logo/jeju-salt-logo.png"
          alt="제주소금 JEJU LAVA SEA SALT 로고"
          className="h-16 w-auto"
        />
      </div>

      {/* 모드 선택 탭 */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => {
            setMode("input");
            setError(null);
            setSuccessMessage(null);
          }}
          className={`px-6 py-3 font-semibold border-b-2 transition ${
            mode === "input"
              ? "border-brand-blue text-brand-blue"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          📝 Step 1: 자료 입력
        </button>
        <button
          onClick={() => {
            setMode("filter");
            setError(null);
            setSuccessMessage(null);
          }}
          className={`px-6 py-3 font-semibold border-b-2 transition ${
            mode === "filter"
              ? "border-brand-blue text-brand-blue"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          🔍 기존 자료 검색
        </button>
      </div>

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

      {/* 자료 입력 모드 */}
      {mode === "input" && (
        <div className="bg-white shadow rounded-lg p-6 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">📝 제주소금 자료 입력</h2>

          <div className="space-y-4">
            {/* 제품명 */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                제품명 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="productName"
                value={inputForm.productName}
                onChange={handleInputChange}
                placeholder="예: 제주소금, 프리미엄 천연 해염"
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-brand-blue"
              />
              <p className="text-xs text-gray-500 mt-1">최소 3자 이상</p>
            </div>

            {/* 제품 정보 */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                제품 정보 <span className="text-red-600">*</span>
              </label>
              <textarea
                name="productInfo"
                value={inputForm.productInfo}
                onChange={handleInputChange}
                placeholder="예: 제주 청정 해역에서 채취한 천연 소금입니다. 미네랄이 풍부하고..."
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-brand-blue h-32"
              />
              <p className="text-xs text-gray-500 mt-1">최소 30자 이상</p>
            </div>

            {/* 키워드 */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                키워드 (선택사항)
              </label>
              <input
                type="text"
                name="keywords"
                value={inputForm.keywords}
                onChange={handleInputChange}
                placeholder="예: 건강, 웰빙, 프리미엄, 자연 (쉼표로 구분)"
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-brand-blue"
              />
              <p className="text-xs text-gray-500 mt-1">쉼표로 구분해서 입력하세요</p>
            </div>

            {/* 트렌드 키워드 (선택) */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                🔥 요즘 트렌드 키워드 (선택사항)
              </label>
              <input
                type="text"
                name="trendKeywords"
                value={inputForm.trendKeywords}
                onChange={handleInputChange}
                placeholder="예: 저속노화, 물광피부, 전해질 밸런스 (쉼표로 구분)"
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-brand-blue"
              />
              <p className="text-xs text-gray-500 mt-1">
                최근 SNS/뉴스에서 화제인 키워드를 입력하면 AI가 트렌드를 반영한 콘텐츠 주제를 제안합니다.
              </p>
            </div>

            {/* 소비자 커스터마이징 (선택) */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                ✍️ 원하는 스타일/문구 (선택사항)
              </label>
              <textarea
                name="customStyle"
                value={inputForm.customStyle}
                onChange={handleInputChange}
                placeholder="예: 20대가 좋아할 만한 발랄한 톤으로, '물광' 이라는 단어를 꼭 넣어주세요"
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-brand-blue h-20"
              />
              <p className="text-xs text-gray-500 mt-1">
                원하는 톤, 꼭 들어갔으면 하는 문구 등을 직접 입력하면 AI 생성에 반영됩니다.
              </p>
            </div>

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmitResource}
              disabled={loading}
              className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-brand-blue to-brand-blue-dark text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50 transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  분석 중...
                </span>
              ) : (
                "🚀 AI 분석 시작 → 메타데이터 검토로"
              )}
            </button>
          </div>

          {/* 가이드 */}
          <div className="mt-8 bg-brand-wave border border-brand-blue/30 rounded-lg p-4">
            <h3 className="font-semibold text-brand-ocean mb-2">📋 작성 가이드</h3>
            <ul className="text-sm text-brand-ocean space-y-1">
              <li>✓ 제품명: 간결하게 (3자 이상)</li>
              <li>✓ 제품 정보: 특징과 효능을 자세히 (30자 이상)</li>
              <li>✓ 키워드: 5~10개 추천 (쉼표로 구분)</li>
            </ul>
          </div>
        </div>
      )}

      {/* 필터링 모드 */}
      {mode === "filter" && (
        <div>
          {/* 필터 섹션 */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-6">🔍 기존 자료 검색</h2>

            <div className="space-y-6">
              {/* 카테고리 */}
              <div>
                <label className="block font-semibold mb-3">카테고리</label>
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
                      {PRIORITY_CATEGORIES.includes(cat) && (
                        <span
                          title="사업 우선순위 카테고리"
                          className="text-xs bg-brand-wave text-brand-ocean px-1.5 py-0.5 rounded-full"
                        >
                          ⭐ 우선순위
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* 나이대 */}
              <div>
                <label className="block font-semibold mb-3">나이대</label>
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
              <div>
                <label className="block font-semibold mb-3">대상</label>
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
              <div>
                <label className="block font-semibold mb-3">강조점</label>
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
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-brand-blue text-white rounded hover:bg-brand-blue-dark disabled:opacity-50 font-semibold"
                >
                  {loading ? "검색 중..." : "🔍 검색"}
                </button>
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50"
                >
                  초기화
                </button>
              </div>
            </div>

            {/* 검색 안내 메시지 */}
            {filteredResources.length === 0 &&
              !Object.values(filters).some((f) => f.length > 0) && (
                <div className="bg-brand-wave border border-brand-blue/30 text-brand-blue-dark px-4 py-3 rounded mt-6 text-center">
                  💡 필터를 선택하고 "검색" 버튼을 클릭하면 자료를 찾을 수 있습니다.
                </div>
              )}
          </div>

          {/* 결과 섹션 */}
          {filteredResources.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">
                검색 결과 ({filteredResources.length}개)
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {filteredResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="border rounded-lg p-4 hover:shadow-lg transition"
                  >
                    <h3 className="text-lg font-semibold text-brand-blue">
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
                            className="bg-brand-wave text-brand-ocean text-xs px-2 py-1 rounded"
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

          {filteredResources.length === 0 &&
            Object.values(filters).some((f) => f.length > 0) && (
              <div className="text-center py-8 text-gray-500">
                해당하는 자료가 없습니다.
              </div>
            )}
        </div>
      )}
    </div>
  );
}
