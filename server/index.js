/**
 * 🎮 SABOTAŻYSTA - SERWER GRY (v2)
 *
 * Zmiany w v2:
 * - 5 sekund: tury, każdy mówi po kolei, głosowanie OK/NIE, próg 3 głosów NIE
 * - Kalambury: wszyscy pokazują po kolei (1 minigra = N rund)
 * - Eliminacja: bez publicznego ujawniania roli
 * - Wyrzucony gracz: prywatny reveal kto był sabotażystą
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const playersList = require("./players.json");
const words = require("./words.json");

const app = express();
app.use(cors());

// Health check endpoint - używany przez keep-alive żeby Render Free nie zasypiał
app.get("/ping", (req, res) => {
  res.json({ ok: true, time: Date.now(), rooms: Object.keys(rooms).length });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = {};

const PHASE = {
  LOBBY: "lobby",
  ROLE_REVEAL: "role_reveal",
  ANNOUNCING: "announcing",
  ACTING: "acting",
  FIVE_SECONDS: "fiveSeconds",
  DRAWING: "drawing",
  ASSOCIATIONS: "associations",
  FIELD_GAME: "fieldGame",
  QUIZ: "quiz",
  VOTING: "voting",
  VOTE_RESULTS: "voteResults",
  ELIMINATION: "elimination",
  GAME_OVER: "game_over"
};

const MINIGAME_NAMES = {
  fiveSeconds: "⚡ 5 sekund",
  acting: "🎭 Kalambury ruchowe",
  drawing: "🎨 Kalambury rysowane",
  associations: "🧠 Skojarzenia",
  fieldGame: "🏃 Gra terenowa",
  quiz: "❓ Quiz"
};

function saveToGameHistory(room, game, rounds) {
  if (!room.gameHistory) room.gameHistory = [];
  room.gameHistory.push({
    game,
    name: MINIGAME_NAMES[game] || game,
    rounds // tablica { label, guessed/rejected/correct, pointTo }
  });
}

const DRAWING_TIME = 180;
const FIELD_GAME_TIME = 60;
const QUIZ_TIME = 20;
const QUIZ_QUESTIONS_PER_GAME = 15;
const ROUNDS_PER_MINIGAME = 3;

const REJECT_THRESHOLD = 3;

// ===========================================
// HELPERS
// ===========================================

function generateRoomId() {
  let id;
  do {
    id = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms[id]);
  return id;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function howManySaboteurs(playerCount) {
  if (playerCount <= 5) return 1;
  if (playerCount <= 8) return 2;
  return 3;
}

function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e")
    .replace(/ł/g, "l").replace(/ń/g, "n").replace(/ó/g, "o")
    .replace(/ś/g, "s").replace(/ż/g, "z").replace(/ź/g, "z")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) m[i][j] = m[i - 1][j - 1];
      else m[i][j] = Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

function isAnswerCorrect(answer, target) {
  const a = normalize(answer);
  const t = normalize(target);
  if (!a || !t) return false;
  if (a === t) return true;
  return levenshtein(a, t) <= 1;
}

// ===========================================
// BROADCAST
// ===========================================

function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const showRoles = room.phase === PHASE.GAME_OVER;

  const publicState = {
    phase: room.phase,
    mode: room.mode || "saboteur",
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      eliminated: p.eliminated,
      connected: p.connected,
      isHost: p.id === room.hostId,
      score: room.playerScores?.[p.id] || 0,
      role: showRoles ? p.role : undefined
    })),
    roomId: roomId,
    hostId: room.hostId,
    scoreGracze: room.scoreGracze,
    scoreSabo: room.scoreSabo,
    round: room.round,
    gameHistory: room.gameHistory || [],
    currentMinigame: room.currentMinigame || null,
    phaseData: getPublicPhaseData(room),
    winner: room.winner || null
  };

  for (const player of room.players) {
    if (!player.connected) continue;

    const personalState = {
      ...publicState,
      myId: player.id,
      myRole: player.role,
      myEliminated: player.eliminated,
      myPhaseData: getPersonalPhaseData(room, player)
    };

    io.to(player.id).emit("state", personalState);
  }
}

function getPublicPhaseData(room) {
  if (!room.phaseData) return null;
  const data = { ...room.phaseData };

  if (room.phase === PHASE.ASSOCIATIONS) {
    // Nie ujawniamy słów w publicznym state — każdy dostaje swoje przez myPhaseData
    const { playersWord, saboteurWord, ...rest } = data;
    // Po reveal pokazujemy oba słowa
    if (data.wordRevealed) {
      return { ...rest, playersWord, saboteurWord };
    }
    return rest;
  }

  if (room.phase === PHASE.ACTING && !data.finished) {
    delete data.word;
  }

  if (room.phase === PHASE.DRAWING && !data.finished) {
    delete data.word;
    delete data.strokes; // strokes idą przez drawing_stroke event, nie przez state
  }

  return data;
}

function getPersonalPhaseData(room, player) {
  if (!room.phaseData) return null;

  if (room.phase === PHASE.ELIMINATION) {
    if (player.eliminated && room.phaseData.eliminatedPlayer?.id === player.id) {
      const saboteurs = room.players
        .filter(p => p.role === "saboteur")
        .map(p => ({ id: p.id, name: p.name, avatar: p.avatar }));
      return {
        showSaboteurs: true,
        saboteurs: saboteurs
      };
    }
    return { showSaboteurs: false };
  }

  if (room.phase === PHASE.QUIZ) {
    const data = room.phaseData;
    return {
      myAnswer: data.answers?.[player.id] ?? null,
      hasAnswered: data.answers?.[player.id] !== undefined
    };
  }

  if (room.phase === PHASE.FIELD_GAME) {
    const data = room.phaseData;
    const isCurrentPlayer = data.currentPlayerId === player.id;
    return {
      isCurrentPlayer,
      task: data.task, // wszyscy widzą task
      myVote: data.votes?.[player.id] || null,
      hasVoted: !!data.votes?.[player.id]
    };
  }

  if (room.phase === PHASE.ASSOCIATIONS) {
    const isSaboteur = player.role === "saboteur";
    const myWord = isSaboteur
      ? room.phaseData.saboteurWord
      : room.phaseData.playersWord;
    return {
      myWord,
      isSaboteur,
      wordRevealed: room.phaseData.wordRevealed
    };
  }

  if (room.phase === PHASE.DRAWING) {
    const data = room.phaseData;
    const isCurrentDrawer = data.currentDrawerId === player.id;
    return {
      isDrawer: isCurrentDrawer,
      word: isCurrentDrawer ? data.word : null,
      myAnswer: data.answers?.[player.id] || null,
      hasAnswered: !!data.answers?.[player.id],
      strokes: data.strokes || []
    };
  }

  if (room.phase === PHASE.ACTING) {
    const data = room.phaseData;
    const isCurrentActor = data.currentActorId === player.id;
    return {
      isActor: isCurrentActor,
      word: isCurrentActor ? data.word : null,
      myAnswer: data.answers?.[player.id] || null,
      hasAnswered: !!data.answers?.[player.id]
    };
  }

  if (room.phase === PHASE.FIVE_SECONDS) {
    const data = room.phaseData;
    const isCurrentSpeaker = data.currentSpeakerId === player.id;
    return {
      isCurrentSpeaker: isCurrentSpeaker,
      myVote: data.votes?.[player.id] || null,
      hasVoted: !!data.votes?.[player.id]
    };
  }

  if (room.phase === PHASE.VOTING) {
    return {
      myVote: room.phaseData.votes?.[player.id] || null,
      hasVoted: !!room.phaseData.votes?.[player.id]
    };
  }

  return null;
}

// ===========================================
// CYKL GRY
// ===========================================

// Stała kolejność minigier: fiveSeconds, acting, głosowanie, drawing, głosowanie, associations, głosowanie, ...
const MINIGAME_ORDER_SABO = ["fiveSeconds", "acting", "drawing", "associations", "fieldGame", "quiz"];
const MINIGAME_ORDER_POINTS = ["fiveSeconds", "drawing", "acting", "quiz"];

function getMinigameOrder(room) {
  return room.mode === "points" ? MINIGAME_ORDER_POINTS : MINIGAME_ORDER_SABO;
}

function startNextPhase(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const alive = room.players.filter(p => !p.eliminated);

  // Tryb sabo - kończ gry przy alive <= 1
  if (room.mode !== "points" && alive.length <= 1) {
    room.phase = PHASE.GAME_OVER;
    room.winner = alive.length === 0 ? "nobody" : alive[0].role === "saboteur" ? "saboteurs" : "players";
    if (room.timer) clearInterval(room.timer);
    broadcastRoomState(roomId);
    return;
  }

  // Po każdej minigrze — sprawdź czy czas na głosowanie
  if (room.needsVoting) {
    room.needsVoting = false;
    room.miniGamesSinceVoting = (room.miniGamesSinceVoting || 0) + 1;

    if (room.miniGamesSinceVoting >= room.votingInterval) {
      room.miniGamesSinceVoting = 0;
      startVoting(roomId);
      return;
    }
  }

  // Wybierz kolejną minigrę wg stałej kolejności
  const idx = room.miniGameIndex ?? 0;
  const game = getMinigameOrder(room)[idx % getMinigameOrder(room).length];
  room.miniGameIndex = idx + 1;
  room.needsVoting = true;
  room.round++;

  // Ekran zapowiedzi — "Za chwilę: ..."
  room.phase = PHASE.ANNOUNCING;
  room.currentMinigame = game;
  room.phaseData = {
    nextGame: game,
    nextGameName: MINIGAME_NAMES[game] || game,
    timeLeft: 5
  };
  broadcastRoomState(roomId);

  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    if (!rooms[roomId] || room.phase !== PHASE.ANNOUNCING) { clearInterval(room.timer); return; }
    room.phaseData.timeLeft--;
    io.to(roomId).emit("timer_tick", room.phaseData.timeLeft);
    if (room.phaseData.timeLeft <= 0) {
      clearInterval(room.timer);
      if (game === "acting") startActing(roomId);
      else if (game === "fiveSeconds") startFiveSeconds(roomId);
      else if (game === "drawing") startDrawing(roomId);
      else if (game === "associations") startAssociations(roomId);
      else if (game === "fieldGame") startFieldGame(roomId);
      else startQuiz(roomId);
    }
  }, 1000);
}

// ===========================================
// KALAMBURY RUCHOWE - WSZYSCY PO KOLEI
// ===========================================

function startActing(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const alive = room.players.filter(p => !p.eliminated && p.connected);
  const order = shuffle(alive).map(p => p.id);

  room.phase = PHASE.ACTING;
  room.currentMinigame = "acting";
  room.phaseData = {
    actorOrder: order,
    actorIndex: 0,
    currentActorId: order[0],
    currentActorName: alive.find(p => p.id === order[0])?.name,
    word: null,
    answers: {},
    timeLeft: 40,
    finished: false,
    miniGameFinished: false,
    result: null,
    roundsHistory: [],
    totalActorsInRound: order.length,
    roundNumber: 1,
    totalRounds: ROUNDS_PER_MINIGAME
  };

  startActingRound(roomId);
}

function startActingRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!room.usedActingWords) room.usedActingWords = new Set();
  let availableWords = words.acting.filter(w => !room.usedActingWords.has(w));
  if (availableWords.length === 0) {
    room.usedActingWords.clear();
    availableWords = words.acting;
  }
  const word = pickRandom(availableWords);
  room.usedActingWords.add(word);

  room.phaseData.word = word;
  room.phaseData.actorPicks = {};
  room.phaseData.timeLeft = 40;
  room.phaseData.timerStarted = false; // czeka aż aktor kliknie Start
  room.phaseData.timerEnded = false;
  room.phaseData.finished = false;
  room.phaseData.result = null;

  const actorId = room.phaseData.actorOrder[room.phaseData.actorIndex];
  const actor = room.players.find(p => p.id === actorId);
  room.phaseData.currentActorId = actorId;
  room.phaseData.currentActorName = actor?.name;
  room.phaseData.currentActorAvatar = actor?.avatar;
  room.phaseData.currentActorNumber = room.phaseData.actorIndex + 1;

  broadcastRoomState(roomId);
}

function startActingTimer(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.ACTING) return;
  if (room.phaseData.timerStarted) return;
  room.phaseData.timerStarted = true;
  broadcastRoomState(roomId);

  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    if (!rooms[roomId] || room.phase !== PHASE.ACTING) {
      clearInterval(room.timer);
      return;
    }
    if (room.phaseData.finished) return;

    room.phaseData.timeLeft--;

    if (room.phaseData.timeLeft <= 0) {
      clearInterval(room.timer);
      io.to(roomId).emit("timer_tick", 0);
      // Po czasie - panel wyboru
      room.phaseData.timerEnded = true;
      broadcastRoomState(roomId);
    } else {
      io.to(roomId).emit("timer_tick", room.phaseData.timeLeft);
    }
  }, 1000);
}

function finishActingRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.ACTING) return;
  if (room.phaseData.finished) return;

  if (room.timer) clearInterval(room.timer);

  const data = room.phaseData;
  data.finished = true;

  // Lista graczy zaznaczonych przez aktora (jeden gracz max)
  const pickedIds = Object.keys(data.actorPicks || {});
  const pickedId = pickedIds[0];

  const correctPlayers = [];
  if (pickedId) {
    const p = room.players.find(pl => pl.id === pickedId && !pl.eliminated);
    if (p && p.id !== data.currentActorId) {
      correctPlayers.push({ id: p.id, name: p.name, avatar: p.avatar });
    }
  }

  const guessed = correctPlayers.length > 0;
  if (guessed) {
    room.scoreGracze++;
    awardPoint(room, data.currentActorId);
    for (const cp of correctPlayers) awardPoint(room, cp.id);
  } else {
    room.scoreSabo++;
  }

  data.result = {
    word: data.word,
    actorName: data.currentActorName,
    actorId: data.currentActorId,
    guessed,
    correctPlayers,
    roundNumber: data.roundNumber
  };
  data.roundsHistory.push(data.result);

  // Info o następnym aktorze
  let nextActorName = null;
  for (let i = data.actorIndex + 1; i < data.actorOrder.length; i++) {
    const np = room.players.find(p => p.id === data.actorOrder[i]);
    if (np && !np.eliminated && np.connected) { nextActorName = np.name; break; }
  }
  data.nextActorName = nextActorName;
  data.waitingForHost = true;

  broadcastRoomState(roomId);
}

function advanceActingRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.ACTING) return;
  if (!room.phaseData.finished) return;

  const data = room.phaseData;
  data.waitingForHost = false;
  data.actorIndex++;

  while (data.actorIndex < data.actorOrder.length) {
    const nextId = data.actorOrder[data.actorIndex];
    const next = room.players.find(p => p.id === nextId);
    if (next && !next.eliminated && next.connected) break;
    data.actorIndex++;
  }

  if (data.actorIndex >= data.actorOrder.length) {
    // Skończyła się jedna runda - sprawdź czy kolejna
    if (data.roundNumber < data.totalRounds) {
      data.roundNumber++;
      data.actorIndex = 0;
      const aliveNow = room.players.filter(p => !p.eliminated && p.connected);
      data.actorOrder = shuffle(aliveNow).map(p => p.id);
      data.totalActorsInRound = data.actorOrder.length;
      startActingRound(roomId);
    } else {
      data.miniGameFinished = true;
      data.waitingForHost = true;
      saveToGameHistory(room, "acting", data.roundsHistory.map(r => ({
        label: r.actorName,
        result: r.guessed ? "✅ Zgadnięto" : "❌ Nie zgadnięto",
        pointTo: r.guessed ? "gracze" : "sabo"
      })));
      broadcastRoomState(roomId);
    }
  } else {
    startActingRound(roomId);
  }
}

// ===========================================
// 5 SEKUND - WSZYSCY PO KOLEI, GŁOSOWANIE OK/NIE
// ===========================================

function calcThreshold(voters) {
  return Math.max(2, Math.ceil(voters / 3));
}

function awardPoint(room, playerId) {
  if (!room.playerScores) room.playerScores = {};
  room.playerScores[playerId] = (room.playerScores[playerId] || 0) + 1;
}

function startFiveSeconds(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!room.usedQuestions) room.usedQuestions = new Set();

  const alive = room.players.filter(p => !p.eliminated && p.connected);
  const order = shuffle(alive).map(p => p.id);
  const firstSpeaker = alive.find(p => p.id === order[0]);

  room.phase = PHASE.FIVE_SECONDS;
  room.currentMinigame = "fiveSeconds";
  room.phaseData = {
    question: null,
    speakerOrder: order,
    speakerIndex: 0,
    currentSpeakerId: order[0],
    currentSpeakerName: firstSpeaker?.name,
    currentSpeakerAvatar: firstSpeaker?.avatar,
    currentSpeakerNumber: 1,
    totalSpeakers: order.length,
    roundNumber: 1,
    totalRounds: ROUNDS_PER_MINIGAME,
    votes: {},
    timeLeft: 10,
    timerStarted: false,
    finished: false,
    miniGameFinished: false,
    result: null,
    rejectThreshold: calcThreshold(alive.length - 1),
    speakersHistory: []
  };

  startFiveSecondsTurn(roomId);
}

function startFiveSecondsTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.FIVE_SECONDS) return;

  // Losuj nowe pytanie dla każdego mówcy
  let availableQ = words.fiveSeconds.filter(q => !room.usedQuestions.has(q));
  if (availableQ.length === 0) {
    room.usedQuestions.clear();
    availableQ = words.fiveSeconds;
  }
  const question = pickRandom(availableQ);
  room.usedQuestions.add(question);

  room.phaseData.question = question;
  room.phaseData.votes = {};
  room.phaseData.timeLeft = 10;
  room.phaseData.timerStarted = false;
  room.phaseData.timerEnded = false;
  room.phaseData.finished = false;
  room.phaseData.result = null;

  // Info o następnym mówcy
  const nextSpeakerIdx = room.phaseData.speakerIndex + 1;
  let nextSpeakerName = null;
  for (let i = nextSpeakerIdx; i < room.phaseData.speakerOrder.length; i++) {
    const np = room.players.find(p => p.id === room.phaseData.speakerOrder[i]);
    if (np && !np.eliminated && np.connected) { nextSpeakerName = np.name; break; }
  }
  room.phaseData.nextSpeakerName = nextSpeakerName;

  broadcastRoomState(roomId);
}

function startFiveSecondsTimer(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.FIVE_SECONDS) return;
  if (room.phaseData.timerStarted) return;
  if (room.phaseData.finished) return;

  room.phaseData.timerStarted = true;
  room.phaseData.timeLeft = 10;

  broadcastRoomState(roomId);

  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    if (!rooms[roomId] || room.phase !== PHASE.FIVE_SECONDS) {
      clearInterval(room.timer);
      return;
    }
    if (room.phaseData.finished) {
      clearInterval(room.timer);
      return;
    }

    room.phaseData.timeLeft--;

    if (room.phaseData.timeLeft <= 0) {
      clearInterval(room.timer);
      io.to(roomId).emit("timer_tick", 0);
      // Czas się skończył - dalej można głosować, czeka aż wszyscy zagłosują
      room.phaseData.timerEnded = true;
      broadcastRoomState(roomId);
    } else {
      io.to(roomId).emit("timer_tick", room.phaseData.timeLeft);
    }
  }, 1000);
}

function finishFiveSecondsTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.FIVE_SECONDS) return;
  if (room.phaseData.finished) return;

  if (room.timer) clearInterval(room.timer);

  const data = room.phaseData;
  data.finished = true;

  let noVotes = 0;
  let okVotes = 0;
  for (const v of Object.values(data.votes || {})) {
    if (v === "no") noVotes++;
    if (v === "ok") okVotes++;
  }

  // Tylko większość OK daje punkt (remis i większość NIE = brak punktu)
  const guessed = okVotes > noVotes;

  if (guessed) {
    room.scoreGracze++;
    awardPoint(room, data.currentSpeakerId); // punkt dla mówcy
  } else {
    room.scoreSabo++;
  }

  data.result = {
    speakerName: data.currentSpeakerName,
    speakerId: data.currentSpeakerId,
    question: data.question,
    rejected: !guessed,
    guessed,
    noVotes,
    okVotes,
    roundNumber: data.roundNumber
  };
  data.speakersHistory.push(data.result);
  data.waitingForHost = true;
  broadcastRoomState(roomId);
}

function advanceFiveSecondsTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.FIVE_SECONDS) return;
  const data = room.phaseData;
  if (!data.finished) return;

  data.waitingForHost = false;
  data.speakerIndex++;

  while (data.speakerIndex < data.speakerOrder.length) {
    const nextId = data.speakerOrder[data.speakerIndex];
    const next = room.players.find(p => p.id === nextId);
    if (next && !next.eliminated && next.connected) break;
    data.speakerIndex++;
  }

  if (data.speakerIndex >= data.speakerOrder.length) {
    // Skończyła się jedna runda - sprawdź czy mamy jeszcze
    if (data.roundNumber < data.totalRounds) {
      // Kolejna runda - resetuj indeks, nowa kolejność
      data.roundNumber++;
      data.speakerIndex = 0;
      const aliveNow = room.players.filter(p => !p.eliminated && p.connected);
      data.speakerOrder = shuffle(aliveNow).map(p => p.id);
      data.totalSpeakers = data.speakerOrder.length;
      const nextId = data.speakerOrder[0];
      const next = room.players.find(p => p.id === nextId);
      data.currentSpeakerId = nextId;
      data.currentSpeakerName = next?.name;
      data.currentSpeakerAvatar = next?.avatar;
      data.currentSpeakerNumber = 1;
      startFiveSecondsTurn(roomId);
    } else {
      // Koniec wszystkich rund
      data.miniGameFinished = true;
      data.waitingForHost = true;
      saveToGameHistory(room, "fiveSeconds", data.speakersHistory.map(r => ({
        label: r.speakerName,
        result: r.guessed ? "✅ Zaliczone" : "❌ Odrzucone",
        pointTo: r.guessed ? "gracze" : "sabo"
      })));
      broadcastRoomState(roomId);
    }
  } else {
    const nextId = data.speakerOrder[data.speakerIndex];
    const next = room.players.find(p => p.id === nextId);
    data.currentSpeakerId = nextId;
    data.currentSpeakerName = next?.name;
    data.currentSpeakerAvatar = next?.avatar;
    data.currentSpeakerNumber = data.speakerIndex + 1;
    startFiveSecondsTurn(roomId);
  }
}

// ===========================================
// KALAMBURY RYSOWANE - WSZYSCY PO KOLEI
// ===========================================

function startDrawing(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const alive = room.players.filter(p => !p.eliminated && p.connected);
  const order = shuffle(alive).map(p => p.id);

  room.phase = PHASE.DRAWING;
  room.currentMinigame = "drawing";
  room.phaseData = {
    drawerOrder: order,
    drawerIndex: 0,
    currentDrawerId: order[0],
    currentDrawerName: alive.find(p => p.id === order[0])?.name,
    currentDrawerAvatar: alive.find(p => p.id === order[0])?.avatar,
    currentDrawerNumber: 1,
    totalDrawersInRound: order.length,
    roundNumber: 1,
    totalRounds: ROUNDS_PER_MINIGAME,
    word: null,
    answers: {},
    strokes: [],
    timeLeft: DRAWING_TIME,
    finished: false,
    miniGameFinished: false,
    result: null,
    roundsHistory: [],
    readyToNext: {}
  };

  startDrawingRound(roomId);
}

function startDrawingRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!room.usedDrawingWords) room.usedDrawingWords = new Set();
  let available = words.drawing.filter(w => !room.usedDrawingWords.has(w));
  if (available.length === 0) {
    room.usedDrawingWords.clear();
    available = words.drawing;
  }
  const word = pickRandom(available);
  room.usedDrawingWords.add(word);

  const drawerId = room.phaseData.drawerOrder[room.phaseData.drawerIndex];
  const drawer = room.players.find(p => p.id === drawerId);

  room.phaseData.word = word;
  room.phaseData.drawerPicks = {}; // rysujący zaznacza kto zgadł
  room.phaseData.strokes = [];
  room.phaseData.timeLeft = DRAWING_TIME;
  room.phaseData.timerStarted = false; // czeka aż rysujący kliknie Start
  room.phaseData.timerEnded = false;
  room.phaseData.finished = false;
  room.phaseData.result = null;
  room.phaseData.currentDrawerId = drawerId;
  room.phaseData.currentDrawerName = drawer?.name;
  room.phaseData.currentDrawerAvatar = drawer?.avatar;
  room.phaseData.currentDrawerNumber = room.phaseData.drawerIndex + 1;

  broadcastRoomState(roomId);
}

function startDrawingTimer(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.DRAWING) return;
  if (room.phaseData.timerStarted) return;
  room.phaseData.timerStarted = true;
  broadcastRoomState(roomId);

  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    if (!rooms[roomId] || room.phase !== PHASE.DRAWING) {
      clearInterval(room.timer);
      return;
    }
    if (room.phaseData.finished) return;

    room.phaseData.timeLeft--;

    if (room.phaseData.timeLeft <= 0) {
      clearInterval(room.timer);
      io.to(roomId).emit("timer_tick", 0);
      // Po czasie - panel wyboru graczy dla rysującego (jak w 5 sekund poprawkach)
      room.phaseData.timerEnded = true;
      broadcastRoomState(roomId);
    } else {
      io.to(roomId).emit("timer_tick", room.phaseData.timeLeft);
    }
  }, 1000);
}

function finishDrawingRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.DRAWING) return;
  if (room.phaseData.finished) return;

  if (room.timer) clearInterval(room.timer);

  const data = room.phaseData;
  data.finished = true;

  // Lista zaznaczonych przez rysującego (single-select)
  const pickedIds = Object.keys(data.drawerPicks || {});
  const pickedId = pickedIds[0];

  const correctPlayers = [];
  if (pickedId) {
    const p = room.players.find(pl => pl.id === pickedId && !pl.eliminated);
    if (p && p.id !== data.currentDrawerId) {
      correctPlayers.push({ id: p.id, name: p.name, avatar: p.avatar });
    }
  }

  const guessed = correctPlayers.length > 0;
  if (guessed) {
    room.scoreGracze++;
    awardPoint(room, data.currentDrawerId);
    for (const cp of correctPlayers) awardPoint(room, cp.id);
  } else {
    room.scoreSabo++;
  }

  data.result = {
    word: data.word,
    drawerName: data.currentDrawerName,
    drawerId: data.currentDrawerId,
    guessed,
    correctPlayers,
    roundNumber: data.roundNumber
  };
  data.roundsHistory.push(data.result);
  data.waitingForHost = true;

  // Info o następnym rysującym
  let nextDrawerName = null;
  for (let i = data.drawerIndex + 1; i < data.drawerOrder.length; i++) {
    const np = room.players.find(p => p.id === data.drawerOrder[i]);
    if (np && !np.eliminated && np.connected) { nextDrawerName = np.name; break; }
  }
  data.nextDrawerName = nextDrawerName;

  broadcastRoomState(roomId);
}

function advanceDrawingRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.DRAWING) return;

  const data = room.phaseData;
  if (!data.finished) return;
  data.waitingForHost = false;
  data.drawerIndex++;

  while (data.drawerIndex < data.drawerOrder.length) {
    const nextId = data.drawerOrder[data.drawerIndex];
    const next = room.players.find(p => p.id === nextId);
    if (next && !next.eliminated && next.connected) break;
    data.drawerIndex++;
  }

  if (data.drawerIndex >= data.drawerOrder.length) {
    // Skończyła się jedna runda - sprawdź czy kolejna
    if (data.roundNumber < data.totalRounds) {
      data.roundNumber++;
      data.drawerIndex = 0;
      const aliveNow = room.players.filter(p => !p.eliminated && p.connected);
      data.drawerOrder = shuffle(aliveNow).map(p => p.id);
      data.totalDrawersInRound = data.drawerOrder.length;
      startDrawingRound(roomId);
    } else {
      data.miniGameFinished = true;
      data.waitingForHost = true;
      saveToGameHistory(room, "drawing", data.roundsHistory.map(r => ({
        label: r.drawerName,
        result: r.guessed ? "✅ Zgadnięto" : "❌ Nie zgadnięto",
        pointTo: r.guessed ? "gracze" : "sabo"
      })));
      broadcastRoomState(roomId);
    }
  } else {
    startDrawingRound(roomId);
  }
}

// ===========================================
// QUIZ ABCD
// ===========================================

function startQuiz(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!room.usedQuizQuestions) room.usedQuizQuestions = new Set();

  room.phase = PHASE.QUIZ;
  room.currentMinigame = "quiz";
  room.phaseData = {
    questionIndex: 0,
    totalQuestions: QUIZ_QUESTIONS_PER_GAME,
    question: null,
    answers: null,
    correctIndex: null,
    playerAnswers: {},
    timeLeft: QUIZ_TIME,
    finished: false,
    miniGameFinished: false,
    result: null,
    questionsHistory: []
  };

  startQuizQuestion(roomId);
}

function startQuizQuestion(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.QUIZ) return;

  let available = words.quiz
    .map((q, i) => i)
    .filter(i => !room.usedQuizQuestions.has(i));
  if (available.length === 0) {
    room.usedQuizQuestions.clear();
    available = words.quiz.map((_, i) => i);
  }
  const idx = available[Math.floor(Math.random() * available.length)];
  room.usedQuizQuestions.add(idx);
  const q = words.quiz[idx];

  room.phaseData.question = q.question;
  room.phaseData.answers = q.answers;
  room.phaseData.correctIndex = q.correct;
  room.phaseData.playerAnswers = {};
  room.phaseData.timeLeft = QUIZ_TIME;
  room.phaseData.finished = false;
  room.phaseData.result = null;

  broadcastRoomState(roomId);

  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    if (!rooms[roomId] || room.phase !== PHASE.QUIZ) { clearInterval(room.timer); return; }
    if (room.phaseData.finished) { clearInterval(room.timer); return; }

    room.phaseData.timeLeft--;
    if (room.phaseData.timeLeft <= 0) {
      clearInterval(room.timer);
      finishQuizQuestion(roomId);
    } else {
      io.to(roomId).emit("timer_tick", room.phaseData.timeLeft);
    }
  }, 1000);
}

function finishQuizQuestion(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.QUIZ) return;
  if (room.phaseData.finished) return;
  if (room.timer) clearInterval(room.timer);

  const data = room.phaseData;
  data.finished = true;

  const alive = room.players.filter(p => !p.eliminated && p.connected);
  let correct = 0, wrong = 0;
  const playerResults = {};

  for (const p of alive) {
    const ans = data.playerAnswers[p.id];
    const isCorrect = ans === data.correctIndex;
    playerResults[p.id] = { answer: ans, correct: isCorrect, name: p.name };
    if (isCorrect) {
      correct++;
      awardPoint(room, p.id);
    } else {
      wrong++;
    }
  }

  const majorityCorrect = correct > alive.length / 2;
  if (majorityCorrect) room.scoreGracze++;
  else room.scoreSabo++;

  data.result = {
    question: data.question,
    answers: data.answers,
    correctIndex: data.correctIndex,
    playerResults,
    correct,
    wrong,
    majorityCorrect
  };
  data.questionsHistory.push(data.result);
  data.readyToNext = {};

  // Wyeliminowani automatycznie gotowi
  for (const p of room.players) {
    if (p.eliminated) data.readyToNext[p.id] = true;
  }

  broadcastRoomState(roomId);
}

function advanceQuizQuestion(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.QUIZ) return;
  const data = room.phaseData;
  if (!data.finished) return;

  data.questionIndex++;

  if (data.questionIndex >= data.totalQuestions) {
    data.miniGameFinished = true;
    data.waitingForHost = true;
    saveToGameHistory(room, "quiz", data.questionsHistory.map(r => ({
      label: r.question,
      result: r.majorityCorrect ? "✅ Większość trafiła" : "❌ Większość się myliła",
      pointTo: r.majorityCorrect ? "gracze" : "sabo"
    })));
    broadcastRoomState(roomId);
  } else {
    startQuizQuestion(roomId);
  }
}

// ===========================================
// GRA TERENOWA - przynieś/zrób zadanie
// ===========================================

function startFieldGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const alive = room.players.filter(p => !p.eliminated && p.connected);
  const order = shuffle(alive).map(p => p.id);

  if (!room.usedFieldTasks) room.usedFieldTasks = new Set();

  room.phase = PHASE.FIELD_GAME;
  // Dynamiczny próg: ceil(alive/3), minimum 2
  const dynamicThreshold = Math.max(2, Math.ceil(alive.length / 3));

  room.currentMinigame = "fieldGame";
  room.phaseData = {
    playerOrder: order,
    playerIndex: 0,
    currentPlayerId: order[0],
    currentPlayerName: alive.find(p => p.id === order[0])?.name,
    currentPlayerAvatar: alive.find(p => p.id === order[0])?.avatar,
    currentPlayerNumber: 1,
    totalPlayers: order.length,
    task: null,
    votes: {},
    timeLeft: FIELD_GAME_TIME,
    timerStarted: false,
    finished: false,
    miniGameFinished: false,
    result: null,
    roundsHistory: [],
    rejectThreshold: dynamicThreshold
  };

  startFieldGameTurn(roomId);
}

function startFieldGameTurn(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  let available = words.fieldGame.filter(t => !room.usedFieldTasks.has(t));
  if (available.length === 0) {
    room.usedFieldTasks.clear();
    available = words.fieldGame;
  }
  const task = pickRandom(available);
  room.usedFieldTasks.add(task);

  const playerId = room.phaseData.playerOrder[room.phaseData.playerIndex];
  const player = room.players.find(p => p.id === playerId);

  room.phaseData.task = task;
  room.phaseData.votes = {};
  room.phaseData.timeLeft = FIELD_GAME_TIME;
  room.phaseData.timerStarted = false;
  room.phaseData.finished = false;
  room.phaseData.result = null;
  room.phaseData.currentPlayerId = playerId;
  room.phaseData.currentPlayerName = player?.name;
  room.phaseData.currentPlayerAvatar = player?.avatar;
  room.phaseData.currentPlayerNumber = room.phaseData.playerIndex + 1;

  // Aktualizuj próg dynamicznie (alive - 1, bo gracz wykonujący nie głosuje)
  const aliveNow = room.players.filter(p => !p.eliminated && p.connected);
  room.phaseData.rejectThreshold = calcThreshold(aliveNow.length - 1);

  broadcastRoomState(roomId);
}

function startFieldGameTimer(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.FIELD_GAME) return;
  if (room.phaseData.timerStarted || room.phaseData.finished) return;

  room.phaseData.timerStarted = true;
  broadcastRoomState(roomId);

  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    if (!rooms[roomId] || room.phase !== PHASE.FIELD_GAME) {
      clearInterval(room.timer);
      return;
    }
    if (room.phaseData.finished) { clearInterval(room.timer); return; }

    room.phaseData.timeLeft--;
    if (room.phaseData.timeLeft <= 0) {
      clearInterval(room.timer);
      io.to(roomId).emit("timer_tick", 0);
      // Czas minął — automatycznie zamykamy głosowanie
      finishFieldGameTurn(roomId);
    } else {
      io.to(roomId).emit("timer_tick", room.phaseData.timeLeft);
    }
  }, 1000);
}

function finishFieldGameTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.FIELD_GAME) return;
  if (room.phaseData.finished) return;
  if (room.timer) clearInterval(room.timer);

  const data = room.phaseData;
  data.finished = true;

  let noVotes = 0, okVotes = 0;
  for (const v of Object.values(data.votes)) {
    if (v === "no") noVotes++;
    if (v === "ok") okVotes++;
  }

  const rejected = noVotes >= data.rejectThreshold;
  if (rejected) {
    room.scoreSabo++;
  } else {
    room.scoreGracze++;
    awardPoint(room, data.currentPlayerId);
  }

  data.result = {
    playerName: data.currentPlayerName,
    task: data.task,
    rejected,
    noVotes,
    okVotes,
    threshold: data.rejectThreshold
  };
  data.roundsHistory.push(data.result);

  // Info o następnym graczu
  let nextPlayerName = null;
  for (let i = data.playerIndex + 1; i < data.playerOrder.length; i++) {
    const np = room.players.find(p => p.id === data.playerOrder[i]);
    if (np && !np.eliminated && np.connected) { nextPlayerName = np.name; break; }
  }
  data.nextPlayerName = nextPlayerName;

  broadcastRoomState(roomId);

  setTimeout(() => {
    if (!rooms[roomId]) return;
    data.playerIndex++;

    while (data.playerIndex < data.playerOrder.length) {
      const nextId = data.playerOrder[data.playerIndex];
      const next = room.players.find(p => p.id === nextId);
      if (next && !next.eliminated && next.connected) break;
      data.playerIndex++;
    }

    if (data.playerIndex >= data.playerOrder.length) {
      data.miniGameFinished = true;
      data.waitingForHost = true;
      saveToGameHistory(room, "fieldGame", data.roundsHistory.map(r => ({
        label: r.playerName + ": " + r.task,
        result: r.rejected ? "❌ Odrzucono" : "✅ Zaliczono",
        pointTo: r.rejected ? "sabo" : "gracze"
      })));
      broadcastRoomState(roomId);
    } else {
      startFieldGameTurn(roomId);
    }
  }, 7000);
}

// ===========================================
// SKOJARZENIA - hasło na telefonie, rozmowa na żywo
// ===========================================

function startAssociations(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!room.usedAssociations) room.usedAssociations = new Set();
  let availableIdxs = words.associations
    .map((_, i) => i)
    .filter(i => !room.usedAssociations.has(i));
  if (availableIdxs.length === 0) {
    room.usedAssociations.clear();
    availableIdxs = words.associations.map((_, i) => i);
  }
  const idx = availableIdxs[Math.floor(Math.random() * availableIdxs.length)];
  room.usedAssociations.add(idx);
  const [playersWord, saboteurWord] = words.associations[idx];

  const alive = room.players.filter(p => !p.eliminated && p.connected);
  const saboteurIds = alive.filter(p => p.role === "saboteur").map(p => p.id);

  const prevRound = room.phaseData?.roundNumber || 0;

  room.phase = PHASE.ASSOCIATIONS;
  room.currentMinigame = "associations";
  room.phaseData = {
    playersWord,
    saboteurWord,
    saboteurIds,
    roundNumber: prevRound + 1,
    wordRevealed: false
  };

  broadcastRoomState(roomId);
}

// ===========================================
// GŁOSOWANIE NA SABOTAŻYSTĘ
// ===========================================

function startVoting(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.phase = PHASE.VOTING;
  room.currentMinigame = null;
  // Informacja o następnej minigrze
  const nextIdx = room.miniGameIndex ?? 0;
  const nextGame = getMinigameOrder(room)[nextIdx % getMinigameOrder(room).length];
  room.phaseData = {
    votes: {},
    timeLeft: 120,
    finished: false,
    nextGame
  };

  broadcastRoomState(roomId);

  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    if (!rooms[roomId] || room.phase !== PHASE.VOTING) {
      clearInterval(room.timer);
      return;
    }

    room.phaseData.timeLeft--;

    if (room.phaseData.timeLeft <= 0) {
      clearInterval(room.timer);
      finishVoting(roomId);
    } else {
      io.to(roomId).emit("timer_tick", room.phaseData.timeLeft);
    }
  }, 1000);
}

function finishVoting(roomId) {
  const room = rooms[roomId];
  if (!room || room.phase !== PHASE.VOTING) return;
  if (room.timer) clearInterval(room.timer);

  const counts = {};
  for (const targetId of Object.values(room.phaseData.votes)) {
    counts[targetId] = (counts[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  let topPlayers = [];
  for (const [id, count] of Object.entries(counts)) {
    if (count > maxVotes) { maxVotes = count; topPlayers = [id]; }
    else if (count === maxVotes) topPlayers.push(id);
  }

  const eliminatedId = (topPlayers.length === 1 && maxVotes > 0) ? topPlayers[0] : null;
  const tie = !eliminatedId;

  // Buduj ranking wszystkich graczy wg głosów
  const alive = room.players.filter(p => !p.eliminated);
  const ranking = alive.map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    votes: counts[p.id] || 0
  })).sort((a, b) => b.votes - a.votes);

  // Faza VOTE_RESULTS — wszyscy klikają Dalej
  room.phase = PHASE.VOTE_RESULTS;
  room.phaseData = {
    ranking,
    eliminatedId,
    tie,
    voteCounts: counts,
    readyToNext: {}
  };

  broadcastRoomState(roomId);
}

function proceedToElimination(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const { eliminatedId, tie, voteCounts, ranking } = room.phaseData;

  const nextIdx = room.miniGameIndex ?? 0;
  const nextGame = getMinigameOrder(room)[nextIdx % getMinigameOrder(room).length];
  const nextGameName = MINIGAME_NAMES[nextGame] || nextGame;

  room.phase = PHASE.ELIMINATION;

  if (eliminatedId) {
    const eliminated = room.players.find(p => p.id === eliminatedId);
    if (eliminated) {
      eliminated.eliminated = true;
      // Jeśli host odpada — przekaż hosta następnemu żywemu graczowi
      if (eliminatedId === room.hostId) {
        const newHost = room.players.find(p => !p.eliminated && p.connected && p.id !== eliminatedId);
        if (newHost) {
          room.hostId = newHost.id;
          console.log(`👑 Nowy host: ${newHost.name}`);
        }
      }
    }
    room.phaseData = {
      eliminatedPlayer: eliminated ? {
        id: eliminated.id,
        name: eliminated.name,
        avatar: eliminated.avatar
      } : null,
      tie: false,
      voteCounts,
      ranking,
      nextGameName,
      waitingForHost: false
    };
  } else {
    room.phaseData = {
      eliminatedPlayer: null,
      tie: true,
      voteCounts,
      ranking,
      nextGameName,
      waitingForHost: false
    };
  }

  broadcastRoomState(roomId);

  // Po animacji eliminacji (14s) host klika Dalej
  const eliminationDuration = eliminatedId ? 14000 : 5000;
  setTimeout(() => {
    if (!rooms[roomId]) return;
    room.phaseData.waitingForHost = true;
    broadcastRoomState(roomId);
  }, eliminationDuration);
}

// ===========================================
// START GRY
// ===========================================

function startGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.players.length < 3) return;

  room.scoreGracze = 0;
  room.scoreSabo = 0;
  room.round = 0;
  room.miniGameIndex = 0;
  room.miniGamesSinceVoting = 0;
  room.needsVoting = false;
  room.gameHistory = [];
  room.usedActingWords = new Set();
  room.usedDrawingWords = new Set();
  room.usedQuestions = new Set();
  room.usedAssociations = new Set();
  room.usedQuizQuestions = new Set();
  room.winner = null;
  room.playerScores = {};
  for (const p of room.players) {
    p.eliminated = false;
    room.playerScores[p.id] = 0;
  }

  if (room.mode === "points") {
    // Tryb punktowy - bez ról, bez głosowań
    for (const p of room.players) {
      p.role = "player"; // brak sabo
    }
    room.votingInterval = 9999; // nigdy nie głosujemy
    console.log(`🎯 ${room.players.length} graczy - tryb PUNKTOWY`);

    // Pomijamy role_reveal, lecimy od razu do pierwszej minigry
    room.phase = PHASE.LOBBY; // tymczasowo
    startNextPhase(roomId);
    return;
  }

  // Tryb sabotażysta - normalna logika
  const totalPlayers = room.players.length;
  const maxEliminations = Math.max(1, totalPlayers - 3);
  room.votingInterval = Math.min(6, Math.max(1, Math.ceil(6 / maxEliminations)));
  console.log(`🎯 ${totalPlayers} graczy → tryb SABO, głosowanie co ${room.votingInterval} minigr${room.votingInterval === 1 ? "ę" : "y"}`);

  const saboCount = howManySaboteurs(room.players.length);
  const shuffled = shuffle(room.players);
  for (let i = 0; i < shuffled.length; i++) {
    shuffled[i].role = i < saboCount ? "saboteur" : "player";
  }

  room.phase = PHASE.ROLE_REVEAL;
  room.phaseData = { readyToNext: {} };

  broadcastRoomState(roomId);
}

// ===========================================
// SOCKET.IO HANDLERS
// ===========================================

io.on("connection", (socket) => {
  console.log("🟢 CONNECT:", socket.id);

  socket.emit("players_list", playersList.players);

  socket.on("create_game", ({ player }, callback) => {
    if (!player || !player.name) {
      callback?.({ error: "Wybierz postać!" });
      return;
    }

    const roomId = generateRoomId();

    rooms[roomId] = {
      hostId: socket.id,
      players: [{
        id: socket.id,
        name: player.name,
        avatar: player.avatar,
        role: null,
        eliminated: false,
        connected: true
      }],
      phase: PHASE.LOBBY,
      scoreGracze: 0,
      scoreSabo: 0,
      round: 0,
      miniGameIndex: 0,
      miniGamesSinceVoting: 0,
      needsVoting: false,
      votingInterval: 1
    };

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = player.name;

    callback?.({ ok: true, roomId });
    broadcastRoomState(roomId);

    console.log(`🆕 ROOM ${roomId} stworzony przez ${player.name}`);
  });

  socket.on("join_game", ({ roomId, player }, callback) => {
    const room = rooms[roomId];
    if (!room) {
      callback?.({ error: "Pokój nie istnieje!" });
      return;
    }

    if (room.phase !== PHASE.LOBBY) {
      const existing = room.players.find(p => p.name === player?.name);
      if (existing) {
        // Gracz już jest w pokoju - reconnect (niezależnie od connected flag)
        const oldId = existing.id;
        // Jeśli stary socket dalej istnieje i NIE jest to ten sam - rozłącz go
        if (oldId !== socket.id) {
          const oldSocket = io.sockets.sockets.get(oldId);
          if (oldSocket) {
            console.log(`🔄 Rozłączam stary socket gracza ${player.name}`);
            oldSocket.disconnect(true);
          }
        }
        existing.id = socket.id;
        existing.connected = true;
        // Jeśli ten gracz był hostem - zaktualizuj hostId
        if (room.hostId === oldId) {
          room.hostId = socket.id;
          console.log(`👑 Host ${player.name} wrócił - hostId zaktualizowany`);
        }
        // Migruj punkty ze starego ID na nowe
        if (room.playerScores && room.playerScores[oldId] !== undefined) {
          room.playerScores[socket.id] = room.playerScores[oldId];
          delete room.playerScores[oldId];
        }
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.playerName = player.name;
        callback?.({ ok: true, roomId });
        broadcastRoomState(roomId);
        return;
      }
      callback?.({ error: "Gra już się zaczęła!" });
      return;
    }

    if (!player || !player.name) {
      callback?.({ error: "Wybierz postać!" });
      return;
    }

    const existing = room.players.find(p => p.name === player.name);
    if (existing && existing.connected) {
      callback?.({ error: "Ta postać jest już zajęta w tym pokoju!" });
      return;
    }

    if (existing) {
      const oldId = existing.id;
      existing.id = socket.id;
      existing.connected = true;
      if (room.hostId === oldId) {
        room.hostId = socket.id;
      }
      if (room.playerScores && room.playerScores[oldId] !== undefined) {
        room.playerScores[socket.id] = room.playerScores[oldId];
        delete room.playerScores[oldId];
      }
    } else {
      room.players.push({
        id: socket.id,
        name: player.name,
        avatar: player.avatar,
        role: null,
        eliminated: false,
        connected: true
      });
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = player.name;

    callback?.({ ok: true, roomId });
    broadcastRoomState(roomId);

    console.log(`👤 ${player.name} dołączył do ${roomId}`);
  });

  socket.on("start_game", (payload = {}) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.phase !== PHASE.LOBBY) return;
    if (room.players.length < 3) return;

    room.mode = payload.mode === "points" ? "points" : "saboteur";
    console.log(`▶️ START gry w ${roomId} - tryb: ${room.mode}`);
    startGame(roomId);
  });

  socket.on("role_reveal_ready", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ROLE_REVEAL) return;

    if (!room.phaseData.readyToNext) room.phaseData.readyToNext = {};
    room.phaseData.readyToNext[socket.id] = true;

    const alive = room.players.filter(p => !p.eliminated && p.connected);
    const readyCount = Object.keys(room.phaseData.readyToNext).length;

    broadcastRoomState(roomId);

    if (readyCount >= alive.length) {
      startNextPhase(roomId);
    }
  });

  socket.on("end_game_host", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.mode !== "points") return;
    room.phase = PHASE.GAME_OVER;
    if (room.timer) clearInterval(room.timer);
    broadcastRoomState(roomId);
  });

  // ============ KALAMBURY ============

  socket.on("actor_toggle_pick", ({ playerId }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ACTING) return;
    if (room.phaseData.finished) return;
    if (socket.id !== room.phaseData.currentActorId) return;

    if (!room.phaseData.actorPicks) room.phaseData.actorPicks = {};
    // Single-select - klik na tę samą = odznacz, inna = zastąp
    if (room.phaseData.actorPicks[playerId]) {
      delete room.phaseData.actorPicks[playerId];
    } else {
      room.phaseData.actorPicks = { [playerId]: true };
    }
    broadcastRoomState(roomId);
  });

  socket.on("actor_confirm_picks", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ACTING) return;
    if (room.phaseData.finished) return;
    if (socket.id !== room.phaseData.currentActorId) return;
    finishActingRound(roomId);
  });

  socket.on("actor_give_up", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    if (room.phase !== PHASE.ACTING) return;
    if (socket.id !== room.phaseData.currentActorId) return;
    finishActingRound(roomId);
  });

  // ============ 5 SEKUND ============

  socket.on("speaker_ready", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    if (room.phase !== PHASE.FIVE_SECONDS) return;
    if (room.phaseData.finished) return;
    if (room.phaseData.timerStarted) return;
    if (socket.id !== room.phaseData.currentSpeakerId) return;
    startFiveSecondsTimer(roomId);
  });

  socket.on("five_seconds_vote", ({ vote }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.FIVE_SECONDS) return;
    if (room.phaseData.finished) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;
    if (socket.id === room.phaseData.currentSpeakerId) return;
    if (vote !== "ok" && vote !== "no") return;

    if (!room.phaseData.votes) room.phaseData.votes = {};
    room.phaseData.votes[socket.id] = vote;

    // Jeśli wszyscy zagłosowali - kończ
    const alive = room.players.filter(p => !p.eliminated && p.connected);
    const eligibleVoters = alive.filter(p => p.id !== room.phaseData.currentSpeakerId).length;
    const voteCount = Object.keys(room.phaseData.votes).length;
    if (voteCount >= eligibleVoters) {
      finishFiveSecondsTurn(roomId);
      return;
    }
    broadcastRoomState(roomId);
  });

  // ============ KALAMBURY RYSOWANE ============

  socket.on("drawing_stroke", ({ stroke }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.DRAWING) return;
    if (room.phaseData.finished) return;
    if (socket.id !== room.phaseData.currentDrawerId) return;

    room.phaseData.strokes.push(stroke);
    // Rozgłaszamy stroke do pozostałych (nie z powrotem do rysującego)
    socket.to(roomId).emit("drawing_stroke", { stroke });
  });

  socket.on("drawing_clear", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.DRAWING) return;
    if (room.phaseData.finished) return;
    if (socket.id !== room.phaseData.currentDrawerId) return;

    room.phaseData.strokes = [];
    io.to(roomId).emit("drawing_clear");
  });

  socket.on("actor_ready", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ACTING) return;
    if (room.phaseData.finished) return;
    if (room.phaseData.timerStarted) return;
    if (socket.id !== room.phaseData.currentActorId) return;
    startActingTimer(roomId);
  });

  socket.on("drawer_ready", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.DRAWING) return;
    if (room.phaseData.finished) return;
    if (room.phaseData.timerStarted) return;
    if (socket.id !== room.phaseData.currentDrawerId) return;
    startDrawingTimer(roomId);
  });

  socket.on("drawer_toggle_pick", ({ playerId }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.DRAWING) return;
    if (room.phaseData.finished) return;
    if (socket.id !== room.phaseData.currentDrawerId) return;

    if (!room.phaseData.drawerPicks) room.phaseData.drawerPicks = {};
    if (room.phaseData.drawerPicks[playerId]) {
      delete room.phaseData.drawerPicks[playerId];
    } else {
      room.phaseData.drawerPicks = { [playerId]: true };
    }
    broadcastRoomState(roomId);
  });

  socket.on("drawer_confirm_picks", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.DRAWING) return;
    if (room.phaseData.finished) return;
    if (socket.id !== room.phaseData.currentDrawerId) return;
    finishDrawingRound(roomId);
  });

  socket.on("drawer_give_up", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.DRAWING) return;
    if (socket.id !== room.phaseData.currentDrawerId) return;
    finishDrawingRound(roomId);
  });

  socket.on("drawing_ready_next", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.DRAWING) return;
    if (!room.phaseData.finished) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    room.phaseData.readyToNext[socket.id] = true;

    const alive = room.players.filter(p => !p.eliminated && p.connected);
    const readyCount = Object.keys(room.phaseData.readyToNext).length;

    broadcastRoomState(roomId);

    if (readyCount >= alive.length) {
      advanceDrawingRound(roomId);
    }
  });

  // ============ QUIZ ============

  // ============ QUIZ ============

  socket.on("host_next_quiz", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.QUIZ) return;
    if (room.hostId !== socket.id) return;
    if (!room.phaseData.finished) return;
    advanceQuizQuestion(roomId);
  });

  socket.on("quiz_answer", ({ answerIndex }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.QUIZ) return;
    if (room.phaseData.finished) return;
    if (typeof answerIndex !== "number" || answerIndex < 0 || answerIndex > 3) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    room.phaseData.playerAnswers[socket.id] = answerIndex;

    // Wszyscy odpowiedzieli — kończymy wcześniej
    const alive = room.players.filter(p => !p.eliminated && p.connected);
    if (Object.keys(room.phaseData.playerAnswers).length >= alive.length) {
      if (room.timer) clearInterval(room.timer);
      finishQuizQuestion(roomId);
      return;
    }

    broadcastRoomState(roomId);
  });

  // ============ GRA TERENOWA ============

  socket.on("field_game_ready", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.FIELD_GAME) return;
    if (room.phaseData.timerStarted || room.phaseData.finished) return;
    if (socket.id !== room.phaseData.currentPlayerId) return;
    startFieldGameTimer(roomId);
  });

  socket.on("field_game_vote", ({ vote }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.FIELD_GAME) return;
    if (!room.phaseData.timerStarted || room.phaseData.finished) return;
    if (socket.id === room.phaseData.currentPlayerId) return;
    if (vote !== "ok" && vote !== "no") return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    room.phaseData.votes[socket.id] = vote;

    // Sprawdź próg NIE
    let noVotes = 0;
    for (const v of Object.values(room.phaseData.votes)) {
      if (v === "no") noVotes++;
    }
    if (noVotes >= room.phaseData.rejectThreshold) {
      finishFieldGameTurn(roomId);
      return;
    }

    // Wszyscy zagłosowali
    const alive = room.players.filter(p => !p.eliminated && p.connected);
    const eligible = alive.filter(p => p.id !== room.phaseData.currentPlayerId).length;
    if (Object.keys(room.phaseData.votes).length >= eligible) {
      finishFieldGameTurn(roomId);
      return;
    }

    broadcastRoomState(roomId);
  });

  // ============ SKOJARZENIA ============

  socket.on("associations_next_round", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ASSOCIATIONS) return;
    if (room.hostId !== socket.id) return;
    startAssociations(roomId);
  });

  socket.on("associations_reveal", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ASSOCIATIONS) return;
    if (room.hostId !== socket.id) return;
    room.phaseData.wordRevealed = true;
    broadcastRoomState(roomId);
  });

  socket.on("associations_go_vote", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ASSOCIATIONS) return;
    if (room.hostId !== socket.id) return;
    room.needsVoting = false;
    startVoting(roomId);
  });

  socket.on("host_next_elimination", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ELIMINATION) return;
    if (room.hostId !== socket.id) return;
    if (!room.phaseData.waitingForHost) return;
    startNextPhase(roomId);
  });

  socket.on("host_finish_fiveseconds", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.FIVE_SECONDS) return;
    if (room.hostId !== socket.id) return;
    if (!room.phaseData.timerEnded) return;
    if (room.phaseData.finished) return;
    finishFiveSecondsTurn(roomId);
  });

  socket.on("host_next_fiveseconds", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.FIVE_SECONDS) return;
    if (room.hostId !== socket.id) return;
    if (!room.phaseData.waitingForHost) return;
    if (room.phaseData.miniGameFinished) {
      startNextPhase(roomId);
    } else {
      advanceFiveSecondsTurn(roomId);
    }
  });

  socket.on("host_next_acting", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.ACTING) return;
    if (room.hostId !== socket.id) return;
    if (!room.phaseData.finished) return;
    if (room.phaseData.miniGameFinished) {
      startNextPhase(roomId);
    } else {
      advanceActingRound(roomId);
    }
  });

  socket.on("host_next_drawing", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.DRAWING) return;
    if (room.hostId !== socket.id) return;
    if (room.phaseData.miniGameFinished) {
      startNextPhase(roomId);
    } else if (room.phaseData.finished) {
      advanceDrawingRound(roomId);
    }
  });

  socket.on("host_next_phase", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if ([PHASE.ACTING, PHASE.DRAWING, PHASE.FIVE_SECONDS, PHASE.FIELD_GAME, PHASE.QUIZ, PHASE.ASSOCIATIONS].includes(room.phase)) {
      if (room.phaseData?.miniGameFinished) startNextPhase(roomId);
    }
  });

  // ============ WYNIKI GŁOSOWANIA ============

  socket.on("vote_results_ready", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.phase !== PHASE.VOTE_RESULTS) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    room.phaseData.readyToNext[socket.id] = true;

    const alive = room.players.filter(p => !p.eliminated && p.connected);
    const readyCount = Object.keys(room.phaseData.readyToNext).length;

    broadcastRoomState(roomId);

    if (readyCount >= alive.length) {
      proceedToElimination(roomId);
    }
  });

  // ============ GŁOSOWANIE ============

  socket.on("vote", ({ targetId }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    if (room.phase !== PHASE.VOTING) return;
    if (room.phaseData.finished) return;

    const voter = room.players.find(p => p.id === socket.id);
    if (!voter || voter.eliminated) return;

    const target = room.players.find(p => p.id === targetId);
    if (!target || target.eliminated) return;

    room.phaseData.votes[socket.id] = targetId;

    const aliveCount = room.players.filter(p => !p.eliminated && p.connected).length;
    const voteCount = Object.keys(room.phaseData.votes).length;

    if (voteCount >= aliveCount) {
      finishVoting(roomId);
    } else {
      broadcastRoomState(roomId);
    }
  });

  // ============ POWRÓT DO LOBBY ============

  socket.on("back_to_lobby", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;

    if (room.timer) clearInterval(room.timer);

    room.phase = PHASE.LOBBY;
    room.phaseData = null;
    room.currentMinigame = null;
    room.scoreGracze = 0;
    room.scoreSabo = 0;
    room.round = 0;
    room.miniGameIndex = 0;
    room.miniGamesSinceVoting = 0;
    room.needsVoting = false;
    room.votingInterval = 1;
    room.winner = null;
    for (const p of room.players) {
      p.role = null;
      p.eliminated = false;
    }

    broadcastRoomState(roomId);
  });

  socket.on("disconnect", () => {
    console.log("🔴 DISCONNECT:", socket.id);

    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.connected = false;

    if (room.phase === PHASE.LOBBY) {
      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.hostId === socket.id && room.players.length > 0) {
        room.hostId = room.players[0].id;
      }

      if (room.players.length === 0) {
        if (room.timer) clearInterval(room.timer);
        delete rooms[roomId];
        console.log(`🗑️ Usunięto pusty pokój ${roomId}`);
        return;
      }
    }

    broadcastRoomState(roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Serwer Sabotażysty działa na porcie ${PORT}`);
  console.log(`   Lokalnie: http://localhost:${PORT}`);
});