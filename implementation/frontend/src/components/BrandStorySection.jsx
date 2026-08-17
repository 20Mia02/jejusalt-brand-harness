/**
 * frontend/components/BrandStorySection.jsx
 *
 * docs/guides/brand-universe-final.jsx 시안 중 "브랜드 스토리 + 여정 플로우 + 클로징"
 * 섹션만 그대로 가져온 컴포넌트. 히어로/네비게이션/캐릭터 카드 그리드는 기존 것을
 * 그대로 쓰므로 여기서는 다루지 않는다 — 기존 캐릭터 갤러리(CharacterGallery) 바로
 * 아래에 이어붙여 렌더링된다.
 */

// ─── 디자인 토큰 ───────────────────────────────────────────
const S = {
  bg: "#05090F",
  blue: "#00AEEF",
  blueGlow: "#00AEEF28",
  text: "#E8F0FF",
  muted: "#A9C0D8",
  mutedLight: "#C6D8EA",
  border: "#0E1B2E",
};

// ─── 여정 데이터 (브랜드 세계관 기반) ─────────────────────
const journey = [
  {
    phase: "탄생", charNames: ["한라"],
    accent: "#A8B8D0", border: "#1B2E5E",
    desc: "화산이 제주를 설계하다",
  },
  {
    phase: "변환", charNames: ["용암이", "해수"],
    accent: "#FF6633", border: "#AA2200",
    desc: "바닷물이 용암해수가 되다",
  },
  {
    phase: "정화", charNames: ["현무"],
    accent: "#3A9BB8", border: "#0D4A5E",
    desc: "화산암반이 순수함을 지키다",
  },
  {
    phase: "응축", charNames: ["가마할방", "불이"],
    accent: "#E8762A", border: "#7A3010",
    desc: "정성으로 소금을 빚어내다",
  },
  {
    phase: "완성", charNames: ["결이"],
    accent: "#00AEEF", border: "#005A99",
    desc: "순수한 결정이 세상에 나오다",
  },
];

function Gem({ color, size = 13 }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 13 15" style={{ display: "block", flexShrink: 0 }}>
      <polygon
        points="6.5,0 13,5 10,15 3,15 0,5"
        fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
      />
    </svg>
  );
}

function Divider() {
  return (
    <div style={{
      height: 1, margin: "0 40px",
      background: `linear-gradient(90deg,transparent,${S.blue}30,transparent)`,
    }} />
  );
}

// ─── 여정 플로우 ───────────────────────────────────────────
function JourneyFlow() {
  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{
        display: "flex", alignItems: "stretch",
        minWidth: 680, gap: 0,
      }}>
        {journey.map((step, i) => (
          <div key={step.phase} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{
              flex: 1,
              background: `linear-gradient(150deg, ${step.border}25, ${step.border}0A)`,
              border: `1px solid ${step.border}50`,
              borderRadius: 14,
              padding: "24px 14px",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 11, letterSpacing: 3,
                color: step.accent,
                marginBottom: 12, fontWeight: 800,
              }}>{step.phase}</div>
              <div style={{
                display: "flex", justifyContent: "center",
                gap: 5, flexWrap: "wrap", marginBottom: 10,
              }}>
                {step.charNames.map(n => (
                  <span key={n} style={{
                    fontSize: 16, fontWeight: 800,
                    color: "#FFFFFF", lineHeight: 1.2,
                  }}>{n}</span>
                ))}
              </div>
              <div style={{
                fontSize: 13, color: S.muted,
                lineHeight: 1.6, fontWeight: 500,
              }}>{step.desc}</div>
            </div>
            {i < journey.length - 1 && (
              <div style={{
                width: 28, flexShrink: 0,
                display: "flex", alignItems: "center",
                justifyContent: "center",
                color: "#1E3050", fontSize: 18,
              }}>›</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BrandStorySection() {
  return (
    <div style={{
      background: S.bg, color: S.text,
      fontFamily: "'Noto Sans KR','Apple SD Gothic Neo',system-ui,sans-serif",
    }}>
      <Divider />

      {/* ── 브랜드 스토리 ── */}
      <section style={{
        padding: "100px 40px 70px",
        maxWidth: 720, margin: "0 auto", textAlign: "center",
      }}>
        <div style={{
          fontSize: 10, letterSpacing: 5,
          color: S.blue, marginBottom: 28, fontWeight: 600,
        }}>BRAND UNIVERSE</div>
        <h2 style={{
          fontSize: "clamp(30px,4vw,50px)",
          fontWeight: 900, lineHeight: 1.25,
          color: "#EEF4FF", marginBottom: 40,
          letterSpacing: -0.5,
        }}>
          40만 년 전,<br />제주 땅 깊은 곳에서<br />시작된 이야기
        </h2>
        <p style={{
          fontSize: 17, color: S.mutedLight,
          lineHeight: 2, margin: "0 0 30px", fontWeight: 400,
        }}>
          제주 화산이 폭발한 순간부터 시작된 하나의 여정.
          바닷물 한 방울이 화산암반을 통과해 미네랄을 머금고,
          고요히 정화되어 정성껏 응축되는 과정을 거쳐 —
          마침내 세상에서 가장 순수한 소금 결정이 된다.
        </p>
        <p style={{
          fontSize: 18, color: S.blue,
          lineHeight: 1.8, margin: 0,
          fontWeight: 700, letterSpacing: -0.2,
        }}>
          이 기적 같은 여정을, 여덟 존재가 함께 걸어왔다.
        </p>
      </section>

      {/* ── 여정 플로우 ── */}
      <section style={{
        padding: "10px 40px 100px",
        maxWidth: 1120, margin: "0 auto",
      }}>
        <div style={{
          fontSize: 12, letterSpacing: 4,
          color: S.mutedLight, marginBottom: 30,
          fontWeight: 700, textAlign: "center",
        }}>소금이 태어나는 여정</div>
        <JourneyFlow />
        <p style={{
          fontSize: 12, color: S.muted,
          textAlign: "center", marginTop: 20,
          lineHeight: 1.8,
        }}>
          * 브랜드 세계관을 바탕으로 한 스토리텔링입니다.
        </p>
      </section>

      <Divider />

      {/* ── 클로징 ── */}
      <section style={{
        padding: "90px 40px 110px",
        textAlign: "center",
        background: "linear-gradient(180deg,#05090F 0%,#030710 100%)",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center",
          gap: 10, marginBottom: 30,
        }}>
          <Gem color={S.blue} size={11} />
          <Gem color={S.blue} size={15} />
          <Gem color={S.blue} size={11} />
        </div>
        <p style={{
          fontSize: "clamp(16px,2.2vw,20px)",
          color: S.mutedLight, lineHeight: 2.1, fontWeight: 500,
          maxWidth: 520, margin: "0 auto 30px",
        }}>
          제주에서만, 이 땅에서만 만들어질 수 있는 소금.<br />
          여덟 존재의 이야기는 오늘도 계속된다.
        </p>
        <div style={{
          fontSize: 11, letterSpacing: 5,
          color: S.blue, fontWeight: 700,
        }}>JEJU LAVA SEA SALT</div>
      </section>
    </div>
  );
}
