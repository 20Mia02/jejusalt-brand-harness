# 제주소금(JejuSalt) — AI 브랜드 콘텐츠·마케팅 자동화 플랫폼

**프로젝트**: AI 기반 브랜드 콘텐츠·디지털 마케팅 고도화
**팀**: 으랏차차 짠돌(石)이네 (박주미, 고수아)
**부트캠프**: 제주대학교 x Upstage AI 부트캠프 (2026.07)
**마감**: 2026.08.06(수) 18:00 / **발표**: 2026.08.07(목)

---

## 🎯 프로젝트 개요

제주소금 제품을 다양한 타겟 고객층에 맞게 자동으로 분석하고, AI가 추천한 캐릭터와 120초 숏폼 시나리오를 기반으로 **영상까지 완성**하는 플랫폼입니다.

### 주요 기능
1. **자료 분석**: 제품 정보 입력 → 자동 메타데이터 추출 (카테고리, 타겟층, 톤앤매너 등)
2. **캐릭터 추천**: 제품에 어울리는 캐릭터 3개 자동 생성 + 사용자 선택
3. **시나리오 생성**: 120초 정확한 숏폼 시나리오 자동 작성
4. **네이밍 생성**: 제품명/콘텐츠명 3개 옵션 제시
5. **콘텐츠 생성**: 카피 자동 작성 + 검증
6. **영상 생성**: **Higgsfield를 통한 최종 영상 완성**

---

## 📚 기술 스택

- **프론트엔드**: React 18, Tailwind CSS
- **백엔드**: Node.js/Express
- **데이터베이스**: Supabase (PostgreSQL)
- **AI 에이전트**: TimelyAI (8개 Skill/Agent)
- **영상 생성**: Higgsfield API
- **배포**: (TBD)

---

## 🚀 설치 및 실행

### 필수 조건
- Node.js 18+
- Supabase 계정 (프로젝트 생성 완료)
- TimelyAI API 키
- Higgsfield API 키

### 1️⃣ 환경 설정

```bash
# 저장소 클론
git clone https://github.com/20Mia02/jejusalt-brand-harness.git
cd jejusalt-brand-harness

# 환경 변수 설정 (.env.example 참고)
cp .env.example .env
# .env 파일에 실제 API 키 채우기
```

### 2️⃣ 의존성 설치

```bash
npm install
```

### 3️⃣ Supabase 스키마 초기화

```bash
# Supabase 대시보드 → SQL Editor → 아래 파일 전체 복사 후 실행
# docs/schema.sql (7개 테이블 자동 생성)
```

### 4️⃣ 서버 시작

```bash
npm start
# 또는 (개발 모드)
npm run dev
```

브라우저: `http://localhost:5000`

---

## ⚠️ Higgsfield 크레딧 주의 ⚠️

**Higgsfield는 유료 영상 생성 API이며 크레딧이 한정되어 있습니다!**

### 주의사항
- `POST /api/generation/:resourceId/start` 호출 시 실제 영상 생성이 시작되고 **크레딧이 소비**됩니다.
- **테스트할 때 무분별하게 호출하지 마세요.**
- 로컬 디버깅 시에는 다음 방법을 사용하세요:

### 크레딧 절약 팁

#### ✅ 안전한 테스트 방법
```javascript
// 1. 폴링만 테스트 (크레딧 소비 안 함)
// GET /api/generation/:resourceId/status 를 5초 폴링

// 2. Mock jobId로 테스트 (크레딧 소비 안 함)
// pollHiggsfieldStatus("mock-job-id-12345", resourceId)

// 3. 이미 완료된 jobId 재사용 안 함 (새로운 크레딧 소비)
```

#### ❌ 피해야 할 것
```
- 실제 영상 생성 요청을 여러 번 반복 테스트
- 같은 자료로 매번 새로운 생성 시작
- 디버깅 중 POST /api/generation 계속 호출
```

#### 📊 크레딧 확인
```bash
# Higgsfield 대시보드에서 남은 크레딧 확인
https://dashboard.higgsfield.ai → Credits
```

