const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const HL = await ethers.getContractFactory("HigherLower");
  const hl = await HL.deploy();
  await hl.waitForDeployment();

  const address = await hl.getAddress();
  console.log("HigherLower deployed to:", address);
  console.log("");
  console.log("TODO: Update CONTRACT_ADDRESS in frontend/src/context/Web3Context.jsx");
  console.log("TODO: Copy ABI: cp artifacts/contracts/HigherLower.sol/HigherLower.json frontend/src/abi/");
}

main().catch((err) => { console.error(err); process.exit(1); });
