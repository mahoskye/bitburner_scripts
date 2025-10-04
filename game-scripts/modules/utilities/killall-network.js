/**
 * Kill All Network Scripts
 * Utility to kill all scripts across the entire network
 *
 * USAGE:
 *   run utilities/killall-network.js
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

    // Kill all scripts on each server
    let killedCount = 0;
    for (const server of servers) {
        const processes = ns.ps(server);
        if (processes.length > 0) {
            ns.killall(server);
            ns.tprint(`Killed ${processes.length} scripts on ${server}`);
            killedCount += processes.length;
        }
    }

    ns.tprint(`\nTotal: Killed ${killedCount} scripts across ${servers.length} servers`);
}
