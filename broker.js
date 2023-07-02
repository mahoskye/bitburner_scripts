/** @param {NS} ns */

// @TODO: Need to review this code since I didn't write it
// @TODO: Need to add a check to ensure we have api access
// will need to test this on a new game, but we may be able to use the stock api
// or at least some parts of it to check if we can actually buy/sell stocks
// read up on it https://github.com/danielyxie/bitburner/blob/dev/markdown/bitburner.tix.md
const SLEEP_TIMER = 1 * 60 * 1000;

export async function main(ns) {
    ns.disableLog("sleep");
    ns.disableLog("stock.buyStock");
    ns.disableLog("stock.sellStock");
    while (true) {
        tendStocks(ns);
        await ns.sleep(SLEEP_TIMER);
    }
}

function tendStocks(ns) {
    const allStocks = getAllStocks(ns);

    // select stocks with <51% chance to increase price
    const stocksToSell = getBearStocks(allStocks, 0.51);
    // sell all those stocks
    sellStocks(ns, stocksToSell);

    // select stocks with >55% chance to increase price
    const stocksToBuy = getBullStocks(allStocks, 0.55);
    // buy the highest-rated stocks available
    buyStocks(ns, stocksToBuy);

    // keep a log of net worth change over time
    const portfolioValue = getPortfolioValue(allStocks);
    const cashValue = ns.getPlayer().money;
    const totalValue = portfolioValue + cashValue;

    updateOverview(ns, totalValue);

    ns.print(`Net worth: \$${ns.formatNumber(totalValue, 3)} = \$${ns.formatNumber(portfolioValue, 1)} stocks + \$${ns.formatNumber(cashValue, 1)} cash`);
}

function getAllStocks(ns) {
    // make a lookup table of all stocks and all their properties
    const stockSymbols = ns.stock.getSymbols();
    const stocks = {};
    for (const symbol of stockSymbols) {

        const pos = ns.stock.getPosition(symbol);
        const stock = {
            symbol: symbol,
            forecast: ns.stock.getForecast(symbol),
            volatility: ns.stock.getVolatility(symbol),
            askPrice: ns.stock.getAskPrice(symbol),
            bidPrice: ns.stock.getBidPrice(symbol),
            maxShares: ns.stock.getMaxShares(symbol),
            shares: pos[0],
            sharesAvgPrice: pos[1],
            sharesShort: pos[2],
            sharesAvgPriceShort: pos[3]
        };
        stock.summary = `${stock.symbol}: ${stock.forecast.toFixed(3)} ± ${stock.volatility.toFixed(3)}`;
        stocks[symbol] = stock;
    }
    return stocks;
}

function getPortfolioValue(stocks) {
    let value = 0;
    for (const stock of Object.values(stocks)) {
        value += stock.bidPrice * stock.shares - stock.askPrice * stock.sharesShort;
    }
    return value;
}

function getBullStocks(stocks, threshold = 0.55) {
    // select stocks with at least threshold % chance to increase each cycle
    const bullStocks = [];
    for (const stock of Object.values(stocks)) {
        if (stock.forecast - stock.volatility > threshold) {
            bullStocks.push(stock);
        }
    }
    return bullStocks;
}

function getBearStocks(stocks, threshold = 0.48) {
    // select stocks with at most threshold % chance to increase each cycle
    const bearStocks = [];
    for (const stock of Object.values(stocks)) {
        if (stock.forecast - stock.volatility < threshold) {
            bearStocks.push(stock);
        }
    }
    return bearStocks;
}

function sellStocks(ns, stocksToSell) {
    for (const stock of stocksToSell) {
        if (stock.shares > 0) {
            const salePrice = ns.stock.sellStock(stock.symbol, stock.shares);
            if (salePrice != 0) {
                const saleTotal = salePrice * stock.shares;
                const saleCost = stock.sharesAvgPrice * stock.shares;
                const saleProfit = saleTotal - saleCost;
                stock.shares = 0;
                ns.print(`Sold ${stock.summary} stock for \$${ns.formatNumber(saleProfit, 1)} profit`);
            }
        }
    }
}

