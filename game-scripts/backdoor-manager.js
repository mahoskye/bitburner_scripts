/** @param {NS} ns */
export async function main(ns) {
    const serverInfoFile = "/servers/server_info.txt";
    const PLAYER_HACK_LEVEL = ns.getHackingLevel();

    // Check if backdoor function is available
    if (typeof ns.installBackdoor !== "function") {
        ns.tprint("Singularity functions require Source-File 4 (late game).");
        ns.tprint("Backdoors must be installed manually using 'backdoor' terminal command.");

        // Instead, show which servers need backdoors
        showBackdoorTargets();
        return;
    }

    function showBackdoorTargets() {
        const factionServers = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z"];
        ns.tprint("=== MANUAL BACKDOOR TARGETS ===");

        try {
            const fileContents = ns.read(serverInfoFile);
            if (fileContents) {
                const serverInfo = JSON.parse(fileContents);
                const targets = serverInfo.filter(server =>
                    factionServers.includes(server.hostname) &&
                    server.hasRootAccess &&
                    !server.backdoorInstalled &&
                    ns.getHackingLevel() >= server.requiredHackingSkill
                );

                if (targets.length > 0) {
                    targets.forEach(server => {
                        const path = findPathToServer(server.hostname);
                        ns.tprint(`• ${server.hostname} (Hack Level: ${server.requiredHackingSkill})`);
                        if (path) {
                            const connectCommands = path.slice(1).map(host => `connect ${host}`).join('; ');
                            ns.tprint(`  Path: ${path.join(' → ')}`);
                            ns.tprint(`  Commands: ${connectCommands}; backdoor; home`);
                        } else {
                            ns.tprint(`  ERROR: Could not find path to ${server.hostname}`);
                        }
                    });
                } else {
                    ns.tprint("No faction servers ready for backdoor installation.");
                }
            }
        } catch (e) {
            ns.tprint("Could not read server info file.");
        }
    }

    function findPathToServer(targetServer) {
        // BFS to find shortest path from home to target
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

        return null; // Path not found
    }

    // Read server info
    let serverInfo;
    try {
        const fileContents = ns.read(serverInfoFile);
        if (!fileContents) {
            throw new Error(`${serverInfoFile} is empty or doesn't exist.`);
        }
        serverInfo = JSON.parse(fileContents);
    } catch (error) {
        ns.tprint(`ERROR: Failed to read or parse server info. Error: ${error.message}`);
        return;
    }

    let backdoorsInstalled = 0;
    let errors = 0;

    for (const server of serverInfo) {
        if (server.hostname === "home") continue;

        if (
            ns.hasRootAccess(server.hostname) &&
            !server.backdoorInstalled &&
            PLAYER_HACK_LEVEL >= server.requiredHackingSkill
        ) {
            try {
                // Note: In the actual game, you might need to navigate to the server first
                // This is a simplified version
                await ns.installBackdoor(server.hostname);
                backdoorsInstalled++;
                ns.tprint(`Installed backdoor on ${server.hostname}`);

                // Update server info
                server.backdoorInstalled = true;
            } catch (error) {
                ns.print(`WARNING: Failed to install backdoor on ${server.hostname}. Error: ${error.message}`);
                errors++;
            }
        }
    }

    // Write updated server info back to file
    try {
        await ns.write(serverInfoFile, JSON.stringify(serverInfo), "w");
    } catch (error) {
        ns.tprint(`ERROR: Failed to update server info file. Error: ${error.message}`);
    }

    ns.tprint(`Summary: Installed ${backdoorsInstalled} backdoors. Encountered ${errors} errors.`);
}
