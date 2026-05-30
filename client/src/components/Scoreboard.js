import Avatar from "./Avatar";

function Scoreboard({ state, compact = false }) {
  if (state.mode === "points") {
    const sorted = [...state.players]
      .map(p => ({ ...p, score: p.score || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, compact ? 5 : 99);

    return (
      <div className="scoreboard-points">
        <div className="player-scores-list">
          {sorted.map((p, i) => (
            <div key={p.id} className={`player-score-row ${p.id === state.myId ? "is-me" : ""}`}>
              <span className="ps-rank">{i + 1}.</span>
              <Avatar src={p.avatar} name={p.name} size="small" />
              <span className="ps-name">{p.name}</span>
              <span className="ps-score">{p.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
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
  );
}

export default Scoreboard;
