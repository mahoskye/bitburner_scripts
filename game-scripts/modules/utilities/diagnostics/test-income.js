/**
 * Test what getScriptIncome returns
 */

export async function main(ns) {
    const income = ns.getScriptIncome();

    ns.tprint("=== Script Income Test ===");
    ns.tprint(`Full return value: ${JSON.stringify(income)}`);
    ns.tprint(`Type: ${typeof income}`);
    ns.tprint(`Is Array: ${Array.isArray(income)}`);

    if (Array.isArray(income)) {
        ns.tprint(`[0] = ${income[0]} (per second)`);
        ns.tprint(`[1] = ${income[1]} (script name)`);
    }

    ns.tprint(`\nFormatted: $${ns.formatNumber(income[0] || income)}/s`);
}
