/**
 * Go Game Configuration
 * Settings for Go (SF14) automation
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
  MAX_RETRIES: 4,
};
