import * as THREE from 'three';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { getRoadMap, getWaterMap } from './data/openstreetmap.js';
import { transformInM } from './data/wgs84.js';
import { Graph } from './datastructures/graph.js';
import { Agent } from './agents/agents.js';
import { getElevation } from './data/elevation.js';
import { createMapTexture } from './data/terrain.js';

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const box = [6.58,46.506415,6.643553,46.531823];
// const box = [6.863228,46.373207,6.915413,46.402466];
// const box = [83.574371,28.245269,83.609904,28.286696];

const roads = await getRoadMap(...box);

const graph = new Graph();

for (var road of roads) {
    for (let i = 0; i < road.geometry.length - 1; i++) {
        const node1 = graph.addNode(new THREE.Vector3 (...transformInM(road.geometry[i], ...box)));
        const node2 = graph.addNode(new THREE.Vector3 (...transformInM(road.geometry[i + 1], ...box)));
        const distance = node1.value.distanceTo(node2.value);
        graph.addEdge(node1, node2, distance);
        graph.addEdge(node2, node1, distance);
    }
}

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(0, 2000, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 500;
controls.maxDistance = 3000;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(100, 200, 100);
scene.add(directionalLight);

// Ground Plane from the bbox and that has a wireframe that matches the heightmap
const latScale = 111132;
const lonScale = 111320 * Math.cos((box[1] + box[3]) / 2 * (Math.PI / 180));

// Add a terrain
const widthSegments = 100;
const heightSegments = 100;
const geometry = new THREE.PlaneGeometry((box[2] - box[0]) * lonScale, (box[3] - box[1]) * latScale, widthSegments, heightSegments);

// Create a loading indicator
const loadingText = document.createElement('div');
loadingText.style.position = 'absolute';
loadingText.style.top = '50%';
loadingText.style.left = '50%';
loadingText.style.transform = 'translate(-50%, -50%)';
loadingText.style.color = 'black';
loadingText.style.fontSize = '24px';
loadingText.style.fontFamily = 'Arial, sans-serif';
loadingText.textContent = 'Loading map texture...';
document.body.appendChild(loadingText);


// Apply texture and set up terrain
async function setupTerrain() {
    try {
        const mapTexture = await createMapTexture(box);
        
        // Create material with the map texture
        const material = new THREE.MeshPhongMaterial({
            map: mapTexture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });

        const verticesPerRow = widthSegments + 1;

        for (let i = 0; i < geometry.attributes.position.count; i++) {
            // Calculate the x, y indices in the grid
            const x = i % verticesPerRow;
            const y = Math.floor(i / verticesPerRow);
            
            // Convert to normalized coordinates (0 to 1)
            const normalizedX = x / widthSegments;
            const normalizedY = y / heightSegments;
            
            // Map to lat/lon
            const lon = box[0] + normalizedX * (box[2] - box[0]);
            const lat = box[3] - normalizedY * (box[3] - box[1]);
            
            // Get elevation for this lat/lon
            const elevation = getElevation(lat, lon) - 10;
            
            // Set the z-coordinate (elevation)
            geometry.attributes.position.array[i * 3 + 2] = elevation;
        }

        // Update the geometry
        geometry.attributes.position.needsUpdate = true;

        const terrain = new THREE.Mesh(geometry, material);
        terrain.rotation.x = -Math.PI / 2;
        terrain.name = "terrain"; // Add name for later reference
        scene.add(terrain);
        
        // Remove loading indicator
        document.body.removeChild(loadingText);
        
        
    } catch (error) {
        console.error("Error loading map texture:", error);
        
        // Fallback to colored terrain if texture loading fails
        const material = new THREE.MeshPhongMaterial({
            color: 0xB3C8CF,
            side: THREE.DoubleSide,
            wireframe: false
        });
        
        const verticesPerRow = widthSegments + 1;
        
        for (let i = 0; i < geometry.attributes.position.count; i++) {
            const x = i % verticesPerRow;
            const y = Math.floor(i / verticesPerRow);
            
            const normalizedX = x / widthSegments;
            const normalizedY = y / heightSegments;
            
            const lon = box[0] + normalizedX * (box[2] - box[0]);
            const lat = box[3] - normalizedY * (box[3] - box[1]);
            
            const elevation = getElevation(lat, lon) - 10;
            
            geometry.attributes.position.array[i * 3 + 2] = elevation;
        }
        
        geometry.attributes.position.needsUpdate = true;
        
        const terrain = new THREE.Mesh(geometry, material);
        terrain.rotation.x = -Math.PI / 2;
        terrain.name = "terrain";
        scene.add(terrain);
        
        // Remove loading indicator and show error
        document.body.removeChild(loadingText);
        alert("Failed to load map texture. Using solid color instead.");
    }
}

// Extract road setup code to a function
function setupRoads() {
    const components = graph.connectedComponents();
    let largestComponent = 0;
    for (let i = 0; i < components.length; i++) {
        if (components[i].length > components[largestComponent].length) {
            largestComponent = i;
        }
    }

    for (let i = 0; i < components.length; i++) {
        if (i !== largestComponent) {
            for (let node of components[i]) {
                graph.removeNode(node);
            }
        }
    }

    const drawnEdges = new Set();
    const roadGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const color = new THREE.Color();

    for (let road of components[largestComponent]) {
        for (let neighbor of road.neighbors.keys()) {
            let edgeKey = graph.getEdgeKey(road, neighbor);
            if (drawnEdges.has(edgeKey)) continue;
            drawnEdges.add(edgeKey);

            // Push positions (Each segment has two points)
            positions.push(road.value.x, road.value.y, road.value.z);
            positions.push(neighbor.value.x, neighbor.value.y, neighbor.value.z);

            // Assign a black color for the roads
            color.setHex(0x000000);
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);
        }
    }

    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const roadMaterial = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
    const roadGrid = new THREE.LineSegments(roadGeometry, roadMaterial);
    roadGrid.name = "roadGrid"; // Add name for later reference
    scene.add(roadGrid);
    
    return positions; // Return positions for raycasting
}

