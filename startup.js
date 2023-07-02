/** @param {NS} ns */
export async function main(ns) {

    ns.disableLog("ALL"); // I just want to focus on the messages that I push out.

    const GLOBALS = {
        GLOBALS_PORT: 7, // For reference
        HOME_SERVER: "home",
        PURCHASE_SERVER_PREFIX: "pserv-",
        TARGET_SERVER_DATA_PORT: 1,
        TARGET_SERVER: {
            targetServer: "n00dles",
            targetServerMaxMoney: 0,
        },
        PLAYER_SCRIPTS: {
            infiltrate: {
                starting_order: 0,
                name: 'infiltrate',
                script: "infiltration.js",
                description: "This script will automates the infiltration option for easy money and reputation."
            },
            hacknet: {
                starting_order: 1,
                name: 'hacknet-manager',
                script: "hacknet.js",
                description: "This script will manage the hacknet nodes. It will purchase new nodes, upgrade nodes, and run the hacknet nodes."
            },
            purchaseServer: {
                starting_order: 2,
                name: 'purchase-server',
                script: "purchase-server.js",
                description: "This script will purchase new servers and upgrade them."
            },
            targetServer: {
                starting_order: 3,
                name: 'target-server',
                script: "target-server.js",
                description: "This script will target the highest value server and update the global target."
            },
            stockBroker: {
                starting_order: 4,
                name: 'stock-broker',
                script: "broker-init.js",
                description: "This script will manage the stocks."
            },
            crawler: {
                starting_order: -~5,
                name: 'crawler',
                script: "crawler.js",
                description: "This script will crawl the network, open servers, and begin the miner."
            },
            hack: {
                starting_order: -1, // This should not be part of the start process, but is referenced as part of the crawler.
                name: 'hack-template',
                script: "hack.js",
                description: "This script will grow(), weaken(), and hack() the target server."
            }
        },
        HACKING_PROGRAMS: [
            { name: 'BruteSSH.exe', fn: ns.brutessh },
            { name: 'FTPCrack.exe', fn: ns.ftpcrack },
            { name: 'relaySMTP.exe', fn: ns.relaysmtp },
            { name: 'HTTPWorm.exe', fn: ns.httpworm },
            { name: 'SQLInject.exe', fn: ns.sqlinject },
        ]
    };

    await ns.clearPort(GLOBALS.GLOBALS_PORT);
    await ns.writePort(GLOBALS.GLOBALS_PORT, JSON.stringify(GLOBALS));

    const HOME_SERVER = GLOBALS.HOME_SERVER;
    const PLAYER_SCRIPTS = GLOBALS.PLAYER_SCRIPTS;

    for (let scr in PLAYER_SCRIPTS) {
        if (PLAYER_SCRIPTS[scr].starting_order < 0) continue;

        try {
            await ns.sleep(1000);
            if (!ns.scriptRunning(PLAYER_SCRIPTS[scr].script, HOME_SERVER)) {
                ns.exec(PLAYER_SCRIPTS[scr].script, HOME_SERVER)
            };
        }
        catch (e) {
            ns.tprint(`Error starting ${PLAYER_SCRIPTS[scr].script} on ${HOME_SERVER}`);
            ns.tprint(e);
        }
        finally {
            ns.toast(`${PLAYER_SCRIPTS[scr].name} has been started.`, "success");
            await ns.sleep(1000);
        }
    };

    ns.toast("All scripts have been started.", "info");
}
