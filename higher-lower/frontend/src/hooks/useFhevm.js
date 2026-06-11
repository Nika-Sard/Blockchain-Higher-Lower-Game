import { useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import { createInstance, SepoliaConfig, initSDK } from "@zama-fhe/relayer-sdk/web";
import { CONTRACT_ADDRESS } from "../context/Web3Context";
import { BrowserProvider } from "ethers";

export function useFhevm() {
  const { address } = useWeb3();
  const [myCard, setMyCard] = useState(null);

  async function fetchMyCard(gameId, contract) {
    try {
      // 1. Initialize WASM modules (must happen before createInstance)
      await initSDK();

      // 2. Get the encrypted card handle from the contract
      // euint8 comes back from ethers as a BigInt - convert to 0x-prefixed bytes32 hex
      const rawHandle = await contract.getMyCard(gameId);
      const encryptedHandle = "0x" + BigInt(rawHandle).toString(16).padStart(64, "0");

      // 3. Create relayer-sdk instance using the pre-built Sepolia config
      const instance = await createInstance({
        ...SepoliaConfig,
        network: window.ethereum,
      });

      // 3. Generate ephemeral keypair for this re-encryption request
      const { publicKey, privateKey } = instance.generateKeypair();

      // 4. Create EIP-712 signature - new API requires timestamps and array of contract addresses
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 1;
      const eip712 = instance.createEIP712(publicKey, [CONTRACT_ADDRESS], startTimestamp, durationDays);
      const signer = await new BrowserProvider(window.ethereum).getSigner();
      // ethers v6 adds EIP712Domain automatically - remove it to avoid "ambiguous primary types"
      const { EIP712Domain: _removed, ...typesWithoutDomain } = eip712.types;
      const signature = await signer.signTypedData(
        eip712.domain,
        typesWithoutDomain,
        eip712.message
      );

      // 5. userDecrypt (renamed from reencrypt) - decrypt card locally in the browser
      const results = await instance.userDecrypt(
        [{ handle: encryptedHandle, contractAddress: CONTRACT_ADDRESS }],
        privateKey,
        publicKey,
        signature,
        [CONTRACT_ADDRESS],
        address,
        startTimestamp,
        durationDays
      );

      // results is Record<handleHex, bigint|boolean|address> - grab first value
      const cardValue = Number(Object.values(results)[0]);
      setMyCard(cardValue);
      return cardValue;
    } catch (err) {
      console.error("fetchMyCard error:", err);
      throw err;
    }
  }

  function resetCard() {
    setMyCard(null);
  }

  return { myCard, fetchMyCard, resetCard };
}
