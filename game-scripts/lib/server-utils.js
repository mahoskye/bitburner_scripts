/**
 * Server Utilities
 * Functions for server discovery, information gathering, and navigation
 */

/**
 * Recursively scans the entire network starting from a given host
 *
 * Purpose: Discovers all servers accessible from a starting point
 * Used by: server-discovery.js, backdoor-manager.js, contract-solver.js
 *
 * @param {NS} ns - NetScript object
 * @param {string} startHost - Starting server hostname (default: "home")
 * @param {Set<string>} visited - Set of already visited hosts (used internally for recursion)
 * @returns {string[]} Array of all discovered server hostnames
 *
 * @example
 * const allServers = scanAllServers(ns);
 * // Returns: ["home", "n00dles", "foodnstuff", "sigma-cosmetics", ...]
 */
export function scanAllServers(ns, startHost = "home", visited = new Set()) {
    // Prevent infinite loops by tracking visited servers
    if (visited.has(startHost)) {
        return [];
    }

    visited.add(startHost);
    let servers = [startHost];

    try {
        const connections = ns.scan(startHost);

        // Recursively scan each connected server
        for (const connection of connections) {
            if (!visited.has(connection)) {
                servers = servers.concat(scanAllServers(ns, connection, visited));
            }
        }
    } catch (error) {
        ns.print(`ERROR: Failed to scan from ${startHost}: ${error.message}`);
    }

    return servers;
}

/**
 * Gets comprehensive information about a server
 *
 * Purpose: Gathers all useful server stats in one object
 * Used by: server-discovery.js, purchase-server-manager.js
 *
 * @param {NS} ns - NetScript object
 * @param {string} hostname - Server hostname to get info for
 * @returns {Object} Server information object containing:
 *   - hostname: Server name
 *   - hasRootAccess: Whether we have root access
 *   - canRunScripts: Whether server can run scripts (has RAM)
 *   - maxRam: Maximum RAM in GB
 *   - backdoorInstalled: Whether backdoor is installed
 *   - requiredHackingSkill: Hacking level needed to hack
 *   - numPortsRequired: Number of ports needed to nuke
 *   - moneyAvailable: Current money on server
 *   - maxMoney: Maximum money server can hold
 *   - minSecurityLevel: Minimum security level
 *   - currentSecurityLevel: Current security level
 *
 * @example
 * const serverInfo = getServerInfo(ns, "n00dles");
 * if (serverInfo.hasRootAccess && serverInfo.maxMoney > 0) {
 *     // Server is hackable
 * }
 */
export function getServerInfo(ns, hostname) {
    try {
        return {
            hostname: hostname,
            hasRootAccess: ns.hasRootAccess(hostname),
            canRunScripts: ns.getServerMaxRam(hostname) > 0,
            maxRam: ns.getServerMaxRam(hostname),
            backdoorInstalled: ns.getServer(hostname).backdoorInstalled,
            requiredHackingSkill: ns.getServerRequiredHackingLevel(hostname),
            numPortsRequired: ns.getServerNumPortsRequired(hostname),
            moneyAvailable: ns.getServerMoneyAvailable(hostname),
            maxMoney: ns.getServerMaxMoney(hostname),
            minSecurityLevel: ns.getServerMinSecurityLevel(hostname),
            currentSecurityLevel: ns.getServerSecurityLevel(hostname),
        };
    } catch (error) {
        ns.print(`ERROR: Failed to get info for ${hostname}: ${error.message}`);
        return {
            hostname: hostname,
            error: error.message,
        };
    }
}

/**
 * Finds the shortest path from one server to another using BFS (Breadth-First Search)
 *
 * Purpose: Used for navigation (e.g., backdoor installation requires manual connection)
 * Used by: backdoor-manager.js
 * Algorithm: BFS ensures we find the SHORTEST path
 *
 * @param {NS} ns - NetScript object
 * @param {string} targetServer - Destination server hostname
 * @param {string} startServer - Starting server (default: "home")
 * @returns {string[]|null} Array of server hostnames representing the path, or null if unreachable
 *
 * @example
 * const path = findServerPath(ns, "CSEC");
 * // Returns: ["home", "joesguns", "CSEC"]
 * // To connect: path.forEach(server => ns.singularity.connect(server))
 */
export function findServerPath(ns, targetServer, startServer = "home") {
    // BFS queue: each element is a path (array of server names)
    const queue = [[startServer]];
    const visited = new Set([startServer]);

    while (queue.length > 0) {
        const path = queue.shift();
        const currentServer = path[path.length - 1];

        // Found the target!
        if (currentServer === targetServer) {
            return path;
        }

        try {
            const connections = ns.scan(currentServer);

            for (const neighbor of connections) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    // Create new path by appending neighbor
                    queue.push([...path, neighbor]);
                }
            }
        } catch (error) {
            ns.print(`ERROR: Failed to scan ${currentServer}: ${error.message}`);
            continue;
        }
    }

    // Target not found
    return null;
}

