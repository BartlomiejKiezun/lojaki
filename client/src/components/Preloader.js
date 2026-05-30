import { useEffect, useState } from "react";

const TECH_MESSAGES = [
  "Inicjalizacja modułów...",
  "Łączenie z serwerem gry...",
  "Synchronizacja plików...",
  "Ładowanie zasobów graficznych...",
  "Konfiguracja socket.io...",
  "Weryfikacja sesji...",
  "Pobieranie listy graczy...",
  "Dekompresja avatarów...",
  "Kalibracja kanwy rysowania...",
  "Optymalizacja renderowania...",
  "Sprawdzanie integralności...",
  "Aktywacja protokołów...",
  "Przygotowywanie minigier...",
  "Synchronizacja zegara...",
  "Finalizacja..."
];

const SPARKLES_COUNT = 20;

function Preloader({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [messageIdx, setMessageIdx] = useState(0);
  const [sparkles] = useState(() =>
    Array.from({ length: SPARKLES_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 1.5 + Math.random() * 2,
      size: 2 + Math.random() * 4
    }))
  );

  // Pasek postępu 3 sekundy
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / 3000) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => onDone?.(), 400);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [onDone]);

  // Zmiana tekstów co 400ms
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIdx(i => (i + 1) % TECH_MESSAGES.length);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="preloader-screen">
      <div className="preloader-img-wrapper">
        <img src="/preloader.png" alt="" className="preloader-img" />

        {/* Sparkles */}
        {sparkles.map(s => (
          <div
            key={s.id}
            className="preloader-sparkle"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`
            }}
          />
        ))}

        {/* Scanline */}
        <div className="preloader-scanline" />

        {/* Glitch overlay */}
        <div className="preloader-glitch" />
      </div>

      <div className="preloader-bottom">
        <div className="preloader-message" key={messageIdx}>
          {TECH_MESSAGES[messageIdx]}
        </div>
        <div className="preloader-bar">
          <div
            className="preloader-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="preloader-percent">{Math.floor(progress)}%</div>
      </div>
    </div>
  );
}

export default Preloader;