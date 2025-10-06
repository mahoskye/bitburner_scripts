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

            case "Algorithmic Stock Trader III":
                solution = solveStockTrader3(data);
                break;

            case "Algorithmic Stock Trader IV":
                solution = solveStockTrader4(data);
                break;

            case "Total Ways to Sum II":
                solution = solveTotalWaysToSum2(data);
                break;

            case "Encryption I: Caesar Cipher":
                solution = solveCaesarCipher(data);
                break;

            case "Encryption II: Vigenère Cipher":
                solution = solveVigenereCipher(data);
                break;

            case "Compression I: RLE Compression":
                solution = solveRLECompression(data);
                break;

            case "Compression II: LZ Decompression":
                solution = solveLZDecompression(data);
                break;

            case "Compression III: LZ Compression":
                solution = solveLZCompression(data);
                break;

            case "HammingCodes: Integer to Encoded Binary":
                solution = solveHammingEncode(data);
                break;

            case "HammingCodes: Encoded Binary to Integer":
                solution = solveHammingDecode(data);
                break;

            case "Sanitize Parentheses in Expression":
                solution = solveSanitizeParentheses(data);
                break;

            case "Find All Valid Math Expressions":
                solution = solveMathExpressions(data);
                break;

            case "Proper 2-Coloring of a Graph":
                solution = solveGraphColoring(data);
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

    function solveStockTrader3(prices) {
        // Stock Trader III: Max 2 transactions
        return solveStockTrader4([2, prices]);
    }

    function solveStockTrader4(data) {
        // Stock Trader IV: Max k transactions
        const k = data[0];
        const prices = data[1];
        const n = prices.length;

        if (n === 0 || k === 0) return 0;

        // DP approach
        const dp = (i, j) => {
            if (j === 0) return 0;
            if (i >= n) return 0;

            let ans = dp(i + 1, j);

            for (let m = i + 1; m < n; m++) {
                ans = Math.max(ans, prices[m] - prices[i] + dp(m + 1, j - 1));
            }

            return ans;
        };

        return dp(0, k);
    }

    function solveTotalWaysToSum2(data) {
        // Total Ways to Sum II: Count ways to sum using given numbers
        const target = data[0];
        const parts = data[1];
        const n = parts.length;
        const memo = {};

        const dp = (rem, idx) => {
            if (rem < 0) return 0;
            if (rem === 0) return 1;
            const key = `${rem},${idx}`;
            if (key in memo) return memo[key];

            let ans = 0;
            for (let i = idx; i < n; i++) {
                ans += dp(rem - parts[i], i);
            }

            memo[key] = ans;
            return ans;
        };

        return dp(target, 0);
    }

    function solveCaesarCipher(data) {
        // Caesar Cipher: Decrypt by shifting backwards
        const plaintext = data[0];
        const shift = data[1];
        let result = [];

        for (const chr of plaintext) {
            if (chr === ' ') {
                result.push(' ');
                continue;
            }
            const ord = chr.charCodeAt(0) - 'A'.charCodeAt(0);
            const shifted = (((ord - shift) % 26) + 26) % 26;
            result.push(String.fromCharCode('A'.charCodeAt(0) + shifted));
        }

        return result.join("");
    }

    function solveVigenereCipher(data) {
        // Vigenère Cipher: Encrypt using keyword
        const plaintext = data[0];
        const keyword = data[1];
        const N = plaintext.length;
        const M = keyword.length;
        let result = "";

        for (let i = 0; i < N; i++) {
            const chr1 = plaintext.charAt(i);
            const chr2 = keyword.charAt(i % M);
            const row = chr1.charCodeAt(0) - 'A'.charCodeAt(0);
            const col = chr2.charCodeAt(0) - 'A'.charCodeAt(0);
            result += String.fromCharCode((row + col) % 26 + 'A'.charCodeAt(0));
        }

        return result;
    }

    function solveRLECompression(data) {
        // RLE Compression: Run-length encoding
        const input = data;
        let result = [];
        let len = 0;
        let current = '';

        for (const chr of input) {
            if (chr !== current) {
                if (len > 0) {
                    result.push(len);
                    result.push(current);
                }
                len = 0;
                current = '';
            }

            len++;
            current = chr;

            if (len === 9) {
                result.push(len);
                result.push(current);
                len = 0;
                current = '';
            }
        }

        if (len > 0) {
            result.push(len);
            result.push(current);
        }

        return result.join("");
    }

    function solveLZDecompression(data) {
        // LZ Decompression
        let q = data.split("");
        let type = 1;
        let result = "";

        while (q.length > 0) {
            let l = parseInt(q.shift());
            if (l === 0) {
                type = (type === 1) ? 2 : 1;
                continue;
            }

            if (type === 1) {
                for (let i = 0; i < l; i++) result += q.shift();
                type = 2;
            } else {
                let offset = parseInt(q.shift());
                for (let i = 0; i < l; i++) result += result.charAt(result.length - offset);
                type = 1;
            }
        }

        return result;
    }

    function solveLZCompression(data) {
        // LZ Compression
        const input = data;
        const n = input.length;
        const memo = {};

        const compress = (idx, type, skip) => {
            if (idx >= n) return "";

            const key = `${idx},${type},${skip}`;
            if (key in memo) return memo[key];

            let ans = input + input;
            let candidate;

            if (type === 1) {
                if (!skip) {
                    candidate = "0" + compress(idx, 2, true);
                    if (candidate.length < ans.length) ans = candidate;
                }
                for (let i = 1; i <= 9; i++) {
                    if (idx + i > n) break;
                    candidate = i.toString() + input.substring(idx, idx + i) + compress(idx + i, 2, false);
                    if (candidate.length < ans.length) ans = candidate;
                }
            } else {
                if (!skip) {
                    candidate = "0" + compress(idx, 1, true);
                    if (candidate.length < ans.length) ans = candidate;
                }

                for (let i = 9; i >= 1; i--) {
                    if (idx + i > n) continue;
                    const substr = input.substring(idx, idx + i);
                    for (let j = Math.min(9, idx); j >= 1; j--) {
                        const substr1 = input.substring(idx - j, idx + i - j);
                        if (substr === substr1) {
                            candidate = i.toString() + j.toString() + compress(idx + i, 1, false);
                            if (candidate.length < ans.length) ans = candidate;
                            break;
                        }
                    }
                }
            }

            memo[key] = ans;
            return ans;
        };

        return compress(0, 1, true);
    }

    function solveHammingEncode(data) {
        // Hamming Code: Integer to Encoded Binary
        const x = data;
        let q = x.toString(2).split("");
        let out = [-1];
        let idx = 1;

        while (q.length > 0) {
            if ((idx & (idx - 1)) === 0) {
                out.push(-1);
            } else {
                out.push(q.shift());
            }
            idx++;
        }

        for (let i = out.length - 1; i >= 1; i--) {
            if ((i & (i - 1)) > 0) continue;

            let parity = 0;
            for (let j = i + 1; j < out.length; j++) {
                if ((j & i) === 0) continue;
                if (out[j] === '1') parity++;
                parity %= 2;
            }
            out[i] = parity ? '1' : '0';
        }

        let parity = 0;
        for (let i = 1; i < out.length; i++) {
            if (out[i] === '1') parity++;
            parity %= 2;
        }
        out[0] = parity ? 1 : 0;

        return out.join("");
    }

    function solveHammingDecode(data) {
        // Hamming Code: Encoded Binary to Integer
        const input = [...data];
        const n = input.length;

        const decode = (x) => {
            const len = x.length;
            let result = [];
            for (let i = len - 1; i > 0; i--) {
                if ((i & (i - 1)) === 0) continue;
                result.unshift(x[i]);
            }
            return Number.parseInt(result.join(""), 2);
        };

        const check = (x) => {
            const len = x.length;
            let checkBit = 1;
            while (checkBit < len) {
                let parity = 0;
                for (let i = 0; i < len; i++) {
                    if ((i & checkBit) === 0) continue;
                    if (x[i] === '1') parity = 1 - parity;
                }
                if (parity === 1) return false;
                checkBit *= 2;
            }
            let parity = 0;
            for (let i = 1; i < len; i++) {
                if (x[i] === '1') parity = 1 - parity;
            }
            return x[0] === (parity ? '0' : '1');
        };

        if (check(input)) return decode(input);

        let x = input;
        let wrongs = [];
        for (let i = 0; i < n; i++) wrongs.push(0);

        let checkBit = 1;
        while (checkBit < n) {
            let parity = 0;
            for (let i = 0; i < n; i++) {
                if ((i & checkBit) === 0) continue;
                if (x[i] === '1') parity = 1 - parity;
            }
            if (parity === 1) wrongs[checkBit] = 1;
            checkBit *= 2;
        }

        let wrongIdx = 0;
        for (let i = 0; i < n; i++) {
            if (wrongs[i] === 1) wrongIdx += i;
        }

        x[wrongIdx] = (x[wrongIdx] === '0') ? '1' : '0';
        return decode(x);
    }

    function solveSanitizeParentheses(data) {
        // Sanitize Parentheses in Expression
        const input = data;
        let q = new Set([input]);
        let ans = new Set();

        const isValid = (s) => {
            let ct = 0;
            for (const chr of s) {
                if (chr === '(') ct++;
                if (chr === ')') ct--;
                if (ct < 0) return false;
            }
            return ct === 0;
        };

        const getCandidates = (s) => {
            const n = s.length;
            let ret = new Set();
            for (let i = 0; i < n; i++) {
                if (s.charAt(i) === '(' || s.charAt(i) === ')') {
                    ret.add(s.substring(0, i) + s.substring(i + 1, n));
                }
            }
            return [...ret];
        };

        while (q.size > 0) {
            let next = new Set();
            for (const candidate of q) {
                if (isValid(candidate)) {
                    ans.add(candidate);
                } else {
                    getCandidates(candidate).forEach((x) => next.add(x));
                }
            }
            if (ans.size > 0) break;
            q = next;
        }

        return [...ans];
    }

    function solveMathExpressions(data) {
        // Find All Valid Math Expressions
        const digits = data[0].split('');
        const target = data[1];
        const n = digits.length;
        let ans = [];

        const bf = (idx, stack) => {
            let digit = digits[idx];
            let last = stack[stack.length - 1];
            last.push(digit);

            if (idx === n - 1) {
                let res = stack.map((x) => x.join("")).join("");
                if (eval(res) === target) {
                    ans.push(res);
                }
                return;
            }

            for (const op of ['+', '-', '*']) {
                stack.push([op]);
                bf(idx + 1, stack);
                stack.pop();
            }

            bf(idx + 1, stack);
        };

        bf(0, [[]]);
        return ans;
    }

    function solveGraphColoring(data) {
        // Proper 2-Coloring of a Graph
        const n = data[0];
        const edges = data[1];
        const graph = {};

        for (let i = 0; i < n; i++) {
            graph[i] = [];
        }
        for (const edge of edges) {
            let i = edge[0], j = edge[1];
            graph[i].push(j);
            graph[j].push(i);
        }

        let colors = [];
        for (let i = 0; i < n; i++) {
            colors.push(-1);
        }

        let q = [[0, 0]];
        while (q.length > 0) {
            let x = q.shift();
            let node = x[0], color = x[1];
            if (colors[node] !== -1) {
                if (colors[node] === color) continue;
                return [];
            }

            colors[node] = color;
            graph[node].forEach((neighbor) => {
                q.push([neighbor, 1 - color]);
            });
        }

        return colors;
    }
}