// Updated setupAgents function with the new agent behavior
function setupAgents() {
    // Create multiple target nodes
    const numberOfTargets = 5;
    const targetNodes = [];
    
    for (let i = 0; i < numberOfTargets; i++) {
        const targetNode = graph.getRandomNode();
        targetNodes.push(targetNode);
        
        // Draw the target nodes
        const targetNodeMesh = new THREE.Mesh(
            new THREE.SphereGeometry(6),
            new THREE.MeshBasicMaterial({ 
                color: new THREE.Color(0, 1 - (i * 0.2), 0)
            })
        );
        targetNodeMesh.position.copy(targetNode.value);
        targetNodeMesh.name = `targetNode_${i}`;
        scene.add(targetNodeMesh);
    }
    
    // Precompute paths to targets for efficiency
    console.time("Precomputing paths");
    graph.precomputePaths(targetNodes);
    console.timeEnd("Precomputing paths");
    console.log(`Precomputed paths to ${targetNodes.length} targets`);
    
    // Create agents with nearest target assignment
    const agents = [];
    const numAgents = 1000;
    
    // Clear the Agent.allAgents array for social distancing reference
    Agent.allAgents = [];
    
    console.time("Assigning agents to nearest targets");
    for (let i = 0; i < numAgents; i++) {
        let randomNode = graph.getRandomNode();
        
        // Find nearest target
        let nearestTarget = null;
        let shortestPathDistance = Infinity;
        
        for (const target of targetNodes) {
            const targetKey = graph.getNodeKey(target.value.x, target.value.y, target.value.z);
            if (graph.pathCache.has(targetKey)) {
                const { distances } = graph.pathCache.get(targetKey);
                const distance = distances.get(randomNode);
                
                if (distance < shortestPathDistance) {
                    shortestPathDistance = distance;
                    nearestTarget = target;
                }
            }
        }
        
        // Fallback to Euclidean distance if needed
        if (!nearestTarget) {
            let shortestDistance = Infinity;
            for (const target of targetNodes) {
                const euclideanDist = randomNode.value.distanceTo(target.value);
                if (euclideanDist < shortestDistance) {
                    shortestDistance = euclideanDist;
                    nearestTarget = target;
                }
            }
        }
        
        // Create agent with the nearest target
        let agent = new Agent(randomNode, nearestTarget);
        
        // Color the agent based on its target and speed
        const targetIndex = targetNodes.indexOf(nearestTarget);
        // Use red-to-yellow scale based on speed (red is faster, yellow is slower)
        const speedFactor = (agent.speed - 30) / 40; // Normalize to 0-1 range
        const greenValue = 0.5 + speedFactor * 0.5; // 0.5-1.0 range
        agent.mesh.material.color.setRGB(1, greenValue, 0);
        
        // Add agent to the global agents array for social distancing
        Agent.allAgents.push(agent);
        agents.push(agent);
        scene.add(agent.mesh);
    }
    console.timeEnd("Assigning agents to nearest targets");

    // Create UI controls
    createAgentControls(agents);
    
    return { 
        agents,
        tickMultiplier: { value: 1 },
        targetNodes,
        unstuckInterval: { value: 500 } // ms between unstuck attempts
    };
}

