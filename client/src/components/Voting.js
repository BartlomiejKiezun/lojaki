import { useEffect, useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";

function GameHistoryPanel({ gameHistory }) {
  const [openIdx, setOpenIdx] = useState(null);
  if (!gameHistory?.length) return null;

  return (
    <div className="game-history-panel">
      <h3 className="muted small">📊 Wyniki minigier</h3>
      {gameHistory.map((g, i) => (
        <div key={i} className="history-item">
          <button
            className="history-toggle"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <span>{g.name}</span>
            <span>{openIdx === i ? "▲" : "▼"}</span>
          </button>
          {openIdx === i && (
            <div className="history-rounds">
              {g.rounds.map((r, j) => (
                <div key={j} className={`history-round ${r.pointTo === "gracze" ? "good" : "bad"}`}>
                  <span className="history-label">{r.label}</span>
                  <span className="history-result">{r.result}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Voting({ state }) {
  const [timeLeft, setTimeLeft] = useState(state.phaseData?.timeLeft ?? 120);

  useEffect(() => {
    const handler = (t) => setTimeLeft(t);
    socket.on("timer_tick", handler);
    return () => socket.off("timer_tick", handler);
  }, []);

  useEffect(() => {
    setTimeLeft(state.phaseData?.timeLeft ?? 120);
  }, [state.phaseData?.timeLeft]);

  const myData = state.myPhaseData;
  const me = state.players.find(p => p.id === state.myId);

  const voteFor = (id) => socket.emit("vote", { targetId: id });

  if (me?.eliminated) {
    return (
      <div className="screen center">
        <div className="card">
          <h2>💀 Jesteś wyeliminowany</h2>
          <p>Inni głosują kogo wyrzucić...</p>
          <Timer time={timeLeft} />
          <GameHistoryPanel gameHistory={state.gameHistory} />
        </div>
      </div>
    );
  }

  const alivePlayers = state.players.filter(p => !p.eliminated && p.id !== state.myId);

  return (
    <div className="screen voting-screen">
      <div className="card">
        <div className="phase-header voting-header">
          <span className="phase-icon">🗳️</span>
          <span>Głosowanie</span>
        </div>

        <Timer time={timeLeft} />

        <h2>Kogo podejrzewasz?</h2>
        <p className="muted">Wybierz gracza, który Twoim zdaniem jest sabotażystą</p>

        <div className="vote-grid">
          {alivePlayers.map(p => (
            <button
              key={p.id}
              className={`vote-card ${myData?.myVote === p.id ? "voted" : ""}`}
              onClick={() => voteFor(p.id)}
            >
              <Avatar src={p.avatar} name={p.name} size="medium" />
              <div className="vote-name">{p.name}</div>
              {myData?.myVote === p.id && <div className="vote-check">✓</div>}
            </button>
          ))}
        </div>

        {myData?.hasVoted && (
          <div className="info-box">
            ✓ Twój głos został oddany
            <p className="muted small">Możesz zmienić wybór</p>
          </div>
        )}

        <GameHistoryPanel gameHistory={state.gameHistory} />
      </div>
    </div>
  );
}

function Timer({ time }) {
  const danger = time <= 20;
  return (
    <div className="timer">
      <div className={`timer-text ${danger ? "danger" : ""}`}>⏱️ {time}s</div>
      <div className="timer-bar">
        <div className="timer-fill" style={{ width: `${(time/120)*100}%` }} />
      </div>
    </div>
  );
}

export default Voting;
