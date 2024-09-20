/** @param {NS} ns */


export async function main(ns) {
    let allStocks = ns.stock.getSymbols();

    for (const symbol of allStocks) {
        ns.tprint(`Selling ${symbol}`);
        ns.stock.sellStock(symbol, ns.stock.getMaxShares(symbol));
    }


}