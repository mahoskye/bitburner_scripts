/**
 * Server Manager
 * Handles purchasing and upgrading player-owned servers
 *
 * DESIGN: Manages purchased server lifecycle
 * - Purchases new servers up to 25 limit
 * - Upgrades existing servers by deleting and re-purchasing
 * - Deploys workers to new/upgraded servers
 * - Reports status to port for monitoring
 * - Uses standardized naming: pserv-0000, pserv-0001, etc.
 *
 * RAM Cost: ~4-5GB
 *
 * STRATEGY:
 * - Start with 8GB servers (minimum)
 * - Double RAM on each upgrade (8 -> 16 -> 32 -> 64 -> etc)
 * - Upgrade oldest/smallest servers first
 * - Stop when all servers reach max RAM (1048576 GB)
 *
 * USAGE:
 *   run modules/resources/server-manager.js
 */

import { disableCommonLogs } from '/lib/misc-utils.js';
import { writePort } from '/lib/port-utils.js';
import { scanAllServers, getNextRamUpgrade } from '/lib/server-utils.js';
import { MONEY } from '/config/money.js';
import { PORTS } from '/config/ports.js';
import { SCRIPTS } from '/config/paths.js';

export async function main(ns) {
    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    disableCommonLogs(ns);

    const CONFIG = {
        MIN_RAM: 8,                    // Starting RAM (8GB)
        SERVER_LIMIT: 25,              // Max purchased servers (game limit)
        SERVER_PREFIX: 'pserv-',       // Server naming prefix
        WORKER_SCRIPT: SCRIPTS.WORKER, // Script to deploy on servers

        // Timing
        CHECK_INTERVAL: 30000,         // Check every 30 seconds
        UPGRADE_DELAY: 1000,           // Wait 1s after purchase/upgrade
    };

    const maxRam = ns.getPurchasedServerMaxRam();

    ns.tprint("Server manager started");

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /**
     * Get all purchased servers with their details
     */
    function getPurchasedServers() {
        const servers = ns.getPurchasedServers();
        return servers.map(hostname => ({
            hostname: hostname,
            ram: ns.getServerMaxRam(hostname),
            running: ns.ps(hostname).length > 0
        }));
    }

    /**
     * Generate standard server name
     */
    function getServerName(index) {
        return `${CONFIG.SERVER_PREFIX}${index.toString().padStart(4, '0')}`;
    }

    /**
     * Deploy worker to server
     */
    async function deployWorker(serverName, ram) {
        // Copy worker script
        await ns.scp(CONFIG.WORKER_SCRIPT, serverName, "home");

        // Calculate thread count
        const scriptRam = ns.getScriptRam(CONFIG.WORKER_SCRIPT);
        if (scriptRam === 0) {
            ns.print(`ERROR: Worker script ${CONFIG.WORKER_SCRIPT} not found`);
            return false;
        }

        const threads = Math.floor(ram / scriptRam);
        if (threads === 0) {
            ns.print(`WARNING: Not enough RAM on ${serverName} to run worker`);
            return false;
        }

        // Start worker
        const pid = ns.exec(CONFIG.WORKER_SCRIPT, serverName, threads, PORTS.HACK_TARGET);
        if (pid === 0) {
            ns.print(`ERROR: Failed to start worker on ${serverName}`);
            return false;
        }

        ns.print(`  Deployed ${threads} worker threads on ${serverName}`);
        return true;
    }

    /**
     * Purchase a new server
     */
    async function purchaseNewServer(name, ram) {
        const cost = ns.getPurchasedServerCost(ram);
        const money = ns.getServerMoneyAvailable("home");

        if (money < cost) {
            return { success: false, reason: "insufficient funds" };
        }

        const hostname = ns.purchaseServer(name, ram);
        if (hostname === "") {
            return { success: false, reason: "purchase failed" };
        }

        // Deploy worker
        await deployWorker(hostname, ram);
        await ns.sleep(CONFIG.UPGRADE_DELAY);

        return { success: true, hostname: hostname, ram: ram, cost: cost };
    }

    /**
     * Upgrade existing server (delete and re-purchase)
     */
    async function upgradeServer(oldName, newRam) {
        const cost = ns.getPurchasedServerCost(newRam);
        const money = ns.getServerMoneyAvailable("home");

        if (money < cost) {
            return { success: false, reason: "insufficient funds" };
        }

        // Kill all scripts on server
        ns.killall(oldName);
        await ns.sleep(100);

        // Delete old server
        if (!ns.deleteServer(oldName)) {
            return { success: false, reason: "delete failed" };
        }

        // Purchase new server with upgraded RAM
        const hostname = ns.purchaseServer(oldName, newRam);
        if (hostname === "") {
            return { success: false, reason: "purchase failed" };
        }

        // Deploy worker
        await deployWorker(hostname, newRam);
        await ns.sleep(CONFIG.UPGRADE_DELAY);

        return { success: true, hostname: hostname, ram: newRam, cost: cost };
    }

    /**
     * Write status to port
     */
    function updateStatus(servers, action = null) {
        const total = servers.length;
        const maxed = servers.filter(s => s.ram >= maxRam).length;
        const totalRam = servers.reduce((sum, s) => sum + s.ram, 0);

        const statusData = {
            servers: total,
            maxServers: CONFIG.SERVER_LIMIT,
            maxed: maxed,
            totalRam: totalRam,
            allMaxed: maxed === total && total === CONFIG.SERVER_LIMIT,
            lastAction: action,
            timestamp: Date.now()
        };

        writePort(ns, PORTS.SERVERS, JSON.stringify(statusData));
    }

    // ============================================================================
    // MAIN LOOP
    // ============================================================================

    while (true) {
        const money = ns.getServerMoneyAvailable("home");

        // Early game check
        if (money < MONEY.SERVER_PURCHASE_MIN) {
            ns.print(`Waiting for ${MONEY.SERVER_PURCHASE_MIN} money (current: ${money})`);
            await ns.sleep(CONFIG.CHECK_INTERVAL);
            continue;
        }

        let servers = getPurchasedServers();
        const serverCount = servers.length;

        // Sort by RAM (smallest first for upgrading)
        servers.sort((a, b) => a.ram - b.ram);

        let actionTaken = false;
        let lastAction = null;

        // PHASE 1: Purchase new servers if under limit
        if (serverCount < CONFIG.SERVER_LIMIT) {
            const nextIndex = serverCount;
            const name = getServerName(nextIndex);
            const cost = ns.getPurchasedServerCost(CONFIG.MIN_RAM);

            ns.print(`Attempting to purchase server ${name} with ${CONFIG.MIN_RAM}GB RAM (cost: ${cost})`);
            const result = await purchaseNewServer(name, CONFIG.MIN_RAM);

            if (result.success) {
                ns.tprint(`✓ Purchased ${name} with ${CONFIG.MIN_RAM}GB RAM`);
                lastAction = `purchased ${name} (${CONFIG.MIN_RAM}GB)`;
                actionTaken = true;
            } else {
                ns.print(`Purchase failed: ${result.reason}`);
            }
        }
        // PHASE 2: Upgrade existing servers
        else {
            // Find first server that needs upgrade
            const serverToUpgrade = servers.find(s => s.ram < maxRam);

            if (serverToUpgrade) {
                const nextRam = getNextRamUpgrade(ns, serverToUpgrade.ram);
                const cost = ns.getPurchasedServerCost(nextRam);

                ns.print(`Attempting to upgrade ${serverToUpgrade.hostname} from ${serverToUpgrade.ram}GB to ${nextRam}GB (cost: ${cost})`);
                const result = await upgradeServer(serverToUpgrade.hostname, nextRam);

                if (result.success) {
                    ns.tprint(`✓ Upgraded ${serverToUpgrade.hostname}: ${serverToUpgrade.ram}GB -> ${nextRam}GB`);
                    lastAction = `upgraded ${serverToUpgrade.hostname} (${serverToUpgrade.ram}GB -> ${nextRam}GB)`;
                    actionTaken = true;
                } else {
                    ns.print(`Upgrade failed: ${result.reason}`);
                }
            } else {
                // All servers maxed
                ns.tprint("SUCCESS: All servers upgraded to maximum RAM!");
                ns.tprint("Server manager shutting down.");

                // Write final status
                servers = getPurchasedServers();
                updateStatus(servers, "complete");
                return;
            }
        }

        // Update status
        servers = getPurchasedServers();
        updateStatus(servers, lastAction);

        // Wait before next check
        await ns.sleep(actionTaken ? CONFIG.UPGRADE_DELAY : CONFIG.CHECK_INTERVAL);
    }
}
