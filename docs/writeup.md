# Private Higher/Lower Card Game on fhEVM
## Course Project Write-Up - Privacy on Blockchain

**Student:** Nika Sardanadze
**Primitive:** Fully Homomorphic Encryption (FHE)
**Platform:** Zama fhEVM (Sepolia testnet)
**Deployed Contract:** `0xD20F1d8Aded8425E8bae6cF9f7b4Cae985027878`
**Repository:** `https://github.com/Nika-Sard/Blockchain-Higher-Lower-Game`

---

## 1. Introduction

Public blockchains expose all state by default. Every variable in a standard Ethereum contract is readable by anyone - including opponents in a game. This breaks any application requiring hidden state during execution.

This project implements a two-player card game (Higher/Lower, best of three rounds) where neither player can see the opponent's card until both commit to revealing. The privacy guarantee is cryptographic, not based on trust or off-chain coordination.

**Core claim:** card values never appear in plaintext on-chain at any point during a game. Comparison of cards is computed directly on encrypted values using FHE, and the output is verified with a threshold-signed proof before the contract accepts it.

---

## 2. Cryptographic Choices and Why

### 2.1 Why FHE, not ZK / MPC / TEE

| Approach | Why rejected |
|---|---|
| **Commit-reveal** | Losing player can refuse to reveal (griefing). Sequential reveal leaks information. |
| **ZK proofs** | Proves statements about a fixed witness - cannot compare two independently hidden values without a trusted third party to perform the comparison. |
| **MPC** | Requires off-chain nodes, coordination infrastructure, and liveness assumptions on those nodes. |
| **TEE (e.g. Oasis Sapphire)** | Card value briefly exists as plaintext inside the enclave. Trust depends on hardware vendor (Intel SGX). Security breaks if enclave is compromised. |
| **FHE** | Comparison is computed on ciphertexts - no plaintext intermediate ever exists on any server. Security holds as long as the threshold key holders do not collude. |

### 2.2 FHE Scheme: TFHE

Zama's fhEVM uses **TFHE (Fast Fully Homomorphic Encryption over the Torus)**. TFHE is optimised for boolean and small integer operations, making it well-suited for card comparisons over `euint8` (8-bit encrypted integers).

Key operations used:

| Operation | Purpose |
|---|---|
| `FHE.asEuint8(x)` | Encrypts a plaintext card value into an FHE ciphertext |
| `FHE.lt(a, b)` | Homomorphic less-than - returns encrypted `ebool`, no plaintext intermediate |
| `FHE.eq(a, b)` | Homomorphic equality - used for draw detection |
| `FHE.allow(ct, addr)` | Grants one address permission to user-decrypt a ciphertext |
| `FHE.makePubliclyDecryptable(ct)` | Registers a ciphertext for threshold decryption by the KMS network |
| `FHE.checkSignatures(handles, cleartexts, proof)` | On-chain verification that the KMS network signed the decryption output |

### 2.3 Two Decryption Paths

The project uses two distinct decryption mechanisms for different purposes:

**User decryption** (Show My Card):
- Player signs an EIP-712 message in MetaMask (free, not a transaction).
- Relayer verifies the signature and checks `FHE.allow(card, playerAddress)` was called.
- Card is re-encrypted under an ephemeral browser keypair and returned.
- Plaintext exists only inside the player's browser - never on any server.

**Public decryption** (Round resolution):
- Contract calls `FHE.makePubliclyDecryptable()` on comparison results and card values.
- Frontend fetches cleartext + KMS threshold signature from the relayer off-chain.
- Frontend submits both to `resolveRound()`.
- Contract calls `FHE.checkSignatures()` - reverts if the proof is invalid.
- This prevents anyone from submitting fabricated decryption results.

### 2.4 Randomness

Cards are generated per round using:
```solidity
uint256 seed = uint256(keccak256(abi.encodePacked(
    block.prevrandao, gameId, block.timestamp, roundIndex
)));
euint8 c1 = FHE.asEuint8(uint8(seed % 13) + 1);
euint8 c2 = FHE.asEuint8(uint8((seed >> 8) % 13) + 1);
```

