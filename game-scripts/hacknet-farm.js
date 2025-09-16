/** @param {NS} ns */
export async function main(ns) {
    // Disable default logging for frequently called functions to reduce clutter
    ns.disableLog("sleep");
    ns.disableLog("getServerMoneyAvailable");

    // Script parameters
    const NODE_LIMIT = ns.hacknet.maxNumNodes();
    const NODE_MAX_LEVEL = 200;
    const NODE_MAX_RAM = 8; // RAM is multiplied by 8. Min is 8GB. Max is 64GB.
    const NODE_MAX_CORES = 16;
    // Dynamic chunk sizes based on money available
    const money = ns.getServerMoneyAvailable("home");
    const NODE_CHUNK_SIZE = money < 100000 ? 1 : 3; // Buy one at a time early game
    const LEVEL_CHUNK_SIZE = money < 100000 ? 2 : 5; // Smaller upgrades early game
    const MONEY_RESERVE = Math.max(10000, ns.getServerMoneyAvailable("home") * 0.1); // Keep 10% in reserve, minimum 10k

    // Sets to keep track of statuses
    let isSetup = true;
    const completedNodes = new Set();
    const upgradableNodes = new Set(
        Array.from({ length: ns.hacknet.numNodes() }, (_, i) => i).filter((node) => !checkNodeCompletion(node))
    );

    // Function to get available money for spending, accounting for reserve
    const getMyMoney = () => Math.max(0, Math.floor(ns.getServerMoneyAvailable("home") - MONEY_RESERVE));

    // Action queue for prioritizing upgrades
    const actionQueue = [];

    // Node Status Functions
    function checkNodeCompletion(node) {
        const nodeStats = ns.hacknet.getNodeStats(node);
        const isComplete =
            nodeStats.level == NODE_MAX_LEVEL && nodeStats.ram == NODE_MAX_RAM * 8 && nodeStats.cores == NODE_MAX_CORES;

        if (isComplete) {
            completedNodes.add(node);
            if (!isSetup) upgradableNodes.delete(node);
            ns.toast(nodeStats.name + " Has been fully upgraded!!", "success", 2000);
            return true;
        }
        return false;
    }

    function findUpgradableNodes() {
        return upgradableNodes;
    }

    function updateNodeStatus() {
        for (let i = 0; i < ns.hacknet.numNodes(); i++) {
            if (!completedNodes.has(i)) {
                checkNodeCompletion(i);
            }
        }
    }

    // Node Purchase and Upgrade Functions
    async function purchaseNodeChunk() {
        let purchaseCount = 0;

        // We want to wait until all nodes are purchased before moving on
        for (let i = 0; i < NODE_CHUNK_SIZE && ns.hacknet.numNodes() < NODE_LIMIT; i++) {
            let nodePurchaseCost = ns.hacknet.getPurchaseNodeCost();

            if (nodePurchaseCost < getMyMoney() && ns.hacknet.numNodes() < NODE_LIMIT) {
                const newNode = ns.hacknet.purchaseNode();
                upgradableNodes.add(newNode);
                ns.toast("Purchased a new node!", "success", 2000);
                ++purchaseCount;
            }

            ns.print(`Node Cost: ${nodePurchaseCost}, MyMoney: ${getMyMoney()}`);

            await ns.sleep(2000);
        }
    }

    function getLevelUpgradeAmount(currentLevel) {
        if (currentLevel === 1) {
            return LEVEL_CHUNK_SIZE - 1;
        }
        return Math.min(LEVEL_CHUNK_SIZE, NODE_MAX_LEVEL - currentLevel);
    }

    function getUpgradeCost(node, nodeStats, upgradeType) {
        const maxValues = {
            level: NODE_MAX_LEVEL,
            ram: NODE_MAX_RAM * 8,
            cores: NODE_MAX_CORES,
        };
        const currentValue = nodeStats[upgradeType];

        if (currentValue >= maxValues[upgradeType]) return Infinity;

        const costFunction = {
            level: () => ns.hacknet.getLevelUpgradeCost(node, getLevelUpgradeAmount(currentValue)),
            ram: () => ns.hacknet.getRamUpgradeCost(node),
            cores: () => ns.hacknet.getCoreUpgradeCost(node),
        }[upgradeType];

        return Math.ceil(costFunction());
    }

    function nodePurchaseOptions(node) {
        if (checkNodeCompletion(node)) return;

        let nodeStats = ns.hacknet.getNodeStats(node);
        let levelAmount = getLevelUpgradeAmount(nodeStats.level);
        let levelCost = getUpgradeCost(node, nodeStats, "level");
        let ramCost = getUpgradeCost(node, nodeStats, "ram");
        let coreCost = getUpgradeCost(node, nodeStats, "cores");

        if (levelCost !== Infinity && nodeStats.level < NODE_MAX_LEVEL)
            addAction(node, levelCost, {
                action: ns.hacknet.upgradeLevel,
                args: [node, levelAmount],
                name: "purchaseLevel",
            });
        if (ramCost !== Infinity && nodeStats.ram < NODE_MAX_RAM * 8)
            addAction(node, ramCost, {
                action: ns.hacknet.upgradeRam,
                args: [node],
                name: "purchaseRAM",
            });
        if (coreCost !== Infinity && nodeStats.cores < NODE_MAX_CORES)
            addAction(node, coreCost, {
                action: ns.hacknet.upgradeCore,
                args: [node],
                name: "purchaseCore",
            });
    }

    // Action Queue Functions
    function addAction(node, cost, actionObj) {
        // Check if the action for the node with the same action already exists in the queue
        const existingIndex = actionQueue.findIndex(
            (item) => item.node === node && item.action.name === actionObj.name
        );
        if (existingIndex !== -1) {
            // If the cost is different, update it
            if (actionQueue[existingIndex].cost !== cost) {
                actionQueue[existingIndex].cost = cost;
                actionQueue[existingIndex].action = actionObj;
                // Re-sort the queue by cost
                actionQueue.sort((a, b) => a.cost - b.cost);
            }
        } else {
            // If it doesn't exist, add the new entry
            actionQueue.push({ node, cost, action: actionObj });
            actionQueue.sort((a, b) => a.cost - b.cost);
        }
    }

    function getNextAction() {
        if (actionQueue.length === 0) return null;
        return actionQueue.shift();
    }

    if (ns.hacknet.numNodes() < 1) await purchaseNodeChunk();
    isSetup = false;

    // Main Loop
    while (true) {
        const numNodes = ns.hacknet.numNodes();

        updateNodeStatus();

        ns.print(
            `Current nodes: ${numNodes}, ` +
                `Completed nodes: ${completedNodes.size}, ` +
                `Upgradable nodes: ${upgradableNodes.size}`
        );

        // Check if we've maxed out all possible hacknets
        if (numNodes == completedNodes.length && numNodes >= NODE_LIMIT) {
            ns.alert(`Congratulations: You have maxed out all ${NODE_LIMIT} nodes. The hacknet farm will now close.`);
            return;
        }

        // Purchase new nodes if needed
        if (numNodes == completedNodes.length && numNodes < NODE_LIMIT) {
            await purchaseNodeChunk();
            continue; // Restart the loop to re-evaluate after purchase
        }

        // Queue upgrade options for all upgradable nodes
        findUpgradableNodes().forEach(nodePurchaseOptions);

        // Process the action queue
        let next = getNextAction();
        if (!next) {
            ns.print("No actions available. Waiting before checking again.");
            await ns.sleep(5000);
            continue;
        }

        // Wait until we have enough money for the next action
        let newNodePurchased = false;
        while (next.cost > getMyMoney()) {
            // Check if we can purchase a new node while waiting
            if (getMyMoney() > ns.hacknet.getPurchaseNodeCost() && numNodes < NODE_LIMIT) {
                const newNode = ns.hacknet.purchaseNode();
                if (newNode !== -1) {
                    upgradableNodes.add(newNode);
                    ns.print(`Purchased new node ${newNode} while waiting for funds.`);
                    newNodePurchased = true;
                    break; // Exit the loop to re-evaluate actions
                }
            }

            ns.print(
                `Waiting for ${next.cost - getMyMoney()} more money for the next action: ` +
                    ` ${next.action.name} node-${next.node}.`
            );
            await ns.sleep(2000);
        }

        if (newNodePurchased) continue;

        // Perform the action if we have enough money
        if (next.cost <= getMyMoney()) {
            try {
                next.action.action(...next.action.args);
                ns.print(`Performed action: ${next.action.name} on node ${next.node}`);
            } catch (error) {
                ns.print(`ERROR: Failed to perform action ${next.action.name}: ${error.message}`);
            }
        }

        // Sleep to prevent excess cup usage
        await ns.sleep(1000);
    }
}
