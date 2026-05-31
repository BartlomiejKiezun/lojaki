import { useState } from "react";
import { socket } from "../socket";

function HostEndButton({ state }) {
  const [step, setStep] = useState(0); // 0=ukryty, 1=pierwsza pyt, 2=druga pyt

  if (!state) return null;
  if (state.phase === "lobby") return null;
  if (state.phase === "game_over") return null;
  if (state.myId !== state.hostId) return null;

  const handleClick = () => {
    if (step === 0) setStep(1);
    else if (step === 1) setStep(2);
    else if (step === 2) {
      socket.emit("end_game_host");
      setStep(0);
    }
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setStep(0);
  };

  return (
    <div className="host-end-bar">
      {step === 0 && (
        <button className="btn host-end-btn" onClick={handleClick}>
          🏁 Zakończ grę (host)
        </button>
      )}
      {step === 1 && (
        <div className="host-end-confirm">
          <span>Na pewno zakończyć?</span>
          <button className="btn btn-danger small-btn" onClick={handleClick}>
            Tak, dalej
          </button>
          <button className="btn small-btn" onClick={handleCancel}>
            Anuluj
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="host-end-confirm danger">
          <span>⚠️ Ostatnia szansa — kończymy?</span>
          <button className="btn btn-danger small-btn" onClick={handleClick}>
            🏁 Tak, zakończ
          </button>
          <button className="btn small-btn" onClick={handleCancel}>
            Anuluj
          </button>
        </div>
      )}
    </div>
  );
}

export default HostEndButton;