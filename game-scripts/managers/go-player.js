/** @param {NS} ns */
export async function main(ns) {
    const CONFIG = {
        // Game settings
        PREFERRED_BOARD_SIZE: 7, // Good balance of complexity and speed
        TARGET_OPPONENTS: [
            "Netburners", "The Black Hand", "Daedalus"
            // "Illuminati" - Removed: 10.5 point starting handicap makes it extremely difficult
        ],

        // Opponent difficulty levels (affects strategy)
        OPPONENT_DIFFICULTY: {
            "Netburners": 1,      // Easiest
            "Slum Snakes": 1,
            "The Black Hand": 2,
            "Tetrads": 2,
            "Daedalus": 3,
            "Illuminati": 4       // Hardest - needs defensive play
        },

        // Strategy settings (base values, adjusted per opponent)
        AGGRESSION_LEVEL: 0.6, // 0.0 = defensive, 1.0 = aggressive
        MIN_LIBERTY_THRESHOLD: 2, // Don't play moves that create groups with < 2 liberties
        TERRITORY_WEIGHT: 0.7, // How much to prioritize territory vs capture

        // Automation settings
        MOVE_DELAY: 1000, // Delay between moves (ms)
        GAME_TIMEOUT: 300000, // 5 minutes max per game
        MAX_GAMES_PER_SESSION: 10,

        // HUD settings
        UPDATE_HUD: true,
        HUD_PORT: 5
    };

    ns.disableLog("sleep");

    // Check if Go API is available
    if (!ns.go) {
        ns.tprint("Go API not available in this version of Bitburner");
        return;
    }

    let gamesPlayed = 0;
    let currentOpponent = null;
    let gameStartTime = 0;
    let moveCount = 0;

    ns.tprint("=== GO AUTOMATION STARTED ===");

    while (gamesPlayed < CONFIG.MAX_GAMES_PER_SESSION) {
        try {
            // Get current game state
            const gameState = ns.go.getGameState();

            if (gameState.currentPlayer === "None") {
                // Game is over - increment counter and start a new one
                if (currentOpponent) {
                    gamesPlayed++;
                    ns.print(`Game ${gamesPlayed} completed vs ${currentOpponent}`);
                }
                await startNewGame();
                gameStartTime = Date.now();
                moveCount = 0;
                continue;
            }

            // Check for timeout
            if (Date.now() - gameStartTime > CONFIG.GAME_TIMEOUT) {
                gamesPlayed++;
                ns.print(`Game ${gamesPlayed} timed out vs ${currentOpponent} - starting new game`);
                await startNewGame();
                gameStartTime = Date.now();
                continue;
            }

            // Always our turn to play (currentPlayer stays "Black" in Bitburner)
            if (gameState.currentPlayer === "Black" || gameState.currentPlayer === "black") {
                await playOptimalMove(gameState, moveCount);
                moveCount++;

                // After our move, let opponent play
                try {
                    await ns.go.opponentNextTurn();
                } catch (error) {
                    ns.print(`Opponent turn error: ${error.message}`);
                    // If opponent can't play, game might be over or stuck
                    await ns.sleep(1000);
                }
            } else if (gameState.currentPlayer === "None") {
                // Game ended, will be handled in next iteration
                ns.print("Game ended, starting new game next iteration");
            } else {
                // Unexpected state
                ns.print(`Unexpected game state: ${gameState.currentPlayer}, attempting to pass turn`);
                try {
                    await ns.go.passTurn();
                } catch (error) {
                    ns.print("Pass turn failed, starting new game");
                    await startNewGame();
                }
            }

            // Update HUD
            if (CONFIG.UPDATE_HUD) {
                updateHUD(gameState);
            }

            await ns.sleep(CONFIG.MOVE_DELAY);

        } catch (error) {
            ns.print(`Error in Go automation: ${error.message}`);
            await ns.sleep(5000);
        }
    }

    ns.tprint(`Go session completed: ${gamesPlayed} games played`);

    // Clear HUD port to indicate session is complete
    if (CONFIG.UPDATE_HUD) {
        const finalStats = ns.go.analysis.getStats();
        const opponentStats = finalStats[currentOpponent] || {};

        const completionHudData = {
            isActive: false,
            sessionComplete: true,
            currentOpponent: currentOpponent,
            gamesPlayed: gamesPlayed,
            maxGames: CONFIG.MAX_GAMES_PER_SESSION,
            finalStats: {
                wins: opponentStats.wins || 0,
                losses: opponentStats.losses || 0,
                winStreak: opponentStats.winStreak || 0,
                favor: opponentStats.favor || 0,
                winRate: opponentStats.wins && opponentStats.losses ?
                    ((opponentStats.wins / (opponentStats.wins + opponentStats.losses)) * 100).toFixed(1) : "0.0"
            },
            lastUpdate: Date.now()
        };

        ns.clearPort(CONFIG.HUD_PORT);
        ns.writePort(CONFIG.HUD_PORT, JSON.stringify(completionHudData));
        ns.print("Updated HUD with session completion data");
    }

    async function startNewGame() {
        // Select next opponent
        currentOpponent = selectNextOpponent();

        try {
            ns.go.resetBoardState(currentOpponent, CONFIG.PREFERRED_BOARD_SIZE);
            ns.print(`Started new game vs ${currentOpponent} (${CONFIG.PREFERRED_BOARD_SIZE}x${CONFIG.PREFERRED_BOARD_SIZE})`);
            // Don't increment gamesPlayed here - only when game actually completes
        } catch (error) {
            ns.print(`Failed to start game vs ${currentOpponent}: ${error.message}`);
            // Try default opponent
            ns.go.resetBoardState("Netburners", CONFIG.PREFERRED_BOARD_SIZE);
            currentOpponent = "Netburners";
        }
    }

    function selectNextOpponent() {
        // Get stats to see which opponents we should focus on
        const stats = ns.go.analysis.getStats();

        // Prioritize opponents we haven't beaten much
        for (const opponent of CONFIG.TARGET_OPPONENTS) {
            if (!stats[opponent] || stats[opponent].wins < 5) {
                return opponent;
            }
        }

        // Fallback to first opponent
        return CONFIG.TARGET_OPPONENTS[0];
    }

    // Note: In Bitburner Go API, currentPlayer always stays "Black"
    // We need to call opponentNextTurn() after each of our moves

    async function playOptimalMove(gameState, currentMoveCount) {
        const boardState = ns.go.getBoardState();

        // Check if we should pass to end the game
        if (shouldPassToWin(gameState, currentMoveCount, boardState.length)) {
            ns.print(`Passing - Black: ${gameState.blackScore} vs White: ${gameState.whiteScore}`);
            try {
                await ns.go.passTurn();
                return;
            } catch (error) {
                ns.print(`Failed to pass turn: ${error.message}`);
            }
        }

        const validMoves = ns.go.analysis.getValidMoves();
        const move = findBestMove(boardState, validMoves, currentOpponent);

        if (move) {
            try {
                const result = await ns.go.makeMove(move.x, move.y);
                ns.print(`Played move: (${move.x}, ${move.y}) - ${move.reason}`);

                // Check if move was successful
                if (result && result.type === "move") {
                    // Highlight the move briefly
                    ns.go.analysis.highlightPoint(move.x, move.y, "yellow", "★");
                }
            } catch (error) {
                ns.print(`Failed to make move (${move.x}, ${move.y}): ${error.message}`);
                // Try to pass turn instead
                try {
                    await ns.go.passTurn();
                    ns.print("Passed turn instead");
                } catch (passError) {
                    ns.print(`Failed to pass turn: ${passError.message}`);
                }
            }
        } else {
            // No good moves found, pass
            ns.print("No good moves found, passing turn");
            try {
                await ns.go.passTurn();
            } catch (error) {
                ns.print(`Failed to pass turn: ${error.message}`);
            }
        }
    }

    function shouldPassToWin(gameState, moveCount, boardSize) {
        // API uses blackScore/whiteScore, not player/opponent
        const blackScore = gameState.blackScore || 0;
        const whiteScore = gameState.whiteScore || 0;
        const scoreDiff = blackScore - whiteScore;

        const passThreshold = boardSize * 0.5; // ~3.5 points for 7x7 board

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

        return false;
    }

    function findBestMove(boardState, validMoves, opponent) {
        const moves = [];
        const boardSize = boardState.length;

        // Get opponent difficulty
        const difficulty = CONFIG.OPPONENT_DIFFICULTY[opponent] || 2;

        // Analyze board state
        const chains = ns.go.analysis.getChains();
        const liberties = ns.go.analysis.getLiberties();
        const controlledNodes = ns.go.analysis.getControlledEmptyNodes();

        // Score all valid moves
        for (let x = 0; x < boardSize; x++) {
            for (let y = 0; y < boardSize; y++) {
                if (validMoves[x][y]) {
                    const score = evaluateMove(x, y, boardState, chains, liberties, controlledNodes, difficulty);
                    if (score > 0) {
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

        // Sort by score and return best move
        moves.sort((a, b) => b.score - a.score);
        return moves.length > 0 ? moves[0] : null;
    }

    function evaluateMove(x, y, boardState, chains, liberties, controlledNodes, difficulty) {
        let score = 0;
        const boardSize = boardState.length;

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

        // Against harder opponents (Illuminati = 4), play more conservatively
        const playConservative = difficulty >= 4;

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
                } else if (point === "O") { // White (enemy)
                    adjacentEnemy++;
                    if (chainId !== null) {
                        adjacentEnemyChains.add(chainId);
                        if (pointLiberties > 0) {
                            minAdjacentEnemyLiberties = Math.min(minAdjacentEnemyLiberties, pointLiberties);
                        }
                    }
                } else if (point === "X") { // Black (us)
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
            score += 60 * CONFIG.AGGRESSION_LEVEL; // Put pressure on weak enemy groups
        }

        // PRIORITY 2: Save our own groups in atari - BUT only if it actually saves them!
        if (minAdjacentFriendlyLiberties === 1) {
            // Check if this move actually provides escape (at least 2 liberties after)
            if (estimatedLiberties >= 2) {
                score += 200; // CRITICAL: This actually saves our stones
            }
            // If estimatedLiberties < 2, the self-atari penalty already applied above
        } else if (minAdjacentFriendlyLiberties === 2) {
            // Reinforcing a group with 2 liberties
            if (estimatedLiberties >= 2) {
                score += 80; // Important: Reinforce weak groups
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
        score += adjacentEmpty * 15 * CONFIG.TERRITORY_WEIGHT;

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
            score += 120; // CRITICAL: Connecting weak groups makes them strong
        } else if (adjacentFriendly === 1) {
            score += 20; // Good: simple extension
        } else if (adjacentFriendly === 2) {
            score += 35; // Better: connecting groups or making strong shape
        } else if (adjacentFriendly >= 3) {
            score += 15; // Often "filling in" moves, less urgent
        }

        // PRIORITY 6: Opening strategy - balanced for natural play
        if (isOpening) {
            // On 7x7 boards, use modified opening principles
            // Good points: 3-3 (secure), 2-2 (territory), center (influence)

            const centerX = Math.floor(boardSize / 2);
            const centerY = Math.floor(boardSize / 2);
            const distanceFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);

            // Very early game (first 4 stones): Establish corner/side positions
            if (totalStones < 4) {
                // Evaluate specific good opening points on 7x7
                // 3-3 points (san-san) - secure corner territory
                if ((x === 2 && y === 2) || (x === 2 && y === 4) ||
                    (x === 4 && y === 2) || (x === 4 && y === 4)) {
                    score += 60; // Excellent opening move
                }
                // 2-2 points - also good for quick territory
                else if ((x === 2 && y === 2) || (x === 2 && y === 4) ||
                         (x === 4 && y === 2) || (x === 4 && y === 4)) {
                    score += 55;
                }
                // Center point - good for influence
                else if (x === 3 && y === 3) {
                    score += 45;
                }
                // Side points (2-3 lines) - reasonable
                else if ((x === 2 || x === 3 || x === 4) && (y === 2 || y === 3 || y === 4)) {
                    score += 35;
                }
                // Edge points - less ideal
                else if (x === 0 || x === 6 || y === 0 || y === 6) {
                    score += 15;
                }
                // Other points - low priority
                else {
                    score += 25;
                }
            } else if (totalStones < boardSize * 2) {
                // After initial stones, focus on extensions and approaches
                score += Math.max(0, (boardSize - distanceFromCenter)) * 6;

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
                                // Ideal extension distance is 2-3 points
                                if (dist === 2 || dist === 3) {
                                    extensionBonus += 18; // Strong extension
                                } else if (dist === 4) {
                                    extensionBonus += 10; // Reasonable extension
                                } else if (dist === 1) {
                                    extensionBonus += 5; // Connection (handled elsewhere)
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
        score += adjacentEnemy * 20 * CONFIG.AGGRESSION_LEVEL;

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

    function updateHUD(gameState) {
        try {
            const stats = ns.go.analysis.getStats();
            const opponentStats = stats[currentOpponent] || {};

            const hudData = {
                isActive: true,
                currentOpponent: currentOpponent,
                gamesPlayed: gamesPlayed,
                maxGames: CONFIG.MAX_GAMES_PER_SESSION,
                gameState: {
                    currentPlayer: gameState.currentPlayer,
                    score: gameState.score,
                    moves: gameState.moves || 0
                },
                opponentStats: {
                    wins: opponentStats.wins || 0,
                    losses: opponentStats.losses || 0,
                    winStreak: opponentStats.winStreak || 0,
                    favor: opponentStats.favor || 0
                },
                lastUpdate: Date.now()
            };

            ns.clearPort(CONFIG.HUD_PORT);
            ns.writePort(CONFIG.HUD_PORT, JSON.stringify(hudData));
        } catch (error) {
            ns.print(`Could not update HUD: ${error.message}`);
        }
    }
}