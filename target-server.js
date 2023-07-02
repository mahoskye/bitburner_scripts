/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("sleep");

    while (ns.peek(7) === 'NULL PORT DATA') {
        await ns.sleep(1000);
    }

    const GLOBALS = JSON.parse(ns.peek(7));

    const HOME_SERVER = GLOBALS.HOME_SERVER;
    const PLAYER_SCRIPTS = GLOBALS.PLAYER_SCRIPTS;

    const DATA_PORT = GLOBALS.TARGET_SERVER_DATA_PORT;
    let DATA = GLOBALS.TARGET_SERVER;

    function updateUI() {

        const doc = eval("document");
        const hook0 = doc.getElementById("overview-extra-hook-0");

        // hook0.innerHTML = "<p>Target Server: " + DATA.targetServer + "</p>";
        hook0.innerHTML = "<p>" + DATA.targetServer + "</p>";
        ns.tprint(`Target Server updated to: ${DATA.targetServer}`);
    }

    async function updateTargetServer() {
        while (ns.peek(GLOBALS.GLOBALS_PORT) === 'NULL PORT DATA') {
            await ns.sleep(1000);
        }
        let checkGlobal = JSON.parse(ns.peek(GLOBALS.GLOBALS_PORT));
        DATA = checkGlobal.TARGET_SERVER;

        ns.clearPort(DATA_PORT);
        await ns.sleep(1000);
        ns.writePort(DATA_PORT, JSON.stringify(DATA));
    }

    while (true) {
        await updateTargetServer();
        await ns.sleep(1000);

        updateUI();
        await ns.sleep(1000);

        if (!ns.scriptRunning(PLAYER_SCRIPTS.crawler.script, HOME_SERVER)) {
            await ns.exec(PLAYER_SCRIPTS.crawler.script, HOME_SERVER)
        };

        await ns.sleep(1000 * 60); // 1 minute
    }

}