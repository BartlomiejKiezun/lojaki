import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";
import Scoreboard from "./Scoreboard";
import ConfettiBurst from "./ConfettiBurst";
import FlyingAvatars from "./FlyingAvatars";
import { playPoint, playFail } from "../sounds";

// CANVAS HOOK
function useDrawingCanvas({ isDrawer, onStroke, initialStrokes }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);

  const drawStroke = useCallback((stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = stroke.color || "#f1f5f9";
    ctx.lineWidth = stroke.size || 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.x1 * canvas.width, stroke.y1 * canvas.height);
    ctx.lineTo(stroke.x2 * canvas.width, stroke.y2 * canvas.height);
    ctx.stroke();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Setup canvas: wymiary + kontekst (uruchamia się gdy canvas pojawia się w DOM)
  const setupCanvas = useCallback((canvas) => {
    if (!canvas) return;
    canvasRef.current = canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
    ctxRef.current = canvas.getContext("2d");
    // Odtwórz historię strokes
    if (initialStrokes && initialStrokes.length > 0) {
      initialStrokes.forEach(s => drawStroke(s));
    }
  }, [initialStrokes, drawStroke]);

  // Socket listeners na strokes
  useEffect(() => {
    const onStrokeEvent = (data) => drawStroke(data.stroke || data);
    const onClearEvent = () => clearCanvas();
    socket.on("drawing_stroke", onStrokeEvent);
    socket.on("drawing_clear", onClearEvent);
    return () => {
      socket.off("drawing_stroke", onStrokeEvent);
      socket.off("drawing_clear", onClearEvent);
    };
  }, [drawStroke, clearCanvas]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches?.[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX; clientY = e.clientY;
    }
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const startDraw = useCallback((e) => {
    if (!isDrawer) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPoint.current = getPos(e);
  }, [isDrawer]);

  const draw = useCallback((e) => {
    if (!isDrawer || !isDrawing.current) return;
    e.preventDefault();
    const p = getPos(e);
    if (!lastPoint.current) { lastPoint.current = p; return; }
    const stroke = {
      x1: lastPoint.current.x, y1: lastPoint.current.y,
      x2: p.x, y2: p.y
    };
    drawStroke(stroke);
    onStroke?.(stroke);
    lastPoint.current = p;
  }, [isDrawer, drawStroke, onStroke]);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  return { canvasRef, setupCanvas, startDraw, draw, endDraw };
}

function Drawing({ state }) {
  const [timeLeft, setTimeLeft] = useState(state.phaseData?.timeLeft ?? 180);
  const [flyingAvs, setFlyingAvs] = useState([]);

  useEffect(() => {
    const handler = (t) => setTimeLeft(t);
    socket.on("timer_tick", handler);
    return () => socket.off("timer_tick", handler);
  }, []);

  useEffect(() => {
    setTimeLeft(state.phaseData?.timeLeft ?? 180);
  }, [state.phaseData?.currentDrawerId]);

  const data = state.phaseData;
  const myData = state.myPhaseData;
  const isHost = state.myId === state.hostId;
  const isDrawer = data?.currentDrawerId === state.myId;
  const me = state.players.find(p => p.id === state.myId);

  const handleStroke = (s) => {
    socket.emit("drawing_stroke", { stroke: s });
  };

  const { setupCanvas, startDraw, draw, endDraw } = useDrawingCanvas({
    isDrawer,
    onStroke: handleStroke,
    initialStrokes: myData?.strokes
  });

  useEffect(() => {
    if (data?.finished && data?.result) {
      if (data.result.guessed) {
        playPoint();
        const winners = [];
        const drawer = state.players.find(p => p.id === data.result.drawerId);
        if (drawer) winners.push({ avatar: drawer.avatar, name: drawer.name });
        (data.result.correctPlayers || []).forEach(cp => winners.push({ avatar: cp.avatar, name: cp.name }));
        setFlyingAvs(winners);
      } else {
        playFail();
      }
    }
  }, [data?.finished, data?.result?.guessed, data?.result?.drawerId, state.players, data?.result?.correctPlayers]);

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
          <h1>🎨 Koniec kalamburów rysowanych</h1>
          {rounds.map(rn => (
            <div key={rn} className="round-group">
              <h3 className="round-group-title">Runda {rn}</h3>
              <div className="rounds-summary">
                {byRound[rn].map((r, i) => (
                  <div key={i} className={`round-row ${r.guessed ? "good" : "bad"}`}>
                    <span>{r.drawerName}</span>
                    <span className="word-small">{r.word}</span>
                    <span>{r.guessed ? "✅" : "❌"}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Scoreboard state={state} />
          {isHost
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_drawing")}>Dalej →</button>
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
        {guessed && <ConfettiBurst trigger={data.currentDrawerId} count={30} />}
        {guessed && <FlyingAvatars avatars={flyingAvs} style="spin" duration={2500} />}
        <div className="card big-card">
          <h1 className={guessed ? "winner-explode" : ""}>{guessed ? "✅ Zgadnięto!" : "❌ Nikt nie zgadł"}</h1>
          <p>Hasło: <strong>{result.word}</strong></p>
          <p className="muted">Rysował: <strong>{result.drawerName}</strong></p>

          {guessed && (
            <div className="correct-players-box">
              <p className="muted small">🎯 +1 punkt dla:</p>
              <div className="correct-players-list">
                <div className="correct-player-chip actor-chip">
                  <Avatar src={state.players.find(p => p.id === result.drawerId)?.avatar} name={result.drawerName} size="small" />
                  <span>{result.drawerName} 🎨</span>
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
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_drawing")}>
                {data.nextDrawerName ? `Dalej → (${data.nextDrawerName})` : "Dalej →"}
              </button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= JESTEM RYSUJĄCYM =============
  if (isDrawer) {
    // PRZED STARTEM - Jestem gotowy
    if (!data.timerStarted) {
      return (
        <div className="screen center">
          <div className="card">
            <div className="phase-header">
              <span className="phase-icon">🎨</span>
              <span>Rysuj! ({data.currentDrawerNumber}/{data.totalDrawersInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
            </div>
            <p className="big-text">🎨 Twoja kolej!</p>
            <p>Po kliknięciu "Start" zobaczysz hasło. Masz 3 minuty żeby je narysować.</p>
            <p className="muted small">Gdy ktoś zgadnie - zaznaczysz go na liście.</p>
            <button
              className="btn btn-success big"
              onClick={() => socket.emit("drawer_ready")}
            >
              ▶️ Jestem gotowy
            </button>
          </div>
        </div>
      );
    }

    const aliveOthers = state.players.filter(p => !p.eliminated && p.id !== state.myId);
    const picks = data.drawerPicks || {};
    const pickedId = Object.keys(picks)[0];
    const pickedName = aliveOthers.find(p => p.id === pickedId)?.name;

    return (
      <div className="screen drawing-screen">
        <div className="card">
          <div className="phase-header">
            <span className="phase-icon">🎨</span>
            <span>Rysuj! ({data.currentDrawerNumber}/{data.totalDrawersInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
          </div>

          <Timer time={timeLeft} max={180} />

          <div className="word-box big-word">
            <p className="muted small">Twoje hasło:</p>
            <h1>{myData?.word || data.word}</h1>
          </div>

          <div className="canvas-wrapper">
            <canvas
              ref={setupCanvas}
              className="drawing-canvas"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>

          <button className="btn small-btn" onClick={() => socket.emit("drawing_clear")}>
            🗑️ Wyczyść
          </button>

          <p className="muted small">Gdy ktoś zgadnie - zaznacz go:</p>

          <div className="speaker-picks-grid">
            {aliveOthers.map(p => (
              <button
                key={p.id}
                className={`vote-card ${pickedId === p.id ? "voted" : ""}`}
                onClick={() => socket.emit("drawer_toggle_pick", { playerId: p.id })}
              >
                <Avatar src={p.avatar} name={p.name} size="medium" />
                <div className="vote-name">{p.name}</div>
                {pickedId === p.id && <div className="vote-check">✓</div>}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary big"
            onClick={() => socket.emit("drawer_confirm_picks")}
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
          <p>Rysuje: <strong>{data.currentDrawerName}</strong></p>
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
            <span className="phase-icon">🎨</span>
            <span>Kalambury rysowane ({data.currentDrawerNumber}/{data.totalDrawersInRound}) • Runda {data.roundNumber}/{data.totalRounds}</span>
          </div>
          <div className="actor-info">
            <Avatar src={data.currentDrawerAvatar} name={data.currentDrawerName} size="big" className="actor-pulse" />
            <h2>{data.currentDrawerName}</h2>
            <p className="muted">przygotowuje się...</p>
          </div>
          <p className="muted">Czekaj aż zacznie rysować...</p>
        </div>
      </div>
    );
  }

  const picks = data.drawerPicks || {};
  const iWasPicked = picks[state.myId];

  return (
    <div className="screen center">
      <div className="card">
        <div className="phase-header">
          <span className="phase-icon">🎨</span>
          <span>Kalambury rysowane • Runda {data.roundNumber}/{data.totalRounds}</span>
        </div>

        <Timer time={timeLeft} max={180} />

        <div className="actor-info">
          <Avatar src={data.currentDrawerAvatar} name={data.currentDrawerName} size="big" className="actor-pulse" />
          <h2>{data.currentDrawerName}</h2>
          <p className="muted">rysuje hasło...</p>
        </div>

        <div className="canvas-wrapper">
          <canvas
            ref={setupCanvas}
            className="drawing-canvas"
          />
        </div>

        <p className="big-text">👀 Zgaduj NA GŁOS!</p>
        <p className="muted small">{data.currentDrawerName} zaznaczy kto pierwszy zgadł.</p>

        {iWasPicked && (
          <div className="my-picked-badge">
            🎯 {data.currentDrawerName} zaznaczył Ciebie!
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
  const danger = time <= 30;
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

export default Drawing;