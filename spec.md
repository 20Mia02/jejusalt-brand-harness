# spec.md — 제주소금 AI 브랜드 콘텐츠 하네스 공식 스펙

**프로젝트명**: 제주소금 — AI 기반 브랜드 콘텐츠·디지털 마케팅 고도화  
**팀**: 으랏차차 짠돌(石)이네 (박주미·고수아)  
**작성일**: 2026.08.03  
**버전**: v1.0 확정본  
**마감**: 2026.08.06(목) 18:00까지 제출  
**발표**: 2026.08.07(금) 10분 (6분 발표 + 4분 QnA)

---

## 📌 목표

제주소금의 **일관되지 않은 마케팅 콘텐츠 생산 체계**를 다음 두 가지로 해결한다:

1. **AI Harness (TimelyAI 등록)**: Skill/Subagent/Orchestrator 구조로 **5가지 콘텐츠(캐릭터, 숏폼, 네이밍, 제품 소개, 상세페이지)를 자동 반복 생산**하는 에이전트 체계
2. **웹앱 (Claude Code)**: 제주소금 직원이 매일 아침 자료 업로드하면, 자동 카테고리화 → 관리자 승인 → 캐릭터+영상 유형 선택 → 스토리 자동 추천 → 확정 → Higgsfield 자동 영상화까지 모두 "클릭 몇 번"으로 가능한 실제 운영 도구

이를 통해 제주소금이 **현재 월 1~2편의 콘텐츠를 월 4회 사이클로 반복 생산**할 수 있는 "스스로 동작하는 콘텐츠 기계"를 구축한다.

---

## 🎯 맥락 (Context)

### 대상 기업: 주식회사 제주소금

**기업 개요**:
- 창립: 2025년 3월 (신생 스타트업)
- 대표: 고경민
- 핵심 기술: 용암해수 기반 미네랄 조절 기술 (70년 누적 기술)
- 기술력: 나트륨 24.1g/100g(일반 소금 대비 40% 감소), 마그네슘 6,370mg/100g(경쟁사 대비 최고)
- 현재 제품: 제주용암소금(7,000원), 프리미엄솔트(8,000원), 톳소금(12,000원) 3가지 B2C
- 사업 우선순위: 뷰티(1순위) > 헬스케어(2순위) > 식품(3순위)

### 현재 문제점

#### 1. 콘텐츠 생산 프로세스의 비체계성
제주소금의 기술력(용암해수 미네랄, 나트륨↓마그네슘↑, 40만년 화산지형)은 매력적이지만:
- **일관된 브랜드 톤, 캐릭터, 스토리라인 없이** 각자 다른 방식으로 표현
- 숏폼·소개서·SNS·상세페이지 모두 톤·메시지·비주얼이 제각각
- 브랜드 신뢰도가 누적되지 않고 매번 "처음 만나는 기업" 취급
- **"한 번 만들고 끝"** 구조로, 주간·월간 반복 생산 기준 없음

현재: 월 1~2편만 가능 (인력·비용 부담)  
필요: 월 4회 사이클 가능 (반복 생산 체계)

#### 2. 콘텐츠 공급 부재 & 채널별 별도 제작의 악순환

**현재 상황**:
- **대부분의 채널에서 콘텐츠가 아예 없거나 매우 부족한 상태** (SNS, 숏폼, 상세페이지 등)
- 콘텐츠를 새로 만든다 해도 **각 채널별로 "따로따로" 제작**해야 하는 구조
- 채널별로 각각 만들다 보니: 개당 100~200만원 수준의 **시간 투입 대비 비용 부담이 매우 큼**
- 특히 숏폼 영상은 제작 크루 필요로 **월 1~2편만 가능** (정기적 콘텐츠 불가)
- **경쟁사는 이미 SNS·숏폼 마케팅을 강화 중** → 제주소금의 뒤처짐 심화

**결과**:
- 대중들이 "제주소금이란 뭐지?"를 반복적으로 만나지 못함 (인지도 부족)
- 인력 부족으로 주기적 업데이트 불가능
- 각 채널에서 제각각 표현되거나, 아예 없어서 브랜드 메시지 전달 실패