// Create UI controls for the simulation
function createAgentControls(agents) {
    const controlsContainer = document.createElement("div");
    controlsContainer.style.position = "absolute";
    controlsContainer.style.top = "100px";
    controlsContainer.style.left = "10px";
    controlsContainer.style.background = "rgba(255, 255, 255, 0.8)";
    controlsContainer.style.padding = "10px";
    controlsContainer.style.borderRadius = "5px";
    controlsContainer.id = "agentControlsContainer";

    // Time multiplier slider
    const timeLabel = document.createElement("label");
    timeLabel.innerText = "Simulation speed:";
    timeLabel.style.display = "block";
    timeLabel.style.marginBottom = "5px";

    const timeSlider = document.createElement("input");
    timeSlider.type = "range";
    timeSlider.min = 0;
    timeSlider.max = 50;
    timeSlider.value = 1;
    timeSlider.style.width = "150px";

    const timeValue = document.createElement("span");
    timeValue.innerText = ` ${timeSlider.value}x`;
    timeValue.style.marginLeft = "5px";

    // Stats display
    const statsContainer = document.createElement("div");
    statsContainer.style.marginTop = "15px";
    statsContainer.innerHTML = `<b>Agents:</b> <span id="activeAgents">${agents.length}</span> active / <span id="totalAgents">${agents.length}</span> total`;
    
    const stuckContainer = document.createElement("div");
    stuckContainer.innerHTML = `<b>Stuck agents:</b> <span id="stuckAgents">0</span>`;
    
    const arrivedContainer = document.createElement("div");
    arrivedContainer.innerHTML = `<b>Arrived at target:</b> <span id="arrivedAgents">0</span>`;

    // Add everything to the container
    controlsContainer.appendChild(timeLabel);
    controlsContainer.appendChild(timeSlider);
    controlsContainer.appendChild(timeValue);
    controlsContainer.appendChild(statsContainer);
    controlsContainer.appendChild(stuckContainer);
    controlsContainer.appendChild(arrivedContainer);
    
    document.body.appendChild(controlsContainer);
    
    // Setup event handler
    timeSlider.oninput = function() {
        agentsData.tickMultiplier.value = parseFloat(timeSlider.value);
        timeValue.innerText = ` ${timeSlider.value}x`;
    };
    
    // Add button to reset simulation
    const resetButton = document.createElement("button");
    resetButton.innerText = "Reset Simulation";
    resetButton.style.marginTop = "10px";
    resetButton.style.padding = "5px";
    resetButton.style.width = "100%";
    resetButton.onclick = function() {
        // Reload the page to reset simulation
        location.reload();
    };
    
    controlsContainer.appendChild(resetButton);
}

// Add this function to main.js
function addSimulationStats() {
    const statsContainer = document.createElement("div");
    statsContainer.style.position = "absolute";
    statsContainer.style.bottom = "10px";
    statsContainer.style.right = "10px";
    statsContainer.style.background = "rgba(255, 255, 255, 0.8)";
    statsContainer.style.padding = "10px";
    statsContainer.style.borderRadius = "5px";
    statsContainer.style.fontFamily = "monospace";
    statsContainer.id = "simStatsContainer";

    // Create various stat elements
    const tickTimeDisplay = document.createElement("div");
    tickTimeDisplay.id = "tickTime";
    tickTimeDisplay.textContent = "Tick time: 0.00 ms";

    const ticksPerSecondDisplay = document.createElement("div");
    ticksPerSecondDisplay.id = "ticksPerSecond";
    ticksPerSecondDisplay.textContent = "Ticks/sec: 0";

    const agentCountDisplay = document.createElement("div");
    agentCountDisplay.id = "agentCount";
    agentCountDisplay.textContent = "Agents: 0";

    // Add elements to container
    statsContainer.appendChild(tickTimeDisplay);
    statsContainer.appendChild(ticksPerSecondDisplay);
    statsContainer.appendChild(agentCountDisplay);
    document.body.appendChild(statsContainer);

    // Variables for stats calculations
    let tickTimeSum = 0;
    let tickCount = 0;
    let lastStatsUpdate = performance.now();
    
    // Return an update function that can be called each tick
    return {
        updateStats: (tickTime, agentCount) => {
            tickTimeSum += tickTime;
            tickCount++;
            
            const now = performance.now();
            if (now - lastStatsUpdate > 1000) { // Update display once per second
                const avgTickTime = tickTimeSum / tickCount;
                const ticksPerSecond = tickCount / ((now - lastStatsUpdate) / 1000);
                
                document.getElementById("tickTime").textContent = `Tick time: ${avgTickTime.toFixed(2)} ms`;
                document.getElementById("ticksPerSecond").textContent = `Ticks/sec: ${ticksPerSecond.toFixed(1)}`;
                document.getElementById("agentCount").textContent = `Agents: ${agentCount}`;
                
                // Reset counters
                tickTimeSum = 0;
                tickCount = 0;
                lastStatsUpdate = now;
            }
        }
    };
}

