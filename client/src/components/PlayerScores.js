import { socket } from "../socket";
import Avatar from "./Avatar";

function PlayerScores({ state, showEndButton = false }) {
  if (state.mode !== "points") return null;

  const isHost = state.myId === state.hostId;
  const sorted = [...state.players]
    .map(p => ({ ...p, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="player-scores-panel">
      <h3 className="muted small">🏆 Punkty graczy</h3>
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
      {showEndButton && isHost && (
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm("Zakończyć grę i pokazać wyniki?")) {
              socket.emit("end_game_host");
            }
          }}
        >
          🏁 Zakończ grę
        </button>
      )}
    </div>
  );
}

export default PlayerScores;
