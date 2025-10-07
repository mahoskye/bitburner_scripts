/**
 * Contract Scanner
 * Scans the entire network and displays all available coding contracts
 *
 * USAGE:
 *   run scan-contracts.js
 */

import { scanAllServers, getAllAccessibleServers } from '/lib/server-utils.js';

export async function main(ns) {
    ns.disableLog("ALL");

    // Get all accessible servers
    const allServers = scanAllServers(ns);
    const servers = getAllAccessibleServers(ns, allServers);

    ns.tprint("\n=== SCANNING NETWORK FOR CONTRACTS ===\n");

    let totalContracts = 0;
    const contractsByType = new Map();
    const contractDetails = [];

    for (const server of servers) {
        const contracts = ns.ls(server, ".cct");

        for (const contract of contracts) {
            totalContracts++;

            // Get contract details
            const contractType = ns.codingcontract.getContractType(contract, server);
            const data = ns.codingcontract.getData(contract, server);
            const triesRemaining = ns.codingcontract.getNumTriesRemaining(contract, server);
            const description = ns.codingcontract.getDescription(contract, server);

            // Track by type
            if (!contractsByType.has(contractType)) {
                contractsByType.set(contractType, 0);
            }
            contractsByType.set(contractType, contractsByType.get(contractType) + 1);

            // Store details
            contractDetails.push({
                server,
                filename: contract,
                type: contractType,
                data,
                triesRemaining,
                description
            });
        }
    }

    if (totalContracts === 0) {
        ns.tprint("No contracts found on the network.");
        return;
    }

    // Display summary
    ns.tprint(`Found ${totalContracts} contract(s) on ${servers.length} servers\n`);

    ns.tprint("=== CONTRACTS BY TYPE ===");
    for (const [type, count] of [...contractsByType.entries()].sort((a, b) => b[1] - a[1])) {
        ns.tprint(`  ${type}: ${count}`);
    }

    // Display detailed list
    ns.tprint("\n=== DETAILED CONTRACT LIST ===\n");
    for (let i = 0; i < contractDetails.length; i++) {
        const c = contractDetails[i];
        ns.tprint(`[${i + 1}] ${c.filename}`);
        ns.tprint(`    Server: ${c.server}`);
        ns.tprint(`    Type: ${c.type}`);
        ns.tprint(`    Tries Remaining: ${c.triesRemaining}`);
        ns.tprint(`    Data: ${JSON.stringify(c.data)}`);
        ns.tprint("");
    }
}
