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
export { PORTS, PORT_NO_DATA } from '/config/ports.js';

// File paths and scripts
export { FILES, SCRIPTS } from '/config/paths.js';

// Timing
export { INTERVALS, DELAYS } from '/config/timing.js';

// Hacking
export { HACK_THRESHOLDS, HACK_LEVELS } from '/config/hacking.js';

// Servers
export { SERVERS, FACTION_SERVERS } from '/config/servers.js';

// Money and programs
export { MONEY, TOR_COSTS, PROGRAMS, PROGRAM_CREATE_LEVEL } from '/config/money.js';

// Home upgrades
export { HOME_RAM_COSTS, getHomeUpgradeCost } from '/config/home-upgrades.js';

// Hacknet
export { HACKNET } from '/config/hacknet.js';

// Stats
export { STAT_GRINDER } from '/config/stats.js';

// Settings
export { SETTINGS } from '/config/settings.js';

// Miscellaneous
export { SPECIAL } from '/config/misc.js';

export async function main(ns) {
    ns.tprint("INFO: Constants loaded as library");
}
