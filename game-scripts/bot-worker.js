/** @param {NS} ns */
export async function main(ns) {
    // Configuration
    const HACK_THRESHOLD = 0.75; // Hack when server money is above 75% of max
    const GROW_THRESHOLD = 0.5; // Grow when server money is below 50% of max
    const DEFAULT_PORT = 1; // Default port to read target from
    const DEFAULT_TARGET = "n00dles"; // Default target if none is specified

    // Get the name of the server this script is running on
    const currentServer = ns.getHostname();

    // Get port number from arguments, default to 1 if not provided
    const portNumber = ns.args.length > 0 ? parseInt(ns.args[0]) : DEFAULT_PORT;

    // Validate port number
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 20) {
        ns.tprint(`ERROR: Invalid port number. Using default port ${DEFAULT_PORT}.`);
        portNumber = DEFAULT_PORT;
    }

    // Determine initial target using peek
    let initialTarget = ns.peek(portNumber);
    if (initialTarget === "NULL PORT DATA") {
        initialTarget = DEFAULT_TARGET;
    }

    ns.tprint(
        `Bot worker started on ${currentServer}. Listening on port ${portNumber}. Initial target: ${initialTarget}`
    );

    while (true) {
        // Read target from port
        let target = ns.peek(portNumber);
        if (target === "NULL PORT DATA") {
            target = DEFAULT_TARGET;
            ns.print(`[${currentServer}] No target specified. Defaulting to ${DEFAULT_TARGET}`);
        } else {
            ns.print(`[${currentServer}] Received target: ${target}`);
        }

        // Main hacking loop
        while (true) {
            const maxMoney = ns.getServerMaxMoney(target);
            const minSecurity = ns.getServerMinSecurityLevel(target);
            const currentSecurity = ns.getServerSecurityLevel(target);
            const currentMoney = ns.getServerMoneyAvailable(target);

            if (currentSecurity > minSecurity + 5) {
                await ns.weaken(target);
            } else if (currentMoney < maxMoney * GROW_THRESHOLD) {
                await ns.grow(target);
            } else if (currentMoney > maxMoney * HACK_THRESHOLD) {
                await ns.hack(target);
            } else {
                await ns.sleep(1000); // Wait if conditions aren't optimal
            }

            // Check if target has changed
            const newTarget = ns.peek(portNumber);
            if (newTarget !== "NULL PORT DATA" && newTarget !== target) {
                ns.print(`[${currentServer}] Switching target from ${target} to ${newTarget}`);
                target = newTarget; // Update target
                ns.peek(portNumber); // Clear the port after reading
                break; // Exit inner loop to start fresh with new target
            } else if (newTarget === "NULL PORT DATA" && target !== DEFAULT_TARGET) {
                ns.print(`[${currentServer}] No target specified. Switching to default target ${DEFAULT_TARGET}`);
                target = DEFAULT_TARGET;
                break; // Exit inner loop to start fresh with default target
            }
        }
    }
}
