import { useEffect, useState, useRef } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";
import PlayerScores from "./PlayerScores";
import Scoreboard from "./Scoreboard";

const AVATAR_STYLES = ["rotate", "bounce", "drunk", "spinin", "wave"];

function FlyingAvatars({ players }) {
  const [style] = useState(() => AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(t);
  }, []);

  if (!visible || !players?.length) return null;

  const alive = players.filter(p => !p.eliminated);
  if (!alive.length) return null;

  if (style === "wave") {
    // 3 losowych avatarów lecą jeden po drugim
    const picks = [...alive].sort(() => Math.random() - 0.5).slice(0, 3);
    return (
      <>
        {picks.map((p, i) => (
          <div key={p.id} className={`flying-avatar style-wave-${i + 1}`}>
            <Avatar src={p.avatar} name={p.name} size="big" />
          </div>
        ))}
      </>
    );
  }

  const pick = alive[Math.floor(Math.random() * alive.length)];
  return (
    <div className={`flying-avatar style-${style}`}>
      <Avatar src={pick.avatar} name={pick.name} size="big" />
    </div>
  );
}

function Announcing({ state }) {
  const [timeLeft, setTimeLeft] = useState(state.phaseData?.timeLeft ?? 5);

  useEffect(() => {
    const handler = (t) => setTimeLeft(t);
    socket.on("timer_tick", handler);
    return () => socket.off("timer_tick", handler);
  }, []);

  useEffect(() => {
    setTimeLeft(state.phaseData?.timeLeft ?? 5);
  }, [state.phaseData?.nextGame]);

  const data = state.phaseData;
  if (!data) return <div className="screen">Ładowanie...</div>;

  const isLast = timeLeft <= 2;
  const saboLeads = state.scoreSabo > state.scoreGracze;

  return (
    <div className="screen center announcing-screen">
      <FlyingAvatars players={state.players} key={data.nextGame} />

      <div className="card big-card announcing-card">
        <p className="muted">Za chwilę startujemy...</p>
        <div className={`announcing-countdown ${isLast ? "last" : ""}`}>
          {timeLeft}
        </div>
        <h1 className="announcing-game-name pop-in">{data.nextGameName}</h1>

        {state.mode === "points" ? (
          <PlayerScores state={state} showEndButton />
        ) : (
          <Scoreboard state={state} />
        )}

        {saboLeads && state.mode !== "points" && <FireEffect />}
      </div>
    </div>
  );
}

function FireEffect() {
  const emojis = ["🔥","💥","🌋","😈","⚡"];
  const pieces = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    left: 5 + Math.random() * 90,
    top: 10 + Math.random() * 30,
    duration: 0.8 + Math.random() * 1.2,
    delay: Math.random() * 0.8,
    size: 16 + Math.random() * 14
  }));

  return (
    <>
      {pieces.map(p => (
        <div key={p.id} className="fire-piece" style={{
          left: `${p.left}%`,
          top: `${p.top}%`,
          fontSize: p.size,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`
        }}>
          {p.emoji}
        </div>
      ))}
    </>
  );
}

export default Announcing;
