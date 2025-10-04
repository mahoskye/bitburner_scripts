/**
 * Deployment Utilities
 * Functions for deploying and managing scripts across servers
 */

import { scanAllServers, getAllAccessibleServers } from '/lib/server-utils.js';
import { isManagerServer } from '/lib/manager-utils.js';

/**
 * Find best server for deploying a script
 *
 * Purpose: Select optimal server based on RAM requirements
 * Used by: Command server for deploying managers
 *
 * @param {NS} ns - NetScript object
 * @param {number} ramRequired - Required RAM in GB
 * @param {string[]} excludeServers - Servers to exclude from consideration
 * @returns {Object|null} {hostname, freeRam, maxRam} or null if none found
 *
 * @example
 * const server = findBestDeploymentServer(ns, 4.5, ["home", "foodnstuff"]);
 * if (server) {
 *     ns.tprint(`Best server: ${server.hostname} (${server.freeRam}GB free)`);
 * }
 */
export function findBestDeploymentServer(ns, ramRequired, excludeServers = []) {
    // Get servers connected directly to home (top-level, easy to access)
    const topLevelServers = ns.scan("home").filter(s => s !== "home");

    // First, try to find a suitable top-level server
    for (const hostname of topLevelServers) {
        // Skip excluded servers
        if (excludeServers.includes(hostname)) {
            continue;
        }

        // Skip servers that are designated as manager servers
        if (isManagerServer(ns, hostname)) {
            continue;
        }

        // Must have root access
        if (!ns.hasRootAccess(hostname)) {
            continue;
        }

        const maxRam = ns.getServerMaxRam(hostname);

        // Check if server has enough total RAM capacity (we'll kill scripts if needed)
        if (maxRam === 0 || maxRam < ramRequired) {
            continue;
        }

        const usedRam = ns.getServerUsedRam(hostname);
        const freeRam = maxRam - usedRam;

        ns.print(`Found top-level server: ${hostname} (${freeRam.toFixed(2)}GB free, ${maxRam}GB total)`);
        return {
            hostname: hostname,
            freeRam: freeRam,
            maxRam: maxRam
        };
    }

    // If no top-level server works, fall back to searching all servers
    ns.print(`No suitable top-level server found, searching all servers...`);
    const allServers = scanAllServers(ns);
    const accessibleServers = getAllAccessibleServers(ns, allServers);

    let bestServer = null;
    let bestMaxRam = 0;

    for (const hostname of accessibleServers) {
        // Skip excluded servers
        if (excludeServers.includes(hostname)) {
            continue;
        }

        // Skip servers that are designated as manager servers
        if (isManagerServer(ns, hostname)) {
            continue;
        }

        const maxRam = ns.getServerMaxRam(hostname);

        // Check if server has enough total RAM capacity (we'll kill scripts if needed)
        if (maxRam === 0 || maxRam < ramRequired) {
            continue;
        }

        const usedRam = ns.getServerUsedRam(hostname);
        const freeRam = maxRam - usedRam;

        // Pick server with most total RAM (more headroom for upgrades)
        if (maxRam > bestMaxRam) {
            bestMaxRam = maxRam;
            bestServer = {
                hostname: hostname,
                freeRam: freeRam,
                maxRam: maxRam
            };
        }
    }

    if (bestServer) {
        ns.print(`Found fallback server: ${bestServer.hostname} (${bestServer.freeRam.toFixed(2)}GB free, ${bestServer.maxRam}GB total)`);
    }

    return bestServer;
}

/**
 * Deploy a script with its dependencies to a server
 *
 * Purpose: Copy script and dependencies, optionally start it
 * Used by: Command server for deploying managers
 *
 * @param {NS} ns - NetScript object
 * @param {string} scriptPath - Path to main script
 * @param {string[]} dependencies - Array of dependency file paths
 * @param {string} targetServer - Server to deploy to
 * @param {Object} options - Deployment options
 * @param {boolean} options.killExisting - Kill existing instance (default: true)
 * @param {boolean} options.autoStart - Start after deploying (default: true)
 * @param {number} options.threads - Number of threads (default: 1)
 * @param {Array} options.args - Script arguments (default: [])
 * @returns {Object} {success, pid, message}
 *
 * @example
 * const result = deployScript(ns,
 *     "/modules/resources/hacknet-manager.js",
 *     ["/lib/misc-utils.js", "/config/money.js"],
 *     "joesguns",
 *     { killExisting: true, autoStart: true }
 * );
 * if (result.success) {
 *     ns.tprint(`Deployed! PID: ${result.pid}`);
 * }
 */
