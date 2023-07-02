/** @param {NS} ns */
export async function main(ns) {

    ns.disableLog("sleep");
    ns.disableLog("getServerMoneyAvailable");

    const MAX_LEVEL = 200;
    const MAX_RAM = 8; // RAM can be updated 8 times to 64GB
    const MAX_CORES = 16;
    let completedNodes = [];

    function myMoney() {
        return ns.getServerMoneyAvailable("home");
    }

    while (ns.hacknet.numNodes() == 0) {
        if (ns.hacknet.purchaseNode() == -1)
            await ns.sleep(3000);
    }

    while (true) {

        if (ns.hacknet.numNodes() == completedNodes.length) {
            while (ns.hacknet.purchaseNode() == -1)
                await ns.sleep(3000);
        }

        // Find best upgrade for each node and perform it
        for (let iNode = 0; iNode < ns.hacknet.numNodes(); iNode++) {

            if (completedNodes.find(function (element) { return element == iNode }) != undefined) {
                await ns.sleep(1);
                continue;
            }

            let nodeStats = ns.hacknet.getNodeStats(iNode);

            if (nodeStats.ram == MAX_RAM && nodeStats.level == MAX_LEVEL && nodeStats.cores == MAX_CORES) {
                completedNodes.push(iNode);
                ns.toast(nodeStats.name + " Has been fully upgraded!!", "success", 2000);
                await ns.sleep(1);
                continue;
            }

            if (ns.hacknet.getPurchaseNodeCost() < myMoney()) {
                ns.hacknet.purchaseNode();
                ns.toast("Purchased a new node!", "success", 2000);
                await ns.sleep(1);
                continue;
            }

            // Find maximum number of levels we can upgrade
            let levelsToBuy = 0;
            while (ns.hacknet.getLevelUpgradeCost(iNode, levelsToBuy) < myMoney() && levelsToBuy < MAX_LEVEL - 1) {
                levelsToBuy++;
                await ns.sleep(1);
            }

            levelsToBuy--;
            if (ns.hacknet.getLevelUpgradeCost(iNode, levelsToBuy) !== Infinity && levelsToBuy > 0) {
                ns.printf("Upgrading node %d by %d levels\n", iNode, levelsToBuy);
                ns.hacknet.upgradeLevel(iNode, levelsToBuy);
                await ns.sleep(1);
            }

            // Find maximum number of RAM we can upgrade
            let ramToBuy = 0;
            while (ns.hacknet.getRamUpgradeCost(iNode, ramToBuy) < myMoney() && ramToBuy < MAX_RAM - 1) {
                ramToBuy++;
                await ns.sleep(1);
            }

            ramToBuy--;
            if (ns.hacknet.getRamUpgradeCost(iNode, ramToBuy) !== Infinity && ramToBuy > 0) {
                ns.printf("Upgrading node %d by %d RAM\n", iNode, ramToBuy);
                ns.hacknet.upgradeRam(iNode, ramToBuy);
                await ns.sleep(1);
            }

            // Find maximum number of cores we can upgrade
            let coresToBuy = 0;
            while (ns.hacknet.getCoreUpgradeCost(iNode, coresToBuy) < myMoney() && coresToBuy < MAX_CORES - 1) {
                coresToBuy++;
                await ns.sleep(1);
            }

            coresToBuy--;
            if (ns.hacknet.getCoreUpgradeCost(iNode, coresToBuy) !== Infinity && coresToBuy > 0) {
                ns.printf("Upgrading node %d by %d cores\n", iNode, coresToBuy);
                ns.hacknet.upgradeCore(iNode, coresToBuy);
                await ns.sleep(1);
            }
        }
        await ns.sleep(3000);
    }
}