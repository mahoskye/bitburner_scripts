/**
 * Test individual contract solvers to find which one causes freeze
 */

export async function main(ns) {
    ns.tprint("=== Testing Contract Solvers ===");
    ns.tprint("");

    // Test 1: Shortest Path in a Grid
    ns.tprint("Test 1: Shortest Path in a Grid");
    const grid = [[0,0,0,0,1,0,0,1,0,0],[0,0,0,1,0,1,0,0,1,1],[1,1,0,0,1,1,0,0,1,1],[1,0,1,0,0,0,0,0,0,0],[0,0,1,0,0,1,0,0,0,0],[0,0,0,0,0,0,1,0,0,0]];
    ns.tprint(`Data: ${JSON.stringify(grid)}`);

    try {
        const result1 = solveShortestPath(grid);
        ns.tprint(`Result: ${result1}`);
        ns.tprint("✓ PASSED");
    } catch (e) {
        ns.tprint(`✗ FAILED: ${e.message}`);
    }
    ns.tprint("");
    await ns.sleep(100);

    // Test 2: Stock Trader IV
    ns.tprint("Test 2: Algorithmic Stock Trader IV");
    const stockData = [7,[30,122,173,196,181,198,140,145,43,167,110,36,16,112,110,120,82,91,120,139,6,174,168,32,82,51,111,70,149,97,186,92,35,172,39,59,77,90,55,75,113,93,98,37,146,35]];
    ns.tprint(`Data: ${JSON.stringify(stockData)}`);

    try {
        const result2 = solveStockTrader4(stockData);
        ns.tprint(`Result: ${result2}`);
        ns.tprint("✓ PASSED");
    } catch (e) {
        ns.tprint(`✗ FAILED: ${e.message}`);
    }
    ns.tprint("");
    await ns.sleep(100);

    // Test 3: Math Expressions
    ns.tprint("Test 3: Find All Valid Math Expressions");
    const mathData = ["90227", -70];
    ns.tprint(`Data: ${JSON.stringify(mathData)}`);

    try {
        const result3 = solveMathExpressions(mathData);
        ns.tprint(`Result: ${JSON.stringify(result3)}`);
        ns.tprint("✓ PASSED");
    } catch (e) {
        ns.tprint(`✗ FAILED: ${e.message}`);
    }
    ns.tprint("");
    await ns.sleep(100);

    // Test 4: Hamming Encode
    ns.tprint("Test 4: HammingCodes: Integer to Encoded Binary");
    const hammingData = 810664473463;
    ns.tprint(`Data: ${hammingData}`);

    try {
        const result4 = solveHammingEncode(hammingData);
        ns.tprint(`Result: ${result4}`);
        ns.tprint("✓ PASSED");
    } catch (e) {
        ns.tprint(`✗ FAILED: ${e.message}`);
    }
    ns.tprint("");

    ns.tprint("=== All Tests Complete ===");
}

// Copy solver functions from contract-solver.js

function solveShortestPath(grid) {
    const rows = grid.length;
    const cols = grid[0].length;

    // BFS to find shortest path
    const queue = [[0, 0, ""]];
    const visited = new Set(["0,0"]);

    const directions = [
        [0, 1, "R"],   // Right
        [1, 0, "D"],   // Down
        [0, -1, "L"],  // Left
        [-1, 0, "U"]   // Up
    ];

    while (queue.length > 0) {
        const [row, col, path] = queue.shift();

        // Check if we reached the end
        if (row === rows - 1 && col === cols - 1) {
            return path;
        }

        // Try all four directions
        for (const [dr, dc, dir] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            const key = `${newRow},${newCol}`;

            // Check if valid move
            if (newRow >= 0 && newRow < rows &&
                newCol >= 0 && newCol < cols &&
                grid[newRow][newCol] === 0 &&
                !visited.has(key)) {

                visited.add(key);
                queue.push([newRow, newCol, path + dir]);
            }
        }
    }

    return ""; // No path found
}

function solveStockTrader4(data) {
    const [k, prices] = data;
    const n = prices.length;

    if (n <= 1 || k === 0) return 0;

    // If k >= n/2, we can do as many transactions as we want
    if (k >= Math.floor(n / 2)) {
        let profit = 0;
        for (let i = 1; i < n; i++) {
            profit += Math.max(0, prices[i] - prices[i - 1]);
        }
        return profit;
    }

    // DP approach: dp[i][j] = max profit using at most i transactions up to day j
    const dp = Array(k + 1).fill(0).map(() => Array(n).fill(0));

    for (let i = 1; i <= k; i++) {
        let maxDiff = -prices[0];
        for (let j = 1; j < n; j++) {
            dp[i][j] = Math.max(dp[i][j - 1], prices[j] + maxDiff);
            maxDiff = Math.max(maxDiff, dp[i - 1][j] - prices[j]);
        }
    }

    return dp[k][n - 1];
}

function solveMathExpressions(data) {
    const [num, target] = data;
    const results = [];

    function backtrack(index, expr, value, lastNum) {
        if (index === num.length) {
            if (value === target) {
                results.push(expr);
            }
            return;
        }

        for (let i = index; i < num.length; i++) {
            if (i > index && num[index] === '0') break; // No leading zeros

            const currStr = num.substring(index, i + 1);
            const currNum = parseInt(currStr);

            if (index === 0) {
                backtrack(i + 1, currStr, currNum, currNum);
            } else {
                backtrack(i + 1, expr + '+' + currStr, value + currNum, currNum);
                backtrack(i + 1, expr + '-' + currStr, value - currNum, -currNum);
                backtrack(i + 1, expr + '*' + currStr, value - lastNum + lastNum * currNum, lastNum * currNum);
            }
        }
    }

    backtrack(0, "", 0, 0);
    return results;
}

function solveHammingEncode(value) {
    // Convert to binary
    const binary = value.toString(2);
    const m = binary.length;

    // Calculate number of parity bits needed
    let r = 0;
    while ((1 << r) < m + r + 1) {
        r++;
    }

    // Create encoded array (1-indexed for easier calculation)
    const encoded = Array(m + r + 1).fill(0);

    // Place data bits (skip positions that are powers of 2)
    let dataIdx = 0;
    for (let i = 1; i < encoded.length; i++) {
        if ((i & (i - 1)) !== 0) { // Not a power of 2
            encoded[i] = parseInt(binary[dataIdx]);
            dataIdx++;
        }
    }

    // Calculate parity bits
    for (let i = 0; i < r; i++) {
        const parityPos = 1 << i;
        let parity = 0;

        for (let j = parityPos; j < encoded.length; j++) {
            if ((j & parityPos) !== 0) {
                parity ^= encoded[j];
            }
        }

        encoded[parityPos] = parity;
    }

    // Overall parity bit at position 0
    let overallParity = 0;
    for (let i = 1; i < encoded.length; i++) {
        overallParity ^= encoded[i];
    }
    encoded[0] = overallParity;

    return encoded.join('');
}
