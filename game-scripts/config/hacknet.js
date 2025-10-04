/**
 * Hacknet Configuration
 * Limits and upgrade strategies for hacknet nodes
 */

export const HACKNET = {
  MAX_LEVEL: 200,
  MAX_RAM_MULTIPLIER: 8,          // x8 = 64GB max
  MAX_CORES: 16,

  CHUNK_SIZE_LOW: 1,              // Node purchases when money < threshold
  CHUNK_SIZE_HIGH: 3,             // Node purchases when money >= threshold

  LEVEL_CHUNK_LOW: 2,             // Level upgrades when money < threshold
  LEVEL_CHUNK_HIGH: 5,            // Level upgrades when money >= threshold
};
