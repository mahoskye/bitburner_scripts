/**
 * Hacking Worker
 * Self-contained autonomous worker for hack/grow/weaken operations
 *
 * DESIGN: Fully self-contained with no imports for easy deployment
 * - Reads target from port 1 (configurable via args)
 * - Adapts strategy based on server money/security state
 * - Automatically switches targets when port is updated
 * - Falls back to n00dles if no target specified
 *
 * RAM Cost: ~1.75GB
 * Deployment: Single file - just copy and run
 */

export async function main(ns) {
    // ============================================================================
    // CONFIGURATION (Hardcoded - no imports needed)
    // ============================================================================

    const HACK_THRESHOLD = 0.75;      // Hack when money > 75% of max
    const GROW_THRESHOLD = 0.5;       // Grow when money < 50% of max
    const SECURITY_MARGIN = 5;        // Weaken when security > min + 5
    const PORT_HACK_TARGET = 1;       // Port number for target coordination
    const DEFAULT_TARGET = "n00dles"; // Fallback target
    const PORT_NO_DATA = "NULL PORT DATA";

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    const currentServer = ns.getHostname();

    // Get port number from arguments (default to 1)
    const portNumber = ns.args.length > 0 ? parseInt(ns.args[0]) : PORT_HACK_TARGET;

    // Validate port number
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 20) {
        ns.tprint(`ERROR: Invalid port ${ns.args[0]}. Using default port ${PORT_HACK_TARGET}.`);
        portNumber = PORT_HACK_TARGET;
    }

    // Read initial target
    let initialTarget = ns.peek(portNumber);
    if (initialTarget === PORT_NO_DATA) {
        initialTarget = DEFAULT_TARGET;
    }

    ns.tprint(`Worker started on ${currentServer}`);
    ns.tprint(`  Port: ${portNumber}`);
    ns.tprint(`  Initial target: ${initialTarget}`);

    // ============================================================================
    // MAIN LOOP
    // ============================================================================

    while (true) {
        // Read current target from port
        let target = ns.peek(portNumber);
        if (target === PORT_NO_DATA) {
            target = DEFAULT_TARGET;
            ns.print(`[${currentServer}] No target specified. Using ${DEFAULT_TARGET}`);
        } else {
            ns.print(`[${currentServer}] Target: ${target}`);
        }

        // Inner loop - hack this target until it changes
        while (true) {
            // Get server status
            const maxMoney = ns.getServerMaxMoney(target);
            const currentMoney = ns.getServerMoneyAvailable(target);
            const minSecurity = ns.getServerMinSecurityLevel(target);
            const currentSecurity = ns.getServerSecurityLevel(target);

            // Decide action based on server state
            if (currentSecurity > minSecurity + SECURITY_MARGIN) {
                // Priority 1: Reduce security if too high
                ns.print(`[${currentServer}] Weakening ${target} (sec: ${currentSecurity.toFixed(1)} > ${minSecurity + SECURITY_MARGIN})`);
                await ns.weaken(target);

            } else if (currentMoney < maxMoney * GROW_THRESHOLD) {
                // Priority 2: Grow money if too low
                ns.print(`[${currentServer}] Growing ${target} (money: $${currentMoney.toFixed(0)} < ${(maxMoney * GROW_THRESHOLD).toFixed(0)})`);
                await ns.grow(target);

            } else if (currentMoney > maxMoney * HACK_THRESHOLD) {
                // Priority 3: Hack if money is high enough
                ns.print(`[${currentServer}] Hacking ${target} (money: $${currentMoney.toFixed(0)})`);
                await ns.hack(target);

            } else {
                // Wait if conditions aren't optimal (between grow and hack thresholds)
                ns.print(`[${currentServer}] Waiting for optimal conditions on ${target}`);
                await ns.sleep(1000);
            }

            // Check if target has changed
            const newTarget = ns.peek(portNumber);

            if (newTarget !== PORT_NO_DATA && newTarget !== target) {
                // Target changed - break to outer loop
                ns.print(`[${currentServer}] Target changed: ${target} -> ${newTarget}`);
                break;

            } else if (newTarget === PORT_NO_DATA && target !== DEFAULT_TARGET) {
                // Port cleared - fall back to default
                ns.print(`[${currentServer}] Port cleared, falling back to ${DEFAULT_TARGET}`);
                break;
            }
        }
    }
}