// Animation code
let agentsData;
let lastUpdateTime;
let accumulatedTime = 0;
const fixedTimeStep = 5;
let simulationStats;

// Initialize everything and start animation
async function init() {
    // Setup terrain with texture first
    await setupTerrain();
    
    // Setup roads
   setupRoads();
    
    // Setup agents
    agentsData = setupAgents();

    // Setup simulation stats
    simulationStats = addSimulationStats();
    
    // Initialize animation parameters
    lastUpdateTime = performance.now();
    
    // Start animation loop
    animate();
}

// In the animation loop
function animate() {
    stats.begin();

    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;
    
    // Skip if delta is unusually large (e.g., tab was inactive)
    if (deltaTime < 100) {
        // Update agent stats
        let activeCount = 0;
        let stuckCount = 0;
        let arrivedCount = 0;
        
        // Process agent updates
        if (agentsData && agentsData.agents) {
            // Process each agent
            for (const agent of agentsData.agents) {
                // Only update active agents
                if (agent.active) {
                    const arrived = agent.update(
                        graph, 
                        deltaTime, 
                        agentsData.tickMultiplier.value,
                        agentsData.agents
                    );
                    
                    if (arrived) {
                        arrivedCount++;
                    } else {
                        activeCount++;
                        if (agent.isStuck) {
                            stuckCount++;
                        }
                    }
                } else {
                    // Count arrived agents
                    if (agent.reachedTarget) {
                        arrivedCount++;
                    }
                }
            }
            
            // Periodically try to unstuck agents
            if (agentsData.lastUnstuckTime === undefined) {
                agentsData.lastUnstuckTime = currentTime;
            }
            
            if (currentTime - agentsData.lastUnstuckTime > agentsData.unstuckInterval.value) {
                // Try to unstuck stuck agents
                for (const agent of agentsData.agents) {
                    if (agent.isStuck && agent.active) {
                        agent.attemptUnstuck(graph);
                    }
                }
                agentsData.lastUnstuckTime = currentTime;
            }
        }
        
        // Update stats display
        const activeAgentsElem = document.getElementById("activeAgents");
        const stuckAgentsElem = document.getElementById("stuckAgents");
        const arrivedAgentsElem = document.getElementById("arrivedAgents");
        
        if (activeAgentsElem) activeAgentsElem.textContent = activeCount;
        if (stuckAgentsElem) stuckAgentsElem.textContent = stuckCount;
        if (arrivedAgentsElem) arrivedAgentsElem.textContent = arrivedCount;
    }

    // Request the next frame
    requestAnimationFrame(animate);
    
    // Update camera controls
    controls.update();
    
    // Render the scene
    renderer.render(scene, camera);
    
    stats.end();
}

// Add a toggle button for map texture
function addMapToggleButton() {
    const toggleBtn = document.createElement("button");
    toggleBtn.innerText = "Toggle Map";
    toggleBtn.style.position = "absolute";
    toggleBtn.style.bottom = "10px";
    toggleBtn.style.left = "10px";
    toggleBtn.style.padding = "8px";
    toggleBtn.style.borderRadius = "5px";
    toggleBtn.style.background = "rgba(255, 255, 255, 0.8)";
    toggleBtn.style.border = "1px solid #ccc";
    toggleBtn.style.cursor = "pointer";
    
    toggleBtn.onclick = function() {
        const terrain = scene.getObjectByName("terrain");
        if (terrain && terrain.material) {
            // Toggle visibility
            terrain.material.opacity = terrain.material.opacity > 0 ? 0 : 0.9;
            
            // Update the opacity slider if it exists
            const opacitySlider = document.querySelector("#mapControlsContainer input");
            if (opacitySlider) {
                opacitySlider.value = terrain.material.opacity * 100;
                const opacityValue = document.querySelector("#mapControlsContainer span");
                if (opacityValue) {
                    opacityValue.innerText = ` ${Math.round(terrain.material.opacity * 100)}%`;
                }
            }
        }
    };
    
    document.body.appendChild(toggleBtn);
}


// Start the whole process
init().then(() => {
    addMapToggleButton();
    console.log("Initialization complete");
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);