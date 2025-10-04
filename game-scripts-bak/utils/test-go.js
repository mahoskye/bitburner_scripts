/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== GO API TEST ===");

    // Test if Go API exists
    if (!ns.go) {
        ns.tprint("❌ Go API not available");
        return;
    }

    ns.tprint("✅ Go API available");

    try {
        // Test basic functions
        const gameState = ns.go.getGameState();
        ns.tprint(`Current player: ${gameState.currentPlayer}`);

        const boardState = ns.go.getBoardState();
        ns.tprint(`Board size: ${boardState.length}x${boardState[0].length}`);

        const opponent = ns.go.getOpponent();
        ns.tprint(`Current opponent: ${opponent}`);

        const stats = ns.go.analysis.getStats();
        ns.tprint(`Stats available for ${Object.keys(stats).length} opponents`);

    } catch (error) {
        ns.tprint(`❌ Error testing Go API: ${error.message}`);
    }
}