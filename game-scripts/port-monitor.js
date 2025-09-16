/** @param {NS} ns */
export async function main(ns) {
    const config = {
        defaultPorts: [1, 2],
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
            this.popup.style.width = this.isMinimized ? "200px" : "350px";
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

                    return `
                        <div style="color: #00ddff; font-weight: bold;">System Status</div>
                        <div style="margin-left: 10px; line-height: 1.4;">
                            <div>Next Discovery: <span style="color: #ffff00;">${minutes}m ${seconds}s</span></div>
                            <div>Interval: ${statusData.discoveryInterval}s</div>
                            <div>Hack Level: <span style="color: #ff6600;">${statusData.hackLevel}</span></div>
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