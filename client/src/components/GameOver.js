import { useEffect, useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";

const CONFETTI_COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#a855f7","#06b6d4","#f97316"];

function useConfetti(active) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!active) return;
    const generated = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      duration: 2 + Math.random() * 2.5,
      delay: Math.random() * 1.5,
      size: 8 + Math.random() * 10,
      rotate: Math.random() * 360,
      shape: Math.random() > 0.5 ? "50%" : "2px"
    }));
    setPieces(generated);
    const t = setTimeout(() => setPieces([]), 5000);
    return () => clearTimeout(t);
  }, [active]);

  return pieces;
}

function GameOver({ state }) {
  const winners = state.winner;
  const me = state.players.find(p => p.id === state.myId);
  const isHost = me?.id === state.hostId;
  const isPointsMode = state.mode === "points";
  const playersWon = winners === "players";

  // W trybie punktowym wygrywa kto ma najwięcej punktów
  const sorted = [...state.players]
    .map(p => ({ ...p, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const iWonPoints = isPointsMode && winner?.id === state.myId;

  const iWon = isPointsMode
    ? iWonPoints
    : (playersWon ? state.myRole === "player" : state.myRole === "saboteur");

  const confetti = useConfetti(iWon);

  return (
    <div className={`screen center game-over-screen ${iWon ? "good-bg" : "bad-bg"}`}>

      {confetti.map(p => (
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

      <div className="card big-card pop-in">
        <h1 className="huge">{iWon ? "🎉 WYGRAŁEŚ!" : "😢 KONIEC GRY"}</h1>

        {isPointsMode ? (
          <>
            <h2>🏆 Zwycięzca: {winner?.name}</h2>
            <p className="muted">Z wynikiem {winner?.score} punktów</p>
            <div className="role-summary">
              <h3>Ranking końcowy:</h3>
              {sorted.map((p, i) => (
                <div key={p.id} className="role-row-with-avatar fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                  <span className="rank-num">{i + 1}.</span>
                  <Avatar src={p.avatar} name={p.name} size="small" />
                  <span className="role-row-name">{p.name}</span>
                  <span className="player-text">{p.score} pkt</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2>{playersWon ? "✅ Gracze wygrali!" : "🧨 Sabotażyści wygrali!"}</h2>
            <p>
              {playersWon
                ? "Wszyscy sabotażyści zostali wykryci."
                : "Sabotażyści przejęli kontrolę."}
            </p>
            <div className="role-summary">
              <h3>Role wszystkich graczy:</h3>
              {state.players.map((p, i) => (
            <div
              key={p.id}
              className="role-row-with-avatar fade-in-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <Avatar src={p.avatar} name={p.name} size="small" />
              <span className="role-row-name">{p.name}</span>
              <span className={p.role === "saboteur" ? "saboteur-text" : "player-text"}>
                {p.role === "saboteur" ? "🧨 Sabotażysta" : "✅ Gracz"}
              </span>
            </div>
          ))}
        </div>

        <div className="score-bar">
          <div className="score-side good">
            <div className="score-label">Gracze</div>
            <div className="score-value">{state.scoreGracze}</div>
          </div>
          <div className="score-side bad">
            <div className="score-label">Sabotażyści</div>
            <div className="score-value">{state.scoreSabo}</div>
          </div>
        </div>
        </>
        )}

        {isHost && (
          <button className="btn btn-primary big" onClick={() => socket.emit("back_to_lobby")}>
            🔄 Nowa gra
          </button>
        )}
        {!isHost && (
          <p className="muted">Czekaj aż host rozpocznie nową grę...</p>
        )}
      </div>
    </div>
  );
}

export default GameOver;
