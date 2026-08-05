# SKILL_shortform-scenario-writer (숏폼 시나리오 라이터)

## 📌 목적

마케터가 확정한 최종 캐릭터와 Skill_00의 브리프를 바탕으로:
1. **완전한 스토리 자동 생성** (4막 구조, 감정 호 포함)
2. **120초 정확한 시나리오 자동 작성** (캐릭터별 대사 + 결이 내레이션)
3. **마케터가 검토/수정 가능** (다시 생성, 부분 수정)
4. **Higgsfield 영상화 완벽 준비** (캐릭터 모델, 배경, 음성 정보 포함)

---

## 📥 입력 (Input) - 상세

### Skill_00의 브리프 + character-designer-agent의 최종 캐릭터

```json
{
  "brief_id": "BRIEF_20260803_001",
  "primary_message": "제주 여행의 추억을 담은 따뜬한 선물",
  "tone_analysis": {
    "primary_tone": "따뜸함",
    "secondary_tone": ["제주정체성", "포용성"],
    "confidence_score": 92
  },
  "business_area": "식품/관광",
  "content_type": "숏폼 영상-스토리/브랜드",
  "target_demographics": {
    "age_group": "40~60대",
    "gender": "여성",
    "occasion": "선물"
  },
  "final_characters": [
    {
      "rank": 1,
      "name": "결이",
      "role_in_this_content": "protagonist",
      "tone": ["따뜸함", "순수성", "희망"],
      "character_arc": "호기심 → 감탄 → 감동 → 결정"
    },
    {
      "rank": 2,
      "name": "가마할방",
      "role_in_this_content": "supporting",
      "tone": ["신뢰감", "장인정신"],
      "character_arc": "자랑스러운 설명자"
    },
    {
      "rank": 3,
      "name": "한라",
      "role_in_this_content": "supporting",
      "tone": ["신비로움", "제주정체성"],
      "character_arc": "세계관 설명자"
    }
  ]
}
```

---

## 📤 출력 (Output) - 마케터가 보는 형식

