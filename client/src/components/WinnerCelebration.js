import { useEffect, useState } from "react";
import Avatar from "./Avatar";

const COLORS = ["#fbbf24","#22c55e","#ef4444","#a855f7","#06b6d4","#f97316","#ec4899","#6366f1"];

function WinnerCelebration({ winner, trigger, duration = 2800 }) {
  const [visible, setVisible] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [stars, setStars] = useState([]);

  useEffect(() => {
    if (!winner || !trigger) return;
    setVisible(true);

    // Konfetti
    const conf = Array.from({ length: 60 }, (_, i) => ({
      id: i + "-" + trigger,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      duration: 1.5 + Math.random() * 2,
      delay: Math.random() * 0.6,
      size: 8 + Math.random() * 10,
      rotate: Math.random() * 360,
      shape: Math.random() > 0.5 ? "50%" : "2px"
    }));
    setConfetti(conf);

    // Gwiazdki dookoła avatara
    const st = Array.from({ length: 12 }, (_, i) => ({
      id: i + "-s-" + trigger,
      angle: (i * 360) / 12,
      delay: i * 0.05
    }));
    setStars(st);

    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [winner, trigger, duration]);

  if (!visible || !winner) return null;

  return (
    <div className="winner-celebration">
      {/* Konfetti */}
      {confetti.map(c => (
        <div
          key={c.id}
          className="celebration-confetti"
          style={{
            left: `${c.left}%`,
            background: c.color,
            width: c.size,
            height: c.size,
            borderRadius: c.shape,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
            transform: `rotate(${c.rotate}deg)`
          }}
        />
      ))}

      {/* Główny avatar zwycięzcy - duży, w centrum */}
      <div className="celebration-winner-wrapper">
        <div className="celebration-glow"></div>
        <div className="celebration-avatar">
          <Avatar src={winner.avatar} name={winner.name} size="huge" />
        </div>
        <div className="celebration-name">{winner.name}</div>
        <div className="celebration-plus">+1</div>

        {/* Gwiazdki wokół avatara */}
        {stars.map(s => (
          <div
            key={s.id}
            className="celebration-star"
            style={{
              transform: `rotate(${s.angle}deg)`,
              animationDelay: `${s.delay}s`
            }}
          >
            ⭐
          </div>
        ))}
      </div>
    </div>
  );
}

export default WinnerCelebration;