// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import "@fhevm/solidity/config/ZamaConfig.sol";

// ZamaEthereumConfig auto-configures the correct ACL/Coprocessor/KMS addresses
// for the current network (Sepolia chainId=11155111 → 0xf0Ff... ACL, etc.)
contract HigherLower is ZamaEthereumConfig {

    enum GameState   { WAITING_FOR_PLAYER2, REVEAL, RESOLVING, FINISHED }
    enum RoundResult { NONE, PLAYER1_WINS, PLAYER2_WINS, DRAW }

    struct Round {
        euint8      card1;
        euint8      card2;
        bool        player1Ready;
        bool        player2Ready;
        RoundResult result;
        uint8       revealedCard1;
        uint8       revealedCard2;
        // handles[0]=lt(card2,card1), [1]=eq(c1,c2), [2]=card1, [3]=card2
        bytes32[4]  decryptHandles;
    }

    struct Game {
        address    player1;
        address    player2;
        Round[3]   rounds;
        uint8      currentRound;
        uint8      score1;
        uint8      score2;
        GameState  state;
    }

    struct GameView {
        address    player1;
        address    player2;
        uint8      currentRound;
        uint8      score1;
        uint8      score2;
        GameState  gameState;
        RoundResult[3] roundResults;
        uint8[3]   revealedCard1;
        uint8[3]   revealedCard2;
    }

    mapping(uint256 => Game) private games;
    uint256 public gameCounter;

    event GameCreated(uint256 indexed gameId, address indexed player1);
    event PlayerJoined(uint256 indexed gameId, address indexed player2);
    event RoundReadyToDecrypt(uint256 indexed gameId, uint8 round, bytes32[4] handles);
    event RoundResolved(uint256 indexed gameId, uint8 round, RoundResult result);
    event GameFinished(uint256 indexed gameId, address winner);

    function newGame() external returns (uint256 gameId) {
        gameId = gameCounter++;
        Game storage g = games[gameId];
        g.player1 = msg.sender;
        g.state   = GameState.WAITING_FOR_PLAYER2;
        emit GameCreated(gameId, msg.sender);
    }

    function joinGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.player1 != address(0), "game not found");
        require(g.state == GameState.WAITING_FOR_PLAYER2, "game full");
        require(g.player1 != msg.sender, "cannot play yourself");

        g.player2 = msg.sender;
        _dealRound(gameId);

        emit PlayerJoined(gameId, msg.sender);
    }

    function _dealRound(uint256 gameId) internal {
        Game storage g = games[gameId];
        uint8 r = g.currentRound;

        // Pseudo-random cards in [1, 13] — values are FHE-encrypted so players can't see them
        uint256 seed = uint256(keccak256(abi.encodePacked(block.prevrandao, gameId, block.timestamp, r)));
        euint8 c1 = FHE.asEuint8(uint8(seed % 13) + 1);
        euint8 c2 = FHE.asEuint8(uint8((seed >> 8) % 13) + 1);

        g.rounds[r].card1 = c1;
        g.rounds[r].card2 = c2;
        g.rounds[r].player1Ready = false;
        g.rounds[r].player2Ready = false;

        FHE.allowThis(c1);
        FHE.allow(c1, g.player1);
        FHE.allowThis(c2);
        FHE.allow(c2, g.player2);

        g.state = GameState.REVEAL;
    }

    function getMyCard(uint256 gameId) external view returns (euint8) {
        Game storage g = games[gameId];
        require(msg.sender == g.player1 || msg.sender == g.player2, "not a player");
        require(g.state == GameState.REVEAL, "not in reveal phase");
        uint8 r = g.currentRound;
        return msg.sender == g.player1 ? g.rounds[r].card1 : g.rounds[r].card2;
    }

    function readyForReveal(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.state == GameState.REVEAL, "not in reveal phase");
        require(msg.sender == g.player1 || msg.sender == g.player2, "not a player");

        uint8 r = g.currentRound;
        Round storage round = g.rounds[r];

        if (msg.sender == g.player1) {
            require(!round.player1Ready, "already ready");
            round.player1Ready = true;
        } else {
            require(!round.player2Ready, "already ready");
            round.player2Ready = true;
        }

        if (round.player1Ready && round.player2Ready) {
            _prepareDecryption(gameId, r);
        }
    }

    function _prepareDecryption(uint256 gameId, uint8 r) internal {
        Game storage g = games[gameId];
        Round storage round = g.rounds[r];
        g.state = GameState.RESOLVING;

        // Compute FHE comparisons
        ebool ltResult = FHE.lt(round.card2, round.card1); // true → player1 wins
        ebool eqResult = FHE.eq(round.card1, round.card2);

        // Mark all four values for public decryption via ACL
        FHE.makePubliclyDecryptable(ltResult);
        FHE.makePubliclyDecryptable(eqResult);
        FHE.makePubliclyDecryptable(round.card1);
        FHE.makePubliclyDecryptable(round.card2);

        // Store handles so resolveRound can verify the KMS proof
        round.decryptHandles[0] = FHE.toBytes32(ltResult);
        round.decryptHandles[1] = FHE.toBytes32(eqResult);
        round.decryptHandles[2] = FHE.toBytes32(round.card1);
        round.decryptHandles[3] = FHE.toBytes32(round.card2);

        emit RoundReadyToDecrypt(gameId, r, round.decryptHandles);
    }

    // Returns the stored handles for the current round so the frontend can call publicDecrypt
    function getDecryptHandles(uint256 gameId) external view returns (bytes32[4] memory) {
        Game storage g = games[gameId];
        return g.rounds[g.currentRound].decryptHandles;
    }

    // Called by either player (or anyone) once they have the KMS proof from the relayer
    function resolveRound(
        uint256 gameId,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) external {
        Game storage g = games[gameId];
        require(g.state == GameState.RESOLVING, "not resolving");

        uint8 r = g.currentRound;
        Round storage round = g.rounds[r];

        bytes32[] memory handlesList = new bytes32[](4);
        handlesList[0] = round.decryptHandles[0];
        handlesList[1] = round.decryptHandles[1];
        handlesList[2] = round.decryptHandles[2];
        handlesList[3] = round.decryptHandles[3];

        // Verify KMS signatures on-chain — reverts if invalid
        FHE.checkSignatures(handlesList, cleartexts, decryptionProof);

        (bool p1Wins, bool isDraw, uint8 card1Val, uint8 card2Val) =
            abi.decode(cleartexts, (bool, bool, uint8, uint8));

        round.revealedCard1 = card1Val;
        round.revealedCard2 = card2Val;

        if (isDraw) {
            round.result = RoundResult.DRAW;
        } else if (p1Wins) {
            round.result = RoundResult.PLAYER1_WINS;
            g.score1++;
        } else {
            round.result = RoundResult.PLAYER2_WINS;
            g.score2++;
        }

        emit RoundResolved(gameId, r, round.result);

        if (r == 2) {
            g.state = GameState.FINISHED;
            address winner = g.score1 > g.score2 ? g.player1 :
                             g.score2 > g.score1 ? g.player2 : address(0);
            emit GameFinished(gameId, winner);
        } else {
            g.currentRound++;
            _dealRound(gameId);
        }
    }

    function getGameState(uint256 gameId) external view returns (GameView memory) {
        Game storage g = games[gameId];
        GameView memory v;
        v.player1      = g.player1;
        v.player2      = g.player2;
        v.currentRound = g.currentRound;
        v.score1       = g.score1;
        v.score2       = g.score2;
        v.gameState    = g.state;
        for (uint8 i = 0; i < 3; i++) {
            v.roundResults[i]  = g.rounds[i].result;
            v.revealedCard1[i] = g.rounds[i].revealedCard1;
            v.revealedCard2[i] = g.rounds[i].revealedCard2;
        }
        return v;
    }
}
