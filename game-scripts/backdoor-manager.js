/** @param {NS} ns */
export async function main(ns) {
    const serverInfoFile = "/servers/server_info.txt";
    const PLAYER_HACK_LEVEL = ns.getHackingLevel();

    // Check if backdoor function is available
    if (typeof ns.installBackdoor !== "function") {
        ns.tprint("Backdoor functionality is not yet available.");
        return;
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
