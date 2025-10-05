/**
 * Home Server Upgrade Costs
 * Critical upgrades for script functionality
 *
 * Note: Costs may vary based on Source Files and multipliers
 * These are baseline values - actual costs may differ
 */

export const HOME_RAM_COSTS = {
    8: 1010000,         // 8GB → 16GB (unlock advanced features)
    16: 3191000,        // 16GB → 32GB (recommended target - good for most scripts)
    32: 10083000,       // 32GB → 64GB (optional - late game)
};

/**
 * Get estimated cost to upgrade home RAM
 * @param {number} currentRam - Current home RAM in GB
 * @returns {number} Estimated cost for next upgrade, or 0 if maxed/unknown
 */
export function getHomeUpgradeCost(currentRam) {
    return HOME_RAM_COSTS[currentRam] || 0;
}
