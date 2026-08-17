import { useState } from "react";

// ─── 디자인 토큰 ───────────────────────────────────────────
const S = {
  bg: "#05090F",
  blue: "#00AEEF",
  blueGlow: "#00AEEF28",
  text: "#E8F0FF",
  muted: "#4E6880",
  mutedLight: "#7090B0",
  border: "#0E1B2E",
};

// ─── 캐릭터 데이터 ─────────────────────────────────────────
const chars = [
  {
    name: "한라", sub: "HALLA", symbol: "⛰",
    role: "모든 것의 시작",
    tags: ["따뜻함", "지혜", "수호", "근원"],
    quote: "내가 40만 년 전에 이 땅을 만든 건,\n너희를 위해서였어.",
    bg: "linear-gradient(150deg,#060F28 0%,#102040 100%)",
    accent: "#A8B8D0", gem: "#C8E0FF",
    story: "제주 땅을 설계한 어머니. 한라의 화산 지형이 없었다면, 용암해수도 소금도 존재하지 않았다. 모든 캐릭터의 근원이자 수호자.",
  },
  {
    name: "용암이", sub: "YONGAMI", symbol: "🌋",
    role: "바닷물을 용암해수로 변환",
    tags: ["보호", "원초적 힘", "용암"],
    quote: "내 몸을 통과한 것은,\n반드시 더 나은 것이 되어 나온다.",
    bg: "linear-gradient(150deg,#0E0000 0%,#380800 100%)",
    accent: "#FF4400", gem: "#FF6600",
    story: "40만 년간 식지 않은 심장. 바닷물이 용암이의 몸을 통과하는 순간, 그 물은 다른 어디에서도 만들어질 수 없는 것이 된다.",
  },
  {
    name: "해수", sub: "HAESU", symbol: "✦",
    role: "미네랄을 품는 조율자",
    tags: ["우아함", "미네랄", "프리미엄", "신비"],
    quote: "나는 제주 땅이 오랜 시간\n정성으로 빚어낸 존재야.",
    bg: "linear-gradient(150deg,#0D0520 0%,#281050 100%)",
    accent: "#B06EF5", gem: "#F472B6",
    story: "용암이를 통과하며 미네랄을 품게 된 제주 바닷물 소녀. 신비롭고 우아하게, 오늘도 조용히 세상을 조율한다.",
  },
  {
    name: "미내", sub: "MINAE", symbol: "☀",
    role: "결속과 응원",
    tags: ["밝음", "미네랄", "격려", "포용"],
    quote: "괜찮아, 내가 있잖아!\n같이 하면 돼!",
    bg: "linear-gradient(150deg,#180E00 0%,#3A2600 100%)",
    accent: "#FFD94A", gem: "#FF85B3",
    story: "용암이와 해수가 만나 태어난 존재. 팀 전체를 두루 챙기는 밝고 따뜻한 누나.",
  },
  {
    name: "현무", sub: "HYEONMU", symbol: "⬡",
    role: "결이 탄생 직전 마지막 수호",
    tags: ["신뢰", "정화", "단단함", "묵묵함"],
    quote: "나는 그냥\n여기 있었을 뿐이야.",
    bg: "linear-gradient(150deg,#020608 0%,#091520 100%)",
    accent: "#3A8FAA", gem: "#006D77",
    story: "제주 어디에나 있는 검은 돌. 가장 눈에 띄지 않지만, 현무가 버텨줬기에 결이는 순수할 수 있었다.",
  },
  {
    name: "가마할방", sub: "GAMAHALBAANG", symbol: "🪔",
    role: "정성으로 소금을 응축시키는 장인",
    tags: ["따뜻함", "장인정신", "정성"],
    quote: "서두르면 안 돼.\n정성이 소금을 만드는 거야.",
    bg: "linear-gradient(150deg,#160700 0%,#381808 100%)",
    accent: "#D2622A", gem: "#E8762A",
    story: "오랜 시간과 정성으로 용암해수를 소금으로 응축시키는 장인 할아버지. 결이를 세상에 내보낸 부모.",
  },
  {
    name: "불이", sub: "BURI", symbol: "🔥",
    role: "꺼지지 않는 열정의 불꽃",
    tags: ["열정", "에너지", "발랄함", "응원"],
    quote: "포기하면 불 꺼져!\n조금만 더 타오르자!",
    bg: "linear-gradient(150deg,#160300 0%,#400C00 100%)",
    accent: "#FF7722", gem: "#FF6B00",
    story: "가마할방 곁에서 꺼지지 않는 열정의 불꽃을 지켜온 소녀. 팀에서 가장 어리고 가장 뜨거운 응원단장.",
  },
  {
    name: "결이", sub: "GYEORI", symbol: "◈",
    role: "모든 여정의 최종 완성",
    tags: ["순수함", "완성", "꿈", "당참"],
    quote: "나는 제주의 모든 것이 모인 결정이야\n— 이제 내 차례야!",
    bg: "linear-gradient(150deg,#001222 0%,#002648 100%)",
    accent: "#00AEEF", gem: "#A8DEFF",
    story: "한라의 땅에서 시작된 모든 여정이 결정화된 순간. 제주소금의 브랜드 히어로이자 모든 정성의 완성.",
  },
];

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

