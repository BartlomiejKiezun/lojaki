// Dźwięki generowane przez Web Audio API - nie potrzeba plików mp3
let audioCtx = null;
let muted = false;

function getCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tone({ freq = 440, duration = 0.2, type = "sine", volume = 0.3, attack = 0.01 }) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.05);
}

function sequence(notes, gap = 0.08) {
  if (muted) return;
  notes.forEach((n, i) => {
    setTimeout(() => tone(n), i * gap * 1000);
  });
}

export function playPoint() {
  sequence([
    { freq: 660, duration: 0.12, type: "triangle", volume: 0.25 },
    { freq: 880, duration: 0.25, type: "triangle", volume: 0.3 }
  ], 0.1);
}

export function playVictory() {
  sequence([
    { freq: 523, duration: 0.15, type: "square", volume: 0.2 },
    { freq: 659, duration: 0.15, type: "square", volume: 0.2 },
    { freq: 784, duration: 0.15, type: "square", volume: 0.2 },
    { freq: 1046, duration: 0.4, type: "square", volume: 0.25 }
  ], 0.13);
}

export function playFail() {
  sequence([
    { freq: 220, duration: 0.2, type: "sawtooth", volume: 0.2 },
    { freq: 110, duration: 0.4, type: "sawtooth", volume: 0.2 }
  ], 0.15);
}

export function playRoundEnd() {
  tone({ freq: 440, duration: 0.08, type: "sine", volume: 0.2 });
  setTimeout(() => tone({ freq: 660, duration: 0.15, type: "sine", volume: 0.2 }), 80);
}

export function playClick() {
  tone({ freq: 800, duration: 0.04, type: "triangle", volume: 0.1 });
}

export function unlockAudio() {
  getCtx();
}

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

// Tick gdy zostało <=5s timera
export function playTick() {
  tone({ freq: 1200, duration: 0.05, type: "square", volume: 0.12 });
}

// Buzz gdy czas się skończy
export function playTimeUp() {
  sequence([
    { freq: 800, duration: 0.15, type: "sawtooth", volume: 0.2 },
    { freq: 400, duration: 0.3, type: "sawtooth", volume: 0.2 }
  ], 0.1);
}

// Obiekt sounds używany przez App.js - alias do funkcji
export const sounds = {
  point: playPoint,
  victory: playVictory,
  fail: playFail,
  roundEnd: playRoundEnd,
  click: playClick,
  tick: playTick,
  timeUp: playTimeUp,
  unlock: unlockAudio
};