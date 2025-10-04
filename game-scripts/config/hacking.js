/**
 * Hacking Configuration
 * Thresholds, ratios, and levels for hacking operations
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

export const HACK_LEVELS = {
  CHECK_INTERVAL: 50,             // Check for new capabilities every 50 levels
  AUG_CHECK: 100,                 // Significant level increase for aug planning

  TIER1: 50,                      // Early - basic servers (n00dles, foodnstuff)
  TIER2: 100,                     // Early-Mid - slightly harder servers
  TIER3: 250,                     // Mid - most common servers accessible
  TIER4: 500,                     // Mid-Late - harder servers, better targets
  TIER5: 1000,                    // Late - can access fulcrum/ecorp tier (1341)
  TIER6: 1500,                    // Late-Advanced - all servers except world daemon
  TIER7: 3000,                    // End game - w0r1d_d43m0n accessible
};
