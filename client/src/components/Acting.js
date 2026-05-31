import { useEffect, useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";
import Scoreboard from "./Scoreboard";
import FlyingAvatars from "./FlyingAvatars";
import ConfettiBurst from "./ConfettiBurst";
import { playPoint, playFail, playRoundEnd, unlockAudio } from "../sounds";

function Acting({ state }) {
  const [timeLeft, setTimeLeft] = useState(state.phaseData?.timeLeft ?? 40);

  useEffect(() => {
    const handler = (t) => setTimeLeft(t);
    socket.on("timer_tick", handler);
    return () => socket.off("timer_tick", handler);
  }, []);

  useEffect(() => {
    setTimeLeft(state.phaseData?.timeLeft ?? 40);
  }, [state.phaseData?.currentActorId]);

  const data = state.phaseData;
  const myData = state.myPhaseData;
  const isHost = state.myId === state.hostId;
  const isActor = data?.currentActorId === state.myId;
  const me = state.players.find(p => p.id === state.myId);

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
          <h1>🎭 Koniec kalamburów</h1>
          {rounds.map(rn => (
            <div key={rn} className="round-group">
              <h3 className="round-group-title">Runda {rn}</h3>
              <div className="rounds-summary">
                {byRound[rn].map((r, i) => (
                  <div key={i} className={`round-row ${r.guessed ? 'good' : 'bad'}`}>
                    <span>{r.actorName}</span>
                    <span className="word-small">{r.word}</span>
                    <span>{r.guessed ? '✅' : '❌'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Scoreboard state={state} />
          {isHost
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_acting")}>Dalej →</button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= WYNIK RUNDY =============
  const [flyingAvs, setFlyingAvs] = useState([]);
  useEffect(() => {
    if (data?.finished && data?.result) {
      if (data.result.guessed) {
        playPoint();
        // Avatar aktora + zgadujących
        const winners = [];
        const actor = state.players.find(p => p.id === data.result.actorId);
        if (actor) winners.push({ avatar: actor.avatar, name: actor.name });
        (data.result.correctPlayers || []).forEach(cp => winners.push({ avatar: cp.avatar, name: cp.name }));
        setFlyingAvs(winners);
      } else {
        playFail();
      }
    }
  }, [data?.finished, data?.result?.guessed, data?.result?.actorId, state.players, data?.result?.correctPlayers]);

  if (data.finished && data.result) {
    const result = data.result;
    const guessed = result.guessed;

    return (
      <div className={`screen center ${guessed ? 'good-bg' : 'bad-bg'}`}>
        {guessed && <ConfettiBurst trigger={data.currentActorId} count={30} />}
        {guessed && <FlyingAvatars avatars={flyingAvs} style="explode" duration={2500} />}
        <div className="card big-card">
          <h1 className={guessed ? "winner-explode" : ""}>{guessed ? "✅ Zgadnięto!" : "❌ Nikt nie zgadł"}</h1>
          <p>Hasło: <strong>{result.word}</strong></p>
          <p className="muted">Pokazywał: <strong>{result.actorName}</strong></p>

          {guessed && (
            <div className="correct-players-box">
              <p className="muted small">🎯 +1 punkt dla:</p>
              <div className="correct-players-list">
                <div className="correct-player-chip actor-chip">
                  <Avatar src={state.players.find(p => p.id === result.actorId)?.avatar} name={result.actorName} size="small" />
                  <span>{result.actorName} 🎭</span>
                </div>
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
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_acting")}>
                {data.nextActorName ? `Dalej → (${data.nextActorName})` : "Dalej →"}
              </button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= JESTEM AKTOREM =============
  if (isActor) {
    // PRZED STARTEM - klika "Jestem gotowy"
    if (!data.timerStarted) {
      return (
        <div className="screen center">
          <div className="card">
            <div className="phase-header">
              <span className="phase-icon">🎭</span>
              <span>Kalambury - Twoja kolej ({data.currentActorNumber}/{data.totalActorsInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
            </div>
            <p className="big-text">🎭 Twoja kolej!</p>
            <p>Po kliknięciu "Start" zobaczysz hasło. Masz 40 sekund żeby pokazać je ruchami.</p>
            <p className="muted small">Gdy ktoś zgadnie - zaznaczysz go na liście.</p>
            <button
              className="btn btn-success big"
              onClick={() => socket.emit("actor_ready")}
            >
              ▶️ Jestem gotowy
            </button>
          </div>
        </div>
      );
    }

    const aliveOthers = state.players.filter(p => !p.eliminated && p.id !== state.myId);
    const picks = data.actorPicks || {};
    const pickedId = Object.keys(picks)[0];
    const pickedName = aliveOthers.find(p => p.id === pickedId)?.name;

    return (
      <div className="screen acting-screen">
        <div className="card">
          <div className="phase-header">
            <span className="phase-icon">🎭</span>
            <span>Pokazujesz! ({data.currentActorNumber}/{data.totalActorsInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
          </div>

          <Timer time={timeLeft} max={40} />

          <div className="word-box big-word">
            <p className="muted small">Twoje hasło:</p>
            <h1>{myData?.word || data.word}</h1>
          </div>

          {data.timerEnded && (
            <div className="info-box" style={{ background: '#451a03', borderColor: '#f59e0b', color: '#fbbf24' }}>
              ⏰ Czas minął! Wybierz kto zgadł lub kliknij "Nikt nie zgadł"
            </div>
          )}

          <p className="muted small">Pokazuj NA ŻYWO ruchami. Gdy ktoś zgadnie - zaznacz go!</p>

          <div className="speaker-picks-grid">
            {aliveOthers.map(p => (
              <button
                key={p.id}
                className={`vote-card ${pickedId === p.id ? "voted" : ""}`}
                onClick={() => socket.emit("actor_toggle_pick", { playerId: p.id })}
              >
                <Avatar src={p.avatar} name={p.name} size="medium" />
                <div className="vote-name">{p.name}</div>
                {pickedId === p.id && <div className="vote-check">✓</div>}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary big"
            onClick={() => socket.emit("actor_confirm_picks")}
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
          <p>Pokazuje: <strong>{data.currentActorName}</strong></p>
        </div>
      </div>
    );
  }

  const picks = data.actorPicks || {};
  const iWasPicked = picks[state.myId];

  // Przed startem - zgadujący czeka aż aktor kliknie Start
  if (!data.timerStarted) {
    return (
      <div className="screen center">
        <div className="card">
          <div className="phase-header">
            <span className="phase-icon">🎭</span>
            <span>Kalambury ({data.currentActorNumber}/{data.totalActorsInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
          </div>
          <div className="actor-info">
            <Avatar src={data.currentActorAvatar} name={data.currentActorName} size="big" className="actor-pulse" />
            <h2>{data.currentActorName}</h2>
            <p className="muted">przygotowuje się...</p>
          </div>
          <p className="muted">Czekaj aż zacznie pokazywać hasło...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen center">
      <div className="card">
        <div className="phase-header">
          <span className="phase-icon">🎭</span>
          <span>Kalambury ({data.currentActorNumber}/{data.totalActorsInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
        </div>

        <Timer time={timeLeft} max={40} />

        <div className="actor-info">
          <Avatar src={data.currentActorAvatar} name={data.currentActorName} size="big" className="actor-pulse" />
          <h2>{data.currentActorName}</h2>
          <p className="muted">pokazuje hasło...</p>
        </div>

        <p className="big-text">👀 Patrz i zgaduj NA GŁOS!</p>
        <p className="muted small">{data.currentActorName} zaznaczy kto pierwszy zgadł.</p>

        {iWasPicked && (
          <div className="my-picked-badge">
            🎯 {data.currentActorName} zaznaczył Ciebie!
          </div>
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
        <div className={`timer-fill ${danger ? "danger" : ""}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default Acting;
