/**
 * Bootstrap Script
 * Minimal startup script for home server to launch command center
 *
 * DESIGN: Runs on home with minimal RAM footprint
 * - Detects or selects command center server
 * - Copies necessary files to command center
 * - Launches command server
 * - Saves command center location for future runs
 *
 * RAM Cost: ~2-3GB (minimal, runs on 8GB home)
 *
 * USAGE:
 *   run bootstrap.js              # Auto-detect or use saved command center
 *   run bootstrap.js foodnstuff   # Use specific server as command center
 */

import { scanAllServers, getServerInfo } from '/lib/server-utils.js';
import { gainRootAccess } from '/lib/access-utils.js';
import { disableCommonLogs } from '/lib/misc-utils.js';
import { FILES, SCRIPTS } from '/config/paths.js';
import { SERVERS } from '/config/servers.js';

export async function main(ns) {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    disableCommonLogs(ns);

    const MIN_RAM = 16; // Minimum RAM for command center

    ns.tprint("=== Bootstrap Starting ===");

    // ============================================================================
    // DETERMINE COMMAND CENTER
    // ============================================================================

    let commandCenter = null;

    // Option 1: Command-line argument
    if (ns.args.length > 0) {
        commandCenter = ns.args[0];
        ns.tprint(`Using command center from argument: ${commandCenter}`);
    }
    // Option 2: Persistent file
    else if (ns.fileExists(FILES.COMMAND_CENTER, "home")) {
        commandCenter = ns.read(FILES.COMMAND_CENTER).trim();
        ns.tprint(`Using saved command center: ${commandCenter}`);
    }
    // Option 3: Auto-detect
    else {
        ns.tprint("No command center specified, auto-detecting...");

        // Scan network for suitable servers
        const allServers = scanAllServers(ns);
        let bestServer = null;
        let bestRam = 0;

        for (const hostname of allServers) {
            // Skip home
            if (hostname === "home") continue;

            // Try to gain root access
            const result = gainRootAccess(ns, hostname);
            if (!result.success) continue;

            // Check RAM
            const maxRam = ns.getServerMaxRam(hostname);
            if (maxRam >= MIN_RAM && maxRam > bestRam) {
                bestRam = maxRam;
                bestServer = hostname;
            }
        }

        if (bestServer) {
            commandCenter = bestServer;
            ns.tprint(`Auto-detected command center: ${commandCenter} (${bestRam}GB RAM)`);
        } else {
            ns.tprint(`ERROR: No suitable command center found (need ${MIN_RAM}GB+ RAM)`);
            ns.tprint("Falling back to default: " + SERVERS.DEFAULT_COMMAND_CENTER);
            commandCenter = SERVERS.DEFAULT_COMMAND_CENTER;
        }
    }

    // ============================================================================
    // VALIDATE COMMAND CENTER
    // ============================================================================

    // Ensure we have root access
    const rootResult = gainRootAccess(ns, commandCenter);
    if (!rootResult.success) {
        ns.tprint(`ERROR: Cannot gain root access to ${commandCenter}`);
        return;
    }

    // Check RAM
    const maxRam = ns.getServerMaxRam(commandCenter);
    if (maxRam < MIN_RAM) {
        ns.tprint(`WARNING: ${commandCenter} has only ${maxRam}GB RAM (recommended: ${MIN_RAM}GB+)`);
        ns.tprint("Command server may not have enough RAM to run properly");
    }

    // ============================================================================
    // SAVE COMMAND CENTER
    // ============================================================================

    await ns.write(FILES.COMMAND_CENTER, commandCenter, "w");
    ns.tprint(`Saved command center to ${FILES.COMMAND_CENTER}`);

    // ============================================================================
    // DEPLOY COMMAND SERVER
    // ============================================================================

    ns.tprint("Deploying command server...");

    // Copy all necessary files
    const filesToCopy = [
        SCRIPTS.COMMAND,
        SCRIPTS.WORKER,
        // Config files
        '/config/ports.js',
        '/config/timing.js',
        '/config/hacking.js',
        '/config/servers.js',
        '/config/paths.js',
        '/config/money.js',
        '/config/settings.js',
        // Library files
        '/lib/server-utils.js',
        '/lib/access-utils.js',
        '/lib/port-utils.js',
        '/lib/ram-utils.js',
        '/lib/target-utils.js',
        '/lib/misc-utils.js',
        '/lib/deployment-utils.js',
        '/lib/manager-utils.js',
    ];

    for (const file of filesToCopy) {
        await ns.scp(file, commandCenter, "home");
    }

    ns.tprint(`Copied ${filesToCopy.length} files to ${commandCenter}`);

    // Kill ALL scripts on command center to ensure clean start
    ns.killall(commandCenter);
    await ns.sleep(100); // Give it a moment to clean up

    // Launch command server
    const pid = ns.exec(SCRIPTS.COMMAND, commandCenter, 1);

    if (pid > 0) {
        ns.tprint(`SUCCESS: Command server launched on ${commandCenter} (PID: ${pid})`);
        ns.tprint("=== Bootstrap Complete ===");
    } else {
        ns.tprint(`ERROR: Failed to launch command server on ${commandCenter}`);
        ns.tprint("Check server RAM and file paths");
    }
}
