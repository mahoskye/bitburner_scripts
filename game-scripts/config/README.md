# Configuration Constants

Modular configuration constants for Bitburner automation scripts.

## Structure

Constants are split into focused modules for better organization and RAM efficiency:

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| **ports.js** | Port communication | `PORTS`, `PORT_NO_DATA` |
| **paths.js** | File paths and script locations | `FILES`, `SCRIPTS` |
| **timing.js** | Intervals and delays (ms) | `INTERVALS`, `DELAYS` |
| **hacking.js** | Hack/grow/weaken config | `HACK_THRESHOLDS`, `HACK_LEVELS` |
| **servers.js** | Server constants | `SERVERS`, `FACTION_SERVERS` |
| **money.js** | Money thresholds and costs | `MONEY`, `TOR_COSTS`, `PROGRAMS` |
| **hacknet.js** | Hacknet configuration | `HACKNET` |
| **stats.js** | Stat grinding targets | `STAT_GRINDER` |
| **go.js** | Go game (SF14) settings | `GO` |
| **misc.js** | Special values | `SPECIAL` |
| **constants.js** | Index re-exporting all | All of the above |

## Usage

### Import Specific Modules (Recommended)

Better RAM efficiency - only import what you need:

```javascript
import { PORTS } from '/config/ports.js';
import { HACK_THRESHOLDS } from '/config/hacking.js';

export async function main(ns) {
    const target = ns.peek(PORTS.HACK_TARGET);
    if (money > maxMoney * HACK_THRESHOLDS.HACK_PERCENT) {
        await ns.hack(target);
    }
}
```

### Import from Index (Convenience)

Use when you need multiple constants from different modules:

```javascript
import { PORTS, MONEY, HACK_LEVELS } from '/config/constants.js';

export async function main(ns) {
    // All constants available
}
```

## Benefits

- **Smaller RAM footprint**: Import only needed constants
- **Clear dependencies**: See exactly what each script uses
- **Better organization**: Find constants by domain
- **Easy maintenance**: Update values in one place
- **No circular dependencies**: Clean module boundaries

## Modifying Constants

1. Edit the appropriate module file (e.g., `hacking.js` for hack thresholds)
2. The index (`constants.js`) automatically re-exports changes
3. All scripts using the constant will pick up the new value
