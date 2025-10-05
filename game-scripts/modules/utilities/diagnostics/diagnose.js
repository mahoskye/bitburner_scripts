/**
 * Diagnostic Script
 * Checks system state and reports issues
 */

export async function main(ns) {
    ns.tprint("=== SYSTEM DIAGNOSTICS ===");

    // Check what's running
    ns.tprint("\n--- Running Scripts ---");
    const servers = ["home"];
    const seen = new Set(["home"]);

    for (let i = 0; i < servers.length; i++) {
        const neighbors = ns.scan(servers[i]);
        for (const neighbor of neighbors) {
            if (!seen.has(neighbor)) {
                seen.add(neighbor);
                servers.push(neighbor);
            }
        }
    }

    let totalScripts = 0;
    for (const server of servers) {
        const processes = ns.ps(server);
        if (processes.length > 0) {
            ns.tprint(`${server}: ${processes.length} scripts`);
            for (const proc of processes) {
                ns.tprint(`  - ${proc.filename} (${proc.threads}t, PID: ${proc.pid})`);
            }
            totalScripts += processes.length;
        }
    }
    ns.tprint(`Total: ${totalScripts} scripts running`);

    // Check port 1 (target)
    ns.tprint("\n--- Port 1 (Hack Target) ---");
    const port1 = ns.peek(1);
    if (port1 === "NULL PORT DATA") {
        ns.tprint("ISSUE: Port 1 is empty - workers will use n00dles fallback");
    } else {
        ns.tprint(`Target data: ${port1}`);
        try {
            const parsed = JSON.parse(port1);
            ns.tprint(`  Parsed target: ${parsed.target}`);
            ns.tprint(`  Switch mode: ${parsed.mode || "immediate"}`);

            // Check if target is valid
            const maxMoney = ns.getServerMaxMoney(parsed.target);
            ns.tprint(`  Target max money: $${ns.formatNumber(maxMoney)}`);
            if (maxMoney === 0) {
                ns.tprint(`  ISSUE: Target has $0 max money!`);
            }
        } catch (e) {
            ns.tprint(`  Plain string target: ${port1}`);
        }
    }

    // Check income
    ns.tprint("\n--- Income ---");
    const scriptIncome = ns.getScriptIncome()[0] || 0;
    ns.tprint(`Script income: $${ns.formatNumber(scriptIncome)}/s`);
    if (scriptIncome === 0 && totalScripts > 0) {
        ns.tprint("ISSUE: Scripts running but $0 income");
    }

    // Check n00dles (common fallback)
    ns.tprint("\n--- n00dles Status ---");
    const noodlesMoney = ns.getServerMoneyAvailable("n00dles") || 0;
    const noodlesMax = ns.getServerMaxMoney("n00dles") || 0;
    const noodlesSec = ns.getServerSecurityLevel("n00dles") || 0;
    const noodlesMinSec = ns.getServerMinSecurityLevel("n00dles") || 0;
    ns.tprint(`Money: $${ns.formatNumber(noodlesMoney)} / $${ns.formatNumber(noodlesMax)} (${noodlesMax > 0 ? ((noodlesMoney/noodlesMax)*100).toFixed(1) : 0}%)`);
    ns.tprint(`Security: ${noodlesSec.toFixed(1)} / ${noodlesMinSec.toFixed(1)} (min)`);

    ns.tprint("\n=== END DIAGNOSTICS ===");
}
