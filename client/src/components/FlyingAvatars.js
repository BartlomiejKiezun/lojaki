import { useEffect, useState } from "react";

function FlyingAvatars({ avatars = [], style = "explode", duration = 3000, onEnd }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!avatars || avatars.length === 0) return;
    const newItems = avatars.map((av, i) => ({
      id: `${Date.now()}-${i}`,
      avatar: av.avatar,
      name: av.name,
      delay: Math.random() * 0.4,
      tx: (Math.random() - 0.5) * 100,
      ty: (Math.random() - 0.5) * 100,
      rot: (Math.random() - 0.5) * 720,
      scale: 0.8 + Math.random() * 0.8,
      animClass: pickAnimation(style, i)
    }));
    setItems(newItems);
    const t = setTimeout(() => { setItems([]); onEnd?.(); }, duration);
    return () => clearTimeout(t);
  }, [avatars, style, duration, onEnd]);

  if (items.length === 0) return null;

  return (
    <div className="flying-avatars-overlay">
      {items.map(item => (
        <div
          key={item.id}
          className={`flying-avatar ${item.animClass}`}
          style={{
            "--tx": `${item.tx}vw`,
            "--ty": `${item.ty}vh`,
            "--rot": `${item.rot}deg`,
            "--scale": item.scale,
            "--delay": `${item.delay}s`
          }}
        >
          {item.avatar ? (
            <img src={item.avatar} alt="" className="flying-avatar-img" />
          ) : (
            <div className="flying-avatar-fallback">{item.name?.[0] || "?"}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function pickAnimation(style, i) {
  if (style === "wave") return "fly-wave";
  if (style === "bounce") return "fly-bounce";
  if (style === "spin") return "fly-spin";
  if (style === "drunk") return "fly-drunk";
  return i % 2 === 0 ? "fly-explode" : "fly-explode-2";
}

export default FlyingAvatars;
