/**
 * Backdoor Utilities
 * Helper functions for backdoor management
 *
 * NOTE: This module uses ns.getServer() which costs 4GB RAM
 * Only import when home RAM >= 16GB
 */

import { FACTION_SERVERS } from '/config/servers.js';

/**
 * Find path from home to target server (BFS)
 */
function findPathToServer(ns, targetServer) {
    const queue = [["home"]];
    const visited = new Set(["home"]);

    while (queue.length > 0) {
        const path = queue.shift();
        const currentServer = path[path.length - 1];

        if (currentServer === targetServer) {
            return path;
        }

        try {
            const connections = ns.scan(currentServer);
            for (const neighbor of connections) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        } catch (e) {
            // Skip servers we can't scan
            continue;
        }
    }

    return null; // No path found
}

/**
 * Get list of faction servers needing backdoors with connect commands
 * @param {NS} ns - NetScript object
 * @returns {Array} Array of {hostname, command} objects
 */
export function getBackdoorServers(ns) {
    const backdoorServers = [];

    for (const server of FACTION_SERVERS) {
        try {
            const serverObj = ns.getServer(server);
            if (serverObj.hasAdminRights && !serverObj.backdoorInstalled) {
                const path = findPathToServer(ns, server);
                if (path) {
                    const connectCmd = path.slice(1).map(host => `connect ${host}`).join('; ') + '; backdoor';
                    backdoorServers.push({ hostname: server, command: connectCmd });
                }
            }
        } catch (e) {
            // Server doesn't exist or can't access yet
        }
    }

    return backdoorServers;
}
