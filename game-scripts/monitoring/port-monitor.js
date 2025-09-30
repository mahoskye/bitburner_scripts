/** @param {NS} ns */
export async function main(ns) {
    const config = {
        defaultPorts: [1, 2, 3, 4, 5],
        updateInterval: 1000,
        popupId: "bitburner-port-monitor",
        styles: {
            popup: {
                position: "absolute",
                top: "100px",
                left: "100px",
                zIndex: "9999",
                backgroundColor: "#1a1a1a",
                border: "1px solid #444",
                borderRadius: "5px",
                padding: "0",
                width: "350px",
                fontFamily: "'Lucida Console', monospace",
                color: "#00ff00",
                fontSize: "14px"
            },
            titleBar: {
                cursor: "move",
                padding: "8px 12px",
                backgroundColor: "#2a2a2a",
                borderBottom: "1px solid #444",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: "bold"
            },
            content: {
                padding: "10px",
                maxHeight: "400px",
                overflowY: "auto"
            },
            portItem: {
                marginBottom: "8px",
                padding: "6px",
                backgroundColor: "#222",
                borderRadius: "3px",
                borderLeft: "3px solid #00ff00"
            },
            button: {
                backgroundColor: "#444",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: "2px 8px",
                marginLeft: "5px",
                borderRadius: "2px",
                fontSize: "14px"
            }
        }
    };

    class PortMonitor {
        constructor(ns, portNumbers) {
            this.ns = ns;
            this.portNumbers = portNumbers;
            this.isRunning = true;
            this.isMinimized = false;
            this.popup = null;
            this.contentElement = null;
            this.minimizeButton = null;
            this.expandedWidth = 350;
            this.minimizedWidth = 200;
            this.rightEdgePosition = null; // Store the right edge position

            this.init();
        }

        init() {
            this.cleanup();
            this.createUI();
            // Start the update loop but don't await it here
            this.startMonitoring();
        }

        cleanup() {
            const existingPopup = document.getElementById(config.popupId);
            if (existingPopup) {
                existingPopup.remove();
            }
        }

        createUI() {
            this.popup = this.createElement("div", config.popupId, config.styles.popup);

            const titleBar = this.createTitleBar();
            this.contentElement = this.createElement("div", null, config.styles.content);

            this.popup.appendChild(titleBar);
            this.popup.appendChild(this.contentElement);

            this.makeDraggable();
            this.appendToDOM();
        }

        createElement(tag, id = null, styles = {}) {
            const element = document.createElement(tag);
            if (id) element.id = id;
            Object.assign(element.style, styles);
            return element;
        }

        createTitleBar() {
            const titleBar = this.createElement("div", null, config.styles.titleBar);

            const title = document.createElement("span");
            title.textContent = "Port Monitor";

            const buttonContainer = document.createElement("div");

            this.minimizeButton = this.createButton("-", () => this.toggleMinimize());
            const closeButton = this.createButton("✕", () => this.close());
            closeButton.style.backgroundColor = "#ff4444";

            buttonContainer.appendChild(this.minimizeButton);
            buttonContainer.appendChild(closeButton);

            titleBar.appendChild(title);
            titleBar.appendChild(buttonContainer);

            return titleBar;
        }

        createButton(text, onClick) {
            const button = this.createElement("button", null, config.styles.button);
            button.textContent = text;
            button.onclick = onClick;
            return button;
        }

        toggleMinimize() {
            this.isMinimized = !this.isMinimized;
            this.contentElement.style.display = this.isMinimized ? "none" : "block";

            // Get border width (we have 1px border on left and right)
            const borderWidth = 2; // 1px left + 1px right

            // Always capture the current right edge position before making changes
            // Subtract border width to get the content edge
            this.rightEdgePosition = this.popup.offsetLeft + this.popup.offsetWidth - borderWidth;

            // Expand/contract to the left using current right edge position
            if (this.isMinimized) {
                // Minimizing: reduce width, keep right edge fixed
                this.popup.style.width = this.minimizedWidth + "px";
                this.popup.style.left = (this.rightEdgePosition - this.minimizedWidth) + "px";
            } else {
                // Expanding: increase width, keep right edge fixed
                this.popup.style.width = this.expandedWidth + "px";
                this.popup.style.left = (this.rightEdgePosition - this.expandedWidth) + "px";
            }

            this.minimizeButton.textContent = this.isMinimized ? "+" : "-";
        }

        close() {
            try {
                this.ns.tprint("Port Monitor: User clicked close button");
            } catch (e) {
                // Script may already be killed, ignore
            }

            this.isRunning = false;

            if (this.popup) {
                this.popup.remove();
                try {
                    this.ns.tprint("Port Monitor: UI removed from DOM");
                } catch (e) {
                    // Script may already be killed, ignore
                }
            }

            try {
                this.ns.tprint("Port Monitor: Script termination initiated");
            } catch (e) {
                // Script may already be killed, ignore
            }
        }

        makeDraggable() {
            let isDragging = false;
            let dragOffset = { x: 0, y: 0 };

            const titleBar = this.popup.firstChild;

            titleBar.onmousedown = (e) => {
                if (e.target.tagName === "BUTTON") return;
                isDragging = true;
                dragOffset.x = e.clientX - this.popup.offsetLeft;
                dragOffset.y = e.clientY - this.popup.offsetTop;
            };

            document.onmousemove = (e) => {
                if (isDragging) {
                    this.popup.style.left = e.clientX - dragOffset.x + "px";
                    this.popup.style.top = e.clientY - dragOffset.y + "px";
                }
            };

            document.onmouseup = () => {
                isDragging = false;
            };
        }

        appendToDOM() {
            const rootElement = document.getElementById("root");
            if (rootElement) {
                rootElement.appendChild(this.popup);
                // Store the initial right edge position after appending to DOM
                setTimeout(() => {
                    this.rightEdgePosition = this.popup.offsetLeft + this.popup.offsetWidth;
                }, 0);
            } else {
                this.ns.tprint("ERROR: Could not find #root element");
                this.isRunning = false;
            }
        }

        formatPortData(portNumber, portValue) {
            if (portValue === "NULL PORT DATA") {
                return `<div style="color: #666;">Port ${portNumber}: No Data</div>`;
            }

            // Special formatting for status port (port 2)
            if (portNumber === 2) {
                try {
                    const statusData = JSON.parse(portValue);

                    // Calculate current time remaining based on when the data was last updated
                    const currentTime = Date.now();
                    const timeSinceUpdate = Math.floor((currentTime - statusData.lastUpdate) / 1000);
                    const adjustedTimeRemaining = Math.max(0, statusData.nextDiscovery - timeSinceUpdate);

                    const minutes = Math.floor(adjustedTimeRemaining / 60);
                    const seconds = adjustedTimeRemaining % 60;

                    // Debug: Check sync occasionally
                    if (Math.random() < 0.1) { // 10% chance to log
                        try {
                            this.ns.print(`SYNC DEBUG: Original=${statusData.nextDiscovery}s, TimeSince=${timeSinceUpdate}s, Adjusted=${adjustedTimeRemaining}s`);
                        } catch (e) {}
                    }

                    // Get income rates
                    const hacknetIncome = this.ns.hacknet.numNodes() > 0 ?
                        Array.from({length: this.ns.hacknet.numNodes()}, (_, i) =>
                            this.ns.hacknet.getNodeStats(i).production
                        ).reduce((a, b) => a + b, 0) : 0;

                    const scriptIncome = this.getScriptIncome();
                    const totalIncome = hacknetIncome + scriptIncome;

                    return `
                        <div style="color: #00ddff; font-weight: bold;">System Status</div>
                        <div style="margin-left: 10px; line-height: 1.4;">
                            <div>Next Discovery: <span style="color: #ffff00;">${minutes}m ${seconds}s</span></div>
                            <div>Interval: ${statusData.discoveryInterval}s</div>
                            <div>Hack Level: <span style="color: #ff6600;">${statusData.hackLevel}</span></div>
                            <div style="color: #00ddff; font-size: 12px; margin: 5px 0 3px 0;">Income/sec:</div>
                            <div style="margin-left: 15px; font-size: 11px;">
                                Scripts: <span style="color: #88ff88;">$${this.ns.formatNumber(scriptIncome, 3)}/s</span>
                            </div>
                            <div style="margin-left: 15px; font-size: 11px;">
                                Hacknet: <span style="color: #88ff88;">$${this.ns.formatNumber(hacknetIncome, 3)}/s</span>
                            </div>
                            <div style="margin-left: 15px; font-size: 11px; border-top: 1px solid #444; padding-top: 2px; margin-top: 2px;">
                                Total: <span style="color: #ffaa00; font-weight: bold;">$${this.ns.formatNumber(totalIncome, 3)}/s</span>
                            </div>
                        </div>
                    `;
                } catch (e) {
                    return `<div>Port ${portNumber}: <span style="color: #ff6666;">[Invalid JSON: ${e.message}]</span></div>`;
                }
            }

            // Special formatting for augmentation port (port 3)
            if (portNumber === 3) {
                try {
                    const augData = JSON.parse(portValue);

                    let factionList = "";
                    if (augData.topFactions && augData.topFactions.length > 0) {
                        factionList = augData.topFactions.slice(0, 3).map((faction, i) =>
                            `<div style="margin-left: 15px; font-size: 11px;">
                                ${i + 1}. <span style="color: #ffaa00;">${faction.name}</span>
                                <span style="color: #888;">(${Math.round(faction.score)})</span>
                            </div>`
                        ).join("");
                    }

                    let nextAugList = "";
                    if (augData.nextAugmentations && augData.nextAugmentations.length > 0) {
                        nextAugList = augData.nextAugmentations.slice(0, 2).map((aug, i) =>
                            `<div style="margin-left: 15px; font-size: 11px;">
                                ${i + 1}. <span style="color: #00ff88;">${aug.name}</span>
                                <div style="margin-left: 15px; color: #888; font-size: 10px;">
                                    $${(aug.price / 1000000).toFixed(1)}M, ${(aug.repReq / 1000).toFixed(1)}k rep
                                </div>
                            </div>`
                        ).join("");
                    }

                    return `
                        <div style="color: #ff88ff; font-weight: bold;">Augmentation Plan</div>
                        <div style="margin-left: 10px; line-height: 1.3;">
                            <div style="color: #00ddff; font-size: 12px; margin-bottom: 3px;">Priority Factions:</div>
                            ${factionList || '<div style="margin-left: 15px; color: #888; font-size: 11px;">Planning...</div>'}
                            <div style="color: #00ddff; font-size: 12px; margin: 5px 0 3px 0;">Next Targets:</div>
                            ${nextAugList || '<div style="margin-left: 15px; color: #888; font-size: 11px;">Analyzing...</div>'}
                        </div>
                    `;
                } catch (e) {
                    return `<div>Port ${portNumber}: <span style="color: #ff6666;">[Invalid JSON: ${e.message}]</span></div>`;
                }
            }

            // Special formatting for stat grinder port (port 4)
            if (portNumber === 4) {
                try {
                    const statData = JSON.parse(portValue);

                    if (statData.guidanceMode) {
                        const rec = statData.recommendation;
                        if (!rec) {
                            return `
                                <div style="color: #ffaa44; font-weight: bold;">Stat Guidance</div>
                                <div style="margin-left: 10px; color: #88ff88; font-size: 11px;">
                                    All faction targets met!
                                </div>
                            `;
                        }

                        return `
                            <div style="color: #ffaa44; font-weight: bold;">Stat Guidance</div>
                            <div style="margin-left: 10px; line-height: 1.3;">
                                <div style="color: #00ddff; font-size: 12px; margin-bottom: 3px;">Recommended:</div>
                                <div style="margin-left: 15px; font-size: 11px;">
                                    <span style="color: #00ff88;">${rec.type}</span>
                                    <span style="color: #888;"> (${rec.current}/${rec.target})</span>
                                </div>
                                <div style="margin-left: 15px; font-size: 10px; color: #aaa;">
                                    ${rec.location} - ${rec.activity}
                                </div>
                                <div style="margin-left: 15px; font-size: 10px;">
                                    Priority: <span style="color: ${rec.priority === 'HIGH' ? '#ff6666' : rec.priority === 'MEDIUM' ? '#ffaa00' : '#88ff88'};">${rec.priority}</span>
                                </div>
                            </div>
                        `;
                    }

                    if (!statData.isActive) {
                        return `
                            <div style="color: #ffaa44; font-weight: bold;">Stat Grinder</div>
                            <div style="margin-left: 10px; color: #888; font-size: 11px;">
                                Idle - waiting for player to be free
                            </div>
                        `;
                    }

                    const targetInfo = statData.currentTarget ?
                        `<div style="margin-left: 15px; font-size: 11px;">
                            <span style="color: #00ff88;">${statData.currentTarget.type}</span>
                            <span style="color: #888;"> (${statData.currentTarget.current}/${statData.currentTarget.current + statData.currentTarget.need})</span>
                         </div>` : "";

                    const milestoneInfo = statData.milestone ?
                        `<div style="margin-left: 15px; font-size: 11px;">
                            Target: <span style="color: #ffaa00;">${statData.milestone.factions.join(", ")}</span>
                         </div>` : "";

                    return `
                        <div style="color: #ffaa44; font-weight: bold;">Stat Grinder</div>
                        <div style="margin-left: 10px; line-height: 1.3;">
                            <div style="color: #00ddff; font-size: 12px; margin-bottom: 3px;">Training:</div>
                            ${targetInfo}
                            <div style="color: #00ddff; font-size: 12px; margin: 5px 0 3px 0;">Progress:</div>
                            <div style="margin-left: 15px; font-size: 11px;">
                                <span style="color: #88ff88;">${statData.progress ? statData.progress.toFixed(1) : '0.0'}/min</span>
                            </div>
                            ${milestoneInfo}
                        </div>
                    `;
                } catch (e) {
                    return `<div>Port ${portNumber}: <span style="color: #ff6666;">[Invalid JSON: ${e.message}]</span></div>`;
                }
            }

            // Special formatting for Go player port (port 5)
            if (portNumber === 5) {
                try {
                    const goData = JSON.parse(portValue);

                    if (!goData.isActive) {
                        if (goData.sessionComplete) {
                            // Show session completion summary
                            return `
                                <div style="color: #88aaff; font-weight: bold;">Go Player</div>
                                <div style="margin-left: 10px; line-height: 1.3;">
                                    <div style="color: #88ff88; font-size: 12px; margin-bottom: 3px;">Session Complete!</div>
                                    <div style="margin-left: 15px; font-size: 11px;">
                                        vs <span style="color: #ffaa00;">${goData.currentOpponent}</span>
                                    </div>
                                    <div style="margin-left: 15px; font-size: 11px;">
                                        <span style="color: #88ff88;">${goData.gamesPlayed}/${goData.maxGames}</span> games played
                                    </div>
                                    <div style="color: #00ddff; font-size: 12px; margin: 5px 0 3px 0;">Final Stats:</div>
                                    <div style="margin-left: 15px; font-size: 11px;">
                                        <span style="color: #88ff88;">${goData.finalStats.wins}W</span> -
                                        <span style="color: #ff8888;">${goData.finalStats.losses}L</span>
                                    </div>
                                    <div style="margin-left: 15px; font-size: 11px;">
                                        Win Rate: <span style="color: #ffaa00;">${goData.finalStats.winRate}%</span>
                                    </div>
                                </div>
                            `;
                        } else {
                            // Standard inactive state
                            return `
                                <div style="color: #88aaff; font-weight: bold;">Go Player</div>
                                <div style="margin-left: 10px; color: #888; font-size: 11px;">
                                    Inactive
                                </div>
                            `;
                        }
                    }

                    const winRate = goData.opponentStats.wins + goData.opponentStats.losses > 0 ?
                        (goData.opponentStats.wins / (goData.opponentStats.wins + goData.opponentStats.losses) * 100).toFixed(1) : "0.0";

                    return `
                        <div style="color: #88aaff; font-weight: bold;">Go Player</div>
                        <div style="margin-left: 10px; line-height: 1.3;">
                            <div style="color: #00ddff; font-size: 12px; margin-bottom: 3px;">Current Game:</div>
                            <div style="margin-left: 15px; font-size: 11px;">
                                vs <span style="color: #ffaa00;">${goData.currentOpponent}</span>
                            </div>
                            <div style="margin-left: 15px; font-size: 10px; color: #888;">
                                Player: ${goData.gameState.currentPlayer}
                            </div>
                            <div style="color: #00ddff; font-size: 12px; margin: 5px 0 3px 0;">Session:</div>
                            <div style="margin-left: 15px; font-size: 11px;">
                                <span style="color: #88ff88;">${goData.gamesPlayed}/${goData.maxGames}</span> games
                            </div>
                            <div style="margin-left: 15px; font-size: 10px;">
                                Win Rate: <span style="color: #ffff88;">${winRate}%</span>
                            </div>
                        </div>
                    `;
                } catch (e) {
                    return `<div>Port ${portNumber}: <span style="color: #ff6666;">[Invalid JSON: ${e.message}]</span></div>`;
                }
            }

            // Standard port formatting
            return `<div>Port ${portNumber}: <span style="color: #66ff66;">${portValue}</span></div>`;
        }

        updateDisplay() {
            if (this.isMinimized) {
                try { this.ns.print("DEBUG: Skipping update - minimized"); } catch (e) {}
                return;
            }

            if (!this.contentElement) {
                try { this.ns.print("ERROR: contentElement is null!"); } catch (e) {}
                return;
            }

            try { this.ns.print("DEBUG: Updating display..."); } catch (e) {}
            this.contentElement.innerHTML = "";

            // Add timestamp to verify updates are happening
            const timestamp = new Date().toLocaleTimeString();
            const timestampElement = this.createElement("div", null, {
                fontSize: "10px",
                color: "#888",
                textAlign: "right",
                marginBottom: "5px"
            });
            timestampElement.textContent = `Updated: ${timestamp}`;
            this.contentElement.appendChild(timestampElement);
            try { this.ns.print(`DEBUG: Added timestamp: ${timestamp}`); } catch (e) {}

            this.portNumbers.forEach(portNumber => {
                let portValue;
                try {
                    portValue = this.ns.peek(portNumber);
                } catch (e) {
                    portValue = "Script terminated";
                }
                const portItem = this.createElement("div", null, config.styles.portItem);
                const formattedData = this.formatPortData(portNumber, portValue);
                portItem.innerHTML = formattedData;
                this.contentElement.appendChild(portItem);
                try { this.ns.print(`DEBUG: Added port ${portNumber} with ${formattedData.length} chars`); } catch (e) {}
            });

            try { this.ns.print(`DEBUG: Display update complete. Content children: ${this.contentElement.children.length}`); } catch (e) {}
        }

        startMonitoring() {
            this.ns.tprint(`Port Monitor started - monitoring ports: ${this.portNumbers.join(", ")}`);
            // Just update once to show initial state
            this.updateDisplay();
        }

        getScriptIncome() {
            try {
                // Get income from script processes
                const scriptIncome = this.ns.getScriptIncome();
                return scriptIncome[0] || 0; // getScriptIncome returns [income, exp]
            } catch (error) {
                // Fallback: estimate based on current money growth
                return 0;
            }
        }
    }

    // Initialize with command line args or default ports
    const portNumbers = ns.args.length > 0 ? ns.args : config.defaultPorts;
    const monitor = new PortMonitor(ns, portNumbers);

    // Main monitoring loop - like the original
    let updateCount = 0;
    while (monitor.isRunning) {
        updateCount++;

        // Debug: Check if popup still exists in DOM
        if (!document.getElementById(config.popupId)) {
            ns.tprint("ERROR: Port monitor popup no longer exists in DOM!");
            break;
        }

        monitor.updateDisplay();

        // Debug logging every 5 updates
        if (updateCount % 5 === 0) {
            try {
                ns.print(`DEBUG Update #${updateCount}: isMinimized=${monitor.isMinimized}`);
                portNumbers.forEach(port => {
                    const value = ns.peek(port);
                    ns.print(`DEBUG: Port ${port} = ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
                });
            } catch (e) {
                // Script being killed, exit gracefully
                break;
            }
        }

        await ns.sleep(config.updateInterval);
    }

    ns.tprint("Port Monitor: Script terminated");
}