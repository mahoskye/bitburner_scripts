/** @param {NS} ns */
export async function main(ns) {
    if (!ns.go) {
        ns.tprint("Go API not available");
        return;
    }

    ns.tprint("=== GO STATISTICS ===");

    try {
        const stats = ns.go.analysis.getStats();

        if (Object.keys(stats).length === 0) {
            ns.tprint("No games recorded yet");
            return;
        }

        for (const [opponent, data] of Object.entries(stats)) {
            ns.tprint(`\n${opponent}:`);
            ns.tprint(`  Wins: ${data.wins}`);
            ns.tprint(`  Losses: ${data.losses}`);
            ns.tprint(`  Win Streak: ${data.winStreak}`);
            ns.tprint(`  Highest Win Streak: ${data.highestWinStreak}`);
            ns.tprint(`  Favor: ${data.favor.toFixed(2)}`);
            ns.tprint(`  Bonus: ${data.bonusPercent.toFixed(1)}% - ${data.bonusDescription}`);

            const totalGames = data.wins + data.losses;
            const winRate = totalGames > 0 ? (data.wins / totalGames * 100).toFixed(1) : "0.0";
            ns.tprint(`  Win Rate: ${winRate}%`);
        }

    } catch (error) {
        ns.tprint(`Error getting stats: ${error.message}`);
    }
}