// ─── 유틸 컴포넌트 ─────────────────────────────────────────
function Tag({ label, color }) {
  return (
    <span style={{
      fontSize: 9, padding: "3px 9px", borderRadius: 20,
      background: color + "16", color,
      border: `1px solid ${color}30`,
      letterSpacing: 0.5, whiteSpace: "nowrap",
      lineHeight: 1,
    }}>{label}</span>
  );
}

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

// ─── 캐릭터 카드 ───────────────────────────────────────────
function CharCard({ char }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: char.bg,
        border: `1px solid ${hov ? char.accent + "50" : "#0E1C30"}`,
        borderRadius: 18,
        padding: "28px 22px",
        transition: "all 0.25s ease",
        transform: hov ? "translateY(-5px)" : "none",
        boxShadow: hov ? `0 16px 44px ${char.gem}16` : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 심볼 */}
      <div style={{ fontSize: 28, marginBottom: 14, lineHeight: 1 }}>
        {char.symbol}
      </div>

      {/* 영문명 */}
      <div style={{
        fontSize: 9, letterSpacing: 3.5,
        color: char.accent, marginBottom: 5, fontWeight: 700,
      }}>{char.sub}</div>

      {/* 한국명 */}
      <div style={{
        fontSize: 24, fontWeight: 900,
        color: "#EEF4FF", marginBottom: 4, lineHeight: 1,
      }}>{char.name}</div>

      {/* 역할 */}
      <div style={{
        fontSize: 11, color: S.muted,
        marginBottom: 14, lineHeight: 1.5,
      }}>{char.role}</div>

      {/* 태그 */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
        {char.tags.map(t => <Tag key={t} label={t} color={char.accent} />)}
      </div>

      {/* 스토리 */}
      <div style={{
        fontSize: 12, color: S.mutedLight,
        lineHeight: 1.85, marginBottom: 16,
      }}>{char.story}</div>

      {/* 명대사 */}
      <div style={{
        fontSize: 12, color: "#B0C8E0",
        lineHeight: 1.85, fontStyle: "italic",
        paddingLeft: 12,
        borderLeft: `2px solid ${char.accent}40`,
        whiteSpace: "pre-line",
        marginBottom: 20,
      }}>"{char.quote}"</div>

      {/* 젬 라인 */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: 8, marginTop: "auto",
      }}>
        <Gem color={char.gem} size={11} />
        <div style={{
          height: 1, flex: 1,
          background: `linear-gradient(90deg, ${char.gem}55, transparent)`,
        }} />
      </div>
    </div>
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
                fontSize: 9, letterSpacing: 3,
                color: step.accent,
                marginBottom: 10, fontWeight: 700,
              }}>{step.phase}</div>
              <div style={{
                display: "flex", justifyContent: "center",
                gap: 5, flexWrap: "wrap", marginBottom: 10,
              }}>
                {step.charNames.map(n => (
                  <span key={n} style={{
                    fontSize: 14, fontWeight: 800,
                    color: "#EEF4FF", lineHeight: 1.2,
                  }}>{n}</span>
                ))}
              </div>
              <div style={{
                fontSize: 11, color: S.muted,
                lineHeight: 1.6,
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

// ─── 메인 ─────────────────────────────────────────────────
export default function BrandUniverse() {
  return (
    <div style={{
      background: S.bg, color: S.text, minHeight: "100vh",
      fontFamily: "'Noto Sans KR','Apple SD Gothic Neo',system-ui,sans-serif",
    }}>

      {/* ── 네비게이션 ── */}
      <nav style={{
        borderBottom: `1px solid ${S.border}`,
        padding: "0 40px",
        display: "flex", alignItems: "center",
        height: 60, gap: 8,
        position: "sticky", top: 0,
        background: "#05090FEE",
        backdropFilter: "blur(14px)",
        zIndex: 100,
      }}>
        <span style={{ color: S.muted, fontSize: 13 }}>제주소금</span>
        <span style={{ color: "#152030", margin: "0 8px" }}>|</span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: S.blue,
          borderBottom: `2px solid ${S.blue}`, paddingBottom: 2,
        }}>브랜드 세계관</span>
      </nav>

      {/* ── 히어로 ── */}
      <section style={{
        padding: "100px 40px 80px",
        textAlign: "center",
        position: "relative", overflow: "hidden",
        background: "linear-gradient(180deg,#030810 0%,#05090F 100%)",
      }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 520, height: 240,
          background: `radial-gradient(ellipse, ${S.blueGlow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{
          fontSize: 10, letterSpacing: 6,
          color: S.blue, marginBottom: 20, fontWeight: 600,
        }}>JEJU LAVA SEA SALT</div>
        <h1 style={{
          fontSize: "clamp(40px,6vw,70px)",
          fontWeight: 900, margin: "0 0 20px",
          lineHeight: 1.1, color: "#EEF4FF", letterSpacing: -1.5,
        }}>브랜드 세계관</h1>
        <p style={{
          fontSize: 15, color: S.muted,
          lineHeight: 2, margin: 0,
        }}>
          40만 년의 여정 — 제주 화산이 만들어낸 여덟 존재들
        </p>
      </section>

      {/* ── 캐릭터 갤러리 ── */}
      <section style={{
        padding: "70px 40px",
        maxWidth: 1200, margin: "0 auto",
      }}>
        <h2 style={{
          fontSize: 26, fontWeight: 900,
          margin: "0 0 10px", color: "#EEF4FF",
        }}>여덟 존재들</h2>
        <p style={{
          fontSize: 13, color: S.muted,
          margin: "0 0 36px", lineHeight: 1.6,
        }}>
          제주소금의 브랜드 세계관을 이루는 여덟 캐릭터입니다.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(265px, 1fr))",
          gap: 16,
        }}>
          {chars.map(c => <CharCard key={c.name} char={c} />)}
        </div>
      </section>

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
          fontSize: 15, color: S.muted,
          lineHeight: 2.2, margin: 0,
        }}>
          제주 화산이 폭발한 그 순간부터 시작된 하나의 여정.<br />
          바닷물 한 방울이 화산암반을 통과하고, 미네랄을 품고,<br />
          정화되고, 정성껏 응축되어 — 마침내 세상에서 가장<br />
          순수한 소금 결정이 되기까지.<br /><br />
          이 기적 같은 여정에 여덟 존재가 함께했다.<br />
          그들의 이야기가 곧 제주소금의 이야기다.
        </p>
      </section>

      {/* ── 여정 플로우 ── */}
      <section style={{
        padding: "10px 40px 100px",
        maxWidth: 1120, margin: "0 auto",
      }}>
        <div style={{
          fontSize: 10, letterSpacing: 5,
          color: S.muted, marginBottom: 30,
          fontWeight: 600, textAlign: "center",
        }}>소금이 태어나는 여정</div>
        <JourneyFlow />
        <p style={{
          fontSize: 11, color: "#2E4560",
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
          fontSize: "clamp(14px,2vw,18px)",
          color: S.muted, lineHeight: 2.2,
          maxWidth: 500, margin: "0 auto 30px",
        }}>
          제주에서만, 이 땅에서만 만들어질 수 있는 소금.<br />
          여덟 존재의 이야기는 오늘도 계속된다.
        </p>
        <div style={{
          fontSize: 10, letterSpacing: 5,
          color: S.blue, fontWeight: 600,
        }}>JEJU LAVA SEA SALT</div>
      </section>

    </div>
  );
}
