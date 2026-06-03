import { useEffect, useState } from "react";
import { socket } from "./socket";

import Lobby from "./components/Lobby";
import RoleReveal from "./components/RoleReveal";
import Announcing from "./components/Announcing";
import Acting from "./components/Acting";
import Drawing from "./components/Drawing";
import Detective from "./components/Detective";
import FiveSeconds from "./components/FiveSeconds";
import Associations from "./components/Associations";
import FieldGame from "./components/FieldGame";
import Quiz from "./components/Quiz";
import Voting from "./components/Voting";
import VoteResults from "./components/VoteResults";
import Elimination from "./components/Elimination";
import GameOver from "./components/GameOver";
import Connecting from "./components/Connecting";
import LeaderBadge from "./components/LeaderBadge";
import Preloader from "./components/Preloader";
import HostEndButton from "./components/HostEndButton";

function App() {
  // Preloader - pokazuje się raz na sesję
  const [showPreloader, setShowPreloader] = useState(() => {
    return !sessionStorage.getItem("preloader_shown");
  });

  const handlePreloaderDone = () => {
    sessionStorage.setItem("preloader_shown", "1");
    setShowPreloader(false);
  };

  // Pełny stan gry przesyłany z serwera
  const [state, setState] = useState(null);
  
  // Lista postaci do wyboru (z players.json)
  const [availablePlayers, setAvailablePlayers] = useState([]);
  
  // Status połączenia
  const [connected, setConnected] = useState(socket.connected);
  
  // Lokalne info: czy użytkownik dołączył już do pokoju
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const tryAutoRejoin = () => {
      const saved = localStorage.getItem("game_session");
      if (!saved) return;
      try {
        const session = JSON.parse(saved);
        // Sesja wygasa po 4 godzinach
        if (Date.now() - session.timestamp > 4 * 60 * 60 * 1000) {
          localStorage.removeItem("game_session");
          return;
        }
        if (session.roomId && session.player) {
          console.log("🔄 Auto-rejoin do pokoju", session.roomId);
          socket.emit("join_game", {
            roomId: session.roomId,
            player: session.player
          }, (resp) => {
            if (resp?.error) {
              console.log("Auto-rejoin nieudany:", resp.error);
              localStorage.removeItem("game_session");
            }
          });
        }
      } catch(e) {
        localStorage.removeItem("game_session");
      }
    };

    socket.on("connect", () => {
      setConnected(true);
      tryAutoRejoin();
    });
    socket.on("disconnect", () => setConnected(false));
    
    socket.on("players_list", (list) => {
      setAvailablePlayers(list);
    });
    
    socket.on("state", (newState) => {
      setState(newState);
      setJoined(true);
    });

    // Jeśli już połączony przy mount - od razu spróbuj rejoin
    if (socket.connected) {
      tryAutoRejoin();
    }

    // Page Visibility - gdy telefon się odblokuje force reconnect
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (!socket.connected) {
          console.log("🔄 Strona widoczna - reconnecting");
          socket.connect();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // Keep-alive ping co 14 minut żeby Render Free nie zasypiał
    const SERVER_URL = process.env.REACT_APP_SERVER_URL ||
      `http://${window.location.hostname}:3001`;
    const keepAliveInterval = setInterval(() => {
      fetch(`${SERVER_URL}/ping`).catch(() => {});
    }, 14 * 60 * 1000);

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("players_list");
      socket.off("state");
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(keepAliveInterval);
    };
  }, []);

  // Preloader - pierwszy ekran w sesji
  if (showPreloader) {
    return <Preloader onDone={handlePreloaderDone} />;
  }

  // Nie połączono z serwerem
  if (!connected) {
    return <Connecting />;
  }
  
  // Nie dołączono jeszcze do żadnego pokoju - lobby wyboru postaci
  if (!joined || !state) {
    return (
      <Lobby
        availablePlayers={availablePlayers}
        state={null}
      />
    );
  }
  
  // Renderuj odpowiednią fazę
  const renderPhase = () => {
    switch (state.phase) {
      case "lobby":
        return <Lobby availablePlayers={availablePlayers} state={state} />;
      case "role_reveal":
        return <RoleReveal state={state} />;
      case "announcing":
        return <Announcing state={state} />;
      case "acting":
        return <Acting state={state} />;
      case "drawing":
        return <Drawing state={state} />;
      case "detective":
        return <Detective state={state} />;
      case "associations":
        return <Associations state={state} />;
      case "fieldGame":
        return <FieldGame state={state} />;
      case "quiz":
        return <Quiz state={state} />;
      case "fiveSeconds":
        return <FiveSeconds state={state} />;
      case "voting":
        return <Voting state={state} />;
      case "voteResults":
        return <VoteResults state={state} />;
      case "elimination":
        return <Elimination state={state} />;
      case "game_over":
        return <GameOver state={state} />;
      default:
        return <div className="screen"><h2>Nieznana faza: {state.phase}</h2></div>;
    }
  };

  return (
    <>
      {state.phase !== "lobby" && state.phase !== "game_over" && <LeaderBadge state={state} />}
      {renderPhase()}
      <HostEndButton state={state} />
    </>
  );
}

export default App;