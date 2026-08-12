# 제주소금(JejuSalt) — Harness Engineering 기반 AI 콘텐츠 자동화 🧂✨

**마지막 업데이트**: 2026-08-13 v2.0  
**상태**: ✅ 프로덕션 준비 완료

## 📋 프로젝트 개요

**Harness Engineering 6요소 구조**로 설계된 제주소금 AI 콘텐츠 생성 시스템입니다.
- 1️⃣ **spec**: 프로젝트 정의 & 원칙 (불변)
- 2️⃣ **skills**: 단일 책임 함수 (3개)
- 3️⃣ **agents**: Step 에이전트 (8개) + 조정자 (1개) + 마케터 가이드
- 4️⃣ **orchestrator**: 9단계 파이프라인 정의
- 5️⃣ **config**: 검증 규칙 & 설정
- 6️⃣ **hooks**: 마케터 검증 체크포인트 (4개)

**구현**은 `implementation/` 폴더에서 Node.js 백엔드 + React 프론트엔드로 진행됩니다.

### 주요 기술 스택
- **프론트엔드**: React 18, Tailwind CSS
- **백엔드**: Node.js/Express
- **데이터베이스**: Supabase (PostgreSQL)
- **AI 모델**: TimelyAI (solar-pro-4)
- **영상 생성**: Higgsfield CLI (로컬 인증, 매일 갱신)

---

## 📥 다운로드 & 폴더 설정 (매우 중요!)

### GitHub에서 ZIP 다운로드

```bash
# GitHub에서 "Code" → "Download ZIP"
# → jejusalt-brand-harness-main.zip 다운로드

# 압축 해제
unzip jejusalt-brand-harness-main.zip

# 폴더명 변경 (매우 중요!)
mv jejusalt-brand-harness-main harness

# 이제 harness 폴더 열면 (최상위에 Harness 요소들이 직접 보임):
cd harness
ls

# ⭐ Harness 요소들 (직접 보임):
# spec/             (← 스펙 & 원칙)
# skills/           (← 3개 Skill 정의)
# agents/           (← 4개 Agent 정의)
# orchestrator/     (← 9단계 파이프라인)
# config/           (← 검증 규칙 & 설정)

# 📁 주요 폴더들:
# implementation/   (← 백엔드 + 프론트엔드 + 데이터)
# docs/             (← 문서)
# supabase/         (← DB 설정)

# 📦 나머지:
# 기타/             (← legacy, package.json 등)
# README.md         (← 이 파일)
```

---

## 🚀 새 컴퓨터에서 처음 셋업하기

### 전제 조건