```json
{
  "status": "waiting_for_marketer_review",
  "scenario_id": "SCENARIO_20260803_001",
  "story": {
    "title": "제주의 바다가 주는 따뜬한 선물",
    "premise": "제주 여행 중 우연히 만난 소금이 단순한 제품이 아니라, 40만 년 화산지형과 70년 기술력이 담긴 사랑의 결정체라는 것을 깨닫는 한 관광객의 여정",
    "acts": [
      {
        "act": 1,
        "title": "제주에서의 첫 만남",
        "duration": "0-30초",
        "key_event": "결이가 제주 해변에서 가마할방을 만남",
        "emotional_beat": "호기심 발생"
      },
      {
        "act": 2,
        "title": "40만 년 화산지형의 신비",
        "duration": "30-60초",
        "key_event": "한라가 화산지형의 신비로움 설명",
        "emotional_beat": "경이로움, 감탄"
      },
      {
        "act": 3,
        "title": "70년 정성의 가치",
        "duration": "60-90초",
        "key_event": "가마할방이 70년 기술 설명",
        "emotional_beat": "깨달음, 감동"
      },
      {
        "act": 4,
        "title": "따뜬한 선물의 의미",
        "duration": "90-120초",
        "key_event": "결이가 선물로 구매 결정",
        "emotional_beat": "만족감, 결정"
      }
    ],
    "emotional_journey": [
      "호기심 (처음): 왜 이 소금은 다를까?",
      "경이로움 (중반): 40만 년의 화산지형?",
      "감동 (후반): 70년의 정성이 담긴 선물",
      "만족감 (마지막): 가족을 위한 따뜬한 선택"
    ]
  },
  "scenario_timeline": [
    {
      "segment_id": 1,
      "time_range": "0-15초",
      "scene": "Opening: 제주 해변, 결이 도착",
      "visuals": {
        "background": "jeju_beach_sunrise",
        "mood": "밝고 자연스러운 아침",
        "color_palette": ["파란색", "금색", "흰색"]
      },
      "characters_in_scene": ["결이"],
      "dialogue": [
        {
          "character": "결이",
          "text": "와, 이 바다 정말 아름다워요!",
          "tone": "놀라움, 감탄",
          "duration_seconds": 3,
          "speaking_style": "enthusiastic"
        }
      ],
      "narration": {
        "speaker": "결이",
        "text": "제주의 바다에 도착한 한 관광객. 그곳에서 뭔가 특별한 것을 만날 예정이었어요.",
        "duration_seconds": 8,
        "style": "observer_voice",
        "emotional_tone": "호기심 유발"
      },
      "total_segment_duration": 15
    },
    {
      "segment_id": 2,
      "time_range": "15-45초",
      "scene": "Body 1: 첫 만남, 제주소금 소개",
      "visuals": {
        "background": "jeju_beach_with_product",
        "mood": "자연스럽고 친근함",
        "color_palette": ["파란색", "흰색", "갈색"]
      },
      "characters_in_scene": ["결이", "가마할방"],
      "dialogue": [
        {
          "character": "가마할방",
          "text": "이거 봤나? 이게 바로 제주소금이라고.",
          "tone": "자연스럽고 친근함",
          "duration_seconds": 3,
          "speaking_style": "casual_friendly"
        },
        {
          "character": "결이",
          "text": "와, 정말 특별해 보이는데요. 뭐가 다른 거예요?",
          "tone": "호기심",
          "duration_seconds": 4,
          "speaking_style": "curious"
        }
      ],
      "narration": {
        "speaker": "결이",
        "text": "제주의 바다에서 태어난 40만 년의 화산지형. 거기서 올라오는 용암해수. 그걸 70년의 정성으로 만든 소금.",
        "duration_seconds": 15,
        "style": "descriptive_explanatory",
        "emotional_tone": "신뢰감 형성"
      },
      "total_segment_duration": 30
    },
    {
      "segment_id": 3,
      "time_range": "45-75초",
      "scene": "Body 2: 신비로운 세계관 발견",
      "visuals": {
        "background": "volcano_landscape_mystical",
        "mood": "신비로움, 웅장함",
        "color_palette": ["짙은 파란색", "검은색", "금색"]
      },
      "characters_in_scene": ["결이", "한라"],
      "dialogue": [
        {
          "character": "한라",
          "text": "이곳은 40만 년 화산지형이 만든 신비로운 땅이야. 여기서 모든 게 시작되지.",
          "tone": "신비로움, 지혜",
          "duration_seconds": 5,
          "speaking_style": "wise_mystical"
        },
        {
          "character": "결이",
          "text": "40만 년이라니! 정말 대단하네요...",
          "tone": "감탄",
          "duration_seconds": 3,
          "speaking_style": "amazed"
        }
      ],
      "narration": {
        "speaker": "결이",
        "text": "40만 년의 지하에서 올라온 미네랄 풍부한 용암해수. 그리고 70년의 장인정신.",
        "duration_seconds": 17,
        "style": "emotional_explanatory",
        "emotional_tone": "감탄 증폭"
      },
      "total_segment_duration": 30
    },
    {
      "segment_id": 4,
      "time_range": "75-105초",
      "scene": "Body 3: 70년 기술력의 가치",
      "visuals": {
        "background": "stone_kiln_fire",
        "mood": "따뜸함, 정성",
        "color_palette": ["붉은색", "금색", "주황색"]
      },
      "characters_in_scene": ["결이", "가마할방"],
      "dialogue": [
        {
          "character": "가마할방",
          "text": "이 손도, 이 불도 70년이야. 한순간도 빠뜨릴 수 없지.",
          "tone": "따뜬함, 자부심",
          "duration_seconds": 4,
          "speaking_style": "proud_warm"
        },
        {
          "character": "결이",
          "text": "70년 동안 이것만... 정말 대단하세요.",
          "tone": "깊은 감동",
          "duration_seconds": 3,
          "speaking_style": "deeply_moved"
        }
      ],
      "narration": {
        "speaker": "결이",
        "text": "70년의 장인정신이 담긴 가마솥. 한 알 한 알 정성스럽게 완성된 제주소금.",
        "duration_seconds": 18,
        "style": "reverent_emotional",
        "emotional_tone": "감동 극대화"
      },
      "total_segment_duration": 30
    },
    {
      "segment_id": 5,
      "time_range": "105-120초",
      "scene": "Closing: 따뜬한 선물의 의미",
      "visuals": {
        "background": "sparkling_salt_warm_light",
        "mood": "따뜬함, 완성감",
        "color_palette": ["흰색", "금색", "파스텔"]
      },
      "characters_in_scene": ["결이", "가마할방"],
      "dialogue": [
        {
          "character": "결이",
          "text": "이게 바로 제주에서 만난 가장 따뜬한 선물이네요. 우리 할머니께 드려야겠어요.",
          "tone": "결정적, 따뜨함",
          "duration_seconds": 5,
          "speaking_style": "warm_determined"
        },
        {
          "character": "가마할방",
          "text": "그게 맞아. 사랑은 이런 작은 것에서 시작되지.",
          "tone": "만족감, 위로",
          "duration_seconds": 3,
          "speaking_style": "wise_satisfied"
        }
      ],
      "narration": {
        "speaker": "결이",
        "text": "이 모든 게 한 알의 소금 결정으로 완성되어요. 40만 년의 자연과 70년의 정성이 담긴 제주소금. 바로 이게 제주소금의 가치입니다.",
        "duration_seconds": 12,
        "style": "conclusive_powerful",
        "emotional_tone": "메시지 명확화"
      },
      "total_segment_duration": 15
    }
  ],
  "timing_breakdown": {
    "total_duration": 120,
    "dialogue_total": 28,
    "narration_total": 70,
    "silence_pauses": 22,
    "verification": "✅ 정확히 120초"
  },
  "gyeongyi_narration_analysis": {
    "role": "protagonist",
    "narration_style": "direct_observer",
    "narration_percentage": 58.3,
    "dialogue_percentage": 23.3,
    "appearance": "100% (모든 세그먼트에 등장)"
  },
  "higgsfield_specifications": {
    "format": "ready_for_video_generation",
    "character_assignments": {
      "결이": {
        "model": "young_boy_salt_protagonist",
        "speaking_scenes": 5,
        "key_emotion": "호기심→감탄→감동→결정"
      },
      "가마할방": {
        "model": "elderly_man_artisan_70years",
        "speaking_scenes": 2,
        "key_emotion": "자부심, 정성"
      },
      "한라": {
        "model": "mystical_mountain_spirit",
        "speaking_scenes": 1,
        "key_emotion": "신비로움, 지혜"
      }
    },
    "background_sequence": [
      {
        "segment": 1,
        "setting": "jeju_beach_sunrise",
        "lighting": "natural_morning_light"
      },
      {
        "segment": 2,
        "setting": "jeju_beach_with_product",
        "lighting": "natural_daytime"
      },
      {
        "segment": 3,
        "setting": "volcano_landscape_mystical",
        "lighting": "mystical_atmosphere"
      },
      {
        "segment": 4,
        "setting": "stone_kiln_fire",
        "lighting": "warm_firelight"
      },
      {
        "segment": 5,
        "setting": "sparkling_salt_warm_light",
        "lighting": "golden_hour"
      }
    ],
    "voice_specifications": {
      "narration_voice": "결이 (주관적 관찰자)",
      "narration_tone": "따뜸함, 순수함, 신뢰감",
      "music_mood": "감정적, 제주 정체성 반영",
      "sound_effects": "파도 소리, 가마 소리, 불 소리"
    }
  },
  "marketer_actions": {
    "can_regenerate_entire": "전체 시나리오를 다시 생성해달라고 요청 가능",
    "can_modify_segment": "특정 세그먼트만 수정 요청 가능",
    "can_extend_dialogue": "특정 캐릭터의 대사를 더 길게 요청 가능",
    "can_change_narration": "내레이션의 톤이나 내용 수정 요청 가능",
    "can_adjust_pacing": "느린/빠른 템포로 조정 요청 가능"
  }
}
```

