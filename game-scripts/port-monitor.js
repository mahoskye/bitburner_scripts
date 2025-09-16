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
            this.isRunning = false;
            if (this.popup) {
                this.popup.remove();
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
                    const minutes = Math.floor(statusData.nextDiscovery / 60);
                    const seconds = statusData.nextDiscovery % 60;

                    return `
                        <div style="color: #00ddff; font-weight: bold;">System Status</div>
                        <div style="margin-left: 10px; line-height: 1.4;">
                            <div>Next Discovery: <span style="color: #ffff00;">${minutes}m ${seconds}s</span></div>
                            <div>Interval: ${statusData.discoveryInterval}s</div>
                            <div>Hack Level: <span style="color: #ff6600;">${statusData.hackLevel}</span></div>
                        </div>
                    `;
                } catch (e) {
                    return `<div>Port ${portNumber}: <span style="color: #ff6666;">[Invalid JSON]</span></div>`;
                }
            }

            // Standard port formatting
            return `<div>Port ${portNumber}: <span style="color: #66ff66;">${portValue}</span></div>`;
        }

        updateDisplay() {
            if (this.isMinimized) return;

            this.contentElement.innerHTML = "";

            this.portNumbers.forEach(portNumber => {
                const portValue = this.ns.peek(portNumber);
                const portItem = this.createElement("div", null, config.styles.portItem);
                portItem.innerHTML = this.formatPortData(portNumber, portValue);
                this.contentElement.appendChild(portItem);
            });
        }

        async startMonitoring() {
            this.ns.tprint(`Port Monitor started - monitoring ports: ${this.portNumbers.join(", ")}`);

            while (this.isRunning) {
                this.updateDisplay();
                await this.ns.sleep(config.updateInterval);
            }

            this.ns.tprint("Port Monitor terminated");
        }
    }

    // Initialize with command line args or default ports
    const portNumbers = ns.args.length > 0 ? ns.args : config.defaultPorts;
    new PortMonitor(ns, portNumbers);
}