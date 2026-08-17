import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import FilterUI from "./components/FilterUI"
import GenerationUI from "./components/GenerationUI"
import MetadataReviewUI from "./components/MetadataReviewUI"
import CharacterCreator from "./components/CharacterCreator"
import CharacterGallery from "./components/CharacterGallery"
import BrandStorySection from "./components/BrandStorySection"
import AdminMode from "./components/AdminMode"
import OceanBackground from "./components/OceanBackground"
import "./App.css"

// Config 전역 상태
window.appConfig = null;

const STEP_LABELS = {
  filter: '자료 필터링',
  metadata: '메타데이터 검토',
  character: '캐릭터 선택',
  generation: 'AI 콘텐츠 생성',
};

const STEP_ORDER = ['filter', 'metadata', 'character', 'generation'];

// 라이트/다크 테마 토글: localStorage에 'theme'로 저장, 기본값 'dark'
function ThemeToggle({ theme, setTheme }) {
  const options = [
    { value: 'light', icon: '☀️', label: '라이트 모드로 전환' },
    { value: 'dark', icon: '🌙', label: '다크 모드로 전환' },
  ];

  return (
    <div className="theme-toggle" role="group" aria-label="테마 선택">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          aria-pressed={theme === opt.value}
          aria-label={opt.label}
          title={opt.label}
          className={`theme-toggle-btn ${theme === opt.value ? 'is-active' : ''}`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

// 글로벌 스텝 인디케이터: 현재 진행 단계를 1-2-3-4로 시각화 (관리자 모드에서는 숨김)
function StepIndicator({ currentStep }) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="step-indicator" role="navigation" aria-label="진행 단계">
      {STEP_ORDER.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        return (
          <div key={step} className="step-indicator-item">
            <div
              className={`step-indicator-circle ${
                isDone ? 'step-done' : isActive ? 'step-active' : 'step-pending'
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              {isDone ? '✓' : idx + 1}
            </div>
            <span className={`step-indicator-label ${isActive ? 'step-active' : ''}`}>
              {STEP_LABELS[step]}
            </span>
            {idx < STEP_ORDER.length - 1 && (
              <div className={`step-indicator-line ${isDone ? 'step-done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MainFlow({ currentStep, setCurrentStep }) {
  const [resourceId, setResourceId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [initialMetadata, setInitialMetadata] = useState(null);
  const [characters, setCharacters] = useState(null);
  const [videoType, setVideoType] = useState('제품스토리');
  const [duration, setDuration] = useState(30);
  const [referenceMaterials, setReferenceMaterials] = useState([]);

  const handleResourceCreated = (newResourceId, createdMetadata, createdCharacters, createdReferenceMaterials) => {
    setResourceId(newResourceId);
    setInitialMetadata(createdMetadata || null);
    setCharacters(createdCharacters || null);
    setReferenceMaterials(createdReferenceMaterials || []);
    setCurrentStep('metadata');
  };

  const handleMetadataReviewed = (reviewedMetadata) => {
    setMetadata(reviewedMetadata);
    setCurrentStep('character');
  };

  const handleCharacterSelected = (selectedCharacters, selectedVideoType, selectedDuration) => {
    setVideoType(selectedVideoType);
    setDuration(selectedDuration || 30);
    setCurrentStep('generation');
  };

  const handleGenerationComplete = () => {
    // 생성 완료 후 다시 필터링으로 돌아가기
    setCurrentStep('filter');
    setResourceId(null);
    setMetadata(null);
    setVideoType('제품스토리');
    setDuration(30);
  };

  return (
    <main className="app-main">
      {currentStep === 'filter' && (
        <FilterUI onResourceCreated={handleResourceCreated} />
      )}
      {currentStep === 'metadata' && resourceId && (
        <MetadataReviewUI
          resourceId={resourceId}
          initialMetadata={initialMetadata}
          onComplete={handleMetadataReviewed}
          onError={() => setCurrentStep('filter')}
        />
      )}
      {currentStep === 'character' && resourceId && (
        <CharacterCreator
          resourceId={resourceId}
          characters={characters || []}
          onSelect={handleCharacterSelected}
        />
      )}
      {currentStep === 'generation' && resourceId && (
        <GenerationUI
          resourceId={resourceId}
          onSuccess={handleGenerationComplete}
          requestType="intro"
          videoType={videoType}
          duration={duration}
          referenceMaterials={referenceMaterials}
        />
      )}
    </main>
  );
}

function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isGallery = location.pathname.startsWith('/characters');
  const [currentStep, setCurrentStep] = useState('filter');
  const [brandName, setBrandName] = useState('제주도 라바 씨솔트');
  const [brandNameEn, setBrandNameEn] = useState('JEJU LAVA SEA SALT');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // 테마 변경 시 <html>에 클래스 반영 + localStorage 저장 (새로고침/다른 페이지 이동에도 유지)
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // 서버에서 config 로드
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          window.appConfig = data;
          setBrandName(data.brand.nameKorean);
          setBrandNameEn(data.brand.nameEnglish);
        }
      } catch (err) {
        console.warn('Config 로드 실패, 기본값 사용:', err);
      }
    };
    loadConfig();
  }, []);

  return (
    <div className="app">
      <OceanBackground theme={theme} />
      <header className="app-header">
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <div className="app-header-content">
          <div className="logo-section">
            <div className="logo-badge">
              <img
                src={`${import.meta.env.BASE_URL}assets/logo/jeju-salt-logo.png`}
                alt="제주소금 JEJU LAVA SEA SALT 로고"
                className="logo-image"
              />
            </div>
          </div>

          <div className="header-text">
            <div className="header-text-korean">{brandName}</div>
            <h1>{brandNameEn.split(' ').slice(0, -2).join(' ')}<br/>{brandNameEn.split(' ').slice(-2).join(' ')}</h1>
            <div className="header-divider"></div>
            <nav className="app-header-nav">
              <Link to="/" className={!isAdmin && !isGallery ? 'active' : ''}>메인</Link>
              <Link to="/characters" className={isGallery ? 'active' : ''}>🌍 브랜드 세계관</Link>
              <Link to="/admin" className={isAdmin ? 'active' : ''}>관리자 모드</Link>
            </nav>
            <p className="header-subtitle">
              {isAdmin ? '관리자 모드' : isGallery ? '브랜드 세계관' : STEP_LABELS[currentStep]}
            </p>
          </div>
        </div>
        {!isAdmin && !isGallery && <StepIndicator currentStep={currentStep} />}
      </header>

      <Routes>
        <Route
          path="/"
          element={<MainFlow currentStep={currentStep} setCurrentStep={setCurrentStep} />}
        />
        <Route
          path="/characters"
          element={<><CharacterGallery /><BrandStorySection /></>}
        />
        <Route path="/admin" element={<AdminMode />} />
      </Routes>
    </div>
  )
}

export default App
