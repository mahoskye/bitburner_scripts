/**
 * Manually set hack target
 * Writes target to port 1 to override command server
 */

export async function main(ns) {
    const target = ns.args[0] || "n00dles";

    const targetData = {
        target: target,
        mode: "immediate",
        score: 0
    };

    ns.clearPort(1);
    await ns.writePort(1, JSON.stringify(targetData));

    ns.tprint(`Target set to: ${target}`);
    ns.tprint(`Workers will switch immediately`);
    ns.tprint(`Note: Command server will override this on next update`);
}