다음이 설치되어 있어야 합니다:
- **Node.js 18+** (https://nodejs.org)
- **Git** (https://git-scm.com)
- **npm** (Node.js와 함께 자동 설치됨)

### Step 1: 환경 변수 설정 (.env 파일)

`implementation/backend/` 폴더에 `.env` 파일을 생성하세요:

```bash
# Supabase 설정
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# TimelyAI API (백엔드)
TIMELY_AI_BASE_URL=https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai
TIMELY_AI_API_KEY=tgpt_sk_your_api_key_here

# 서버 설정
NODE_ENV=development
PORT=5000
HOST=localhost

# TimelyAI 모델 (이미 설정됨)
TIMELY_AI_MODEL=solar-pro-4

# 로깅
DEBUG=false
LOG_LEVEL=info
```

**⚠️ 주의**: `.env` 파일은 git에서 제외됩니다 (보안).

### Step 2: Higgsfield 로컬 인증 (매일 필요)

```bash
# 설치 (처음 1회만)
npm install -g @higgsfield/cli

# 로그인 (매일 필요)
higgsfield auth login
# → 브라우저에서 계정 로그인
```

### Step 3: 의존성 설치

```bash
# 백엔드
cd implementation/backend
npm install

# 프론트엔드 (다른 터미널)
cd implementation/frontend
npm install
```

### Step 4: Supabase 스키마 초기화

#### 4-1. 기본 테이블 생성
```bash
# Supabase 대시보드 → SQL Editor에서 supabase/migrations/ 의 SQL 실행
# → 7개 테이블 자동 생성됨
```

### Step 5: 서버 & 프론트엔드 시작

```bash
# 터미널 1: 백엔드
cd implementation/backend
npm start

# 터미널 2: 프론트엔드
cd implementation/frontend
npm start
```

**접속**:
- 백엔드: `http://localhost:5000`
- 프론트엔드: `http://localhost:3000`

---

## 📁 폴더 구조 이해하기

```
harness/                          ← 다운받은 폴더
│
├── 🏗️ HARNESS 6요소 (TOP-LEVEL) ⭐
│   ├── 1️⃣ spec/                (프로젝트 정의 & 원칙)
│   │   ├── spec.md
│   │   ├── brand-voice.md
│   │   └── PRD.md
│   ├── 2️⃣ skills/              (3개 Skill 정의)
│   ├── 3️⃣ agents/              (9개 Agent 정의)
│   │   ├── 0-master-orchestrator-agent.md (조정자)
│   │   ├── 1-resource-analyzer-agent.md (Step 1)
│   │   ├── 2-character-selector-agent.md (Step 2)
│   │   ├── 3-character-designer-agent.md (Step 3)
│   │   ├── 4-shortform-scenario-writer-agent.md (Step 4)
│   │   ├── 5-naming-generator-agent.md (Step 5)
│   │   ├── 6-product-writer-agent.md (Step 6)
│   │   ├── 7-compliance-reviewer-agent.md (Step 7)
│   │   ├── 9-post-generation-qa-agent.md (Step 9)
│   │   └── QA-AGENT.md (마케터 검증 가이드)
│   ├── 4️⃣ orchestrator/        (9단계 파이프라인)
│   │   └── orchestrator.md
│   ├── 5️⃣ config/              (검증 규칙 & 설정)
│   │   └── compliance-rules-v2.json (식품/뷰티/헬스 42개 항목)
│   └── 6️⃣ hooks/               (마케터 검증 체크포인트)
│       └── HOOKS.md (Hook 1~4 정의)
│
├── 🚀 implementation/            (실제 구현 코드)
│   ├── backend/                 (Node.js 서버)
│   │   ├── server.js
│   │   ├── agents/              (백엔드 에이전트 구현)
│   │   ├── routes/              (API 엔드포인트)
│   │   ├── config/
│   │   └── .env                 (환경변수 - 직접 작성)
│   ├── frontend/                (React UI)
│   │   ├── src/
│   │   └── public/
│   └── data/                    (자산)
│
├── 📚 docs/                     (프로젝트 문서)
├── 🗄️ supabase/                (Supabase DB 설정)
└── PROJECT_STRUCTURE.md         (전체 구조 상세 설명)
```

---

## 🎯 9단계 파이프라인

```
Step 1: 자료 분석
Step 2: 캐릭터 선택        [마케터 검토]
Step 3: 캐릭터 설계        [마케터 선택]
Step 4: 시나리오 작성      [마케터 검토]
Step 5: 영상 제목 생성     [마케터 선택]
Step 6: 카피 작성         [마케터 검토]
Step 7: 컴플라이언스 검토  (자동)
Step 8: 영상 생성         (Higgsfield CLI)
Step 9: 품질 검사 ⭐       (카테고리별 상세 검증)
        ↓
        ✅ 완료
```

---

## 🚀 주요 개선사항 (2026-08-13)

### A. Harness Engineering 구조화 ⭐
- 프로젝트 전체를 Harness 표준으로 정렬
- `harness/`: 정의 & 원칙 (불변)
- `implementation/`: 구현 코드 (변경)
- 파일 경로 재구성 및 문서화

### B. Step 9 품질 검사 v2.0 (카테고리별 검증) ⭐
- **식품** (14개 검증 항목)
  - Critical: 의약품 표현, 거짓 원산지, 부정확한 영양소
  - 경고: 할인율, 비교 표현, 제조 과정 투명성
- **뷰티** (13개 검증 항목)
  - Critical: 의약품 용어, 천연 인증, 성분 안전성
  - 경고: 부작용 미공시, 필터 미공시, 임상 근거 부족
- **헬스/영양제** (15개 검증 항목)
  - Critical: 의약품 효능, 기능식품 인증, 성분 정확성
  - 경고: 부작용 미공시, 의료 상담 부재, GMP 인증 부재

### C. TimelyAI 모델 업그레이드
- solar-pro-4 모델로 설정 완료
- 더 나은 응답 품질과 안정성

### D. 개발자 경험 개선
- PROJECT_STRUCTURE.md 작성 (전체 구조 설명)
- README.md 개선 (이 파일)
- QA-AGENT.md 작성 (마케터용 체크리스트)

---

## 🔧 필수 연동 설정 가이드

### 1️⃣ Higgsfield CLI (영상 생성) ⭐

**역할**: 시나리오를 바탕으로 실제 영상 생성 (Step 8)

#### 설치 (처음 1회)

```bash
npm install -g @higgsfield/cli
```

#### 로컬 인증 (매일 필요)

```bash
# 로그인 (아침에 1회)
higgsfield auth login
# → 브라우저에서 계정으로 로그인

# Workspace 설정 (처음 1회만)
higgsfield workspace list
higgsfield workspace set <workspace_id>

# 확인
higgsfield account status
```

#### ⚠️ 주의사항

- **매일 필요**: 24시간마다 `higgsfield auth login` 재실행
- **발표 당일**: 아침에 미리 로그인하세요
- **API KEY 불필요**: 로컬 CLI 인증 방식입니다

### 2️⃣ Supabase (데이터베이스) ⭐

**역할**: 제품 정보, 캐릭터, 시나리오, 메타데이터 저장

```bash
# 1. https://supabase.com → 계정 가입

# 2. 새 프로젝트 생성 후, Settings → API에서:
#    - Project URL → SUPABASE_URL
#    - anon key → SUPABASE_ANON_KEY
#    - service_role key → SUPABASE_SERVICE_KEY

# 3. SQL Editor에서 supabase/migrations/ SQL 실행
#    → 7개 테이블 생성됨
```

### 3️⃣ TimelyAI API (AI 모델) ⭐

**역할**: 캐릭터 설계, 시나리오, 카피 생성 (Step 3, 4, 5, 6)

```bash
# 1. https://timelygpt.co.kr → 계정 가입

# 2. API 키 발급 후 .env에 저장:
TIMELY_AI_API_KEY=tgpt_sk_your_key_here
TIMELY_AI_BASE_URL=https://hello.timelygpt.co.kr/api/v2/chat/bridge/openai
TIMELY_AI_MODEL=solar-pro-4  (이미 설정됨)
```

---

## 🧪 테스트 및 실행

### 서비스 상태 확인

```bash
# 헬스 체크
curl http://localhost:5000/health

# 응답:
# {
#   "status": "ok",
#   "env": {
#     "supabase": true,
#     "higgsfield": "CLI 로컬 인증 사용",
#     "timelyai": true
#   }
# }
```

### 전체 파이프라인 테스트 (Step 1~9)

```bash
# 프론트엔드에서 form 제출, 또는:
curl -X POST http://localhost:5000/api/generate/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "resourceName": "제주 바다의 미네랄",
    "category": "food",
    "highlights": ["미네랄 풍부"]
  }'
```

---

## 🧠 Harness 구조 이해하기

### 5분 입문

1. **spec.md 읽기** (프로젝트 정의)
   ```bash
   cat harness/spec/spec.md
   ```

2. **brand-voice.md 읽기** (브랜드 원칙)
   ```bash
   cat harness/spec/brand-voice.md
   ```

3. **orchestrator.md 읽기** (9단계 파이프라인)
   ```bash
   cat harness/orchestrator/orchestrator.md
   ```

4. **QA-AGENT.md 읽기** (Step 9 검증)
   ```bash
   cat harness/agents/QA-AGENT.md
   ```

---

## 📋 준비 체크리스트

```
✅ 폴더명 변경 (jejusalt-brand-harness-main → harness)
✅ harness/ 폴더 구조 확인
✅ .env 파일 생성 & 설정 (Supabase, TimelyAI API 키)
✅ higgsfield auth login 실행 (매일 필요)
✅ npm install (backend, frontend)
✅ npm start (backend, frontend)
✅ http://localhost:5000/health 테스트
✅ 문서 읽기 (harness/spec/, harness/agents/)
```

---

## 📚 추가 가이드

| 문서 | 내용 | 읽기 시간 |
|------|------|---------|
| `PROJECT_STRUCTURE.md` | 전체 구조 설명 | 20분 |
| `harness/spec/spec.md` | 기술 스펙 | 15분 |
| `harness/spec/brand-voice.md` | 브랜드 원칙 | 10분 |
| `harness/orchestrator/orchestrator.md` | 파이프라인 | 10분 |
| `harness/agents/QA-AGENT.md` | 품질 검사 | 20분 |

---

## 🐛 문제 해결

### "higgsfield: command not found"
→ `npm install -g @higgsfield/cli` 후 재시도

### "TIMELY_AI_API_KEY is required"
→ `.env` 파일의 TIMELY_AI_API_KEY 값 확인

### "Supabase 연결 실패"
→ `.env`의 SUPABASE_URL, SUPABASE_SERVICE_KEY 확인

### "backend/npm start 실패"
→ `npm install` 재실행, Node 버전 확인 (16+)

### "Step 7 컴플라이언스 검사 실패"
→ harness/config/compliance-rules-v2.json 로드 확인
→ 서버 재시작

---

## 👥 팀 연락처

- **박주미** (아키텍처): Harness 구조, 전체 방향
- **고수아** (마케팅): Step 3~6 검토, Step 9 수동 검증
- **개발팀**: implementation/ 코드 유지보수

---

## 📞 더 필요한 도움?

문제가 있으면 **자동으로 해결합니다!**

자동 문제 해결 기능:
- 스크립트 실행 실패 → 자동 진단 & 수정
- API 연동 문제 → 자동 디버깅
- 설정 오류 → 자동 검사 & 수정

---

**마지막 업데이트**: 2026-08-13 (Harness v2.0, Step 9 QA v2.0)  
**상태**: ✅ 프로덕션 준비 완료

---

# 📚 상세 워크플로우 가이드

## 🎬 영상 생성 전체 흐름

### **1️⃣ 마케터 입력 → Step 1: 자료 분석**

**마케터가 입력하는 정보**:
```json
{
  "productName": "제주 소금",
  "productInfo": "제주 바다에서 채취한 천연 미네랄 소금...",
  "keywords": ["제주산", "미네랄", "건강"],
  "category": "food"
}
```

**Step 1에서 일어나는 일**:
1. `TimelyAI (upstage/solar-pro4)` 호출
2. 자동으로 추출되는 메타데이터:
   ```
   - 제품 카테고리 (식품/뷰티/헬스)
   - 타겟층 분석 (40~60대 여성)
   - 마케팅 톤 파악 (신뢰, 자연)
   - 강조할 특성 (미네랄, 건강)
   ```
3. `Supabase resources` 테이블에 저장

---

### **2️⃣ Step 2: 캐릭터 추천 (8명 중 3명)**

**기본 캐릭터 라이브러리** (변경 불가):
```
결이      (점수: 9.5)   - 긍정적 소년, 밝은 미네랄
용암이    (점수: 8.8)   - 신비로운 제주, 검은 현무암
해수      (점수: 8.2)   - 따뜻한 바다, 푸른색
미내      (점수: 9.1)   - 활발한 여신, 맑은 물
현무      (점수: 8.7)   - 든든한 가디언, 검은색
가마할방  (점수: 8.0)   - 지혜로운 할머니, 따뜻함
불이      (점수: 8.3)   - 열정적 청년, 주황색
한라      (점수: 8.9)   - 신성한 산, 흰색
```

**스코어링 방식**:
```
점수 = (카테고리 일치도 × 40%)
     + (타겟층 일치도 × 40%)
     + (톤 어울림 × 20%)
```

**결과**: Top 3 캐릭터 추천

---

### **3️⃣ Step 3: 캐릭터 설계 + Reference Image 생성 ⭐**

**이 단계가 핵심입니다!**

#### **3-1: 캐릭터 상세 프롬프트 생성**

TimelyAI에서 생성:
```
캐릭터명: 결이
성격: 꿈과 희망으로 가득 찬 당찬 소년
외형: 작은 소금 결정 형태, 밝은 흰색, 반짝이는 질감
말투: 희망적이고 정직함, 부드럽지만 당당함
주요 표현: "우리 함께라면", "작지만 중요함"
배경: 제주 바다, 햇빛
```

#### **3-2: Reference Image 생성** 🎨

```javascript
// Higgsfield text2image_soul_v2 모델 사용
const refImagePrompt = `
캐릭터명: 결이
외형 설명: 작은 소금 결정 형태, 밝은 흰색, 반짝이는 질감,
          제주 바다 배경, 햇빛, 미네랄 입자
표정: 희망적이고 따뜻한 미소
감정: 정직하고 진실함
분위기: 자연스럽고 신뢰할 수 있는
`;

// 생성됨: reference_image_url
// 예: https://s3.amazonaws.com/higgsfield/.../character_001.png
```

**Reference Image는**:
- ✅ 모든 Step에서 재사용됨
- ✅ Hook 1에서 마케터가 검토함
- ✅ Step 8 (Higgsfield 영상 생성)의 `--start-image`로 사용됨
- ✅ 최종 영상에서 캐릭터 일관성 유지

#### **3-3: Hook 1 승인**

```
마케터 검토:
□ 이 캐릭터가 제품(제주 소금)과 맞는가?
□ 표정이 신뢰감을 주는가?
□ 제주의 정체성이 잘 표현됐는가?

선택지:
○ 승인 → Step 4 진행
○ 수정 요청 → "더 밝게", "더 활발하게" 등
○ 반려 → Step 2로 돌아가 다른 캐릭터 선택
```

---

### **4️⃣ Step 4: 시나리오 작성**

**15초 영상의 스토리 구성**:

TimelyAI가 생성:
```json
{
  "title": "제주 바다의 결정",
  "story": "제주 바다에서 태어난 작은 결정들의 이야기...",
  "acts": [
    {
      "duration_seconds": 2,
      "description": "오프닝: 제주 바다 풍경",
      "visual_cues": "파도, 햇빛, 미네랄 입자"
    },
    {
      "duration_seconds": 10,
      "description": "메인: 결이가 제주 소금의 가치를 설명",
      "visual_cues": "결이 캐릭터, 소금 결정, 미네랄"
    },
    {
      "duration_seconds": 3,
      "description": "클로징: 밥상 위의 소금",
      "visual_cues": "가족 식탁, 따뜻한 조명"
    }
  ],
  "total_duration": 15
}
```

#### **Hook 2 승인**

```
검증:
□ 총 길이가 정확히 15초인가?
□ 시작과 끝이 자연스러운가?
□ 제주 소금의 가치가 잘 표현되었는가?
□ 브랜드 톤(정직함, 따뜻함)과 맞는가?

선택지:
○ 승인 → Step 5 진행
○ 수정 요청 → "더 빠르게", "가족 씬 추가" 등
○ 반려 → Step 3으로 돌아가 캐릭터 재설계
```

---

### **5️⃣ Step 5: 영상 제목 생성**

TimelyAI가 3개 생성:
```
1️⃣ "제주 바다의 결정"
   의미: 자연과 인간이 만드는 작은 기적
   점수: 9.2/10

2️⃣ "소금 한 알의 이야기"
   의미: 소수자의 가치를 담다
   점수: 8.7/10

3️⃣ "밥상 위의 제주"
   의미: 일상이 되는 특별함
   점수: 8.4/10
```

#### **Hook 3: 제목 선택**

```
마케터: "제목 1번 선택"
자동진행 (AI 추천 사용): 가장 높은 점수(9.2) 자동 선택
```

---

### **6️⃣ Step 6: 카피 작성**

TimelyAI가 생성:
```
제목: "제주 바다의 결정"

카피:
"제주의 용암해수에서 탄생한 소금입니다.
70년 기술력으로 조절된 나트륨·마그네슘 비율.
밥상 위의 작은 결정이, 우리 가족의 맛을 더합니다."

(금지: 의약품 표현, 과장, 거짓 주장)
```

#### **Hook 4: 카피 승인**

```
검증:
□ brand-voice 원칙(정직, 따뜻, 제주) 준수?
□ 의약품 표현 없는가?
□ 과장 없는가?
□ 40~60대가 공감할 언어인가?

선택지:
○ 승인 → Step 7 진행
○ 수정 요청 → "더 강조해주세요"
○ 반려 → Step 4로 돌아가 시나리오 재작성
```

---

### **7️⃣ Step 7: 컴플라이언스 검증**

**자동 검증** (Phase 1):

```
카테고리: 식품

금지 키워드 스캔:
✓ "치료" - 없음 ✅
✓ "완치" - 없음 ✅
✓ "약효" - 없음 ✅
✓ "질병 예방" - 없음 ✅
...

결과: 
✅ APPROVED → Step 8 진행
⚠️ WARNING → 마케터 수동 검토 (Phase 2)
❌ REJECTED → Step 6으로 돌아가 카피 재작성
```

**마케터 수동 검증** (Phase 2):

```
🍳 식품 카테고리 (14개 항목):

[ ] 1. 의약품 표현 없는가?
[ ] 2. 원산지 명시 정확한가? (인증서 확인)
[ ] 3. 영양소 수치 정확한가? (검사 성적서)
[ ] 4. 위생 기준 충족?
[ ] 5. 할인율 과장 없는가?
[ ] 6. 거짓 비교광고 없는가?
[ ] 7. 제조 과정 투명하게 표현?
[ ] 8. 취약층 주의사항?
[ ] 9. 환경 관련 표현 사실인가?
[ ] 10. 가격 표현 공정한가?
[ ] 11. 사용방법 명확한가?
[ ] 12. 리뷰 기반 표현 사실인가?
[ ] 13. 원산지 이미지 일치?
[ ] 14. 기타 우려사항?
```

---

### **8️⃣ Step 8: Higgsfield로 실제 영상 생성**

```bash
higgsfield generate create seedance_2_0 \
  --prompt "
    [캐릭터]: 결이 (참고이미지: {reference_image_url})
    [말투]: 희망적이고 정직함
    [스크립트]: 제주의 용암해수에서 탄생한 소금입니다...
    [시나리오]:
      - 2초: 제주 바다 풍경
      - 10초: 결이가 카피 말하기
      - 3초: 밥상 위의 소금
    [배경음]: 따뜻한 피아노 음악
    [효과]: 미네랄 입자, 햇빛
  " \
  --duration 15 \
  --resolution 720p \
  --start-image {reference_image_url} \
  --wait
```

**출력**:
```
✅ 영상 생성 완료!
📹 비디오: https://higgsfield.com/output/video_12345.mp4
⏱️ 길이: 15초
📐 해상도: 720p
🎬 캐릭터: 결이 (Reference Image 기반, 일관성 100%)
```

---

### **9️⃣ Step 9: QA 검증**

#### **Phase 1: 자동 검증**

```
금지 키워드 재확인:
✓ 시나리오, 카피, 자막 모두 검사

결과:
✅ PASS_AUTO → 완료!
⚠️ WARNING → Phase 2 필요
❌ REJECTED → Step 6으로 돌아가기
```

#### **Phase 2: 마케터 수동 검증**

```
영상 재생 후 확인:

[ ] 캐릭터가 의도대로 표현됐는가?
[ ] 카피가 명확하게 전달되는가?
[ ] 길이가 정확히 15초인가?
[ ] 배경음악이 어울리는가?
[ ] 색감과 조명이 적절한가?
[ ] 법적 문제 없는가?

기본 14~15개 항목 + 추가 확인
```

#### **Phase 3: 최종 판정**

```
✅ PASS: 모든 검증 완료
   → 콘텐츠 배포 준비 완료!

⚠️ WARNING: 경고 수준
   → 마케터 확인 후 배포 결정

❌ REJECTED: 불통과
   → Step 6으로 돌아가 카피 재작성
```

---

## 🎨 캐릭터 & 이미지 시스템 상세 설명

### **3가지 이미지 타입**

#### **1️⃣ 고정 캐릭터 이미지** (변경 불가)

```
저장위치: config/config.json
예시:
{
  "name": "결이",
  "visualIdentity": "작은 소금 결정 형태, 밝은 흰색",
  "toneTrait": "희망적이고 정직함",
  "reference_image_url": "https://s3.../character_001.png"
}

특징:
- 프로젝트마다 동일한 8명
- 각 캐릭터마다 고정된 참고 이미지
- 변경 시 모든 영상에 영향
- 브랜드 일관성의 핵심
```

#### **2️⃣ Reference Image** (Step 3에서 생성)

```
생성방식:
1. Step 3에서 TimelyAI 프롬프트로 캐릭터 상세 결정
2. Higgsfield text2image_soul_v2 모델로 이미지 생성
3. Supabase character_library.reference_image_url에 저장
4. Hook 1에서 마케터가 검토

사용처:
- 마케터 검토 (Hook 1)
- Step 4~7 진행 중 참고
- Step 8 Higgsfield의 --start-image

예시:
reference_image_url = "https://higgsfield.com/.../ref_image_12345.png"
```

#### **3️⃣ 최종 영상의 캐릭터**

```
생성방식:
Step 8: Higgsfield --start-image {reference_image_url}

특징:
- Reference Image를 기반으로 생성
- 모든 씬에서 동일한 캐릭터 유지
- 시나리오와 자연스럽게 조화
- 최종 결과물에 포함된 캐릭터

예:
영상에 등장하는 "결이"는
Reference Image의 스타일을 유지하면서도
시나리오의 각 씬에 맞게 표현됨
```

### **이미지 흐름 다이어그램**

```
Step 2: 기본 8개 캐릭터 추천
    ↓
    마케터: "결이 선택"
    ↓
Step 3: 결이의 Reference Image 생성
    ↓
    Higgsfield text2image_soul_v2
    프롬프트: "결이, 밝은 흰색, 소금 결정 형태..."
    ↓
    생성됨: reference_image_url
    ↓
Hook 1: 마케터가 Reference Image 검토
    ↓
    ○ 승인 → reference_image_url 확정
    ○ 수정 → 프롬프트 조정 후 재생성
    ○ 반려 → Step 2로 돌아가 다른 캐릭터 선택
    ↓
Step 4~7: reference_image_url 참조
    ↓
Step 8: Higgsfield 영상 생성
    ↓
    higgsfield generate create seedance_2_0 \
      --start-image {reference_image_url}
    ↓
    생성됨: 15초 영상 (일관된 캐릭터)
    ↓
최종 영상 완성 ✅
    - 캐릭터 일관성 100%
    - Reference Image 스타일 유지
```

---

## 🔗 Harness 6요소 실전 예제

### **예제: "제주 소금" 영상 제작**

| 요소 | 파일 | 역할 |
|------|------|------|
| **spec** | `spec/spec.md` | "AI가 생성한 모든 콘텐츠는 brand-voice 3원칙을 따라야 한다" (정의) |
| **spec** | `spec/brand-voice.md` | "정직하게, 과장 없이" (원칙 1) |
| **skills** | `SKILL_character-designer.md` | 캐릭터 설계의 단일 책임 |
| **agents** | `character-designer-agent.md` | 위 Skill을 실행하는 Agent (Step 3) |
| **orchestrator** | `orchestrator.md` | "Step 3 → Hook 1 → Step 4" (흐름) |
| **hooks** | `hooks/HOOKS.md` | "Hook 1: 마케터가 Reference Image 검토" |
| **config** | `compliance-rules-v2.json` | "식품: 의약품 표현 금지" (규칙) |

---

## 📊 Step별 에이전트 & Skill 매핑

```
┌─────────────┬─────────────────────┬──────────────────────────────┐
│ Step        │ Agent               │ Skill / 처리                 │
├─────────────┼─────────────────────┼──────────────────────────────┤
│ 1           │ Resource Analyzer   │ 메타데이터 추출 (TimelyAI)    │
│ 2           │ Character Selector  │ 캐릭터 스코어링 (알고리즘)   │
│ 3           │ Character Designer  │ Character Designer Skill     │
│             │                     │ + Reference Image 생성       │
│ 🎣 Hook 1  │ -                   │ 마케터 검토                  │
│ 4           │ Scenario Writer     │ Shortform Scenario Skill     │
│ 🎣 Hook 2  │ -                   │ 마케터 검토                  │
│ 5           │ Naming Generator    │ Naming Generator Skill       │
│ 🎣 Hook 3  │ -                   │ 마케터 선택 (3개 중 1개)     │
│ 6           │ Product Writer      │ TimelyAI 카피 작성           │
│ 🎣 Hook 4  │ -                   │ 마케터 검토                  │
│ 7           │ Compliance Reviewer │ 규칙 기반 검증               │
│ 8           │ -                   │ Higgsfield CLI 영상 생성     │
│ 9           │ QA Agent            │ Phase 1,2,3 검증             │
└─────────────┴─────────────────────┴──────────────────────────────┘
```

---

## 💾 데이터 저장 구조

```
Supabase (또는 Mock 모드):

resources 테이블
├─ id: "res_12345"
├─ product_name: "제주 소금"
├─ product_info: "제주 바다에서..."
├─ metadata: {
│   categories: ["식품"],
│   ageGroups: ["40~60대"],
│   focus: ["자연", "건강"]
│ }
├─ reference_image_url: "https://..."  ← Step 3 Reference Image
├─ status: "complete"
└─ created_at: "2026-08-13T..."

character_library 테이블
├─ id: "char_001"
├─ character_name: "결이"
├─ visual_description: "소금 결정 형태..."
├─ reference_image_url: "https://..."  ← 기본 이미지 (고정)
└─ generation_count: 42  ← 몇 개 제품에 사용됐는가

generation_logs 테이블
├─ resource_id: "res_12345"
├─ step: 3
├─ action: "character_design"
├─ status: "completed"
├─ marketer_approval: true  ← Hook 1 승인됨
└─ ai_recommendation: {...}

videos 테이블 (Step 8 후)
├─ video_id: "vid_12345"
├─ video_url: "https://higgsfield.com/.../video.mp4"
├─ resource_id: "res_12345"
├─ character_id: "char_001"
├─ reference_image_url: "https://..."  ← Step 3 이미지 사용
└─ created_at: "2026-08-13T..."
```
