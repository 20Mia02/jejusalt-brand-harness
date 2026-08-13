# 캐릭터 디자인 시스템 v3 배포 가이드 (Phase 6)

**버전**: v3.0  
**배포일**: 2026-08-06  
**담당**: 박주미 (제품 라인)  

---

## 1. 배포 전 체크리스트

### 1.1 문서 준비 ✅

- [x] `docs/character-concept-enhanced.md` (8개 캐릭터 상세 설계)
- [x] `SYSTEM_PROMPT_CHARACTER_CREATOR_V3.md` (AI 시스템 프롬프트)
- [x] `CHARACTER_REDESIGN_ROADMAP.md` (실행 계획)
- [x] `CHARACTER_QA_AUTOMATION.md` (검증 규칙)
- [x] `CHARACTER_DEPLOYMENT_GUIDE.md` (이 파일)

### 1.2 코드/데이터 준비 ✅

- [x] `config.json` (8개 캐릭터 완전 데이터 포함)
- [x] `config-characters-v3.json` (참조용 데이터)
- [x] `agents/character-creator-agent.md` (새 캐릭터 생성 에이전트)
- [x] `agents/character-generator-agent.md` (Higgsfield 생성 에이전트)

### 1.3 검증 완료 ✅

- [x] 8개 기존 캐릭터 v3 기준 충족 확인
- [x] Higgsfield 프롬프트 최적화 완료
- [x] 신체 구조, 성별표현, 상징성 명확화 완료

---

## 2. 배포 단계별 가이드

### Phase 2-3: 코드 병합 및 테스트

```bash
# 1단계: 브랜치 생성
git checkout -b feature/character-v3-system

# 2단계: 파일 추가
git add \
  config.json \
  config-characters-v3.json \
  docs/character-concept-enhanced.md \
  SYSTEM_PROMPT_CHARACTER_CREATOR_V3.md \
  CHARACTER_QA_AUTOMATION.md \
  CHARACTER_REDESIGN_ROADMAP.md \
  CHARACTER_DEPLOYMENT_GUIDE.md \
  agents/character-creator-agent.md

# 3단계: 커밋
git commit -m "feat: 캐릭터 디자인 시스템 v3 완전 재구축

- 신체구조 명시 (팔, 다리, 몸통, 얼굴)
- 2등신 비율 통일 (머리 42~46%)
- 성별표현 명확화 (머리, 얼굴, 신체, 액세서리)
- 동영상 애니메이션 가능성 보장 (관절, 표정, 동작)
- 상징성 강화 (색상, 형태, 텍스처, 표정)
- 8개 캐릭터 완전 상세화
- QA 자동화 규칙 추가"

# 4단계: PR 생성
gh pr create \
  --title "feat: 캐릭터 설계 시스템 v3 (신체구조/2등신/성별/동영상)" \
  --body "제주소금 8개 캐릭터를 v3 기준으로 완전 재구축합니다."

# 5단계: 테스트
npm test -- qa-validator.js --all
```

### Phase 4: 프론트엔드 연결

#### 4.1 CharacterCreator.jsx 업데이트

```javascript
// jejusalt-frontend/src/components/CharacterCreator.jsx
import config from '../../../config.json';

export const CharacterCreator = () => {
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  // v3 데이터 사용
  const characters = config.characters;

  return (
    <div className="character-creator">
      {characters.map(char => (
        <CharacterCard 
          key={char.id}
          character={char}
          bodyStructure={char.bodyStructure}
          genderExpression={char.genderExpression}
          animationNotes={char.animationNotes}
          symbolism={char.symbolism}
        />
      ))}
    </div>
  );
};
```

#### 4.2 CharacterCard 컴포넌트

