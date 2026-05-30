import { useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";

function Associations({ state }) {
  const [wordSeen, setWordSeen] = useState(false);

  const data = state.phaseData;
  const myData = state.myPhaseData;
  const isHost = state.myId === state.hostId;

  if (!data) return <div className="screen">Ładowanie...</div>;

  // ============= PO REVEAL: oba słowa ujawnione =============
  if (data.wordRevealed) {
    return (
      <div className="screen center">
        <div className="card big-card">
          <h1>🔍 Ujawnienie haseł</h1>
          <p className="muted">Runda {data.roundNumber}</p>

          <div className="assoc-reveal-box">
            <div className="assoc-word-block players">
              <p className="muted small">Zwykli gracze mieli:</p>
              <div className="assoc-big-word">{data.playersWord}</div>
            </div>
            <div className="assoc-vs">VS</div>
            <div className="assoc-word-block saboteur">
              <p className="muted small">Sabotażysta miał:</p>
              <div className="assoc-big-word sabo">{data.saboteurWord}</div>
            </div>
          </div>

          <div className="assoc-players-list">
            {state.players
              .filter(p => !p.eliminated)
              .map(p => (
                <div key={p.id} className="assoc-player-row">
                  <Avatar src={p.avatar} name={p.name} size="small" />
                  <span>{p.name}</span>
                </div>
              ))}
          </div>

          {isHost && (
            <div className="host-controls">
              <p className="muted">Jesteś hostem — zdecyduj:</p>
              <button
                className="btn btn-primary big"
                onClick={() => socket.emit("associations_next_round")}
              >
                🔄 Jeszcze runda (nowe hasło)
              </button>
              <button
                className="btn btn-danger big"
                onClick={() => socket.emit("associations_go_vote")}
              >
                🗳️ Przechodzimy do głosowania!
              </button>
            </div>
          )}

          {!isHost && (
            <p className="muted center">Czekaj na decyzję hosta...</p>
          )}
        </div>
      </div>
    );
  }

  // ============= EKRAN PRYWATNY: pokaż hasło =============
  if (!wordSeen) {
    return (
      <div className="screen center">
        <div className="card big-card">
          <h1>🤫 Odsuń się od innych!</h1>
          <p>Za chwilę zobaczysz swoje hasło.</p>
          <p className="muted">Nikt inny nie może go zobaczyć!</p>
          <button
            className="btn btn-primary big"
            onClick={() => setWordSeen(true)}
          >
            👁️ Pokaż moje hasło
          </button>
        </div>
      </div>
    );
  }

  // ============= HASŁO GRACZA =============
  if (wordSeen && !data.wordRevealed) {
    return (
      <div className="screen center">
        <div className="card big-card">
          <div className="phase-header">
            <span className="phase-icon">🧠</span>
            <span>Skojarzenia — Runda {data.roundNumber}</span>
          </div>

          <p className="muted">Twoje hasło:</p>
          <div className="word-display assoc-word-display">
            {myData?.myWord}
          </div>

          <p className="big-text">🗣️ Po kolei mówcie swoje skojarzenie NA GŁOS</p>
          <p className="muted">Zapamiętaj swoje hasło i wróć do grupy!</p>

          <div className="players-waiting">
            {state.players
              .filter(p => !p.eliminated)
              .map(p => (
                <div key={p.id} className="player-chip">
                  <Avatar src={p.avatar} name={p.name} size="small" />
                  <span>{p.name}</span>
                </div>
              ))}
          </div>

          {isHost && (
            <div className="host-controls">
              <p className="muted small">Gdy wszyscy zobaczyli swoje hasło:</p>
              <button
                className="btn btn-success big"
                onClick={() => socket.emit("associations_reveal")}
              >
                🔍 Ujawnij hasła (koniec rundy)
              </button>
              <button
                className="btn btn-primary"
                onClick={() => socket.emit("associations_next_round")}
              >
                🔄 Nowa runda (nowe hasło)
              </button>
              <button
                className="btn btn-danger"
                onClick={() => socket.emit("associations_go_vote")}
              >
                🗳️ Głosowanie!
              </button>
            </div>
          )}

          {!isHost && (
            <p className="muted small center">Host zdecyduje o kolejnej rundzie lub głosowaniu</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default Associations;
