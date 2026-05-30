import { useEffect, useState } from "react";
import { socket } from "./socket";

import Lobby from "./components/Lobby";
import RoleReveal from "./components/RoleReveal";
import Announcing from "./components/Announcing";
import Acting from "./components/Acting";
import Drawing from "./components/Drawing";
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
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    
    socket.on("players_list", (list) => {
      setAvailablePlayers(list);
    });
    
    socket.on("state", (newState) => {
      setState(newState);
      setJoined(true);
    });
    
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("players_list");
      socket.off("state");
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
    </>
  );
}

export default App;