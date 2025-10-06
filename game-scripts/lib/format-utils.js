/**
 * Formatting Utilities
 * Pure functions for formatting numbers, RAM, time, and percentages
 *
 * Note: For money/number formatting, use ns.formatNumber() directly
 */

/**
 * Formats a number with comma separators
 *
 * Purpose: Make large numbers more readable (e.g., 167371 -> 167,371)
 * Used by: Status displays for counts, threads, etc.
 *
 * @param {number} value - Number to format
 * @returns {string} Formatted number with commas
 *
 * @example
 * formatWithCommas(167371);
 * // Returns: "167,371"
 *
 * formatWithCommas(1234567);
 * // Returns: "1,234,567"
 */
export function formatWithCommas(value) {
    return value.toLocaleString('en-US');
}

/**
 * Formats RAM amount with GB/TB suffix
 *
 * Purpose: Display RAM in human-readable format
 * Used by: Server info displays, RAM availability logs
 *
 * @param {number} gigabytes - RAM amount in GB
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted RAM string
 *
 * @example
 * formatRam(1024);
 * // Returns: "1.02TB"
 *
 * formatRam(64);
 * // Returns: "64.00GB"
 *
 * formatRam(8192);
 * // Returns: "8.19TB"
 */
export function formatRam(gigabytes, decimals = 2) {
    if (gigabytes >= 1000000) {
        // Petabytes
        return (gigabytes / 1000000).toFixed(decimals) + "PB";
    } else if (gigabytes >= 1000) {
        // Terabytes
        return (gigabytes / 1000).toFixed(decimals) + "TB";
    } else {
        // Gigabytes
        return gigabytes.toFixed(decimals) + "GB";
    }
}

/**
 * Formats seconds into human-readable time string
 *
 * Purpose: Display countdowns, durations, ETAs
 * Used by: port-monitor.js for time remaining displays
 *
 * @param {number} totalSeconds - Total seconds
 * @param {boolean} includeSeconds - Include seconds in output (default: true)
 * @returns {string} Formatted time (e.g., "5m 30s", "2h 15m")
 *
 * @example
 * formatTime(90);
 * // Returns: "1m 30s"
 *
 * formatTime(3665);
 * // Returns: "1h 1m 5s"
 *
 * formatTime(3665, false);
 * // Returns: "1h 1m"
 *
 * formatTime(45);
 * // Returns: "45s"
 */
export function formatTime(totalSeconds, includeSeconds = true) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];

    if (hours > 0) {
        parts.push(`${hours}h`);
    }

    if (minutes > 0 || hours > 0) {
        parts.push(`${minutes}m`);
    }

    if (includeSeconds && (seconds > 0 || parts.length === 0)) {
        parts.push(`${seconds}s`);
    }

    return parts.join(" ");
}

/**
 * Formats a percentage value
 *
 * Purpose: Display percentages in consistent format
 * Used by: Progress bars, completion rates
 *
 * @param {number} value - Value between 0 and 1 (or 0-100 if isDecimal=false)
 * @param {number} decimals - Decimal places (default: 1)
 * @param {boolean} isDecimal - True if value is 0-1, false if 0-100 (default: true)
 * @returns {string} Formatted percentage with %
 *
 * @example
 * formatPercent(0.756);
 * // Returns: "75.6%"
 *
 * formatPercent(0.5, 0);
 * // Returns: "50%"
 *
 * formatPercent(75.6, 1, false);
 * // Returns: "75.6%"
 */
export function formatPercent(value, decimals = 1, isDecimal = true) {
    const percent = isDecimal ? value * 100 : value;
    return percent.toFixed(decimals) + "%";
}