---

## 📖 스토리 생성 구조 (상세)

### 4막 구성과 각 Act의 역할

| Act | 시간 | 제목 | 목표 | 톤 | 결이의 상태 |
|-----|------|------|------|-----|-----------|
| 1 | 0-30초 | 도입 | 상황 설정 + 캐릭터 소개 | 호기심 | 새로운 세계 진입 |
| 2 | 30-60초 | 전개 | 주요 정보 전달 + 호기심 유발 | 신비로움 | 경이로움 발생 |
| 3 | 60-90초 | 상승 | 깊이 있는 설명 + 감정 고조 | 감동 | 깨달음 순간 |
| 4 | 90-120초 | 결말 | 메시지 전달 + 결정 | 만족감 | 최종 선택 |

### Act별 구체적 내용 방향

```
Act 1 (도입): "왜?"
  → "이게 뭐길래 다른가?"
  → 관광객의 호기심 자연스럽게 유발
  → 바다와 제주 이미지 부각

Act 2 (전개): "어떻게?"
  → "40만 년이라니?"
  → 신비로운 세계관 소개
  → 화산지형과 용암해수 강조

Act 3 (상승): "무엇의 가치?"
  → "70년을 이것만?"
  → 기술력과 정성 강조
  → 감정적 높이 극대화

Act 4 (결말): "왜 특별한가?"
  → "이게 바로 사랑이다"
  → 최종 메시지 명확화
  → 가족, 선물, 함께의 가치
```

