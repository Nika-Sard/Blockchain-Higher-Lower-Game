import { useWeb3 } from "../context/Web3Context";

export default function ConnectWallet() {
  const { connect } = useWeb3();
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">🃏 Private Higher/Lower</h1>
      <p className="text-gray-400 mb-2">FHE-powered card game on Zama fhEVM</p>
      <p className="text-gray-500 text-sm mb-8">Card values are encrypted - your opponent never sees your hand</p>
      <button
        onClick={connect}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-lg font-semibold transition-colors"
      >
        Connect MetaMask
      </button>
    </div>
  );
}
