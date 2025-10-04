/**
 * User Settings
 * Configurable preferences and toggles
 */

export const SETTINGS = {
    // Feature toggles
    AUTO_HACKNET: true,
    AUTO_SERVERS: true,
    AUTO_CONTRACTS: true,
    AUTO_BACKDOOR: false,

    // Resource allocation
    RESERVE_HOME_RAM: 32, // GB to reserve on home server
    MAX_SERVER_COST_PERCENT: 0.25, // Max % of money to spend on servers

    // Source file modules (auto-detected on startup)
    ENABLED_SF_MODULES: [],
};

export async function main(ns) {
    ns.tprint("INFO: Settings loaded as library");
}