#### 3. 사업 우선순위(뷰티)와 포커스(식품) 간의 정렬
- 기업 본래 우선순위: 뷰티(1) > 헬스케어(2) > 식품(3)
- 이번 프로젝트: 식품(관광상품) 포커스
- 전략: **단기(3개월) 식품 → 중기(6~12개월) 뷰티·헬스케어 확장**
- 같은 자동화 구조를 뷰티·헬스케어에도 쉽게 확장 가능하도록 설계 필수

### 시장 기회: 타겟층 니즈 & 채널 현황

**타겟 고객과 채널**:
- **주 타겟**: 40~60대 여성 (제주 관광객, 선물 구매자)
- **확장 타겟**: 20~30대 (온라인·SNS 중심)
- **채널**: 관광지 체험·굿즈 판매(오프라인), **숏폼 영상**(유튜브 쇼츠·릴스·TikTok), 상세페이지(쿠팡·마켓컬리 등)

**시장 규모 & 수요**:
- **프리미엄 소금 시장**: 국내 736억원 규모
- **나트륨 과다섭취 이슈**: 한국인 1일 3,699mg vs WHO 권고 2,000mg (소비자 니즈 상승중)
- **제주 관광**: 연 1,378만명 방문 (오키나와 벤치마킹: 소금 관광상품화 가능)

**필요한 접근**: 
이 모든 채널에서 동시에 "제주소금이란 무엇인가"를 **일관되고 반복적으로, 저비용으로** 대중에게 전달해서 **브랜드 인지도를 높이고 쉽게 다가가야 함**. 특히 **숏폼 등의 쉬운 접근성**이 중요.

**기술 기회**: 
TimelyAI(자동화) + Higgsfield(영상화)가 성숙해서 최소 인력으로 최대 생산 가능한 시점

### 우리의 해결안: 자동화 Harness + 웹앱으로 "대중 인지도 상승" 실현

**문제**: 콘텐츠가 없거나 채널별로 따로 만들어야 해서 비용·시간 상당 → 대중 인지도 낮음, 숏폼·SNS 등에서 경쟁사에 밀림

**해결**:
제주소금 마케팅 담당자가 매일 아침 **제품 정보만 입력**하면, 자동화 Harness가:
- 브랜드 톤(brand-voice.md 3원칙)에 맞는 **캐릭터 설정 자동 제안**
- **숏폼 시나리오 자동 생성** (유튜브 쇼츠, 릴스, TikTok용)
- 제품 소개서·상세페이지 **자동 작성** (쿠팡, 마켓컬리 등)
- **Higgsfield 연동으로 스토리 확정 즉시 영상화** → 숏폼 완성

**결과**:
- **월 1~2편 → 월 4회 사이클** (주간 주기로 새로운 콘텐츠 공급)
- **개당 비용 1/10 이하** (인력 투입 최소화)
- **대중들이 반복적으로 "제주소금"을 만나게 됨** → 브랜드 인지도 상승
- **숏폼·SNS·상세페이지에서 일관된 메시지** → 신뢰도 구축
- **경쟁사 대비 콘텐츠 주기 압도적 우위** (월 4회 vs 월 1~2회)

---

## 📐 범위 (Scope)

### 포함 (Include)

**콘텐츠 Harness (TimelyAI 등록)**:
- Skill 5개: character-designer, shortform-scenario-writer, naming-generator, product-intro-writer, product-detail-page-writer
- Subagent 7개: 위 5개 각각 1개 + compliance-reviewer-agent + orchestrator
- brand-voice.md (톤앤보이스 3원칙 + 절대 금지 사항 + 8개 캐릭터 세부 정의)
- character-concept.md (캐릭터 1세대 설정: 결이·용암이·해수 등)

**웹앱 프로토타입 (Claude Code)**:
- 기능 1: 자료 업로드 & 자동 정리 (카테고리 태깅)
- 기능 2: 사업영역별 카테고리 뷰 (뷰티/헬스케어/식품, 식품 기본 활성)
- 기능 3: 관리자 모드 (자료 편집, 비밀번호 보호)
- 기능 4: 캐릭터 + 자료 + 영상유형 선택 → 스토리 추천 → Higgsfield 연동
- 서브에이전트 3개: database-agent, backend-agent, frontend-agent

**검증 및 산출물**:
- 콘텐츠 5개(캐릭터·시나리오·네이밍·제품소개·상세페이지) 실행 결과
- 힉스필드 데모 영상 1편 (15~30초)
- GitHub 브랜치별 커밋 + PR + 최종 머지
- 발표 자료 및 TimelyAI 캡처

