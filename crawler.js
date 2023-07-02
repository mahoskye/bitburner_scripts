/** @param {NS} ns */
export async function main(ns) {

    ns.disableLog("sleep");

    while (ns.peek(7) === 'NULL PORT DATA') {
        await ns.sleep(1000);
    }

    const GLOBALS = JSON.parse(ns.peek(7));

    const HOME_SERVER = GLOBALS.HOME_SERVER;
    const PLAYER_SCRIPTS = GLOBALS.PLAYER_SCRIPTS;
    const HACKING_PROGRAMS = [
        { name: 'BruteSSH.exe', fn: ns.brutessh },
        { name: 'FTPCrack.exe', fn: ns.ftpcrack },
        { name: 'relaySMTP.exe', fn: ns.relaysmtp },
        { name: 'HTTPWorm.exe', fn: ns.httpworm },
        { name: 'SQLInject.exe', fn: ns.sqlinject },
    ];

    let hackableServers = [];
    let playerPrograms = [];
    let playerHackingLevel = ns.getHackingLevel();
    let RICHEST_SERVER = GLOBALS.TARGET_SERVER;
    let serverList = [HOME_SERVER];

    function getAllServers() {
        for (const server of serverList) {
            let currentScan = ns.scan(server);
            for (const current of currentScan) {
                if (serverList.indexOf(current) === -1) {
                    serverList.push(current);
                }
            }
        }
    }

    // Get all servers
    getAllServers(HOME_SERVER);

    // Check what hacking programs the player has
    for (const program of HACKING_PROGRAMS) {
        if (ns.fileExists(program.name, HOME_SERVER)) {
            playerPrograms.push(program);
        }
    }

    function getServerHackability(target, openablePorts) {
        // Check if the server is hackable or has already been hacked
        let hasRoot = ns.hasRootAccess(target);
        let reqHackingSkill = ns.getServerRequiredHackingLevel(target);
        let portsToNuke = ns.getServerNumPortsRequired(target);

        // If we have access, or are able to hack the server, then:
        if (hasRoot || (reqHackingSkill <= playerHackingLevel
            && portsToNuke <= openablePorts)) {

            // Start collecting data
            let serverMaxRam = ns.getServerMaxRam(target);
            let serverMaxMoney = ns.getServerMaxMoney(target);

            // Take advantage of looping through to find the richest server
            if (serverMaxMoney > RICHEST_SERVER.targetServerMaxMoney) {
                RICHEST_SERVER = {
                    targetServer: target,
                    rootAccess: hasRoot,
                    requiredHackingLevel: reqHackingSkill,
                    portsToNuke: portsToNuke,
                    maxRam: serverMaxRam,
                    targetServerMaxMoney: serverMaxMoney
                };
            }

            // Add the server to the list of hackable servers
            hackableServers.push({
                targetServer: target,
                rootAccess: hasRoot,
                requiredHackingLevel: reqHackingSkill,
                portsToNuke: portsToNuke,
                maxRam: serverMaxRam,
                targetServerMaxMoney: serverMaxMoney
            });
        }
    }


    // Copy and starat the hack script to the remote server
    async function copyAndStartScript(server, hackScriptName) {

        // Skip the home server
        if (server.targetServer !== HOME_SERVER)
            ns.scp(hackScriptName, server.targetServer);


        while (!ns.hasRootAccess(server.targetServer)) {

            // Try to open the ports
            if (playerPrograms.length <= 0) continue;

            for (const program of playerPrograms) {
                program.fn(server.targetServer); // Calls the corresponding ns function for each program
                await ns.sleep(50);
            }

            // Attempt to get root
            ns.nuke(server.targetServer);
            await ns.sleep(50);
        }

        // Kill the script if it's already running
        if (ns.scriptRunning(hackScriptName, server.targetServer)) {
            ns.kill(hackScriptName, server.targetServer);
            await ns.sleep(50);
        }

        // Calculate how many threads we can run
        let threadCnt = Math.floor((server.maxRam - ns.getServerUsedRam(server.targetServer)) / ns.getScriptRam(hackScriptName));

        if (threadCnt < 1 || isNaN(threadCnt)) {
            threadCnt = 1;
        }

        // Start the script
        ns.exec(hackScriptName, server.targetServer, threadCnt);
    }

    // Build the list of hackable servers
    for (const server of serverList) {
        getServerHackability(server, playerPrograms.length);
    }

    // Update the target server in globals
    let global_update = GLOBALS;
    global_update.TARGET_SERVER = RICHEST_SERVER;

    await ns.clearPort(GLOBALS.GLOBALS_PORT);
    await ns.writePort(GLOBALS.GLOBALS_PORT, JSON.stringify(global_update));

    // Hack the servers and initialize the hack script
    await copyAndStartScript(RICHEST_SERVER, PLAYER_SCRIPTS.hack.script);
    await ns.sleep(10000);

    for (const server of hackableServers) {
        await copyAndStartScript(server, PLAYER_SCRIPTS.hack.script);
    }

}
