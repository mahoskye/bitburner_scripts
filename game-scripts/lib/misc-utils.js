/**
 * Miscellaneous Utilities
 * Small helper functions that don't fit other categories
 */

/**
 * Checks if enough time has passed since last event (cooldown check)
 *
 * Purpose: Common pattern for timing checks and cooldowns
 * Used by: stat-grinder.js for activity switching, overlord.js for discovery intervals
 *
 * @param {number} lastEventTime - Timestamp from Date.now() when event last occurred
 * @param {number} cooldownMs - Cooldown period in milliseconds
 * @returns {boolean} True if cooldown has passed
 *
 * @example
 * let lastDiscovery = Date.now();
 * // ... later ...
 * if (hasCooldownPassed(lastDiscovery, 300000)) {
 *     // 5 minutes have passed, run discovery again
 *     runDiscovery();
 *     lastDiscovery = Date.now();
 * }
 */
export function hasCooldownPassed(lastEventTime, cooldownMs) {
    const now = Date.now();
    const elapsed = now - lastEventTime;
    return elapsed >= cooldownMs;
}

/**
 * Calculates time remaining until next event
 *
 * Purpose: Determine how long until an interval-based event should trigger
 * Used by: Countdown timers, scheduled tasks
 *
 * @param {number} lastEventTime - Timestamp when event last occurred
 * @param {number} intervalMs - Interval in milliseconds
 * @returns {number} Milliseconds until next event (0 if time has passed)
 *
 * @example
 * const remaining = getTimeRemaining(lastDiscovery, 600000);
 * if (remaining === 0) {
 *     // Time to run discovery
 * } else {
 *     ns.print(`Next discovery in ${formatTime(remaining / 1000)}`);
 * }
 */
export function getTimeRemaining(lastEventTime, intervalMs) {
    const now = Date.now();
    const nextEventTime = lastEventTime + intervalMs;
    const remaining = nextEventTime - now;
    return Math.max(0, remaining);
}

/**
 * Checks if a flag is present in script arguments
 *
 * Purpose: Simple argument parsing for command-line flags
 * Used by: main.js, overlord.js, offline-worker.js for --go flag
 *
 * Handles both formats: "--flag" and "flag"
 *
 * @param {NS} ns - NetScript object
 * @param {string} flag - Flag to check for (with or without --)
 * @returns {boolean} True if flag is present
 *
 * @example
 * // Script run as: run main.js --go
 * if (hasFlag(ns, "--go")) {
 *     startGoAutomation();
 * }
 *
 * // Also works without --
 * if (hasFlag(ns, "go")) {
 *     startGoAutomation();
 * }
 */
export function hasFlag(ns, flag) {
    // Normalize flag - ensure it has --
    const normalizedFlag = flag.startsWith("--") ? flag : `--${flag}`;
    // Also check without --
    const shortFlag = flag.startsWith("--") ? flag.substring(2) : flag;

    return ns.args.includes(normalizedFlag) || ns.args.includes(shortFlag);
}

/**
 * Gets argument at index with default value
 *
 * Purpose: Safe argument access with fallback
 * Used by: Scripts that take optional positional arguments
 *
 * @param {NS} ns - NetScript object
 * @param {number} index - Argument index (0-based)
 * @param {*} defaultValue - Default value if argument not present
 * @returns {*} Argument value or defaultValue
 *
 * @example
 * // Script run as: run bot-worker.js 5
 * const portNumber = getArg(ns, 0, 1);
 * // Returns: 5
 *
 * // Script run as: run bot-worker.js
 * const portNumber = getArg(ns, 0, 1);
 * // Returns: 1 (default)
 */
export function getArg(ns, index, defaultValue) {
    if (index < 0 || index >= ns.args.length) {
        return defaultValue;
    }

    const arg = ns.args[index];

    // Return the argument if it exists and is not null/undefined
    return arg !== null && arg !== undefined ? arg : defaultValue;
}

/**
 * Disables common logs for cleaner output
 *
 * Purpose: Standardized log configuration across scripts
 * Used by: Most manager scripts disable sleep, exec, scan logs
 *
 * @param {NS} ns - NetScript object
 * @param {string[]} logs - Array of log types to disable (default: common noisy logs)
 *
 * @example
 * disableCommonLogs(ns);
 * // Disables: sleep, exec, scan, scp, getServerMaxRam, getServerUsedRam
 *
 * disableCommonLogs(ns, ["sleep", "hack", "grow", "weaken"]);
 * // Disables only specified logs
 */
export function disableCommonLogs(ns, logs = null) {
    const defaultLogs = [
        "sleep",
        "exec",
        "scan",
        "scp",
        "getServerMaxRam",
        "getServerUsedRam",
        "getHackingLevel"
    ];

    const logsToDisable = logs || defaultLogs;

    for (const log of logsToDisable) {
        ns.disableLog(log);
    }
}

/**
 * Calculates average of combat stats (str/def/dex/agi)
 *
 * Purpose: Common calculation for combat stat progression
 * Used by: stat-grinder.js for determining training priorities
 *
 * @param {NS} ns - NetScript object
 * @returns {number} Average combat stat level
 *
 * @example
 * const avgCombat = getAverageCombatStat(ns);
 * if (avgCombat < 100) {
 *     // Focus on combat training
 * }
 */
export function getAverageCombatStat(ns) {
    const player = ns.getPlayer();
    const combat = player.skills;

    return (combat.strength + combat.defense + combat.dexterity + combat.agility) / 4;
}
