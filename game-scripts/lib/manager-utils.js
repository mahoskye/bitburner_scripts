/**
 * Manager Deployment Utilities
 * Functions for tracking and managing deployed manager scripts
 *
 * DESIGN: 4-step deployment lifecycle
 * 1. Deploy - Find server, copy files, start script
 * 2. Track - Save deployment info to file
 * 3. Monitor - Check if manager is still running
 * 4. Recover - Redeploy if manager crashes
 */

import { FILES } from '/config/paths.js';

/**
 * Load manager deployment state from file
 *
 * @param {NS} ns - NetScript object
 * @returns {Object} Deployment state { managerName: { server, script, pid, lastCheck } }
 */
export function loadManagerDeployments(ns) {
    if (!ns.fileExists(FILES.MANAGER_DEPLOYMENTS, "home")) {
        return {};
    }

    try {
        const data = ns.read(FILES.MANAGER_DEPLOYMENTS, "home");
        return JSON.parse(data);
    } catch (e) {
        ns.print(`ERROR: Failed to parse manager deployments: ${e.message}`);
        return {};
    }
}

/**
 * Save manager deployment state to file
 *
 * @param {NS} ns - NetScript object
 * @param {Object} deployments - Deployment state
 */
export async function saveManagerDeployments(ns, deployments) {
    // Write to current server first, then scp to home to ensure it's on home
    const content = JSON.stringify(deployments, null, 2);
    await ns.write(FILES.MANAGER_DEPLOYMENTS, content, "w");

    // Copy to home if we're not already on home
    if (ns.getHostname() !== "home") {
        await ns.scp(FILES.MANAGER_DEPLOYMENTS, "home");
    }
}

/**
 * Register a manager deployment
 *
 * @param {NS} ns - NetScript object
 * @param {string} managerName - Unique manager identifier (e.g., "hacknet", "programs")
 * @param {string} server - Server hostname where manager is running
 * @param {string} script - Script path
 * @param {number} pid - Process ID
 */
export async function registerManagerDeployment(ns, managerName, server, script, pid) {
    const deployments = loadManagerDeployments(ns);

    deployments[managerName] = {
        server: server,
        script: script,
        pid: pid,
        deployedAt: Date.now(),
        lastCheck: Date.now()
    };

    await saveManagerDeployments(ns, deployments);
    ns.print(`Registered ${managerName} deployment on ${server} (PID: ${pid})`);
}

/**
 * Check if a manager is currently running
 *
 * @param {NS} ns - NetScript object
 * @param {string} managerName - Manager identifier
 * @returns {boolean} True if manager is running
 */
export function isManagerRunning(ns, managerName) {
    const deployments = loadManagerDeployments(ns);
    const deployment = deployments[managerName];

    if (!deployment) {
        return false;
    }

    // Check if process is still running
    const isRunning = ns.isRunning(deployment.script, deployment.server);

    return isRunning;
}

/**
 * Clean up stale manager deployments (not actually running)
 *
 * @param {NS} ns - NetScript object
 */
export async function cleanupStaleDeployments(ns) {
    const deployments = loadManagerDeployments(ns);
    let cleaned = false;

    for (const managerName in deployments) {
        const deployment = deployments[managerName];
        if (!ns.isRunning(deployment.script, deployment.server)) {
            ns.print(`Cleaning up stale ${managerName} deployment from ${deployment.server}`);
            delete deployments[managerName];
            cleaned = true;
        }
    }

    if (cleaned) {
        await saveManagerDeployments(ns, deployments);
    }
}

/**
 * Check if a server is designated as a manager server (regardless of running state)
 *
 * @param {NS} ns - NetScript object
 * @param {string} serverName - Server hostname to check
 * @returns {boolean} True if server is designated for a manager
 */
export function isManagerServer(ns, serverName) {
    const deployments = loadManagerDeployments(ns);

    for (const managerName in deployments) {
        if (deployments[managerName].server === serverName) {
            // Double-check it's actually running
            const isRunning = ns.isRunning(deployments[managerName].script, serverName);
            ns.print(`Manager check: ${serverName} hosts ${managerName} (running: ${isRunning})`);
            if (isRunning) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Get deployment info for a manager
 *
 * @param {NS} ns - NetScript object
 * @param {string} managerName - Manager identifier
 * @returns {Object|null} Deployment info or null if not deployed
 */
export function getManagerDeployment(ns, managerName) {
    const deployments = loadManagerDeployments(ns);
    return deployments[managerName] || null;
}

/**
 * Unregister a manager deployment
 *
 * @param {NS} ns - NetScript object
 * @param {string} managerName - Manager identifier
 */
export async function unregisterManagerDeployment(ns, managerName) {
    const deployments = loadManagerDeployments(ns);

    if (deployments[managerName]) {
        delete deployments[managerName];
        await saveManagerDeployments(ns, deployments);
        ns.print(`Unregistered ${managerName} deployment`);
    }
}

/**
 * Update last check time for a manager
 *
 * @param {NS} ns - NetScript object
 * @param {string} managerName - Manager identifier
 */
export async function updateManagerCheck(ns, managerName) {
    const deployments = loadManagerDeployments(ns);

    if (deployments[managerName]) {
        deployments[managerName].lastCheck = Date.now();
        await saveManagerDeployments(ns, deployments);
    }
}

/**
 * Get all manager deployments
 *
 * @param {NS} ns - NetScript object
 * @returns {Object} All deployments
 */
export function getAllManagerDeployments(ns) {
    return loadManagerDeployments(ns);
}

/**
 * Get list of servers that are running managers
 *
 * @param {NS} ns - NetScript object
 * @returns {string[]} Array of server hostnames running managers
 */
export function getManagerServers(ns) {
    const deployments = loadManagerDeployments(ns);
    const servers = [];

    for (const managerName in deployments) {
        const deployment = deployments[managerName];
        // Only include if manager is actually running
        if (ns.isRunning(deployment.script, deployment.server)) {
            servers.push(deployment.server);
        }
    }

    return servers;
}