`block.prevrandao` is the RANDAO value from Ethereum's consensus layer - a fresh value contributed by the block proposer every slot. Combined with game-specific parameters, this produces distinct values per round. Since card values are immediately encrypted, no observer can determine them from transaction data. Pure FHE randomness (`FHE.randEuint8()`) was considered but its `upperBound` parameter must be a power of 2, making it incompatible with the range [1, 13].

---

## 3. Architecture and Data Flow

### 3.1 Components

```
┌─────────────────────┐          ┌─────────────────────┐
│   Player 1 Browser  │          │   Player 2 Browser  │
│   MetaMask          │          │   MetaMask          │
│   relayer-sdk       │          │   relayer-sdk       │
└────────┬────────────┘          └──────────┬──────────┘
         │  ethers.js transactions           │
         └─────────────┬─────────────────────┘
                       ▼
         ┌─────────────────────────┐
         │  Sepolia Testnet        │
         │  HigherLower.sol        │
         │  (euint8 ciphertexts    │
         │   stored in state)      │
         └────────────┬────────────┘
                      │ makePubliclyDecryptable / allow
                      ▼
         ┌─────────────────────────┐
         │  Zama KMS / Relayer     │
         │  (threshold decryption) │
         └─────────────────────────┘
```

There are no off-chain servers or databases. All game state lives in the smart contract. The frontend is a static React app.

### 3.2 Data Model

```solidity
struct Round {
    euint8      card1;           // Player 1's card - encrypted
    euint8      card2;           // Player 2's card - encrypted
    bool        player1Ready;
    bool        player2Ready;
    RoundResult result;
    uint8       revealedCard1;   // filled after resolution
    uint8       revealedCard2;
    bytes32[4]  decryptHandles;  // [lt(c2,c1), eq(c1,c2), card1, card2]
}

struct Game {
    address   player1;
    address   player2;
    Round[3]  rounds;
    uint8     currentRound;
    uint8     score1;
    uint8     score2;
    GameState state;  // WAITING_FOR_PLAYER2 | REVEAL | RESOLVING | FINISHED
}
```

### 3.3 Full Game Data Flow

```
Player 1                    Contract                    Player 2
   │                           │                           │
   │── newGame() ─────────────►│                           │
   │                           │ state=WAITING             │
   │                           │◄──────── joinGame() ──────│
   │                           │ deal cards (encrypted)    │
   │                           │ state=REVEAL              │
   │                           │                           │
   │◄── sign EIP-712 ──────────┤ (free, off-chain)         │
   │    (Show My Card)         │          sign EIP-712 ───►│
   │    card shown in UI       │          (Show My Card)   │
   │                           │          card shown in UI │
   │── readyForReveal() ──────►│                           │
   │                           │◄──── readyForReveal() ────│
   │                           │ _prepareDecryption()      │
   │                           │ makePubliclyDecryptable() │
   │                           │ state=RESOLVING           │
   │                           │                           │
   │   [frontend polls state, detects RESOLVING]           │
   │── publicDecrypt(handles) ─────────────────────────────────► Zama KMS
   │◄─ { cleartexts, proof } ──────────────────────────────────◄
   │── resolveRound(gameId, cleartexts, proof) ───────────►│
   │                           │ FHE.checkSignatures()     │
   │                           │ decode winner, update score
   │                           │ state=REVEAL (next round) │
   │                           │   ... repeat ×3 ...       │
   │                           │ state=FINISHED            │
```

### 3.4 Transaction Count

A complete 3-round game requires **11 on-chain transactions**. The 6 "Show My Card" actions (2 per round) are free off-chain signatures.

| # | Caller | Function |
|---|---|---|
| 1 | Player 1 | `newGame()` |
| 2 | Player 2 | `joinGame(gameId)` |
| 3–4 | Both | `readyForReveal()` × 2 - Round 1 |
| 5 | Either | `resolveRound(gameId, cleartexts, proof)` - Round 1 |
| 6–7 | Both | `readyForReveal()` × 2 - Round 2 |
| 8 | Either | `resolveRound()` - Round 2 |
| 9–10 | Both | `readyForReveal()` × 2 - Round 3 |
| 11 | Either | `resolveRound()` - Round 3 |

