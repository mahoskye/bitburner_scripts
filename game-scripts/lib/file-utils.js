/**
 * File I/O Utilities
 * Functions for reading and writing files, especially JSON data
 */

/**
 * Reads and parses the server info file
 *
 * Purpose: Central server info file is used throughout the codebase
 * Used by: overlord.js, hack-manager.js, backdoor-manager.js, contract-solver.js, purchase-server-manager.js (6 files!)
 *
 * @param {NS} ns - NetScript object
 * @param {string} filePath - Path to server info file (default: "/servers/server_info.txt")
 * @returns {Object[]|null} Array of server info objects, or null on error
 *
 * @example
 * const servers = readServerInfoFile(ns);
 * if (servers) {
 *     servers.forEach(server => {
 *         ns.print(`${server.hostname}: ${server.maxMoney}`);
 *     });
 * }
 */
export function readServerInfoFile(ns, filePath = "/servers/server_info.txt") {
    try {
        // Check if file exists
        if (!ns.fileExists(filePath)) {
            ns.print(`ERROR: ${filePath} not found`);
            return null;
        }

        // Read file contents
        const fileContent = ns.read(filePath);

        // Handle empty file
        if (!fileContent || fileContent.trim().length === 0) {
            ns.print(`ERROR: ${filePath} is empty`);
            return null;
        }

        // Parse JSON
        const serverData = JSON.parse(fileContent);

        // Validate it's an array
        if (!Array.isArray(serverData)) {
            ns.print(`ERROR: ${filePath} does not contain a valid array`);
            return null;
        }

        return serverData;
    } catch (error) {
        ns.print(`ERROR: Failed to read ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Reads and parses any JSON file
 *
 * Purpose: Generic JSON file reader with error handling
 * Used by: Any script that needs to read JSON data (augmentation plans, configs, etc.)
 *
 * @param {NS} ns - NetScript object
 * @param {string} filePath - Path to JSON file
 * @param {any} defaultValue - Value to return if file doesn't exist or parse fails (default: null)
 * @returns {any} Parsed JSON data or defaultValue
 *
 * @example
 * const config = readJsonFile(ns, "/config/settings.txt", {});
 * // Returns parsed object, or {} if file doesn't exist
 *
 * const plan = readJsonFile(ns, "/planning/augmentation_plan.txt", []);
 * // Returns parsed array, or [] if file doesn't exist
 */
export function readJsonFile(ns, filePath, defaultValue = null) {
    try {
        if (!ns.fileExists(filePath)) {
            return defaultValue;
        }

        const fileContent = ns.read(filePath);

        if (!fileContent || fileContent.trim().length === 0) {
            return defaultValue;
        }

        return JSON.parse(fileContent);
    } catch (error) {
        ns.print(`ERROR: Failed to parse JSON from ${filePath}: ${error.message}`);
        return defaultValue;
    }
}

/**
 * Writes data to a file as JSON
 *
 * Purpose: Standardized way to write JSON with optional pretty-printing
 * Used by: server-discovery.js, backdoor-manager.js, augmentation-planner.js (3 files)
 *
 * @param {NS} ns - NetScript object
 * @param {string} filePath - Path to write to
 * @param {any} data - Data to serialize as JSON
 * @param {boolean} pretty - Whether to pretty-print with indentation (default: true)
 * @returns {boolean} True if write succeeded, false otherwise
 *
 * @example
 * const serverData = [{hostname: "n00dles", maxMoney: 1750000}];
 * writeJsonFile(ns, "/servers/server_info.txt", serverData);
 * // Writes formatted JSON with 2-space indentation
 *
 * writeJsonFile(ns, "/cache/data.txt", {foo: "bar"}, false);
 * // Writes compact JSON (no formatting)
 */
export function writeJsonFile(ns, filePath, data, pretty = true) {
    try {
        const jsonString = pretty
            ? JSON.stringify(data, null, 2)  // Pretty print with 2-space indent
            : JSON.stringify(data);           // Compact

        await ns.write(filePath, jsonString, "w");
        return true;
    } catch (error) {
        ns.print(`ERROR: Failed to write JSON to ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Reads a plain text file
 *
 * Purpose: Simple wrapper for reading text files with error handling
 * Used by: Any script that needs to read non-JSON text files
 *
 * @param {NS} ns - NetScript object
 * @param {string} filePath - Path to text file
 * @param {string} defaultValue - Value to return if file doesn't exist (default: "")
 * @returns {string} File contents or defaultValue
 *
 * @example
 * const logData = readTextFile(ns, "/logs/hack.log", "No logs found");
 * ns.print(logData);
 */
export function readTextFile(ns, filePath, defaultValue = "") {
    try {
        if (!ns.fileExists(filePath)) {
            return defaultValue;
        }

        const content = ns.read(filePath);
        return content || defaultValue;
    } catch (error) {
        ns.print(`ERROR: Failed to read ${filePath}: ${error.message}`);
        return defaultValue;
    }
}
