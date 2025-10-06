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
import { formatTime, formatRam, formatWithCommas } from '/lib/format-utils.js';
import { getHomeUpgradeCost } from '/config/home-upgrades.js';
import { getBackdoorServers } from '/lib/backdoor-utils.js';

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();

    ns.print("Status monitor started - displaying updates...");
    ns.ui.openTail();

    while (true) {
        try {
            ns.clearLog();

            // Read data from ports
        const targetData = readPort(ns, PORTS.HACK_TARGET, "none");
        let currentTarget = "none";
        let switchMode = "immediate";

        // Parse target data (handle both JSON and plain string)
        if (targetData !== "none") {
            try {
                const parsed = JSON.parse(targetData);
                currentTarget = parsed.target || "none";
                switchMode = parsed.mode || "immediate";
            } catch (e) {
                // Fall back to plain string format
                currentTarget = targetData;
            }
        }

        const statusData = readPort(ns, PORTS.STATUS, null);
        const hacknetData = readPort(ns, PORTS.HACKNET, null);
        const programData = readPort(ns, PORTS.PROGRAMS, null);
        const serverData = readPort(ns, PORTS.SERVERS, null);

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

        // Parse hacknet data if available
        let hacknetNodes = 0;
        let hacknetMaxNodes = 0;
        let hacknetCompleted = 0;
        let hacknetProduction = 0;
        let hacknetNextAction = null;

        if (hacknetData) {
            try {
                const hacknet = JSON.parse(hacknetData);
                hacknetNodes = hacknet.nodes || 0;
                hacknetMaxNodes = hacknet.maxNodes || 0;
                hacknetCompleted = hacknet.completed || 0;
                hacknetProduction = hacknet.production || 0;
                hacknetNextAction = hacknet.nextAction;
            } catch (e) {
                // Invalid JSON, use defaults
            }
        }

        // Parse program data if available
        let programsOwned = 0;
        let programsTotal = 5;
        let nextProgram = null;
        let nextProgramCost = 0;
        let nextCreateLevel = 0;
        let canCreate = false;
        let hasTor = false;
        let torCost = 200000;

        if (programData) {
            try {
                const programs = JSON.parse(programData);
                programsOwned = programs.programs || 0;
                programsTotal = programs.total || 5;
                nextProgram = programs.nextMissing || null;
                nextProgramCost = programs.nextCost || 0;
                nextCreateLevel = programs.nextCreateLevel || 0;
                canCreate = programs.canCreate || false;
                hasTor = programs.hasTor || false;
                torCost = programs.torCost || 200000;
            } catch (e) {
                // Invalid JSON, use defaults
            }
        }

        // Parse server data if available
        let serversOwned = 0;
        let serversMaxed = 0;
        let serversMax = 25;
        let serversTotalRam = 0;

        if (serverData) {
            try {
                const servers = JSON.parse(serverData);
                serversOwned = servers.servers || 0;
                serversMaxed = servers.maxed || 0;
                serversMax = servers.maxServers || 25;
                serversTotalRam = servers.totalRam || 0;
            } catch (e) {
                // Invalid JSON, use defaults
            }
        }

        // Get income
        const scriptIncome = ns.getTotalScriptIncome()[0] || 0;
        const hacknetIncome = getHacknetIncome(ns) || 0;
        totalIncome = scriptIncome + hacknetIncome;

        // Count active workers
        const workerCount = countWorkers(ns);

        // Get player money
        const money = ns.getServerMoneyAvailable("home");

        // Check home server RAM for feature unlocks
        const homeMaxRam = ns.getServerMaxRam("home");
        const homeUpgradeCost = getHomeUpgradeCost(homeMaxRam);
        const canAffordHomeUpgrade = homeUpgradeCost > 0 && money >= homeUpgradeCost;

        // Feature: Backdoor display (requires 16GB+ home RAM)
        let backdoorServers = [];
        if (homeMaxRam >= 16) {
            try {
                backdoorServers = getBackdoorServers(ns);
            } catch (e) {
                // Backdoor feature unavailable (likely not enough RAM)
                ns.print(`Backdoor feature unavailable: ${e.message}`);
            }
        }

        // Build UI using React.createElement
        const ui = React.createElement("div", {
            style: {
                fontFamily: "monospace",
                fontSize: "14px",
                padding: "10px",
                backgroundColor: "#0a0a0a",
                color: "#00ff00",
                lineHeight: "1.4"
            }
        },
            // Title
            React.createElement("div", {
                style: {
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "#00ddff",
                    borderBottom: "2px solid #00ddff",
                    paddingBottom: "3px",
                    marginBottom: "6px"
                }
            }, "⚡ BOTNET STATUS"),

            // Target with switch mode indicator
            React.createElement("div", { style: { marginBottom: "4px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Current Target: "),
                React.createElement("span", { style: { color: "#00ff88", fontWeight: "bold" } }, currentTarget),
                switchMode === "after_operation"
                    ? React.createElement("span", {
                        style: { color: "#ffff00", marginLeft: "8px", fontSize: "12px" }
                      }, "⏳ pending switch")
                    : null
            ),

            // Workers
            React.createElement("div", { style: { marginBottom: "4px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Active Workers: "),
                React.createElement("span", { style: { color: "#00ff88", fontWeight: "bold" } }, formatWithCommas(workerCount))
            ),

            // Hack Level
            React.createElement("div", { style: { marginBottom: "4px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Hack Level: "),
                React.createElement("span", { style: { color: "#ff6600", fontWeight: "bold" } }, hackLevel.toString())
            ),

            // Next Discovery
            React.createElement("div", { style: { marginBottom: "8px" } },
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
                    paddingBottom: "2px",
                    marginBottom: "4px"
                }
            }, "💰 INCOME"),

            // Script income
            React.createElement("div", { style: { marginBottom: "3px", marginLeft: "10px" } },
                React.createElement("span", { style: { color: "#aaa" } }, "Scripts:  "),
                React.createElement("span", { style: { color: "#88ff88" } }, "$" + ns.formatNumber(scriptIncome, 2) + "/s")
            ),

            // Hacknet section
            React.createElement("div", { style: { marginBottom: "4px" } },
                React.createElement("div", { style: { marginBottom: "3px", marginLeft: "10px" } },
                    React.createElement("span", { style: { color: "#aaa" } }, "Hacknet:  "),
                    React.createElement("span", { style: { color: "#88ff88" } }, "$" + ns.formatNumber(hacknetIncome, 2) + "/s")
                ),
                hacknetNodes > 0 ? React.createElement("div", { style: { marginLeft: "22px", fontSize: "12px", color: "#666" } },
                    `${hacknetNodes}/${hacknetMaxNodes} nodes (${hacknetCompleted} maxed)`,
                    hacknetNextAction ?
                        React.createElement("span", { style: { color: "#999", marginLeft: "8px" } },
                            `next: ${hacknetNextAction.type} ($${ns.formatNumber(hacknetNextAction.cost, 0)})`
                        ) : null
                ) : null
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
                React.createElement("span", { style: { color: "#ffaa00", fontWeight: "bold" } }, "$" + ns.formatNumber(totalIncome, 2) + "/s")
            ),

            // Money on hand
            React.createElement("div", { style: { marginTop: "8px" } },
                React.createElement("span", { style: { color: "#ffaa00" } }, "Balance: "),
                React.createElement("span", { style: { color: "#00ff00", fontWeight: "bold" } }, "$" + ns.formatNumber(money, 2))
            ),

            // Programs section header
            React.createElement("div", {
                style: {
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#00ddff",
                    borderBottom: "1px solid #00ddff",
                    paddingBottom: "2px",
                    marginBottom: "4px",
                    marginTop: "8px"
                }
            }, "🔓 PROGRAMS"),

            // Programs section
            React.createElement("div", { style: { marginLeft: "10px" } },
                React.createElement("div", { style: { marginBottom: "3px" } },
                    React.createElement("span", { style: { color: "#ffaa00" } }, "Owned: "),
                    React.createElement("span", {
                        style: {
                            color: programsOwned === programsTotal ? "#00ff00" : "#ffff00",
                            fontWeight: "bold"
                        }
                    }, `${programsOwned}/${programsTotal}`),
                    hasTor ? React.createElement("span", {
                        style: { marginLeft: "8px", color: "#00ff00" }
                    }, "🌐") : React.createElement("span", {
                        style: { marginLeft: "8px" }
                    },
                        React.createElement("span", { style: { color: "#ff0000" } }, "🚫 "),
                        React.createElement("span", {
                            style: {
                                color: money >= torCost ? "#00ff00" :
                                       money >= torCost * 0.75 ? "#ffff00" : "#ff0000"
                            }
                        }, "$" + ns.formatNumber(torCost, 0))
                    )
                ),
                nextProgram ? React.createElement("div", { style: { fontSize: "12px" } },
                    React.createElement("span", { style: { color: canCreate ? "#00ff00" : "#999" } },
                        `Next: ${nextProgram} `
                    ),
                    React.createElement("span", {
                        style: {
                            color: money >= nextProgramCost ? "#00ff00" :
                                   money >= nextProgramCost * 0.75 ? "#ffff00" : "#ff0000"
                        }
                    }, `$${ns.formatNumber(nextProgramCost, 0)}`),
                    !canCreate && nextCreateLevel > 0 ? React.createElement("span", {
                        style: { color: "#ff6600", marginLeft: "4px" }
                    }, `(lvl ${nextCreateLevel})`) : null
                ) : null
            ),

            // Servers section
            serversOwned > 0 ? React.createElement("div", null,
                // Servers section header
                React.createElement("div", {
                    style: {
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#00ddff",
                        borderBottom: "1px solid #00ddff",
                        paddingBottom: "2px",
                        marginBottom: "4px",
                        marginTop: "8px"
                    }
                }, "🖥️ SERVERS"),

                React.createElement("div", { style: { marginLeft: "10px" } },
                    React.createElement("div", { style: { marginBottom: "3px" } },
                        React.createElement("span", { style: { color: "#ffaa00" } }, "Count: "),
                    React.createElement("span", {
                        style: {
                            color: serversOwned === serversMax && serversMaxed === serversMax ? "#00ff00" : "#ffff00",
                            fontWeight: "bold"
                        }
                    }, `${serversOwned}/${serversMax}`),
                        serversMaxed > 0 ? React.createElement("span", {
                            style: { marginLeft: "8px", fontSize: "12px", color: "#00ff00" }
                        }, `(${serversMaxed} maxed)`) : null
                    ),
                    serversTotalRam > 0 ? React.createElement("div", { style: { fontSize: "12px", color: "#999" } },
                        `Total RAM: ${formatRam(serversTotalRam)}`
                    ) : null
                )
            ) : null,

            // Backdoor section
            backdoorServers.length > 0 ? React.createElement("div", null,
                // Backdoor section header
                React.createElement("div", {
                    style: {
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#00ddff",
                        borderBottom: "1px solid #00ddff",
                        paddingBottom: "2px",
                        marginBottom: "4px",
                        marginTop: "8px"
                    }
                }, "🚪 BACKDOORS"),

                React.createElement("div", { style: { marginLeft: "10px" } },
                    backdoorServers.map(server =>
                        React.createElement("div", {
                            key: server.hostname,
                            style: { marginBottom: "5px" }
                        },
                            React.createElement("div", { style: { color: "#ffaa00", marginBottom: "2px" } }, server.hostname),
                            React.createElement("div", {
                                style: {
                                    backgroundColor: "#1a1a1a",
                                    padding: "4px 6px",
                                    fontSize: "11px",
                                    color: "#00ff00",
                                    fontFamily: "monospace",
                                    borderRadius: "3px",
                                    cursor: "pointer",
                                    userSelect: "all"
                                },
                                onClick: () => {
                                    ns.tprint(`BACKDOOR COMMAND: ${server.command}`);
                                }
                            }, server.command)
                        )
                    )
                )
            ) : null,

            // Home RAM Upgrade Banner (show if upgrade available and home < 32GB)
            homeUpgradeCost > 0 && homeMaxRam < 32 ? React.createElement("div", {
                style: {
                    marginTop: "8px",
                    padding: "4px 6px",
                    backgroundColor: canAffordHomeUpgrade ? "#1a3a1a" : "#1a1a1a",
                    borderLeft: `3px solid ${canAffordHomeUpgrade ? "#00ff00" : "#ffaa00"}`,
                    fontSize: "10px",
                    color: canAffordHomeUpgrade ? "#00ff00" : "#ffaa00"
                }
            },
                React.createElement("span", { style: { fontWeight: "bold" } },
                    canAffordHomeUpgrade ? "💾 Home Upgrade Ready: " : "💾 Save for Home: "
                ),
                React.createElement("span", { style: { color: "#999" } },
                    `${homeMaxRam * 2}GB ($${ns.formatNumber(homeUpgradeCost, 0)})`
                )
            ) : null,

            // Footer
            React.createElement("div", {
                style: {
                    marginTop: "8px",
                    paddingTop: "4px",
                    borderTop: "1px solid #333",
                    fontSize: "11px",
                    color: "#666",
                    textAlign: "center"
                }
            }, `Updated: ${new Date().toLocaleTimeString()}`)
        );

        ns.printRaw(ui);
        } catch (e) {
            // Log error but keep running
            ns.print(`ERROR: ${e.message}`);
            ns.print(`Stack: ${e.stack}`);
        }

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

