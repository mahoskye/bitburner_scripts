/**
 * Check what's in all the ports
 */

import { PORTS } from '/config/ports.js';

export async function main(ns) {
    ns.tprint("=== Port Status ===");
    
    for (const [name, port] of Object.entries(PORTS)) {
        if (typeof port === 'number' && port >= 1 && port <= 20) {
            const data = ns.peek(port);
            ns.tprint(`\nPort ${port} (${name}):`);
            if (data === 'NULL PORT DATA') {
                ns.tprint("  [EMPTY]");
            } else {
                try {
                    const parsed = JSON.parse(data);
                    ns.tprint(`  ${JSON.stringify(parsed, null, 2)}`);
                } catch (e) {
                    ns.tprint(`  ${data}`);
                }
            }
        }
    }
}
