/**
 * Script Management Utilities
 * Functions for deploying, executing, and managing scripts across servers
 */

import { calculateMaxThreads } from '/game-scripts/lib/ram-utils.js';

/**
 * Deploys a script to a server and executes it with maximum threads
 *
 * Purpose: Common pattern of copy → kill existing → exec with max threads
 * Used by: hack-manager.js, purchase-server-manager.js (2 files with extensive logic)
 *
 * This function:
 * 1. Validates server has root access
 * 2. Checks if server can run scripts (has RAM)
 * 3. Copies script from home to target
 * 4. Optionally kills existing instances
 * 5. Calculates maximum threads
 * 6. Executes script
 *
 * @param {NS} ns - NetScript object
 * @param {string} scriptPath - Path to script file (on home)
 * @param {string} targetHost - Server to deploy to
 * @param {boolean} killExisting - Kill existing instances before deploying (default: true)
 * @param {...any} args - Arguments to pass to the script
 * @returns {number} PID of executed script, or 0 on failure
 *
 * @example
 * const pid = deployScript(ns, "workers/bot-worker.js", "n00dles");
 * // Copies bot-worker.js to n00dles, runs with max threads
 * // Returns: 1234 (PID)
 *
 * const pid2 = deployScript(ns, "hack.js", "pserv-0001", false, "joesguns");
 * // Deploys hack.js without killing existing, passes "joesguns" as arg
 */
export function deployScript(ns, scriptPath, targetHost, killExisting = true, ...args) {
    // Validate root access
    if (!ns.hasRootAccess(targetHost)) {
        ns.print(`ERROR: No root access on ${targetHost}`);
        return 0;
    }

    // Check if server can run scripts
    if (ns.getServerMaxRam(targetHost) === 0) {
        ns.print(`ERROR: ${targetHost} cannot run scripts (no RAM)`);
        return 0;
    }

    // Validate script exists on home
    if (!ns.fileExists(scriptPath, "home")) {
        ns.print(`ERROR: Script ${scriptPath} not found on home`);
        return 0;
    }

    // Get script RAM cost
    const scriptRam = ns.getScriptRam(scriptPath);
    if (scriptRam === 0) {
        ns.print(`ERROR: Script ${scriptPath} has 0 RAM cost or doesn't exist`);
        return 0;
    }

    // Check if target has enough RAM for at least 1 thread
    const availableRam = ns.getServerMaxRam(targetHost) - ns.getServerUsedRam(targetHost);
    if (availableRam < scriptRam) {
        ns.print(`ERROR: ${targetHost} has insufficient RAM (need ${scriptRam}GB, have ${availableRam}GB)`);
        return 0;
    }

    // Copy script to target
    if (!ns.scp(scriptPath, targetHost)) {
        ns.print(`ERROR: Failed to copy ${scriptPath} to ${targetHost}`);
        return 0;
    }

    // Kill existing instances if requested
    if (killExisting && ns.scriptRunning(scriptPath, targetHost)) {
        ns.scriptKill(scriptPath, targetHost);
        ns.print(`Killed existing ${scriptPath} on ${targetHost}`);
    }

    // Calculate maximum threads
    const threads = calculateMaxThreads(ns, scriptPath, targetHost, 0);

    if (threads === 0) {
        ns.print(`ERROR: Cannot run ${scriptPath} on ${targetHost} (0 threads available)`);
        return 0;
    }

    // Execute script
    const pid = ns.exec(scriptPath, targetHost, threads, ...args);

    if (pid !== 0) {
        ns.print(`SUCCESS: Deployed ${scriptPath} on ${targetHost} with ${threads} threads (PID: ${pid})`);
    } else {
        ns.print(`ERROR: Failed to execute ${scriptPath} on ${targetHost}`);
    }

    return pid;
}

/**
 * Executes a script and waits for it to complete
 *
 * Purpose: Common pattern of exec → wait in loop → continue
 * Used by: overlord.js (TOR, contracts, augmentations), main.js, hack-manager.js (5 files)
 *
 * @param {NS} ns - NetScript object
 * @param {string} scriptPath - Path to script file
 * @param {string} hostname - Server to run on (default: "home")
 * @param {...any} args - Arguments to pass to the script
 * @returns {Promise<boolean>} True if script completed, false if failed to start
 *
 * @example
 * await runScriptAndWait(ns, "discovery/server-discovery.js");
 * // Runs server discovery, waits for completion, then continues
 * ns.print("Discovery complete!");
 *
 * await runScriptAndWait(ns, "managers/tor-manager.js", "home");
 * // Runs TOR manager on home, blocks until finished
 */
export async function runScriptAndWait(ns, scriptPath, hostname = "home", ...args) {
    // Check if script exists
    if (!ns.fileExists(scriptPath, hostname)) {
        ns.print(`ERROR: Script ${scriptPath} not found on ${hostname}`);
        return false;
    }

    // Execute script with 1 thread
    const pid = ns.exec(scriptPath, hostname, 1, ...args);

    if (pid === 0) {
        ns.print(`ERROR: Failed to execute ${scriptPath} on ${hostname} (may already be running)`);
        return false;
    }

    ns.print(`Running ${scriptPath} on ${hostname} (PID: ${pid})...`);

    // Wait for script to complete
    while (ns.isRunning(pid)) {
        await ns.sleep(100);
    }

    ns.print(`${scriptPath} completed`);
    return true;
}

/**
 * Safely executes a script with RAM check
 *
 * Purpose: Checks if script can run before attempting, avoids errors
 * Used by: overlord.js for checking/running optional managers
 *
 * @param {NS} ns - NetScript object
 * @param {string} scriptPath - Path to script file
 * @param {string} hostname - Server to run on (default: "home")
 * @param {...any} args - Arguments to pass to the script
 * @returns {number} PID if successful, 0 otherwise
 *
 * @example
 * const pid = safeExec(ns, "managers/hacknet-farm.js");
 * if (pid !== 0) {
 *     ns.print("Hacknet farm started");
 * } else {
 *     ns.print("Could not start hacknet farm (insufficient RAM or already running)");
 * }
 */
export function safeExec(ns, scriptPath, hostname = "home", ...args) {
    // Check if script exists
    if (!ns.fileExists(scriptPath, hostname)) {
        ns.print(`WARNING: ${scriptPath} not found - skipping`);
        return 0;
    }

    // Get script RAM requirement
    const scriptRam = ns.getScriptRam(scriptPath, hostname);
    if (scriptRam === 0) {
        ns.print(`WARNING: ${scriptPath} has 0 RAM cost - skipping`);
        return 0;
    }

    // Check available RAM
    const availableRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);

    if (availableRam < scriptRam) {
        ns.print(`WARNING: Not enough RAM to run ${scriptPath} (need ${scriptRam}GB, have ${availableRam}GB)`);
        return 0;
    }

    // Execute script
    const pid = ns.exec(scriptPath, hostname, 1, ...args);

    if (pid !== 0) {
        ns.print(`Started ${scriptPath} on ${hostname} (PID: ${pid})`);
    } else {
        ns.print(`Failed to execute ${scriptPath} - may already be running`);
    }

    return pid;
}
