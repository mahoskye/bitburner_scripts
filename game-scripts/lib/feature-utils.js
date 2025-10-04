/**
 * Feature Availability Utilities
 * Functions for checking availability of game features and APIs
 */

/**
 * Checks if Singularity API is available (Source-File 4)
 *
 * Purpose: Singularity functions require SF4, this checks availability before use
 * Used by: augmentation-planner.js, stat-grinder.js, tor-manager.js (3 files)
 *
 * The Singularity API provides functions like:
 * - ns.singularity.universityCourse()
 * - ns.singularity.gymWorkout()
 * - ns.singularity.purchaseTor()
 * - ns.singularity.getOwnedAugmentations()
 * - And many more automation features
 *
 * @param {NS} ns - NetScript object
 * @returns {boolean} True if Singularity API is available and functional
 *
 * @example
 * if (hasSingularityAccess(ns)) {
 *     ns.singularity.universityCourse("Rothman University", "Computer Science");
 * } else {
 *     ns.print("Singularity API not available - manual actions required");
 * }
 */
export function hasSingularityAccess(ns) {
    try {
        // Check if singularity namespace exists
        if (!ns.singularity) {
            return false;
        }

        // Check if at least one core function exists
        if (typeof ns.singularity.getOwnedAugmentations !== 'function') {
            return false;
        }

        // Try a simple test call to verify it's actually functional
        // getOwnedAugmentations(false) is safe - just reads data
        ns.singularity.getOwnedAugmentations(false);

        return true;
    } catch (error) {
        // Any error means Singularity is not available
        return false;
    }
}

/**
 * Checks if Formulas.exe is available
 *
 * Purpose: Formulas.exe enables advanced calculations for optimization
 * Used by: hack-manager.js for optimal thread calculations
 *
 * Formulas.exe provides access to:
 * - ns.formulas.hacking.hackPercent()
 * - ns.formulas.hacking.growPercent()
 * - And other precise calculation functions
 *
 * @param {NS} ns - NetScript object
 * @returns {boolean} True if Formulas.exe exists
 *
 * @example
 * if (hasFormulasAccess(ns)) {
 *     const hackPercent = ns.formulas.hacking.hackPercent(server, player);
 *     // Use precise calculations
 * } else {
 *     // Fall back to estimates
 * }
 */
export function hasFormulasAccess(ns) {
    return ns.fileExists("Formulas.exe", "home");
}

/**
 * Checks if player has purchased the TOR router
 *
 * Purpose: TOR router is required to access the darkweb and buy programs
 * Used by: tor-manager.js
 *
 * @param {NS} ns - NetScript object
 * @returns {boolean} True if TOR router is purchased
 *
 * @example
 * if (!hasTorRouter(ns)) {
 *     const cost = 200000;
 *     if (ns.getServerMoneyAvailable("home") >= cost) {
 *         ns.singularity.purchaseTor();
 *     }
 * }
 */
export function hasTorRouter(ns) {
    try {
        // If we can't use Singularity, we can't check TOR status reliably
        if (!hasSingularityAccess(ns)) {
            return false;
        }

        // There's no direct "hasTor()" function, but we can check if we can connect
        // The darkweb is only accessible if TOR is purchased
        return ns.singularity.getDarkwebPrograms().length >= 0;
    } catch (error) {
        // If we get an error, TOR is not available
        return false;
    }
}
