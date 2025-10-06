/**
 * Go Player Manager
 * Wrapper for alainbryden's Go bot
 *
 * DESIGN: Simple wrapper around third-party Go bot
 * - Runs the go-player continuously
 * - Reports basic status to port
 * - No changes to the Go bot itself (isolated third-party code)
 *
 * RAM Cost: ~Variable (depends on go-player.js)
 *
 * USAGE:
 *   run sf-modules/go-manager.js
 *
 * CREDITS:
 *   Go bot by Sphyxis, Stoneware, gmcew, eithel, and alainbryden
 *   Source: https://github.com/alainbryden/bitburner-scripts
 */

import { writePort } from '/lib/port-utils.js';
import { PORTS } from '/config/ports.js';

export async function main(ns) {
    ns.disableLog('ALL');

    const currentServer = ns.getHostname();

    ns.tprint("Go player manager started");
    ns.print(`Launching Go bot on ${currentServer}...`);

    // Reset board state before starting (in case a previous game ended)
    const opponents = ["Netburners", "The Black Hand", "Daedalus", "Illuminati"];
    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    try {
        ns.go.resetBoardState(randomOpponent, 13);
        ns.print(`Started new game against ${randomOpponent}`);
    } catch (err) {
        ns.print(`Failed to reset board (might not be necessary): ${err}`);
    }

    // Write initial status
    const statusData = {
        active: true,
        lastUpdate: Date.now()
    };
    writePort(ns, PORTS.GO_PLAYER, JSON.stringify(statusData));

    // Run the Go bot on the current server (wherever this manager is deployed)
    // Don't pass --runOnce flag so it defaults to false (continuous play)
    let pid = ns.exec('/sf-modules/go/go-player.js', currentServer, 1);

    if (pid === 0) {
        ns.tprint("ERROR: Failed to start Go bot (insufficient RAM?)");

        const errorStatus = {
            active: false,
            error: "Failed to start - check server RAM availability",
            lastUpdate: Date.now()
        };
        writePort(ns, PORTS.GO_PLAYER, JSON.stringify(errorStatus));
        return;
    }

    ns.print(`Go bot running on ${currentServer} (PID: ${pid})`);

    // Monitor the Go bot and update status periodically
    while (true) {
        // Check if bot is still running
        if (!ns.isRunning(pid, currentServer)) {
            ns.tprint("WARNING: Go bot stopped unexpectedly, restarting...");

            // Try to restart
            pid = ns.exec('/sf-modules/go/go-player.js', currentServer, 1);

            if (pid === 0) {
                ns.tprint("ERROR: Failed to restart Go bot");

                const errorStatus = {
                    active: false,
                    error: "Failed to restart",
                    lastUpdate: Date.now()
                };
                writePort(ns, PORTS.GO_PLAYER, JSON.stringify(errorStatus));
                return;
            }

            ns.print(`Go bot restarted on ${currentServer} (PID: ${pid})`);
        }

        // Update status
        const status = {
            active: true,
            pid: pid,
            runningOn: currentServer,
            lastUpdate: Date.now()
        };
        writePort(ns, PORTS.GO_PLAYER, JSON.stringify(status));

        await ns.sleep(60000); // Check every minute
    }
}
