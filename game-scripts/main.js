/** @param {NS} ns */
export async function main(ns) {
    const mode = ns.args[0] || "overlord";
    const cleanupLevel = ns.args[1] || "home"; // "home" or "all"

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
        ns.tprint(`ERROR: Invalid mode '${mode}'. Use 'overlord' or 'offline'`);
        ns.tprint("Usage: run main.js [overlord|offline] [home|all]");
        return;
    }

    // Validate cleanup level
    if (!["home", "all"].includes(cleanupLevel)) {
        ns.tprint(`ERROR: Invalid cleanup level '${cleanupLevel}'. Use 'home' or 'all'`);
        ns.tprint("Usage: run main.js [overlord|offline] [home|all]");
        return;
    }

    ns.tprint(`Starting ${mode} mode with ${cleanupLevel} cleanup...`);

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

    const pid = ns.exec(scriptToRun, "home");
    if (pid !== 0) {
        ns.tprint(`SUCCESS: Started ${mode} mode (PID: ${pid})`);
        ns.tprint(`Script: ${scriptToRun}`);
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