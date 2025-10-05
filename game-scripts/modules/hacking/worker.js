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
    const GROW_THRESHOLD = 0.75;      // Grow when money < 75% of max (same as hack to avoid dead zone)
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
        let targetData = ns.peek(portNumber);
        let target = DEFAULT_TARGET;
        let switchMode = "immediate";

        if (targetData === PORT_NO_DATA) {
            target = DEFAULT_TARGET;
            ns.print(`[${currentServer}] No target specified. Using ${DEFAULT_TARGET}`);
        } else {
            // Try to parse JSON format (new format with mode)
            try {
                const parsed = JSON.parse(targetData);
                target = parsed.target || DEFAULT_TARGET;
                switchMode = parsed.mode || "immediate";
                ns.print(`[${currentServer}] Target: ${target} (mode: ${switchMode})`);
            } catch (e) {
                // Fall back to old format (plain string)
                target = targetData;
                ns.print(`[${currentServer}] Target: ${target} (old format, parse error: ${e.message})`);
            }
        }

        // Validate target is a string, not the JSON object
        if (typeof target !== "string") {
            ns.print(`[${currentServer}] ERROR: Invalid target type: ${typeof target}, defaulting to ${DEFAULT_TARGET}`);
            target = DEFAULT_TARGET;
        }

        // Inner loop - hack this target until it changes
        while (true) {
            // Get server status
            const maxMoney = ns.getServerMaxMoney(target);
            const currentMoney = ns.getServerMoneyAvailable(target);
            const minSecurity = ns.getServerMinSecurityLevel(target);
            const currentSecurity = ns.getServerSecurityLevel(target);

            // Get timestamp for logging
            const timestamp = new Date().toLocaleTimeString();

            // Decide action based on server state
            if (currentSecurity > minSecurity + SECURITY_MARGIN) {
                // Priority 1: Reduce security if too high
                ns.print(`[${timestamp}] [${currentServer}] Weakening ${target} (sec: ${currentSecurity.toFixed(1)} > ${minSecurity + SECURITY_MARGIN})`);
                await ns.weaken(target);

            } else if (currentMoney < maxMoney * GROW_THRESHOLD) {
                // Priority 2: Grow money if below threshold
                ns.print(`[${timestamp}] [${currentServer}] Growing ${target} (money: $${currentMoney.toFixed(0)} < ${(maxMoney * GROW_THRESHOLD).toFixed(0)})`);
                await ns.grow(target);

            } else {
                // Priority 3: Hack (money >= threshold and security is low)
                ns.print(`[${timestamp}] [${currentServer}] Hacking ${target} (money: $${currentMoney.toFixed(0)})`);
                await ns.hack(target);
            }

            // Check if target has changed based on switch mode
            const newTargetData = ns.peek(portNumber);

            if (newTargetData === PORT_NO_DATA && target !== DEFAULT_TARGET) {
                // Port cleared - fall back to default
                ns.print(`[${currentServer}] Port cleared, falling back to ${DEFAULT_TARGET}`);
                break;
            }

            if (newTargetData !== PORT_NO_DATA && newTargetData !== targetData) {
                // Target data changed - parse it
                let newTarget = DEFAULT_TARGET;
                let newSwitchMode = "immediate";

                try {
                    const parsed = JSON.parse(newTargetData);
                    newTarget = parsed.target;
                    newSwitchMode = parsed.mode || "immediate";
                } catch (e) {
                    // Fall back to old format
                    newTarget = newTargetData;
                }

                // Only switch if:
                // 1. Target actually changed, AND
                // 2. Mode is "immediate" OR we just completed an operation
                if (newTarget !== target) {
                    if (newSwitchMode === "immediate") {
                        ns.print(`[${currentServer}] Target changed (immediate): ${target} -> ${newTarget}`);
                        break;
                    } else {
                        // Mode is "after_operation" - continue with current operation
                        // We'll check again after the next operation completes
                        ns.print(`[${currentServer}] New target available (${newTarget}), finishing current operation first`);
                    }
                }
            }
        }
    }
}
