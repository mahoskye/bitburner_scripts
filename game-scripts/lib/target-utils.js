/**
 * Target Selection Utilities
 * Functions for scoring and selecting optimal hack targets
 */

import { SERVERS } from '/config/servers.js';

/**
 * Calculates hack target score (money/security ratio)
 *
 * Purpose: Scores a server for hacking profitability
 * Used by: findBestHackTarget() and overlord.js
 *
 * Higher score = better target
 * Formula: maxMoney / minSecurityLevel
 *
 * @param {Object} server - Server info object
 * @param {number} playerHackLevel - Player's current hacking level
 * @returns {number} Score value, or -1 if server is not hackable
 *
 * @example
 * const server = {
 *     hostname: "joesguns",
 *     hasRootAccess: true,
 *     maxMoney: 2500000,
 *     minSecurityLevel: 10,
 *     requiredHackingSkill: 10
 * };
 * const score = calculateHackScore(server, 50);
 * // Returns: 250000 (2500000 / 10)
 *
 * const noRootServer = {hasRootAccess: false, maxMoney: 1000000, minSecurityLevel: 5};
 * const score2 = calculateHackScore(noRootServer, 50);
 * // Returns: -1 (no root access)
 */
export function calculateHackScore(server, playerHackLevel) {
    // Must have root access
    if (!server.hasRootAccess) {
        return -1;
    }

    // Must have money
    if (!server.maxMoney || server.maxMoney <= 0) {
        return -1;
    }

    // Must meet hacking level requirement
    if (server.requiredHackingSkill > playerHackLevel) {
        return -1;
    }

    // Calculate score: higher money and lower security = better
    const score = server.maxMoney / server.minSecurityLevel;

    return score;
}

/**
 * Finds the best server to hack based on money/security ratio
 *
 * Purpose: Core targeting algorithm for automated hacking
 * Used by: overlord.js to update target in port (used by all workers)
 *
 * Algorithm:
 * 1. Filter to servers with root access, money, and sufficient hack level
 * 2. Score each server (maxMoney / minSecurityLevel)
 * 3. Return highest scoring server
 * 4. Fall back to default if no suitable target found
 *
 * @param {NS} ns - NetScript object
 * @param {Object[]} servers - Array of server info objects
 * @param {string} defaultTarget - Fallback target if none found (default: "n00dles")
 * @returns {string} Hostname of best target
 *
 * @example
 * const servers = [
 *     {hostname: "n00dles", hasRootAccess: true, maxMoney: 1750000, minSecurityLevel: 1, requiredHackingSkill: 1},
 *     {hostname: "foodnstuff", hasRootAccess: true, maxMoney: 2000000, minSecurityLevel: 3, requiredHackingSkill: 1},
 *     {hostname: "joesguns", hasRootAccess: true, maxMoney: 2500000, minSecurityLevel: 10, requiredHackingSkill: 10}
 * ];
 * const target = findBestHackTarget(ns, servers);
 * // n00dles: 1750000 / 1 = 1,750,000
 * // foodnstuff: 2000000 / 3 = 666,667
 * // joesguns: 2500000 / 10 = 250,000
 * // Returns: "n00dles" (highest score)
 */
export function findBestHackTarget(ns, servers, defaultTarget = SERVERS.DEFAULT_HACK_TARGET) {
    const playerHackLevel = ns.getHackingLevel();

    let bestTarget = null;
    let highestScore = -1;

    for (const server of servers) {
        const score = calculateHackScore(server, playerHackLevel);

        if (score > highestScore) {
            highestScore = score;
            bestTarget = server;
        }
    }

    if (bestTarget) {
        ns.print(`Best target: ${bestTarget.hostname} (Score: ${highestScore.toFixed(2)})`);
        return bestTarget.hostname;
    } else {
        ns.print(`No suitable target found. Defaulting to ${defaultTarget}`);
        return defaultTarget;
    }
}
