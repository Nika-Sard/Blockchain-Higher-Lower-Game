import { useState, useEffect, useCallback, useRef } from "react";
import { useWeb3 } from "../context/Web3Context";
import { createInstance, SepoliaConfig, initSDK } from "@zama-fhe/relayer-sdk/web";

// GameState enum values from HigherLower.sol
// 0 = WAITING_FOR_PLAYER2, 1 = REVEAL, 2 = RESOLVING, 3 = FINISHED

export function useGame() {
  const { contract, address } = useWeb3();
  const [gameId, setGameId]         = useState(null);
  const [gameState, setGameState]   = useState(null);
  const [phase, setPhase]           = useState("NOT_CONNECTED");
  const [resolveError, setResolveError] = useState(null);
  const resolvingRef = useRef(false); // prevent duplicate resolve calls

  const refresh = useCallback(async () => {
    if (!contract || gameId === null) return;
    try {
      const state = await contract.getGameState(gameId);
      setGameState(state);

      const gs = Number(state.gameState);
      if (gs === 3)      setPhase("FINISHED");
      else if (gs === 2) setPhase("RESOLVING");
      else if (gs === 1) setPhase("PLAYING");
      else               setPhase("SETUP");
    } catch (err) {
      console.error("getGameState error:", err);
    }
  }, [contract, gameId]);

  // When both players are ready the contract emits RoundReadyToDecrypt and
  // transitions to RESOLVING. Either player's frontend fetches the handles,
  // calls publicDecrypt on the relayer, then submits the proof on-chain.
  useEffect(() => {
    if (phase !== "RESOLVING" || !contract || gameId === null) return;
    if (resolvingRef.current) return;

    resolvingRef.current = true;
    setResolveError(null);

    (async () => {
      try {
        // 1. Get the 4 encrypted handles stored by the contract
        const rawHandles = await contract.getDecryptHandles(gameId);
        const handles = rawHandles.map(
          h => "0x" + BigInt(h).toString(16).padStart(64, "0")
        );

        // 2. Init SDK and create relayer instance (no user signature needed)
        await initSDK();
        const instance = await createInstance({
          ...SepoliaConfig,
          network: window.ethereum,
        });

        // 3. Request public decryption from the relayer
        const { abiEncodedClearValues, decryptionProof } =
          await instance.publicDecrypt(handles);

        // 4. Submit proof on-chain — contract verifies KMS signatures and resolves
        const tx = await contract.resolveRound(
          gameId,
          abiEncodedClearValues,
          decryptionProof
        );
        await tx.wait();
        await refresh();
      } catch (err) {
        console.error("resolveRound error:", err);
        setResolveError(err.message ?? String(err));
        resolvingRef.current = false; // allow retry on next poll
      }
    })();
  }, [phase, contract, gameId]);

  // Reset resolver flag whenever phase changes away from RESOLVING
  useEffect(() => {
    if (phase !== "RESOLVING") resolvingRef.current = false;
  }, [phase]);

  // Set phase to SETUP once wallet is connected
  useEffect(() => {
    if (!address) { setPhase("NOT_CONNECTED"); return; }
    if (phase === "NOT_CONNECTED") setPhase("SETUP");
  }, [address]);

  // Poll every 3 seconds for game state updates
  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function createGame() {
    const tx = await contract.newGame();
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment?.name === "GameCreated");
    const id = Number(event.args.gameId);
    setGameId(id);
    setPhase("SETUP");
    await refresh();
    return id;
  }

  async function joinGame(id) {
    const tx = await contract.joinGame(id);
    await tx.wait();
    setGameId(id);
    await refresh();
  }

  async function readyForReveal() {
    const tx = await contract.readyForReveal(gameId);
    await tx.wait();
    await refresh();
  }

  return { phase, gameId, gameState, createGame, joinGame, readyForReveal, refresh, resolveError };
}
