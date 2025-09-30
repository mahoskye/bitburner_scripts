/** @param {NS} ns */
export async function main(ns) {
    if (!ns.go) {
        ns.tprint("Go API not available");
        return;
    }

    ns.tprint("=== GO DEBUG ===");

    try {
        // Check current game state
        const gameState = ns.go.getGameState();
        ns.tprint(`Game State:`)
        ns.tprint(`  Current Player: ${gameState.currentPlayer}`);
        ns.tprint(`  Score: Black ${gameState.score?.Black || 'N/A'}, White ${gameState.score?.White || 'N/A'}`);
        ns.tprint(`  Moves: ${gameState.moves || 'N/A'}`);

        // Check board state
        const boardState = ns.go.getBoardState();
        ns.tprint(`\nBoard State (${boardState.length}x${boardState[0].length}):`);
        for (let y = boardState[0].length - 1; y >= 0; y--) {
            let row = "";
            for (let x = 0; x < boardState.length; x++) {
                row += boardState[x][y];
            }
            ns.tprint(`  ${row}`);
        }

        // Try to make a simple move to test the API
        ns.tprint(`\nTesting move API...`);
        const validMoves = ns.go.analysis.getValidMoves();

        let foundValidMove = false;
        for (let x = 0; x < validMoves.length && !foundValidMove; x++) {
            for (let y = 0; y < validMoves[x].length && !foundValidMove; y++) {
                if (validMoves[x][y]) {
                    ns.tprint(`Found valid move at (${x}, ${y})`);
                    foundValidMove = true;

                    // Try to make the move
                    try {
                        await ns.go.makeMove(x, y);
                        ns.tprint(`✅ Successfully made move at (${x}, ${y})`);

                        // Check new game state
                        const newGameState = ns.go.getGameState();
                        ns.tprint(`New current player: ${newGameState.currentPlayer}`);

                    } catch (moveError) {
                        ns.tprint(`❌ Failed to make move: ${moveError.message}`);
                    }
                }
            }
        }

        if (!foundValidMove) {
            ns.tprint("No valid moves found - game might be over");
        }

    } catch (error) {
        ns.tprint(`Error in debug: ${error.message}`);
    }
}