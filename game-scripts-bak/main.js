/** @param {NS} ns */
export async function main(ns) {
    // Parse arguments for simplified command structure
    const args = ns.args;
    let mode = "overlord";
    let cleanupLevel = "home";
    let enableGo = false;

    // Parse simplified commands
    if (args.length === 0) {
        // Default: main.js -> overlord mode
        mode = "overlord";
    } else if (args[0] === "go") {
        // main.js go -> overlord with Go
        mode = "overlord";
        enableGo = true;
    } else if (args[0] === "offline") {
        // main.js offline [go] -> offline mode, optionally with Go
        mode = "offline";
        enableGo = args.includes("go");
    } else if (args[0] === "overlord") {
        // main.js overlord -> overlord mode (simplified)
        mode = "overlord";
    } else {
        // Invalid first argument
        mode = args[0]; // Will be caught by validation below
    }

    const CONFIG = {
        MODES: {
            OVERLORD: "overlord",
            OFFLINE: "offline"
        },
        SCRIPTS: {
            OVERLORD: "core/overlord.js",
            OFFLINE: "core/offline-worker.js"
        },
        ALL_SCRIPTS: [
            "core/overlord.js",
            "core/offline-worker.js",
            "managers/hack-manager.js",
            "managers/tor-manager.js",
            "managers/purchase-server-manager.js",
            "managers/hacknet-farm.js",
            "workers/bot-worker.js",
            "discovery/server-discovery.js",
            "discovery/backdoor-manager.js",
            "monitoring/port-monitor.js",
            "monitoring/debug-ports.js"
        ]
    };

    // Validate mode
    if (!Object.values(CONFIG.MODES).includes(mode)) {
        ns.tprint(`ERROR: Invalid mode '${mode}'.`);
        ns.tprint("Usage:");
        ns.tprint("  run main.js              - Start overlord mode");
        ns.tprint("  run main.js go           - Start overlord mode with Go automation");
        ns.tprint("  run main.js offline      - Start offline worker mode");
        ns.tprint("  run main.js offline go   - Start offline worker mode with Go automation");
        ns.tprint("  run main.js overlord     - Start overlord mode (explicit)");
        return;
    }

    // Validate cleanup level
    if (!["home", "all"].includes(cleanupLevel)) {
        ns.tprint(`ERROR: Invalid cleanup level '${cleanupLevel}'. Use 'home' or 'all'`);
        return;
    }

    ns.tprint(`Starting ${mode} mode with ${cleanupLevel} cleanup${enableGo ? ' and Go automation' : ''}...`);

    // Kill running scripts based on cleanup level
    await killAllScripts(cleanupLevel);

    // Wait a moment for cleanup
    await ns.sleep(1000);

    // Start the requested mode
    const scriptToRun = mode === CONFIG.MODES.OVERLORD ? CONFIG.SCRIPTS.OVERLORD : CONFIG.SCRIPTS.OFFLINE;

    if (!ns.fileExists(scriptToRun)) {
        ns.tprint(`ERROR: Script ${scriptToRun} not found!`);
        return;
    }

    // Prepare arguments for the script
    const scriptArgs = enableGo ? ["--go"] : [];

    const pid = ns.exec(scriptToRun, "home", 1, ...scriptArgs);
    if (pid !== 0) {
        ns.tprint(`SUCCESS: Started ${mode} mode (PID: ${pid})`);
        ns.tprint(`Script: ${scriptToRun}${enableGo ? ' --go' : ''}`);
        if (enableGo) {
            ns.tprint("Go automation enabled - check port monitor for game status");
        }
    } else {
        ns.tprint(`ERROR: Failed to start ${scriptToRun}`);
        ns.tprint("Check RAM requirements and script availability");
    }

    async function killAllScripts(cleanupLevel) {
        let killedCount = 0;
        const currentScript = ns.getScriptName();

        // Kill scripts on home server (except this startup script)
        const runningScripts = ns.ps("home");
        for (const script of runningScripts) {
            if (script.filename !== currentScript) {
                if (ns.scriptKill(script.filename, "home")) {
                    ns.print(`Killed: ${script.filename} (PID: ${script.pid})`);
                    killedCount++;
                }
            }
        }

        // Only kill scripts on other servers if "all" cleanup is requested
        if (cleanupLevel === "all") {
            // Kill scripts on all purchased servers
            const servers = ns.getPurchasedServers();
            for (const server of servers) {
                const serverScripts = ns.ps(server);
                for (const script of serverScripts) {
                    if (ns.scriptKill(script.filename, server)) {
                        ns.print(`Killed: ${script.filename} on ${server}`);
                        killedCount++;
                    }
                }
            }

            // Kill scripts on discovered servers (if server list exists)
            try {
                if (ns.fileExists("/servers/server_info.txt")) {
                    const serverData = JSON.parse(ns.read("/servers/server_info.txt"));
                    for (const serverInfo of serverData) {
                        if (serverInfo.hasRootAccess && serverInfo.hostname !== "home") {
                            const serverScripts = ns.ps(serverInfo.hostname);
                            for (const script of serverScripts) {
                                if (ns.scriptKill(script.filename, serverInfo.hostname)) {
                                    ns.print(`Killed: ${script.filename} on ${serverInfo.hostname}`);
                                    killedCount++;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                ns.print("Could not read server list for cleanup - continuing anyway");
            }
        }

        if (killedCount > 0) {
            ns.tprint(`Cleaned up ${killedCount} running scripts`);
        } else {
            ns.tprint("No scripts to clean up");
        }
    }
}