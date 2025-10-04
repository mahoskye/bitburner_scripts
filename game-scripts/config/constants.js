/**
 * Game Constants
 * Thresholds and configuration values
 */

/**
  * Port Communication Constants
  */

export const PORTS = {
    HACK_TARGET: 1,   // Current best hack target (read by all bot-workers)
    STATUS: 2,        // System status updates (discovery timers, hack level)
    AUGMENTATIONS: 3, // Augmentation planning data
    STAT_GRINDER: 4,  // Stat grinding/training data
    GO_PLAYER: 5,     // Go game automation status

    RANGE_MIN: 1,     // Valid NetScript port range minimum
    RANGE_MAX: 20,    // Valid NetScript port range maximum

    DEFAULT_MONITOR: [1, 2, 3, 4, 5],
};


/**
  * File Paths & Script Constants
  */

export const FILES = {
  SERVER_LIST: '/servers/server_info.txt',
  AUGMENTATION_PLAN: '/planning/augmentation_plan.txt',
  REPUTATION_PLAN: '/planning/reputation_plan.txt',
  DEBUG_LOGS: '/debug/',
};

export const SCRIPTS = {
  BOT_WORKER: 'tbd',
  GO_PLAYER: 'tbd',
  CONTRACT_WORKER: 'tbd',
};


/**
  * Timing Intervals & Delays Constants
  */

export const INTERVALS = {
  // Main loops
  MAIN_LOOP: 10000,               // 10s - Main loop
  PORT_MONITOR_UPDATE: 1000,      // 1s - HUD update interval

  // Discovery intervals (scale with progression)
  DISCOVERY_EARLY: 30000,         // 30s
  DISCOVERY_MID_EARLY: 120000,    // 2min
  DISCOVERY_MID: 300000,          // 5min
  DISCOVERY_LATE: 600000,         // 10min

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

  // Go game intervals
  GO_MOVE_DELAY: 1000,            // Delay between Go moves
  GO_TIMEOUT: 300000,             // 5 min max per game
};

export const DELAYS = {
  SCRIPT_KILL: 1000,              // Wait after killing scripts
  GO_START: 500,                  // Wait after starting Go player
  STATUS_CHECK: 2000,             // Wait before final status check
  TOR_WAIT: 100,                  // Wait for TOR manager
  CONTRACT_WAIT: 100,             // Wait for contracto solver
  DISCOVERY_WAIT: 1000,           // Wait for discovery
  HACKNET_ACTION: 1000,           // Wait between hacknet actions
  NO_OPTIMAL_CONDITIONS: 1000     // Sleep if hack conditions not met
};


/**
  * Hack/Grow/Weaken Thresholds Constants
  */
  
export const HACK_THRESHOLDS = {
  HACK_PERCENT: 0.75,             // Hack when money >75% of max
  GROW_PERCENT: 0.5,              // Grow when money <50% of max
  SECURITY_MARGIN: 5,             // Weaken when security > minSecurity + 5

  HACK_PERCENT_TARGET: 0.5,       // Target 50% of money when hacking
  GROWTH_MULTIPLIER: 2,           // Growth multiplier for calculations

  RATIO_WEAKEN_GROW: 12.5,        // Weaken threads needed per grow thread
  RATIO_WEAKEN_HACK: 25,          // Weaken threads needed per hack thread
};


/**
  * Server Constants
  */

export const SERVERS = {
  HOME: 'home',
  DEFAULT_HACK_TARGET: 'n00dles',
  PREFIX: 'pserv',                // Prefix for purchased servers

  RAM_MIN: 8,                     // Minimum purchased server RAM (8GB)
  RAM_RESERVE_PERCENT: 0.10,      // Reserve 10% of total RAM
};


/**
  * Hacking Level Tiers
  */

export const HACK_LEVELS = {
  CHECK_INTERVAL: 50,             // Check for new capabilities every 50 levels
  AUG_CHECK: 100,                 // Significant level increase for aug planning

  TIER1: 50,                      // Early game threshold
  TIER2: 200,                     // Mid-early threshold
  TIER3: 500,                     // Mid game threshold
  TIER4: 1500,                    // Late game threshold
  TIER5: 3000,                    // End game threshold
};


/**
  * Money Thresholds Constants
  */

