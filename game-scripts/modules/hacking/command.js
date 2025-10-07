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
import { gainRootAccess } from '/lib/access-utils.js';
import { writePort } from '/lib/port-utils.js';
import { calculateMaxThreads } from '/lib/ram-utils.js';
import { findBestHackTarget, calculateHackScore } from '/lib/target-utils.js';
import { disableCommonLogs } from '/lib/misc-utils.js';
import { findBestDeploymentServer, deployScript, getScriptRamCost } from '/lib/deployment-utils.js';
import { isManagerRunning, registerManagerDeployment, cleanupStaleDeployments, loadManagerDeployments } from '/lib/manager-utils.js';
import { PORTS } from '/config/ports.js';
import { INTERVALS } from '/config/timing.js';
import { HACK_LEVELS } from '/config/hacking.js';
import { SCRIPTS, FILES } from '/config/paths.js';
import { SETTINGS } from '/config/settings.js';

export async function main(ns) {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    disableCommonLogs(ns);

    const WORKER_SCRIPT = SCRIPTS.WORKER;
    const HACKNET_SCRIPT = SCRIPTS.HACKNET_MANAGER;
    const PROGRAM_SCRIPT = SCRIPTS.PROGRAM_MANAGER;
    const SERVER_SCRIPT = SCRIPTS.SERVER_MANAGER;
    const CONTRACT_SCRIPT = SCRIPTS.CONTRACT_SOLVER;
    const GO_SCRIPT = SCRIPTS.GO_MANAGER;
    const STOCK_SCRIPT = SCRIPTS.STOCK_TRADER;
    const currentServer = ns.getHostname();
    let lastDiscovery = 0;
    let currentTarget = null;
    let currentTargetScore = 0;
    let needsWorkerUpdate = false;
    let rootedServers = new Set(); // Track rooted servers to avoid re-attempting root
    let cachedServerList = null; // Cache server list to reduce scans
    let lastServerCount = 0; // Track purchased server count to detect changes

    ns.tprint("Command server started");
    ns.tprint(`  Running on: ${currentServer}`);

    // Restore last target from file if available
    if (ns.fileExists(FILES.LAST_TARGET)) {
        try {
            const savedTargetData = ns.read(FILES.LAST_TARGET);
            const targetData = JSON.parse(savedTargetData);
            currentTarget = targetData.target;
            currentTargetScore = targetData.score || 0;

            // Restore to port so workers pick it up immediately
            writePort(ns, PORTS.HACK_TARGET, savedTargetData);

            ns.tprint(`Restored last target: ${currentTarget}`);
        } catch (e) {
            ns.print(`Failed to restore last target: ${e.message}`);
        }
    }

    // Open tail window if debug setting enabled
    if (SETTINGS.DEBUG_AUTO_TAIL) {
        ns.tail();
    }

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
        const discoveryDue = (now - lastDiscovery >= discoveryInterval);

        if (discoveryDue) {
            ns.print(`Running discovery (hack level: ${hackLevel})...`);

            // Check if we need to rescan (new purchased servers or no cache)
            const currentServerCount = ns.getPurchasedServers().length;
            const needsRescan = !cachedServerList || currentServerCount !== lastServerCount;

            let allServers;
            if (needsRescan) {
                // Scan network
                allServers = scanAllServers(ns);
                cachedServerList = allServers;
                lastServerCount = currentServerCount;
                needsWorkerUpdate = true; // New servers = need worker update
                ns.print(`  Found ${allServers.length} servers (rescanned)`);
            } else {
                // Use cached list
                allServers = cachedServerList;
                ns.print(`  Using cached ${allServers.length} servers`);
            }

            // Attempt root access only on servers we haven't rooted yet
            let rootedCount = 0;
            for (const hostname of allServers) {
                // Skip if already in our rooted set
                if (rootedServers.has(hostname)) {
                    continue;
                }

                // Try to gain root access
                const result = gainRootAccess(ns, hostname);
                if (result.success) {
                    rootedServers.add(hostname);
                    if (!result.alreadyRooted) {
                        ns.print(`  Rooted: ${hostname}`);
                        rootedCount++;
                        needsWorkerUpdate = true; // New rooted server = need worker update
                    }
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
            const bestTargetInfo = serverInfoList.find(s => s.hostname === bestTarget);
            const bestTargetScore = bestTargetInfo ? calculateHackScore(bestTargetInfo, hackLevel) : 0;

            // Update target if changed
            if (bestTarget !== currentTarget) {
                // Calculate score improvement to determine switch mode
                let switchMode = "immediate";

                if (currentTarget && currentTargetScore > 0) {
                    const scoreImprovement = bestTargetScore / currentTargetScore;

                    // Only switch immediately if new target is significantly better (3x+)
                    // Otherwise, let workers finish their current operation
                    if (scoreImprovement < 3.0) {
                        switchMode = "after_operation";
                        ns.print(`  Score improvement: ${scoreImprovement.toFixed(2)}x - switch after operation`);
                    } else {
                        ns.print(`  Score improvement: ${scoreImprovement.toFixed(2)}x - switch immediately`);
                    }
                } else {
                    ns.print(`  First target or no score data - switch immediately`);
                }

                ns.print(`Target changed: ${currentTarget || 'none'} -> ${bestTarget}`);

                // Write target data with switch mode
                const targetData = {
                    target: bestTarget,
                    mode: switchMode,
                    score: bestTargetScore
                };
                writePort(ns, PORTS.HACK_TARGET, JSON.stringify(targetData));

                // Save target to file for persistence across restarts
                await ns.write(FILES.LAST_TARGET, JSON.stringify(targetData), "w");

                currentTarget = bestTarget;
                currentTargetScore = bestTargetScore;
            }

            // Deploy workers only if something changed (new servers, new roots, manager deployed)
            let deployedCount = 0;

            if (needsWorkerUpdate) {
                // Get Go manager server (needs exclusive RAM for dynamic temp scripts)
                const managerDeployments = loadManagerDeployments(ns);
                const goManagerServer = managerDeployments.go?.server;

                for (const hostname of accessibleServers) {
                // Skip home - reserved for managers
                if (hostname === "home") {
                    continue;
                }

                // Skip command center - reserved for this script
                if (hostname === currentServer) {
                    continue;
                }

                // Skip Go manager server - it needs exclusive RAM for temp scripts
                if (goManagerServer && hostname === goManagerServer) {
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

                ns.print(`Worker deployment: ${deployedCount} servers deployed`);
                needsWorkerUpdate = false; // Reset flag after worker update
            } else {
                ns.print(`Worker deployment: skipped (no changes)`);
            }

            ns.print(`Discovery complete`);
            lastDiscovery = now;
        }

        // Update workers if manager deployment changed RAM availability
        if (needsWorkerUpdate && !discoveryDue) {
            ns.print("Manager deployment detected, updating workers...");
            const allServers = scanAllServers(ns);
            const accessibleServers = getAllAccessibleServers(ns, allServers);

            // Get Go manager server (needs exclusive RAM for dynamic temp scripts)
            const managerDeployments = loadManagerDeployments(ns);
            const goManagerServer = managerDeployments.go?.server;

            let updatedCount = 0;
            for (const hostname of accessibleServers) {
                // Skip home, command center, and Go manager server
                if (hostname === "home" || hostname === currentServer || (goManagerServer && hostname === goManagerServer)) {
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
                if (runningWorker && runningWorker.threads !== maxThreads && maxThreads > 0) {
                    // Kill and restart with new thread count
                    ns.scriptKill(WORKER_SCRIPT, hostname);
                    const pid = ns.exec(WORKER_SCRIPT, hostname, maxThreads, PORTS.HACK_TARGET);
                    if (pid > 0) {
                        ns.print(`  Updated ${hostname}: ${runningWorker.threads} -> ${maxThreads} threads`);
                        updatedCount++;
                    }
                }
            }

            ns.print(`Worker update complete: ${updatedCount} servers updated`);
            needsWorkerUpdate = false;
        }

        // Clean up any stale manager deployments
        await cleanupStaleDeployments(ns);

        // Deploy managers sequentially (one at a time to avoid conflicts)
        const managersToDeploy = [
            { name: "hacknet", script: HACKNET_SCRIPT },
            { name: "programs", script: PROGRAM_SCRIPT },
            { name: "servers", script: SERVER_SCRIPT },
            { name: "contracts", script: CONTRACT_SCRIPT },
            { name: "go", script: GO_SCRIPT },
            { name: "stocks", script: STOCK_SCRIPT }
        ];

        for (const manager of managersToDeploy) {
            if (!isManagerRunning(ns, manager.name)) {
                // Copy manager script to command server temporarily to check RAM cost
                await ns.scp(manager.script, currentServer, "home");
                let ramRequired = getScriptRamCost(ns, manager.script);
                let server = null;

                // Special case: Go manager needs extra RAM for the bot + temp scripts (~20GB total)
                if (manager.name === "go") {
                    // Copy go-player to check its RAM cost
                    await ns.scp('/sf-modules/go/go-player.js', currentServer, "home");
                    const goBotRam = getScriptRamCost(ns, '/sf-modules/go/go-player.js');
                    // Add manager + bot + buffer for temp scripts (typically 17.6GB)
                    ramRequired = ramRequired + goBotRam + 18;

                    // Prioritize purchased servers for Go bot (they have lots of RAM)
                    const purchasedServers = ns.getPurchasedServers();
                    for (const pserver of purchasedServers) {
                        const maxRam = ns.getServerMaxRam(pserver);
                        const usedRam = ns.getServerUsedRam(pserver);
                        const freeRam = maxRam - usedRam;

                        if (freeRam >= ramRequired) {
                            server = { hostname: pserver, maxRam: maxRam, usedRam: usedRam };
                            ns.print(`Using purchased server ${pserver} for Go manager (${freeRam.toFixed(2)}GB free)`);
                            break;
                        }
                    }
                }

                // Fallback to normal server selection if no purchased server found (or not Go manager)
                if (!server) {
                    // Exclude home, command center, n00dles, and purchased servers (being upgraded)
                    const purchasedServers = ns.getPurchasedServers();
                    const excludeServers = ["home", currentServer, "n00dles", ...purchasedServers];
                    server = findBestDeploymentServer(ns, ramRequired, excludeServers);
                }

                if (server) {
                    // Base dependencies for all managers
                    let dependencies = [
                        '/lib/misc-utils.js',
                        '/lib/port-utils.js',
                        '/config/money.js',
                        '/config/ports.js',
                    ];

                    // Add manager-specific dependencies
                    if (manager.name === "servers") {
                        dependencies.push('/lib/server-utils.js');
                        dependencies.push('/config/paths.js');
                    } else if (manager.name === "contracts") {
                        dependencies.push('/lib/server-utils.js');
                    } else if (manager.name === "go") {
                        // Go manager needs the bot files on the deployment server
                        dependencies.push('/sf-modules/go/go-player.js');
                        dependencies.push('/sf-modules/go/helpers.js');
                    }

                    const result = await deployScript(ns, manager.script, dependencies, server.hostname, {
                        killExisting: false, // Don't kill - we already checked isManagerRunning()
                        autoStart: true,
                        threads: 1
                    });

                    if (result.success) {
                        // Register deployment for tracking
                        await registerManagerDeployment(ns, manager.name, server.hostname, manager.script, result.pid);
                        ns.print(`SUCCESS: ${result.message}`);
                        ns.tprint(`${manager.name} manager deployed to ${server.hostname}`);
                        needsWorkerUpdate = true; // Trigger worker redeployment
                    } else {
                        ns.print(`WARNING: ${result.message}`);
                    }
                } else {
                    ns.print(`Waiting for suitable server for ${manager.name} manager (need ${ramRequired.toFixed(2)}GB)...`);
                }
            }
        }

        // Update status port with current state
        const timeUntilNextDiscovery = Math.max(0, Math.floor((discoveryInterval - (now - lastDiscovery)) / 1000));
        const statusData = {
            hackLevel: hackLevel,
            nextDiscovery: timeUntilNextDiscovery,
            discoveryInterval: Math.floor(discoveryInterval / 1000),
            lastUpdate: now
        };
        writePort(ns, PORTS.STATUS, JSON.stringify(statusData));

        // Wait before next iteration
        await ns.sleep(5000);
    }
}
