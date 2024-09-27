/** @param {NS} ns */
export async function main(ns) {
    // Configuration
    const CONFIG = {
        SCRIPTS: {
            HACKNET: "hacknet-farm.js",
            PURCHASE_SERVER: "purchase-server-manager.js",
            HACK_MANAGER: "hack-manager.js",
            SERVER_DISCOVERY: "server-discovery.js",
            PORT_MONITOR: "port-monitor.js",
        },
        FILES: {
            SERVER_LIST: "/servers/server_info.txt",
        },
        PORTS: {
            WORKER: 1,
        },
        INTERVALS: {
            HACK_LEVEL: 50,
            MAIN_LOOP: 10000, // 10 seconds
        },
        TARGETS: {
            DEFAULT: "n00dles",
        },
    };

    ns.disableLog("sleep");
    ns.disableLog("exec");

    // Check and run startup scripts
    await checkAndRunScript(CONFIG.SCRIPTS.HACKNET, "Initialized Hacknet farm");
    await checkAndRunScript(CONFIG.SCRIPTS.PURCHASE_SERVER, "Initialized Purchase Server Manager");
    await checkAndRunScript(CONFIG.SCRIPTS.PORT_MONITOR, "Started Port Monitor");

    // Initial run of Hack Manager
    await runHackManager();
    ns.print("Completed initial Hack Manager run");

    let lastHackLevel = Math.floor(ns.getHackingLevel() / CONFIG.INTERVALS.HACK_LEVEL) * CONFIG.INTERVALS.HACK_LEVEL;

    while (true) {
        // Check if it's time to run Hack Manager again
        const currentHackLevel = ns.getHackingLevel();
        if (
            Math.floor(currentHackLevel / CONFIG.INTERVALS.HACK_LEVEL) >
            Math.floor(lastHackLevel / CONFIG.INTERVALS.HACK_LEVEL)
        ) {
            await runHackManager();
            lastHackLevel = Math.floor(currentHackLevel / CONFIG.INTERVALS.HACK_LEVEL) * CONFIG.INTERVALS.HACK_LEVEL;
            ns.print(`Ran Hack Manager at hack level ${lastHackLevel}`);
        }

        // Run server discovery
        await runServerDiscovery();

        // Update best target
        updateBestTarget(ns);

        // Wait before next check
        await ns.sleep(CONFIG.INTERVALS.MAIN_LOOP);
    }

    async function checkAndRunScript(scriptName, successMessage) {
        if (ns.fileExists(scriptName, "home")) {
            const pid = ns.exec(scriptName, "home");
            if (pid !== 0) {
                ns.print(successMessage);
            } else {
                ns.print(`Failed to execute ${scriptName}`);
            }
        } else {
            ns.print(`ERROR: ${scriptName} not found`);
        }
    }

    async function runHackManager() {
        await checkAndRunScript(CONFIG.SCRIPTS.HACK_MANAGER, "Running Hack Manager");
    }

    async function runServerDiscovery() {
        await checkAndRunScript(CONFIG.SCRIPTS.SERVER_DISCOVERY, "Running Server Discovery");
        await ns.sleep(1000); // Give some time for the discovery to complete
    }

    function updateBestTarget(ns) {
        try {
            if (!ns.fileExists(CONFIG.FILES.SERVER_LIST)) {
                throw new Error(`${CONFIG.FILES.SERVER_LIST} not found`);
            }

            const serverData = JSON.parse(ns.read(CONFIG.FILES.SERVER_LIST));
            if (!Array.isArray(serverData)) {
                throw new Error("Invalid server data format");
            }

            let bestTarget = null;
            let highestScore = -1;

            const playerHackingLevel = ns.getHackingLevel();

            for (const server of serverData) {
                if (server.hasRootAccess && server.maxMoney > 0 && server.requiredHackingSkill <= playerHackingLevel) {
                    const score = server.maxMoney / server.minSecurityLevel;
                    if (score > highestScore) {
                        highestScore = score;
                        bestTarget = server;
                    }
                }
            }

            if (bestTarget) {
                ns.writePort(CONFIG.PORTS.WORKER, bestTarget.hostname);
                ns.print(`Updated best target: ${bestTarget.hostname} (Score: ${highestScore.toFixed(2)})`);
            } else {
                ns.writePort(CONFIG.PORTS.WORKER, CONFIG.TARGETS.DEFAULT);
                ns.print(`No suitable target found. Defaulting to ${CONFIG.TARGETS.DEFAULT}`);
            }
        } catch (error) {
            ns.print(`Error updating best target: ${error.message}`);
            ns.writePort(CONFIG.PORTS.WORKER, CONFIG.TARGETS.DEFAULT);
        }
    }
}