---

## 💬 결이의 역할에 따른 내레이션 배분

### 결이가 주인공(protagonist)일 때

```
총 120초:
- 결이 직접 대사: 10-15초 (주인공 역할)
- 결이 내레이션: 60-70초 (관찰자 입장)
- 다른 캐릭터 대사: 20-30초
- 침묵/음향 효과: 10-15초

"슈퍼맨이 돌아왔다" 스타일:
→ 결이가 주인공으로 대사하다가
→ 필요한 순간 "내레이션으로" 상황 설명
→ 다시 대사로 반응
```

### 결이가 조연(supporting)일 때

```
총 120초:
- 다른 캐릭터 대사: 25-35초 (주인공들)
- 결이 내레이션: 70-80초 (배경 음성)
- 결이 짧은 대사: 5-10초 (반응)
- 침묵/음향 효과: 10-15초

→ 결이는 주로 내레이션으로 등장
→ 대사는 다른 캐릭터 중심
→ 하지만 결이 목소리로 전체 스토리 안내
```

---

## 🎯 정확한 타이밍 계산 공식

### 총 120초 배분 (확정)

```
총 120초 = 대사 + 내레이션 + 침묵

계산:
1. 각 캐릭터 대사의 길이 측정
   (평균: 한 문장 3-5초)

2. 결이 내레이션 배치
   - Act 1: 5-10초
   - Act 2: 15-20초
   - Act 3: 20-25초
   - Act 4: 15-20초
   합계: 55-75초

3. 침묵/자연스러운 호흡
   - 각 세그먼트 사이: 1-2초
   - 대사 끝과 내레이션 사이: 1-2초
   합계: 10-15초

4. 검증: 대사 + 내레이션 + 침묵 = 120초
```

### 실제 예시 (위의 시나리오)

```
Segment 1 (0-15초):
  - 결이 대사: 3초
  - 결이 내레이션: 8초
  - 침묵: 4초
  = 15초 ✅

Segment 2 (15-45초):
  - 가마할방 대사: 3초
  - 결이 대사: 4초
  - 침묵: 3초
  - 결이 내레이션: 15초
  = 30초 ✅

... (계속)

총합: 120초 정확 ✅
```

---

## 🤖 AI 프롬프트 (TimelyAI용) - 상세