### 제외 (Exclude)

- 실제 사진·영상 촬영, 완제품 인쇄용 최종 디자인 파일
- 법적 성분·효능 검증 (표현 안전성 체크까지만)
- B2B 제안자료, 지면·옥외 광고물 (시간 남을 경우 확장)
- 웹앱 기능 5(추가 확장) — Day3에 여유 있으면 추가하는 것으로
- 복잡한 에러 핸들링, UI 애니메이션 등 정교한 기능 (프로토타입 수준으로만)

---

## ⚙️ 제약 (Constraints)

### 시간 제약
- **긴급성**: 매우 높음 (4영업일 내 완성)
- **마감**: 2026년 8월 6일(목) 18:00까지 발표 자료 제출
- **실작업**: 8/3(월)~8/5(수) 3일 + 8/6(목) 발표

### 기술 제약
- **사용 도구**: Claude Pro + TimelyAI + Higgsfield + GitHub + Google Drive (무료 도구 조합)
- **Claude Code**: Claude.ai 채팅만으로도 가능하나, 웹앱은 Claude Code 권장
- **Higgsfield 크레딧**: 프로토타입 목적이므로 15초 1개만 생성 (예산 제약)

### 인력 제약
- **2인 1팀**: 브랜드 라인 담당자 1명 + 제품 라인 담당자 1명
- **역할 분담 필수**: GitHub 브랜치 병렬 작업으로 효율성 극대화

### 표현 제약 (brand-voice.md 기반)
- **정직하게, 과장 없이**: 근거 없는 의학적 표현 절대 금지 ("혈압을 낮춘다" X)
- **제주와 기술의 만남**: "기적의 소금" 같은 과장 금지, 70년 기술이라는 사실 항상 명시
- **일상 속 소소한 함께함**: 거창한 건강 이야기보다 "우리 가족 밥상" 프레임
- **절대 금지**: 근거 없는 의학 표현, 과도한 유행어, 자극적 비교, 세상을 바꿀 듯한 표현

### 식품표시·광고법 준수
- 모든 콘텐츠에서 근거 없는 효능 표현 검증 (claim-safety-checker)
- 기업 제공 자료(제품 스펙, 성분, 인증) 근거만 사용
- 불명확한 표현은 "확인 필요" 태그 표시

---

## 📤 출력 형식 (Output Format)

### 1. 콘텐츠 Harness (TimelyAI 등록)

| 산출물 | 형식 | 저장소 |
|---|---|---|
| SKILL_character-designer.md | 마크다운 (입력·출력·지침 정의) | GitHub `/skills/` |
| SKILL_shortform-scenario-writer.md | 마크다운 | GitHub `/skills/` |
| SKILL_naming-generator.md | 마크다운 | GitHub `/skills/` |
| SKILL_product-intro-writer.md | 마크다운 | GitHub `/skills/` |
| SKILL_product-detail-page-writer.md | 마크다운 | GitHub `/skills/` |
| SKILL_claim-safety-checker.md | 마크다운 (검증용) | GitHub `/skills/` |
| agents/ (7개 Subagent 정의) | 마크다운 | GitHub `/agents/` |
| brand-voice.md | 마크다운 (톤앤보이스 완전 정의) | GitHub `/` |
| character-concept.md | 마크다운 (캐릭터 설정 초안) | GitHub `/drafts/` |

### 2. 웹앱 (Claude Code)

| 산출물 | 형식 | 저장소 |
|---|---|---|
| UploadCategorizer.jsx | React 컴포넌트 | GitHub `/webapp/components/` |
| CategoryTabs.jsx | React 컴포넌트 | GitHub `/webapp/components/` |
| AdminMode.jsx | React 컴포넌트 | GitHub `/webapp/components/` |
| StoryToVideoFlow.jsx | React 컴포넌트 | GitHub `/webapp/components/` |
| App.jsx | React 통합 파일 | GitHub `/webapp/` |
| data-schema.md | 데이터 구조 정의 | GitHub `/` |

### 3. 검증 및 최종 산출물

