/** @param {NS} ns */
export async function main(ns) {

    ns.disableLog("sleep");
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getServerMoneyAvailable");

    while (ns.peek(7) === 'NULL PORT DATA') {
        await ns.sleep(1000);
    }

    const GLOBALS = JSON.parse(ns.peek(7));

    const HOME_SERVER = GLOBALS.HOME_SERVER;
    const PLAYER_SCRIPTS = GLOBALS.PLAYER_SCRIPTS;
    const PURCHASE_SERVER_PREFIX = GLOBALS.PURCHASE_SERVER_PREFIX;

    // Starting RAM for our servers
    // The minimum effective RAM is 8GB, so we'll start there
    const STARTING_UPGRADE = 3; // 2^3 = 8GB

    // Since we know we're dealing with powers of 2, we can use log2 to determine the max number of upgrades
    const MAX_UPGRADES = Math.log2(ns.getPurchasedServerMaxRam()); // 20


    // This function will purchase a server, copy our hacking script onto it, and run it
    function buyServer(ramPurchaseAmount = STARTING_UPGRADE) {
        const ramBuyAmount = 2 ^ ramPurchaseAmount;
        if (ns.getServerMoneyAvailable(HOME_SERVER) > ns.getPurchasedServerCost(ramBuyAmount)) {

            //  1. Purchase the server
            let server = PURCHASE_SERVER_PREFIX + ns.getPurchasedServers().length;
            let hostname = ns.purchaseServer(server, ramBuyAmount);

            //  2. Copy our hacking script onto the newly-purchased server
            ns.scp(PLAYER_SCRIPTS.hack.script, hostname);

            //  3. Run our hacking script on the newly-purchased server
            let threads = Math.floor(ramBuyAmount / ns.getScriptRam(PLAYER_SCRIPTS.hack.script, hostname));
            if (threads < 1 || isNaN(threads)) {
                threads = 1;
            }

            ns.exec(PLAYER_SCRIPTS.hack.script, hostname, threads);
            return true;
        }
        return false;
    };

    // This function will kill existing scripts, upgrade a purchased server, and restart our hacking script
    function upgradeServer(server, ramUpgradeToLevel) {

        let ramBuyAmount = Math.pow(2, ramUpgradeToLevel); // Why doesn't 2^ramUpgradeToLevel work?

        ns.printf(`Upgrading ${server} to ${ramBuyAmount}GB RAM. \$${ns.formatNumber(ns.getServerMoneyAvailable(HOME_SERVER), 2)}\\\$${ns.formatNumber(ns.getPurchasedServerUpgradeCost(server, ramBuyAmount), 2)}\n`);

        if (ns.getServerMoneyAvailable(HOME_SERVER) > ns.getPurchasedServerUpgradeCost(server, ramBuyAmount)) {

            //  1. Kill existing scripts
            ns.killall(server);

            //  2. Upgrade the server
            ns.printf("Upgrading %s to %dGB RAM\n", server, ramBuyAmount);
            ns.upgradePurchasedServer(server, ramBuyAmount);

            //  3. Run our hacking script on the newly-purchased server
            let threads = Math.floor(ramBuyAmount / ns.getScriptRam(PLAYER_SCRIPTS.hack.script, server));
            if (threads < 1 || isNaN(threads)) {
                threads = 1;
            }

            ns.exec(PLAYER_SCRIPTS.hack.script, server, threads);
            return true;
        }
        return false;
    };

    // This function gets a count of fully upgraded servers 
    function getUpgradedServerCount() {
        let upgradedServerCount = 0;
        for (const server of ns.getPurchasedServers()) {
            if (Math.log2(ns.getServerMaxRam(server)) === MAX_UPGRADES) {
                upgradedServerCount++;
            }
        }
        return upgradedServerCount;
    }


    // To begin, we'll continuously purchase servers until we've reached the maximum
    if (ns.getPurchasedServers().length < ns.getPurchasedServerLimit()) {
        for (let i = ns.getPurchasedServers().length; i < ns.getPurchasedServerLimit(); i++) {
            // Keep trying to purchase a server until we've successfully purchased one
            while (!buyServer(STARTING_UPGRADE)) await ns.sleep(5000);

            await ns.sleep(1000); // Wait a second before purchasing the next server
        }
    }
    ns.toast("Max servers reached!", "info", 2000);

    // Next, we'll upgrade each server until we've reached the maximum RAM allowed for each purchased server
    while (getUpgradedServerCount() < ns.getPurchasedServerLimit()) {

        ns.printf(`Total servers that are fully upgraded: ${getUpgradedServerCount()}\n`);
        for (const server of ns.getPurchasedServers()) {
            let nextUpgrade = Math.log2(ns.getServerMaxRam(server)) + 1;
            if (nextUpgrade <= STARTING_UPGRADE) nextUpgrade = STARTING_UPGRADE; // Skip servers that are already at the starting upgrade level

            // Wait until we can purchase the next upgrade
            upgradeServer(server, nextUpgrade);
            await ns.sleep(5000);
        }

        await ns.sleep(1000); // Wait a second before looping
    }

    ns.toast("Servers fully upgrades", "info", 5000);

}