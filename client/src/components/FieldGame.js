import { useEffect, useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";
import Scoreboard from "./Scoreboard";

function FieldGame({ state }) {
  const [timeLeft, setTimeLeft] = useState(state.phaseData?.timeLeft ?? 60);

  useEffect(() => {
    const handler = (t) => setTimeLeft(t);
    socket.on("timer_tick", handler);
    return () => socket.off("timer_tick", handler);
  }, []);

  useEffect(() => {
    setTimeLeft(state.phaseData?.timeLeft ?? 60);
  }, [state.phaseData?.currentPlayerId, state.phaseData?.timerStarted]);

  const data = state.phaseData;
  const myData = state.myPhaseData;

  if (!data) return <div className="screen">Ładowanie...</div>;

  // ============= KONIEC CAŁEJ MINIGRY =============
  if (data.miniGameFinished) {
    return (
      <div className="screen center">
        <div className="card big-card">
          <h1>🏃 Koniec gry terenowej</h1>
          <p>Wszyscy wykonali zadanie!</p>

          <div className="rounds-summary">
            {data.roundsHistory?.map((r, i) => (
              <div key={i} className={`round-row ${!r.rejected ? "good" : "bad"}`}>
                <span>{r.playerName}</span>
                <span className="word-small">{r.task}</span>
                <span>{!r.rejected ? "✅" : "❌"}</span>
              </div>
            ))}
          </div>

          <Scoreboard state={state} />
          {state.myId === state.hostId
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_phase")}>Dalej →</button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= WYNIK TURY =============
  if (data.finished && data.result) {
    const r = data.result;
    return (
      <div className={`screen center ${!r.rejected ? "good-bg" : "bad-bg"}`}>
        <div className="card big-card">
          <h1>{!r.rejected ? "✅ Zaliczone!" : "❌ Odrzucone"}</h1>
          <p className="muted">Gracz: <strong>{r.playerName}</strong></p>
          <p className="muted small">Zadanie: {r.task}</p>
          <p>Głosy: <strong>{r.noVotes}</strong> ❌ / <strong>{r.okVotes}</strong> ✅</p>
          <p className="muted small">
            {data.nextPlayerName
              ? `Następny: ${data.nextPlayerName}`
              : "Koniec minigry za chwilę..."}
          </p>
        </div>
      </div>
    );
  }

  const me = state.players.find(p => p.id === state.myId);
  const isCurrentPlayer = myData?.isCurrentPlayer;

  // ============= MOJE ZADANIE =============
  if (isCurrentPlayer) {

    // Przed startem — ekran prywatny z zadaniem
    if (!data.timerStarted) {
      return (
        <div className="screen center">
          <div className="card big-card">
            <div className="phase-header">
              <span className="phase-icon">🏃</span>
              <span>Gra terenowa — Twoja kolej! ({data.currentPlayerNumber}/{data.totalPlayers})</span>
            </div>

            <p className="muted">Twoje zadanie:</p>
            <div className="word-display field-task-display">
              {myData?.task}
            </div>

            <p className="big-text">🤫 Odsuń się od innych!</p>
            <p className="muted">Po kliknięciu Start masz <strong>60 sekund</strong> na wykonanie zadania. Wróć i pokaż innym!</p>

            <button
              className="btn btn-success big"
              onClick={() => socket.emit("field_game_ready")}
            >
              ▶️ Start! Idę po przedmiot
            </button>
          </div>
        </div>
      );
    }

    // Timer leci — gracz jest "w terenie"
    return (
      <div className="screen center">
        <div className="card big-card">
          <div className="phase-header">
            <span className="phase-icon">🏃</span>
            <span>Biegnij!</span>
          </div>

          <Timer time={timeLeft} max={60} />

          <div className="word-display field-task-display">
            {myData?.task}
          </div>

          <p className="big-text">🏃 Wróć i pokaż innym co przyniosłeś!</p>
          <p className="muted">Inni będą głosować czy wykonałeś zadanie</p>
        </div>
      </div>
    );
  }

  // ============= OBSERWATORZY/GŁOSUJĄCY =============

  if (me?.eliminated) {
    return (
      <div className="screen center">
        <div className="card">
          <h2>💀 Jesteś wyeliminowany</h2>
          <p>Zadanie: <strong>{data.currentPlayerName}</strong></p>
          <Timer time={timeLeft} max={60} />
        </div>
      </div>
    );
  }

  // Przed startem — czekamy aż gracz przeczyta zadanie
  if (!data.timerStarted) {
    return (
      <div className="screen center">
        <div className="card">
          <div className="phase-header">
            <span className="phase-icon">🏃</span>
            <span>Gra terenowa ({data.currentPlayerNumber}/{data.totalPlayers})</span>
          </div>

          <div className="speaker-info">
            <Avatar src={data.currentPlayerAvatar} name={data.currentPlayerName} size="big" />
            <h2>{data.currentPlayerName}</h2>
            <p className="muted">czyta swoje zadanie...</p>
          </div>

          <p className="muted">Czekaj aż wróci z przedmiotem!</p>
        </div>
      </div>
    );
  }

  // Timer leci — głosowanie dostępne gdy gracz wróci
  const myVote = myData?.myVote;
  const sendVote = (vote) => socket.emit("field_game_vote", { vote });

  let noVotes = 0, okVotes = 0;
  if (data.votes) {
    for (const v of Object.values(data.votes)) {
      if (v === "no") noVotes++;
      if (v === "ok") okVotes++;
    }
  }

  return (
    <div className="screen center">
      <div className="card">
        <div className="phase-header">
          <span className="phase-icon">🏃</span>
          <span>Oceń zadanie ({data.currentPlayerNumber}/{data.totalPlayers})</span>
        </div>

        <div className="speaker-info">
          <Avatar src={data.currentPlayerAvatar} name={data.currentPlayerName} size="big" />
          <h2>{data.currentPlayerName}</h2>
        </div>

        <Timer time={timeLeft} max={60} />

        <p className="big-text">👀 Czy wykonał zadanie?</p>

        <div className="vote-stats">
          <div className="vote-stat ok">✅ OK: <strong>{okVotes}</strong></div>
          <div className="vote-stat no">❌ NIE: <strong>{noVotes}</strong> / {data.rejectThreshold}</div>
        </div>

        <div className="vote-buttons">
          <button
            className={`btn btn-success big ${myVote === "ok" ? "selected-vote" : ""}`}
            onClick={() => sendVote("ok")}
          >
            ✅ Zaliczam
          </button>
          <button
            className={`btn btn-danger big ${myVote === "no" ? "selected-vote" : ""}`}
            onClick={() => sendVote("no")}
          >
            ❌ Nie zaliczam
          </button>
        </div>

        {myVote && (
          <p className="muted small center">
            Możesz zmienić zdanie. {data.rejectThreshold} głosów "NIE" odrzuca zadanie.
          </p>
        )}
      </div>
    </div>
  );
}

function Timer({ time, max }) {
  const percent = Math.max(0, Math.min(100, (time / max) * 100));
  const danger = time <= 10;
  return (
    <div className="timer">
      <div className={`timer-text ${danger ? "danger" : ""}`}>⏱️ {time}s</div>
      <div className="timer-bar">
        <div
          className={`timer-fill ${danger ? "danger" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default FieldGame;
