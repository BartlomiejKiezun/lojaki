import { useEffect, useState } from "react";

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#a855f7","#06b6d4","#f97316"];

function ConfettiBurst({ trigger, count = 40, duration = 3 }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    const generated = Array.from({ length: count }, (_, i) => ({
      id: i + "-" + trigger,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      duration: 1.5 + Math.random() * 2,
      delay: Math.random() * 0.6,
      size: 6 + Math.random() * 8,
      rotate: Math.random() * 360,
      shape: Math.random() > 0.5 ? "50%" : "2px"
    }));
    setPieces(generated);
    const t = setTimeout(() => setPieces([]), duration * 1000 + 500);
    return () => clearTimeout(t);
  }, [trigger, count, duration]);

  return (
    <>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.size,
            height: p.size,
            borderRadius: p.shape,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`
          }}
        />
      ))}
    </>
  );
}

export default ConfettiBurst;
