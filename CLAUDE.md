# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains JavaScript automation scripts for the game Bitburner, a cyberpunk-themed incremental RPG where players write scripts to automate hacking and resource management.

## Core Architecture

### Two Main Execution Modes

The system operates in two distinct modes, controlled via `main.js`:

1. **Overlord Mode** (Active Management)
   - Entry point: `game-scripts/core/overlord.js`
   - Runs continuous management systems: hacknet farming, server purchasing, hack targeting, stat grinding, Go game automation
   - Dynamically adjusts server discovery interval based on hacking level (30s early game → 10min late game)
   - Manages augmentation planning and contract solving
   - Updates best hack target via port communication

2. **Offline Mode** (Resource Maximization)
   - Entry point: `game-scripts/core/offline-worker.js`
   - Kills management scripts on home server, preserves workers on other servers
   - Spawns maximum threads of `bot-worker.js` using all available RAM
   - Optimized for passive income while AFK

### Port-Based Communication System

Scripts communicate via NetScript ports (1-20):
- **Port 1**: Current best hack target (read by all bot-workers)
- **Port 2**: Status updates (discovery timers, hack level)
- **Port 3**: Augmentation planning data

Port monitor available via `monitoring/port-monitor.js` provides real-time UI overlay.

### Directory Structure

```
game-scripts/
├── core/           # Main orchestration scripts (overlord, offline-worker)
├── managers/       # Resource managers (hacknet, servers, contracts, augmentations, Go)
├── workers/        # Distributed hacking workers (bot-worker.js)
├── discovery/      # Server discovery and backdoor management
├── monitoring/     # Port monitors and debugging tools
└── utils/          # Utilities (server renaming, Go debugging)
```

### Worker Deployment Pattern

`hack-manager.js` (game-scripts/managers/hack-manager.js:1) is the central deployment system:
1. Runs server discovery
2. Attempts root access using available hacking programs
3. Copies `bot-worker.js` to all rooted servers
4. Spawns workers with maximum threads per server
5. Workers read target from port 1 and execute weaken/grow/hack cycles

## Common Commands

Start the system:
```
run main.js              # Overlord mode (default)
run main.js go           # Overlord mode with Go automation
run main.js offline      # Offline mode
run main.js offline go   # Offline mode with Go automation
```

Individual manager scripts can be run standalone from `game-scripts/managers/`:
```
run managers/hack-manager.js           # Deploy/update workers
run managers/hacknet-farm.js           # Manage hacknet nodes
run managers/purchase-server-manager.js # Buy/upgrade servers
run monitoring/port-monitor.js         # Show port monitor UI
```

## Key Implementation Details

### Bot Worker Logic

`bot-worker.js` (game-scripts/workers/bot-worker.js:1) implements adaptive hacking:
- Weakens when security > minSecurity + 5
- Grows when money < 50% of max
- Hacks when money > 75% of max
- Continuously checks port 1 for target updates

### Server Discovery Scaling

Discovery interval scales with progression (overlord.js:29-36):
- <50 hack level: 30 seconds
- <200 hack level: 2 minutes
- <500 hack level: 5 minutes
- 500+ hack level: 10 minutes

### Target Selection Algorithm

Best target scoring (overlord.js:227-264):
```javascript
score = server.maxMoney / server.minSecurityLevel
```
Filters for: root access, non-zero money, player hack level ≥ required level

### Go Game Automation

Optional Go player available via `--go` flag:
- Automated opponent matches for faction reputation
- Debug utilities in `utils/go-*.js`
- Status visible in port monitor

## Development Notes

- All scripts use NetScript 2.0 (ES6 modules with `export async function main(ns)`)
- RAM costs are critical - scripts calculate available RAM before spawning threads
- Scripts are designed to be killed/restarted without data loss (stateless workers)
- Server info cached in `/servers/server_info.txt` (JSON format)
- Bitburner API documentation: https://github.com/bitburner-official/bitburner-src/blob/dev/markdown/bitburner.md
