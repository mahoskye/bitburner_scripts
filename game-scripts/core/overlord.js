/** @param {NS} ns */
export async function main(ns) {
    // Configuration
    const CONFIG = {
        SCRIPTS: {
            HACKNET: "managers/hacknet-farm.js",
            PURCHASE_SERVER: "managers/purchase-server-manager.js",
            HACK_MANAGER: "managers/hack-manager.js",
            SERVER_DISCOVERY: "discovery/server-discovery.js",
            PORT_MONITOR: "monitoring/port-monitor.js",
            TOR_MANAGER: "managers/tor-manager.js",
            CONTRACT_SOLVER: "managers/contract-solver.js",
            AUGMENTATION_PLANNER: "managers/augmentation-planner.js",
            STAT_GRINDER: "managers/stat-grinder.js",
            GO_PLAYER: "managers/go-player.js",
        },
        FILES: {
            SERVER_LIST: "/servers/server_info.txt",
        },
        PORTS: {
            WORKER: 1,
            STATUS: 2, // Port for status updates
            AUGMENTATION: 3, // Port for augmentation planning data
        },
        INTERVALS: {
            HACK_LEVEL: 50,
            MAIN_LOOP: 10000, // 10 seconds
        },
        getDiscoveryInterval() {
            const hackLevel = ns.getHackingLevel();
            // Scale from 30 seconds (early) to 10 minutes (late game)
            if (hackLevel < 50) return 30000;   // Every 30 seconds early game
            if (hackLevel < 200) return 120000; // Every 2 minutes mid-early
            if (hackLevel < 500) return 300000; // Every 5 minutes mid game
            return 600000;                      // Every 10 minutes late game
        },
        TARGETS: {
            DEFAULT: "n00dles",
        },
    };

    ns.disableLog("sleep");
    ns.disableLog("exec");

    // Check if server info file exists, if not run server discovery first
    if (!ns.fileExists(CONFIG.FILES.SERVER_LIST)) {
        ns.tprint("Server info file not found. Running server discovery first...");
        const discoveryPid = ns.exec(CONFIG.SCRIPTS.SERVER_DISCOVERY, "home");
        if (discoveryPid === 0) {
            ns.tprint(`ERROR: Could not run ${CONFIG.SCRIPTS.SERVER_DISCOVERY}`);
            ns.tprint(`Please run 'run ${CONFIG.SCRIPTS.SERVER_DISCOVERY}' manually first`);
            return;
        }

        // Wait for server discovery to complete
        while (ns.isRunning(discoveryPid)) {
            await ns.sleep(1000);
        }

        // Double-check the file was created
        if (!ns.fileExists(CONFIG.FILES.SERVER_LIST)) {
            ns.tprint(`ERROR: Server discovery completed but ${CONFIG.FILES.SERVER_LIST} was not created`);
            ns.tprint("Please check that the /servers/ directory exists and run server-discovery.js manually");
            return;
        }

        ns.tprint("Server discovery completed successfully!");
    }

    // Check and run startup scripts
    await checkAndRunScript(CONFIG.SCRIPTS.HACKNET, "Initialized Hacknet farm");
    await checkAndRunScript(CONFIG.SCRIPTS.PURCHASE_SERVER, "Initialized Purchase Server Manager");
    await checkAndRunScript(CONFIG.SCRIPTS.PORT_MONITOR, "Started Port Monitor");
    await checkAndRunScript(CONFIG.SCRIPTS.STAT_GRINDER, "Started Stat Grinder");
    // Go Player is optional - only run if requested
    if (ns.args.includes("--go")) {
        await checkAndRunScript(CONFIG.SCRIPTS.GO_PLAYER, "Started Go Player");
    }

    // Initial run of Hack Manager
    await runHackManager();
    ns.print("Completed initial Hack Manager run");

    let lastHackLevel = Math.floor(ns.getHackingLevel() / CONFIG.INTERVALS.HACK_LEVEL) * CONFIG.INTERVALS.HACK_LEVEL;
    let lastDiscoveryTime = 0;
    let lastAugmentationPlanTime = 0;

    while (true) {
        const currentTime = Date.now();
        const currentHackLevel = ns.getHackingLevel();

        // Check if it's time to run Hack Manager again
        if (
            Math.floor(currentHackLevel / CONFIG.INTERVALS.HACK_LEVEL) >
            Math.floor(lastHackLevel / CONFIG.INTERVALS.HACK_LEVEL)
        ) {
            await runHackManager();
            lastHackLevel = Math.floor(currentHackLevel / CONFIG.INTERVALS.HACK_LEVEL) * CONFIG.INTERVALS.HACK_LEVEL;
            ns.print(`Ran Hack Manager at hack level ${lastHackLevel}`);
        }

        // Run server discovery based on dynamic interval
        const discoveryInterval = CONFIG.getDiscoveryInterval();
        if (currentTime - lastDiscoveryTime >= discoveryInterval) {
            // Run TOR manager before server discovery
            await runTorManager();

            await runServerDiscovery();

            // Run contract solver after discovery to check for new contracts
            await runContractSolver();

            lastDiscoveryTime = currentTime;
            ns.print(`Discovery cycle completed (next in ${discoveryInterval/1000}s)`);
        }

        // Run augmentation planning every hour or after significant level increases
        const augmentationPlanInterval = 3600000; // 1 hour
        const significantLevelIncrease = Math.floor(currentHackLevel / 100) > Math.floor(lastHackLevel / 100);

        if (currentTime - lastAugmentationPlanTime >= augmentationPlanInterval || significantLevelIncrease) {
            await runAugmentationPlanner();
            lastAugmentationPlanTime = currentTime;
            ns.print("Augmentation planning completed");
        }

        // Update status port with discovery timer info
        const timeUntilNextDiscovery = Math.max(0, discoveryInterval - (currentTime - lastDiscoveryTime));
        const statusInfo = {
            nextDiscovery: Math.ceil(timeUntilNextDiscovery / 1000),
            discoveryInterval: discoveryInterval / 1000,
            hackLevel: currentHackLevel,
            lastUpdate: currentTime
        };
        ns.clearPort(CONFIG.PORTS.STATUS);
        ns.writePort(CONFIG.PORTS.STATUS, JSON.stringify(statusInfo));

        // Update best target
        updateBestTarget(ns);

        // Wait before next check
        await ns.sleep(CONFIG.INTERVALS.MAIN_LOOP);
    }

    async function checkAndRunScript(scriptName, successMessage) {
        if (ns.fileExists(scriptName, "home")) {
            // Check if we have enough RAM to run the script
            const scriptRam = ns.getScriptRam(scriptName);
            const availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");

            if (availableRam < scriptRam) {
                ns.print(`Not enough RAM to run ${scriptName} (need ${scriptRam}GB, have ${availableRam}GB)`);
                return;
            }

            const pid = ns.exec(scriptName, "home");
            if (pid !== 0) {
                ns.print(successMessage);
            } else {
                ns.print(`Failed to execute ${scriptName} - may already be running or insufficient resources`);
            }
        } else {
            ns.print(`WARNING: ${scriptName} not found - skipping`);
        }
    }

    async function runHackManager() {
        await checkAndRunScript(CONFIG.SCRIPTS.HACK_MANAGER, "Running Hack Manager");
    }

    async function runServerDiscovery() {
        await checkAndRunScript(CONFIG.SCRIPTS.SERVER_DISCOVERY, "Running Server Discovery");
        await ns.sleep(1000); // Give some time for the discovery to complete
    }

    async function runTorManager() {
        if (ns.fileExists(CONFIG.SCRIPTS.TOR_MANAGER, "home")) {
            const pid = ns.exec(CONFIG.SCRIPTS.TOR_MANAGER, "home");
            if (pid !== 0) {
                // Wait for TOR manager to complete
                while (ns.isRunning(pid)) {
                    await ns.sleep(100);
                }
                ns.print("TOR Manager completed");
            } else {
                ns.print("TOR Manager already running or failed to start");
            }
        } else {
            ns.print("WARNING: tor-manager.js not found - skipping TOR management");
        }
    }

    async function runContractSolver() {
        if (ns.fileExists(CONFIG.SCRIPTS.CONTRACT_SOLVER, "home")) {
            const pid = ns.exec(CONFIG.SCRIPTS.CONTRACT_SOLVER, "home");
            if (pid !== 0) {
                // Wait for contract solver to complete
                while (ns.isRunning(pid)) {
                    await ns.sleep(100);
                }
                ns.print("Contract Solver completed");
            } else {
                ns.print("Contract Solver already running or failed to start");
            }
        } else {
            ns.print("WARNING: contract-solver.js not found - skipping contract solving");
        }
    }

    async function runAugmentationPlanner() {
        if (ns.fileExists(CONFIG.SCRIPTS.AUGMENTATION_PLANNER, "home")) {
            const pid = ns.exec(CONFIG.SCRIPTS.AUGMENTATION_PLANNER, "home");
            if (pid !== 0) {
                // Wait for augmentation planner to complete
                while (ns.isRunning(pid)) {
                    await ns.sleep(100);
                }
                ns.print("Augmentation Planner completed");
            } else {
                ns.print("Augmentation Planner already running or failed to start");
            }
        } else {
            ns.print("WARNING: augmentation-planner.js not found - skipping augmentation planning");
        }
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
