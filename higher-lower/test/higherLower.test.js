const { expect } = require("chai");
const { ethers } = require("hardhat");

// NOTE: These tests verify contract structure and non-FHE paths on local Hardhat.
// Full FHE tests (readyForReveal, round resolution) must run on Sepolia where
// the FHE executor and Gateway contracts are deployed by Zama.
// Run on Sepolia: npx hardhat test --network sepolia

describe("HigherLower", function () {

  // ─── Deploy helper ───────────────────────────────────────────────────────────
  async function deployHL() {
    const HL = await ethers.getContractFactory("HigherLower");
    const hl = await HL.deploy();
    return hl;
  }

  // ─── Deployment ──────────────────────────────────────────────────────────────
  it("deploys successfully with gameCounter = 0", async function () {
    const hl = await deployHL();
    expect(await hl.gameCounter()).to.equal(0);
  });

  // ─── newGame() ───────────────────────────────────────────────────────────────
  // NOTE: newGame() calls TFHE.asEuint8() which requires the FHE executor on Sepolia.
  // On local Hardhat this test is skipped - run on Sepolia to verify.
  it("newGame() emits GameCreated event [SEPOLIA ONLY]", async function () {
    if ((await ethers.provider.getNetwork()).chainId === 31337n) {
      console.log("    ⚠ Skipped: requires fhEVM executor (run on Sepolia)");
      this.skip();
    }
    const [p1] = await ethers.getSigners();
    const hl = await deployHL();

    const tx = await hl.connect(p1).newGame();
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment?.name === "GameCreated");
    expect(event).to.not.be.undefined;
    expect(event.args.gameId).to.equal(0);
    expect(await hl.gameCounter()).to.equal(1);
  });

  // ─── joinGame() ──────────────────────────────────────────────────────────────
  it("joinGame() rejects third player [SEPOLIA ONLY]", async function () {
    if ((await ethers.provider.getNetwork()).chainId === 31337n) {
      console.log("    ⚠ Skipped: requires fhEVM executor (run on Sepolia)");
      this.skip();
    }
    const [p1, p2, p3] = await ethers.getSigners();
    const hl = await deployHL();
    await hl.connect(p1).newGame();
    await hl.connect(p2).joinGame(0);
    await expect(hl.connect(p3).joinGame(0)).to.be.revertedWith("game full");
  });

  it("joinGame() rejects self-play [SEPOLIA ONLY]", async function () {
    if ((await ethers.provider.getNetwork()).chainId === 31337n) {
      console.log("    ⚠ Skipped: requires fhEVM executor (run on Sepolia)");
      this.skip();
    }
    const [p1] = await ethers.getSigners();
    const hl = await deployHL();
    await hl.connect(p1).newGame();
    await expect(hl.connect(p1).joinGame(0)).to.be.revertedWith("cannot play yourself");
  });

  // ─── getMyCard() ─────────────────────────────────────────────────────────────
  it("getMyCard() rejects non-player [SEPOLIA ONLY]", async function () {
    if ((await ethers.provider.getNetwork()).chainId === 31337n) {
      console.log("    ⚠ Skipped: requires fhEVM executor (run on Sepolia)");
      this.skip();
    }
    const [p1, p2, p3] = await ethers.getSigners();
    const hl = await deployHL();
    await hl.connect(p1).newGame();
    await hl.connect(p2).joinGame(0);
    await expect(hl.connect(p3).getMyCard(0)).to.be.revertedWith("not a player");
  });

  // ─── readyForReveal() ────────────────────────────────────────────────────────
  it("readyForReveal() rejects double-ready [SEPOLIA ONLY]", async function () {
    if ((await ethers.provider.getNetwork()).chainId === 31337n) {
      console.log("    ⚠ Skipped: requires fhEVM executor (run on Sepolia)");
      this.skip();
    }
    const [p1, p2] = await ethers.getSigners();
    const hl = await deployHL();
    await hl.connect(p1).newGame();
    await hl.connect(p2).joinGame(0);
    await hl.connect(p1).readyForReveal(0);
    await expect(hl.connect(p1).readyForReveal(0)).to.be.revertedWith("already ready");
  });

  // ─── Full game flow (Sepolia only) ───────────────────────────────────────────
  it("completes a full best-of-3 game [SEPOLIA ONLY]", async function () {
    if ((await ethers.provider.getNetwork()).chainId === 31337n) {
      console.log("    ⚠ Skipped: requires fhEVM executor + Gateway (run on Sepolia)");
      this.skip();
    }
    const [p1, p2] = await ethers.getSigners();
    const hl = await deployHL();

    await hl.connect(p1).newGame();
    await hl.connect(p2).joinGame(0);

    // Each round: both players ready → Gateway callback resolves asynchronously
    // In a real test on Sepolia, we'd wait for the RoundResolved event before proceeding
    for (let round = 0; round < 3; round++) {
      await hl.connect(p1).readyForReveal(0);
      await hl.connect(p2).readyForReveal(0);
      // Wait for Gateway callback (event-driven in production tests)
    }

    const state = await hl.getGameState(0);
    expect(state.gameState).to.equal(3); // FINISHED
  });

  it("does not allow moves after game is finished [SEPOLIA ONLY]", async function () {
    if ((await ethers.provider.getNetwork()).chainId === 31337n) {
      console.log("    ⚠ Skipped: requires fhEVM executor (run on Sepolia)");
      this.skip();
    }
    const [p1, p2] = await ethers.getSigners();
    const hl = await deployHL();

    await hl.connect(p1).newGame();
    await hl.connect(p2).joinGame(0);

    for (let i = 0; i < 3; i++) {
      await hl.connect(p1).readyForReveal(0);
      await hl.connect(p2).readyForReveal(0);
    }

    await expect(hl.connect(p1).readyForReveal(0)).to.be.revertedWith("not in reveal phase");
  });
});
