/**
 * Test if we can actually hack the current target
 */

export async function main(ns) {
    const target = ns.args[0] || "max-hardware";

    ns.tprint(`Testing operations on ${target}...`);

    // Check root access
    if (!ns.hasRootAccess(target)) {
        ns.tprint(`ERROR: No root access to ${target}!`);
        return;
    }
    ns.tprint(`✓ Have root access`);

    // Check hacking level
    const hackLevel = ns.getHackingLevel();
    const reqLevel = ns.getServerRequiredHackingLevel(target);
    ns.tprint(`Hack level: ${hackLevel} / ${reqLevel} required`);

    // Try a weaken
    ns.tprint(`\nTesting weaken (will take ~${ns.getWeakenTime(target)/1000}s)...`);
    const weakenResult = await ns.weaken(target);
    ns.tprint(`Weaken reduced security by: ${weakenResult}`);

    // Try a grow
    ns.tprint(`\nTesting grow (will take ~${ns.getGrowTime(target)/1000}s)...`);
    const moneyBefore = ns.getServerMoneyAvailable(target);
    const growResult = await ns.grow(target);
    const moneyAfter = ns.getServerMoneyAvailable(target);
    ns.tprint(`Grow multiplier: ${growResult}x`);
    ns.tprint(`Money before: $${ns.formatNumber(moneyBefore)}`);
    ns.tprint(`Money after: $${ns.formatNumber(moneyAfter)}`);

    // Try a hack
    ns.tprint(`\nTesting hack (will take ~${ns.getHackTime(target)/1000}s)...`);
    const moneyBefore2 = ns.getServerMoneyAvailable(target);
    const hackResult = await ns.hack(target);
    const moneyAfter2 = ns.getServerMoneyAvailable(target);
    ns.tprint(`Hack stole: $${ns.formatNumber(hackResult)}`);
    ns.tprint(`Money before: $${ns.formatNumber(moneyBefore2)}`);
    ns.tprint(`Money after: $${ns.formatNumber(moneyAfter2)}`);

    if (hackResult === 0) {
        ns.tprint(`\nWARNING: Hack returned $0 - either failed or server has no money`);
    }
}