export async function deployScript(ns, scriptPath, dependencies, targetServer, options = {}) {
    const {
        killExisting = true,
        autoStart = true,
        threads = 1,
        args = []
    } = options;

    try {
        // Verify target server has root access
        if (!ns.hasRootAccess(targetServer)) {
            return {
                success: false,
                pid: 0,
                message: `No root access on ${targetServer}`
            };
        }

        // Copy main script first so we can check its RAM cost
        await ns.scp(scriptPath, targetServer, "home");

        // Check if server has enough RAM for the script
        const scriptRam = ns.getScriptRam(scriptPath, targetServer);
        const requiredRam = scriptRam * threads;
        const maxRam = ns.getServerMaxRam(targetServer);

        // Verify server has enough total RAM capacity
        if (requiredRam > maxRam) {
            return {
                success: false,
                pid: 0,
                message: `Insufficient total RAM on ${targetServer}: need ${requiredRam.toFixed(2)}GB, server has ${maxRam}GB max`
            };
        }

        // Copy dependencies (script already copied above for RAM check)
        for (const dep of dependencies) {
            await ns.scp(dep, targetServer, "home");
        }

        ns.print(`Copied ${1 + dependencies.length} files to ${targetServer}`);

        // Kill existing script instance if requested
        if (killExisting) {
            // Only kill this specific script, not all scripts on the server
            if (ns.isRunning(scriptPath, targetServer)) {
                ns.scriptKill(scriptPath, targetServer);
                // Small delay to ensure script is fully killed
                await ns.sleep(100);
            }
        }

        // Check if we have enough RAM, if not, kill all scripts to make room
        let finalUsedRam = ns.getServerUsedRam(targetServer);
        let finalFreeRam = maxRam - finalUsedRam;

        if (requiredRam > finalFreeRam) {
            ns.print(`Insufficient RAM (${finalFreeRam.toFixed(2)}GB free), clearing server...`);
            ns.killall(targetServer);
            await ns.sleep(100);

            // Re-check RAM after killall
            finalUsedRam = ns.getServerUsedRam(targetServer);
            finalFreeRam = maxRam - finalUsedRam;
            ns.print(`RAM after clear: ${finalFreeRam.toFixed(2)}GB free, need ${requiredRam.toFixed(2)}GB`);

            if (requiredRam > finalFreeRam) {
                return {
                    success: false,
                    pid: 0,
                    message: `Insufficient RAM on ${targetServer}: need ${requiredRam.toFixed(2)}GB, have ${finalFreeRam.toFixed(2)}GB free`
                };
            }
        } else {
            ns.print(`RAM check: ${finalFreeRam.toFixed(2)}GB free, need ${requiredRam.toFixed(2)}GB`);
        }

        // Start script if requested
        let pid = 0;
        if (autoStart) {
            ns.print(`Attempting to exec ${scriptPath} on ${targetServer} with ${threads} threads...`);
            pid = ns.exec(scriptPath, targetServer, threads, ...args);
            if (pid === 0) {
                return {
                    success: false,
                    pid: 0,
                    message: `Failed to start ${scriptPath} on ${targetServer} (exec returned 0) - RAM: ${finalFreeRam.toFixed(2)}GB free, need ${requiredRam.toFixed(2)}GB`
                };
            }
        }

        return {
            success: true,
            pid: pid,
            message: `Deployed ${scriptPath} to ${targetServer}${autoStart ? ` (PID: ${pid})` : ''}`
        };

    } catch (error) {
        return {
            success: false,
            pid: 0,
            message: `Error deploying ${scriptPath}: ${error.message}`
        };
    }
}

/**
 * Check if a script is currently running on a server
 *
 * Purpose: Verify script deployment status
 * Used by: Command server to track deployed managers
 *
 * @param {NS} ns - NetScript object
 * @param {string} scriptPath - Path to script
 * @param {string} targetServer - Server to check
 * @returns {boolean} True if script is running
 *
 * @example
 * if (isScriptRunning(ns, "/modules/resources/hacknet-manager.js", "joesguns")) {
 *     ns.print("Hacknet manager is running!");
 * }
 */
export function isScriptRunning(ns, scriptPath, targetServer) {
    return ns.isRunning(scriptPath, targetServer);
}

/**
 * Get RAM cost of a script including dependencies
 *
 * Purpose: Calculate total RAM needed for deployment
 * Used by: Before deployment to verify server has enough RAM
 *
 * @param {NS} ns - NetScript object
 * @param {string} scriptPath - Path to script
 * @returns {number} Total RAM cost in GB
 *
 * @example
 * const ramNeeded = getScriptRamCost(ns, "/modules/resources/hacknet-manager.js");
 * ns.print(`Script needs ${ramNeeded}GB RAM`);
 */
export function getScriptRamCost(ns, scriptPath) {
    return ns.getScriptRam(scriptPath);
}
