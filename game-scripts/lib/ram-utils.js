/**
 * RAM & Thread Calculation Utilities
 * Functions for calculating available RAM and optimal thread counts
 */

/**
 * Calculates available RAM on a server
 *
 * Purpose: Determines how much RAM is free for running scripts
 * Used by: offline-worker.js, overlord.js, hack-manager.js, hacknet-farm.js (5 files!)
 *
 * @param {NS} ns - NetScript object
 * @param {string} hostname - Server hostname to check
 * @param {number} reservePercent - Percentage of total RAM to reserve (0-100, default: 0)
 * @returns {number} Available RAM in GB
 *
 * @example
 * const available = getAvailableRam(ns, "home");
 * // Returns: 200 (if home has 512GB total, 312GB used)
 *
 * const availableWithReserve = getAvailableRam(ns, "home", 10);
 * // Returns: 148.8 (reserves 10% of 512GB = 51.2GB, so 512 - 312 - 51.2 = 148.8)
 */
export function getAvailableRam(ns, hostname, reservePercent = 0) {
    const totalRam = ns.getServerMaxRam(hostname);
    const usedRam = ns.getServerUsedRam(hostname);
    const reservedRam = totalRam * (reservePercent / 100);

    const available = totalRam - usedRam - reservedRam;

    // Never return negative RAM
    return Math.max(0, available);
}

/**
 * Calculates maximum threads for a script on a server
 *
 * Purpose: Determines how many threads can run given RAM constraints
 * Used by: offline-worker.js, hack-manager.js, purchase-server-manager.js
 *
 * @param {NS} ns - NetScript object
 * @param {string} scriptPath - Path to script file
 * @param {string} hostname - Server to run on
 * @param {number} reservePercent - Percentage of RAM to reserve (default: 0)
 * @returns {number} Maximum threads possible (minimum 0)
 *
 * @example
 * const threads = calculateMaxThreads(ns, "workers/bot-worker.js", "home", 10);
 * // If bot-worker.js uses 2.4GB per thread and home has 148.8GB available:
 * // Returns: 62 (floor of 148.8 / 2.4)
 *
 * const threads2 = calculateMaxThreads(ns, "hack.js", "n00dles");
 * // If hack.js uses 1.7GB and n00dles has 8GB free:
 * // Returns: 4 (floor of 8 / 1.7)
 */
export function calculateMaxThreads(ns, scriptPath, hostname, reservePercent = 0) {
    const scriptRam = ns.getScriptRam(scriptPath);

    // Script doesn't exist or has 0 RAM cost
    if (scriptRam === 0) {
        ns.print(`WARNING: Script ${scriptPath} not found or has 0 RAM cost`);
        return 0;
    }

    const availableRam = getAvailableRam(ns, hostname, reservePercent);
    const maxThreads = Math.floor(availableRam / scriptRam);

    return Math.max(0, maxThreads);
}

/**
 * Calculates optimal thread distribution for hack/grow/weaken operations
 *
 * Purpose: Advanced calculation using Formulas.exe for optimal batching
 * Used by: hack-manager.js for sophisticated targeting
 *
 * This function calculates the ideal number of threads needed for:
 * - Growing server to max money
 * - Weakening security increase from grow
 * - Hacking a percentage of money
 * - Weakening security increase from hack
 *
 * @param {NS} ns - NetScript object
 * @param {string} targetServer - Server to hack
 * @param {string} workerServer - Server running the scripts
 * @param {number} scriptRam - RAM cost per thread
 * @returns {Object} Thread distribution: {grow, weakenGrow, hack, weakenHack, total}
 *                   Returns null if Formulas.exe not available or insufficient RAM
 *
 * @example
 * const threads = calculateOptimalThreads(ns, "joesguns", "pserv-0001", 1.75);
 * // Returns: {
 * //   grow: 500,
 * //   weakenGrow: 40,
 * //   hack: 100,
 * //   weakenHack: 4,
 * //   total: 644
 * // }
 *
 * // If not enough RAM or no Formulas.exe:
 * // Returns: null
 */
export function calculateOptimalThreads(ns, targetServer, workerServer, scriptRam) {
    // Check if Formulas.exe is available
    if (!ns.fileExists("Formulas.exe", "home")) {
        return null;
    }

    try {
        const serverObj = ns.getServer(targetServer);
        const player = ns.getPlayer();

        // Calculate grow threads needed to double money
        const growThreads = Math.ceil(ns.growthAnalyze(targetServer, 2));

        // Weaken threads needed to counter grow security increase
        // Each grow increases security by 0.004, each weaken reduces by 0.05
        // Ratio: 0.004 / 0.05 = 0.08, so need 1 weaken per 12.5 grows
        const weakenThreadsForGrow = Math.ceil(growThreads / 12.5);

        // Calculate hack threads to take 50% of money
        const hackPercent = ns.formulas.hacking.hackPercent(serverObj, player);
        const hackThreads = Math.floor(0.5 / hackPercent);

        // Weaken threads needed to counter hack security increase
        // Each hack increases security by 0.002, each weaken reduces by 0.05
        // Ratio: 0.002 / 0.05 = 0.04, so need 1 weaken per 25 hacks
        const weakenThreadsForHack = Math.ceil(hackThreads / 25);

        const totalThreads = growThreads + weakenThreadsForGrow + hackThreads + weakenThreadsForHack;

        // Check if worker server has enough RAM
        const maxThreads = calculateMaxThreads(ns, "dummy.js", workerServer, 0);
        const maxThreadsForRam = Math.floor(getAvailableRam(ns, workerServer) / scriptRam);

        if (totalThreads > maxThreadsForRam) {
            // Not enough RAM for optimal distribution
            return null;
        }

        return {
            grow: growThreads,
            weakenGrow: weakenThreadsForGrow,
            hack: hackThreads,
            weakenHack: weakenThreadsForHack,
            total: totalThreads
        };
    } catch (error) {
        ns.print(`ERROR: Failed to calculate optimal threads for ${targetServer}: ${error.message}`);
        return null;
    }
}
