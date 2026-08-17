/**
 * frontend/components/CharacterGallery.jsx
 *
 * 자료 등록 흐름과 무관하게, 첫 화면 메뉴에서 바로 우리 브랜드 캐릭터 8명이
 * 어떤 모습인지 둘러볼 수 있는 갤러리. characters.json(귀여움 리파인먼트 시스템)
 * 데이터를 그대로 보여준다 — 별도 자료(resource) 선택 없이 바로 진입 가능.
 */
import React, { useState, useEffect } from 'react';

const isVideoUrl = (url) => /\.(mp4|webm|mov)(\?|$)/i.test(url || '');

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function ReferenceMedia({ url, className, alt }) {
  if (!url) return null;
  if (isVideoUrl(url)) {
    return <video src={url} className={className} muted loop autoPlay playsInline />;
  }
  return <img src={url} alt={alt} className={className} onError={(e) => { e.target.style.display = 'none'; }} />;
}

// ⭐ 카드 썸네일 위에 마우스를 올리면 좌우 화살표가 나타나서 사진을 넘겨볼 수 있는 캐러셀.
// 기본으로는 인형 키링 버전이 보이고, 화살표로 넘기면 원래(AI 영상 선택용) 썸네일도 볼 수 있다.
function ImageCarousel({ images, alt }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return <span className="text-xs text-dark-text-muted">아직 생성 안 됨</span>;
  }

  const goTo = (e, delta) => {
    e.stopPropagation(); // 카드 확장 토글이 같이 눌리지 않도록
    setIndex((prev) => (prev + delta + images.length) % images.length);
  };

  return (
    <div className="group relative w-full h-full">
      <ReferenceMedia url={images[index]} alt={alt} className="w-full h-full object-contain" />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => goTo(e, -1)}
            aria-label="이전 사진"
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/60"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => goTo(e, 1)}
            aria-label="다음 사진"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/60"
          >
            ›
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
            {images.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function transformCharacter(raw) {
  // API 응답 필드를 UI 표시용 필드로 변환
  const traits = Array.isArray(raw.personality_traits) ? raw.personality_traits : [];
  const roleTags = raw.role ? raw.role.split('·').map(s => s.trim()).filter(Boolean) : [];
  const allKeywords = [...traits, ...roleTags];

  // ⭐ 인형 키링 버전을 기본으로 보여주고, 화살표로 넘기면 원래(AI 영상용) 버전이 나오도록
  // 이미지 배열을 [키링, 기본] 순서로 구성 — 둘 중 하나만 있으면 그것만 노출
  const images = [raw.keyring_image_url, raw.reference_image_url].filter(Boolean);

  return {
    id: raw.id,
    name: raw.character_name,
    description: raw.character_profile || raw.visual_description || raw.visualIdentity || '',
    images,
    personalityKeywords: allKeywords,
    currentVersion: raw.source === 'default' ? null : '사용자 생성',
    tone: raw.tone_trait || raw.role || '',
    generationCount: raw.generation_count || 0,
    role: raw.role || '',
    gender: raw.gender || '',
    ageGroup: raw.ageGroup || '',
    type: raw.type || '',
    // ⭐ 특징(toneTrait)과 세계관 스토리(worldviewStory) — 갤러리 카드에서 썸네일 바로
    // 아래 항상 보이도록 표시한다 (커스텀 캐릭터는 worldviewStory가 없을 수 있음)
    toneTrait: raw.toneTrait || raw.tone_trait || '',
    worldviewStory: raw.worldviewStory || '',
    worldviewQuote: raw.worldviewQuote || '',
  };
}

export default function CharacterGallery() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet('/api/characters/library');
        const rawChars = data.characters || [];
        // ⭐ 실제 사용자가 자료를 넣어 새로 생성한 커스텀 캐릭터가 아직 없는 현재 단계에서는
        // 기본 8개 캐릭터만 노출한다 (source가 'default'가 아닌 ai_generated 테스트/leftover 항목은 숨김)
        const baseChars = rawChars.filter((r) => r.source === 'default');
        setCharacters(baseChars.map(transformCharacter));
      } catch (err) {
        console.error('캐릭터 갤러리 API 호출 실패:', err);
        setError('캐릭터 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-sm text-dark-text-muted">캐릭터 갤러리 불러오는 중...</div>;
  if (error) return <div className="p-6 text-sm text-status-rejected">{error}</div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto jeju-cute-bg">
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg p-4 mb-6">
        <div className="font-semibold mb-1">🎭 제주소금 캐릭터 갤러리</div>
        <div className="text-sm text-dark-text-muted">
          우리 브랜드의 8명 기본 캐릭터입니다. 각 캐릭터는 성격/색상/액세서리가 고정되어 있어,
          어떤 콘텐츠를 만들어도 항상 같은 모습으로 일관되게 등장합니다.
        </div>
      </div>

      {/* ⭐ 2~3열로 좁혀서 카드 폭을 넉넉하게 확보 — 세계관 스토리 전문이 잘리지 않고
          자연스럽게 줄바꿈되도록. 카드마다 높이가 달라도 grid가 알아서 처리함 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {characters.map((char) => {
          const expanded = expandedId === char.id;
          return (
            <div
              key={char.id}
              className={`border rounded-xl p-4 bg-dark-bg transition cursor-pointer ${
                expanded ? 'border-brand-blue sm:col-span-2' : 'border-brand-blue/10 hover:border-brand-blue/40'
              }`}
              onClick={() => setExpandedId(expanded ? null : char.id)}
            >
              <div className="w-full aspect-square bg-dark-chip rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                <ImageCarousel images={char.images} alt={char.name} />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-base">{char.name}</span>
                {char.currentVersion && (
                  <span className="text-[10px] bg-status-approved/10 text-status-approved px-1.5 py-0.5 rounded">
                    {char.currentVersion}
                  </span>
                )}
              </div>
              {/* 썸네일 바로 아래 항상 보이는 특징/세계관 스토리 — 줄 간격 넉넉하게, 전문 표시 */}
              <div className="text-sm space-y-2.5">
                {char.toneTrait && (
                  <div className="text-dark-text-muted leading-relaxed">
                    <span className="font-semibold text-dark-text">특징</span>
                    <br />
                    {char.toneTrait}
                  </div>
                )}
                {char.worldviewStory && (
                  <div className="text-dark-text-muted leading-relaxed">
                    <span className="font-semibold text-dark-text">세계관 스토리</span>
                    <br />
                    {char.worldviewStory}
                    {char.worldviewQuote && (
                      <div className="mt-1.5 pl-3 border-l-2 border-brand-blue/50 italic text-brand-blue">
                        "{char.worldviewQuote}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {expanded && (
                <div className="mt-3 space-y-2 animate-fade-in">
                  <div className="flex flex-wrap gap-1">
                    {(char.personalityKeywords || []).map((kw) => (
                      <span key={kw} className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full">
                        #{kw}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-dark-text-muted space-y-1">
                    <div><strong>역할:</strong> {char.role || '-'}</div>
                    <div><strong>톤:</strong> {char.tone || '-'}</div>
                    <div><strong>성별:</strong> {char.gender || '-'}</div>
                    <div><strong>연령대:</strong> {char.ageGroup || '-'}</div>
                    <div><strong>유형:</strong> {char.type || '-'}</div>
                  </div>
                  <div className="text-xs text-status-approved">
                    생성 횟수: {char.generationCount}회
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
