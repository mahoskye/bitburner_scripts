# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains JavaScript automation scripts for the game Bitburner, a cyberpunk-themed incremental RPG where players write scripts to automate hacking and resource management.

## Core Architecture

**Status: Under Active Refactoring**

The codebase is being refactored from a monolithic structure to a modular architecture. Old code is preserved in `game-scripts-bak/` for reference.

### Modular Architecture (New)

```
game-scripts/
├── config/         # Configuration constants (modular)
│   ├── constants.js    # Index re-exporting all configs
│   ├── ports.js        # Port communication constants
│   ├── paths.js        # File paths and script locations
│   ├── timing.js       # Intervals and delays
│   ├── hacking.js      # Hack/grow/weaken thresholds, 7-tier level system
│   ├── servers.js      # Server constants, faction servers
│   ├── money.js        # Money thresholds, TOR costs, programs
│   ├── hacknet.js      # Hacknet configuration
│   ├── stats.js        # Stat grinder targets
│   ├── go.js           # Go game (SF14) configuration
│   └── misc.js         # Special values
│
├── lib/            # Shared utilities (domain-agnostic)
│   └── (planned: formatting, math, validation modules)
│
├── modules/        # Domain-specific functionality
│   ├── hacking/        # Hacking operations
│   ├── network/        # Server discovery, deployment, backdoors
│   ├── progression/    # Augmentations, factions, stat training
│   ├── resources/      # Hacknet, programs, purchased servers
│   └── utilities/      # Contracts, formatting, ports
│
├── sf-modules/     # Source File specific features
│   ├── sf04-singularity.js
│   ├── sf14-go.js      # Go game automation
│   └── (other SF-specific modules)
│
└── core/           # Main orchestration
    ├── bootstrap.js
    ├── main.js
    └── scheduler.js
```

### Port-Based Communication System

Scripts communicate via NetScript ports (defined in `config/ports.js`):
- **Port 1**: Current best hack target (read by all bot-workers)
- **Port 2**: Status updates (discovery timers, hack level)
- **Port 3**: Augmentation planning data
- **Port 4**: Stat grinder data
- **Port 5**: Go player status

### Configuration System

All constants are modularized for better RAM efficiency and maintainability:

```javascript
// Import specific modules (recommended - better RAM efficiency)
import { PORTS } from '/game-scripts/config/ports.js';
import { HACK_THRESHOLDS } from '/game-scripts/config/hacking.js';

// Or import from index for convenience
import { PORTS, HACK_THRESHOLDS, MONEY } from '/game-scripts/config/constants.js';
```

Key constants:
- **7-tier hacking progression**: 50 → 100 → 250 → 500 → 1000 → 1500 → 3000 (w0r1d_d43m0n)
- **Discovery intervals**: Scale from 30s to 10min based on leveling speed and server density
- **Stat targets**: Realistic progression for hacking, combat, and charisma
- See `game-scripts/config/README.md` for full documentation

### Legacy Architecture (Old - in game-scripts-bak/)

Two execution modes via `main.js`:
1. **Overlord Mode** - Active management (hacknet, servers, targeting, stats)
2. **Offline Mode** - Maximum passive income (spawns max bot-workers)

Legacy structure preserved for reference during refactoring.

**IMPORTANT**: The `game-scripts-bak/go/` directory contains third-party code and should NOT be used as reference or copied into the new codebase. All Go-related functionality has been intentionally excluded.

## Development Notes

- All scripts use NetScript 2.0 (ES6 modules with `export async function main(ns)`)
- RAM costs are critical - import only what you need from modular configs
- Modular architecture prioritizes separation of concerns
- Server info cached in `/servers/server_info.txt` (JSON format)
- Bitburner API documentation: https://github.com/bitburner-official/bitburner-src/blob/dev/markdown/bitburner.md
