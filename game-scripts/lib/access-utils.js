/**
 * Server Access Utilities
 * Functions for gaining root access and managing port-opening programs
 */

import { PROGRAMS } from '/game-scripts/config/money.js';
import { SERVERS } from '/game-scripts/config/servers.js';

/**
 * Gets list of available port-opening programs
 *
 * Purpose: Determines which hacking tools the player owns
 * Used by: hack-manager.js, tor-manager.js
 *
 * @param {NS} ns - NetScript object
 * @returns {Object[]} Array of available program objects with {name, fn, portsOpened}
 *
 * @example
 * const tools = getAvailablePortOpeners(ns);
 * // Returns: [
 * //   {name: "BruteSSH.exe", fn: ns.brutessh, portsOpened: 1},
 * //   {name: "FTPCrack.exe", fn: ns.ftpcrack, portsOpened: 1}
 * // ]
 * // (Only programs that exist on home)
 */
export function getAvailablePortOpeners(ns) {
    const programs = [
        { name: PROGRAMS.BRUTE_SSH, fn: ns.brutessh, portsOpened: 1 },
        { name: PROGRAMS.FTP_CRACK, fn: ns.ftpcrack, portsOpened: 1 },
        { name: PROGRAMS.RELAY_SMTP, fn: ns.relaysmtp, portsOpened: 1 },
        { name: PROGRAMS.HTTP_WORM, fn: ns.httpworm, portsOpened: 1 },
        { name: PROGRAMS.SQL_INJECT, fn: ns.sqlinject, portsOpened: 1 },
    ];

    // Filter to only programs that exist on home
    return programs.filter(program => ns.fileExists(program.name, SERVERS.HOME));
}

/**
 * Counts how many ports can be opened with current programs
 *
 * Purpose: Quick check of player's hacking capability
 * Used by: For determining which servers can be rooted
 *
 * @param {NS} ns - NetScript object
 * @returns {number} Number of ports that can be opened (0-5)
 *
 * @example
 * const portCount = countPortOpeners(ns);
 * // Returns: 3 (if player has BruteSSH, FTPCrack, and relaySMTP)
 *
 * // Can be used to filter servers:
 * const rootableServers = servers.filter(s => s.numPortsRequired <= portCount);
 */
export function countPortOpeners(ns) {
    return getAvailablePortOpeners(ns).length;
}

/**
 * Checks if root access can be gained on a server
 *
 * Purpose: Determines if player meets requirements to nuke a server
 * Used by: Before attempting root access, to avoid errors
 *
 * @param {NS} ns - NetScript object
 * @param {string} hostname - Server hostname to check
 * @returns {boolean} True if requirements are met (hacking level + ports)
 *
 * @example
 * if (canGainRootAccess(ns, "joesguns")) {
 *     gainRootAccess(ns, "joesguns");
 * }
 * // Only attempts if possible
 */
export function canGainRootAccess(ns, hostname) {
    // Already have root
    if (ns.hasRootAccess(hostname)) {
        return false;
    }

    const server = ns.getServer(hostname);
    const player = ns.getPlayer();
    const availablePorts = countPortOpeners(ns);

    // Check hacking level requirement
    if (player.skills.hacking < server.requiredHackingSkill) {
        return false;
    }

    // Check port requirement
    if (availablePorts < server.numOpenPortsRequired) {
        return false;
    }

    return true;
}

/**
 * Attempts to gain root access on a server
 *
 * Purpose: Opens ports and nukes server to gain root access
 * Used by: hack-manager.js (highly reusable pattern)
 *
 * This function:
 * 1. Checks if already rooted (no-op if yes)
 * 2. Verifies requirements are met
 * 3. Runs all available port openers
 * 4. Executes nuke
 * 5. Returns success status
 *
 * @param {NS} ns - NetScript object
 * @param {string} hostname - Server hostname to root
 * @returns {Object} Result object: {success: boolean, alreadyRooted: boolean, reason: string}
 *
 * @example
 * const result = gainRootAccess(ns, "joesguns");
 * if (result.success) {
 *     ns.print(`Gained root on joesguns!`);
 * } else {
 *     ns.print(`Failed: ${result.reason}`);
 * }
 *
 * // Possible returns:
 * // {success: true, alreadyRooted: true}  - Already had root
 * // {success: true, alreadyRooted: false} - Just gained root
 * // {success: false, reason: "Insufficient hacking level"}
 * // {success: false, reason: "Insufficient port openers"}
 */
export function gainRootAccess(ns, hostname) {
    // Already rooted
    if (ns.hasRootAccess(hostname)) {
        return { success: true, alreadyRooted: true };
    }

    const server = ns.getServer(hostname);
    const player = ns.getPlayer();
    const availablePrograms = getAvailablePortOpeners(ns);

    // Check hacking level
    if (player.skills.hacking < server.requiredHackingSkill) {
        return {
            success: false,
            alreadyRooted: false,
            reason: `Insufficient hacking level (need ${server.requiredHackingSkill}, have ${player.skills.hacking})`
        };
    }

    // Check port openers
    if (availablePrograms.length < server.numOpenPortsRequired) {
        return {
            success: false,
            alreadyRooted: false,
            reason: `Insufficient port openers (need ${server.numOpenPortsRequired}, have ${availablePrograms.length})`
        };
    }

    try {
        // Run all available port openers
        // Note: We run ALL available programs, not just the required number
        // This is safe and ensures ports are opened
        for (const program of availablePrograms) {
            program.fn(hostname);
        }

        // Attempt to nuke
        ns.nuke(hostname);

        // Verify success
        if (ns.hasRootAccess(hostname)) {
            ns.print(`SUCCESS: Gained root access on ${hostname}`);
            return { success: true, alreadyRooted: false };
        } else {
            return {
                success: false,
                alreadyRooted: false,
                reason: "Nuke failed (unknown reason)"
            };
        }
    } catch (error) {
        return {
            success: false,
            alreadyRooted: false,
            reason: `Exception: ${error.message}`
        };
    }
}
