/**
 * Stock Market Trader
 * Automated stock trading using TIX API
 *
 * DESIGN: Automated trading manager
 * - Checks for WSE and TIX API access
 * - Buys/sells stocks based on forecast
 * - Reports portfolio status to port
 * - Uses simple momentum strategy
 *
 * RAM Cost: ~6-8GB (TIX API functions)
 *
 * REQUIREMENTS:
 *   - $25m for WSE account
 *   - $5b for TIX API access
 *   - $1b for 4S Market Data (view forecasts)
 *   - $25b for 4S Market Data API (optional, programmatic access)
 *
 * USAGE:
 *   run modules/resources/stock-trader.js
 */

import { disableCommonLogs } from '/lib/misc-utils.js';
import { writePort } from '/lib/port-utils.js';
import { PORTS } from '/config/ports.js';
import { STOCK_MARKET_COSTS } from '/config/money.js';

export async function main(ns) {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    disableCommonLogs(ns);

    const CONFIG = {
        TICK_INTERVAL: 6000,        // Stock market updates every 6 seconds
        BUY_THRESHOLD: 0.60,        // Buy if forecast > 60%
        SELL_THRESHOLD: 0.40,       // Sell if forecast < 40%
        POSITION_PERCENT: 0.10,     // Invest 10% of available money per stock
        MIN_CASH_RESERVE: 1000000,  // Keep 1m minimum cash
    };

    ns.tprint("Stock trader started");

    // ============================================================================
    // CHECK ACCESS
    // ============================================================================

    // Check if we have stock market access
    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint(`Stock trader waiting for TIX API access ($${ns.formatNumber(STOCK_MARKET_COSTS.TIX_API, 2)} required)`);

        // Wait until TIX API is available
        while (!ns.stock.hasTIXAPIAccess()) {
            const disabledStatus = {
                active: false,
                disabled: true,
                reason: "No TIX API access",
                requiredCost: STOCK_MARKET_COSTS.TIX_API,
                lastUpdate: Date.now()
            };
            writePort(ns, PORTS.STOCK_MARKET, JSON.stringify(disabledStatus));
            await ns.sleep(60000); // Check every minute
        }

        ns.tprint("TIX API access acquired - starting stock trader");
    }

    const has4SData = ns.stock.has4SDataTIXAPI();
    if (!has4SData) {
        ns.tprint("WARNING: No 4S Market Data - using simple price-based strategy");
    }

    // ============================================================================
    // MAIN LOOP
    // ============================================================================

    let totalProfit = 0;
    let totalTrades = 0;

    while (true) {
        const money = ns.getServerMoneyAvailable("home");
        const symbols = ns.stock.getSymbols();
        let portfolioValue = 0;
        let positions = 0;

        // Check all stocks
        for (const sym of symbols) {
            const position = ns.stock.getPosition(sym);
            const shares = position[0];
            const avgPrice = position[1];

            if (shares > 0) {
                const currentPrice = ns.stock.getAskPrice(sym);
                portfolioValue += shares * currentPrice;
                positions++;
            }

            // Trading logic
            if (has4SData) {
                // Use forecast-based strategy
                const forecast = ns.stock.getForecast(sym);

                if (forecast > CONFIG.BUY_THRESHOLD && shares === 0) {
                    // Buy stock
                    const maxShares = ns.stock.getMaxShares(sym);
                    const investAmount = Math.min(
                        (money - CONFIG.MIN_CASH_RESERVE) * CONFIG.POSITION_PERCENT,
                        money - CONFIG.MIN_CASH_RESERVE
                    );

                    if (investAmount > 0) {
                        const sharesToBuy = Math.min(
                            Math.floor(investAmount / ns.stock.getAskPrice(sym)),
                            maxShares
                        );

                        if (sharesToBuy > 0) {
                            const cost = ns.stock.buyStock(sym, sharesToBuy);
                            if (cost > 0) {
                                ns.print(`BUY: ${sym} x${sharesToBuy} @ $${ns.formatNumber(cost/sharesToBuy, 2)}`);
                                totalTrades++;
                            }
                        }
                    }
                } else if (forecast < CONFIG.SELL_THRESHOLD && shares > 0) {
                    // Sell stock
                    const profit = ns.stock.sellStock(sym, shares);
                    if (profit > 0) {
                        const netProfit = profit - (shares * avgPrice);
                        totalProfit += netProfit;
                        ns.print(`SELL: ${sym} x${shares} profit: $${ns.formatNumber(netProfit, 2)}`);
                        totalTrades++;
                    }
                }
            } else {
                // Simple price momentum strategy without forecast
                const currentPrice = ns.stock.getAskPrice(sym);

                if (shares > 0) {
                    // Sell if price dropped 5% from average
                    if (currentPrice < avgPrice * 0.95) {
                        const profit = ns.stock.sellStock(sym, shares);
                        if (profit > 0) {
                            const netProfit = profit - (shares * avgPrice);
                            totalProfit += netProfit;
                            ns.print(`SELL: ${sym} x${shares} profit: $${ns.formatNumber(netProfit, 2)}`);
                            totalTrades++;
                        }
                    }
                } else {
                    // Simple buy strategy - buy random stocks
                    if (Math.random() > 0.95) { // 5% chance each tick
                        const investAmount = Math.min(
                            (money - CONFIG.MIN_CASH_RESERVE) * CONFIG.POSITION_PERCENT,
                            money - CONFIG.MIN_CASH_RESERVE
                        );

                        if (investAmount > 0) {
                            const sharesToBuy = Math.floor(investAmount / currentPrice);
                            if (sharesToBuy > 0) {
                                const cost = ns.stock.buyStock(sym, sharesToBuy);
                                if (cost > 0) {
                                    ns.print(`BUY: ${sym} x${sharesToBuy} @ $${ns.formatNumber(cost/sharesToBuy, 2)}`);
                                    totalTrades++;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Write status to port
        const statusData = {
            active: true,
            has4SData: has4SData,
            portfolioValue: portfolioValue,
            positions: positions,
            totalProfit: totalProfit,
            totalTrades: totalTrades,
            lastUpdate: Date.now()
        };
        writePort(ns, PORTS.STOCK_MARKET, JSON.stringify(statusData));

        await ns.sleep(CONFIG.TICK_INTERVAL);
    }
}
