import { useState } from "react";
import { useWeb3 } from "./context/Web3Context";
import { useGame } from "./hooks/useGame";
import ConnectWallet from "./components/ConnectWallet";
import GameSetup from "./components/GameSetup";
import GameBoard from "./components/GameBoard";
import RoundResult from "./components/RoundResult";
import ResolvingScreen from "./components/ResolvingScreen";
import GameOver from "./components/GameOver";

export default function App() {
  const { address } = useWeb3();
  const { phase, gameId, gameState, refresh, createGame, joinGame, readyForReveal, resolveError } = useGame();
  const [dismissedRound, setDismissedRound] = useState(-1);

  if (!address)               return <ConnectWallet />;
  if (phase === "SETUP")      return <GameSetup createGame={createGame} joinGame={joinGame} />;
  if (phase === "FINISHED")   return <GameOver gameState={gameState} onRestart={() => window.location.reload()} />;
  if (phase === "RESOLVING")  return <ResolvingScreen gameState={gameState} resolveError={resolveError} />;

  // Show round result if the just-completed round has a non-NONE result
  // currentRound has advanced after resolution, so check the previous round
  const currentRound = Number(gameState?.currentRound ?? 0);
  const previousRound = currentRound > 0 ? currentRound - 1 : 0;
  const lastResult = Number(gameState?.roundResults?.[previousRound] ?? 0);
  const showResult = currentRound > 0 && lastResult !== 0 && phase === "PLAYING"
    && previousRound !== dismissedRound;

  if (showResult) {
    return (
      <RoundResult
        gameState={gameState}
        onNext={() => {
          setDismissedRound(previousRound);
          refresh();
        }}
      />
    );
  }

  return <GameBoard gameId={gameId} gameState={gameState} readyForReveal={readyForReveal} />;
}
