/** @param {NS} ns */
export async function main(ns) {
    const CONFIG = {
        OPPONENT: ns.args[0] || "Daedalus",
        BOARD_SIZE: ns.args[1] || 7,
        NUM_GAMES: ns.args[2] || 3,
        MOVE_DELAY: 1000,
        AGGRESSION_LEVEL: 0.45,
        MIN_LIBERTY_THRESHOLD: 2,
    TERRITORY_WEIGHT: 1,
    TERRITORY_INVADE_BONUS: 45,
    TERRITORY_CONTESTED_BONUS: 25,
    TERRITORY_SECURE_BONUS: 18,
    TERRITORY_OVERCONCENTRATION_PENALTY: 30,
        MIN_MOVE_SCORE: -10,
        OPENING_DEFENSE_SCALE: 0.6,
    OPENING_CORNER_BONUS: 36,
    OPENING_SIDE_BONUS: 22,
    EARLY_EXTENSION_BONUS: 14,
    OPENING_SPACING_THRESHOLD: 6,
    OPENING_SPACING_PENALTY: 35,
        LOG_FILE: "go-debug-log.txt"
    };

    ns.disableLog("ALL");

    let debugLog = [];
    const sessionStats = {
        totalEnemyLibDrops: 0,
        totalPrepAtari: 0,
        totalCaptureChances: 0,
        totalRiskyInvades: 0,
        totalCapturesCompleted: 0,
        totalCapturedStones: 0
    };

    function log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        debugLog.push(logEntry);
        ns.print(logEntry);
    }

    function logCaptureDetails(result, perGameStats = null) {
        if (!result || typeof result !== "object") return;
        if (typeof result.capturedStones === "number" && result.capturedStones > 0) {
            log(`Captured stones: ${result.capturedStones}`);
            if (perGameStats) {
                perGameStats.capturesCompleted = (perGameStats.capturesCompleted || 0) + 1;
                perGameStats.capturedStones = (perGameStats.capturedStones || 0) + result.capturedStones;
                sessionStats.totalCapturesCompleted++;
                sessionStats.totalCapturedStones += result.capturedStones;
            }
        }
        if (Array.isArray(result.captured) && result.captured.length > 0) {
            log(`Captured groups: ${JSON.stringify(result.captured)}`);
        }
    }

    function formatColumnLabels(boardSize) {
        const labels = [];
        for (let i = 0; i < boardSize; i++) {
            labels.push(i.toString());
        }
        return labels.join(" ");
    }

    function formatBoardRows(boardState) {
        if (!Array.isArray(boardState) || boardState.length === 0) return [];
        const size = boardState.length;
        const rows = [];
        for (let y = size - 1; y >= 0; y--) {
            let row = "";
            for (let x = 0; x < size; x++) {
                const point = boardState[x]?.[y];
                row += point === "X" || point === "O" ? point : ".";
            }
            rows.push(`${y}| ${row}`);
        }
        return rows;
    }

    function normalizeTerritoryRows(territoryMap) {
        if (!Array.isArray(territoryMap) || territoryMap.length === 0) return [];
        const rows = [];
        for (let y = territoryMap.length - 1; y >= 0; y--) {
            const row = Array.isArray(territoryMap[y]) ? territoryMap[y].join("") : territoryMap[y];
            rows.push(`${y}| ${row}`);
        }
        return rows;
    }

    function summarizeGroups(boardState, liberties, chains) {
        const summary = {
            friendlyStones: 0,
            enemyStones: 0,
            friendlyLibTotal: 0,
            enemyLibTotal: 0,
            friendlyLowChains: new Set(),
            enemyLowChains: new Set(),
            friendlyAtariChains: new Set(),
            enemyAtariChains: new Set()
        };

        if (!Array.isArray(boardState)) return summary;

        const size = boardState.length;
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const point = boardState[x]?.[y];
                if (point !== "X" && point !== "O") continue;

                const libs = liberties?.[x]?.[y] ?? -1;
                const chainId = chains?.[x]?.[y];

                if (point === "X") {
                    summary.friendlyStones++;
                    if (libs >= 0) summary.friendlyLibTotal += libs;
                    if (libs > 0 && libs <= 2 && chainId !== undefined) summary.friendlyLowChains.add(chainId);
                    if (libs === 1 && chainId !== undefined) summary.friendlyAtariChains.add(chainId);
                } else {
                    summary.enemyStones++;
                    if (libs >= 0) summary.enemyLibTotal += libs;
                    if (libs > 0 && libs <= 2 && chainId !== undefined) summary.enemyLowChains.add(chainId);
                    if (libs === 1 && chainId !== undefined) summary.enemyAtariChains.add(chainId);
                }
            }
        }

        return {
            friendlyStones: summary.friendlyStones,
            enemyStones: summary.enemyStones,
            friendlyAvgLib: summary.friendlyStones ? summary.friendlyLibTotal / summary.friendlyStones : 0,
            enemyAvgLib: summary.enemyStones ? summary.enemyLibTotal / summary.enemyStones : 0,
            friendlyLowChains: summary.friendlyLowChains.size,
            friendlyAtariChains: summary.friendlyAtariChains.size,
            enemyLowChains: summary.enemyLowChains.size,
            enemyAtariChains: summary.enemyAtariChains.size
        };
    }

    function summarizeTerritory(territoryMap) {
        if (!Array.isArray(territoryMap) || territoryMap.length === 0) return null;
        const counts = { X: 0, O: 0, "?": 0 };
        for (const row of territoryMap) {
            const rowData = Array.isArray(row) ? row : row?.split("") ?? [];
            for (const cell of rowData) {
                if (cell === "X" || cell === "O" || cell === "?") counts[cell]++;
            }
        }
        return counts;
    }

    function logBoardDiagnostics(boardState, liberties, chains, territoryMap) {
        if (!Array.isArray(boardState) || boardState.length === 0) return;
        const size = boardState.length;
        const columnLabels = formatColumnLabels(size);

        log("Board snapshot (X = us, O = opponent):");
        log(`    ${columnLabels}`);
        for (const row of formatBoardRows(boardState)) {
            log(`  ${row}`);
        }

        if (Array.isArray(territoryMap) && territoryMap.length > 0) {
            log("Controlled empty nodes (X = us, O = opponent, ? = contested):");
            log(`    ${columnLabels}`);
            for (const row of normalizeTerritoryRows(territoryMap)) {
                log(`  ${row}`);
            }
        }

        const groups = summarizeGroups(boardState, liberties, chains);
        log(
            `Group summary: us stones=${groups.friendlyStones}, avg libs=${groups.friendlyAvgLib.toFixed(2)}, chains ≤2 libs=${groups.friendlyLowChains}, in atari=${groups.friendlyAtariChains}; opponent stones=${groups.enemyStones}, avg libs=${groups.enemyAvgLib.toFixed(2)}, chains ≤2 libs=${groups.enemyLowChains}, in atari=${groups.enemyAtariChains}`
        );

        const territory = summarizeTerritory(territoryMap);
        if (territory) {
            log(
                `Territory estimate: us=${territory.X}, opponent=${territory.O}, contested=${territory["?"]}`
            );
        }
    }

    function logScoreDelta(previousState, label) {
        const latest = ns.go.getGameState();
        const prevDiff = (previousState.blackScore || 0) - (previousState.whiteScore || 0);
        const newDiff = (latest.blackScore || 0) - (latest.whiteScore || 0);
        const delta = newDiff - prevDiff;
        const deltaStr = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;
        log(
            `${label}: Score diff now ${newDiff.toFixed(1)} (Δ ${deltaStr}) | Black ${latest.blackScore} vs White ${latest.whiteScore}`
        );
        return latest;
    }

    function collectBoardAnalysis() {
        const cache = {};
        try {
            cache.boardState = ns.go.getBoardState();
        } catch (error) {
            log(`ERROR retrieving board state: ${error.message}`);
        }
        try {
            cache.liberties = ns.go.analysis.getLiberties();
        } catch (error) {
            log(`ERROR retrieving liberties: ${error.message}`);
        }
        try {
            cache.chains = ns.go.analysis.getChains();
        } catch (error) {
            log(`ERROR retrieving chains: ${error.message}`);
        }
        try {
            cache.territoryMap = ns.go.analysis.getControlledEmptyNodes();
        } catch (error) {
            log(`ERROR retrieving territory map: ${error.message}`);
        }
        return cache;
    }

    function countValidMoves(validMoves) {
        if (!Array.isArray(validMoves) || validMoves.length === 0) return 0;
        let count = 0;
        for (const column of validMoves) {
            if (!Array.isArray(column)) continue;
            for (const entry of column) {
                if (entry) count++;
            }
        }
        return count;
    }

    // Decide if a move is a safe and meaningful tactical candidate
    function isTacticalCandidate(move, scoreDiff) {
        if (!move || !move.metadata) return false;
        const m = move.metadata;
        if (m.selfAtari) return false; // never allow self-atari as tactical
        // prefer real threats: capture or clear liberty gain OR notable enemy liberty reduction
        const hasCapture = (m.potentialCaptureCount || 0) > 0;
        const reducesEnemy = (m.enemyLibertyReduction || 0) > 0;
        const prepsAtari = (m.prepAtariChains || 0) > 0;
        const gainsLibs = (m.libertyGain || 0) > 0 || (m.friendlyLibertiesAfter || 0) >= 2;

        // Avoid deep risky invasions unless we are trailing and have enough liberties after play
        if (m.deepInvasionRisk) {
            const safeWhenBehind = scoreDiff < -6 && (m.friendlyLibertiesAfter || 0) >= 3;
            if (!safeWhenBehind) return false;
        }

        // Minimal floors by game situation
        const score = typeof move.score === 'number' ? move.score : 0;
        if (scoreDiff > 0) {
            // When ahead, only accept captures or non-negative safe pressure
            if (hasCapture) return true;
            if (score < 0) return false;
            return (reducesEnemy || prepsAtari) && gainsLibs;
        } else {
            // When tied/behind, allow modestly negative if it creates real threats
            if (score <= -25) return false;
            return hasCapture || (reducesEnemy && gainsLibs) || (prepsAtari && gainsLibs);
        }
    }

    function getTerritorySymbol(territoryMap, x, y) {
        if (!Array.isArray(territoryMap)) return null;
        const rowRaw = territoryMap[y];
        if (rowRaw === undefined || rowRaw === null) return null;
        let symbol = null;
        if (Array.isArray(rowRaw)) {
            symbol = rowRaw[x] ?? null;
        } else if (typeof rowRaw === "string") {
            symbol = rowRaw.charAt(x) || null;
        }

        if (symbol === "#" || symbol === " " || symbol === "") {
            return null;
        }
        return symbol;
    }

    const coordKey = (x, y) => `${x},${y}`;

    function buildChainInfo(boardState, chains) {
        const infoMap = new Map();
        if (!Array.isArray(boardState) || !Array.isArray(chains)) {
            return infoMap;
        }

        const size = boardState.length;
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const point = boardState?.[x]?.[y];
                if (point !== "X" && point !== "O") continue;

                const chainId = chains?.[x]?.[y];
                if (chainId === undefined || chainId === null) continue;

                let info = infoMap.get(chainId);
                if (!info) {
                    info = {
                        owner: point,
                        stones: new Set(),
                        liberties: new Set()
                    };
                    infoMap.set(chainId, info);
                }

                const key = coordKey(x, y);
                info.stones.add(key);

                for (const [dx, dy] of offsets) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
                    if (boardState?.[nx]?.[ny] === ".") {
                        info.liberties.add(coordKey(nx, ny));
                    }
                }
            }
        }

        return infoMap;
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

            const perGameStats = {
                enemyLibDrops: 0,
                prepAtari: 0,
                captureChances: 0,
                riskyInvades: 0,
                capturesCompleted: 0,
                capturedStones: 0,
                captureConversionDenom: 0
            };

            // Focus on finishing weakened enemy chains across 1-2 plies
            const attackFocus = { ids: new Set(), ttl: 0 };

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

                const analysisCache = collectBoardAnalysis();
                if (analysisCache.boardState) {
                    logBoardDiagnostics(
                        analysisCache.boardState,
                        analysisCache.liberties,
                        analysisCache.chains,
                        analysisCache.territoryMap
                    );
                }

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
                    opponentPassedLastTurn,
                    analysisCache
                );
                log(
                    `Should pass check: ${shouldPass} (moveNum: ${moveNumber}, score: ${gameState.blackScore} vs ${gameState.whiteScore})`
                );

                // Build pressure targets (liberties of enemy chains with <= 2 liberties)
                const pressureTargets = new Set();
                try {
                    const chainsNow = analysisCache.chains ?? ns.go.analysis.getChains();
                    const boardNow = analysisCache.boardState ?? ns.go.getBoardState();
                    const chainInfoNow = buildChainInfo(boardNow, chainsNow);
                    for (const info of chainInfoNow.values()) {
                        if (info.owner === "O" && info.liberties.size <= 2) {
                            for (const lib of info.liberties) pressureTargets.add(lib);
                        }
                    }
                } catch {}

                if (shouldPass) {
                    // Tactical guardrail: if there is any immediate capture or pressure move, play it instead of passing
                    const validMovesForGuard = ns.go.analysis.getValidMoves();
                    const guardScored = getAllScoredMoves(ns, analysisCache.boardState ?? ns.go.getBoardState(), validMovesForGuard, CONFIG, analysisCache, {
                        scoreDiff: (gameState.blackScore || 0) - (gameState.whiteScore || 0),
                        pressureTargets,
                        attackFocus: attackFocus.ids
                    }, true);
                    const tactical = guardScored.find(m => isTacticalCandidate(m, (gameState.blackScore || 0) - (gameState.whiteScore || 0)));
                    if (tactical) {
                        log("Pass overridden: Found tactical attack opportunity.");
                        try {
                            const result = await ns.go.makeMove(tactical.x, tactical.y);
                            log(`Decision: Playing tactical move at (${tactical.x}, ${tactical.y})`);
                            log(`Move score: ${tactical.score.toFixed(2)}, Reason: ${tactical.reason}`);
                            logCaptureDetails(result, perGameStats);
                            logScoreDelta(gameState, "After resolving tactical move");
                            if (result?.type === "gameOver") {
                                log("Game ended immediately after tactical move");
                                break;
                            }
                            if (result?.type === "pass") {
                                opponentPassedLastTurn = true;
                                log("Opponent passed in response to tactical move");
                            } else if (result?.type === "move") {
                                opponentPassedLastTurn = false;
                                log(`Opponent responded with move at (${result.x}, ${result.y})`);
                            }
                            moveNumber++;
                            continue; // proceed to next turn
                        } catch (error) {
                            log(`ERROR making tactical move: ${error.message}`);
                            // fall through to pass
                        }
                    }
                    log("Decision: PASSING");
                    try {
                        const result = await ns.go.passTurn();
                        opponentPassedLastTurn = result?.type === "pass";
                        logCaptureDetails(result, perGameStats);
                        logScoreDelta(gameState, "Post-pass board state");
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
                    const boardState = analysisCache.boardState ?? ns.go.getBoardState();
                    const validMoves = ns.go.analysis.getValidMoves();
                    const validMoveCount = countValidMoves(validMoves);
                    log(`Valid moves available: ${validMoveCount}`);
                    const scoredMoves = getAllScoredMoves(ns, boardState, validMoves, CONFIG, analysisCache, {
                        scoreDiff: (gameState.blackScore || 0) - (gameState.whiteScore || 0),
                        pressureTargets,
                        attackFocus: attackFocus.ids
                    });
                    const move = scoredMoves.length > 0 ? scoredMoves[0] : null;

                    if (move) {
                        log(`Decision: Playing move at (${move.x}, ${move.y})`);
                        log(`Move score: ${move.score.toFixed(2)}, Reason: ${move.reason}`);
                        if (move.score < 0) {
                            log(`Note: Best move is below neutral (${move.score.toFixed(2)}), taking it to avoid an early pass.`);
                        }
                        if (move.metadata) {
                            const meta = move.metadata;
                            const territoryLabel = meta.territorySymbol ?? "-";
                            log(
                                `Move analysis: libsBefore=${meta.friendlyLibertiesBefore}, libsAfter=${meta.friendlyLibertiesAfter}, Δlibs=${meta.libertyGain}, captureChance=${meta.potentialCaptureCount}, enemyLibDrop=${meta.enemyLibertyReduction}, prepAtari=${meta.prepAtariChains}, adjFriendly=${meta.adjacentFriendly}, adjEnemy=${meta.adjacentEnemy}, territory='${territoryLabel}'${typeof meta.focusOverlap === 'number' && meta.focusOverlap > 0 ? `, focusOverlap=${meta.focusOverlap}` : ''}`
                            );
                            if (meta.deepInvasionRisk) {
                                log("Warning: Move flagged as deep invasion with limited support.");
                            }

                            if (meta.enemyLibertyReduction > 0) {
                                perGameStats.enemyLibDrops += meta.enemyLibertyReduction;
                                sessionStats.totalEnemyLibDrops += meta.enemyLibertyReduction;
                            }
                            if (meta.prepAtariChains > 0) {
                                perGameStats.prepAtari += meta.prepAtariChains;
                                sessionStats.totalPrepAtari += meta.prepAtariChains;
                            }
                            if (meta.potentialCaptureCount > 0) {
                                perGameStats.captureChances += meta.potentialCaptureCount;
                                sessionStats.totalCaptureChances += meta.potentialCaptureCount;
                            }
                            if (meta.deepInvasionRisk) {
                                perGameStats.riskyInvades++;
                                sessionStats.totalRiskyInvades++;
                            }
                        }
                        log(`Top 5 moves considered:`);

                        // Log top moves for analysis
                        for (let i = 0; i < Math.min(5, scoredMoves.length); i++) {
                            const m = scoredMoves[i];
                            log(`  ${i + 1}. (${m.x},${m.y}) = ${m.score.toFixed(2)} - ${m.reason}`);
                        }

                        try {
                            // Update attack focus based on chosen move (target chains with <=2 libs reduced by this move)
                            try {
                                const chainsNow = analysisCache.chains ?? ns.go.analysis.getChains();
                                const boardNow = analysisCache.boardState ?? ns.go.getBoardState();
                                const chainInfoNow = buildChainInfo(boardNow, chainsNow);
                                if (move?.metadata) {
                                    const targeted = new Set();
                                    for (const id of (move.metadata.targetEnemyChains || [])) {
                                        const info = chainInfoNow.get(id);
                                        if (info && info.owner === 'O' && info.liberties.size <= 2) targeted.add(id);
                                    }
                                    if (targeted.size > 0 && (move.metadata.enemyLibertyReduction > 0 || move.metadata.potentialCaptureCount > 0 || move.metadata.prepAtariChains > 0)) {
                                        attackFocus.ids = targeted;
                                        attackFocus.ttl = 2;
                                        log(`Attack focus set on chains: [${[...targeted].join(', ')}] (ttl=${attackFocus.ttl})`);
                                    } else if (attackFocus.ttl > 0) {
                                        attackFocus.ttl -= 1;
                                        if (attackFocus.ttl === 0) {
                                            attackFocus.ids.clear();
                                            log("Attack focus expired");
                                        }
                                    }
                                }
                            } catch {}

                            const result = await ns.go.makeMove(move.x, move.y);
                            log("Move executed successfully");
                            logCaptureDetails(result, perGameStats);
                            logScoreDelta(gameState, "After resolving our move");
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
                                logCaptureDetails(fallbackResult, perGameStats);
                                logScoreDelta(gameState, "After fallback pass");
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
                        // No moves above threshold: attempt safe-aggression fallback before passing
                        const allScored = getAllScoredMoves(ns, boardState, validMoves, CONFIG, analysisCache, {
                            scoreDiff: (gameState.blackScore || 0) - (gameState.whiteScore || 0),
                            pressureTargets,
                            attackFocus: attackFocus.ids
                        }, true);
                        // Prefer moves that either attack or create liberties, and avoid deep suicidal invasions
                        const safeAggressive = allScored.filter(m => isTacticalCandidate(m, (gameState.blackScore || 0) - (gameState.whiteScore || 0)));
                        const fallbackMove = (safeAggressive[0] || allScored[0]) || null;
                        if (fallbackMove) {
                            log("Fallback: playing best available move to avoid pass");
                            log(`Decision: Playing move at (${fallbackMove.x}, ${fallbackMove.y})`);
                            log(`Move score: ${fallbackMove.score.toFixed(2)}, Reason: ${fallbackMove.reason}`);
                            try {
                                const result = await ns.go.makeMove(fallbackMove.x, fallbackMove.y);
                                log("Move executed successfully");
                                logCaptureDetails(result, perGameStats);
                                logScoreDelta(gameState, "After fallback move");
                                if (result?.type === "gameOver") {
                                    log("Game ended immediately after fallback move");
                                    break;
                                }
                                if (result?.type === "pass") {
                                    opponentPassedLastTurn = true;
                                    log("Opponent passed in response to fallback move");
                                } else if (result?.type === "move") {
                                    opponentPassedLastTurn = false;
                                    log(`Opponent responded with move at (${result.x}, ${result.y})`);
                                }
                            } catch (error) {
                                log(`ERROR making fallback move: ${error.message}`);
                                // Pass only if fallback also fails
                                try {
                                    const result = await ns.go.passTurn();
                                    opponentPassedLastTurn = result?.type === "pass";
                                    logCaptureDetails(result, perGameStats);
                                    logScoreDelta(gameState, "After forced pass");
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
                                } catch (error2) {
                                    log(`ERROR passing turn: ${error2.message}`);
                                    break;
                                }
                            }
                        } else {
                            log("Decision: No valid moves found, passing");
                            try {
                                const result = await ns.go.passTurn();
                                opponentPassedLastTurn = result?.type === "pass";
                                logCaptureDetails(result, perGameStats);
                                logScoreDelta(gameState, "After forced pass");
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

            log(
                `Pressure summary: enemyLibDrops=${perGameStats.enemyLibDrops}, prepAtari=${perGameStats.prepAtari}, captureChances=${perGameStats.captureChances}, riskyInvades=${perGameStats.riskyInvades}`
            );
            if (perGameStats.capturesCompleted || perGameStats.capturedStones) {
                log(`Capture conversion: captures=${perGameStats.capturesCompleted || 0}, stones=${perGameStats.capturedStones || 0}`);
                if (perGameStats.captureChances > 0) {
                    const rate = ((perGameStats.capturesCompleted || 0) / perGameStats.captureChances) * 100;
                    log(`Capture conversion rate: ${rate.toFixed(1)}%`);
                }
            }

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

        log(
            `Liberty pressure totals: enemyLibDrops=${sessionStats.totalEnemyLibDrops}, prepAtari=${sessionStats.totalPrepAtari}, captureChances=${sessionStats.totalCaptureChances}, riskyInvades=${sessionStats.totalRiskyInvades}`
        );
        if (sessionStats.totalCapturesCompleted || sessionStats.totalCapturedStones) {
            log(`Captures total: captures=${sessionStats.totalCapturesCompleted || 0}, stones=${sessionStats.totalCapturedStones || 0}`);
            if (sessionStats.totalCaptureChances > 0) {
                const rate = (sessionStats.totalCapturesCompleted / sessionStats.totalCaptureChances) * 100;
                log(`Session capture conversion rate: ${rate.toFixed(1)}%`);
            }
        }

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

    function checkShouldPass(
        gameState,
        moveCount,
        boardSize,
        opponentPassedLastTurn = false,
        analysisCache = {}
    ) {
        const blackScore = gameState.blackScore || 0;
        const whiteScore = gameState.whiteScore || 0;
        const scoreDiff = blackScore - whiteScore;
        const passThreshold = boardSize * 0.5;

        // CRITICAL: Check board state before passing
        const boardState = analysisCache.boardState ?? ns.go.getBoardState();
        const liberties = analysisCache.liberties ?? ns.go.analysis.getLiberties();

        // Check if we have any groups in danger (1-2 liberties)
        let hasWeakGroups = false;
        let hasEnemyWeakGroups = false;

        for (let x = 0; x < boardSize; x++) {
            for (let y = 0; y < boardSize; y++) {
                const liberty = liberties?.[x]?.[y] ?? 0;
                const point = boardState?.[x]?.[y];
                if (point === "X" && liberty > 0 && liberty <= 2) {
                    hasWeakGroups = true;
                }
                if (point === "O" && liberty > 0 && liberty <= 2) {
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
                    const liberty = liberties?.[x]?.[y] ?? 0;
                    if (boardState?.[x]?.[y] === "X" && liberty === 1) {
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

    function getAllScoredMoves(ns, boardState, validMoves, config, analysisCache = {}, context = {}, includeBelowMin = false) {
        if (!Array.isArray(boardState) || boardState.length === 0 || !Array.isArray(validMoves)) {
            return [];
        }

        const moves = [];
        const boardSize = boardState.length;

        const chains = analysisCache.chains ?? ns.go.analysis.getChains();
        const liberties = analysisCache.liberties ?? ns.go.analysis.getLiberties();
        const territoryMap = analysisCache.territoryMap ?? ns.go.analysis.getControlledEmptyNodes();
        const chainInfo = buildChainInfo(boardState, chains);

        for (let x = 0; x < boardSize; x++) {
            for (let y = 0; y < boardSize; y++) {
                if (validMoves?.[x]?.[y]) {
                    const evaluation = evaluateMove(
                        x,
                        y,
                        boardState,
                        chains,
                        liberties,
                        boardSize,
                        config,
                        territoryMap,
                        chainInfo,
                        context
                    );
                    if (evaluation && (evaluation.score >= config.MIN_MOVE_SCORE || includeBelowMin)) {
                        const reason = resolveMoveReason(evaluation.reasonKey, evaluation.score);
                        moves.push({
                            x: x,
                            y: y,
                            score: evaluation.score,
                            reason,
                            reasonKey: evaluation.reasonKey,
                            metadata: evaluation.metadata
                        });
                    }
                }
            }
        }

        moves.sort((a, b) => b.score - a.score);
        return moves;
    }

    function evaluateMove(
        x,
        y,
        boardState,
        chains,
        liberties,
        boardSize,
        config,
        territoryMap,
        chainInfo,
        context = {}
    ) {
        let score = 0;
        const moveKey = coordKey(x, y);
        const contributions = new Map();
        const metadata = {
            adjacentFriendly: 0,
            adjacentEnemy: 0,
            adjacentEmpty: 0,
            friendlyLibertiesBefore: 0,
            friendlyLibertiesAfter: 0,
            libertyGain: 0,
            potentialCaptureCount: 0,
            closestFriendlyDistance: Infinity,
            territorySymbol: territoryMap ? getTerritorySymbol(territoryMap, x, y) : null,
            selfAtari: false,
            deepInvasionRisk: false,
            enemyLibertyReduction: 0,
            prepAtariChains: 0,
            targetEnemyChains: []
        };
        const scoreDiff = context.scoreDiff ?? 0;
        const pressureTargets = context.pressureTargets || new Set();
        const attackFocus = context.attackFocus || new Set();

        const adjustScore = (amount, key = null) => {
            score += amount;
            if (amount > 0 && key) {
                contributions.set(key, (contributions.get(key) || 0) + amount);
            }
        };

        // Count total stones on board to determine game phase
        let totalStones = 0;
        for (let i = 0; i < boardSize; i++) {
            for (let j = 0; j < boardSize; j++) {
                const point = boardState?.[i]?.[j];
                if (point === "X" || point === "O") {
                    totalStones++;
                }
                if (point === "X") {
                    const dist = Math.abs(i - x) + Math.abs(j - y);
                    if (dist < metadata.closestFriendlyDistance) {
                        metadata.closestFriendlyDistance = dist;
                    }
                }
            }
        }
    const isOpening = totalStones < boardSize * 2;
    const defenseScale = isOpening ? config.OPENING_DEFENSE_SCALE : 1;
    const boardArea = boardSize * boardSize;
    const lateGame = totalStones >= boardArea * 0.6;

        if (
            isOpening &&
            totalStones < (config.OPENING_SPACING_THRESHOLD ?? boardSize) &&
            metadata.closestFriendlyDistance < Infinity
        ) {
            if (metadata.closestFriendlyDistance <= 1) {
                score -= config.OPENING_SPACING_PENALTY;
            } else if (metadata.closestFriendlyDistance === 2) {
                score -= Math.floor(config.OPENING_SPACING_PENALTY * 0.6);
            } else if (metadata.closestFriendlyDistance === 3) {
                score -= Math.floor(config.OPENING_SPACING_PENALTY * 0.3);
            }
        }

        // Analyze adjacent points
        const adjacentEnemyChains = new Set();
        const adjacentFriendlyChains = new Set();
        const adjacentEmptyCoords = new Set();
        let minAdjacentEnemyLiberties = Infinity;
        let minAdjacentFriendlyLiberties = Infinity;

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                const point = boardState?.[nx]?.[ny];
                const chainId = chains?.[nx]?.[ny];
                if (point === ".") {
                    metadata.adjacentEmpty++;
                    adjacentEmptyCoords.add(coordKey(nx, ny));
                } else if (point === "O") {
                    metadata.adjacentEnemy++;
                    if (chainId !== null && chainId !== undefined) {
                        adjacentEnemyChains.add(chainId);
                        const enemyLibs = liberties?.[nx]?.[ny];
                        if (enemyLibs > 0) {
                            minAdjacentEnemyLiberties = Math.min(minAdjacentEnemyLiberties, enemyLibs);
                        }
                    }
                } else if (point === "X") {
                    metadata.adjacentFriendly++;
                    if (chainId !== null && chainId !== undefined) {
                        adjacentFriendlyChains.add(chainId);
                        const friendlyLibs = liberties?.[nx]?.[ny];
                        if (friendlyLibs > 0) {
                            minAdjacentFriendlyLiberties = Math.min(
                                minAdjacentFriendlyLiberties,
                                friendlyLibs
                            );
                        }
                    }
                }
            }
        }

        if (adjacentFriendlyChains.size === 0) {
            minAdjacentFriendlyLiberties = Infinity;
        }
        if (adjacentEnemyChains.size === 0) {
            minAdjacentEnemyLiberties = Infinity;
        }

        // Enhanced liberty estimation using chain info
        const friendlyLibertySet = new Set();
        if (chainInfo) {
            for (const chainId of adjacentFriendlyChains) {
                const info = chainInfo.get(chainId);
                if (!info) continue;
                minAdjacentFriendlyLiberties = Math.min(
                    minAdjacentFriendlyLiberties,
                    info.liberties.size
                );
                for (const lib of info.liberties) {
                    if (lib !== moveKey) {
                        friendlyLibertySet.add(lib);
                    }
                }
            }
        }

        metadata.friendlyLibertiesBefore = friendlyLibertySet.size;

        const friendlyLibertySetAfter = new Set(friendlyLibertySet);
        for (const coord of adjacentEmptyCoords) {
            friendlyLibertySetAfter.add(coord);
        }

        let potentialCaptureCount = 0;
        const captureLibertyBoost = new Set();
        let enemyLibertyReduction = 0;
        let prepAtariChains = 0;

        if (chainInfo) {
            for (const chainId of adjacentEnemyChains) {
                const info = chainInfo.get(chainId);
                if (!info) continue;
                const enemyLibCount = info.liberties.size;
                minAdjacentEnemyLiberties = Math.min(minAdjacentEnemyLiberties, enemyLibCount);

                if (info.liberties.has(moveKey)) {
                    enemyLibertyReduction++;
                    if (enemyLibCount === 2) {
                        prepAtariChains++;
                    }
                }

                if (enemyLibCount === 1 && info.liberties.has(moveKey)) {
                    potentialCaptureCount += info.stones.size;
                    for (const stone of info.stones) {
                        if (stone !== moveKey) {
                            captureLibertyBoost.add(stone);
                        }
                    }
                }

                // Track targeted enemy chains if this move reduces their liberties
                if (info.liberties.has(moveKey)) {
                    metadata.targetEnemyChains.push(chainId);
                }
            }
        }

    metadata.enemyLibertyReduction = enemyLibertyReduction;
        metadata.prepAtariChains = prepAtariChains;

        for (const coord of captureLibertyBoost) {
            friendlyLibertySetAfter.add(coord);
        }

        metadata.potentialCaptureCount = potentialCaptureCount;
        metadata.friendlyLibertiesAfter = friendlyLibertySetAfter.size || adjacentEmptyCoords.size;
        metadata.libertyGain = metadata.friendlyLibertiesAfter - metadata.friendlyLibertiesBefore;

        // Safety checks to avoid self-atari
        if (metadata.adjacentFriendly > 0) {
            if (metadata.friendlyLibertiesAfter <= 1) {
                score -= 500;
                metadata.selfAtari = true;
                return { score, reasonKey: "self-atari", metadata };
            }

            if (
                minAdjacentFriendlyLiberties <= 2 &&
                metadata.friendlyLibertiesAfter <= 2 &&
                metadata.libertyGain <= 0
            ) {
                score -= 300;
                metadata.selfAtari = true;
                return { score, reasonKey: "self-atari", metadata };
            }
        } else if (metadata.adjacentEmpty < 2 && potentialCaptureCount === 0) {
            // Isolated move with no room to breathe
            score -= 80;
        }

        // PRIORITY 1: Capture opportunities
        if (potentialCaptureCount > 0) {
            // Heavier capture weighting; further boost when trailing
            const deficitBoost = scoreDiff < -8 ? 1.35 : scoreDiff < -4 ? 1.15 : 1.0;
            adjustScore(Math.floor(110 * potentialCaptureCount * deficitBoost), "capture");
        } else if (minAdjacentEnemyLiberties === 1) {
            const deficitBoost = scoreDiff < -8 ? 1.4 : scoreDiff < -4 ? 1.2 : 1.0;
            adjustScore(Math.floor(70 * config.AGGRESSION_LEVEL * deficitBoost), "pressure");
        } else if (minAdjacentEnemyLiberties === 2) {
            const deficitBoost = scoreDiff < -8 ? 1.4 : scoreDiff < -4 ? 1.2 : 1.0;
            adjustScore(Math.floor(40 * config.AGGRESSION_LEVEL * deficitBoost), "pressure");
        }

        const aggressionScale = (config.AGGRESSION_LEVEL ?? 1) * (scoreDiff < -8 ? 1.5 : scoreDiff < -4 ? 1.2 : 1.0);
        if (metadata.enemyLibertyReduction > 0) {
            adjustScore(45 * aggressionScale * metadata.enemyLibertyReduction, "pressure");
        }
        if (metadata.prepAtariChains > 0) {
            const prepBase = 120 + Math.max(0, metadata.prepAtariChains - 1) * 35;
            adjustScore(prepBase * aggressionScale, "pressure");
        }

        // Follow-up priority: if this move is on a known pressure target liberty, reward it
        if (pressureTargets.size > 0 && pressureTargets.has(moveKey)) {
            adjustScore(60 * aggressionScale, "pressure");
        }
        // Keep attacking previously weakened chains
        if (attackFocus.size > 0) {
            let overlap = 0;
            for (const id of metadata.targetEnemyChains) {
                if (attackFocus.has(id)) overlap++;
            }
            if (overlap > 0) {
                adjustScore(40 * aggressionScale * overlap, "pressure");
            }
            metadata.focusOverlap = overlap;
        }

        // PRIORITY 2: Defend weak groups with real liberty gain
        if (minAdjacentFriendlyLiberties === 1 && metadata.friendlyLibertiesAfter >= 2) {
            adjustScore(220 * defenseScale, "save");
        } else if (
            minAdjacentFriendlyLiberties === 2 &&
            metadata.friendlyLibertiesAfter >= 3
        ) {
            adjustScore(110 * defenseScale, "defense");
        } else if (metadata.libertyGain > 0 && metadata.adjacentFriendly > 0) {
            adjustScore(35 * defenseScale * metadata.libertyGain, "defense");
        }

        // PRIORITY 3: Avoid weak shapes
        if (metadata.adjacentFriendly >= 3 && metadata.adjacentEmpty === 0 && metadata.adjacentEnemy === 0) {
            score -= 200;
        }

        // Base territory incentive
        if (metadata.adjacentEmpty > 0) {
            adjustScore(metadata.adjacentEmpty * 15 * config.TERRITORY_WEIGHT, "territory");
        }

        // Territory influence & invasion heuristics
        if (territoryMap) {
            let territoryScore = 0;
            let adjacentEnemyTerritory = false;

            const invadeBonus = config.TERRITORY_INVADE_BONUS ?? 0;
            const contestedBonus = config.TERRITORY_CONTESTED_BONUS ?? 0;
            const secureBonus = config.TERRITORY_SECURE_BONUS ?? 0;

            if (metadata.territorySymbol === "O") {
                territoryScore += invadeBonus;
            } else if (metadata.territorySymbol === "?") {
                territoryScore += contestedBonus;
            } else if (metadata.territorySymbol === "X") {
                territoryScore += Math.floor(secureBonus * 0.4);
            }

            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize) continue;
                const neighborSymbol = getTerritorySymbol(territoryMap, nx, ny);
                if (neighborSymbol === "O") {
                    territoryScore += Math.floor(invadeBonus * 0.5);
                    adjacentEnemyTerritory = true;
                } else if (neighborSymbol === "?") {
                    territoryScore += Math.floor(contestedBonus * 0.4);
                } else if (neighborSymbol === "X") {
                    territoryScore += Math.floor(secureBonus * 0.3);
                }
            }

            if (metadata.territorySymbol === "X" && !adjacentEnemyTerritory) {
                territoryScore -= config.TERRITORY_OVERCONCENTRATION_PENALTY ?? 0;
            }

            if (territoryScore > 0) {
                // When trailing, dampen secure territory and emphasize contested/invasion
                const deficitMult = scoreDiff < -8 ? 0.7 : scoreDiff < -4 ? 0.85 : 1.0;
                const territoryPhaseMultiplier = (isOpening ? 1 : lateGame ? 0.55 : 0.75) * deficitMult;
                territoryScore = Math.floor(territoryScore * territoryPhaseMultiplier);
                adjustScore(territoryScore, metadata.territorySymbol === "O" ? "invasion" : "territory");
            } else {
                score += territoryScore;
            }

            if (metadata.territorySymbol === "O" && potentialCaptureCount === 0) {
                const invasionLibs = metadata.friendlyLibertiesAfter;
                const enemyPressure = Math.max(metadata.adjacentEnemy, 1);
                // Relief clause: allow safe invasion if libs >=3 and we are trailing
                const allowSafeInvade = scoreDiff < -6 && invasionLibs >= 3;
                if (!allowSafeInvade && metadata.adjacentFriendly === 0 && invasionLibs <= 3) {
                    score -= 140 + enemyPressure * 35;
                    metadata.deepInvasionRisk = true;
                } else if (!allowSafeInvade && invasionLibs <= 2 && metadata.enemyLibertyReduction === 0) {
                    score -= 90 + enemyPressure * 25;
                    metadata.deepInvasionRisk = true;
                } else if (invasionLibs <= 3 && metadata.enemyLibertyReduction === 0) {
                    score -= 45 + enemyPressure * 20;
                }
            }
        }

        if (
            metadata.adjacentEnemy >= 2 &&
            metadata.enemyLibertyReduction === 0 &&
            potentialCaptureCount === 0 &&
            metadata.friendlyLibertiesAfter <= 2
        ) {
            score -= 80 + metadata.adjacentEnemy * 25;
            if (metadata.adjacentFriendly === 0) {
                metadata.deepInvasionRisk = true;
            }
        }

        // Eye making and preservation
        let potentialEyeSpaces = 0;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (
                nx >= 0 &&
                nx < boardSize &&
                ny >= 0 &&
                ny < boardSize &&
                boardState?.[nx]?.[ny] === "."
            ) {
                let surroundedByUs = 0;
                let totalNeighbors = 0;
                for (const [dx2, dy2] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    const nnx = nx + dx2;
                    const nny = ny + dy2;
                    if (nnx >= 0 && nnx < boardSize && nny >= 0 && nny < boardSize) {
                        totalNeighbors++;
                        if (boardState?.[nnx]?.[nny] === "X" || (nnx === x && nny === y)) {
                            surroundedByUs++;
                        }
                    }
                }
                if (surroundedByUs >= totalNeighbors - 1) {
                    potentialEyeSpaces++;
                }
            }
        }

        if (potentialEyeSpaces >= 2) {
            adjustScore(50, "eyes");
        } else if (potentialEyeSpaces === 1) {
            adjustScore(25, "eyes");
        }

        if (metadata.adjacentEnemy >= 2 && metadata.adjacentEmpty >= 2) {
            adjustScore(35, "invasion");
        } else if (metadata.adjacentEnemy === 1 && metadata.adjacentEmpty >= 3) {
            adjustScore(20, "pressure");
        }

        // Connectivity and shape
        let connectsWeakGroups = false;
        if (metadata.adjacentFriendly >= 2 && adjacentFriendlyChains.size >= 2) {
            for (const chainId of adjacentFriendlyChains) {
                const info = chainInfo?.get(chainId);
                if (!info) continue;
                if (info.liberties.size <= 3) {
                    connectsWeakGroups = true;
                    break;
                }
            }
        }

        if (connectsWeakGroups) {
            const connectMult = scoreDiff < -6 ? 1.25 : scoreDiff < -3 ? 1.1 : 1.0;
            adjustScore(Math.floor(140 * defenseScale * connectMult), "connect");
        } else if (metadata.adjacentFriendly === 1) {
            adjustScore(25 * defenseScale, "shape");
        } else if (metadata.adjacentFriendly === 2) {
            adjustScore(40 * defenseScale, "shape");
        } else if (metadata.adjacentFriendly >= 3) {
            adjustScore(15 * defenseScale, "shape");
        }

        // Opening strategy influence
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

            if (totalStones < 4) {
                if (isCornerAnchor) {
                    adjustScore(config.OPENING_CORNER_BONUS, "opening");
                } else if (isSideAnchor) {
                    adjustScore(config.OPENING_SIDE_BONUS, "opening");
                } else if (isCenter) {
                    adjustScore(Math.max(config.OPENING_SIDE_BONUS - 6, 24), "opening");
                } else if (minEdgeDistanceX === 0 || minEdgeDistanceY === 0) {
                    adjustScore(Math.max(Math.floor(config.OPENING_SIDE_BONUS * 0.4), 12), "opening");
                } else {
                    adjustScore(Math.max(Math.floor(config.OPENING_SIDE_BONUS * 0.6), 18), "opening");
                }
            } else if (totalStones < boardSize * 2) {
                adjustScore(Math.max(0, boardSize - distanceFromCenter) * 5, "opening");

                let extensionBonus = 0;
                for (let dx = -4; dx <= 4; dx++) {
                    for (let dy = -4; dy <= 4; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                            if (boardState?.[nx]?.[ny] === "X") {
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
                if (extensionBonus > 0) {
                    adjustScore(extensionBonus, "opening");
                }
            }
        } else {
            const centerX = Math.floor(boardSize / 2);
            const centerY = Math.floor(boardSize / 2);
            const distanceFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
            adjustScore(Math.max(0, boardSize - distanceFromCenter) * 4, "influence");
        }

        // Enemy pressure multiplier for aggression
        if (metadata.adjacentEnemy > 0) {
            adjustScore(metadata.adjacentEnemy * 20 * aggressionScale, "pressure");
        }

        let primaryReasonKey = null;
        let primaryReasonValue = -Infinity;
        for (const [key, value] of contributions.entries()) {
            if (value > primaryReasonValue) {
                primaryReasonValue = value;
                primaryReasonKey = key;
            }
        }

        if (!primaryReasonKey) {
            if (potentialCaptureCount > 0) {
                primaryReasonKey = "capture";
            } else if (metadata.libertyGain > 0) {
                primaryReasonKey = "defense";
            } else if (metadata.territorySymbol === "O") {
                primaryReasonKey = "invasion";
            } else if (metadata.adjacentFriendly > 0) {
                primaryReasonKey = "shape";
            } else {
                primaryReasonKey = "development";
            }
        }

        return {
            score,
            reasonKey: primaryReasonKey,
            metadata
        };
    }

    function resolveMoveReason(reasonKey, score) {
        const reasonLabels = {
            capture: "Capturing enemy stones!",
            pressure: "Pressuring weak enemy group",
            save: "Saving group from capture!",
            defense: "Defending weak group",
            connect: "Connecting weak groups",
            territory: "Territory expansion",
            invasion: "Invading enemy territory",
            eyes: "Securing eye space",
            shape: "Building good shape",
            opening: "Opening development",
            influence: "Building influence",
            development: "Development",
            "self-atari": "Avoiding self-atari"
        };

        if (reasonKey && reasonLabels[reasonKey]) {
            return reasonLabels[reasonKey];
        }

        if (score >= 200) return "Game-changing move";
        if (score >= 150) return "High impact play";
        if (score >= 80) return "Strong follow-up";
        if (score >= 60) return "Strategic reinforcement";
        if (score >= 30) return "Territory expansion";
        if (score >= 20) return "Good shape";
        return "Development";
    }
}
