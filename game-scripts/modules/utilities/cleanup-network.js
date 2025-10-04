/**
 * Network Cleanup Utility
 * Removes all deployed scripts and data files from remote servers
 *
 * DESIGN: Cleans up the network
 * - Kills all running scripts
 * - Removes all deployed files (except .exe and .lit files)
 * - Preserves home server files
 * - Clears manager deployment tracking
 *
 * USAGE:
 *   run modules/utilities/cleanup-network.js
 */

export async function main(ns) {
    // Scan all servers
    const servers = ["home"];
    const seen = new Set(["home"]);

    for (let i = 0; i < servers.length; i++) {
        const neighbors = ns.scan(servers[i]);
        for (const neighbor of neighbors) {
            if (!seen.has(neighbor)) {
                seen.add(neighbor);
                servers.push(neighbor);
            }
        }
    }

    ns.tprint("=== Network Cleanup Starting ===");

    // Clean remote servers (skip home)
    let totalKilled = 0;
    let totalDeleted = 0;

    for (const server of servers) {
        if (server === "home") {
            continue; // Skip home server
        }

        // Kill all scripts
        const processes = ns.ps(server);
        if (processes.length > 0) {
            ns.killall(server);
            totalKilled += processes.length;
            ns.tprint(`${server}: Killed ${processes.length} scripts`);
        }

        // Remove all files (except .exe and .lit)
        const files = ns.ls(server);
        let deletedCount = 0;
        for (const file of files) {
            // Keep programs and literature
            if (file.endsWith('.exe') || file.endsWith('.lit')) {
                continue;
            }

            ns.rm(file, server);
            deletedCount++;
        }

        if (deletedCount > 0) {
            totalDeleted += deletedCount;
            ns.tprint(`${server}: Deleted ${deletedCount} files`);
        }
    }

    // Clear manager deployment tracking on home
    if (ns.fileExists('/data/manager-deployments.txt', 'home')) {
        ns.rm('/data/manager-deployments.txt', 'home');
        ns.tprint("Cleared manager deployment tracking");
    }

    ns.tprint("\n=== Cleanup Complete ===");
    ns.tprint(`Killed ${totalKilled} scripts`);
    ns.tprint(`Deleted ${totalDeleted} files`);
    ns.tprint(`Cleaned ${servers.length - 1} servers`);
}
