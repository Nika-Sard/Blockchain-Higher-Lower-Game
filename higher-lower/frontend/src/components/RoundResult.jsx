export default function RoundResult({ gameState, onNext }) {
  const completedRound = Math.max(0, Number(gameState?.currentRound ?? 1) - 1);
  const result  = Number(gameState?.roundResults?.[completedRound] ?? 0);
  const c1      = Number(gameState?.revealedCard1?.[completedRound] ?? 0);
  const c2      = Number(gameState?.revealedCard2?.[completedRound] ?? 0);
  const isLastRound = completedRound === 2;

  const resultLabel = result === 1 ? "Player 1 Wins! 🎉"
                    : result === 2 ? "Player 2 Wins!"
                    : result === 3 ? "Draw!"
                    : "";
  const resultColor = result === 1 ? "text-green-400"
                    : result === 2 ? "text-red-400"
                    : "text-yellow-400";

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h2 className="text-2xl font-bold mb-2">Round {completedRound + 1} Result</h2>
      <p className={`text-xl mb-6 font-semibold ${resultColor}`}>
        {resultLabel}
      </p>

      <div className="flex gap-8 mb-8">
        <div className="bg-gray-800 rounded-xl p-8 text-center w-36">
          <p className="text-gray-400 text-sm mb-2">Player 1</p>
          <p className="text-4xl font-bold">{c1}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-8 text-center w-36">
          <p className="text-gray-400 text-sm mb-2">Player 2</p>
          <p className="text-4xl font-bold">{c2}</p>
        </div>
      </div>

      <p className="text-gray-400 mb-6">
        Score: Player 1: {Number(gameState?.score1 ?? 0)} — Player 2: {Number(gameState?.score2 ?? 0)}
      </p>

      {!isLastRound && (
        <button
          onClick={onNext}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          Next Round
        </button>
      )}
    </div>
  );
}