function buyStocks(ns, stocksToBuy, maxTransactions = 4) {
    // buy stocks, spending more money on higher rated stocks
    const bestStocks = stocksToBuy.sort((a, b) => {
        return b.forecast - a.forecast; // descending
    });

    let transactions = 0;
    for (const stock of bestStocks) {
        const moneyRemaining = ns.getPlayer().money;
        // don't spend the last 5 million bux
        if (moneyRemaining < 5000000 || transactions >= maxTransactions) {
            return;
        }
        // spend up to half the money available on the highest rated stock
        // (the following stock will buy half as much)
        const moneyThisStock = moneyRemaining / 2 - 100000;
        let numShares = moneyThisStock / stock.askPrice;

        numShares = Math.min(numShares, stock.maxShares - stock.shares - stock.sharesShort);
        const boughtPrice = ns.stock.buyStock(stock.symbol, numShares);
        if (boughtPrice != 0) {
            const boughtTotal = boughtPrice * numShares;
            transactions += 1;
            stock.shares += numShares;
            ns.print(`Bought \$${ns.formatNumber(boughtTotal, 1)} of ${stock.summary}`);
        }
    }
}

function updateOverview(ns, totalValue) {
    const doc = document;

    const hook0 = doc.getElementById('overview-extra-hook-0');
    const hook1 = doc.getElementById('overview-extra-hook-1');
    const hook2 = doc.getElementById('overview-extra-hook-2');

    const prevValue = doc.getElementById('tradeBot');
    let fTotalValue = `\$${ns.formatNumber(totalValue, 3)}`.substring(1, 5);

    const clDown = "jss15";
    const clUp = "jss17";
    const clNeutral = "jss18";
    let cl = clNeutral;
    let indicator = "=";
    const progressDown = "css-1wcuaas"; // Need to find a replacement for this
    const progressUp = "css-1wcuaas";
    const progressNeutral = "css-15sn5zg";
    let progressBarColor = progressNeutral;

    if (prevValue != null) {
        let prev = parseFloat(prevValue.innerText.substring(4, prevValue.innerText.length - 1));
        cl = fTotalValue > prev ? clUp : fTotalValue < prev ? clDown : clNeutral;
        indicator = fTotalValue > prev ? "↑" : fTotalValue < prev ? "↓" : "=";
        progressBarColor = fTotalValue > prev ? progressUp : fTotalValue < prev ? progressDown : progressNeutral;
    }

    if (doc.getElementById('tradeBot-progress') == null) {
        let rowParent = hook2.parentNode.parentNode;
        let progressBar = doc.createElement('tr');
        progressBar.id = 'tradeBot-progress';
        progressBar.classList.add('MuiTableRow-root');
        progressBar.classList.add('css-3ozfvu');
        progressBar.innerHTML = `<th class="jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u" 
                             scope="row" colspan="2" style="padding-bottom: 2px; position: relative; top: -3px;">
                             <style>
                                @keyframes roundtime {
                                    to {
                                        transform: scaleX(0);
                                    }
                                }
                                .round-time-bar div {
                                    animation: roundtime ${SLEEP_TIMER / 1000}s linear forwards;
                                    transform-origin: left center;
                                    display: flex;
                                    background-color: #bad !important;
                                    height: 5px;
                                }
                             </style>
                             <div class="${progressBarColor} round-time-bar"><div class="MuiLinearProgress-bar1Determinate css-f14f7s"></div></div></th></tr>`;
        rowParent.parentNode.insertBefore(progressBar, rowParent.nextSibling);

        ns.print(`hook2: ${rowParent.nodeName}`);
    } else {
        let progressBar = doc.getElementById('tradeBot-progress');
        progressBar.innerHTML = `<th class="jss13 MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-hadb7u" 
                             scope="row" colspan="2" style="padding-bottom: 2px; position: relative; top: -3px;">
                             <style>
                                @keyframes roundtime {
                                    to {
                                        transform: scaleX(0);
                                    }
                                }
                                .round-time-bar div {
                                    animation: roundtime ${SLEEP_TIMER / 1000}s linear forwards;
                                    transform-origin: left center;
                                    display: flex;
                                    background-color: #bad !important;
                                    height: 5px;
                                }
                             </style>
                             <div class="${progressBarColor} round-time-bar"><div class="MuiLinearProgress-bar1Determinate css-f14f7s"></div></div></th></tr>`;
    }

    hook0.innerHTML = `<p class="${cl} MuiTypography-root MuiTypography-body1 css-czn5ar">Net Worth</p>`;
    hook1.innerHTML = `<p id="tradeBot" class="${cl} MuiTypography-root MuiTypography-body1 css-czn5ar">[<b>${indicator}</b>]\$${ns.formatNumber(totalValue, 3)}</p>`;
}