```javascript
// 신체 구조 시각화
const renderBodyStructure = (character) => {
  const { bodyStructure } = character;
  return (
    <div className="body-structure">
      <p>📏 프로포션: {bodyStructure.headRatio} (머리)</p>
      <p>🎯 신체 구조:</p>
      <ul>
        <li>팔: {bodyStructure.arms}</li>
        <li>다리: {bodyStructure.legs}</li>
        <li>특징: {bodyStructure.proportionType}</li>
      </ul>
    </div>
  );
};

// 성별 표현 시각화
const renderGenderExpression = (character) => {
  const { genderExpression } = character;
  return (
    <div className="gender-expression">
      <p>👥 성별 표현: {character.gender}</p>
      <ul>
        <li>머리: {genderExpression.hair}</li>
        <li>얼굴: {genderExpression.eyebrows}, {genderExpression.eyelashes}</li>
        <li>실루엣: {genderExpression.silhouette}</li>
      </ul>
    </div>
  );
};
```

#### 4.3 backend/routes/characters.js 업데이트

```javascript
const express = require('express');
const config = require('../../config.json');

router.get('/characters', (req, res) => {
  res.json({
    characters: config.characters,
    designSystemVersion: config.brand.designSystemVersion,
    designRules: config.designRules
  });
});

router.get('/characters/:id', (req, res) => {
  const character = config.characters.find(c => c.id === parseInt(req.params.id));
  if (character) {
    res.json(character);
  } else {
    res.status(404).json({ error: 'Character not found' });
  }
});
```

---

## 3. 팀 교육 및 공유

### 3.1 설계 개념 교육

```markdown
## v3 캐릭터 디자인 시스템 (팀 브리핑)

### 핵심 원칙 5가지

1. **신체 구조**
   - 팔, 다리, 몸통, 얼굴이 명확해야 함
   - 어깨, 무릎 관절이 명시되어야 함
   
2. **2등신 비율**
   - 머리: 42~46% (귀여움 극대화)
   - 팔: 짧고 굵음
   - 다리: 팔보다 길고 굵음
   
3. **성별 표현**
   - 머리, 얼굴(눈썹, 속눈썹), 신체, 액세서리로 표현
   - 명확하면서도 자연스러운 표현
   
4. **상징성**
   - 색상: 타입과 역할 반영
   - 형태: 소재/특징 반영
   - 액세서리: 성별과 역할 강화
   
5. **동영상 가능성**
   - 관절 명확 (shoulder, knee 필수)
   - 표정 4~6가지
   - 동작 3~5가지
```

### 3.2 작업 흐름 가이드

```
새 캐릭터 생성 워크플로우
│
├─ 1. 제품 분석
│   ├─ 카테고리, 특징, 효능
│   └─ 타겟층, 메시지
│
├─ 2. character-creator-agent 호출
│   ├─ 입력: 제품 정보 + 메타데이터
│   └─ 출력: 캐릭터 스펙 (v3 기준)
│
├─ 3. QA 검증
│   ├─ 신체 구조 ✓
│   ├─ 성별 표현 ✓
│   ├─ 상징성 ✓
│   ├─ 동영상 가능성 ✓
│   └─ 브랜드 일관성 ✓
│
├─ 4. config.json 등록
│   └─ new character 추가
│
├─ 5. Higgsfield 영상 생성
│   └─ higgsfieldPrompt 사용
│
└─ 6. 최종 검수 및 배포
    └─ 팀 승인 후 라이브
```

### 3.3 참조 자료

- `docs/character-concept-enhanced.md` - 설계 상세서
- `SYSTEM_PROMPT_CHARACTER_CREATOR_V3.md` - AI 지침서
- `CHARACTER_QA_AUTOMATION.md` - 검증 규칙

---

## 4. 운영 및 유지보수

### 4.1 새 캐릭터 생성 프로세스

```
Step 1: 기획 검토
  - 제품 정보 수집
  - 타겟층/메시지 정의
  - 기존 8개와 차별화 확인

Step 2: 설계 (character-creator-agent)
  - 타입 결정 (SALT/LAVA/MINERAL/FIRE)
  - 성별 결정
  - 신체 구조 설계
  - Higgsfield 프롬프트 생성

Step 3: QA 검증
  - 자동 검증 (qa-validator.js)
  - 수동 검증 (팀 리뷰)
  - 수정 및 재검증

Step 4: config.json 등록
  - 캐릭터 데이터 추가
  - git commit

Step 5: 영상 생성
  - Higgsfield 호출
  - 영상 렌더링
  - 품질 확인

Step 6: 배포
  - 프론트엔드 업데이트
  - 테스트
  - 라이브 배포
```

