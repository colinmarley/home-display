"use client";

import { useEffect, useState } from "react";
import type { SpecialDate } from "@/lib/types";

// Full-screen surprise for a special date (birthdays, anniversaries).
// Generalized from the original May 16 birthday overlay; text and theme come
// from settings.specialDates.

interface Theme {
  floaters: string[];
  corners: string;
  background: string;
  ink: string;
  inkSoft: string;
  shadow: string;
}

const THEMES: Record<SpecialDate["theme"], Theme> = {
  pink: {
    floaters: ["❤️", "🌸", "💕", "🌺", "💖", "🌷", "💗", "🫶", "🌹", "🎀"],
    corners: "🌸🌺🌷",
    background: "linear-gradient(160deg, #ff69b4 0%, #ffb6c1 35%, #ffc0cb 60%, #ff85a1 100%)",
    ink: "#7b0038",
    inkSoft: "#6b0030",
    shadow: "rgba(200,0,80,0.25)",
  },
  gold: {
    floaters: ["🎉", "✨", "🎊", "⭐", "🥳", "🎈", "💛", "🌟"],
    corners: "🎉✨🎊",
    background: "linear-gradient(160deg, #f9a825 0%, #ffd54f 40%, #ffe082 65%, #ffb300 100%)",
    ink: "#5d3a00",
    inkSoft: "#6d4c00",
    shadow: "rgba(150,90,0,0.25)",
  },
  blue: {
    floaters: ["💙", "🎈", "⭐", "🎉", "🌊", "✨", "🦋", "🎁"],
    corners: "🎈💙🎁",
    background: "linear-gradient(160deg, #1e88e5 0%, #64b5f6 40%, #90caf9 65%, #42a5f5 100%)",
    ink: "#0d2a4f",
    inkSoft: "#123a6b",
    shadow: "rgba(0,60,140,0.25)",
  },
};

const CORNERS: Array<{ top?: number; bottom?: number; left?: number; right?: number }> = [
  { top: 10, left: 10 },
  { top: 10, right: 10 },
  { bottom: 10, left: 10 },
  { bottom: 10, right: 10 },
];

function particles(floaters: string[]) {
  return Array.from({ length: 24 }, (_, i) => ({
    id: i,
    emoji: floaters[i % floaters.length],
    left: 4 + (i / 24) * 92,
    delay: (i * 0.35) % 3.5,
    duration: 4 + (i % 4),
    size: 1.2 + (i % 3) * 0.5,
  }));
}

function lines(text: string) {
  return text.split("\n").map((l, i, all) => (
    <span key={i}>
      {l}
      {i < all.length - 1 && <br />}
    </span>
  ));
}

export default function SpecialOverlay({ special, onDismiss }: { special: SpecialDate; onDismiss: () => void }) {
  const theme = THEMES[special.theme] ?? THEMES.pink;
  const [floaters] = useState(() => particles(theme.floaters));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: theme.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 55,
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

      {floaters.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            bottom: "-10%",
            fontSize: `${p.size}rem`,
            animation: `floatUp ${p.duration}s ${p.delay}s ease-in infinite`,
            pointerEvents: "none",
          }}
        >
          {p.emoji}
        </div>
      ))}

      {CORNERS.map((pos, i) => (
        <div key={i} style={{ position: "absolute", ...pos, fontSize: "1.8rem", opacity: 0.55, pointerEvents: "none", lineHeight: 1 }}>
          {theme.corners}
        </div>
      ))}

      <div
        style={{
          background: "rgba(255,255,255,0.38)",
          backdropFilter: "blur(8px)",
          borderRadius: "24px",
          padding: "28px 32px",
          textAlign: "center",
          maxWidth: "420px",
          width: "85%",
          boxShadow: `0 8px 32px ${theme.shadow}`,
          animation: "heartbeat 2s ease-in-out infinite",
          border: "2px solid rgba(255,255,255,0.65)",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "8px" }}>{special.emoji === "🌸" ? "🎂" : special.emoji}</div>
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: theme.ink,
            lineHeight: 1.2,
            marginBottom: "12px",
            textShadow: "0 1px 6px rgba(255,255,255,0.7)",
          }}
        >
          {lines(special.title)}
        </div>
        {special.message && (
          <div style={{ fontSize: "1rem", color: theme.inkSoft, lineHeight: 1.55, marginBottom: "14px", fontStyle: "italic" }}>
            {lines(special.message)}
          </div>
        )}
        {special.signoff && (
          <div style={{ fontSize: "1rem", color: theme.ink, fontWeight: 700, letterSpacing: "0.03em" }}>{special.signoff}</div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "16px",
          fontSize: "0.7rem",
          color: theme.inkSoft,
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
