/**
 * Lightweight Status Monitor
 * Uses React + printRaw for 0 GB RAM cost display
 *
 * DESIGN: Minimal RAM footprint using built-in React
 * - Displays in tail window (no DOM manipulation)
 * - Shows botnet status from ports
 * - Color-coded information
 * - Updates every second
 *
 * RAM Cost: ~1.6GB (just for port reads and formatting)
 *
 * USAGE:
 *   run status-monitor.js
 *   Then click "Tail" button or use: tail status-monitor.js
 */

import { readPort } from '/lib/port-utils.js';
import { PORTS } from '/config/ports.js';
import { formatMoney, formatTime } from '/lib/format-utils.js';

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();

    ns.print("Status monitor started - displaying updates...");
    ns.ui.openTail();

    while (true) {
        ns.clearLog();

        // Read data from ports
        const currentTarget = readPort(ns, PORTS.HACK_TARGET, "none");
        const statusData = readPort(ns, PORTS.STATUS, null);

        // Parse status if available
        let hackLevel = ns.getHackingLevel();
        let nextDiscovery = "N/A";
        let totalIncome = 0;

        if (statusData) {
            try {
                const status = JSON.parse(statusData);
                hackLevel = status.hackLevel || hackLevel;
                if (status.nextDiscovery) {
                    nextDiscovery = formatTime(status.nextDiscovery, true);
                }
            } catch (e) {
                // Invalid JSON, use defaults
            }
        }

        // Get income
        const scriptIncome = ns.getScriptIncome()[0] || 0;
        const hacknetIncome = getHacknetIncome(ns) || 0;
        totalIncome = scriptIncome + hacknetIncome;

        // Count active workers
        const workerCount = countWorkers(ns);

        // Get player money
        const money = ns.getServerMoneyAvailable("home");

        // Build UI using React.createElement
        const ui = React.createElement("div", {
            style: {
                fontFamily: "monospace",
                fontSize: "14px",
                padding: "10px",
                backgroundColor: "#0a0a0a",
                color: "#00ff00",
                lineHeight: "1.6"
            }
        },
            // Title
            React.createElement("div", {
                style: {
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "#00ddff",
                    borderBottom: "2px solid #00ddff",
                    paddingBottom: "5px",
                    marginBottom: "10px"
                }
            }, "⚡ BOTNET STATUS"),

            // Target
            React.createElement("div", { style: { marginBottom: "8px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Current Target: "),
                React.createElement("span", { style: { color: "#00ff88", fontWeight: "bold" } }, currentTarget)
            ),

            // Workers
            React.createElement("div", { style: { marginBottom: "8px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Active Workers: "),
                React.createElement("span", { style: { color: "#00ff88", fontWeight: "bold" } }, workerCount.toString())
            ),

            // Hack Level
            React.createElement("div", { style: { marginBottom: "8px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Hack Level: "),
                React.createElement("span", { style: { color: "#ff6600", fontWeight: "bold" } }, hackLevel.toString())
            ),

            // Next Discovery
            React.createElement("div", { style: { marginBottom: "15px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Next Discovery: "),
                React.createElement("span", { style: { color: "#ffff00" } }, nextDiscovery)
            ),

            // Income section header
            React.createElement("div", {
                style: {
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#00ddff",
                    borderBottom: "1px solid #00ddff",
                    paddingBottom: "3px",
                    marginBottom: "8px"
                }
            }, "💰 INCOME"),

            // Script income
            React.createElement("div", { style: { marginBottom: "5px", marginLeft: "10px" } },
                React.createElement("span", { style: { color: "#aaa" } }, "Scripts:  "),
                React.createElement("span", { style: { color: "#88ff88" } }, formatMoney(ns, scriptIncome, 2) + "/s")
            ),

            // Hacknet income
            React.createElement("div", { style: { marginBottom: "5px", marginLeft: "10px" } },
                React.createElement("span", { style: { color: "#aaa" } }, "Hacknet:  "),
                React.createElement("span", { style: { color: "#88ff88" } }, formatMoney(ns, hacknetIncome, 2) + "/s")
            ),

            // Total income
            React.createElement("div", {
                style: {
                    marginLeft: "10px",
                    paddingTop: "5px",
                    borderTop: "1px solid #333"
                }
            },
                React.createElement("span", { style: { color: "#aaa" } }, "Total:    "),
                React.createElement("span", { style: { color: "#ffaa00", fontWeight: "bold" } }, formatMoney(ns, totalIncome, 2) + "/s")
            ),

            // Money on hand
            React.createElement("div", { style: { marginTop: "15px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Balance: "),
                React.createElement("span", { style: { color: "#00ff00", fontWeight: "bold" } }, formatMoney(ns, money, 2))
            ),

            // Footer
            React.createElement("div", {
                style: {
                    marginTop: "15px",
                    paddingTop: "8px",
                    borderTop: "1px solid #333",
                    fontSize: "11px",
                    color: "#666",
                    textAlign: "center"
                }
            }, `Updated: ${new Date().toLocaleTimeString()}`)
        );

        ns.printRaw(ui);
        await ns.sleep(1000);
    }
}

/**
 * Count active worker processes across network
 */
function countWorkers(ns) {
    let count = 0;
    const servers = getAllServers(ns);

    for (const server of servers) {
        const processes = ns.ps(server);
        for (const proc of processes) {
            if (proc.filename.includes("worker.js")) {
                count += proc.threads;
            }
        }
    }

    return count;
}

/**
 * Get total hacknet income
 */
function getHacknetIncome(ns) {
    let total = 0;
    const nodeCount = ns.hacknet.numNodes();

    for (let i = 0; i < nodeCount; i++) {
        const stats = ns.hacknet.getNodeStats(i);
        total += stats.production;
    }

    return total;
}

/**
 * Scan all servers (simple BFS)
 */
function getAllServers(ns) {
    const servers = ["home"];
    const seen = new Set(["home"]);

    for (let i = 0; i < servers.length; i++) {
        const neighbors = ns.scan(servers[i]);
        for (const neighbor of neighbors) {
            if (!seen.has(neighbor)) {
                seen.add(neighbor);
                servers.push(neighbor);
            }
        }
    }

    return servers;
}