```
당신은 제주소금의 시나리오 라이터 Skill입니다.

[당신의 책임]
입력된 브리프와 최종 캐릭터를 바탕으로:
1. 4막 구조의 완전한 스토리 생성
2. 정확한 120초 시나리오 작성
3. 캐릭터별 대사 + 결이 내레이션 생성
4. Higgsfield 영상화 준비
5. 마케터 검토 가능한 JSON 형식 출력

[스토리 생성 기준]
- Primary message를 핵심에 배치
- 4막 구조: 도입(호기심) → 전개(신비) → 상승(감동) → 결말(결정)
- 감정 호: 부드러운 상승곡선
- 각 Act마다 다른 메시지 전달

[캐릭터별 대사 가이드]
결이: 호기심 → 감탄 → 감동 → 결정의 여정
  - 주인공일 때: 직접 대사 많음 (10-15초)
  - 조연일 때: 짧은 반응 (5-10초)

가마할방: 자부심과 정성 표현
  - "70년", "이 손", "정성"이 키워드
  - 따뜨하면서도 신뢰감 있는 톤

한라: 신비로움과 역사성
  - "40만 년", "화산지형", "신비"가 키워드
  - 설명적이지만 웅장한 톤

[내레이션 생성 (결이)]
"슈퍼맨이 돌아왔다" 스타일:
- 현재 영상의 장면을 설명하면서
- 동시에 깊은 의미 전달
- 감정을 증폭시키는 표현 사용

배분:
- 주인공일 때: 60-70초
- 조연일 때: 70-80초
- 침묵 제외 총합

[타이밍 계산]
1. 각 대사의 초 단위 길이 명시
2. 내레이션 삽입 지점 확정
3. 총 120초 정확히 맞춤
4. verification 필드에 체크

[Higgsfield 준비]
- 캐릭터별 모델 할당
- 배경 설정 순서
- 음성 스펙 (톤, 속도, 감정)
- 사운드 효과

[출력]
위의 완전한 JSON 스키마로 반환
마케터가 검토할 수 있는 형식
```

---

## 💬 마케터 검토 및 수정

### 마케터가 할 수 있는 5가지 수정

```
1. "전체 다시 생성해줘"
   → SKILL이 새로운 스토리라인 생성

2. "세그먼트 3 (70-75초)를 다르게 해줘"
   → 해당 부분만 재작성

3. "결이의 대사를 더 길게"
   → 내레이션 줄이고 대사 확대
   → 타이밍 재계산

4. "음악을 더 감정적으로"
   → higgsfield_specifications 수정

5. "한라의 역할을 더 줄여줘"
   → 한라 대사 삭제
   → 다른 캐릭터나 내레이션으로 대체
```

### 마케터 경험 흐름

```
┌────────────────────────────────────────┐
│  SKILL이 생성한 120초 시나리오           │
│                                        │
│  제목: "제주의 바다가 주는 따뜬한 선물" │
│  전체 흐름: ✅ 4막 완벽 구성            │
│                                        │
│  [세그먼트 1] Opening                  │
│  결이: "와, 이 바다..." (3초)           │
│  내레이션: "제주의 바다에..." (8초)    │
│  [세그먼트별 상세 표시]                 │
│                                        │
│  📊 타이밍 검증:                        │
│  대사: 28초, 내레이션: 70초             │
│  침묵: 22초                             │
│  총 120초 ✅                            │
│                                        │
│  🎬 Higgsfield 준비:                   │
│  캐릭터 모델: 결이, 가마할방, 한라      │
│  배경: 5개 (해변→화산→가마→소금)      │
│                                        │
│  ➕ [전체 다시 생성]                    │
│  ✏️ [특정 부분 수정]                    │
│  📝 [대사 길이 조정]                    │
│  ✓ [최종 승인 - 다음 Skill로]          │
└────────────────────────────────────────┘

마케터의 선택에 따라:
→ 수정 → SKILL 재호출, 새 시나리오 제시
→ 승인 → naming-generator-agent로 전달
```

---

## ✅ 이 Skill의 역할 (최종)

**마케터의 시나리오 작성 역할 완전 대체:**

| 요구사항 | 구현 |
|---------|------|
| 스토리 자동 생성 | ✅ 4막 구조, 감정 호 포함 |
| 대사 자동 생성 | ✅ 캐릭터별 톤 유지 |
| 내레이션 자동 생성 | ✅ "슈퍼맨" 스타일 |
| 120초 정확 | ✅ 공식 기반 계산 |
| 마케터 검토 가능 | ✅ 5가지 수정 옵션 |
| Higgsfield 준비 | ✅ 모든 필요 정보 포함 |

---

## 📋 다음 단계

**이 Skill의 출력 → naming-generator-agent가 받음**

Agent가:
1. 최종 시나리오를 마케터에게 제시
2. 마케터의 검토/수정 관리 (최대 2회 재생성)
3. 확정된 시나리오 → naming-generator-agent로 전달
4. SKILL_naming-generator 호출
