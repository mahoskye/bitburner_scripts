/**
 * Port Communication Utilities
 * Functions for reading and writing to NetScript ports (1-20)
 */

import { PORT_NO_DATA } from '/game-scripts/config/ports.js';

/**
 * Safely reads from a port with a default fallback
 *
 * Purpose: Ports return "NULL PORT DATA" when empty, this handles that gracefully
 * Used by: offline-worker.js, bot-worker.js, debug-ports.js (4+ files)
 *
 * @param {NS} ns - NetScript object
 * @param {number} portNumber - Port number (1-20)
 * @param {any} defaultValue - Value to return if port is empty (default: null)
 * @returns {any} Port value or defaultValue
 *
 * @example
 * const target = readPort(ns, PORTS.HACK_TARGET, "n00dles");
 * // Returns port value, or "n00dles" if port is empty
 *
 * const status = readPort(ns, PORTS.STATUS);
 * // Returns port value, or null if port is empty
 */
export function readPort(ns, portNumber, defaultValue = null) {
    const value = ns.peek(portNumber);

    // Check if port is empty
    if (value === PORT_NO_DATA) {
        return defaultValue;
    }

    return value;
}

/**
 * Reads and parses JSON from a port
 *
 * Purpose: Many scripts send JSON-serialized objects through ports
 * Used by: port-monitor.js for reading complex status objects
 *
 * @param {NS} ns - NetScript object
 * @param {number} portNumber - Port number (1-20)
 * @param {any} defaultValue - Value to return if empty or parse fails (default: null)
 * @returns {any} Parsed JSON object or defaultValue
 *
 * @example
 * const statusInfo = readPortJson(ns, PORTS.STATUS, {});
 * // Returns: {lastDiscovery: 12345, hackLevel: 50, ...}
 *
 * const augPlan = readPortJson(ns, PORTS.AUGMENTATIONS, []);
 * // Returns parsed array, or [] if empty/invalid
 */
export function readPortJson(ns, portNumber, defaultValue = null) {
    const value = readPort(ns, portNumber, null);

    // Port is empty
    if (value === null) {
        return defaultValue;
    }

    // Try to parse JSON
    try {
        return JSON.parse(value);
    } catch (error) {
        ns.print(`ERROR: Failed to parse JSON from port ${portNumber}: ${error.message}`);
        return defaultValue;
    }
}

/**
 * Clears and writes to a port
 *
 * Purpose: Common pattern is to clear before writing to ensure fresh data
 * Used by: overlord.js, augmentation-planner.js, stat-grinder.js, write-port.js (4+ files)
 *
 * @param {NS} ns - NetScript object
 * @param {number} portNumber - Port number (1-20)
 * @param {any} data - Data to write (will be converted to string)
 *
 * @example
 * writePort(ns, PORTS.HACK_TARGET, "joesguns");
 * // Clears port 1, then writes "joesguns"
 *
 * writePort(ns, PORTS.STATUS, "Discovery running...");
 * // Clears port 2, then writes status message
 */
export function writePort(ns, portNumber, data) {
    ns.clearPort(portNumber);
    ns.writePort(portNumber, data);
}

/**
 * Clears and writes JSON to a port
 *
 * Purpose: Standardized way to send complex objects through ports
 * Used by: overlord.js for status updates, augmentation-planner.js for plans
 *
 * @param {NS} ns - NetScript object
 * @param {number} portNumber - Port number (1-20)
 * @param {any} data - Data to serialize and write (object, array, etc.)
 *
 * @example
 * const statusInfo = {
 *     lastDiscovery: Date.now(),
 *     hackLevel: ns.getHackingLevel(),
 *     nextDiscovery: 120000
 * };
 * writePortJson(ns, PORTS.STATUS, statusInfo);
 * // Clears port, serializes object, writes to port
 *
 * const targetList = ["n00dles", "foodnstuff", "sigma-cosmetics"];
 * writePortJson(ns, PORTS.HACK_TARGET, targetList);
 * // Writes array as JSON string
 */
export function writePortJson(ns, portNumber, data) {
    try {
        const jsonString = JSON.stringify(data);
        writePort(ns, portNumber, jsonString);
    } catch (error) {
        ns.print(`ERROR: Failed to serialize data for port ${portNumber}: ${error.message}`);
    }
}
