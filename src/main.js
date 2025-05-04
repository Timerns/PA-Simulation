import * as THREE from 'three';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { getRoadMap } from './data/openstreetmap.js';
import { loadBuildingsFromOSM, createBuildingDistribution, generateRandomCoordinate } from "./data/population.js";
import { transformInM } from './data/wgs84.js';
import { Graph } from './datastructures/graph.js';
import { Agent } from './agents/agents.js';
import { Flood } from './flood.js';
import { getElevation } from './data/elevation.js';
import { createMapTexture } from './data/terrain.js';

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const box = [6.58,46.506415,6.643553,46.531823];
// const box = [6.863228,46.373207,6.915413,46.402466];
// const box = [83.574371,28.245269,83.609904,28.286696];
// const box = [83.594371,28.265269,83.609904,28.286696];

const buildings = await loadBuildingsFromOSM(box);
const distribution = createBuildingDistribution(buildings, box, 500);
const roads = await getRoadMap(...box);

console.log(roads);

const graph = new Graph();

for (var road of roads) {
    for (let i = 0; i < road.geometry.length - 1; i++) {
        const node1 = graph.addNode(new THREE.Vector3(...transformInM(road.geometry[i], ...box)));
        const node2 = graph.addNode(new THREE.Vector3(...transformInM(road.geometry[i + 1], ...box)));

        const distance = node1.value.distanceTo(node2.value);
        graph.addEdge(node1, node2, distance);
        graph.addEdge(node2, node1, distance);
    }
}

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(0, 1000, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    logarithmicDepthBuffer: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 1;
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
const widthSegments = 200;
const heightSegments = 200;
const geometry = new THREE.PlaneGeometry((box[2] - box[0]) * lonScale, (box[3] - box[1]) * latScale, widthSegments, heightSegments);

// Apply texture and set up terrain
async function setupTerrain() {
    console.log("Setting up terrain with texture..."+ box);
    try {
        const mapTexture = await createMapTexture(box);
        
        const material = new THREE.MeshPhongMaterial({
            map: mapTexture,
            side: THREE.DoubleSide,

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
        
    } catch (error) {
        console.error("Error loading map texture:", error);
        
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
        
        alert("Failed to load map texture. Using solid color instead.");
    }

}

// Global variables for target selection
let targetNodes = [];
let isInitializationPhase = true;
let agentsData = null;
let flood;
// Add this variable at the top
let hoveredNodeIndex = null;
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

            positions.push(road.value.x, road.value.y, road.value.z);
            positions.push(neighbor.value.x, neighbor.value.y, neighbor.value.z);

            color.setHex(0x000000);
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);
        }
    }

    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const roadMaterial = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
    const roadGrid = new THREE.LineSegments(roadGeometry, roadMaterial);
    roadGrid.name = "roadGrid";
    scene.add(roadGrid);

    console.log(roadGeometry.attributes.position.array)

    // Create visual representations of all nodes during initialization
    if (isInitializationPhase) {
        createNodeVisualizations(components[largestComponent]);
    }
}

// Replace the nodeMeshes array with these variables at the top
let nodeInstances = null;
let nodeInstanceColors = null;
let nodeInstanceMatrix = null;
let nodeInstanceCount = 0;

// Replace createNodeVisualizations function
function createNodeVisualizations(nodes) {
    // Clear any existing node visualizations
    clearNodeVisualizations();
    
    nodeInstanceCount = nodes.length;
    const instanceCount = nodes.length;
    const dummy = new THREE.Object3D();
    
    // Create instanced mesh
    nodeInstances = new THREE.InstancedMesh(
        new THREE.SphereGeometry(3, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x94524A }),
        instanceCount
    );
    nodeInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    nodeInstances.name = "nodeVisualizations";
    nodeInstances.userData.nodes = nodes; // Store reference to all nodes
    
    // Create arrays to track node states
    nodeInstanceColors = new Float32Array(instanceCount * 3);
    nodeInstanceMatrix = new Float32Array(instanceCount * 16);
    
    // Initialize all instances
    for (let i = 0; i < instanceCount; i++) {
        const node = nodes[i];
        dummy.position.copy(node.value);
        dummy.updateMatrix();
        dummy.matrix.toArray(nodeInstanceMatrix, i * 16);
        
        // Default color (0x94524A)
        nodeInstanceColors[i * 3] = 0.58;     // R
        nodeInstanceColors[i * 3 + 1] = 0.32; // G
        nodeInstanceColors[i * 3 + 2] = 0.29; // B
    }
    
    // Apply initial positions and colors
    nodeInstances.instanceMatrix.set(nodeInstanceMatrix);
    nodeInstances.instanceMatrix.needsUpdate = true;
    
    // Add color attribute if not exists
    if (!nodeInstances.geometry.attributes.instanceColor) {
        nodeInstances.geometry.setAttribute(
            'instanceColor',
            new THREE.InstancedBufferAttribute(nodeInstanceColors, 3, false)
        );
    } else {
        nodeInstances.geometry.attributes.instanceColor.array = nodeInstanceColors;
        nodeInstances.geometry.attributes.instanceColor.needsUpdate = true;
    }
    
    scene.add(nodeInstances);
}

