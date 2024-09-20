/** @param {NS} ns */
export async function main(ns) {
  const target = "joesguns";
  const moneyThreshold = ns.getServerMaxMoney(target);
  const securityThreshold = ns.getServerMinSecurityLevel(target);

  if (ns.fileExists("BruteSSH.exe", "home")) {
    ns.brutessh(target);
  }

  ns.nuke(target);

  while (true) {
    if (ns.getServerSecurityLevel(target) > securityThreshold) {
      await ns.weaken(target);
    } else if (ns.getServerMoneyAvailable(target) > moneyThreshold) {
      await ns.grow(target);
    } else {
      await ns.hack(target);
    }
  }
}
