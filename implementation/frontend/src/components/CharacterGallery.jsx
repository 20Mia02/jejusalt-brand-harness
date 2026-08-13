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

function transformCharacter(raw) {
  // API 응답 필드를 UI 표시용 필드로 변환
  const traits = Array.isArray(raw.personality_traits) ? raw.personality_traits : [];
  const roleTags = raw.role ? raw.role.split('·').map(s => s.trim()).filter(Boolean) : [];
  const allKeywords = [...traits, ...roleTags];

  return {
    id: raw.id,
    name: raw.character_name,
    description: raw.character_profile || raw.visual_description || raw.visualIdentity || '',
    referenceImageUrl: raw.reference_image_url,
    personalityKeywords: allKeywords,
    currentVersion: raw.source === 'default' ? null : '사용자 생성',
    tone: raw.tone_trait || raw.role || '',
    generationCount: raw.generation_count || 0,
    role: raw.role || '',
    gender: raw.gender || '',
    ageGroup: raw.ageGroup || '',
    type: raw.type || '',
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
        setCharacters(rawChars.map(transformCharacter));
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {characters.map((char) => {
          const expanded = expandedId === char.id;
          return (
            <div
              key={char.id}
              className={`border rounded-xl p-3 bg-dark-bg transition cursor-pointer ${
                expanded ? 'border-brand-blue col-span-2 row-span-2' : 'border-brand-blue/10 hover:border-brand-blue/40'
              }`}
              onClick={() => setExpandedId(expanded ? null : char.id)}
            >
              <div className="w-full aspect-square bg-dark-chip rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                {char.referenceImageUrl ? (
                  <ReferenceMedia url={char.referenceImageUrl} alt={char.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-dark-text-muted">아직 생성 안 됨</span>
                )}
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm">{char.name}</span>
                {char.currentVersion && (
                  <span className="text-[10px] bg-status-approved/10 text-status-approved px-1.5 py-0.5 rounded">
                    {char.currentVersion}
                  </span>
                )}
              </div>
              <div className="text-xs text-dark-text-muted line-clamp-2">{char.description}</div>

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
