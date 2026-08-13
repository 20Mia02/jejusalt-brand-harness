# 캐릭터 QA 자동화 규칙 (Phase 5)

**버전**: v3.0  
**작성일**: 2026.08.06  
**목적**: 캐릭터 생성 시 자동으로 v3 기준 검증

---

## 1. 자동 검증 체크리스트

### 1.1 신체 구조 검증

```javascript
// bodyStructure 검증
const validateBodyStructure = (character) => {
  const errors = [];
  
  // 필수 필드 확인
  if (!character.bodyStructure) {
    errors.push("❌ bodyStructure 필드 누락");
    return errors;
  }
  
  // 머리 비율 (42~46%)
  const headRatio = parseFloat(character.bodyStructure.headRatio);
  if (headRatio < 42 || headRatio > 46) {
    errors.push(`⚠️ 머리 비율 ${headRatio}% (권장: 42~46%)`);
  }
  
  // 팔/다리 명시
  if (!character.bodyStructure.arms) {
    errors.push("❌ 팔(arms) 설명 누락");
  }
  if (!character.bodyStructure.legs) {
    errors.push("❌ 다리(legs) 설명 누락");
  }
  
  // 어깨, 무릎 관절 명확성
  const armsHasJoint = character.bodyStructure.arms.includes("어깨");
  const legsHasJoint = character.bodyStructure.legs.includes("무릎");
  
  if (!armsHasJoint) {
    errors.push("⚠️ 팔에 어깨 관절이 명시되지 않음");
  }
  if (!legsHasJoint) {
    errors.push("⚠️ 다리에 무릎 관절이 명시되지 않음");
  }
  
  return errors;
};
```

### 1.2 성별 표현 검증

```javascript
const validateGenderExpression = (character) => {
  const errors = [];
  const gender = character.gender;
  
  if (!character.genderExpression) {
    errors.push("❌ genderExpression 필드 누락");
    return errors;
  }
  
  const ge = character.genderExpression;
  
  // 필수 필드
  const requiredFields = ["hair", "eyebrows", "eyelashes", "bodyShape", "accessories"];
  requiredFields.forEach(field => {
    if (!ge[field]) {
      errors.push(`❌ genderExpression.${field} 누락`);
    }
  });
  
  // 성별 일관성 검증
  if (gender === "남성") {
    if (ge.hair && ge.hair.includes("긴")) {
      errors.push("⚠️ 남성 캐릭터이나 '긴 머리' 표현 (확인 필요)");
    }
    if (ge.eyelashes && !ge.eyelashes.includes("짧거나")) {
      errors.push("⚠️ 남성 캐릭터이나 속눈썹이 명확함 (남성답지 않을 수 있음)");
    }
  } else if (gender === "여성") {
    if (ge.hair && !ge.hair.includes("긴") && !ge.hair.includes("리본")) {
      errors.push("⚠️ 여성 캐릭터이나 여성적 헤어 표현 부족");
    }
    if (ge.eyelashes && ge.eyelashes.includes("없음")) {
      errors.push("⚠️ 여성 캐릭터이나 속눈썹 표현 미흡");
    }
  }
  
  return errors;
};
```

### 1.3 상징성 검증

```javascript
const validateSymbolism = (character) => {
  const errors = [];
  
  if (!character.symbolism) {
    errors.push("❌ symbolism 필드 누락");
    return errors;
  }
  
  const sym = character.symbolism;
  const requiredFields = ["color", "shape", "texture", "expression"];
  
  requiredFields.forEach(field => {
    if (!sym[field]) {
      errors.push(`❌ symbolism.${field} 누락`);
    }
  });
  
  // 색상이 타입과 일치하는지 검증
  const colorTypeMap = {
    "SALT": ["#00AEEF", "밝은"],
    "LAVA": ["#0D1B2A", "#1A3A52", "어두운"],
    "MINERAL": ["#6B4C9A", "#008B8B", "보라", "청록"],
    "FIRE": ["#FF4500", "#FFD700", "주황", "노랑"]
  };
  
  const charType = character.type.split("+")[0]; // 주 타입
  const expectedColors = colorTypeMap[charType] || [];
  const colorMatches = expectedColors.some(c => sym.color.includes(c));
  
  if (!colorMatches) {
    errors.push(`⚠️ 색상이 ${charType} 타입과 불일치: ${sym.color}`);
  }
  
  return errors;
};
```

### 1.4 동영상 애니메이션 검증

