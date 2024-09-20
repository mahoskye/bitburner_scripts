/** @param {NS} ns **/
export async function main(ns) {
  const portNumbers = ns.args.length > 0 ? ns.args : [1]; // Default to port 1 if no args
  const popupId = "multi-port-monitor-popup";

  // Flag to control the main loop
  let isRunning = true;

  // Find the #root element to append the popup
  const rootElement = document.getElementById("root");

  // Remove existing popup if already present
  if (document.getElementById(popupId)) {
    document.getElementById(popupId).remove();
  }

  // Create the popup structure
  const popup = document.createElement("div");
  popup.id = popupId;
  popup.style.position = "absolute";
  popup.style.top = "100px";
  popup.style.left = "100px";
  popup.style.zIndex = "9999";
  popup.style.backgroundColor = "#1a1a1a";
  popup.style.border = "1px solid #444";
  popup.style.borderRadius = "5px";
  popup.style.padding = "10px";
  popup.style.width = "300px";
  popup.style.fontFamily = "'Lucida Console', monospace";
  popup.style.color = "#00ff00";

  // Title bar
  const titleBar = document.createElement("div");
  titleBar.style.cursor = "move";
  titleBar.style.padding = "5px";
  titleBar.style.backgroundColor = "#2a2a2a";
  titleBar.style.borderBottom = "1px solid #444";
  titleBar.style.marginBottom = "10px";
  titleBar.textContent = "Multi-Port Monitor";

  // Control buttons
  const buttonContainer = document.createElement("div");
  buttonContainer.style.float = "right";

  // Minimize button
  const minimizeButton = document.createElement("button");
  minimizeButton.textContent = "-";
  minimizeButton.style.marginRight = "5px";
  minimizeButton.style.backgroundColor = "#444";
  minimizeButton.style.border = "none";
  minimizeButton.style.color = "white";
  minimizeButton.style.cursor = "pointer";
  minimizeButton.onclick = () => {
    portValuesContainer.style.display =
      portValuesContainer.style.display === "none" ? "block" : "none";
    minimizeButton.textContent =
      portValuesContainer.style.display === "none" ? "+" : "-";
  };

  // Close button
  const closeButton = document.createElement("button");
  closeButton.textContent = "X";
  closeButton.style.backgroundColor = "#ff4444";
  closeButton.style.border = "none";
  closeButton.style.color = "white";
  closeButton.style.cursor = "pointer";
  closeButton.onclick = () => {
    popup.remove();
    isRunning = false; // Set the flag to false to stop the main loop
  };

  buttonContainer.appendChild(minimizeButton);
  buttonContainer.appendChild(closeButton);
  titleBar.appendChild(buttonContainer);
  popup.appendChild(titleBar);

  // Port values container
  const portValuesContainer = document.createElement("div");
  portValuesContainer.id = "port-values-container";
  popup.appendChild(portValuesContainer);

  // Create elements for each port
  portNumbers.forEach((portNumber) => {
    const portElement = document.createElement("div");
    portElement.id = `port-${portNumber}-value`;
    portValuesContainer.appendChild(portElement);
  });

  // Append popup to #root
  if (rootElement) {
    rootElement.appendChild(popup);
  } else {
    ns.tprint("Could not find #root element.");
    return;
  }

  // Make the popup draggable
  let isDragging = false;
  let dragOffsetX, dragOffsetY;

  titleBar.onmousedown = (e) => {
    isDragging = true;
    dragOffsetX = e.clientX - popup.offsetLeft;
    dragOffsetY = e.clientY - popup.offsetTop;
  };

  document.onmousemove = (e) => {
    if (isDragging) {
      popup.style.left = e.clientX - dragOffsetX + "px";
      popup.style.top = e.clientY - dragOffsetY + "px";
    }
  };

  document.onmouseup = () => {
    isDragging = false;
  };

  // Continuously update the port values
  while (isRunning) {
    portNumbers.forEach((portNumber) => {
      const portValue = ns.peek(portNumber);
      const portElement = document.getElementById(`port-${portNumber}-value`);
      if (portElement) {
        portElement.textContent = `Port ${portNumber}: ${
          portValue !== "NULL PORT DATA" ? portValue : "No Data"
        }`;
      }
    });
    await ns.sleep(1000); // Update every second
  }

  // Clean up when the script is stopping
  ns.tprint("Port monitor script terminated.");
}
