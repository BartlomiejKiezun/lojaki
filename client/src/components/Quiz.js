import { useEffect, useState } from "react";
import { socket } from "../socket";
import Avatar from "./Avatar";
import Scoreboard from "./Scoreboard";
import FlyingAvatars from "./FlyingAvatars";
import ConfettiBurst from "./ConfettiBurst";

const LABELS = ["A", "B", "C", "D"];
const COLORS = ["#6366f1", "#f59e0b", "#22c55e", "#ef4444"];

function Quiz({ state }) {
  const [timeLeft, setTimeLeft] = useState(state.phaseData?.timeLeft ?? 20);
  const [localChoice, setLocalChoice] = useState(null);

  useEffect(() => {
    const handler = (t) => setTimeLeft(t);
    socket.on("timer_tick", handler);
    return () => socket.off("timer_tick", handler);
  }, []);

  useEffect(() => {
    setTimeLeft(state.phaseData?.timeLeft ?? 20);
    setLocalChoice(null); // reset przy nowym pytaniu
  }, [state.phaseData?.questionIndex]);

  const data = state.phaseData;
  const myData = state.myPhaseData;

  if (!data) return <div className="screen">Ładowanie...</div>;

  // ============= KONIEC CAŁEJ MINIGRY =============
  if (data.miniGameFinished) {
    const isHost = state.myId === state.hostId;
    return (
      <div className="screen center">
        <div className="card big-card">
          <h1>🧠 Koniec quizu!</h1>
          <div className="rounds-summary">
            {data.questionsHistory?.map((r, i) => (
              <div key={i} className={`round-row ${r.majorityCorrect ? "good" : "bad"}`}>
                <span className="word-small">{r.question}</span>
                <span>{r.correct}✅ {r.wrong}❌</span>
                <span>{r.majorityCorrect ? "✅" : "❌"}</span>
              </div>
            ))}
          </div>
          <Scoreboard state={state} />
          {isHost
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_phase")}>Dalej →</button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= WYNIK PYTANIA =============
  if (data.finished && data.result) {
    const r = data.result;
    const myAns = myData?.myAnswer;
    const myCorrect = myAns === r.correctIndex;
    const isHost = state.myId === state.hostId;
    const me2 = state.players.find(p => p.id === state.myId);

    return (
      <div className={`screen center ${r.majorityCorrect ? "good-bg" : "bad-bg"}`}>
        {myAns === r.correctIndex && <ConfettiBurst trigger={data.questionIndex} count={25} />}
        <div className="card big-card">
          <h1>{r.majorityCorrect ? "✅ Większość trafiła!" : "❌ Większość się myliła"}</h1>
          <p className="muted">{r.question}</p>

          <div className="quiz-answers-result">
            {r.answers.map((ans, i) => (
              <div key={i} className={`quiz-answer-result ${i === r.correctIndex ? "correct-answer" : ""} ${myAns === i ? "my-choice" : ""}`}>
                <span className="quiz-label">{LABELS[i]}</span>
                <span className="quiz-answer-text">{ans}</span>
                {i === r.correctIndex && <span className="correct-badge">✅ Poprawna</span>}
                {myAns === i && i !== r.correctIndex && <span className="wrong-badge">❌ Twoja</span>}
              </div>
            ))}
          </div>

          <div className="quiz-score-summary">
            <div className="quiz-stat good">✅ Dobrze: <strong>{r.correct}</strong></div>
            <div className="quiz-stat bad">❌ Źle: <strong>{r.wrong}</strong></div>
          </div>

          {r.playerResults && (
            <div className="quiz-players-result">
              <p className="muted small">Odpowiedzi graczy:</p>
              {state.players.filter(p => !p.eliminated).map(p => {
                const pr = r.playerResults[p.id];
                const answered = pr?.answer !== undefined && pr?.answer !== null;
                return (
                  <div key={p.id} className={`quiz-player-row ${pr?.correct ? "good" : "bad"}`}>
                    <Avatar src={p.avatar} name={p.name} size="small" />
                    <span>{p.name}</span>
                    <span className="quiz-player-answer">
                      {answered ? `${LABELS[pr.answer]} ${pr.correct ? "✅" : "❌"}` : "⏰ Brak"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="muted small">({data.questionIndex + 1}/{data.totalQuestions})</p>

          {isHost
            ? <button className="btn btn-primary big" onClick={() => socket.emit("host_next_quiz")}>Dalej →</button>
            : <p className="muted center">⏳ Czekaj na hosta...</p>
          }
        </div>
      </div>
    );
  }

  // ============= AKTYWNE PYTANIE =============
  const myAnswer = myData?.myAnswer ?? localChoice;
  const hasAnswered = myData?.hasAnswered;
  const answeredCount = Object.keys(data.playerAnswers || {}).length;
  const aliveCount = state.players.filter(p => !p.eliminated).length;

  const me = state.players.find(p => p.id === state.myId);
  if (me?.eliminated) {
    return (
      <div className="screen center">
        <div className="card">
          <h2>💀 Jesteś wyeliminowany</h2>
          <p className="muted">{data.question}</p>
          <Timer time={timeLeft} max={20} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen quiz-screen">
      <div className="card">
        <div className="phase-header">
          <span className="phase-icon">🧠</span>
          <span>Quiz — Pytanie {data.questionIndex + 1}/{data.totalQuestions}</span>
        </div>

        <Timer time={timeLeft} max={20} />

        <div className="quiz-question">
          {data.question}
        </div>

        <div className="quiz-answers">
          {data.answers?.map((ans, i) => (
            <button
              key={i}
              className={`btn quiz-answer-btn ${myAnswer === i ? "quiz-selected" : ""}`}
              style={{ borderColor: myAnswer === i ? COLORS[i] : "transparent" }}
              onClick={() => {
                if (hasAnswered) return;
                setLocalChoice(i);
                socket.emit("quiz_answer", { answerIndex: i });
              }}
              disabled={hasAnswered}
            >
              <span className="quiz-label-big" style={{ background: COLORS[i] }}>{LABELS[i]}</span>
              <span className="quiz-answer-label">{ans}</span>
            </button>
          ))}
        </div>

        {hasAnswered && (
          <div className="info-box">
            ✅ Odpowiedziałeś: <strong>{LABELS[myAnswer]}</strong>
            <p className="muted small">{answeredCount}/{aliveCount} graczy odpowiedziało</p>
          </div>
        )}

        {!hasAnswered && (
          <p className="muted small center">{answeredCount}/{aliveCount} graczy odpowiedziało</p>
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

export default Quiz;
