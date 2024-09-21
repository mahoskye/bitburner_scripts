/** @param {NS} ns */
export async function main(ns) {
    // Configuration object for easy management of constants
    const CONFIG = {
        HOME_SERVER: "home",
        HACKING_PROGRAMS: [
            { name: "BruteSSH.exe", action: ns.brutessh },
            { name: "FTPCrack.exe", action: ns.ftpcrack },
            { name: "relaySMTP.exe", action: ns.relaysmtp },
            { name: "HTTPWorm.exe", action: ns.httpworm },
            { name: "SQLInject.exe", action: ns.sqlinject },
        ],
        BOT_SCRIPT: "early-hack-template.js",
        SERVER_INFO_FILE: "/servers/server_info.txt",
        BACKDOOR_SCRIPT: "backdoor-manager.js",
        DISCOVERY_SCRIPT: "server-discovery.js",
    };

    const BOT_SCRIPT_RAM = ns.getScriptRam(CONFIG.BOT_SCRIPT);
    const PLAYER_HACK_LEVEL = ns.getHackingLevel();
    const PLAYER_PROGRAMS = getPlayerPrograms();

    // Run server discovery and get updated server info
    await runServerDiscovery();
    const serverInfo = await getServerInfo();

    // Process all servers: attempt to gain root access and deploy scripts
    const { serversRooted, serversDeployed, errors } = processServers(serverInfo);

    // Log summary of operations
    ns.tprint(
        `Summary: Rooted ${serversRooted} new servers, deployed scripts on ${serversDeployed} servers. Encountered ${errors} errors.`
    );

    // Attempt to run the backdoor manager script
    await runBackdoorManager();

    function getPlayerPrograms() {
        // Determine which hacking programs the player has access to
        const programs = new Set();
        for (const program of CONFIG.HACKING_PROGRAMS) {
            if (ns.fileExists(program.name, CONFIG.HOME_SERVER)) programs.add(program);
        }
        ns.tprint(`Player has access to ${programs.size} hacking programs.`);
        return programs;
    }

    async function runServerDiscovery() {
        // Run the server discovery script
        ns.tprint("Starting server discovery...");
        try {
            await ns.exec(CONFIG.DISCOVERY_SCRIPT, CONFIG.HOME_SERVER, 1);
            await ns.sleep(1000); // Wait for discovery to complete
        } catch (error) {
            ns.tprint(`ERROR: Failed to run server discovery script. Error: ${error.message}`);
            throw error;
        }
    }

    async function getServerInfo() {
        // Read and parse the server info file
        try {
            const fileContents = ns.read(CONFIG.SERVER_INFO_FILE);
            if (!fileContents) {
                throw new Error(`${CONFIG.SERVER_INFO_FILE} is empty or doesn't exist.`);
            }
            const serverInfo = JSON.parse(fileContents);
            ns.tprint(`Successfully parsed server info. Found ${serverInfo.length} servers.`);
            return serverInfo;
        } catch (error) {
            ns.tprint(`ERROR: Failed to read or parse server info. Error: ${error.message}`);
            throw error;
        }
    }

    function processServers(serverInfo) {
        // Process each server: try to gain root access and deploy scripts
        let serversRooted = 0,
            serversDeployed = 0,
            errors = 0;

        for (const server of serverInfo) {
            if (server.hostname === CONFIG.HOME_SERVER) continue;

            try {
                if (attemptRootAccess(server)) serversRooted++;
                if (deployScript(server)) serversDeployed++;
            } catch (error) {
                ns.print(`ERROR: Failed to process ${server.hostname}. Error: ${error.message}`);
                errors++;
            }
        }

        return { serversRooted, serversDeployed, errors };
    }

    function attemptRootAccess(server) {
        // Try to gain root access on a server
        if (ns.hasRootAccess(server.hostname)) return false;

        if (PLAYER_PROGRAMS.size >= server.numPortsRequired && PLAYER_HACK_LEVEL >= server.requiredHackingSkill) {
            PLAYER_PROGRAMS.forEach((program) => program.action(server.hostname));
            ns.nuke(server.hostname);
            if (ns.hasRootAccess(server.hostname)) {
                ns.tprint(`Gained root access on ${server.hostname}`);
                return true;
            }
        }
        return false;
    }

    function deployScript(server) {
        // Deploy and run the bot script on a server
        if (!ns.hasRootAccess(server.hostname) || !server.canRunScripts || server.maxRam < BOT_SCRIPT_RAM) return false;

        ns.scp(CONFIG.BOT_SCRIPT, server.hostname);
        if (ns.scriptRunning(CONFIG.BOT_SCRIPT, server.hostname)) {
            ns.scriptKill(CONFIG.BOT_SCRIPT, server.hostname);
        }

        const threads = calculateThreads(server.hostname);
        if (ns.exec(CONFIG.BOT_SCRIPT, server.hostname, threads)) {
            ns.tprint(`Deployed ${CONFIG.BOT_SCRIPT} on ${server.hostname} with ${threads} threads`);
            return true;
        }
        return false;
    }

    function calculateThreads(server) {
        // Calculate the number of threads to use for the bot script
        const availableRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        const availableThreads = Math.floor(availableRam / BOT_SCRIPT_RAM);

        if (ns.fileExists("Formulas.exe", "home")) {
            try {
                const serverObj = ns.getServer(server);
                const player = ns.getPlayer();

                const growThreads = Math.ceil(ns.growthAnalyze(server, 2));
                const weakenThreadsForGrow = Math.ceil(growThreads / 12.5);
                const hackThreads = Math.floor(0.5 / ns.formulas.hacking.hackPercent(serverObj, player));
                const weakenThreadsForHack = Math.ceil(hackThreads / 25);

                const totalThreads = growThreads + weakenThreadsForGrow + hackThreads + weakenThreadsForHack;

                return Math.min(totalThreads, availableThreads);
            } catch (error) {
                ns.print(`Error in advanced thread calculation: ${error}. Falling back to simple calculation.`);
            }
        }

        return Math.max(availableThreads, 1);
    }

    async function runBackdoorManager() {
        // Attempt to run the backdoor manager script if it exists and there's enough RAM
        if (ns.fileExists(CONFIG.BACKDOOR_SCRIPT, CONFIG.HOME_SERVER)) {
            const scriptRam = ns.getScriptRam(CONFIG.BACKDOOR_SCRIPT);
            const availableRam = ns.getServerMaxRam(CONFIG.HOME_SERVER) - ns.getServerUsedRam(CONFIG.HOME_SERVER);
            if (availableRam >= scriptRam) {
                ns.tprint("Running backdoor manager...");
                ns.exec(CONFIG.BACKDOOR_SCRIPT, CONFIG.HOME_SERVER, 1);
            } else {
                ns.tprint("Not enough RAM to run backdoor manager.");
            }
        } else {
            ns.tprint("Backdoor manager script not found.");
        }
    }
}
