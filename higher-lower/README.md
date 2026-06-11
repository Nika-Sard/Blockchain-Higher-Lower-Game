# Private Higher/Lower Card Game

A two-player card game on Zama's fhEVM (Sepolia testnet) where card values are encrypted using **Fully Homomorphic Encryption (FHE)**. Neither player can see the opponent's card until both commit to revealing — enforced cryptographically, not by trust.

**Deployed contract:** `0xD20F1d8Aded8425E8bae6cF9f7b4Cae985027878` (Sepolia)

---

## How It Works

1. Player 1 creates a game and shares the Game ID
2. Player 2 joins using that ID — cards are dealt (encrypted) immediately
3. Each player clicks **Show My Card** to privately decrypt their own card (opponent cannot see it)
4. Both click **Ready to Reveal** — contract compares cards homomorphically using FHE
5. The Zama KMS network decrypts the result, round winner is displayed
6. Best of 3 rounds wins

Card values never appear in plaintext on-chain during a game. The comparison is computed on ciphertexts — only the result is revealed after both players commit.

---

## Playing the Game (No Setup Required)

The contract is already deployed. You only need:

1. **MetaMask** — install from [metamask.io](https://metamask.io)
2. **Switch to Sepolia testnet** — Settings → Networks → Sepolia
3. **Get free Sepolia ETH** — from [sepoliafaucet.com](https://sepoliafaucet.com) (needed to pay transaction gas)
4. **Run the frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

> You do **not** need a `.env` file, private key, or root `npm install` unless you are redeploying the contract.

---

## Project Structure

```
higher-lower/
├── contracts/
│   └── HigherLower.sol        ← FHE game contract (~225 lines)
├── scripts/
│   └── deploy.js              ← deployment script
├── hardhat.config.js
├── .env                       ← PRIVATE_KEY + SEPOLIA_RPC_URL (never commit)
└── frontend/
    └── src/
        ├── context/
        │   └── Web3Context.jsx    ← contract address + ethers setup
        ├── hooks/
        │   ├── useGame.js         ← game state, auto-resolve logic
        │   └── useFhevm.js        ← Show My Card (user-decrypt via relayer)
        └── components/            ← UI screens
```

---

## Redeploying the Contract

Only needed if you modify `HigherLower.sol`.

**1. Create `.env` in the project root:**
```
PRIVATE_KEY=your_deployer_wallet_private_key
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```
> ⚠️ Never commit `.env`. The private key is the wallet that pays deployment gas.

**2. Install, compile, deploy:**
```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

**3. Update the frontend with the new address and ABI:**
```bash
# Update CONTRACT_ADDRESS in frontend/src/context/Web3Context.jsx
# Then copy the new ABI:
Copy-Item "artifacts/contracts/HigherLower.sol/HigherLower.json" "frontend/src/abi/HigherLower.json"
```

> **What is the ABI?** A JSON file describing every public contract function. The frontend uses it to encode calls and decode responses. It must match the deployed contract — copy it after every redeploy.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Solidity ^0.8.24, `@fhevm/solidity@0.11.1` |
| FHE operations | Zama TFHE — `euint8`, `FHE.lt()`, `FHE.eq()`, `FHE.checkSignatures()` |
| Testnet | Ethereum Sepolia (chainId 11155111) |
| Frontend | Vite + React + Tailwind CSS |
| Wallet | MetaMask + ethers.js v6 |
| Decryption | `@zama-fhe/relayer-sdk` (user-decrypt + publicDecrypt) |

---

## Privacy Guarantee

- Card values are stored as `euint8` FHE ciphertexts — unreadable even from public chain storage
- Round winner is computed via `FHE.lt()` on ciphertexts — no plaintext intermediate ever written on-chain
- Each player views their own card via user-decryption: signed in MetaMask, decrypted in-browser, never passes through any server in plaintext
- `FHE.checkSignatures()` prevents anyone from submitting a fabricated decryption result

**Trust assumption:** Zama's threshold KMS network holds the decryption key. A colluding key-holder majority could decrypt ciphertexts. Acceptable for a testnet project; production mitigations involve distributing key holders across independent entities.
