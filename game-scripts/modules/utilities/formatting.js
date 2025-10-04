/**
 * Formatting Utilities
 * UI and logging helper functions
 */

export function formatMoney(value) {
    // TODO: Format currency values
    return `$${value}`;
}

export function formatRAM(gb) {
    // TODO: Format RAM values
    return `${gb}GB`;
}

export function formatTime(ms) {
    // TODO: Format time values
    return `${ms}ms`;
}

export async function main(ns) {
    ns.tprint("INFO: Formatting utilities loaded as library");
}
