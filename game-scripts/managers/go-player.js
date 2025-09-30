/** @param {NS} ns */
export async function main(ns) {
    const CONFIG = {
        // Game settings
        PREFERRED_BOARD_SIZE: 7, // Good balance of complexity and speed
        TARGET_OPPONENTS: [
            "Netburners", "The Black Hand", "Daedalus", "Illuminati"
        ],

        // Strategy settings
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
                await playOptimalMove();

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

    async function playOptimalMove() {
        const boardState = ns.go.getBoardState();
        const validMoves = ns.go.analysis.getValidMoves();
        const move = findBestMove(boardState, validMoves);

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

    function findBestMove(boardState, validMoves) {
        const moves = [];
        const boardSize = boardState.length;

        // Analyze board state
        const chains = ns.go.analysis.getChains();
        const liberties = ns.go.analysis.getLiberties();
        const controlledNodes = ns.go.analysis.getControlledEmptyNodes();

        // Score all valid moves
        for (let x = 0; x < boardSize; x++) {
            for (let y = 0; y < boardSize; y++) {
                if (validMoves[x][y]) {
                    const score = evaluateMove(x, y, boardState, chains, liberties, controlledNodes);
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

    function evaluateMove(x, y, boardState, chains, liberties, controlledNodes) {
        let score = 0;
        const boardSize = boardState.length;

        // 1. Center bias (opening strategy)
        const centerX = Math.floor(boardSize / 2);
        const centerY = Math.floor(boardSize / 2);
        const distanceFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
        score += Math.max(0, (boardSize - distanceFromCenter)) * 10;

        // 2. Edge and corner bonuses
        if (x === 0 || x === boardSize - 1 || y === 0 || y === boardSize - 1) {
            score += 15; // Edge bonus
        }
        if ((x === 0 || x === boardSize - 1) && (y === 0 || y === boardSize - 1)) {
            score += 25; // Corner bonus
        }

        // 3. Territory expansion
        let adjacentEmpty = 0;
        let adjacentEnemy = 0;
        let adjacentFriendly = 0;

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                const point = boardState[nx][ny];
                if (point === ".") {
                    adjacentEmpty++;
                } else if (point === "O") { // Assuming we're X (black)
                    adjacentEnemy++;
                } else if (point === "X") {
                    adjacentFriendly++;
                }
            }
        }

        // Prefer moves that expand territory
        score += adjacentEmpty * 20 * CONFIG.TERRITORY_WEIGHT;

        // Bonus for connecting to friendly stones
        score += adjacentFriendly * 15;

        // Bonus for threatening enemy stones
        score += adjacentEnemy * 25 * CONFIG.AGGRESSION_LEVEL;

        // 4. Liberty considerations
        // Avoid moves that create groups with very few liberties
        if (adjacentFriendly > 0) {
            // This move would connect to existing stones
            // Estimate resulting liberties
            const estimatedLiberties = adjacentEmpty;
            if (estimatedLiberties < CONFIG.MIN_LIBERTY_THRESHOLD) {
                score -= 50; // Penalty for dangerous connections
            }
        }

        // 5. Capture opportunities
        // Check if this move would capture enemy stones
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                if (boardState[nx][ny] === "O" && liberties[nx][ny] === 1) {
                    score += 100; // High bonus for captures
                }
            }
        }

        // 6. Strategic patterns
        // Prefer moves that create strong shapes
        if (adjacentFriendly >= 2) {
            score += 30; // Good for creating strong groups
        }

        return score;
    }

    function getReasonForMove(score) {
        if (score >= 100) return "Capture opportunity";
        if (score >= 50) return "Strong strategic move";
        if (score >= 30) return "Territory expansion";
        if (score >= 20) return "Good position";
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