export const MONEY = {
  BUFFER_MIN: 100000,             // General minimum buffer (100k)
  SERVER_PURCHASE_MIN: 100000,    // Don't buy servers until 100k
  HACKNET_RESERVE: 10000,         // Money to keep in reserve (or 10%)
  HACKNET_THRESHOLD: 100000,      // Threshold for hacknet chunk sizes
  STAT_GRINDER_BUFFER: 1000000,   // Min buffer for stat grinding
};


/**
  * Hacknet Configuration Constants
  */

export const HACKNET = {
  MAX_LEVEL: 200,
  MAX_RAM_MULTIPLIER: 8,          // x8 = 64GB max
  MAX_CORES: 16,

  CHUNK_SIZE_LOW: 1,              // Node purchases when money < threshold
  CHUNK_SIZE_HIGH: 3,             // Node purchases when money >= threshold

  LEVEL_CHUNK_LOW: 2,             // Level upgrades when moeny < threshold
  LEVEL_CHUNK_HIGH: 5,            // Level upgrades when money >= threshold
};

/**
  * Stat Grinder Thresholds Constants
  */

export  const STAT_GRINDER = {
  // Early game targets
  EARLY_HACKING: 50,
  EARLY_COMBAT: 100,
  EARLY_CHARISMA: 25,

  // Mid-early game targets
  MID_EARLY_HACKING: 100,
  MID_EARLY_COMBAT: 150,
  MID_EARLY_CHARISMA: 50,

  // Mid game targets
  MID_HACKING: 200,
  MID_COMBAT: 225,
  MID_CHARISMA: 75,

  // Late game targets
  LATE_HACKING: 400,
  LATE_COMBAT: 300,
  LATE_CHARISMA: 150,

  // End game targets
  END_HACKING: 3000,
  END_COMBAT: 500,
  LATE_CHARISMA: 500,

  // Progress detection
  SLOW_PROGRESS_THRESHOLD: 0.1,     // 10% progress in check interval
  MILESTONE_THRESHOLD_PERCENT: 0.8, // 80% of milestone
  IDLE_DETECTION_TIME: 10000,       // Time to detect idle state
};


/**
  * TOR & Program Costs Constants
  */

export const TOR_COSTS = {
  ROUTER: 200000,

  PROGRAMS: {
    'BruteSSH.exe': 500000,
    'FTPCrack.exe': 1500000,
    'relaySMTP.exe': 5000000,
    'HTTPWorm.exe': 30000000,
    'SQLInject.exe': 250000000,
    'ServerProfiler.exe': 500000,
    'DeepscanV1.exe': 500000,
    'AutoLink.exe': 1000000,
  },
};

export const PROGRAMS = {
  NAMES: [
    'BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe',
    'HTTPWorm.exe', 'SQLInject.exe'
  ],

  NUKE: 'NUKE.exe',
  BRUTE_SSH: 'BruteSSH.exe',
  FTP_CRACK: 'FTPCrack.exe',
  RELAY_SMTP: 'relaySMTP.exe',
  HTTP_WORM: 'HTTPWorm.exe',
  SQL_INJECT: 'SQLInject.exe',
  SERVER_PROFILER: 'ServerProfiler.exe',
  DEEPSCAN: 'DeepscanV1.exe',
  AUTO_LINK: 'AutoLink.exe',
};


/**
  * Go Player Configuration Constants
  */

export const GO = {
  BOARD_SIZE: 7,
  MAX_GAMES_SESSION: 10,

  // AI Configuration
  AGGRESSION_LEVEL: 0.6,
  MIN_LIBERTY_THRESHOLD: 2,
  TERRITORY_WEIGHT: 0.7,
  MIN_MOVE_SCORE: -10,
  PASS_THRESHOLD_MULTIPLIER: 0.5,
  MAX_RETRIES:4,
};


/**
  * Faction Servers Constants
  */

export const FACTION_SERVERS = [
  'CSEC',
  'avmnite-02h',
  'I.I.I.I',
  'run4theh111z',
  'w0rld_d43m0n',
];


/**
  * Special Values Constants
  */

export const SPECIAL = {
  PORT_NO_DATA: 'NULL PORT DATA',
  SCAN_LOOP_PROTECTION: 9999,
};




export async function main(ns) {
    ns.tprint("INFO: Constants loaded as library");
}
