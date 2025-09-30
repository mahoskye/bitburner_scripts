/** @param {NS} ns */
export async function main(ns) {
  const port = ns.args[0] || 1;
  const msg = ns.args[1] || "Hi There";
  ns.clearPort(port)
  ns.writePort(port, msg);
}