/**
 * Hacking Command Server
 * Runs discovery, target selection, and worker deployment
 *
 * DESIGN: Uses library imports for full functionality
 * - Discovers network servers
 * - Selects optimal hack targets
 * - Deploys workers across network
 * - Coordinates via port 1
 *
 * RAM Cost: ~8-10GB (requires larger server like foodnstuff)
 * Deployment: Run on 16GB+ server with library access
 */

import { scanAllServers, getServerInfo, getAllAccessibleServers } from '/lib/server-utils.js';
import { gainRootAccess, getAvailablePortOpeners } from '/lib/access-utils.js';
import { writePort } from '/lib/port-utils.js';
import { calculateMaxThreads } from '/lib/ram-utils.js';
import { findBestHackTarget } from '/lib/target-utils.js';
import { disableCommonLogs } from '/lib/misc-utils.js';
import { PORTS } from '/config/ports.js';
import { INTERVALS } from '/config/timing.js';
import { HACK_LEVELS } from '/config/hacking.js';
import { SCRIPTS } from '/config/paths.js';

export async function main(ns) {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    disableCommonLogs(ns);

    const WORKER_SCRIPT = SCRIPTS.WORKER;
    const currentServer = ns.getHostname();
    let lastDiscovery = 0;
    let currentTarget = null;

    ns.tprint("Command server started");
    ns.tprint(`  Running on: ${currentServer}`);

    // ============================================================================
    // MAIN LOOP
    // ============================================================================

    while (true) {
        const hackLevel = ns.getHackingLevel();

        // Determine discovery interval based on hack level
        let discoveryInterval = INTERVALS.DISCOVERY_END;
        if (hackLevel < HACK_LEVELS.TIER2) {
            discoveryInterval = INTERVALS.DISCOVERY_VERY_EARLY;
        } else if (hackLevel < HACK_LEVELS.TIER3) {
            discoveryInterval = INTERVALS.DISCOVERY_EARLY;
        } else if (hackLevel < HACK_LEVELS.TIER4) {
            discoveryInterval = INTERVALS.DISCOVERY_MID;
        } else if (hackLevel < HACK_LEVELS.TIER5) {
            discoveryInterval = INTERVALS.DISCOVERY_LATE;
        }

        // Run discovery if interval has passed
        const now = Date.now();
        if (now - lastDiscovery >= discoveryInterval) {
            ns.print(`Running discovery (hack level: ${hackLevel})...`);

            // Scan network
            const allServers = scanAllServers(ns);
            ns.print(`  Found ${allServers.length} servers`);

            // Attempt root access on all servers
            let rootedCount = 0;
            for (const hostname of allServers) {
                const result = gainRootAccess(ns, hostname);
                if (result.success && !result.alreadyRooted) {
                    ns.print(`  Rooted: ${hostname}`);
                    rootedCount++;
                }
            }

            if (rootedCount > 0) {
                ns.print(`  Newly rooted: ${rootedCount} servers`);
            }

            // Get detailed server info for accessible servers
            const accessibleServers = getAllAccessibleServers(ns, allServers);
            const serverInfoList = accessibleServers.map(hostname => getServerInfo(ns, hostname));

            // Find best target
            const bestTarget = findBestHackTarget(ns, serverInfoList);

            // Update target if changed
            if (bestTarget !== currentTarget) {
                ns.print(`Target changed: ${currentTarget || 'none'} -> ${bestTarget}`);
                writePort(ns, PORTS.HACK_TARGET, bestTarget);
                currentTarget = bestTarget;
            }

            // Deploy workers to all accessible servers (except home and command center)
            let deployedCount = 0;
            for (const hostname of accessibleServers) {
                // Skip home - reserved for managers
                if (hostname === "home") {
                    continue;
                }

                // Skip command center - reserved for this script
                if (hostname === currentServer) {
                    continue;
                }

                // Copy worker script
                await ns.scp(WORKER_SCRIPT, hostname, "home");

                // Calculate optimal thread count
                const maxThreads = calculateMaxThreads(ns, WORKER_SCRIPT, hostname, 0);

                // Get currently running processes
                const processes = ns.ps(hostname);
                const runningWorker = processes.find(p => p.filename === WORKER_SCRIPT);

                // Check if worker needs deployment/restart
                let needsDeploy = false;
                let reason = "";

                if (!runningWorker) {
                    // No worker running
                    needsDeploy = true;
                    reason = "not running";
                } else if (runningWorker.threads !== maxThreads) {
                    // Wrong thread count (RAM upgraded or script changed)
                    needsDeploy = true;
                    reason = `thread mismatch (${runningWorker.threads} -> ${maxThreads})`;
                }

                if (needsDeploy && maxThreads > 0) {
                    // Kill old worker if exists
                    if (runningWorker) {
                        ns.scriptKill(WORKER_SCRIPT, hostname);
                    }

                    // Start worker with correct thread count
                    const pid = ns.exec(WORKER_SCRIPT, hostname, maxThreads, PORTS.HACK_TARGET);
                    if (pid > 0) {
                        ns.print(`  Deployed ${maxThreads} threads on ${hostname} (${reason})`);
                        deployedCount++;
                    }
                }
            }

            ns.print(`Discovery complete: ${deployedCount} servers deployed`);
            lastDiscovery = now;
        }

        // Wait before next iteration
        await ns.sleep(5000);
    }
}