/**
 * Filters servers based on specified criteria
 *
 * Purpose: Common pattern of filtering server lists by various conditions
 * Used by: hack-manager.js, purchase-server-manager.js, contract-solver.js
 *
 * @param {Object[]} servers - Array of server info objects (from getServerInfo)
 * @param {Object} criteria - Filter criteria object with optional properties:
 *   - hasRoot: (boolean) Only servers with root access
 *   - minRam: (number) Minimum RAM in GB
 *   - canRunScripts: (boolean) Only servers that can run scripts
 *   - minMoney: (number) Minimum max money
 *   - maxHackLevel: (number) Maximum required hacking level
 * @returns {Object[]} Filtered array of servers
 *
 * @example
 * const servers = allServers.map(host => getServerInfo(ns, host));
 * const hackableServers = filterServers(servers, {
 *     hasRoot: true,
 *     minMoney: 1000000,
 *     maxHackLevel: ns.getHackingLevel()
 * });
 */
export function filterServers(servers, criteria = {}) {
    return servers.filter(server => {
        // Skip servers with errors
        if (server.error) return false;

        // Check root access
        if (criteria.hasRoot !== undefined && server.hasRootAccess !== criteria.hasRoot) {
            return false;
        }

        // Check RAM
        if (criteria.minRam !== undefined && server.maxRam < criteria.minRam) {
            return false;
        }

        // Check if can run scripts
        if (criteria.canRunScripts !== undefined && server.canRunScripts !== criteria.canRunScripts) {
            return false;
        }

        // Check money
        if (criteria.minMoney !== undefined && server.maxMoney < criteria.minMoney) {
            return false;
        }

        // Check hacking level requirement
        if (criteria.maxHackLevel !== undefined && server.requiredHackingSkill > criteria.maxHackLevel) {
            return false;
        }

        return true;
    });
}

/**
 * Gets all accessible servers (home + purchased + rooted network servers)
 *
 * Purpose: Quick way to get all servers we can use for running scripts
 * Used by: contract-solver.js, and useful for deployment scripts
 *
 * @param {NS} ns - NetScript object
 * @param {boolean} rootedOnly - Only include servers with root access (default: true)
 * @returns {string[]} Array of accessible server hostnames
 *
 * @example
 * const myServers = getAllAccessibleServers(ns);
 * // Returns: ["home", "pserv-0", "pserv-1", "n00dles", "foodnstuff", ...]
 * // (only servers we have root access on)
 */
export function getAllAccessibleServers(ns, rootedOnly = true) {
    const servers = new Set();

    // Always include home
    servers.add("home");

    // Add all purchased servers
    const purchased = ns.getPurchasedServers();
    purchased.forEach(server => servers.add(server));

    // Add all network servers (scan entire network)
    const allServers = scanAllServers(ns);
    for (const hostname of allServers) {
        if (rootedOnly) {
            if (ns.hasRootAccess(hostname)) {
                servers.add(hostname);
            }
        } else {
            servers.add(hostname);
        }
    }

    return Array.from(servers);
}

/**
 * Filters server list to only purchased servers
 *
 * Purpose: Get only player-owned purchased servers (not network servers)
 * Used by: purchase-server-manager.js
 *
 * @param {Object[]} servers - Array of server info objects
 * @param {string} prefix - Server name prefix (default: "pserv")
 * @returns {Object[]} Filtered array of purchased servers only
 *
 * @example
 * const allServers = getAllServerInfo(ns);
 * const myServers = getPurchasedServers(allServers);
 * // Returns only: [{hostname: "pserv-0001", ...}, {hostname: "pserv-0002", ...}]
 */
export function getPurchasedServers(servers, prefix = "pserv") {
    return servers.filter(server => server.hostname.startsWith(prefix));
}

/**
 * Renames a purchased server to ensure standardized naming
 *
 * Purpose: Maintains consistent server naming scheme (pserv-0001, pserv-0002, etc.)
 * Used by: purchase-server-manager.js, rename-servers.js
 *
 * @param {NS} ns - NetScript object
 * @param {string} currentName - Current server name
 * @param {string} desiredName - Desired standardized name
 * @returns {string} Final server name (desiredName if rename succeeded, currentName if failed)
 *
 * @example
 * const finalName = renamePurchasedServer(ns, "purchased-server-1", "pserv-0001");
 * // Renames server and returns "pserv-0001" on success
 */
export function renamePurchasedServer(ns, currentName, desiredName) {
    if (currentName === desiredName) {
        return currentName; // Already correct
    }

    if (ns.renamePurchasedServer(currentName, desiredName)) {
        ns.print(`Renamed server ${currentName} to ${desiredName}`);
        return desiredName;
    } else {
        ns.print(`Failed to rename server ${currentName} to ${desiredName}`);
        return currentName;
    }
}

/**
 * Calculates the next power-of-2 RAM upgrade for a server
 *
 * Purpose: Purchased servers can only have RAM in powers of 2 (8, 16, 32, 64, etc.)
 * Used by: purchase-server-manager.js for upgrading servers
 *
 * @param {NS} ns - NetScript object
 * @param {number} currentRam - Current RAM amount in GB
 * @returns {number} Next RAM upgrade amount (or max if already maxed)
 *
 * @example
 * const currentRam = 64;
 * const nextRam = getNextRamUpgrade(ns, currentRam);
 * // Returns: 128
 *
 * const maxedRam = ns.getPurchasedServerMaxRam();
 * const stillMaxed = getNextRamUpgrade(ns, maxedRam);
 * // Returns: maxedRam (can't upgrade further)
 */
export function getNextRamUpgrade(ns, currentRam) {
    const maxRam = ns.getPurchasedServerMaxRam();
    const minRam = 8; // Minimum server RAM

    let nextRam = minRam;
    while (nextRam <= currentRam) {
        nextRam *= 2;
    }

    return Math.min(nextRam, maxRam);
}
