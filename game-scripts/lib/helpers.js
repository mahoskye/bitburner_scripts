/**
 * Helper Functions
 * Shared utility functions used across modules
 */

export function scanAll(ns, current = "home", visited = new Set()) {
    // TODO: Recursive server scanning
    return Array.from(visited);
}

export function hasRootAccess(ns, server) {
    // TODO: Check root access and attempt to gain it
    return false;
}

export function getAvailableRAM(ns, server) {
    // TODO: Calculate available RAM on server
    return 0;
}

export async function main(ns) {
    ns.tprint("INFO: Helper functions loaded as library");
}