| 산출물 | 형식 | 저장소 |
|---|---|---|
| TimelyAI 에이전트 등록 화면 캡처 | PNG (`팀명_타임리_자동화_에이전트.png`) | Google Drive `/05_제출용_최종/` |
| 힉스필드 데모 영상 | MP4 (15~30초) | Google Drive `/03_higgsfield_시안/` |
| 발표 자료 | PPT / PDF | Google Drive `/04_발표자료/` |
| 최종 Harness 폴더 | ZIP (`jejusalt-brand-harness.zip`) | Google Drive `/05_제출용_최종/` |

### 4. GitHub 폴더 구조

```
jejusalt-brand-harness/
├─ spec.md                              ← 이 파일
├─ brand-voice.md                       ← 톤앤보이스 완전 정의
├─ data-schema.md                       ← 웹앱 데이터 구조
├─ skills/
│  ├─ SKILL_character-designer.md
│  ├─ SKILL_shortform-scenario-writer.md
│  ├─ SKILL_naming-generator.md
│  ├─ SKILL_product-intro-writer.md
│  ├─ SKILL_product-detail-page-writer.md
│  └─ SKILL_claim-safety-checker.md
├─ agents/
│  ├─ character-designer-agent.md
│  ├─ shortform-scenario-writer-agent.md
│  ├─ naming-generator-agent.md
│  ├─ product-intro-writer-agent.md
│  ├─ product-detail-page-writer-agent.md
│  ├─ compliance-reviewer-agent.md
│  └─ orchestrator.md
├─ drafts/
│  ├─ brand-voice_v1.0.md
│  ├─ character-concept_v1.0.md
│  ├─ product-intro_v1.0.md
│  └─ product-detail-page_v1.0.md
├─ data/
│  └─ jejusalt_제품정보_템플릿.csv
├─ webapp/
│  ├─ components/
│  │  ├─ UploadCategorizer.jsx
│  │  ├─ CategoryTabs.jsx
│  │  ├─ AdminMode.jsx
│  │  └─ StoryToVideoFlow.jsx
│  └─ App.jsx
├─ .claude/
│  └─ agents/
│     ├─ backend-agent.md
│     ├─ frontend-agent.md
│     └─ database-agent.md
├─ role-table.md
├─ workflow.md
├─ hooks/
│  └─ manual-checklist.md
└─ README.md
```

---

## ✅ 성공 기준 (Success Criteria)

### 콘텐츠 Harness (Skill 5개 + Agent 7개)

- [ ] **character-designer** TimelyAI 등록 완료 + 1회 실행 (캐릭터 1종 완성)
- [ ] **shortform-scenario-writer** TimelyAI 등록 완료 + 1회 실행 (시나리오 1편 완성)
- [ ] **naming-generator** TimelyAI 등록 완료 + 1회 실행 (네이밍 후보 3개 완성)
- [ ] **product-intro-writer** TimelyAI 등록 완료 + 1회 실행 (제품 소개서 1종 완성)
- [ ] **product-detail-page-writer** TimelyAI 등록 완료 + 1회 실행 (상세페이지 초안 완성)
- [ ] **claim-safety-checker** TimelyAI 등록 완료 + 모든 콘텐츠 5개 검증 (과장 표현 0개, 모두 Pass)
- [ ] **orchestrator** TimelyAI 등록 완료 + 전체 파이프라인 1회 실행 (에러 0개)
- [ ] 모든 Skill이 brand-voice.md 3원칙 준수하는지 검증됨
- [ ] 모든 Skill의 절대 금지 사항 위반 0개

### 웹앱 프로토타입 (기능 1~4)

**기능 1: 자료 업로드 & 자동 정리**
- [ ] 텍스트 자료 입력 가능한 UI 있음 (텍스트박스 또는 CSV 업로드)
- [ ] 자동 카테고리 태깅 작동 (정확도 80% 수준)
- [ ] 사용자가 카테고리 수정 가능
- [ ] window.storage에 데이터 저장됨

**기능 2: 카테고리 뷰**
- [ ] 3개 탭 표시 (뷰티/헬스케어/식품)
- [ ] 식품 탭이 기본 활성화
- [ ] 탭 클릭 시 해당 카테고리의 자료만 필터링됨

**기능 3: 관리자 모드**
- [ ] 비밀번호 입력 후 로그인 가능
- [ ] 자료 편집 가능 (텍스트 수정)
- [ ] 저장 후 기능 2의 뷰에 즉시 반영

