// Shown while fetching public decryption proof and submitting resolveRound
export default function ResolvingScreen({ gameState, resolveError }) {
  const round = Number(gameState?.currentRound ?? 0);
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h2 className="text-xl font-bold mb-4">Round {round + 1} Resolving...</h2>
      {!resolveError && (
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-6"></div>
      )}
      {resolveError ? (
        <p className="text-red-400 text-sm text-center max-w-xs mt-4">
          Decryption error: {resolveError}<br/>
          <span className="text-gray-400">Retrying automatically...</span>
        </p>
      ) : (
        <p className="text-gray-400 text-sm text-center max-w-xs">
          Requesting decryption from the Zama relayer and submitting proof on-chain.
          This usually takes a few seconds.
        </p>
      )}
    </div>
  );
}
