"use client";

import { useEffect, useState } from "react";

const FLOATERS = ["❤️", "🌸", "💕", "🌺", "💖", "🌷", "💗", "🫶", "🌹", "🎀"];

interface Particle {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

function makeParticles(): Particle[] {
  return Array.from({ length: 24 }, (_, i) => ({
    id: i,
    emoji: FLOATERS[i % FLOATERS.length],
    left: 4 + (i / 24) * 92,
    delay: (i * 0.35) % 3.5,
    duration: 4 + (i % 4),
    size: 1.2 + (i % 3) * 0.5,
  }));
}

const CORNERS: Array<{ top?: number; bottom?: number; left?: number; right?: number }> = [
  { top: 10, left: 10 },
  { top: 10, right: 10 },
  { bottom: 10, left: 10 },
  { bottom: 10, right: 10 },
];

export default function BirthdaySurprise({ onDismiss }: { onDismiss: () => void }) {
  const [particles] = useState(makeParticles);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onPointerDown={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(160deg, #ff69b4 0%, #ffb6c1 35%, #ffc0cb 60%, #ff85a1 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 999,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) rotate(0deg);        opacity: 1; }
          80%  { opacity: 0.7; }
          100% { transform: translateY(-115vh) rotate(720deg); opacity: 0; }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.05); }
        }
        @keyframes fadeHint {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.75; }
        }
      `}</style>

      {/* Floating emojis */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            bottom: "-10%",
            fontSize: `${p.size}rem`,
            animation: `floatUp ${p.duration}s ${p.delay}s ease-in infinite`,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Corner flower clusters */}
      {CORNERS.map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...pos,
            fontSize: "1.8rem",
            opacity: 0.55,
            pointerEvents: "none",
            lineHeight: 1,
          }}
        >
          🌸🌺🌷
        </div>
      ))}

      {/* Main card */}
      <div
        style={{
          background: "rgba(255,255,255,0.38)",
          backdropFilter: "blur(8px)",
          borderRadius: "24px",
          padding: "36px 32px",
          textAlign: "center",
          maxWidth: "340px",
          width: "85%",
          boxShadow: "0 8px 32px rgba(200,0,80,0.25)",
          animation: "heartbeat 2s ease-in-out infinite",
          border: "2px solid rgba(255,255,255,0.65)",
        }}
      >
        <div style={{ fontSize: "3.5rem", marginBottom: "10px" }}>🎂</div>
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#7b0038",
            lineHeight: 1.2,
            marginBottom: "14px",
            textShadow: "0 1px 6px rgba(255,255,255,0.7)",
          }}
        >
          Happy Birthday
          <br />
          Christine!
        </div>
        <div
          style={{
            fontSize: "1.05rem",
            color: "#6b0030",
            lineHeight: 1.65,
            marginBottom: "16px",
            fontStyle: "italic",
          }}
        >
          I love you more than words can say.
          <br />
          I’m so incredibly proud of you for stepping out in faith and getting
          baptized this year, and for leading a small group of women at church
          who share a heart for learning about God and living the life He wants.
          <br />
          You are the greatest mom to Daisy, and we all love you so much.
        </div>
        <div
          style={{
            fontSize: "1rem",
            color: "#7b0038",
            fontWeight: 700,
            letterSpacing: "0.03em",
          }}
        >
          Love, Colin ❤️
        </div>
      </div>

      {/* Dismiss hint */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          fontSize: "0.65rem",
          color: "rgba(90,0,40,0.6)",
          letterSpacing: "0.05em",
          animation: "fadeHint 2.5s ease-in-out infinite",
          pointerEvents: "none",
        }}
      >
        tap anywhere to continue
      </div>
    </div>
  );
}
