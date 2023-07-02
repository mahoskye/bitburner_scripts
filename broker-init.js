/** @param {NS} ns */
export async function main(ns) {

    // Buy WSE Account
    if (!ns.stock.hasWSEAccount()) while (!ns.stock.purchaseWseAccount()) await ns.sleep(5000);

    // Buy TIX API access
    if (!ns.stock.hasTIXAPIAccess()) while (!ns.stock.purchaseTixApi()) await ns.sleep(5000);

    // Buy 4S Market data
    if (!ns.stock.has4SData()) while (!ns.stock.purchase4SMarketData()) await ns.sleep(5000);

    // Buy 4S Market Data TIX API access
    if (!ns.stock.has4SDataTIXAPI()) while (!ns.stock.purchase4SMarketDataTixApi()) await ns.sleep(5000);

    // Once we have the access we need, we can start the broker
    ns.spawn("broker.js", 1);
}