---

## 📁 프로젝트 구조

```
jejusalt-brand-harness/
├── agents/                    # 에이전트 정의 문서
│   ├── orchestrator.md
│   ├── backend-agent.md       # TimelyAI 8개 Agent 매핑
│   ├── database-agent.md      # Supabase CRUD
│   └── frontend-agent.md      # UI 상태 관리
├── backend/
│   ├── routes/
│   │   ├── resources.js       # 기능1: 자료 업로드 + 분석
│   │   ├── admin.js           # 기능3: 관리자 모드
│   │   └── generation.js      # 기능4: AI생성 + Higgsfield
│   └── lib/
│       └── supabaseClient.js
├── frontend/
│   ├── components/
│   │   ├── FilterUI.jsx       # 기능2: 동적 필터
│   │   ├── AdminMode.jsx      # 기능3 UI
│   │   ├── GenerationUI.jsx   # 기능4 UI (Higgsfield 폴링!)
│   │   └── CharacterCreator.jsx # 캐릭터 관리
│   └── App.jsx
├── docs/
│   ├── schema.sql             # Supabase 테이블 정의
│   ├── data-schema-v4.md      # 7개 테이블 구조 + 필드 명세
│   └── api-integration-plan-v4.md  # API 통합 설계서
├── .env.example               # 환경 변수 템플릿
├── .gitignore
├── package.json
└── README.md                  # 이 파일
```

---

## 🔗 중요 문서

| 문서 | 용도 |
|---|---|
| `agents/backend-agent.md` | TimelyAI 8개 Agent 호출 정책 |
| `agents/database-agent.md` | Supabase CRUD 저장 순서 |
| `agents/frontend-agent.md` | React 폴링 로직 (Higgsfield 실시간 진행률) |
| `docs/api-integration-plan-v4.md` | Claude API / TimelyAI / Higgsfield 통합 설계 |
| `docs/data-schema-v4.md` | 7개 테이블 상세 구조 |

---

## 📝 API 엔드포인트

### 기능1: 자료 업로드 & 분석
```
POST /api/resources
- 입력: { productName, productInfo, keywords }
- 출력: { resourceId, metadata, characters }
```

### 기능2: 동적 필터
```
GET /api/resources/filter?categories=식품&ageGroups=40~60대
- 출력: 필터링된 자료 목록
```

### 기능3: 관리자 모드
```
PUT /api/admin/resources/:id
PUT /api/admin/characters/:id
DELETE /api/admin/characters/:id
```

### 기능4: AI 생성 (Higgsfield 포함!)
```
POST /api/generation/:resourceId/start
- 응답: 202 (비동기 처리 시작)

GET /api/generation/:resourceId/status
- 출력: { status, progress, videoUrl }
- ⚠️ 주의: 이 엔드포인트로 진행률 폴링할 때 크레딧이 소비되지 않습니다!
```

---

## 🧪 테스트 체크리스트

- [ ] 자료 업로드 → Supabase에 저장 확인
- [ ] 메타데이터 자동 분석
- [ ] 캐릭터 3개 추천
- [ ] 필터 UI 동작
- [ ] 관리자 모드 수정 기능
- [ ] AI 생성 파이프라인 (Step 1~7)
- [ ] **Higgsfield 영상 생성** ⚠️ 크레딧 주의!

---

## 🐛 버그 리포트

이슈 발생 시: https://github.com/20Mia02/jejusalt-brand-harness/issues

---

## 📅 일정

| 날짜 | 마일스톤 |
|---|---|
| 2026.08.04 | Day 2: 설계 + 기본 코드 완성, Higgsfield 연동 |
| 2026.08.05 | Day 3: 테스트 + 최적화 + 캐싱 |
| 2026.08.06 | Day 4: 최종 버그 수정, 발표 준비 |
| 2026.08.07 | 최종 발표 |

---

## 📞 문의

- 박주미 (백엔드): 
- 고수아 (프론트엔드): 

---

**마지막 업데이트**: 2026.08.04
