import { useState } from "react";
import { useWeb3 } from "../context/Web3Context";

export default function GameSetup({ createGame, joinGame }) {
  const { address } = useWeb3();
  const [joinId, setJoinId]       = useState("");
  const [createdId, setCreatedId] = useState(null);
  const [status, setStatus]       = useState("");
  const [loading, setLoading]     = useState(false);

  async function handleCreate() {
    setLoading(true);
    setStatus("Creating game - confirm in MetaMask...");
    try {
      const id = await createGame();
      setCreatedId(id);
      setStatus(`Game created! Share Game ID: ${id} with your opponent.`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinId) return;
    setLoading(true);
    setStatus("Joining game - confirm in MetaMask...");
    try {
      await joinGame(Number(joinId));
      setStatus("Joined! Waiting for cards to be dealt...");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-2">🃏 Private Higher/Lower</h1>
      <p className="text-gray-400 text-sm mb-8">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </p>

      <div className="flex flex-col gap-4 w-72">
        {createdId !== null ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-gray-800 border border-green-500 rounded-lg p-4 text-center w-full">
              <p className="text-green-400 text-sm mb-1">Game created!</p>
              <p className="text-gray-300 text-sm">Share this Game ID with your opponent:</p>
              <p className="text-white text-3xl font-bold mt-2">{createdId}</p>
            </div>
            <div className="animate-pulse text-gray-400 text-sm">Waiting for opponent to join...</div>
          </div>
        ) : (
          <>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Create New Game
            </button>

            <div className="flex gap-2">
              <input
                value={joinId}
                onChange={e => setJoinId(e.target.value)}
                placeholder="Game ID"
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
              <button
                onClick={handleJoin}
                disabled={loading || !joinId}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Join
              </button>
            </div>
          </>
        )}

        {status && createdId === null && (
          <p className="text-yellow-400 text-sm text-center">{status}</p>
        )}
      </div>
    </div>
  );
}