// Replace clearNodeVisualizations function
function clearNodeVisualizations() {
    if (nodeInstances) {
        scene.remove(nodeInstances);
        nodeInstances = null;
    }
    nodeInstanceColors = null;
    nodeInstanceMatrix = null;
    nodeInstanceCount = 0;
}

// Function to handle mouse move for hover effect
function handleMouseMove(event) {
    if (!isInitializationPhase || !nodeInstances) return;

    // Calculate mouse position
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Set up raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Reset previously hovered node
    if (hoveredNodeIndex !== null) {
        const node = nodeInstances.userData.nodes[hoveredNodeIndex];
        const isTarget = targetNodes.includes(node);
        
        if (!isTarget) {
            // Reset to default color
            const color = new THREE.Color(0x94524A);
            nodeInstanceColors[hoveredNodeIndex * 3] = color.r;
            nodeInstanceColors[hoveredNodeIndex * 3 + 1] = color.g;
            nodeInstanceColors[hoveredNodeIndex * 3 + 2] = color.b;
            
            // Update the instance color attribute
            nodeInstances.geometry.attributes.instanceColor.needsUpdate = true;
        }
    }
    hoveredNodeIndex = null;

    // Find intersections
    const intersects = raycaster.intersectObject(nodeInstances);
    if (intersects.length > 0) {
        hoveredNodeIndex = intersects[0].instanceId;
        const node = nodeInstances.userData.nodes[hoveredNodeIndex];
        
        if (!targetNodes.includes(node)) {
            // Set hover color
            const color = new THREE.Color(0x00AAFF);
            nodeInstanceColors[hoveredNodeIndex * 3] = color.r;
            nodeInstanceColors[hoveredNodeIndex * 3 + 1] = color.g;
            nodeInstanceColors[hoveredNodeIndex * 3 + 2] = color.b;
            
            // Update the instance color attribute
            nodeInstances.geometry.attributes.instanceColor.needsUpdate = true;
        }
    }
}

// Function to handle node selection
function handleNodeSelection(event) {
    if (!isInitializationPhase || hoveredNodeIndex === null || !nodeInstances) return;

    const nodes = nodeInstances.userData.nodes;
    const selectedNode = nodes[hoveredNodeIndex];
    const existingIndex = targetNodes.findIndex(n => n === selectedNode);
    
    if (existingIndex >= 0) {
        // Remove the target
        targetNodes.splice(existingIndex, 1);
        
        // Change color back to hover or default
        if (hoveredNodeIndex !== null && hoveredNodeIndex === hoveredNodeIndex) {
            // Set hover color (0x00AAFF)
            nodeInstanceColors[hoveredNodeIndex * 3] = 0;      // R
            nodeInstanceColors[hoveredNodeIndex * 3 + 1] = 0.67; // G
            nodeInstanceColors[hoveredNodeIndex * 3 + 2] = 1;   // B
        } else {
            // Set default color (0x94524A)
            nodeInstanceColors[hoveredNodeIndex * 3] = 0.58;     // R
            nodeInstanceColors[hoveredNodeIndex * 3 + 1] = 0.32; // G
            nodeInstanceColors[hoveredNodeIndex * 3 + 2] = 0.29; // B
        }
        
        nodeInstances.geometry.attributes.instanceColor.needsUpdate = true;
        
        // Remove the target marker
        const marker = scene.getObjectByName(`targetNode_${existingIndex}`);
        if (marker) scene.remove(marker);
        
        // Renumber remaining markers
        for (let i = 0; i < targetNodes.length; i++) {
            const marker = scene.getObjectByName(`targetNode_${i}`);
            if (marker) {
                marker.name = `targetNode_${i}`;
                marker.material.color.setHSL(i / targetNodes.length, 0.8, 0.5);
            }
        }
    } else {
        // Add the target
        targetNodes.push(selectedNode);
        
        // Change color to target color
        const hue = (targetNodes.length - 1) / targetNodes.length;
        nodeInstanceColors[hoveredNodeIndex * 3] = hue;        // R
        nodeInstanceColors[hoveredNodeIndex * 3 + 1] = 0.8;   // G
        nodeInstanceColors[hoveredNodeIndex * 3 + 2] = 0.5;    // B
        nodeInstances.geometry.attributes.instanceColor.needsUpdate = true;
        
        // Create a larger visual marker for the target
        const targetNodeMesh = new THREE.Mesh(
            new THREE.SphereGeometry(6, 16, 16),
            new THREE.MeshBasicMaterial({ 
                color: new THREE.Color().setHSL(hue, 0.8, 0.5),
                transparent: true,
                opacity: 0.8
            })
        );
        targetNodeMesh.position.copy(selectedNode.value);
        targetNodeMesh.name = `targetNode_${targetNodes.length - 1}`;
        scene.add(targetNodeMesh);
    }
    
    updateTargetSelectionUI();
}


