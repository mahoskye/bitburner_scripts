/**
 * Stat Grinder Configuration
 * Stat targets and progression thresholds
 */

export const STAT_GRINDER = {
  // Early game targets
  EARLY_HACKING: 50,
  EARLY_COMBAT: 100,
  EARLY_CHARISMA: 50,

  // Mid-early game targets
  MID_EARLY_HACKING: 100,
  MID_EARLY_COMBAT: 200,
  MID_EARLY_CHARISMA: 100,

  // Mid game targets
  MID_HACKING: 250,
  MID_COMBAT: 400,
  MID_CHARISMA: 200,

  // Late game targets
  LATE_HACKING: 1000,
  LATE_COMBAT: 750,
  LATE_CHARISMA: 400,

  // End game targets
  END_HACKING: 3000,
  END_COMBAT: 1500,
  END_CHARISMA: 750,

  // Progress detection
  SLOW_PROGRESS_THRESHOLD: 0.1,        // 10% progress in check interval
  MILESTONE_THRESHOLD_PERCENT: 0.8,    // 80% of milestone
  IDLE_DETECTION_TIME: 10000,          // Time to detect idle state
};
