/**
 * Check RAM cost of a script
 * Usage: run check-ram.js [script-path]
 */

export async function main(ns) {
    const scriptPath = ns.args[0] || '/modules/monitoring/status-monitor.js';

    const ramCost = ns.getScriptRam(scriptPath);

    if (ramCost === 0) {
        ns.tprint(`ERROR: Script not found: ${scriptPath}`);
    } else {
        ns.tprint(`RAM cost of ${scriptPath}: ${ramCost.toFixed(2)} GB`);
    }
}
