/**
 * Server Cache
 * Caches and retrieves server information
 */

const CACHE_FILE = "/data/server_cache.txt";

export async function saveCache(ns, serverData) {
    // TODO: Write server data to cache file
}

export async function loadCache(ns) {
    // TODO: Read server data from cache file
    return {};
}

export async function main(ns) {
    ns.tprint("INFO: Server cache utilities loaded as library");
}
