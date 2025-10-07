/**
 * Test script to explore faction/reputation API
 * Tests what we can access without Singularity functions
 */

export async function main(ns) {
    ns.tprint("=== Faction/Reputation API Test ===");
    ns.tprint("");

    // Test basic player info
    ns.tprint("--- Player Info ---");
    const player = ns.getPlayer();
    ns.tprint(`Hacking: ${player.skills.hacking}`);
    ns.tprint(`Combat: ${player.skills.strength}/${player.skills.defense}/${player.skills.dexterity}/${player.skills.agility}`);
    ns.tprint(`Charisma: ${player.skills.charisma}`);
    ns.tprint(`Money: $${ns.formatNumber(player.money)}`);
    ns.tprint("");

    // Test faction functions (these should work without SF4)
    ns.tprint("--- Faction Functions (No SF4) ---");

    // Try to check owned augmentations
    try {
        const ownedAugs = ns.singularity.getOwnedAugmentations();
        ns.tprint(`Owned Augmentations: ${ownedAugs.length}`);
        if (ownedAugs.length > 0) {
            ns.tprint(`  Examples: ${ownedAugs.slice(0, 3).join(", ")}`);
        }
    } catch (e) {
        ns.tprint(`getOwnedAugmentations: ${e.message}`);
    }
    ns.tprint("");

    // Try to get current factions
    try {
        const factions = player.factions || [];
        ns.tprint(`Player Factions: ${factions.length}`);
        if (factions.length > 0) {
            ns.tprint(`  Factions: ${factions.join(", ")}`);
        }
    } catch (e) {
        ns.tprint(`Player factions: ${e.message}`);
    }
    ns.tprint("");

    // Try faction reputation check
    try {
        const testFaction = "CyberSec"; // Common early faction
        const rep = ns.singularity.getFactionRep(testFaction);
        ns.tprint(`${testFaction} rep: ${ns.formatNumber(rep)}`);
    } catch (e) {
        ns.tprint(`getFactionRep: ${e.message}`);
    }
    ns.tprint("");

    // Try augmentation listing
    try {
        const testFaction = "CyberSec";
        const augs = ns.singularity.getAugmentationsFromFaction(testFaction);
        ns.tprint(`${testFaction} augmentations: ${augs.length}`);
        if (augs.length > 0) {
            ns.tprint(`  Examples: ${augs.slice(0, 3).join(", ")}`);
        }
    } catch (e) {
        ns.tprint(`getAugmentationsFromFaction: ${e.message}`);
    }
    ns.tprint("");

    // Try augmentation stats
    try {
        const testAug = "Augmented Targeting I";
        const stats = ns.singularity.getAugmentationStats(testAug);
        ns.tprint(`${testAug} stats:`, JSON.stringify(stats, null, 2));
    } catch (e) {
        ns.tprint(`getAugmentationStats: ${e.message}`);
    }
    ns.tprint("");

    // Check what player object contains
    ns.tprint("--- Player Object Details ---");
    ns.tprint(`Factions: ${JSON.stringify(player.factions)}`);
    ns.tprint(`Jobs: ${JSON.stringify(player.jobs)}`);
    ns.tprint(`City: ${player.city}`);
    ns.tprint(`Karma: ${player.karma}`);
    ns.tprint("");

    // Check if we can get faction favor/rep through other means
    ns.tprint("--- Alternative Faction Data ---");

    // Test if formulas API works
    try {
        const hasFormulas = ns.fileExists("Formulas.exe");
        ns.tprint(`Has Formulas.exe: ${hasFormulas}`);
    } catch (e) {
        ns.tprint(`Formulas check: ${e.message}`);
    }

    // Check grafting API (SF10)
    try {
        const graftableAugs = ns.grafting.getGraftableAugmentations();
        ns.tprint(`Graftable Augmentations: ${graftableAugs.length}`);
    } catch (e) {
        ns.tprint(`Grafting API: ${e.message}`);
    }
}
