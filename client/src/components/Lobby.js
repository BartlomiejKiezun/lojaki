import { useState } from "react";
import { socket } from "../socket";
import { unlockAudio } from "../sounds";
import Avatar from "./Avatar";

function Lobby({ availablePlayers, state }) {
  const [selected, setSelected] = useState(null);
  const [roomInput, setRoomInput] = useState("");
  const [error, setError] = useState("");
  const [currentList, setCurrentList] = useState("list1");

  const inRoom = !!state;

  const createGame = () => {
    unlockAudio();
    if (!selected) {
      setError("Wybierz postać!");
      return;
    }
    setError("");
    socket.emit("create_game", { player: selected }, (resp) => {
      if (resp?.error) setError(resp.error);
      else if (resp?.roomId) {
        localStorage.setItem("game_session", JSON.stringify({
          roomId: resp.roomId,
          player: selected,
          timestamp: Date.now()
        }));
      }
    });
  };

  const joinByCode = () => {
    unlockAudio();
    if (!selected) {
      setError("Wybierz postać!");
      return;
    }
    if (!roomInput.trim()) {
      setError("Wpisz kod pokoju!");
      return;
    }
    setError("");
    socket.emit("join_game", {
      roomId: roomInput.trim(),
      player: selected
    }, (resp) => {
      if (resp?.error) setError(resp.error);
      else if (resp?.ok) {
        localStorage.setItem("game_session", JSON.stringify({
          roomId: roomInput.trim().toUpperCase(),
          player: selected,
          timestamp: Date.now()
        }));
      }
    });
  };

  const toggleList = () => {
    const newList = currentList === "list1" ? "list2" : "list1";
    setCurrentList(newList);
    socket.emit("request_list", { listName: newList });
    setSelected(null); // czyścimy wybór bo lista się zmienia
  };

  const [mode, setMode] = useState("points");

  const startGame = () => {
    socket.emit("start_game", { mode });
  };

  // ============= W POKOJU =============
  if (inRoom) {
    const me = state.players.find(p => p.id === state.myId);
    const isHost = me?.id === state.hostId;
    const canStart = state.players.length >= 3;

    return (
      <div className="screen">
        <div className="card">
          <h1 className="room-code">Kod pokoju</h1>
          <div className="big-code">{state.roomId}</div>
          <p className="muted center">Pokaż ten kod innym graczom</p>
        </div>

        <div className="card">
          <h2>Gracze ({state.players.length})</h2>
          <div className="players-grid">
            {state.players.map((p, i) => (
              <div
                key={p.id}
                className={`player-tile player-card-animated ${p.id === state.myId ? "player-card-ready" : ""} ${!p.connected ? "offline" : ""}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <Avatar src={p.avatar} name={p.name} size="medium" />
                <div className="player-name">
                  {p.name}
                  {p.isHost && <span className="host-badge">👑</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <>
            <div className="mode-picker">
              <p className="muted small">Wybierz tryb gry:</p>
              <div className="mode-options">
                <button
                  className="mode-option disabled-mode"
                  disabled
                >
                  <div className="mode-icon">🧨</div>
                  <div className="mode-name">Sabotażysta</div>
                  <div className="mode-desc">⏳ Wkrótce</div>
                </button>
                <button
                  className={`mode-option ${mode === "points" ? "selected" : ""}`}
                  onClick={() => setMode("points")}
                >
                  <div className="mode-icon">🏆</div>
                  <div className="mode-name">Punkty</div>
                  <div className="mode-desc">Każdy gra dla siebie, zbieraj punkty</div>
                </button>
              </div>
            </div>
            <button
              className="btn btn-primary big"
              onClick={startGame}
              disabled={!canStart}
            >
              {canStart ? "▶️ Rozpocznij grę" : `Potrzeba ${3 - state.players.length} więcej graczy`}
            </button>
            <p className="muted center">Tylko host może rozpocząć grę</p>
          </>
        ) : (
          <div className="card">
            <h3 className="center">⏳ Czekamy aż host rozpocznie grę...</h3>
          </div>
        )}
      </div>
    );
  }

  // ============= WYBÓR POSTACI =============
  return (
    <div className="screen">
      <img src="/logo.png" alt="Logo" className="lobby-logo" />

      <div className="card">
        <h2>1. Wybierz kim jesteś</h2>
        <div className="players-grid">
          {availablePlayers.map(p => (
            <div
              key={p.name}
              className={`player-tile ${selected?.name === p.name ? 'selected' : ''}`}
              onClick={() => setSelected(p)}
            >
              <Avatar src={p.avatar} name={p.name} size="medium" />
              <div className="player-name">{p.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>2. Stwórz lub dołącz</h2>

        <button
          className="btn btn-primary big"
          onClick={createGame}
        >
          🆕 Stwórz nowy pokój
        </button>

        <div className="separator">albo</div>

        <input
          className="input"
          type="number"
          placeholder="Kod pokoju (4 cyfry)"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          maxLength={4}
        />
        <button
          className="btn btn-secondary big"
          onClick={joinByCode}
        >
          🚪 Dołącz do pokoju
        </button>

        {error && <div className="error">{error}</div>}
      </div>

      <button className="list-switch-btn" onClick={toggleList}>
        {currentList === "list1" ? "·" : "··"}
      </button>
    </div>
  );
}

export default Lobby;
