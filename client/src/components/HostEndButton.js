import { useState } from "react";
import { socket } from "../socket";

function HostEndButton({ state }) {
  const [hostStep, setHostStep] = useState(0); // host: 0=ukryty, 1-3=potwierdzenia
  const [leaveStep, setLeaveStep] = useState(0); // każdy gracz: 0=ukryty, 1-3

  if (!state) return null;
  if (state.phase === "lobby") return null;
  if (state.phase === "game_over") return null;

  const isHost = state.myId === state.hostId;

  // ============ HOST: zakończ grę dla wszystkich ============
  const handleHostClick = () => {
    if (hostStep === 0) setHostStep(1);
    else if (hostStep === 1) setHostStep(2);
    else if (hostStep === 2) {
      socket.emit("end_game_host");
      setHostStep(0);
    }
  };
  const handleHostCancel = (e) => { e.stopPropagation(); setHostStep(0); };

  // ============ GRACZ: opuść grę (tylko ja) ============
  const handleLeaveClick = () => {
    if (leaveStep === 0) setLeaveStep(1);
    else if (leaveStep === 1) setLeaveStep(2);
    else if (leaveStep === 2) setLeaveStep(3);
    else if (leaveStep === 3) {
      localStorage.removeItem("game_session");
      socket.emit("player_leave");
      setLeaveStep(0);
    }
  };
  const handleLeaveCancel = (e) => { e.stopPropagation(); setLeaveStep(0); };

  return (
    <div className="host-end-bar">
      {/* PRZYCISK HOSTA (lewy) - tylko gdy host */}
      {isHost && hostStep === 0 && leaveStep === 0 && (
        <button className="btn host-end-btn" onClick={handleHostClick}>
          🏁 Zakończ grę (host)
        </button>
      )}
      {isHost && hostStep === 1 && (
        <div className="host-end-confirm">
          <span>Na pewno zakończyć?</span>
          <button className="btn btn-danger small-btn" onClick={handleHostClick}>Tak, dalej</button>
          <button className="btn small-btn" onClick={handleHostCancel}>Anuluj</button>
        </div>
      )}
      {isHost && hostStep === 2 && (
        <div className="host-end-confirm danger">
          <span>⚠️ Ostatnia szansa — kończymy?</span>
          <button className="btn btn-danger small-btn" onClick={handleHostClick}>🏁 Tak, zakończ</button>
          <button className="btn small-btn" onClick={handleHostCancel}>Anuluj</button>
        </div>
      )}

      {/* PRZYCISK OPUSZCZENIA (prawy) - dla każdego */}
      {leaveStep === 0 && hostStep === 0 && (
        <button className="btn host-leave-btn" onClick={handleLeaveClick}>
          🚪 Opuść grę
        </button>
      )}
      {leaveStep === 1 && (
        <div className="host-end-confirm">
          <span>Na pewno wyjść z gry?</span>
          <button className="btn btn-danger small-btn" onClick={handleLeaveClick}>Tak</button>
          <button className="btn small-btn" onClick={handleLeaveCancel}>Anuluj</button>
        </div>
      )}
      {leaveStep === 2 && (
        <div className="host-end-confirm">
          <span>Stracisz wszystkie punkty.</span>
          <button className="btn btn-danger small-btn" onClick={handleLeaveClick}>Wiem, dalej</button>
          <button className="btn small-btn" onClick={handleLeaveCancel}>Anuluj</button>
        </div>
      )}
      {leaveStep === 3 && (
        <div className="host-end-confirm danger">
          <span>⚠️ Ostatnia szansa!</span>
          <button className="btn btn-danger small-btn" onClick={handleLeaveClick}>🚪 Tak, wyjdź</button>
          <button className="btn small-btn" onClick={handleLeaveCancel}>Anuluj</button>
        </div>
      )}
    </div>
  );
}

export default HostEndButton;