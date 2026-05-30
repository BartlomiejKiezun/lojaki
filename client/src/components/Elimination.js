import { useEffect, useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";

function Elimination({ state }) {
  const [step, setStep] = useState(0);
  const [falling, setFalling] = useState(false);
  const [showSaboteursStep, setShowSaboteursStep] = useState(0);

  const data = state.phaseData;
  const myData = state.myPhaseData;
  const iAmEliminated = data?.eliminatedPlayer?.id === state.myId;
  const isHost = state.myId === state.hostId;

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1500);
    const t2 = setTimeout(() => setStep(2), 3500);
    const t3 = setTimeout(() => setStep(3), 5500);
    const t4 = setTimeout(() => setFalling(true), 6800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  useEffect(() => {
    if (!iAmEliminated) return;
    const t4 = setTimeout(() => setShowSaboteursStep(1), 8000);
    const t5 = setTimeout(() => setShowSaboteursStep(2), 11000);
    return () => { clearTimeout(t4); clearTimeout(t5); };
  }, [iAmEliminated]);

  // ============= REMIS =============
  if (data?.tie) {
    return (
      <div className="screen center elimination-screen">
        <div className="card pop-in">
          <h1>🤝 Remis!</h1>
          <p>Nikt dziś nie odpada.</p>
          <p className="muted small">Następna minigra: <strong>{data.nextGameName}</strong></p>
          {isHost && (
            <button className="btn btn-primary big" onClick={() => socket.emit("host_next_elimination")}>
              Dalej →
            </button>
          )}
          {!isHost && <p className="muted center">⏳ Czekaj na hosta...</p>}
        </div>
      </div>
    );
  }

  if (!data?.eliminatedPlayer) {
    return (
      <div className="screen center elimination-screen">
        <div className="card pop-in"><h1>Nikt nie odpada</h1></div>
      </div>
    );
  }

  const player = data.eliminatedPlayer;

  // ============= JA JESTEM WYRZUCONY - najpierw odsuń się =============
  if (iAmEliminated && showSaboteursStep > 0) {
    if (showSaboteursStep === 1) {
      return (
        <div className="screen center role-warning">
          <div className="card warning-card pop-in">
            <h1>⚠️</h1>
            <h2>Odsuń się od reszty!</h2>
            <p>Zaraz zobaczysz kto był sabotażystą.</p>
            <div className="countdown-bar"><div className="countdown-fill" /></div>
          </div>
        </div>
      );
    }
    if (myData?.showSaboteurs && myData.saboteurs) {
      return (
        <div className="screen center saboteur-bg">
          <div className="card big-card pop-in">
            <div className="role-icon">🧨</div>
            <h2>Sabotażyści to:</h2>
            <div className="saboteurs-list">
              {myData.saboteurs.map(s => (
                <div key={s.id} className="saboteur-card fade-in-up">
                  <Avatar src={s.avatar} name={s.name} size="big" />
                  <h3>{s.name}</h3>
                </div>
              ))}
            </div>
            <p className="muted small">Tylko Ty to widzisz!</p>
          </div>
        </div>
      );
    }
  }

  // ============= RESZTA graczy - zapowiedź następnej minigry gdy waitingForHost =============
  if (!iAmEliminated && data?.waitingForHost) {
    return (
      <div className="screen center">
        <div className="card big-card pop-in">
          <h2>✅ Eliminacja zakończona</h2>
          <div className="elim-summary">
            <Avatar src={player.avatar} name={player.name} size="medium" />
            <span>{player.name} odpadł</span>
          </div>

          {/* Wyniki głosowania */}
          {data.ranking && (
            <div className="vote-ranking" style={{ marginBottom: 16 }}>
              <h3 className="muted small">🗳️ Wyniki głosowania:</h3>
              {data.ranking.map((p, i) => (
                <div key={p.id} className={`vote-rank-row ${p.id === data.eliminatedPlayer?.id ? "elim-row" : ""}`}>
                  <span className="rank-num">{i+1}.</span>
                  <Avatar src={p.avatar} name={p.name} size="small" />
                  <span className="rank-name">{p.name}</span>
                  <span className="rank-votes">{p.votes} głosów</span>
                </div>
              ))}
            </div>
          )}

          <div className="announcing-next-box">
            <p className="muted small">Za chwilę:</p>
            <h2>{data.nextGameName}</h2>
          </div>

          {isHost && (
            <button className="btn btn-primary big" onClick={() => socket.emit("host_next_elimination")}>
              Dalej →
            </button>
          )}
          {!isHost && <p className="muted center">⏳ Czekaj na hosta...</p>}
        </div>
      </div>
    );
  }

  // ============= ANIMACJA =============
  return (
    <div className="screen center elimination-screen">
      {step === 0 && (
        <div className="card pop-in"><h2>🗳️ Liczenie głosów...</h2></div>
      )}
      {step === 1 && (
        <div className="card pop-in"><h2>Najwięcej głosów otrzymał...</h2></div>
      )}
      {step >= 2 && (
        <div className="card">
          <div className={`player-reveal ${falling ? "elim-avatar-fall" : ""}`}>
            <Avatar src={player.avatar} name={player.name} size="huge" />
            <h1 className="fade-in-up">{player.name}</h1>
            {step >= 3 && (
              <h1 className="elim-text-shake" style={{ fontSize: 36, color: "#ef4444" }}>
                ❌ ODPADA
              </h1>
            )}
          </div>
          {/* Dla niewyrzuconych - zapowiedź gdy jeszcze animacja */}
          {!iAmEliminated && step >= 3 && data?.nextGameName && (
            <p className="muted fade-in-up" style={{ marginTop: 12 }}>
              Następna minigra: <strong>{data.nextGameName}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default Elimination;
