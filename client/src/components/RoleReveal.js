import { useEffect, useState } from "react";
import { socket } from "../socket";

function RoleReveal({ state }) {
  const [phase, setPhase] = useState("warning");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 4000);
    return () => clearTimeout(t1);
  }, []);

  if (phase === "warning") {
    return (
      <div className="screen center role-warning">
        <div className="card warning-card pop-in">
          <h1>⚠️</h1>
          <h2>Odejdź od innych graczy!</h2>
          <p>Zaraz dowiesz się kim jesteś.</p>
          <p className="muted">Nikt inny nie może tego zobaczyć.</p>
          <div className="countdown-bar">
            <div className="countdown-fill" />
          </div>
        </div>
      </div>
    );
  }

  const isSaboteur = state.myRole === "saboteur";
  const data = state.phaseData;
  const iReady = !!data?.readyToNext?.[state.myId];
  const aliveCount = state.players.filter(p => !p.eliminated).length;
  const readyCount = Object.keys(data?.readyToNext || {}).length;

  return (
    <div className={`screen center role-reveal ${isSaboteur ? "saboteur-bg" : "player-bg"}`}>
      <div className={`card reveal-card ${isSaboteur ? "saboteur-reveal" : "player-reveal-glow"}`}>
        {isSaboteur ? (
          <>
            <div className="role-icon" style={{ fontSize: 64 }}>🧨</div>
            <h1 className="saboteur-text" style={{ fontSize: 28, marginTop: 12 }}>
              JESTEŚ SABOTAŻYSTĄ
            </h1>
            <p style={{ color: "#fca5a5" }}>Psuć, sabotować, nie dać się złapać!</p>
            <ul className="role-tips">
              <li>Wpisuj złe odpowiedzi w kalamburach</li>
              <li>Głosuj NIE w "5 sekund" gdy ktoś dobrze odpowiada</li>
              <li>W quizie klikaj złą odpowiedź</li>
              <li>Nikt nie wie że nim jesteś 🤫</li>
            </ul>
          </>
        ) : (
          <>
            <div className="role-icon" style={{ fontSize: 64 }}>✅</div>
            <h1 className="player-text" style={{ fontSize: 28, marginTop: 12 }}>
              JESTEŚ GRACZEM
            </h1>
            <p style={{ color: "#86efac" }}>Graj uczciwie i wykryj sabotażystę!</p>
            <ul className="role-tips">
              <li>Obserwuj kto odpowiada dziwnie</li>
              <li>Zwracaj uwagę na zachowanie innych</li>
              <li>Głosuj mądrze w głosowaniu</li>
              <li>Wśród Was jest sabotażysta! 🕵️</li>
            </ul>
          </>
        )}

        <p className="muted small">{readyCount}/{aliveCount} gotowych</p>

        <button
          className={`btn ${iReady ? "btn-disabled" : "btn-primary"} big`}
          onClick={() => !iReady && socket.emit("role_reveal_ready")}
          disabled={iReady}
        >
          {iReady ? "⏳ Czekam na innych..." : "Zapamiętałem — Dalej →"}
        </button>
      </div>
    </div>
  );
}

export default RoleReveal;