**기능 4: 스토리 추천 & Higgsfield 연동**
- [ ] 캐릭터 선택 가능 (8개 중 택1)
- [ ] 자료 선택 가능 (기능 2 목록 중 택1)
- [ ] 영상유형 선택 가능 (3~4가지)
- [ ] "스토리 추천" 버튼 클릭 시 스토리 텍스트 생성·표시됨
- [ ] 사용자가 스토리 수정 가능
- [ ] "확정" 버튼 클릭 → Higgsfield 연동 시작
- [ ] 영상 생성 완료 시 "준비됨" 알림

**전체 통합**
- [ ] 4개 기능을 "처음부터 끝까지" 한 번에 클릭해서 작동
- [ ] 심각한 버그 없음 (UI 미세한 오류는 무시)
- [ ] 실제 데이터(어제 만든 캐릭터·제품 정보)가 화면에 표시됨

### Higgsfield 데모 영상

- [ ] 웹앱 기능 4에서 나온 스토리 → Higgsfield 프롬프트 변환 완료
- [ ] Higgsfield 영상 1편 생성 완료 (15~30초)
- [ ] Google Drive `/03_higgsfield_시안/` 폴더에 저장됨

### 최종 검증

- [ ] brand-voice 일관성: 모든 콘텐츠 5개가 3원칙 준수
- [ ] claim-safety-checker: 모든 콘텐츠에서 "과장 표현" 0개
- [ ] GitHub: 모든 파일 `main` 브랜치에 머지 완료
- [ ] 발표 자료: PPT/PDF 완성, 리허설 완료 (6분 분량)
- [ ] TimelyAI 캡처: 자동화 에이전트 화면 캡처본 확보

---

## 🎯 Day별 마일스톤

| 날짜 | 목표 | 완료 기준 |
|---|---|---|
| **8/3(월)** | 콘텐츠 Harness 완성 + TimelyAI 등록 | Skill 5개 + Agent 7개 TimelyAI 등록 완료 + 검증 Pass |
| **8/4(화)** | 웹앱 프로토타입 완성 + Higgsfield 데모 | 기능 1~4 모두 작동 + 영상 1편 생성 |
| **8/5(수)** | UI 다듬기 + 최종 검수 + 발표 준비 | 발표 자료 PPT 완성 + 리허설 |
| **8/6(목)** | 발표 + 제출 | 18:00~19:00 제출 완료 + 발표 |

---

## 🚨 주요 리스크 및 완화 전략

### Risk 1: 콘텐츠 Skill 타이밍 압박 (Day1 17:30까지 7개 등록)

**리스크**: 5개 Skill 작성 + 검증 + TimelyAI 등록이 4시간 45분 안에 끝나지 않을 수 있음

**완화 전략**:
- Skill 작성은 claude.ai Artifacts에서 "뼈대(5분) → 프롬프트 작성(5분) → 실행 및 결과(10분)" 패턴 반복
- TimelyAI 업로드는 각 Skill 완성 직후 바로 (3분 × 5개 = 15분)
- 네트워크 지연 대비 여유시간 5~10분 예비 준비
- compliance-reviewer + orchestrator는 마지막에 순차 진행

### Risk 2: 웹앱 4개 기능 내일 완성 불가능 (Day2 16:00까지)

**리스크**: 웹앱 구조의 복잡성 → 실제 구현이 예상보다 오래 걸림

**완화 전략**:
- **프로토타입이 정의의 핵심**: "완벽한 기능"이 아니라 "작동하는 프로토타입"만 필수
- 에러 핸들링은 완전히 스킵 (에러 나도 일단 진행)
- 다중 계정, 복잡한 UI 애니메이션 등은 Day1에 사전에 제거
- 각 기능별로 "프로토타입 범위" 명시해서 scope creep 방지
- 14:00, 15:15, 16:00 시점에 "진행도 체크" (예정 vs 실제 비교)

### Risk 3: Higgsfield 크레딧 부족 또는 생성 실패

**리스크**: 크레딧이 예상보다 빨리 소진 / 영상 생성 오류

**완화 전략**:
- Day2 17:00에 크레딧 **재확인 및 남은 분량 계산**
- "15초 1개만" 프로토타입용으로 제한
- 실패 시 백업: 사전 환경테스트 중 화면 녹화본 준비

### Risk 4: brand-voice 톤 일관성 미관찰 (Skill 5개가 톤 불일치)

