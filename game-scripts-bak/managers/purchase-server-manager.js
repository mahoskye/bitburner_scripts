/** @param {NS} ns */
export async function main(ns) {
    const maxRam = ns.getPurchasedServerMaxRam();
    const script = "workers/bot-worker.js";
    const serverInfoFile = "servers/server_info.txt";
    const minRam = 8; // Starting RAM size

    // Early game check - don't buy servers if player has less than 100k
    const playerMoney = ns.getServerMoneyAvailable("home");
    if (playerMoney < 100_000) {
        ns.print("Early game detected - server purchasing disabled until 100k money");
        return;
    }

    // Disable default logging
    ns.disableLog("ALL");
    // Enable only essential logs
    ns.enableLog("print");

    // Function to read and parse server info from file
    function readServerInfo() {
        if (ns.fileExists(serverInfoFile)) {
            const fileContent = ns.read(serverInfoFile);
            return JSON.parse(fileContent);
        }
        return [];
    }

    // Function to get purchased servers from the server info
    function getPurchasedServers(serverInfo) {
        return serverInfo.filter((server) => server.hostname.startsWith("pserv-"));
    }

    // Function to ensure server has the correct name
    function ensureCorrectServerName(currentName, desiredName) {
        if (currentName !== desiredName) {
            if (ns.renamePurchasedServer(currentName, desiredName)) {
                ns.print(`Renamed server ${currentName} to ${desiredName}`);
                return desiredName;
            } else {
                ns.print(`Failed to rename server ${currentName} to ${desiredName}`);
                return currentName;
            }
        }
        return currentName;
    }

    // Function to get the next RAM upgrade for a server
    function getNextRamUpgrade(currentRam) {
        let nextRam = minRam;
        while (nextRam <= currentRam) {
            nextRam *= 2;
        }
        return Math.min(nextRam, maxRam);
    }

    while (true) {
        const serverInfo = readServerInfo();
        let purchasedServers = getPurchasedServers(serverInfo);
        const serverLimit = ns.getPurchasedServerLimit();

        // Sort servers by hostname to ensure consistent ordering
        purchasedServers.sort((a, b) => a.hostname.localeCompare(b.hostname));

        let allServersMaxed = true;
        let upgradedThisRound = false;

        for (let i = 0; i < serverLimit; i++) {
            const standardName = `pserv-${i.toString().padStart(4, '0')}`;
            const existingServer = purchasedServers.find((s) => s.hostname === standardName);

            if (!existingServer && purchasedServers.length < serverLimit) {
                // Purchase new server if we're under the limit
                const cost = ns.getPurchasedServerCost(minRam);
                if (ns.getServerMoneyAvailable("home") >= cost) {
                    const newServer = ns.purchaseServer(standardName, minRam);
                    if (newServer !== "") {
                        const correctedName = ensureCorrectServerName(newServer, standardName);
                        await ns.scp(script, correctedName);
                        const threads = Math.floor(minRam / ns.getScriptRam(script));
                        ns.exec(script, correctedName, threads);
                        ns.print(
                            `New server ${correctedName} purchased with ${minRam}GB RAM, running ${threads} threads of ${script}`
                        );
                        upgradedThisRound = true;
                    }
                }
                allServersMaxed = false;
            } else if (existingServer) {
                const currentRam = existingServer.maxRam;
                const nextRam = getNextRamUpgrade(currentRam);

                if (currentRam < maxRam) {
                    allServersMaxed = false;
                    const cost = ns.getPurchasedServerCost(nextRam);
                    if (ns.getServerMoneyAvailable("home") >= cost) {
                        ns.killall(existingServer.hostname);
                        if (ns.deleteServer(existingServer.hostname)) {
                            const upgradedServer = ns.purchaseServer(standardName, nextRam);
                            if (upgradedServer !== "") {
                                const correctedName = ensureCorrectServerName(upgradedServer, standardName);
                                await ns.scp(script, correctedName);
                                const scriptRam = ns.getScriptRam(script);
                                let threads = 0;
                                if (scriptRam > 0) {
                                    threads = Math.floor(nextRam / scriptRam);
                                    if (threads > 0) {
                                        ns.exec(script, correctedName, threads);
                                        ns.print(
                                            `Server ${correctedName} upgraded from ${currentRam}GB to ${nextRam}GB RAM, running ${threads} threads of ${script}`
                                        );
                                    } else {
                                        ns.print(`WARNING: Not enough RAM on ${correctedName} to run ${script}`);
                                    }
                                } else {
                                    ns.print(`ERROR: Script ${script} not found or has 0 RAM cost`);
                                }
                                upgradedThisRound = true;
                            }
                        } else {
                            ns.print(`Failed to delete server ${existingServer.hostname} for upgrade. Skipping.`);
                        }
                    }
                }
            }
        }

        if (allServersMaxed) {
            ns.print("All servers upgraded to maximum RAM!");
            break;
        }

        // Wait before next iteration, longer if no upgrades were made
        await ns.sleep(upgradedThisRound ? 1000 : 60_000);
    }
}
