/**
 * Central Constants Index
 * Re-exports all constants from modular config files
 *
 * Import specific modules for better RAM efficiency:
 *   import { PORTS } from '/config/ports.js';
 *
 * Or import everything from here for convenience:
 *   import { PORTS, MONEY, HACK_THRESHOLDS } from '/config/constants.js';
 */

// Port communication
export { PORTS, PORT_NO_DATA } from '/game-scripts/config/ports.js';

// File paths and scripts
export { FILES, SCRIPTS } from '/game-scripts/config/paths.js';

// Timing
export { INTERVALS, DELAYS } from '/game-scripts/config/timing.js';

// Hacking
export { HACK_THRESHOLDS, HACK_LEVELS } from '/game-scripts/config/hacking.js';

// Servers
export { SERVERS, FACTION_SERVERS } from '/game-scripts/config/servers.js';

// Money and programs
export { MONEY, TOR_COSTS, PROGRAMS } from '/game-scripts/config/money.js';

// Hacknet
export { HACKNET } from '/game-scripts/config/hacknet.js';

// Stats
export { STAT_GRINDER } from '/game-scripts/config/stats.js';

// Go game
export { GO } from '/game-scripts/config/go.js';

// Miscellaneous
export { SPECIAL } from '/game-scripts/config/misc.js';

export async function main(ns) {
    ns.tprint("INFO: Constants loaded as library");
}
