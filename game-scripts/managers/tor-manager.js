/** @param {NS} ns */
export async function main(ns) {
    const CONFIG = {
        PROGRAMS: [
            { name: "BruteSSH.exe", cost: 500_000, priority: 1 },
            { name: "FTPCrack.exe", cost: 1_500_000, priority: 2 },
            { name: "relaySMTP.exe", cost: 5_000_000, priority: 3 },
            { name: "HTTPWorm.exe", cost: 30_000_000, priority: 4 },
            { name: "SQLInject.exe", cost: 250_000_000, priority: 5 },
            { name: "ServerProfiler.exe", cost: 500_000, priority: 6 },
            { name: "DeepscanV1.exe", cost: 500_000, priority: 7 },
            { name: "AutoLink.exe", cost: 1_000_000, priority: 8 }
        ],
        TOR_COST: 200_000,
        MONEY_BUFFER: 100_000 // Keep this much money as buffer
    };

    ns.disableLog("sleep");

    let purchasedSomething = false;

    // Check if we have TOR router
    const player = ns.getPlayer();
    if (!player.tor) {
        const currentMoney = ns.getServerMoneyAvailable("home");
        if (currentMoney >= CONFIG.TOR_COST + CONFIG.MONEY_BUFFER) {
            // Try to purchase via Singularity API if available
            try {
                if (ns.singularity && typeof ns.singularity.purchaseTor === 'function') {
                    if (ns.singularity.purchaseTor()) {
                        ns.print(`SUCCESS: Purchased TOR router for $${CONFIG.TOR_COST.toLocaleString()}`);
                        purchasedSomething = true;
                    } else {
                        ns.print("ERROR: Failed to purchase TOR router via API");
                    }
                } else {
                    throw new Error("Singularity API not available");
                }
            } catch (error) {
                // Fallback: manual purchase instructions
                ns.print(`You have $${currentMoney.toLocaleString()}, enough to buy TOR router ($${CONFIG.TOR_COST.toLocaleString()})`);
                ns.print("Singularity API not available - Go to City -> Alpha Enterprises -> Purchase TOR Router");
                ns.tprint("NOTICE: You can afford the TOR router! Go to City -> Alpha Enterprises to purchase it.");
            }
        } else {
            ns.print(`Need $${(CONFIG.TOR_COST + CONFIG.MONEY_BUFFER - currentMoney).toLocaleString()} more for TOR router`);
        }
        return purchasedSomething;
    }

    // TOR router exists, check for programs
    const ownedPrograms = ns.ls("home", ".exe");

    // Sort programs by priority and filter out owned ones
    const neededPrograms = CONFIG.PROGRAMS
        .filter(program => !ownedPrograms.includes(program.name))
        .sort((a, b) => a.priority - b.priority);

    if (neededPrograms.length === 0) {
        ns.print("All essential programs already owned");
        return false;
    }

    const currentMoney = ns.getServerMoneyAvailable("home");

    // Try to buy the highest priority affordable program
    for (const program of neededPrograms) {
        if (currentMoney >= program.cost + CONFIG.MONEY_BUFFER) {
            let purchaseSuccess = false;

            // Try Singularity API first, fallback to regular API
            try {
                if (ns.singularity && typeof ns.singularity.purchaseProgram === 'function') {
                    purchaseSuccess = ns.singularity.purchaseProgram(program.name);
                } else if (typeof ns.purchaseProgram === 'function') {
                    purchaseSuccess = ns.purchaseProgram(program.name);
                } else {
                    throw new Error("No purchase API available");
                }
            } catch (error) {
                ns.print(`ERROR: Cannot purchase ${program.name} - ${error.message}`);
                ns.print("Manual purchase required: Go to Terminal -> 'buy' command");
                break;
            }

            if (purchaseSuccess) {
                ns.print(`SUCCESS: Purchased ${program.name} for $${program.cost.toLocaleString()}`);
                purchasedSomething = true;
                break;
            } else {
                ns.print(`ERROR: Failed to purchase ${program.name} (purchase failed)`);
            }
        } else {
            ns.print(`Next program: ${program.name} (need $${(program.cost + CONFIG.MONEY_BUFFER - currentMoney).toLocaleString()} more)`);
            break;
        }
    }

    // Display current status
    const owned = CONFIG.PROGRAMS.filter(p => ownedPrograms.includes(p.name));
    const missing = CONFIG.PROGRAMS.filter(p => !ownedPrograms.includes(p.name));

    if (owned.length > 0) {
        ns.print(`Owned programs: ${owned.map(p => p.name).join(", ")}`);
    }
    if (missing.length > 0) {
        ns.print(`Missing programs: ${missing.map(p => p.name).join(", ")}`);
    }

    return purchasedSomething;
}