import { useEffect, useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";
import Scoreboard from "./Scoreboard";
import FlyingAvatars from "./FlyingAvatars";
import ConfettiBurst from "./ConfettiBurst";
import { playPoint, playFail } from "../sounds";

function FiveSeconds({ state }) {
  const [timeLeft, setTimeLeft] = useState(state.phaseData?.timeLeft ?? 10);

  useEffect(() => {
    const handler = (t) => setTimeLeft(t);
    socket.on("timer_tick", handler);
    return () => socket.off("timer_tick", handler);
  }, []);

  useEffect(() => {
    setTimeLeft(state.phaseData?.timeLeft ?? 10);
  }, [state.phaseData?.currentSpeakerId, state.phaseData?.timeLeft, state.phaseData?.timerStarted]);

  const data = state.phaseData;
  const myData = state.myPhaseData;
  const isHost = state.myId === state.hostId;
  const isSpeaker = data?.currentSpeakerId === state.myId;
  const me = state.players.find(p => p.id === state.myId);

  if (!data) return <div className="screen">Ładowanie...</div>;

  // ============= KONIEC CAŁEJ MINIGRY =============
  if (data.miniGameFinished) {
    // Grupuj po rundach
    const byRound = {};
    data.speakersHistory.forEach(r => {
      const rn = r.roundNumber || 1;
      if (!byRound[rn]) byRound[rn] = [];
      byRound[rn].push(r);
    });
    const rounds = Object.keys(byRound).sort((a, b) => +a - +b);

    return (
      <div className="screen center">
        <div className="card big-card">
          <h1>⚡ Koniec minigry</h1>
          {rounds.map(rn => (
            <div key={rn} className="round-group">
              <h3 className="round-group-title">Runda {rn}</h3>
              <div className="rounds-summary">
                {byRound[rn].map((r, i) => (
                  <div key={i} className={`round-row ${r.guessed ? 'good' : 'bad'}`}>
                    <span>{r.speakerName}</span>
                    <span className="muted small">{r.okVotes}✅ / {r.noVotes}❌</span>
                    <span>{r.guessed ? '✅' : '❌'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Scoreboard state={state} />
          {isHost
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_phase")}>Dalej →</button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= WYNIK TURY =============
  const [flyingAvs5s, setFlyingAvs5s] = useState([]);
  useEffect(() => {
    if (data?.finished && data?.result) {
      if (data.result.guessed) {
        playPoint();
        const speaker = state.players.find(p => p.id === data.result.speakerId);
        if (speaker) setFlyingAvs5s([{ avatar: speaker.avatar, name: speaker.name }]);
      } else {
        playFail();
      }
    }
  }, [data?.finished, data?.result?.guessed, data?.result?.speakerId, state.players]);

  if (data.finished && data.result) {
    const r = data.result;
    return (
      <div className={`screen center ${r.guessed ? 'good-bg' : 'bad-bg'}`}>
        {r.guessed && <ConfettiBurst trigger={data.currentSpeakerId} count={25} />}
        {r.guessed && <FlyingAvatars avatars={flyingAvs5s} style="bounce" duration={2500} />}
        <div className="card big-card">
          <h1 className={r.guessed ? "winner-explode" : ""}>{r.guessed ? "✅ Zaliczone!" : "❌ Odrzucone"}</h1>
          <p className="muted">Mówił: <strong>{r.speakerName}</strong></p>
          <p className="muted small">{r.question}</p>
          <p>Głosy: <strong>{r.okVotes}</strong> ✅ / <strong>{r.noVotes}</strong> ❌</p>

          {r.guessed && (
            <p className="point-info">🎯 +1 punkt dla {r.speakerName}</p>
          )}

          {isHost
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_fiveseconds")}>Dalej →</button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= JESTEM MÓWCĄ - PRZED STARTEM =============
  if (isSpeaker) {
    if (!data.timerStarted) {
      return (
        <div className="screen center">
          <div className="card">
            <div className="phase-header">
              <span className="phase-icon">⚡</span>
              <span>5 sekund - Twoja kolej ({data.currentSpeakerNumber}/{data.totalSpeakers}) • Runda {data.roundNumber}/{data.totalRounds}</span>
            </div>
            <p className="big-text">🎤 Twoja kolej!</p>
            <p>Po kliknięciu "Start" zobaczysz polecenie. Masz 10 sekund żeby powiedzieć NA GŁOS.</p>
            <p className="muted small">Pozostali zagłosują czy zaliczyłeś.</p>
            <button
              className="btn btn-success big"
              onClick={() => socket.emit("speaker_ready")}
            >
              ▶️ Start! Jestem gotowy
            </button>
          </div>
        </div>
      );
    }

    // Mówca podczas mówienia - widzi pytanie + timer
    return (
      <div className="screen center">
        <div className="card">
          <div className="phase-header">
            <span className="phase-icon">⚡</span>
            <span>Mówisz!</span>
          </div>
          <Timer time={timeLeft} max={10} />
          <div className="question-box">
            <h2>{data.question}</h2>
          </div>
          {data.timerEnded ? (
            <>
              <p className="big-text">⏰ Czas minął!</p>
              <p className="muted small">Inni głosują czy zaliczyłeś...</p>
              {isHost && (
                <button
                  className="btn btn-primary big"
                  onClick={() => socket.emit("host_finish_fiveseconds")}
                >
                  ✓ Zakończ głosowanie
                </button>
              )}
            </>
          ) : (
            <>
              <p className="big-text">🎤 Mów teraz NA GŁOS!</p>
              <p className="muted small">Po czasie inni ocenią twoją odpowiedź</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============= JESTEM SŁUCHACZEM (głosującym) =============
  if (me?.eliminated) {
    return (
      <div className="screen center">
        <div className="card">
          <h2>💀 Jesteś wyeliminowany</h2>
          <p>Mówi: <strong>{data.currentSpeakerName}</strong></p>
        </div>
      </div>
    );
  }

  // Przed startem - słuchacz czeka
  if (!data.timerStarted) {
    return (
      <div className="screen center">
        <div className="card">
          <div className="phase-header">
            <span className="phase-icon">⚡</span>
            <span>5 sekund ({data.currentSpeakerNumber}/{data.totalSpeakers}) • Runda {data.roundNumber}/{data.totalRounds}</span>
          </div>
          <div className="speaker-info">
            <Avatar src={data.currentSpeakerAvatar} name={data.currentSpeakerName} size="big" className="actor-pulse" />
            <h2>{data.currentSpeakerName}</h2>
            <p className="muted">przygotowuje się...</p>
          </div>
          <p className="muted">Czekaj aż zacznie odpowiadać...</p>
        </div>
      </div>
    );
  }

  // Timer leci - słuchacz słucha i głosuje
  const myVote = data.votes?.[state.myId];
  const okVotes = Object.values(data.votes || {}).filter(v => v === "ok").length;
  const noVotes = Object.values(data.votes || {}).filter(v => v === "no").length;

  return (
    <div className="screen center">
      <div className="card">
        <div className="phase-header">
          <span className="phase-icon">⚡</span>
          <span>Słuchaj i głosuj!</span>
        </div>
        <Timer time={timeLeft} max={10} />
        <div className="speaker-info">
          <Avatar src={data.currentSpeakerAvatar} name={data.currentSpeakerName} size="big" className="actor-pulse" />
          <h2>{data.currentSpeakerName}</h2>
        </div>
        <div className="question-box">
          <h2>{data.question}</h2>
        </div>
        {data.timerEnded && (
          <div className="info-box" style={{ background: '#451a03', borderColor: '#f59e0b', color: '#fbbf24' }}>
            ⏰ Czas minął! Dalej możesz zmieniać głos.
          </div>
        )}

        <p className="muted small">Czy mówca zaliczył to zadanie?</p>

        <div className="vote-buttons">
          <button
            className={`btn vote-btn-ok ${myVote === "ok" ? "active-vote" : ""}`}
            onClick={() => socket.emit("five_seconds_vote", { vote: "ok" })}
          >
            ✅ Zaliczono
            <span className="vote-count">{okVotes}</span>
          </button>
          <button
            className={`btn vote-btn-no ${myVote === "no" ? "active-vote" : ""}`}
            onClick={() => socket.emit("five_seconds_vote", { vote: "no" })}
          >
            ❌ Nie zaliczono
            <span className="vote-count">{noVotes}</span>
          </button>
        </div>
        <p className="muted small center">Możesz zmienić głos. Większość decyduje.</p>

        {data.timerEnded && isHost && (
          <button
            className="btn btn-primary big"
            onClick={() => socket.emit("host_finish_fiveseconds")}
          >
            ✓ Zakończ głosowanie
          </button>
        )}
      </div>
    </div>
  );
}

function Timer({ time, max }) {
  const percent = Math.max(0, Math.min(100, (time / max) * 100));
  const danger = time <= 5;
  return (
    <div className="timer">
      <div className={`timer-text huge ${danger ? "danger" : ""}`}>⏱️ {time}</div>
      <div className="timer-bar">
        <div className={`timer-fill ${danger ? "danger" : ""}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default FiveSeconds;
