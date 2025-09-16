/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Port Debug Tool ===");

    for (let port = 1; port <= 5; port++) {
        const value = ns.peek(port);
        ns.tprint(`Port ${port}: ${value}`);

        if (port === 2 && value !== "NULL PORT DATA") {
            try {
                const parsed = JSON.parse(value);
                ns.tprint(`  Parsed Port 2: ${JSON.stringify(parsed, null, 2)}`);
            } catch (e) {
                ns.tprint(`  Error parsing Port 2: ${e.message}`);
            }
        }
    }

    ns.tprint("\n=== Running Scripts ===");
    const processes = ns.ps();
    processes.forEach(proc => {
        if (proc.filename.includes('overlord') || proc.filename.includes('port')) {
            ns.tprint(`${proc.filename} (PID: ${proc.pid}) - Args: ${proc.args.join(', ')}`);
        }
    });
}