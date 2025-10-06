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

    ns.tprint("Go player manager started");
    ns.print("Launching Go bot...");

    // Write initial status
    const statusData = {
        active: true,
        lastUpdate: Date.now()
    };
    writePort(ns, PORTS.GO_PLAYER, JSON.stringify(statusData));

    // Run the Go bot (it has its own infinite loop)
    // We use exec instead of dynamic import to keep it isolated
    const pid = ns.exec('/sf-modules/go/go-player.js', 'home', 1, '--runOnce', false);

    if (pid === 0) {
        ns.tprint("ERROR: Failed to start Go bot");
        return;
    }

    ns.print(`Go bot running (PID: ${pid})`);

    // Monitor the Go bot and update status periodically
    while (true) {
        // Check if bot is still running
        if (!ns.isRunning(pid)) {
            ns.tprint("WARNING: Go bot stopped unexpectedly, restarting...");

            // Try to restart
            const newPid = ns.exec('/sf-modules/go/go-player.js', 'home', 1, '--runOnce', false);

            if (newPid === 0) {
                ns.tprint("ERROR: Failed to restart Go bot");

                const errorStatus = {
                    active: false,
                    error: "Failed to start",
                    lastUpdate: Date.now()
                };
                writePort(ns, PORTS.GO_PLAYER, JSON.stringify(errorStatus));
                return;
            }
        }

        // Update status
        const status = {
            active: true,
            pid: pid,
            lastUpdate: Date.now()
        };
        writePort(ns, PORTS.GO_PLAYER, JSON.stringify(status));

        await ns.sleep(60000); // Check every minute
    }
}
