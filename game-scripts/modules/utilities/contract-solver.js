/**
 * Coding Contract Solver
 * Automatically solves coding contracts found on network servers
 *
 * DESIGN: Periodic manager - continuously scans for new contracts
 * - Scans entire network for .cct files every interval
 * - Solves supported contract types automatically
 * - Tracks lifetime stats
 * - Reports status to port
 *
 * RAM Cost: ~2-3GB
 *
 * USAGE:
 *   run modules/utilities/contract-solver.js
 */

import { scanAllServers, getAllAccessibleServers } from '/lib/server-utils.js';
import { disableCommonLogs } from '/lib/misc-utils.js';
import { writePort } from '/lib/port-utils.js';
import { PORTS } from '/config/ports.js';

export async function main(ns) {
    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    disableCommonLogs(ns);

    const CONFIG = {
        SCAN_INTERVAL: 60000, // Check every 60 seconds
    };

    let lifetimeSolved = 0;
    let lifetimeFailed = 0;
    let lifetimeSkipped = 0;
    const seenContracts = new Set(); // Track contracts we've already attempted

    ns.tprint("Contract solver started");

    // ============================================================================
    // MAIN LOOP
    // ============================================================================

    while (true) {
        let scanSolved = 0;
        let scanFailed = 0;
        let scanSkipped = 0;

        // Get all accessible servers
        const allServers = scanAllServers(ns);
        const servers = getAllAccessibleServers(ns, allServers);

        ns.print(`Scanning ${servers.length} servers for contracts...`);

        for (const server of servers) {
            const contracts = ns.ls(server, ".cct");

            for (const contract of contracts) {
                // Create unique ID for this contract
                const contractId = `${server}:${contract}`;

                // Skip if we've already attempted this contract
                if (seenContracts.has(contractId)) {
                    continue;
                }

                seenContracts.add(contractId);

                try {
                    const result = await solveContract(server, contract);
                    if (result.success) {
                        scanSolved++;
                        lifetimeSolved++;
                        ns.tprint(`✓ Solved: ${contract} on ${server} - ${result.reward}`);
                    } else if (result.skipped) {
                        scanSkipped++;
                        lifetimeSkipped++;
                        ns.print(`⊘ Skipped: ${contract} on ${server} - ${result.error}`);
                    } else {
                        scanFailed++;
                        lifetimeFailed++;
                        ns.print(`✗ Failed: ${contract} on ${server} - ${result.error}`);
                    }
                } catch (error) {
                    scanFailed++;
                    lifetimeFailed++;
                    ns.print(`✗ Error solving ${contract} on ${server}: ${error.message}`);
                }
            }
        }

        // Log scan results if we found any contracts
        if (scanSolved + scanFailed + scanSkipped > 0) {
            ns.print(`Scan complete: ${scanSolved} solved, ${scanFailed} failed, ${scanSkipped} skipped`);
        }

        // Write status to port
        const statusData = {
            solved: lifetimeSolved,
            failed: lifetimeFailed,
            skipped: lifetimeSkipped,
            scanSolved: scanSolved,
            scanFailed: scanFailed,
            scanSkipped: scanSkipped,
            lastScan: Date.now()
        };
        writePort(ns, PORTS.CONTRACTS, JSON.stringify(statusData));

        await ns.sleep(CONFIG.SCAN_INTERVAL);
    }

    // ============================================================================
    // SOLVER LOGIC
    // ============================================================================

    async function solveContract(server, filename) {
        const contractType = ns.codingcontract.getContractType(filename, server);
        const data = ns.codingcontract.getData(filename, server);

        let solution;

        switch (contractType) {
            case "Find Largest Prime Factor":
                solution = solveLargestPrimeFactor(data);
                break;

            case "Subarray with Maximum Sum":
                solution = solveMaxSubarraySum(data);
                break;

            case "Total Ways to Sum":
                solution = solveTotalWaysToSum(data);
                break;

            case "Spiralize Matrix":
                solution = solveSpiralizeMatrix(data);
                break;

            case "Array Jumping Game":
                solution = solveArrayJumpingGame(data);
                break;

            case "Array Jumping Game II":
                solution = solveArrayJumpingGame2(data);
                break;

            case "Merge Overlapping Intervals":
                solution = solveMergeIntervals(data);
                break;

            case "Generate IP Addresses":
                solution = solveGenerateIPs(data);
                break;

            case "Algorithmic Stock Trader I":
                solution = solveStockTrader1(data);
                break;

            case "Algorithmic Stock Trader II":
                solution = solveStockTrader2(data);
                break;

            case "Minimum Path Sum in a Triangle":
                solution = solveMinPathSumTriangle(data);
                break;

            case "Unique Paths in a Grid I":
                solution = solveUniquePathsGrid1(data);
                break;

            case "Unique Paths in a Grid II":
                solution = solveUniquePathsGrid2(data);
                break;

            case "Shortest Path in a Grid":
                solution = solveShortestPathGrid(data);
                break;

            default:
                return { success: false, skipped: true, error: `Unsupported: ${contractType}` };
        }

        if (solution === null || solution === undefined) {
            return { success: false, error: "No solution found" };
        }

        const reward = ns.codingcontract.attempt(solution, filename, server);

        if (reward) {
            return { success: true, reward: reward };
        } else {
            return { success: false, error: "Solution rejected" };
        }
    }

    // Contract solving algorithms
    function solveLargestPrimeFactor(n) {
        let largest = 1;

        // Handle 2 separately
        while (n % 2 === 0) {
            largest = 2;
            n = n / 2;
        }

        // Check odd factors from 3 onwards
        for (let i = 3; i * i <= n; i += 2) {
            while (n % i === 0) {
                largest = i;
                n = n / i;
            }
        }

        // If n is still > 2, then it's prime
        if (n > 2) largest = n;

        return largest;
    }

    function solveMaxSubarraySum(arr) {
        let maxSum = arr[0];
        let currentSum = arr[0];

        for (let i = 1; i < arr.length; i++) {
            currentSum = Math.max(arr[i], currentSum + arr[i]);
            maxSum = Math.max(maxSum, currentSum);
        }

        return maxSum;
    }

    function solveTotalWaysToSum(n) {
        const dp = new Array(n + 1).fill(0);
        dp[0] = 1;

        for (let i = 1; i < n; i++) {
            for (let j = i; j <= n; j++) {
                dp[j] += dp[j - i];
            }
        }

        return dp[n];
    }

    function solveSpiralizeMatrix(matrix) {
        const result = [];
        let top = 0, bottom = matrix.length - 1;
        let left = 0, right = matrix[0].length - 1;

        while (top <= bottom && left <= right) {
            // Top row
            for (let i = left; i <= right; i++) {
                result.push(matrix[top][i]);
            }
            top++;

            // Right column
            for (let i = top; i <= bottom; i++) {
                result.push(matrix[i][right]);
            }
            right--;

            // Bottom row
            if (top <= bottom) {
                for (let i = right; i >= left; i--) {
                    result.push(matrix[bottom][i]);
                }
                bottom--;
            }

            // Left column
            if (left <= right) {
                for (let i = bottom; i >= top; i--) {
                    result.push(matrix[i][left]);
                }
                left++;
            }
        }

        return result;
    }

    function solveArrayJumpingGame(arr) {
        let maxReach = 0;

        for (let i = 0; i < arr.length && i <= maxReach; i++) {
            maxReach = Math.max(maxReach, i + arr[i]);
            if (maxReach >= arr.length - 1) return 1;
        }

        return 0;
    }

    function solveArrayJumpingGame2(arr) {
        if (arr.length <= 1) return 0;

        let jumps = 0;
        let currentEnd = 0;
        let farthest = 0;

        for (let i = 0; i < arr.length - 1; i++) {
            farthest = Math.max(farthest, i + arr[i]);

            if (i === currentEnd) {
                jumps++;
                currentEnd = farthest;

                if (currentEnd >= arr.length - 1) break;
            }
        }

        return jumps;
    }

    function solveMergeIntervals(intervals) {
        if (!intervals.length) return [];

        intervals.sort((a, b) => a[0] - b[0]);
        const result = [intervals[0]];

        for (let i = 1; i < intervals.length; i++) {
            const current = intervals[i];
            const last = result[result.length - 1];

            if (current[0] <= last[1]) {
                last[1] = Math.max(last[1], current[1]);
            } else {
                result.push(current);
            }
        }

        return result;
    }

    function solveGenerateIPs(s) {
        const result = [];

        function isValid(segment) {
            if (segment.length > 3 || segment.length === 0) return false;
            if (segment.length > 1 && segment[0] === '0') return false;
            const num = parseInt(segment);
            return num >= 0 && num <= 255;
        }

        function backtrack(start, path) {
            if (path.length === 4) {
                if (start === s.length) {
                    result.push(path.join('.'));
                }
                return;
            }

            for (let len = 1; len <= 3 && start + len <= s.length; len++) {
                const segment = s.substring(start, start + len);
                if (isValid(segment)) {
                    path.push(segment);
                    backtrack(start + len, path);
                    path.pop();
                }
            }
        }

        backtrack(0, []);
        return result;
    }

    function solveStockTrader1(prices) {
        let minPrice = Infinity;
        let maxProfit = 0;

        for (const price of prices) {
            if (price < minPrice) {
                minPrice = price;
            } else if (price - minPrice > maxProfit) {
                maxProfit = price - minPrice;
            }
        }

        return maxProfit;
    }

    function solveStockTrader2(prices) {
        let profit = 0;

        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) {
                profit += prices[i] - prices[i - 1];
            }
        }

        return profit;
    }

    function solveMinPathSumTriangle(triangle) {
        const dp = triangle[triangle.length - 1].slice();

        for (let i = triangle.length - 2; i >= 0; i--) {
            for (let j = 0; j < triangle[i].length; j++) {
                dp[j] = triangle[i][j] + Math.min(dp[j], dp[j + 1]);
            }
        }

        return dp[0];
    }

    function solveUniquePathsGrid1([m, n]) {
        const dp = Array(m).fill().map(() => Array(n).fill(1));

        for (let i = 1; i < m; i++) {
            for (let j = 1; j < n; j++) {
                dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
            }
        }

        return dp[m - 1][n - 1];
    }

    function solveUniquePathsGrid2(grid) {
        const m = grid.length;
        const n = grid[0].length;

        if (grid[0][0] === 1 || grid[m - 1][n - 1] === 1) return 0;

        const dp = Array(m).fill().map(() => Array(n).fill(0));
        dp[0][0] = 1;

        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                if (grid[i][j] === 1) continue;

                if (i > 0) dp[i][j] += dp[i - 1][j];
                if (j > 0) dp[i][j] += dp[i][j - 1];
            }
        }

        return dp[m - 1][n - 1];
    }

    function solveShortestPathGrid(grid) {
        const m = grid.length;
        const n = grid[0].length;

        if (grid[0][0] === 1 || grid[m - 1][n - 1] === 1) return "";

        const queue = [[0, 0, ""]];
        const visited = new Set(["0,0"]);
        const directions = [
            [0, 1, "R"], [1, 0, "D"], [0, -1, "L"], [-1, 0, "U"]
        ];

        while (queue.length > 0) {
            const [x, y, path] = queue.shift();

            if (x === m - 1 && y === n - 1) return path;

            for (const [dx, dy, dir] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                const key = `${nx},${ny}`;

                if (nx >= 0 && nx < m && ny >= 0 && ny < n &&
                    grid[nx][ny] === 0 && !visited.has(key)) {
                    visited.add(key);
                    queue.push([nx, ny, path + dir]);
                }
            }
        }

        return "";
    }
}