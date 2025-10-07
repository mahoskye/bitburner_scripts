/**
 * Hacknet Farm Manager
 * Automated hacknet node purchasing and upgrading
 *
 * DESIGN: Priority queue based on cost-effectiveness
 * - Buys new nodes when all existing nodes are maxed
 * - Upgrades level/RAM/cores based on cheapest cost first
 * - Respects money reserves to not starve other systems
 * - Tracks completed nodes (fully upgraded)
 *
 * RAM Cost: ~3-4GB
 *
 * USAGE:
 *   run modules/resources/hacknet-manager.js
 */

import { disableCommonLogs } from '/lib/misc-utils.js';
import { writePort } from '/lib/port-utils.js';
import { MONEY } from '/config/money.js';
import { PORTS } from '/config/ports.js';

export async function main(ns) {
    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    disableCommonLogs(ns);

    const CONFIG = {
        // Maximum values for upgrades
        MAX_NODES: 26,
        MAX_LEVEL: 200,
        MAX_RAM: 64,      // Game maximum (8 base * 8 = 64GB)
        MAX_CORES: 16,

        // Chunk sizes for batch purchases/upgrades (dynamic based on money)
        LEVEL_CHUNK_SIZE: 5,    // Upgrade levels in chunks of 5

        // Financial management
        MONEY_RESERVE: MONEY.HACKNET_RESERVE,
        MONEY_THRESHOLD: MONEY.HACKNET_THRESHOLD,

        // Loop timing
        UPDATE_INTERVAL: 5000,  // Check every 5 seconds
    };

    const maxNodes = Math.min(CONFIG.MAX_NODES, ns.hacknet.maxNumNodes());
    const completedNodes = new Set();
    const actionQueue = [];

    ns.tprint(`Hacknet manager started (max nodes: ${maxNodes})`);

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /**
     * Get available money for spending (after reserves)
     */
    function getAvailableMoney() {
        const total = ns.getServerMoneyAvailable("home");
        const reserve = Math.max(CONFIG.MONEY_RESERVE, total * 0.1);
        return Math.max(0, total - reserve);
    }

    /**
     * Get node chunk size based on available money
     * Buy more nodes at once when we have more money
     */
    function getNodeChunkSize() {
        const available = getAvailableMoney();
        return available < CONFIG.MONEY_THRESHOLD ? 1 : 5;
    }

    /**
     * Check if a node is fully upgraded
     */
    function isNodeComplete(nodeId) {
        const stats = ns.hacknet.getNodeStats(nodeId);
        return stats.level >= CONFIG.MAX_LEVEL &&
               stats.ram >= CONFIG.MAX_RAM &&
               stats.cores >= CONFIG.MAX_CORES;
    }

    /**
     * Get chunk size for level upgrades
     */
    function getLevelChunkSize(currentLevel) {
        if (currentLevel === 1) {
            return CONFIG.LEVEL_CHUNK_SIZE - 1; // Avoid level 0
        }
        return Math.min(CONFIG.LEVEL_CHUNK_SIZE, CONFIG.MAX_LEVEL - currentLevel);
    }

    /**
     * Get upgrade cost for a specific type
     */
    function getUpgradeCost(nodeId, upgradeType) {
        const stats = ns.hacknet.getNodeStats(nodeId);

        switch (upgradeType) {
            case "level":
                if (stats.level >= CONFIG.MAX_LEVEL) return Infinity;
                const chunkSize = getLevelChunkSize(stats.level);
                return ns.hacknet.getLevelUpgradeCost(nodeId, chunkSize);

            case "ram":
                if (stats.ram >= CONFIG.MAX_RAM) return Infinity;
                return ns.hacknet.getRamUpgradeCost(nodeId, 1);

            case "cores":
                if (stats.cores >= CONFIG.MAX_CORES) return Infinity;
                return ns.hacknet.getCoreUpgradeCost(nodeId, 1);

            default:
                return Infinity;
        }
    }

    /**
     * Add upgrade action to priority queue
     */
    function queueUpgrade(nodeId, cost, upgradeType) {
        // Check if this action already exists
        const existing = actionQueue.findIndex(
            item => item.nodeId === nodeId && item.type === upgradeType
        );

        if (existing !== -1) {
            // Update cost if different
            if (actionQueue[existing].cost !== cost) {
                actionQueue[existing].cost = cost;
                actionQueue.sort((a, b) => a.cost - b.cost);
            }
        } else {
            // Add new action
            actionQueue.push({ nodeId, cost, type: upgradeType });
            actionQueue.sort((a, b) => a.cost - b.cost);
        }
    }

    /**
     * Queue all possible upgrades for a node
     */
    function queueNodeUpgrades(nodeId) {
        if (completedNodes.has(nodeId)) return;

        const levelCost = getUpgradeCost(nodeId, "level");
        const ramCost = getUpgradeCost(nodeId, "ram");
        const coreCost = getUpgradeCost(nodeId, "cores");

        if (levelCost !== Infinity) {
            queueUpgrade(nodeId, levelCost, "level");
        }
        if (ramCost !== Infinity) {
            queueUpgrade(nodeId, ramCost, "ram");
        }
        if (coreCost !== Infinity) {
            queueUpgrade(nodeId, coreCost, "cores");
        }
    }

    /**
     * Purchase a new node
     */
    function purchaseNode() {
        const cost = ns.hacknet.getPurchaseNodeCost();
        const available = getAvailableMoney();

        if (cost > available) {
            return { success: false, reason: "insufficient funds" };
        }

        const nodeId = ns.hacknet.purchaseNode();
        if (nodeId === -1) {
            return { success: false, reason: "purchase failed" };
        }

        ns.print(`SUCCESS: Purchased node ${nodeId} for ${ns.formatNumber(cost)}`);
        return { success: true, nodeId: nodeId };
    }

    /**
     * Execute an upgrade action
     */
    function executeUpgrade(action) {
        const stats = ns.hacknet.getNodeStats(action.nodeId);
        let success = false;

        switch (action.type) {
            case "level":
                const chunkSize = getLevelChunkSize(stats.level);
                success = ns.hacknet.upgradeLevel(action.nodeId, chunkSize);
                break;

            case "ram":
                success = ns.hacknet.upgradeRam(action.nodeId, 1);
                break;

            case "cores":
                success = ns.hacknet.upgradeCore(action.nodeId, 1);
                break;
        }

        if (success) {
            ns.print(`Upgraded node ${action.nodeId} ${action.type} (cost: ${ns.formatNumber(action.cost)})`);
        }

        return success;
    }

    // ============================================================================
    // MAIN LOOP
    // ============================================================================

    // Initial purchase if no nodes exist
    if (ns.hacknet.numNodes() === 0) {
        ns.print("No nodes found, purchasing first node...");
        purchaseNode();
    }

    let hasAnnouncedCompletion = false;

    while (true) {
        const numNodes = ns.hacknet.numNodes();
        const available = getAvailableMoney();

        // Update completed nodes
        for (let i = 0; i < numNodes; i++) {
            if (!completedNodes.has(i) && isNodeComplete(i)) {
                completedNodes.add(i);
                ns.print(`Node ${i} is fully upgraded!`);
            }
        }

        ns.print(`Nodes: ${numNodes}/${maxNodes}, Completed: ${completedNodes.size}, Money: ${ns.formatNumber(available)}`);

        // Check if all nodes are complete
        const allComplete = numNodes >= maxNodes && completedNodes.size >= maxNodes;
        if (allComplete && !hasAnnouncedCompletion) {
            ns.tprint(`SUCCESS: All ${maxNodes} hacknet nodes fully upgraded!`);
            ns.tprint("Hacknet manager entering idle mode.");
            hasAnnouncedCompletion = true;
            // Extra safety sleep after announcement
            await ns.sleep(100);
        }

        // If all complete, skip processing and just update status
        if (allComplete) {
            // Calculate total production rate
            let totalProduction = 0;
            for (let i = 0; i < numNodes; i++) {
                totalProduction += ns.hacknet.getNodeStats(i).production;
            }

            // Write idle status to port
            const idleStatusData = {
                nodes: numNodes,
                maxNodes: maxNodes,
                completed: completedNodes.size,
                production: totalProduction,
                nextAction: null,
                money: available,
                allComplete: true
            };
            writePort(ns, PORTS.HACKNET, JSON.stringify(idleStatusData));

            await ns.sleep(CONFIG.UPDATE_INTERVAL);
            continue;
        }

        // Build priority queue with ALL possible actions (upgrades + new nodes)
        actionQueue.length = 0; // Clear queue

        // Queue upgrades for all incomplete nodes
        for (let i = 0; i < numNodes; i++) {
            queueNodeUpgrades(i);
        }

        // Queue new node purchases (up to chunk size)
        if (numNodes < maxNodes) {
            const chunkSize = getNodeChunkSize();
            for (let i = 0; i < chunkSize && numNodes + i < maxNodes; i++) {
                const nodeCost = ns.hacknet.getPurchaseNodeCost();
                if (nodeCost !== Infinity) {
                    actionQueue.push({
                        nodeId: -1,  // Special marker for new node
                        cost: nodeCost,
                        type: "purchase"
                    });
                }
            }
        }

        // Sort queue by cost (cheapest first)
        actionQueue.sort((a, b) => a.cost - b.cost);

        // Calculate total production rate
        let totalProduction = 0;
        for (let i = 0; i < numNodes; i++) {
            totalProduction += ns.hacknet.getNodeStats(i).production;
        }

        // Write status to port
        const statusData = {
            nodes: numNodes,
            maxNodes: maxNodes,
            completed: completedNodes.size,
            production: totalProduction,
            nextAction: actionQueue.length > 0 ? {
                type: actionQueue[0].type,
                cost: actionQueue[0].cost
            } : null,
            money: available
        };
        writePort(ns, PORTS.HACKNET, JSON.stringify(statusData));

        // Process cheapest action
        if (actionQueue.length > 0) {
            const nextAction = actionQueue[0];
            ns.print(`Next action: ${nextAction.type} (cost: ${ns.formatNumber(nextAction.cost)})`);

            if (nextAction.cost <= available) {
                if (nextAction.type === "purchase") {
                    const result = purchaseNode();
                    if (result.success) {
                        await ns.sleep(100);
                        continue;
                    }
                } else {
                    executeUpgrade(nextAction);
                    await ns.sleep(100);
                    continue;
                }
            } else {
                ns.print(`Next upgrade costs ${ns.formatNumber(nextAction.cost)}, waiting for funds...`);
            }
        }

        await ns.sleep(CONFIG.UPDATE_INTERVAL);
    }
}