**리스크**: Skill 실행 결과들이 brand-voice.md 3원칙을 위반

**완화 전략**:
- **claim-safety-checker Skill을 "LLM-as-a-Judge" 패턴으로 사용**
- 콘텐츠 생성 후 **반드시 검증** (생성 Skill ≠ 검증 Skill)
- 검증 실패 시 다시 생성 반복
- 6단계에서 전체 콘텐츠 5개를 한 번에 claim-safety-checker로 실행

### Risk 5: GitHub 머지 충돌 (2개 브랜치 동시 작업)

**리스크**: feature/brand-line과 feature/product-line의 PR이 main과 충돌

**완화 전략**:
- 브랜치별로 **파일을 완전히 분리** (브랜드 라인: skills/character-designer/, skills/shortform-scenario-writer/ 등)
- 제품 라인: skills/product-intro-writer/, 웹앱 관련 파일들
- 충돌 가능성 있는 spec.md, brand-voice.md는 main에서만 편집 (양쪽 다 읽기)

### Risk 6: 발표 시간 초과 (6분 안에 내용 못 담음)

**리스크**: 4일간의 작업 내용을 6분에 모두 설명하려니 과도한 슬라이드

**완화 전략**:
- Day3(8/5)부터 **슬라이드 제작 시작**, 발표 스크립트 미리 작성
- "문제 → 설계 → 결과 데모 → 확장성" 4개 섹션만 (총 4~5슬라이드)
- 웹앱 라이브 데모 또는 녹화본 백업 준비 (시연이 가장 설득력 있음)

---

## 📋 최종 체크리스트 (8/3 마지막 15분)

### PRD 내용 확인
- [ ] WHO: 제주소금의 구체적 기업 소개 + 핵심 문제점 명확
- [ ] WHAT: 3가지 문제 (비체계성, 자동화 부재, 우선순위 정렬) 모두 설명
- [ ] WHEN: 4영업일 긴급성 + 각 Day별 마일스톤 명시
- [ ] WHERE: 기업 내부, 시장, 기술 기회 3가지 차원 분석
- [ ] WHY: 시장 기회 + 투자자 신뢰 + 팀 역량 3가지 이유
- [ ] HOW: 듀얼 아웃풋 + 병렬 구조 + 일관성 관리 + 프로토타입 우선

### 타겟·콘텐츠 전략 확인
- [ ] 5개 오디언스 그룹 각각의 혼동·니즈·메시지 명시
- [ ] brand-voice.md 3원칙이 모든 그룹에 일관되게 적용
- [ ] 식품(관광) 중심 → 뷰티·헬스케어 확장 전략 명확
- [ ] 단기(3개월) vs 중기(6~12개월) 로드맵 분리

### 산출물·성공기준 확인
- [ ] Harness: Skill 5개 + Agent 7개 → TimelyAI 등록 후 검증
- [ ] 웹앱: 기능 1~4 프로토타입 → 기능 5는 Day3 선택적
- [ ] Higgsfield: 데모 영상 1편 (15~30초)
- [ ] 성공 기준이 "프로토타입 수준"으로 현실적으로 정의

### 웹앱 PRD 확인
- [ ] 🔴 CRITICAL CONSTRAINT 명시 (내일 하루, 2인, 프로토타입)
- [ ] 기능 1~4 각각의 입력·프로세스·출력·완성도 구체적
- [ ] 내일 타임라인이 시간 단위로 작성 (13:00~18:00)
- [ ] 프로토타입 체크리스트 5개 항목 명확

### 리스크 완화 확인
- [ ] 6가지 리스크 각각에 구체적 완화 전략 있음
- [ ] 각 리스크의 영향도가 현실적으로 평가됨
- [ ] 백업 계획 (예: Higgsfield 영상 실패 시 녹화본)

---

## 🎬 다음 액션

1. **팀이 이 spec.md를 함께 읽기** (10분) — 오늘 10:30 이전
2. **"준비 완료" 확인하기** — 기존에 준비한 파일들 리스트업
3. **13:00~13:15**: GitHub 리포 생성 + 브랜치 설정
4. **13:15~17:30**: 콘텐츠 Skill 5개 실제 작성 + TimelyAI 등록 (메인 작업)
5. **17:30~18:00**: 검증 + 머지

---

**spec.md v1.0 확정. 이제 실행만 남았습니다.**
