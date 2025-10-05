/**
 * Watch Worker Activity
 * Monitors what workers are actually doing
 */

export async function main(ns) {
    const server = ns.args[0] || "max-hardware";

    ns.tprint(`Watching worker activity on ${server}...`);
    ns.tprint(`Check the worker's log window for details`);
    ns.tprint(`Press Ctrl+C to stop`);

    // Tail the worker to see its logs
    ns.tail("modules/hacking/worker.js", server);
}
