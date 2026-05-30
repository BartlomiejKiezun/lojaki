import { useEffect, useState } from "react";
import Avatar from "./Avatar";

const STYLES = ["rotate", "bounce", "drunk", "spinin", "wave"];

function FlyingAvatars({ players, trigger }) {
  const [style] = useState(() => STYLES[Math.floor(Math.random() * STYLES.length)]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible || !players?.length) return null;

  const alive = players.filter(p => !p.eliminated);
  if (!alive.length) return null;

  if (style === "wave") {
    const picks = [...alive].sort(() => Math.random() - 0.5).slice(0, 3);
    return (
      <>
        {picks.map((p, i) => (
          <div key={p.id + "-" + trigger} className={`flying-avatar style-wave-${i + 1}`}>
            <Avatar src={p.avatar} name={p.name} size="big" />
          </div>
        ))}
      </>
    );
  }

  const pick = alive[Math.floor(Math.random() * alive.length)];
  return (
    <div key={pick.id + "-" + trigger} className={`flying-avatar style-${style}`}>
      <Avatar src={pick.avatar} name={pick.name} size="big" />
    </div>
  );
}

export default FlyingAvatars;
