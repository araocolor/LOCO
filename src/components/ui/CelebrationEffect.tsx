"use client";

import { useEffect, useState } from "react";

function playCoinSound() {
  try {
    const audio = new Audio("/sound/loco_charging.mp3");
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  speed: number;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle";
}

const COLORS = ["#fee500", "#ff6b6b", "#4ecdc4", "#45b7d1", "#f9ca24", "#ff9ff3", "#54a0ff", "#5f27cd"];

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 20,
    y: 50 + (Math.random() - 0.5) * 10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 4 + Math.random() * 6,
    angle: Math.random() * Math.PI * 2,
    speed: 2 + Math.random() * 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 15,
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));
}

export default function CelebrationEffect({ onDone }: { onDone?: () => void }) {
  const [particles] = useState(() => createParticles(30));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    playCoinSound();
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => {
        const tx = Math.cos(p.angle) * p.speed * 40;
        const ty = Math.sin(p.angle) * p.speed * 40 - 60;
        return (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.shape === "rect" ? p.size * 1.5 : p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === "circle" ? "50%" : "2px",
              transform: `rotate(${p.rotation}deg)`,
              animation: `confetti-burst 1.2s ease-out forwards`,
              "--tx": `${tx}px`,
              "--ty": `${ty}px`,
              "--r": `${p.rotation + p.rotationSpeed * 20}deg`,
            } as React.CSSProperties}
          />
        );
      })}
      <style jsx>{`
        @keyframes confetti-burst {
          0% {
            opacity: 1;
            transform: translate(0, 0) rotate(var(--r, 0deg)) scale(1);
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx, 0px), var(--ty, 0px)) rotate(var(--r, 180deg)) scale(0.3);
          }
        }
      `}</style>
    </div>
  );
}
