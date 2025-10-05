/**
 * Program Status Tracker
 * Monitors availability of hacking programs
 *
 * DESIGN: Simple status tracking
 * - Checks which port opener programs we have
 * - Reports status to port for monitoring
 * - No auto-purchase (requires manual acquisition or Singularity)
 *
 * RAM Cost: ~2GB
 *
 * USAGE:
 *   run modules/resources/program-manager.js
 */

import { disableCommonLogs } from '/lib/misc-utils.js';
import { writePort } from '/lib/port-utils.js';
import { PROGRAMS, TOR_COSTS, PROGRAM_CREATE_LEVEL } from '/config/money.js';
import { PORTS } from '/config/ports.js';

export async function main(ns) {
    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    disableCommonLogs(ns);

    const CONFIG = {
        // Port opener programs (in priority order)
        // Each program opens 1 port - need all 5 to open 5 ports total
        PORT_OPENERS: [
            PROGRAMS.BRUTE_SSH,    // Port opener #1 (critical early game)
            PROGRAMS.FTP_CRACK,    // Port opener #2 (unlocks more servers)
            PROGRAMS.RELAY_SMTP,   // Port opener #3
            PROGRAMS.HTTP_WORM,    // Port opener #4
            PROGRAMS.SQL_INJECT,   // Port opener #5 (endgame)
        ],

        // Loop timing
        UPDATE_INTERVAL: 10000, // Check every 10 seconds
    };

    ns.tprint("Program status tracker started");

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /**
     * Check if we have a program
     */
    function hasProgram(program) {
        return ns.fileExists(program, "home");
    }

    /**
     * Get list of missing programs
     */
    function getMissingPrograms() {
        return CONFIG.PORT_OPENERS.filter(program => !hasProgram(program));
    }

    // ============================================================================
    // MAIN LOOP
    // ============================================================================

    while (true) {
        // Count acquired programs
        const acquiredCount = CONFIG.PORT_OPENERS.filter(p => hasProgram(p)).length;
        const totalCount = CONFIG.PORT_OPENERS.length;
        const missing = getMissingPrograms();

        // Check TOR status
        const hasTor = ns.hasTorRouter();

        // Check if all acquired
        if (missing.length === 0) {
            ns.tprint("SUCCESS: All port opener programs acquired!");
            ns.tprint("Program tracker shutting down.");

            // Write final status
            const finalStatus = {
                programs: acquiredCount,
                total: totalCount,
                missing: [],
                hasTor: hasTor,
                complete: true
            };
            writePort(ns, PORTS.PROGRAMS, JSON.stringify(finalStatus));

            return;
        }

        // Get next missing program details
        const nextMissing = missing[0];
        const cost = TOR_COSTS.PROGRAMS[nextMissing] || 0;
        const createLevel = PROGRAM_CREATE_LEVEL[nextMissing] || 0;

        // Check if player can create this program
        const hackLevel = ns.getHackingLevel();
        const canCreate = hackLevel >= createLevel;

        // Build status message
        const statusMessage = `Programs: ${acquiredCount}/${totalCount} (next: ${nextMissing})`;

        // Write status to port
        const statusData = {
            programs: acquiredCount,
            total: totalCount,
            missing: missing,
            nextMissing: nextMissing,
            nextCost: cost,
            nextCreateLevel: createLevel,
            canCreate: canCreate,
            hasTor: hasTor,
            torCost: TOR_COSTS.ROUTER,
            message: statusMessage,
            complete: false
        };
        writePort(ns, PORTS.PROGRAMS, JSON.stringify(statusData));

        ns.print(statusMessage);
        await ns.sleep(CONFIG.UPDATE_INTERVAL);
    }
}
