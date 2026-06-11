export default function GameOver({ gameState, onRestart }) {
  const s1 = Number(gameState?.score1 ?? 0);
  const s2 = Number(gameState?.score2 ?? 0);
  const outcome = s1 > s2 ? "Player 1 Wins! 🎉" : s2 > s1 ? "Player 2 Wins!" : "Draw!";
  const outcomeColor = s1 > s2 ? "text-green-400" : s2 > s1 ? "text-red-400" : "text-yellow-400";

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-2">Game Over</h1>
      <p className={`text-2xl font-semibold mb-6 ${outcomeColor}`}>{outcome}</p>
      <p className="text-gray-400 mb-8">Final Score: Player 1: {s1} — Player 2: {s2}</p>
      <button
        onClick={onRestart}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}
