/**
 * Check Target Viability
 * Checks if current target is actually hackable
 */

export async function main(ns) {
    const target = ns.args[0] || "max-hardware";

    ns.tprint(`=== Checking ${target} ===`);

    const hackLevel = ns.getHackingLevel();
    const reqLevel = ns.getServerRequiredHackingLevel(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    const currentSec = ns.getServerSecurityLevel(target);

    ns.tprint(`Your hacking level: ${hackLevel}`);
    ns.tprint(`Required level: ${reqLevel}`);

    if (hackLevel < reqLevel) {
        ns.tprint(`PROBLEM: You can't hack this server yet! Need ${reqLevel - hackLevel} more levels`);
    } else {
        ns.tprint(`✓ You can hack this server`);
    }

    ns.tprint(`\nMax money: $${ns.formatNumber(maxMoney)}`);
    ns.tprint(`Current money: $${ns.formatNumber(currentMoney)} (${((currentMoney/maxMoney)*100).toFixed(1)}%)`);
    ns.tprint(`Security: ${currentSec.toFixed(1)} / ${minSec} (min)`);

    if (currentMoney === 0) {
        ns.tprint(`\nServer is drained - workers will be growing it back`);
    }

    if (currentSec > minSec + 5) {
        ns.tprint(`Security too high - workers will be weakening`);
    }
}
