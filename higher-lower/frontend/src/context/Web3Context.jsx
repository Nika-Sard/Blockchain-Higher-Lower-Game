import { createContext, useContext, useState } from "react";
import { ethers } from "ethers";
import HigherLowerABI from "../abi/HigherLower.json";

export const CONTRACT_ADDRESS = "0xD20F1d8Aded8425E8bae6cF9f7b4Cae985027878";

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner]     = useState(null);
  const [contract, setContract] = useState(null);
  const [address, setAddress]   = useState(null);

  async function connect() {
    if (!window.ethereum) {
      alert("MetaMask not found. Please install it from https://metamask.io");
      return;
    }
    const _provider = new ethers.BrowserProvider(window.ethereum);
    await _provider.send("eth_requestAccounts", []);
    const _signer   = await _provider.getSigner();
    const _address  = await _signer.getAddress();
    const _contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      HigherLowerABI.abi,
      _signer
    );

    setProvider(_provider);
    setSigner(_signer);
    setAddress(_address);
    setContract(_contract);
  }

  return (
    <Web3Context.Provider value={{ provider, signer, contract, address, connect }}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
