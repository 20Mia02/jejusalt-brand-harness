import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import FilterUI from "./components/FilterUI"
import GenerationUI from "./components/GenerationUI"
import MetadataReviewUI from "./components/MetadataReviewUI"
import CharacterCreator from "./components/CharacterCreator"
import AdminMode from "./components/AdminMode"
import "./App.css"

// Config 전역 상태
window.appConfig = null;

const STEP_LABELS = {
  filter: '자료 필터링',
  metadata: '메타데이터 검토',
  character: '캐릭터 선택',
  generation: 'AI 콘텐츠 생성',
};

function MainFlow({ currentStep, setCurrentStep }) {
  const [resourceId, setResourceId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [videoType, setVideoType] = useState('제품스토리');

  const handleResourceCreated = (newResourceId) => {
    setResourceId(newResourceId);
    setCurrentStep('metadata');
  };

  const handleMetadataReviewed = (reviewedMetadata) => {
    setMetadata(reviewedMetadata);
    setCurrentStep('character');
  };

  const handleCharacterSelected = (character, selectedVideoType) => {
    setVideoType(selectedVideoType);
    setCurrentStep('generation');
  };

  const handleGenerationComplete = () => {
    // 생성 완료 후 다시 필터링으로 돌아가기
    setCurrentStep('filter');
    setResourceId(null);
    setMetadata(null);
    setVideoType('제품스토리');
  };

  return (
    <main className="app-main">
      {currentStep === 'filter' && (
        <FilterUI onResourceCreated={handleResourceCreated} />
      )}
      {currentStep === 'metadata' && resourceId && (
        <MetadataReviewUI
          resourceId={resourceId}
          onComplete={handleMetadataReviewed}
          onError={() => setCurrentStep('filter')}
        />
      )}
      {currentStep === 'character' && resourceId && (
        <CharacterCreator
          resourceId={resourceId}
          onSelect={handleCharacterSelected}
        />
      )}
      {currentStep === 'generation' && resourceId && (
        <GenerationUI
          resourceId={resourceId}
          onSuccess={handleGenerationComplete}
          requestType="intro"
          videoType={videoType}
        />
      )}
    </main>
  );
}

function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const [currentStep, setCurrentStep] = useState('filter');
  const [brandName, setBrandName] = useState('제주도 라바 씨솔트');
  const [brandNameEn, setBrandNameEn] = useState('JEJU LAVA SEA SALT');

  useEffect(() => {
    // 서버에서 config 로드
    const loadConfig = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/config`);
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
      <header className="app-header">
        <div className="app-header-content">
          <div className="logo-section">
            <svg
              className="logo-icon"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{stopColor: "#ffffff", stopOpacity: 1}} />
                  <stop offset="100%" style={{stopColor: "#00AEEF", stopOpacity: 1}} />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#logoGradient)" strokeWidth="3"/>
              <path d="M 35 60 Q 40 35 45 60" fill="none" stroke="#00AEEF" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M 55 60 Q 60 35 65 60" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="header-text">
            <div className="header-text-korean">{brandName}</div>
            <h1>{brandNameEn.split(' ').slice(0, -2).join(' ')}<br/>{brandNameEn.split(' ').slice(-2).join(' ')}</h1>
            <div className="header-divider"></div>
            <nav className="app-header-nav">
              <Link to="/" className={!isAdmin ? 'active' : ''}>메인</Link>
              <Link to="/admin" className={isAdmin ? 'active' : ''}>관리자 모드</Link>
            </nav>
            <p className="header-subtitle">
              {isAdmin ? '관리자 모드' : STEP_LABELS[currentStep]}
            </p>
          </div>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={<MainFlow currentStep={currentStep} setCurrentStep={setCurrentStep} />}
        />
        <Route path="/admin" element={<AdminMode />} />
      </Routes>
    </div>
  )
}

export default App
