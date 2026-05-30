import Avatar from "./Avatar";

function LeaderBadge({ state }) {
  if (state.mode !== "points") return null;
  if (!state.players?.length) return null;

  const sorted = [...state.players]
    .map(p => ({ ...p, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);

  const leader = sorted[0];
  if (!leader || leader.score === 0) return null;

  // Ukryj przy remisie - sprawdź czy ktoś inny ma taki sam wynik
  const tied = sorted.filter(p => p.score === leader.score);
  if (tied.length > 1) return null;

  return (
    <div className="leader-badge">
      <span className="leader-crown">👑</span>
      <Avatar src={leader.avatar} name={leader.name} size="small" />
      <span className="leader-score">{leader.score}</span>
    </div>
  );
}

export default LeaderBadge;