### 4.2 정기 검증

```bash
# 매주 검증
npm run validate:characters

# 배포 전 검증
npm run validate:pre-deploy

# 전체 시스템 검증
npm run validate:all
```

---

## 5. FAQ

### Q1: 왜 2등신 비율이 중요한가?
A: 2등신은 귀여움을 극대화하면서도 신체 구조를 명확하게 하기 위한 최적 비율입니다.

### Q2: 새 캐릭터를 만들 수 있나?
A: 네, character-creator-agent가 v3 기준을 자동으로 따릅니다. 새 캐릭터도 동일한 품질을 보장받습니다.

### Q3: 기존 캐릭터를 수정할 수 있나?
A: 네, config.json에서 필드를 수정하면 QA 검증을 통과해야 합니다.

### Q4: 왜 성별 표현이 여러 방식인가?
A: 시각적 명확성을 위해 머리, 얼굴, 신체, 액세서리 등 5가지 차원으로 표현합니다.

### Q5: 동영상 제작 비용은?
A: 명확한 신체 구조와 관절이 있으면 제작 비용이 낮아집니다.

---

## 6. 성공 지표

배포 후 다음을 모니터링합니다:

- ✅ **설계 일관성**: 모든 캐릭터가 v3 기준 충족 (목표: 100%)
- ✅ **성별 인식률**: 사용자가 캐릭터 성별을 명확하게 인식 (목표: >95%)
- ✅ **애니메이션 품질**: 모든 캐릭터의 동영상 품질 일정 (목표: 5/5)
- ✅ **팀 채택률**: 모든 새 캐릭터가 v3 시스템 사용 (목표: 100%)
- ✅ **사용자 만족도**: 캐릭터 디자인 평가 (목표: 4.5/5)

---

## 7. 긴급 대응

### 문제: 새 캐릭터가 QA 검증 실패

```bash
# 1. 오류 확인
npm run validate -- --character "new_char"

# 2. CHARACTER_QA_AUTOMATION.md 참조
# 3. 오류 수정
# 4. 재검증
npm run validate -- --character "new_char"
```

### 문제: Higgsfield 프롬프트가 기준을 벗어남

```markdown
프롬프트 수정 방법:
1. SYSTEM_PROMPT_CHARACTER_CREATOR_V3.md의 예시 참조
2. higgsfieldPrompt 필드 업데이트
3. 영상 재생성
4. QA 검증
```

---

## 8. 배포 후 커뮤니케이션

### 팀 공지

```markdown
📢 **캐릭터 디자인 시스템 v3 배포 완료**

제주소금 8개 캐릭터가 새로운 v3 설계 기준으로 완전 재구축되었습니다.

🎯 주요 변화:
- ✅ 신체 구조 명확화 (팔, 다리, 몸통, 얼굴)
- ✅ 2등신 비율 통일 (귀여움 극대화)
- ✅ 성별 표현 명확화 (5개 차원)
- ✅ 동영상 애니메이션 최적화
- ✅ 상징성 강화 (색상, 형태, 액세서리)

📚 참고 자료:
- `docs/character-concept-enhanced.md` - 설계 상세
- `SYSTEM_PROMPT_CHARACTER_CREATOR_V3.md` - 생성 지침
- `CHARACTER_QA_AUTOMATION.md` - 검증 규칙

❓ 질문? Slack #캐릭터-디자인 채널에서 물어보세요!
```

---

## 9. 마이그레이션 완료 체크리스트

배포 전 최종 확인:

- [ ] 모든 8개 캐릭터 QA 검증 완료
- [ ] config.json 문법 오류 없음
- [ ] Higgsfield 프롬프트 최적화 완료
- [ ] 프론트엔드 연결 테스트 완료
- [ ] 팀 교육 완료
- [ ] 긴급 대응 계획 수립
- [ ] 성공 지표 설정 완료
- [ ] 최종 검수 승인

모든 항목 완료 후 본격 배포 진행합니다!

