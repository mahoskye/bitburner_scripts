/** @param {NS} ns */
export async function main(ns) {
    const CONFIG = {
        OPPONENT: ns.args[0] || "Daedalus",
        BOARD_SIZE: ns.args[1] || 7,
        NUM_GAMES: ns.args[2] || 3,
        MOVE_DELAY: 1000,
        AGGRESSION_LEVEL: 0.45,
        MIN_LIBERTY_THRESHOLD: 2,
        TERRITORY_WEIGHT: 0.7,
        MIN_MOVE_SCORE: -10,
        OPENING_DEFENSE_SCALE: 0.6,
        OPENING_CORNER_BONUS: 30,
        OPENING_SIDE_BONUS: 18,
        EARLY_EXTENSION_BONUS: 12,
        LOG_FILE: "go-debug-log.txt"
    };

    ns.disableLog("ALL");

    let debugLog = [];

    function log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        debugLog.push(logEntry);
        ns.print(logEntry);
    }

    function logCaptureDetails(result) {
        if (!result || typeof result !== "object") return;
        if (typeof result.capturedStones === "number" && result.capturedStones > 0) {
            log(`Captured stones: ${result.capturedStones}`);
        }
        if (Array.isArray(result.captured) && result.captured.length > 0) {
            log(`Captured groups: ${JSON.stringify(result.captured)}`);
        }
    }

    // Check if Go API is available
    if (!ns.go) {
        log("ERROR: Go API not available in this version of Bitburner");
        return;
    }

    log("=== GO DEBUG SESSION STARTED ===");
    log(`Opponent: ${CONFIG.OPPONENT}, Board Size: ${CONFIG.BOARD_SIZE}x${CONFIG.BOARD_SIZE}`);
    log(`Playing ${CONFIG.NUM_GAMES} games for analysis`);

    const gameResults = [];

    try {
        for (let gameNum = 1; gameNum <= CONFIG.NUM_GAMES; gameNum++) {
            log(`\n${"=".repeat(60)}`);
            log(`STARTING GAME ${gameNum} of ${CONFIG.NUM_GAMES}`);
            log(`${"=".repeat(60)}`);

            // Start new game
            ns.go.resetBoardState(CONFIG.OPPONENT, CONFIG.BOARD_SIZE);
            log(`Started game ${gameNum} vs ${CONFIG.OPPONENT}`);

            let moveNumber = 0;
            let opponentPassedLastTurn = false;
            const MAX_MOVES = 200; // Safety limit

            while (moveNumber < MAX_MOVES) {
                await ns.sleep(CONFIG.MOVE_DELAY);

                const gameState = ns.go.getGameState();
                log(`\n--- Move ${moveNumber} ---`);
                log(`Current Player: ${gameState.currentPlayer}`);
                log(`Black Score: ${gameState.blackScore}, White Score: ${gameState.whiteScore}`);
                log(`Score Diff (Black - White): ${gameState.blackScore - gameState.whiteScore}`);
                const previousMove = Array.isArray(gameState.previousMove)
                    ? `(${gameState.previousMove[0]}, ${gameState.previousMove[1]})`
                    : "None";
                log(`Previous Move: ${previousMove}`);

                // Check if game ended
                if (gameState.currentPlayer === "None") {
                    log("Game ended naturally");
                    break;
                }

                // Check if we should pass
                const shouldPass = checkShouldPass(
                    gameState,
                    moveNumber,
                    CONFIG.BOARD_SIZE,
                    opponentPassedLastTurn
                );
                log(
                    `Should pass check: ${shouldPass} (moveNum: ${moveNumber}, score: ${gameState.blackScore} vs ${gameState.whiteScore})`
                );

                if (shouldPass) {
                    log("Decision: PASSING");
                    try {
                        const result = await ns.go.passTurn();
                        opponentPassedLastTurn = result?.type === "pass";
                        logCaptureDetails(result);
                        log("We passed the turn");
                        if (result?.type === "gameOver") {
                            log("Opponent acknowledged game over after our pass");
                            break;
                        }
                        if (result?.type === "pass") {
                            log("Opponent also passed - ending game");
                            break;
                        }
                        if (result?.type === "move") {
                            log(`Opponent responded with move at (${result.x}, ${result.y})`);
                        }
                    } catch (error) {
                        log(`ERROR passing turn: ${error.message}`);
                        break;
                    }
                } else {
                    // Make a move
                    const boardState = ns.go.getBoardState();
                    const validMoves = ns.go.analysis.getValidMoves();
                    const scoredMoves = getAllScoredMoves(ns, boardState, validMoves, CONFIG);
                    const move = scoredMoves.length > 0 ? scoredMoves[0] : null;

                    if (move) {
                        log(`Decision: Playing move at (${move.x}, ${move.y})`);
                        log(`Move score: ${move.score.toFixed(2)}, Reason: ${move.reason}`);
                        if (move.score < 0) {
                            log(`Note: Best move is below neutral (${move.score.toFixed(2)}), taking it to avoid an early pass.`);
                        }
                        log(`Top 5 moves considered:`);

                        // Log top moves for analysis
                        for (let i = 0; i < Math.min(5, scoredMoves.length); i++) {
                            const m = scoredMoves[i];
                            log(`  ${i + 1}. (${m.x},${m.y}) = ${m.score.toFixed(2)} - ${m.reason}`);
                        }

                        try {
                            const result = await ns.go.makeMove(move.x, move.y);
                            log("Move executed successfully");
                            logCaptureDetails(result);
                            if (result?.type === "gameOver") {
                                log("Game ended immediately after our move");
                                break;
                            }
                            if (result?.type === "pass") {
                                opponentPassedLastTurn = true;
                                log("Opponent passed in response to our move");
                            } else if (result?.type === "move") {
                                opponentPassedLastTurn = false;
                                log(`Opponent responded with move at (${result.x}, ${result.y})`);
                            }
                        } catch (error) {
                            log(`ERROR making move: ${error.message}`);
                            // Try to pass instead
                            try {
                                const fallbackResult = await ns.go.passTurn();
                                log("Fallback: passed turn after move failure");
                                opponentPassedLastTurn = fallbackResult?.type === "pass";
                                logCaptureDetails(fallbackResult);
                                if (fallbackResult?.type === "gameOver") {
                                    log("Opponent acknowledged game over after fallback pass");
                                    break;
                                }
                                if (fallbackResult?.type === "pass") {
                                    log("Fallback pass triggered opponent pass - ending game");
                                    break;
                                }
                                if (fallbackResult?.type === "move") {
                                    log(
                                        `Opponent responded with move at (${fallbackResult.x}, ${fallbackResult.y})`
                                    );
                                }
                            } catch (fallbackError) {
                                log(`ERROR passing turn after failed move: ${fallbackError.message}`);
                                break;
                            }
                        }
                    } else {
                        log("Decision: No valid moves found, passing");
                        try {
                            const result = await ns.go.passTurn();
                            opponentPassedLastTurn = result?.type === "pass";
                            logCaptureDetails(result);
                            if (result?.type === "gameOver") {
                                log("Opponent acknowledged game over after forced pass");
                                break;
                            }
                            if (result?.type === "pass") {
                                log("Both players passed (no valid moves) - ending game");
                                break;
                            }
                            if (result?.type === "move") {
                                log(`Opponent responded with move at (${result.x}, ${result.y})`);
                            }
                        } catch (error) {
                            log(`ERROR passing turn: ${error.message}`);
                            break;
                        }
                    }
                }

                moveNumber++;
            }

            // Final game state for this game
            const finalState = ns.go.getGameState();
            log("\n=== GAME ENDED ===");
            log(`Final Black Score: ${finalState.blackScore}`);
            log(`Final White Score: ${finalState.whiteScore}`);
            const winner = finalState.blackScore > finalState.whiteScore ? "Black (us)" : "White (opponent)";
            log(`Winner: ${winner}`);
            log(`Total Moves Played: ${moveNumber}`);

            // Store game result
            gameResults.push({
                gameNumber: gameNum,
                blackScore: finalState.blackScore,
                whiteScore: finalState.whiteScore,
                winner: winner,
                moves: moveNumber
            });
        }

        // Summary of all games
        log(`\n${"=".repeat(60)}`);
        log("=== SESSION SUMMARY ===");
        log(`${"=".repeat(60)}`);

        let wins = 0;
        let losses = 0;
        for (const result of gameResults) {
            log(`Game ${result.gameNumber}: ${result.winner} (${result.blackScore} vs ${result.whiteScore}, ${result.moves} moves)`);
            if (result.winner === "Black (us)") wins++;
            else losses++;
        }

        log(`\nOverall Record: ${wins} wins, ${losses} losses (${((wins / CONFIG.NUM_GAMES) * 100).toFixed(1)}% win rate)`);

        // Get final stats
        const stats = ns.go.analysis.getStats();
        const opponentStats = stats[CONFIG.OPPONENT] || {};
        log(`\nTotal Opponent Stats:`);
        log(`  Wins: ${opponentStats.wins || 0}`);
        log(`  Losses: ${opponentStats.losses || 0}`);
        log(`  Win Streak: ${opponentStats.winStreak || 0}`);

    } catch (error) {
        log(`FATAL ERROR: ${error.message}`);
        log(`Stack: ${error.stack}`);
    }

    // Write log to file
    log("\n=== Writing log to file ===");
    const logContent = debugLog.join("\n");
    await ns.write(CONFIG.LOG_FILE, logContent, "w");
    ns.tprint(`Debug log written to ${CONFIG.LOG_FILE}`);
    ns.tprint(`Total log entries: ${debugLog.length}`);

    function checkShouldPass(gameState, moveCount, boardSize, opponentPassedLastTurn = false) {
        const blackScore = gameState.blackScore || 0;
        const whiteScore = gameState.whiteScore || 0;
        const scoreDiff = blackScore - whiteScore;
        const passThreshold = boardSize * 0.5;

        // CRITICAL: Check board state before passing
        const boardState = ns.go.getBoardState();
        const liberties = ns.go.analysis.getLiberties();

        // Check if we have any groups in danger (1-2 liberties)
        let hasWeakGroups = false;
        let hasEnemyWeakGroups = false;

        for (let x = 0; x < boardSize; x++) {
            for (let y = 0; y < boardSize; y++) {
                const liberty = liberties[x][y];
                if (boardState[x][y] === "X" && liberty > 0 && liberty <= 2) {
                    hasWeakGroups = true;
                }
                if (boardState[x][y] === "O" && liberty > 0 && liberty <= 2) {
                    hasEnemyWeakGroups = true;
                }
            }
        }

        const boardArea = boardSize * boardSize;
        const lateGameThreshold = boardArea * 0.5; // 50% of possible moves
        const isLateGame = moveCount > lateGameThreshold;

        // If opponent just passed and we're ahead (or tied), finish the game
        if (opponentPassedLastTurn && scoreDiff >= 0) {
            return true;
        }

        // If losing badly in late game, just pass to end it quickly
        if (isLateGame && scoreDiff < -10) {
            return true; // Cut losses, don't prolong hopeless game
        }

        // If winning by a huge margin (10+ points), just pass - game is over
        if (scoreDiff > passThreshold * 3) {
            return true; // Dominating, no need to continue
        }

        // If ahead by comfortable margin (>passThreshold), only worry about groups in ATARI (1 liberty)
        if (scoreDiff > passThreshold) {
            // Check if we have any groups in immediate danger (1 liberty only)
            let hasAtariGroups = false;
            for (let x = 0; x < boardSize; x++) {
                for (let y = 0; y < boardSize; y++) {
                    const liberty = liberties[x][y];
                    if (boardState[x][y] === "X" && liberty === 1) {
                        hasAtariGroups = true;
                        break;
                    }
                }
                if (hasAtariGroups) break;
            }

            if (!hasAtariGroups) {
                return true; // Winning and no groups in atari - pass
            }
        }

        // Don't pass if we have weak groups AND we're still in the game (close score)
        if (hasWeakGroups && scoreDiff > -passThreshold && scoreDiff < passThreshold) {
            return false; // Defend if game is close
        }

        // Don't pass if opponent has weak groups we could capture (and game is close)
        if (hasEnemyWeakGroups && Math.abs(scoreDiff) < passThreshold * 1.5) {
            return false; // Keep playing to capture or increase lead
        }

        // In late game, pass if close (no point continuing)
        if (isLateGame && Math.abs(scoreDiff) < passThreshold) {
            return true; // Close game, accept result
        }

        // If opponent passed last turn and the game is close, consider ending it
        if (opponentPassedLastTurn && Math.abs(scoreDiff) < passThreshold * 0.5) {
            return true;
        }

        return false;
    }

    function getAllScoredMoves(ns, boardState, validMoves, config) {
        const moves = [];
        const boardSize = boardState.length;

        const chains = ns.go.analysis.getChains();
        const liberties = ns.go.analysis.getLiberties();

        for (let x = 0; x < boardSize; x++) {
            for (let y = 0; y < boardSize; y++) {
                if (validMoves[x][y]) {
                    const score = evaluateMove(x, y, boardState, chains, liberties, boardSize, config);
                    if (score >= config.MIN_MOVE_SCORE) {
                        moves.push({
                            x: x,
                            y: y,
                            score: score,
                            reason: getReasonForMove(score)
                        });
                    }
                }
            }
        }

        moves.sort((a, b) => b.score - a.score);
        return moves;
    }

    function evaluateMove(x, y, boardState, chains, liberties, boardSize, config) {
        let score = 0;

        // Count total stones on board to determine game phase
        let totalStones = 0;
        for (let i = 0; i < boardSize; i++) {
            for (let j = 0; j < boardSize; j++) {
                if (boardState[i][j] === "X" || boardState[i][j] === "O") {
                    totalStones++;
                }
            }
        }
    const isOpening = totalStones < boardSize * 2; // First ~14 moves on 7x7
    const defenseScale = isOpening ? config.OPENING_DEFENSE_SCALE : 1;

        // Analyze adjacent points
        let adjacentEmpty = 0;
        let adjacentEnemy = 0;
        let adjacentFriendly = 0;
        let adjacentEnemyChains = new Set();
        let adjacentFriendlyChains = new Set();
        let minAdjacentEnemyLiberties = Infinity;
        let minAdjacentFriendlyLiberties = Infinity;

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                const point = boardState[nx][ny];
                const chainId = chains[nx][ny];
                const pointLiberties = liberties[nx][ny];

                if (point === ".") {
                    adjacentEmpty++;
                } else if (point === "O") {
                    adjacentEnemy++;
                    if (chainId !== null) {
                        adjacentEnemyChains.add(chainId);
                        if (pointLiberties > 0) {
                            minAdjacentEnemyLiberties = Math.min(minAdjacentEnemyLiberties, pointLiberties);
                        }
                    }
                } else if (point === "X") {
                    adjacentFriendly++;
                    if (chainId !== null) {
                        adjacentFriendlyChains.add(chainId);
                        if (pointLiberties > 0) {
                            minAdjacentFriendlyLiberties = Math.min(minAdjacentFriendlyLiberties, pointLiberties);
                        }
                    }
                }
            }
        }

        // Calculate resulting liberties FIRST before deciding priorities
        let estimatedLiberties = adjacentEmpty; // Start with new liberties this move creates

        if (adjacentFriendly > 0) {
            // When connecting to existing stones, estimate resulting liberties
            // The group loses this liberty point but gains adjacentEmpty new ones
            estimatedLiberties = minAdjacentFriendlyLiberties - 1 + adjacentEmpty;
        }

        // PRIORITY 0: NEVER create self-atari or dangerous connections (this overrides everything!)
        if (adjacentFriendly > 0) {
            // Connecting to a weak group - be VERY conservative
            if (estimatedLiberties <= 1) {
                score -= 500; // FATAL: This creates self-atari
                return score;
            }

            // Even if estimated liberties is 2, be cautious about connecting to very weak groups
            if (minAdjacentFriendlyLiberties <= 2 && estimatedLiberties === 2) {
                // Only allow if we're creating substantial new liberties (not just filling in)
                if (adjacentEmpty < 2) {
                    score -= 300; // DANGER: Likely creates vulnerable group
                    return score;
                }
            }
        }

        // PRIORITY 1: Capture enemy stones in atari (most valuable)
        if (minAdjacentEnemyLiberties === 1) {
            score += 150; // High value: capture stones
        } else if (minAdjacentEnemyLiberties === 2) {
            score += 60 * config.AGGRESSION_LEVEL; // Put pressure on weak enemy groups
        }

        // PRIORITY 2: Save our own groups in atari - BUT only if it actually saves them!
        if (minAdjacentFriendlyLiberties === 1) {
            // Check if this move actually provides escape (at least 2 liberties after)
            if (estimatedLiberties >= 2) {
                score += 200 * defenseScale; // CRITICAL: This actually saves our stones
            }
            // If estimatedLiberties < 2, the self-atari penalty already applied above
        } else if (minAdjacentFriendlyLiberties === 2) {
            // Reinforcing a group with 2 liberties
            if (estimatedLiberties >= 2) {
                score += 80 * defenseScale; // Important: Reinforce weak groups
            } else {
                score -= 30; // Would leave group vulnerable
            }
        }

        // PRIORITY 3: Avoid creating weak shapes
        if (adjacentFriendly > 0) {
            if (estimatedLiberties === 2) {
                score -= 20; // Leaves group with only 2 liberties - risky
            }
        } else {
            // Playing on isolated point - needs breathing room
            if (adjacentEmpty < 2) {
                score -= 50; // Don't create isolated weak stones
            }
        }

        // PRIORITY 4: Basic territory
        score += adjacentEmpty * 15 * config.TERRITORY_WEIGHT;

        // PRIORITY 4.5: Eye-making (critical for living groups)
        // A living group needs TWO separate eyes (empty points fully surrounded by friendly stones)
        // Check if this move creates or protects eye space within a friendly group

        // Count enclosed empty spaces near our groups
        let potentialEyeSpaces = 0;
        let isAdjacentToEyeSpace = false;

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize && boardState[nx][ny] === ".") {
                // This adjacent empty point - check if it's surrounded by our stones (potential eye)
                let surroundedByUs = 0;
                let totalNeighbors = 0;
                for (const [dx2, dy2] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    const nnx = nx + dx2;
                    const nny = ny + dy2;
                    if (nnx >= 0 && nnx < boardSize && nny >= 0 && nny < boardSize) {
                        totalNeighbors++;
                        if (boardState[nnx][nny] === "X" || (nnx === x && nny === y)) {
                            surroundedByUs++;
                        }
                    }
                }

                // If this empty point would be mostly surrounded after our move, it's potential eye space
                if (surroundedByUs >= totalNeighbors - 1) {
                    potentialEyeSpaces++;
                    isAdjacentToEyeSpace = true;
                }
            }
        }

        // Reward moves that create or protect eye space (but don't over-prioritize)
        // Playing adjacent to (not filling) potential eyes helps secure territory
        if (potentialEyeSpaces >= 2) {
            score += 50; // Good: creating/protecting multiple potential eyes
        } else if (potentialEyeSpaces === 1) {
            score += 25; // Modest: working toward one eye
        }

        // CRITICAL: Penalize filling in eye space
        // If we're completely surrounded by our own stones, playing here fills an eye
        if (adjacentFriendly >= 3 && adjacentEmpty === 0 && adjacentEnemy === 0) {
            score -= 200; // Never fill your own eyes!
        }

        // PRIORITY 4.6: Territory invasion and reduction
        // Reward reducing opponent's territory (playing near enemy stones in their areas)
        if (adjacentEnemy >= 2 && adjacentEmpty >= 2) {
            score += 35; // Good: invading/reducing opponent territory
        } else if (adjacentEnemy === 1 && adjacentEmpty >= 3) {
            score += 20; // Modest: approaching opponent territory
        }

        // PRIORITY 5: Good shape and connectivity
        // Check if connecting would join weak groups - heavily reward this
        let connectsWeakGroups = false;
        if (adjacentFriendly >= 2 && adjacentFriendlyChains.size >= 2) {
            // This move connects multiple separate groups
            // Check if any of those groups are weak (≤3 liberties)
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                    if (boardState[nx][ny] === "X" && liberties[nx][ny] > 0 && liberties[nx][ny] <= 3) {
                        connectsWeakGroups = true;
                        break;
                    }
                }
            }
        }

        if (connectsWeakGroups) {
            score += 120 * defenseScale; // CRITICAL: Connecting weak groups makes them strong
        } else if (adjacentFriendly === 1) {
            score += 20 * defenseScale; // Good: simple extension
        } else if (adjacentFriendly === 2) {
            score += 35 * defenseScale; // Better: connecting groups or making strong shape
        } else if (adjacentFriendly >= 3) {
            score += 15 * defenseScale; // Often "filling in" moves, less urgent
        }

        // PRIORITY 6: Opening strategy - balanced for natural play
        if (isOpening) {
            const centerX = Math.floor(boardSize / 2);
            const centerY = Math.floor(boardSize / 2);
            const distanceFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
            const maxIndex = boardSize - 1;
            const cornerDistance = Math.max(2, Math.floor(boardSize / 3));
            const minEdgeDistanceX = Math.min(x, maxIndex - x);
            const minEdgeDistanceY = Math.min(y, maxIndex - y);

            const isCornerAnchor =
                minEdgeDistanceX === cornerDistance && minEdgeDistanceY === cornerDistance;
            const isSideAnchor =
                (minEdgeDistanceX === cornerDistance && Math.abs(y - centerY) <= 1) ||
                (minEdgeDistanceY === cornerDistance && Math.abs(x - centerX) <= 1);
            const isCenter = x === centerX && y === centerY;

            // Very early game (first 4 stones): Establish corner/side positions
            if (totalStones < 4) {
                if (isCornerAnchor) {
                    score += config.OPENING_CORNER_BONUS;
                } else if (isSideAnchor) {
                    score += config.OPENING_SIDE_BONUS;
                } else if (isCenter) {
                    score += Math.max(config.OPENING_SIDE_BONUS - 6, 24);
                } else if (minEdgeDistanceX === 0 || minEdgeDistanceY === 0) {
                    score += Math.max(Math.floor(config.OPENING_SIDE_BONUS * 0.4), 12);
                } else {
                    score += Math.max(Math.floor(config.OPENING_SIDE_BONUS * 0.6), 18);
                }
            } else if (totalStones < boardSize * 2) {
                // After initial stones, focus on extensions and approaches
                score += Math.max(0, (boardSize - distanceFromCenter)) * 5;

                // Reward good extensions from existing stones (2-3 spaces away)
                let extensionBonus = 0;
                for (let dx = -4; dx <= 4; dx++) {
                    for (let dy = -4; dy <= 4; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                            if (boardState[nx][ny] === "X") {
                                const dist = Math.abs(dx) + Math.abs(dy);
                                if (dist === 2 || dist === 3) {
                                    extensionBonus += config.EARLY_EXTENSION_BONUS;
                                } else if (dist === 4) {
                                    extensionBonus += Math.max(
                                        Math.floor(config.EARLY_EXTENSION_BONUS * 0.6),
                                        6
                                    );
                                } else if (dist === 1) {
                                    extensionBonus += Math.max(
                                        Math.floor(config.EARLY_EXTENSION_BONUS * 0.4),
                                        4
                                    );
                                }
                            }
                        }
                    }
                }
                score += extensionBonus;
            }
        } else {
            // Mid/late game - modest center influence
            const centerX = Math.floor(boardSize / 2);
            const centerY = Math.floor(boardSize / 2);
            const distanceFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
            score += Math.max(0, (boardSize - distanceFromCenter)) * 4;
        }

        // PRIORITY 7: Pressure on enemy
        score += adjacentEnemy * 20 * config.AGGRESSION_LEVEL;

        return score;
    }

    function getReasonForMove(score) {
        if (score >= 200) return "Saving group from capture!";
        if (score >= 150) return "Capturing enemy stones!";
        if (score >= 80) return "Defending weak group";
        if (score >= 60) return "Strong strategic move";
        if (score >= 30) return "Territory expansion";
        if (score >= 20) return "Good shape";
        return "Development";
    }
}
