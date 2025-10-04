/**
 * Timing Intervals & Delays
 * All time-based constants in milliseconds
 */

export const INTERVALS = {
  // Main loops
  MAIN_LOOP: 10000,               // 10s - Main loop
  PORT_MONITOR_UPDATE: 1000,      // 1s - HUD update interval

  // Discovery intervals (scale with leveling speed and server density)
  DISCOVERY_VERY_EARLY: 30000,    // 30s - <100 hack (fast leveling, 33 servers)
  DISCOVERY_EARLY: 60000,         // 1min - <250 hack (moderate leveling)
  DISCOVERY_MID: 180000,          // 3min - <500 hack (slower leveling)
  DISCOVERY_LATE: 300000,         // 5min - <1000 hack (slow leveling, sparse servers)
  DISCOVERY_END: 600000,          // 10min - 1000+ hack (very slow, very sparse)

  // Augmentation & Contract intervals
  AUGMENTATION_PLAN: 3600000,     // 1 hour between planning runs

  // Stat grinder intervals
  STAT_CHECK: 60000,              // 1 minute progress check
  STAT_SWITCH_COOLDOWN: 300000,   // 5 min before switching activities

  // Hacknet intervals
  HACKNET_CHECK: 2000,            // Wait between checks
  HACKNET_LOW_MONEY_WAIT: 5000,   // Wait when can't afford upgrades

  // Server management
  SERVER_UPGRADE_CHECK: 1000,     // Wait after upgrade attempt
  SERVER_NO_UPGRADE_WAIT: 60000,  // Wait when no upgrades possible
};

export const DELAYS = {
  SCRIPT_KILL: 1000,              // Wait after killing scripts
  STATUS_CHECK: 2000,             // Wait before final status check
  TOR_WAIT: 100,                  // Wait for TOR manager
  CONTRACT_WAIT: 100,             // Wait for contract solver
  DISCOVERY_WAIT: 1000,           // Wait for discovery
  HACKNET_ACTION: 1000,           // Wait between hacknet actions
  NO_OPTIMAL_CONDITIONS: 1000,    // Sleep if hack conditions not met
};
