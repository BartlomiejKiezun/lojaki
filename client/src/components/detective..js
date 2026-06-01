import { useEffect, useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";
import Scoreboard from "./Scoreboard";
import FlyingAvatars from "./FlyingAvatars";
import ConfettiBurst from "./ConfettiBurst";
import { playPoint, playFail } from "../sounds";

function Detective({ state }) {
  const [timeLeft, setTimeLeft] = useState(state.phaseData?.timeLeft ?? 120);
  const [flyingAvs, setFlyingAvs] = useState([]);

  useEffect(() => {
    const handler = (t) => setTimeLeft(t);
    socket.on("timer_tick", handler);
    return () => socket.off("timer_tick", handler);
  }, []);

  useEffect(() => {
    setTimeLeft(state.phaseData?.timeLeft ?? 120);
  }, [state.phaseData?.currentDetectiveId]);

  const data = state.phaseData;
  const myData = state.myPhaseData;
  const isHost = state.myId === state.hostId;
  const isDetective = data?.currentDetectiveId === state.myId;
  const me = state.players.find(p => p.id === state.myId);

  useEffect(() => {
    if (data?.finished && data?.result) {
      if (data.result.guessed) {
        playPoint();
        const winners = (data.result.correctPlayers || []).map(cp => ({
          avatar: cp.avatar, name: cp.name
        }));
        setFlyingAvs(winners);
      } else {
        playFail();
      }
    }
  }, [data?.finished, data?.result?.guessed, data?.result?.correctPlayers]);

  if (!data) return <div className="screen">Ładowanie...</div>;

  // ============= KONIEC MINIGRY =============
  if (data.miniGameFinished) {
    const byRound = {};
    data.roundsHistory.forEach(r => {
      const rn = r.roundNumber || 1;
      if (!byRound[rn]) byRound[rn] = [];
      byRound[rn].push(r);
    });
    const rounds = Object.keys(byRound).sort((a, b) => +a - +b);

    return (
      <div className="screen center">
        <div className="card big-card">
          <h1>🎯 Koniec Detektywa</h1>
          {rounds.map(rn => (
            <div key={rn} className="round-group">
              <h3 className="round-group-title">Runda {rn}</h3>
              <div className="rounds-summary">
                {byRound[rn].map((r, i) => (
                  <div key={i} className={`round-row ${r.guessed ? "good" : "bad"}`}>
                    <span>{r.detectiveName}</span>
                    <span className="word-small">{r.word}</span>
                    <span>{r.guessed ? "✅" : "❌"}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Scoreboard state={state} />
          {isHost
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_detective")}>Dalej →</button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= WYNIK RUNDY =============
  if (data.finished && data.result) {
    const result = data.result;
    const guessed = result.guessed;

    return (
      <div className={`screen center ${guessed ? "good-bg" : "bad-bg"}`}>
        {guessed && <ConfettiBurst trigger={data.currentDetectiveId} count={30} />}
        {guessed && <FlyingAvatars avatars={flyingAvs} style="explode" duration={2500} />}
        <div className="card big-card">
          <h1 className={guessed ? "winner-explode" : ""}>
            {guessed ? "✅ Zgadnięto!" : "❌ Nikt nie zgadł"}
          </h1>
          <p>Hasło: <strong>{result.word}</strong></p>
          <p className="muted">Pytania: <strong>{result.yesCount}</strong> ✅ TAK / <strong>{result.noCount}</strong> ❌ NIE</p>
          <p className="muted">Hasło miał: <strong>{result.detectiveName}</strong></p>

          {guessed && (
            <div className="correct-players-box">
              <p className="muted small">🎯 +1 punkt dla:</p>
              <div className="correct-players-list">
                {result.correctPlayers?.map(cp => (
                  <div key={cp.id} className="correct-player-chip">
                    <Avatar src={cp.avatar} name={cp.name} size="small" />
                    <span>{cp.name} ✅</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isHost
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_detective")}>
                {data.nextDetectiveName ? `Dalej → (${data.nextDetectiveName})` : "Dalej →"}
              </button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= JESTEM DETEKTYWEM (mam hasło) =============
  if (isDetective) {
    // PRZED STARTEM
    if (!data.timerStarted) {
      return (
        <div className="screen center">
          <div className="card">
            <div className="phase-header">
              <span className="phase-icon">🎯</span>
              <span>Detektyw - Twoja kolej ({data.currentDetectiveNumber}/{data.totalDetectivesInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
            </div>
            <p className="big-text">🎯 Masz hasło!</p>
            <p>Po kliknięciu "Start" zobaczysz hasło. Reszta graczy zadaje pytania TAK/NIE na głos.</p>
            <p className="muted small">Klikasz ✅ TAK lub ❌ NIE. Gdy ktoś zgadnie - zaznaczysz go na liście.</p>
            <button
              className="btn btn-success big"
              onClick={() => socket.emit("detective_ready")}
            >
              ▶️ Jestem gotowy
            </button>
          </div>
        </div>
      );
    }

    const aliveOthers = state.players.filter(p => !p.eliminated && p.id !== state.myId);
    const picks = data.detectivePicks || {};
    const pickedId = Object.keys(picks)[0];
    const pickedName = aliveOthers.find(p => p.id === pickedId)?.name;

    return (
      <div className="screen">
        <div className="card">
          <div className="phase-header">
            <span className="phase-icon">🎯</span>
            <span>Detektyw ({data.currentDetectiveNumber}/{data.totalDetectivesInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
          </div>

          <Timer time={timeLeft} max={120} />

          <div className="word-box big-word">
            <p className="muted small">Twoje hasło:</p>
            <h1>{myData?.word || data.word}</h1>
          </div>

          {data.timerEnded && (
            <div className="info-box" style={{ background: '#451a03', borderColor: '#f59e0b', color: '#fbbf24' }}>
              ⏰ Czas minął! Wybierz kto zgadł lub kliknij "Nikt nie zgadł"
            </div>
          )}

          <p className="muted small center">Słuchaj pytań graczy i odpowiadaj:</p>

          <div className="detective-answer-buttons">
            <button
              className="btn detective-yes-btn"
              onClick={() => socket.emit("detective_answer", { answer: "yes" })}
            >
              ✅ TAK
              <span className="vote-count">{data.yesCount || 0}</span>
            </button>
            <button
              className="btn detective-no-btn"
              onClick={() => socket.emit("detective_answer", { answer: "no" })}
            >
              ❌ NIE
              <span className="vote-count">{data.noCount || 0}</span>
            </button>
          </div>

          <p className="muted small">Gdy ktoś zgadnie - zaznacz go:</p>

          <div className="speaker-picks-grid">
            {aliveOthers.map(p => (
              <button
                key={p.id}
                className={`vote-card ${pickedId === p.id ? "voted" : ""}`}
                onClick={() => socket.emit("detective_toggle_pick", { playerId: p.id })}
              >
                <Avatar src={p.avatar} name={p.name} size="medium" />
                <div className="vote-name">{p.name}</div>
                {pickedId === p.id && <div className="vote-check">✓</div>}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary big"
            onClick={() => socket.emit("detective_confirm_picks")}
          >
            {pickedId ? `✓ Potwierdź - ${pickedName} zgadł` : "❌ Nikt nie zgadł"}
          </button>
        </div>
      </div>
    );
  }

  // ============= JESTEM ZGADUJĄCYM =============
  if (me?.eliminated) {
    return (
      <div className="screen center">
        <div className="card">
          <h2>💀 Jesteś wyeliminowany</h2>
          <p>Detektywem jest: <strong>{data.currentDetectiveName}</strong></p>
        </div>
      </div>
    );
  }

  // Przed startem
  if (!data.timerStarted) {
    return (
      <div className="screen center">
        <div className="card">
          <div className="phase-header">
            <span className="phase-icon">🎯</span>
            <span>Detektyw ({data.currentDetectiveNumber}/{data.totalDetectivesInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
          </div>
          <div className="actor-info">
            <Avatar src={data.currentDetectiveAvatar} name={data.currentDetectiveName} size="big" />
            <h2>{data.currentDetectiveName}</h2>
            <p className="muted">przygotowuje się...</p>
          </div>
          <p className="muted">Czekaj aż zacznie...</p>
        </div>
      </div>
    );
  }

  const picks = data.detectivePicks || {};
  const iWasPicked = picks[state.myId];

  return (
    <div className="screen center">
      <div className="card">
        <div className="phase-header">
          <span className="phase-icon">🎯</span>
          <span>Detektyw • Runda {data.roundNumber}/{data.totalRounds}</span>
        </div>

        <Timer time={timeLeft} max={120} />

        <div className="actor-info">
          <Avatar src={data.currentDetectiveAvatar} name={data.currentDetectiveName} size="big" className="actor-pulse" />
          <h2>{data.currentDetectiveName}</h2>
          <p className="muted">ma hasło...</p>
        </div>

        <div className="detective-stats">
          <div className="detective-stat yes-stat">
            <span className="stat-icon">✅</span>
            <span className="stat-value">{data.yesCount || 0}</span>
            <span className="stat-label">TAK</span>
          </div>
          <div className="detective-stat no-stat">
            <span className="stat-icon">❌</span>
            <span className="stat-value">{data.noCount || 0}</span>
            <span className="stat-label">NIE</span>
          </div>
        </div>

        <p className="big-text">🗣️ Zadawaj pytania TAK/NIE NA GŁOS!</p>
        <p className="muted small">{data.currentDetectiveName} odpowiada klikając w aplikacji. Gdy zgadniesz - krzyknij to na głos, a {data.currentDetectiveName} cię zaznaczy.</p>

        {iWasPicked && (
          <div className="my-picked-badge">
            🎯 {data.currentDetectiveName} zaznaczył Ciebie!
          </div>
        )}
      </div>
    </div>
  );
}

function Timer({ time, max }) {
  const percent = Math.max(0, Math.min(100, (time / max) * 100));
  const mins = Math.floor(time / 60);
  const secs = time % 60;
  const danger = time <= 20;
  return (
    <div className="timer">
      <div className={`timer-text ${danger ? "danger" : ""}`}>
        ⏱️ {mins > 0 ? `${mins}:${String(secs).padStart(2,"0")}` : `${secs}s`}
      </div>
      <div className="timer-bar">
        <div className={`timer-fill ${danger ? "danger" : ""}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default Detective;
