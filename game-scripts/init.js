/**
 * Initialization Script
 * Main entry point for game automation system
 *
 * DESIGN: Single entry point with modes
 * - No args: Run bootstrap (normal startup)
 * - monitor: Launch status monitor
 * - offline: Kill all scripts and spawn max workers
 * - kill: Kill all scripts across network
 * - clean: Remove all deployed files and reset state
 *
 * USAGE:
 *   run init.js           # Normal startup (bootstrap)
 *   run init.js monitor   # Launch status monitor
 *   run init.js offline   # Offline mode (max workers only)
 *   run init.js kill      # Kill all network scripts
 *   run init.js clean     # Clean network and reset
 */

import { SCRIPTS } from '/config/paths.js';

export async function main(ns) {
    const mode = ns.args[0] || "bootstrap";

    switch (mode.toLowerCase()) {
        case "bootstrap":
        case "start":
            ns.tprint("Starting bootstrap...");
            ns.spawn(SCRIPTS.BOOTSTRAP);
            break;

        case "monitor":
        case "status":
            ns.tprint("Launching status monitor...");
            const monitorScript = '/modules/monitoring/status-monitor.js';

            // Kill existing monitor if running
            if (ns.isRunning(monitorScript, "home")) {
                ns.scriptKill(monitorScript, "home");
                await ns.sleep(100);
            }

            ns.run(monitorScript);
            break;

        case "offline":
            ns.tprint("Entering offline mode...");
            ns.tprint("Killing all scripts and spawning max workers...");

            // Kill everything first
            const allServers = getAllServers(ns);
            for (const server of allServers) {
                ns.killall(server);
            }
            await ns.sleep(500);

            // Deploy workers to all rooted servers
            const workerScript = SCRIPTS.WORKER;
            let workersDeployed = 0;

            for (const server of allServers) {
                if (server === "home") continue;
                if (!ns.hasRootAccess(server)) continue;

                await ns.scp(workerScript, server, "home");

                const maxRam = ns.getServerMaxRam(server);
                const scriptRam = ns.getScriptRam(workerScript);

                if (scriptRam === 0) continue;

                const threads = Math.floor(maxRam / scriptRam);
                if (threads > 0) {
                    // Use a simple target - n00dles for offline mode
                    const pid = ns.exec(workerScript, server, threads, 1); // Port 1 for target
                    if (pid > 0) {
                        workersDeployed++;
                    }
                }
            }

            ns.tprint(`Offline mode active: ${workersDeployed} workers deployed`);
            break;

        case "kill":
        case "killall":
            ns.tprint("Killing all scripts across network...");
            const servers = getAllServers(ns);
            let killedCount = 0;

            for (const server of servers) {
                const processes = ns.ps(server);
                if (processes.length > 0) {
                    ns.killall(server);
                    killedCount += processes.length;
                    ns.tprint(`  ${server}: killed ${processes.length} scripts`);
                }
            }

            ns.tprint(`Total: Killed ${killedCount} scripts across ${servers.length} servers`);
            break;

        case "clean":
        case "cleanup":
            ns.tprint("Cleaning network...");
            const cleanScript = '/modules/utilities/cleanup-network.js';
            ns.run(cleanScript);
            break;

        default:
            ns.tprint(`ERROR: Unknown mode '${mode}'`);
            ns.tprint("Valid modes:");
            ns.tprint("  bootstrap - Start normal automation (default)");
            ns.tprint("  monitor   - Launch status monitor");
            ns.tprint("  offline   - Max workers only (no managers)");
            ns.tprint("  kill      - Kill all network scripts");
            ns.tprint("  clean     - Remove deployed files and reset");
            break;
    }
}

/**
 * Scan all servers (simple BFS)
 */
function getAllServers(ns) {
    const servers = ["home"];
    const seen = new Set(["home"]);

    for (let i = 0; i < servers.length; i++) {
        const neighbors = ns.scan(servers[i]);
        for (const neighbor of neighbors) {
            if (!seen.has(neighbor)) {
                seen.add(neighbor);
                servers.push(neighbor);
            }
        }
    }

    return servers;
}
