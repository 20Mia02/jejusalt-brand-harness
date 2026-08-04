import FilterUI from "./components/FilterUI"
import "./App.css"

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div style={{ marginBottom: "20px" }}>
          {/* 제주소금 공식 BI 로고 */}
          <svg 
            className="logo-icon" 
            viewBox="0 0 100 100" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: "70px", height: "70px" }}
          >
            {/* 원형 테두리 */}
            <circle cx="50" cy="50" r="42" fill="none" stroke="#000000" strokeWidth="2.5"/>
            
            {/* 왼쪽 곡선 (한라산 왼쪽 봉우리) */}
            <path d="M 35 60 Q 40 35 45 60" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round"/>
            
            {/* 오른쪽 곡선 (한라산 오른쪽 봉우리) */}
            <path d="M 55 60 Q 60 35 65 60" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1>제주도 라바 씨솔트</h1>
        <p className="app-header-subtitle">자료 필터링</p>
      </header>
      
      <main className="app-main">
        <FilterUI />
      </main>
    </div>
  )
}

export default App
