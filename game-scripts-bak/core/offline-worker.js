/** @param {NS} ns */
export async function main(ns) {
    const WORKER_SCRIPT = "workers/bot-worker.js";
    const GO_PLAYER_SCRIPT = "go/go-player.js";
    const WORKER_PORT = 1;
    const enableGo = ns.args.includes("--go");

    ns.tprint("=== OFFLINE WORKER SETUP ===");

    // Step 1: Kill scripts on home server only (preserve scripts on other servers)
    ns.tprint("Killing scripts on home server...");
    const currentScript = ns.getScriptName();
    const runningScripts = ns.ps("home");

    for (const script of runningScripts) {
        if (script.filename !== currentScript) {
            ns.scriptKill(script.filename, "home");
            ns.print(`Killed: ${script.filename} (PID: ${script.pid})`);
        }
    }

    // Wait a moment for scripts to terminate
    await ns.sleep(1000);

    // Step 1.5: Start Go bot if requested (before spawning workers to leave RAM for it)
    if (enableGo) {
        ns.tprint("Starting Go bot...");
        if (ns.fileExists(GO_PLAYER_SCRIPT, "home")) {
            const goPid = ns.exec(GO_PLAYER_SCRIPT, "home");
            if (goPid !== 0) {
                ns.tprint(`SUCCESS: Go bot started (PID: ${goPid})`);
            } else {
                ns.tprint(`WARNING: Failed to start Go bot`);
            }
        } else {
            ns.tprint(`WARNING: Go bot script not found at ${GO_PLAYER_SCRIPT}`);
        }
        await ns.sleep(500);
    }

    // Step 2: Check if worker script exists
    if (!ns.fileExists(WORKER_SCRIPT, "home")) {
        ns.tprint(`ERROR: ${WORKER_SCRIPT} not found on home server`);
        return;
    }

    // Step 3: Calculate maximum threads (leave 10% RAM available)
    const scriptRam = ns.getScriptRam(WORKER_SCRIPT);
    const totalRam = ns.getServerMaxRam("home");
    const usedRam = ns.getServerUsedRam("home"); // This script's RAM usage
    const reservedRam = totalRam * 0.10; // Reserve 10% of total RAM
    const availableRam = totalRam - usedRam - reservedRam;
    const maxThreads = Math.floor(availableRam / scriptRam);

    if (maxThreads <= 0) {
        ns.tprint(`ERROR: Not enough RAM to run ${WORKER_SCRIPT}`);
        ns.tprint(`Need ${scriptRam}GB, have ${availableRam}GB available`);
        return;
    }

    // Step 4: Check what target is available
    const currentTarget = ns.peek(WORKER_PORT);
    const targetServer = currentTarget !== "NULL PORT DATA" ? currentTarget : "n00dles";

    // Step 5: Display setup info
    ns.tprint("Setup Information:");
    ns.tprint(`  Total RAM: ${totalRam}GB`);
    ns.tprint(`  Available RAM: ${availableRam}GB`);
    ns.tprint(`  Script RAM Cost: ${scriptRam}GB per thread`);
    ns.tprint(`  Max Threads: ${maxThreads}`);
    ns.tprint(`  Target Server: ${targetServer}`);

    // Step 6: Start the worker with max threads
    ns.tprint(`Starting ${WORKER_SCRIPT} with ${maxThreads} threads...`);

    const pid = ns.exec(WORKER_SCRIPT, "home", maxThreads);

    if (pid !== 0) {
        ns.tprint(`SUCCESS: ${WORKER_SCRIPT} started with PID ${pid}`);
        ns.tprint(`Running ${maxThreads} threads targeting ${targetServer}`);
        ns.tprint("Ready for offline mode! 🌙");
    } else {
        ns.tprint(`ERROR: Failed to start ${WORKER_SCRIPT}`);
    }

    // Step 7: Show final status
    await ns.sleep(2000);
    const finalUsedRam = ns.getServerUsedRam("home");
    const finalAvailableRam = totalRam - finalUsedRam;

    ns.tprint("Final Status:");
    ns.tprint(`  RAM Used: ${finalUsedRam}GB / ${totalRam}GB`);
    ns.tprint(`  RAM Free: ${finalAvailableRam}GB`);
    ns.tprint("Offline setup complete! 💤");
}