// Function to update the target selection UI
function updateTargetSelectionUI() {
    const targetCountElem = document.getElementById("targetCount");
    if (targetCountElem) {
        targetCountElem.textContent = targetNodes.length;
    }
}

// Function to create the initialization UI
function createInitializationUI() {
    const initContainer = document.createElement("div");
    initContainer.style.position = "absolute";
    initContainer.style.top = "10px";
    initContainer.style.left = "10px";
    initContainer.style.background = "rgba(255, 255, 255, 0.8)";
    initContainer.style.padding = "10px";
    initContainer.style.borderRadius = "5px";
    initContainer.id = "initContainer";

    const title = document.createElement("h3");
    title.innerText = "Target Selection Phase";
    title.style.marginTop = "0";
    initContainer.appendChild(title);

    const instructions = document.createElement("p");
    instructions.innerText = "Click on road intersections to select/deselect targets";
    initContainer.appendChild(instructions);

    const targetCountDisplay = document.createElement("p");
    targetCountDisplay.innerHTML = `<b>Selected targets:</b> <span id="targetCount">0</span>`;
    initContainer.appendChild(targetCountDisplay);

    const startButton = document.createElement("button");
    startButton.innerText = "Start Simulation";
    startButton.style.marginTop = "10px";
    startButton.style.padding = "5px";
    startButton.style.width = "100%";
    startButton.onclick = function() {
        if (targetNodes.length === 0) {
            alert("Please select at least one target before starting");
            return;
        }
        
        // Remove initialization UI
        document.body.removeChild(initContainer);
        
        // End initialization phase
        isInitializationPhase = false;
        
        // Remove click event listener
        renderer.domElement.removeEventListener('click', handleNodeSelection);
        
        // Start the simulation
        startSimulation();
    };
    
    initContainer.appendChild(startButton);
    
    document.body.appendChild(initContainer);
}

// Function to start the simulation after target selection
function startSimulation() {

    clearNodeVisualizations();

    flood = new Flood(scene, box, geometry);

    // Precompute paths to targets for efficiency
    console.time("Precomputing paths");
    graph.computeShortestPath(targetNodes);
    console.timeEnd("Precomputing paths");

    const agents = [];
    const numAgents = 1000;
    for (let i = 0; i < numAgents; i++) {
        let coord = generateRandomCoordinate(distribution);
        const postion = new THREE.Vector3(...transformInM(coord, ...box));
        postion.x += (Math.random() - 0.5) * 100; // Random offset
        postion.z += (Math.random() - 0.5) * 100; // Random offset

        let agent = new Agent(postion, targetNodes, graph);
        agents.push(agent);
        scene.add(agent.mesh);
    }

    // Create UI controls
    createAgentControls(agents);
    
    agentsData = { 
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
    timeSlider.min = 1;
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
        location.reload();
    };
    
    controlsContainer.appendChild(resetButton);
}

// Animation code
let lastUpdateTime;

// Initialize everything and start animation
async function init() {
    // Setup terrain with texture first
    await setupTerrain();
    
    // Setup roads (this will now create node visualizations)
    setupRoads();
    
    // Create initialization UI
    createInitializationUI();
    
    // Add event listeners
    renderer.domElement.addEventListener('click', handleNodeSelection);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    
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

    // if (flood) {
    //     flood.update();
    // }
    
    // Skip if delta is unusually large (e.g., tab was inactive)
    if (deltaTime < 100 && !isInitializationPhase && agentsData) {
        // Update agent stats
        let activeCount = 0;
        let stuckCount = 0;
        let arrivedCount = 0;

        flood.addWaterAt(75, 100, 0.05, deltaTime, agentsData.tickMultiplier.value);
        flood.addWaterAt(155, 85, 0.05, deltaTime, agentsData.tickMultiplier.value);
        flood.update(deltaTime, agentsData.tickMultiplier.value);
        
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
                    }
                } else {
                    if (agent.reachedTarget) {
                        arrivedCount++;
                    }
                }
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

    renderer.render(scene, camera);
    controls.update();
    requestAnimationFrame(animate);
    stats.end();
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);