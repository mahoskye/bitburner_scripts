/**
 * Port Communication Constants
 * NetScript port numbers and defaults for inter-script communication
 */

export const PORTS = {
  HACK_TARGET: 1,           // Current best hack target (read by all bot-workers)
  STATUS: 2,                // System status updates (discovery timers, hack level)
  AUGMENTATIONS: 3,         // Augmentation planning data
  STAT_GRINDER: 4,          // Stat grinding/training data
  HACKNET: 5,               // Hacknet farm status and statistics
  PROGRAMS: 6,              // Program acquisition status
  SERVERS: 7,               // Purchased server status
  CONTRACTS: 8,             // Coding contract solver status

  RANGE_MIN: 1,             // Valid NetScript port range minimum
  RANGE_MAX: 20,            // Valid NetScript port range maximum

  DEFAULT_MONITOR: [1, 2, 5, 6, 7, 8],  // Default ports to monitor in HUD
};

export const PORT_NO_DATA = 'NULL PORT DATA';
