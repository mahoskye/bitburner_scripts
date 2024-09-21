/** @param {NS} ns */
export async function main(ns) {
    // Function to get detailed server info
    function getServerInfo(host) {
        try {
            return {
                hostname: host,
                hasRootAccess: ns.hasRootAccess(host),
                canRunScripts: ns.getServerMaxRam(host) > 0,
                maxRam: ns.getServerMaxRam(host),
                backdoorInstalled: ns.getServer(host).backdoorInstalled,
                requiredHackingSkill: ns.getServerRequiredHackingLevel(host),
                numPortsRequired: ns.getServerNumPortsRequired(host),
                moneyAvailable: ns.getServerMoneyAvailable(host),
                maxMoney: ns.getServerMaxMoney(host),
                minSecurityLevel: ns.getServerMinSecurityLevel(host),
                currentSecurityLevel: ns.getServerSecurityLevel(host),
            };
        } catch (error) {
            ns.print(`ERROR: Failed to get info for server ${host}: ${error.message}`);
            return {
                hostname: host,
                error: error.message,
            };
        }
    }

    // Function to recursively scan the network
    function scanNetwork(host, scanned = new Set()) {
        if (scanned.has(host)) return [];

        scanned.add(host);

        let connections;
        try {
            connections = ns.scan(host);
        } catch (error) {
            ns.print(`ERROR: Failed to scan from host ${host}: ${error.message}`);
            return [getServerInfo(host)];
        }

        let servers = [getServerInfo(host)];
        for (const connection of connections) {
            servers = servers.concat(scanNetwork(connection, scanned));
        }
        return servers;
    }

    // Scan the network and write server info to a file
    try {
        const servers = scanNetwork("home");
        const outputPath = "/servers/server_info.txt";
        await ns.write(outputPath, JSON.stringify(servers, null, 2), "w");
        ns.tprint(`SUCCESS: Discovered and stored information for ${servers.length} servers in ${outputPath}`);
    } catch (error) {
        ns.tprint(`CRITICAL ERROR: Script failed: ${error.message}`);
    }
}
