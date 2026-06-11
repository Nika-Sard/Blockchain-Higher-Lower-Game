import { useState } from "react";
import { useFhevm } from "../hooks/useFhevm";
import { useWeb3 } from "../context/Web3Context";

export default function GameBoard({ gameId, gameState, readyForReveal }) {
  const { contract, address } = useWeb3();
  const { myCard, fetchMyCard } = useFhevm();
  const [status, setStatus]         = useState("");
  const [loading, setLoading]       = useState(false);
  const [hasReadied, setHasReadied] = useState(false);
  const round    = Number(gameState?.currentRound ?? 0);
  const isPlayer1 = address?.toLowerCase() === gameState?.player1?.toLowerCase();
  const myLabel   = isPlayer1 ? "Player 1" : "Player 2";
  const oppLabel  = isPlayer1 ? "Player 2" : "Player 1";
  const myScore   = isPlayer1 ? Number(gameState?.score1 ?? 0) : Number(gameState?.score2 ?? 0);
  const oppScore  = isPlayer1 ? Number(gameState?.score2 ?? 0) : Number(gameState?.score1 ?? 0);

  async function handleShowCard() {
    setLoading(true);
    setStatus("Decrypting your card - sign in MetaMask...");
    try {
      await fetchMyCard(gameId, contract);
      setStatus("");
    } catch (err) {
      setStatus(`Error decrypting: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleReady() {
    setLoading(true);
    setStatus("Submitting - confirm in MetaMask...");
    try {
      await readyForReveal();
      setHasReadied(true);
      setStatus("Waiting for opponent...");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h2 className="text-xl font-bold mb-1">Round {round + 1} of 3</h2>
      <p className="text-gray-400 mb-6">
        Score: {myLabel}: {myScore} — {oppLabel}: {oppScore}
      </p>

      <div className="flex gap-8 mb-8">
        <div className="bg-gray-800 rounded-xl p-8 text-center w-36">
          <p className="text-gray-400 text-sm mb-2">{myLabel} (You)</p>
          <p className="text-4xl font-bold">{myCard ?? "?"}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-8 text-center w-36">
          <p className="text-gray-400 text-sm mb-2">{oppLabel}</p>
          <p className="text-4xl font-bold text-gray-600">???</p>
          <p className="text-gray-600 text-xs mt-1">encrypted</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-64">
        {myCard === null && (
          <button
            onClick={handleShowCard}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Show My Card
          </button>
        )}
        <button
          onClick={handleReady}
          disabled={loading || hasReadied}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {hasReadied ? "✓ Ready" : "Ready to Reveal"}
        </button>
      </div>

      {status && <p className="text-yellow-400 text-sm mt-4 text-center max-w-64">{status}</p>}
    </div>
  );
}