```javascript
const validateAnimation = (character) => {
  const errors = [];
  
  if (!character.animationNotes) {
    errors.push("❌ animationNotes 필드 누락");
    return errors;
  }
  
  const an = character.animationNotes;
  
  // 필수 관절 확인
  if (!an.jointsRequired || !Array.isArray(an.jointsRequired)) {
    errors.push("❌ jointsRequired 필드 누락");
    return errors;
  }
  
  const requiredJoints = ["shoulder", "knee"];
  const hasAllRequired = requiredJoints.every(j => 
    an.jointsRequired.some(jnt => jnt.includes(j))
  );
  
  if (!hasAllRequired) {
    errors.push(`❌ 필수 관절 부족 (shoulder, knee 필수): ${an.jointsRequired.join(", ")}`);
  }
  
  // 표정 개수 (4~6가지)
  const expressionCount = an.facialExpressions ? an.facialExpressions.length : 0;
  if (expressionCount < 4 || expressionCount > 6) {
    errors.push(`⚠️ 표정 개수 ${expressionCount}개 (권장: 4~6개)`);
  }
  
  // 동작 개수 (3~5가지)
  const movementCount = an.movements ? an.movements.length : 0;
  if (movementCount < 3 || movementCount > 5) {
    errors.push(`⚠️ 동작 개수 ${movementCount}개 (권장: 3~5개)`);
  }
  
  return errors;
};
```

### 1.5 브랜드 일관성 검증

```javascript
const validateBrandConsistency = (character) => {
  const errors = [];
  
  // 2등신 비율이 일관된지 확인 (모든 캐릭터 42~46%)
  const headRatio = parseFloat(character.bodyStructure?.headRatio);
  if (isNaN(headRatio) || headRatio < 42 || headRatio > 46) {
    errors.push(`⚠️ 2등신 비율 불일관: ${headRatio}%`);
  }
  
  // 눈 구조가 기본을 따르는지 (검정 동공 + 흰 하이라이트)
  // visualIdentity에 명시되어야 함
  if (!character.visualIdentity) {
    errors.push("❌ visualIdentity 필드 누락");
  }
  
  return errors;
};
```

---

## 2. 통합 검증 함수

```javascript
const validateCharacterV3 = (character) => {
  console.log(`\n🔍 캐릭터 검증: ${character.name} (${character.type})`);
  
  const allErrors = [];
  
  // 각 검증 실행
  allErrors.push(...validateBodyStructure(character));
  allErrors.push(...validateGenderExpression(character));
  allErrors.push(...validateSymbolism(character));
  allErrors.push(...validateAnimation(character));
  allErrors.push(...validateBrandConsistency(character));
  
  // 결과 출력
  if (allErrors.length === 0) {
    console.log("✅ 검증 완료: 모든 기준 충족");
    return { passed: true, errors: [] };
  } else {
    console.log(`⚠️ 검증 결과: ${allErrors.length}개 항목`);
    allErrors.forEach(err => console.log(`  ${err}`));
    
    const criticalErrors = allErrors.filter(e => e.includes("❌"));
    const warnings = allErrors.filter(e => e.includes("⚠️"));
    
    return {
      passed: criticalErrors.length === 0,
      errors: allErrors,
      criticalCount: criticalErrors.length,
      warningCount: warnings.length
    };
  }
};
```

---

## 3. 실행 방법

### CLI에서 실행

```bash
# 단일 캐릭터 검증
node qa-validator.js --character "결이"

# 전체 8개 캐릭터 검증
node qa-validator.js --all

# 특정 필드만 검증
node qa-validator.js --character "결이" --field "bodyStructure"
```

### Node.js에서 직접 사용

```javascript
const config = require('./config.json');

config.characters.forEach(character => {
  const result = validateCharacterV3(character);
  if (!result.passed) {
    console.log(`❌ ${character.name} 검증 실패`);
    process.exit(1);
  }
});

console.log("✅ 모든 캐릭터 검증 완료");
```

---

## 4. CI/CD 통합

### GitHub Actions 예시

```yaml
name: Character Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: node qa-validator.js --all
        name: Validate all characters
```

---

## 5. 검증 보고서

검증 결과는 다음 형식으로 저장:

```json
{
  "timestamp": "2026-08-06T10:30:00Z",
  "totalCharacters": 8,
  "results": [
    {
      "name": "결이",
      "status": "PASS",
      "errors": [],
      "warnings": []
    },
    {
      "name": "새캐릭터",
      "status": "FAIL",
      "errors": ["❌ bodyStructure 필드 누락"],
      "warnings": ["⚠️ 머리 비율 50% (권장: 42~46%)"]
    }
  ],
  "summary": {
    "passed": 8,
    "failed": 1,
    "warningCount": 1
  }
}
```

---

## 6. 자동 수정 제안 (선택)

특정 필드가 누락된 경우 자동으로 기본값 제안:

```javascript
const suggestFix = (character, error) => {
  if (error.includes("facialExpressions 누락")) {
    return {
      suggestion: "기본 4가지 표정 추가",
      default: ["happiness(ㄷ자)", "sympathy(부드러움)", "surprise(○)", "trust(●)"]
    };
  }
  // ... 더 많은 수정 제안
};
```

---

## 다음 단계

1. `qa-validator.js` 구현
2. CI/CD 파이프라인에 통합
3. 모든 기존 캐릭터 검증
4. 새 캐릭터 생성 시 자동 검증
5. 배포 전 최종 검증

