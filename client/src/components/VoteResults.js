import { socket } from "../socket";

function VoteResults({ state }) {
  const data = state.phaseData;
  if (!data) return <div className="screen">Ładowanie...</div>;

  const aliveCount = state.players.filter(p => !p.eliminated).length;
  const readyCount = Object.keys(data.readyToNext || {}).length;
  const iReady = !!data.readyToNext?.[state.myId];

  return (
    <div className="screen center">
      <div className="card big-card pop-in">
        <h1>🗳️ Głosowanie zakończone</h1>
        <p className="muted">Kliknij Dalej żeby zobaczyć kto odpada</p>

        <p className="muted small">{readyCount}/{aliveCount} gotowych</p>

        <button
          className={`btn ${iReady ? "btn-disabled" : "btn-danger"} big`}
          onClick={() => !iReady && socket.emit("vote_results_ready")}
          disabled={iReady}
        >
          {iReady ? "⏳ Czekam na innych..." : "Pokaż wynik →"}
        </button>
      </div>
    </div>
  );
}

export default VoteResults;