---

## 4. Threat Model

### 4.1 Who Can See What

| Information | Player 1 | Player 2 | Public observer |
|---|---|---|---|
| Player 1's card (during round) | ✅ via user-decrypt | ❌ | ❌ |
| Player 2's card (during round) | ❌ | ✅ via user-decrypt | ❌ |
| Either card value (before resolution) | ❌ | ❌ | ❌ |
| Round outcome (after resolution) | ✅ | ✅ | ✅ |
| Both card values (after resolution) | ✅ | ✅ | ✅ |
| That a game exists + wallet addresses | ✅ | ✅ | ✅ |
| Timing of `readyForReveal` | ✅ | ✅ | ✅ |

### 4.2 Who You Trust

| Entity | What you trust them with | Failure scenario |
|---|---|---|
| **Zama KMS threshold holders** | Quorum holds the FHE master key | If a majority collude, they can decrypt any ciphertext - including hidden cards mid-round |
| **Zama coprocessor nodes** | Execute `FHE.lt()` / `FHE.eq()` correctly | A malicious node could return a wrong comparison result. Mitigated by `FHE.checkSignatures()` requiring KMS co-signature |
| **Player's own browser** | Ephemeral keypair generation and local decryption | A malicious browser extension could intercept the decrypted card value |
| **Block proposer** | `block.prevrandao` for card randomness | A proposer could manipulate RANDAO to influence card values. Acceptable since values are encrypted immediately and proposers cannot see the outcome |

### 4.3 Key Attack Vectors

| Attack | Mitigation |
|---|---|
| Player reads opponent's card | `FHE.allow()` called only for the card owner - relayer rejects all other requests |
| Submit fabricated round result | `FHE.checkSignatures()` verifies KMS threshold signatures on-chain - any mismatch reverts |
| Double-submit `readyForReveal` | `require(!round.playerXReady)` guard |
| Third party joins a full game | `require(state == WAITING_FOR_PLAYER2)` guard |
| Stall game by refusing `readyForReveal` | No timeout currently - a block-height deadline is a production addition |

### 4.4 Primary Limitation

The strongest attack is **Zama threshold key collusion**. A colluding majority of KMS key holders could decrypt any ciphertext in the system. This is fundamental to all threshold FHE systems - it mirrors the honest-majority assumption in MPC. For a testnet course project operated by Zama, this is acceptable. Production mitigations include distributing key holders across independent legal entities with published identities.

---

## 5. Conclusion

FHE enables a qualitatively different class of blockchain application: hidden state enforced by mathematics, not trust. The Higher/Lower game demonstrates this end-to-end - two players interact with a single contract, neither can observe the other's state, and the outcome is computed homomorphically and verified with a threshold-signed proof before the contract accepts it.

The primary implementation challenge was not the FHE logic itself but the evolving Zama library ecosystem. Three incompatible versions (`fhevm@0.6.2` → `@fhevm/solidity@0.8.0` → `@fhevm/solidity@0.11.1`) had different infrastructure addresses, API names, and decryption architectures. A key lesson: in systems where the smart contract and the decryption infrastructure must agree on ACL addresses, any version mismatch causes silent permission failures that are difficult to diagnose without reading the library internals.

---

## References

1. Zama fhEVM documentation - https://docs.zama.ai/fhevm
2. Chillotti et al., "TFHE: Fast Fully Homomorphic Encryption over the Torus" (2020)
3. `@fhevm/solidity` library - https://github.com/zama-ai/fhevm-solidity
4. Course lecture slides 15–19, Privacy on Blockchain, Free University
5. Vitalik Buterin, "The Three Transitions" (2023)
6. Evans, Kolesnikov, Rosulek - "A Pragmatic Introduction to Secure Multi-Party Computation" (2018)


---