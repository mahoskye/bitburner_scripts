/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== SERVER RENAMING UTILITY ===");

    // Get all purchased servers
    const purchasedServers = ns.getPurchasedServers();

    if (purchasedServers.length === 0) {
        ns.tprint("No purchased servers found.");
        return;
    }

    ns.tprint(`Found ${purchasedServers.length} purchased servers`);

    // Create mapping of current names to new standardized names
    const renameMap = [];
    const properlyNamed = [];

    for (let i = 0; i < purchasedServers.length; i++) {
        const currentName = purchasedServers[i];
        const standardName = `pserv-${i.toString().padStart(4, '0')}`;

        if (currentName === standardName) {
            properlyNamed.push(currentName);
        } else {
            renameMap.push({ current: currentName, target: standardName });
        }
    }

    if (properlyNamed.length > 0) {
        ns.tprint(`Already properly named: ${properlyNamed.join(", ")}`);
    }

    if (renameMap.length === 0) {
        ns.tprint("All servers already have proper naming scheme!");
        return;
    }

    ns.tprint(`\nServers to rename:`);
    renameMap.forEach(rename => {
        ns.tprint(`  ${rename.current} → ${rename.target}`);
    });

    // Ask for confirmation
    const confirm = ns.args[0];
    if (confirm !== "confirm") {
        ns.tprint("\nTo proceed with renaming, run:");
        ns.tprint("run utils/rename-servers.js confirm");
        ns.tprint("\nWARNING: This will rename your purchased servers!");
        return;
    }

    // Proceed with renaming
    ns.tprint("\nStarting rename process...");
    let successCount = 0;
    let failureCount = 0;

    for (const rename of renameMap) {
        ns.print(`Renaming ${rename.current} to ${rename.target}...`);

        // Check if target name is already taken
        if (purchasedServers.includes(rename.target)) {
            ns.tprint(`ERROR: Target name ${rename.target} already exists! Skipping ${rename.current}`);
            failureCount++;
            continue;
        }

        if (ns.renamePurchasedServer(rename.current, rename.target)) {
            ns.tprint(`✓ Successfully renamed ${rename.current} → ${rename.target}`);
            successCount++;
        } else {
            ns.tprint(`✗ Failed to rename ${rename.current} → ${rename.target}`);
            failureCount++;
        }

        // Small delay to avoid overwhelming the system
        await ns.sleep(100);
    }

    ns.tprint(`\n=== RENAME COMPLETE ===`);
    ns.tprint(`Successful renames: ${successCount}`);
    ns.tprint(`Failed renames: ${failureCount}`);

    if (successCount > 0) {
        ns.tprint("\nYour servers now use the standardized pserv-#### naming scheme!");
    }

    if (failureCount > 0) {
        ns.tprint("\nSome renames failed. You may need to manually resolve conflicts.");
    }
}