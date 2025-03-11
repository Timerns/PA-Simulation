import * as THREE from 'three';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { getRoadMap, getWaterMap } from './data/openstreetmap.js';
import { transformInM } from './data/wgs84.js';
import { Graph } from './datastructures/graph.js';
import { Agent } from './agents/agents.js';
import { getElevation } from './data/elevation.js';

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// const box = [6.58,46.506415,6.643553,46.531823];
// const box = [6.863228,46.373207,6.915413,46.402466];
const box = [83.574371,28.245269,83.609904,28.286696];

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

function latLngToTilePixel(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const xtile = (lng + 180) / 360 * n;
    const ytile = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
    
    // Get the exact tile
    const xtileFloor = Math.floor(xtile);
    const ytileFloor = Math.floor(ytile);
    
    // Get the pixel position within the tile (0-255)
    const xpixel = Math.floor((xtile - xtileFloor) * 256);
    const ypixel = Math.floor((ytile - ytileFloor) * 256);
    
    return { 
        x: xtileFloor, 
        y: ytileFloor,
        pixelX: xpixel,
        pixelY: ypixel
    };
}

// Function to create canvas with properly aligned map tiles
async function createMapTexture() {
    // Choose an appropriate zoom level
    const zoom = 15; // Adjust as needed for your area
    
    // Calculate tile coordinates for bounding box corners with pixel precision
    const nwTile = latLngToTilePixel(box[3], box[0], zoom); // Northwest corner
    const seTile = latLngToTilePixel(box[1], box[2], zoom); // Southeast corner
    
    // Calculate how many tiles we need horizontally and vertically
    const xTiles = [];
    for (let x = nwTile.x; x <= seTile.x; x++) {
        xTiles.push(x);
    }
    
    const yTiles = [];
    for (let y = nwTile.y; y <= seTile.y; y++) {
        yTiles.push(y);
    }
    
    // Calculate the total width and height in pixels
    const totalWidth = (xTiles.length * 256) - nwTile.pixelX - (256 - seTile.pixelX);
    const totalHeight = (yTiles.length * 256) - nwTile.pixelY - (256 - seTile.pixelY);
    
    // Create a canvas to hold the cropped map area
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    
    // Function to load a single tile
    function loadTile(x, y) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // Using OpenStreetMap tile server (consider using a different provider if needed)
            img.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
            img.crossOrigin = "Anonymous"; // Important for CORS
            img.onload = () => resolve(img);
            img.onerror = () => {
                // If tile fails to load, create a placeholder
                const placeholder = document.createElement('canvas');
                placeholder.width = 256;
                placeholder.height = 256;
                const pctx = placeholder.getContext('2d');
                pctx.fillStyle = '#F1EEE6'; // Light beige background
                pctx.fillRect(0, 0, 256, 256);
                pctx.strokeStyle = '#CCCCCC';
                pctx.strokeRect(0, 0, 256, 256);
                pctx.font = '10px Arial';
                pctx.fillStyle = '#999999';
                pctx.fillText(`Tile ${x},${y} failed`, 5, 20);
                resolve(placeholder);
            };
        });
    }
    
    // Load all tiles concurrently
    const loadPromises = [];
    for (let i = 0; i < yTiles.length; i++) {
        const y = yTiles[i];
        for (let j = 0; j < xTiles.length; j++) {
            const x = xTiles[j];
            
            // Calculate where to draw this tile on the canvas
            let destX = j * 256 - nwTile.pixelX;
            let destY = i * 256 - nwTile.pixelY;
            
            const tilePromise = loadTile(x, y).then(img => {
                // Draw the tile at the correct position on the canvas
                ctx.drawImage(img, destX, destY);
            });
            loadPromises.push(tilePromise);
        }
    }
    
    // Wait for all tiles to load
    await Promise.all(loadPromises);
    
    // Create a THREE.js texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    // The texture's UV mapping needs to be flipped on the y-axis for THREE.js
    texture.flipY = true;
    
    return texture;
}

// Apply texture and set up terrain
async function setupTerrain() {
    try {
        const mapTexture = await createMapTexture();
        
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
        
        // Add texture opacity control
        addMapTextureControls();
        
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

    // Raycasting setup
    setupRaycasting(roadGrid, positions);
    
    return positions; // Return positions for raycasting
}

// Extract raycasting setup code to a function
function setupRaycasting(roadGrid, positions) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredSegment = null;

    // Highlight Material
    const highlightMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });

    // Add event listener for mouse movement
    window.addEventListener('mousemove', onMouseMove, false);

    function onMouseMove(event) {
        // Convert mouse position to normalized device coordinates (-1 to +1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Perform raycasting
        const intersects = raycaster.intersectObject(roadGrid);

        if (intersects.length > 0) {
            const index = intersects[0].index; // Get the index of the intersected vertex pair
            if (hoveredSegment !== index) {
                // Reset previous segment if different
                resetHighlight();
                highlightSegment(index);
                hoveredSegment = index;
            }
        } else {
            resetHighlight();
            hoveredSegment = null;
        }
    }

    function highlightSegment(index) {
        // Each segment has two points (index and index + 1)
        const segmentVertices = [
            positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2],
            positions[index * 3 + 3], positions[index * 3 + 4], positions[index * 3 + 5]
        ];

        // Create a new line for highlighting
        const highlightGeometry = new THREE.BufferGeometry();
        highlightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segmentVertices, 3));
        
        const highlightLine = new THREE.Line(highlightGeometry, highlightMaterial);
        highlightLine.name = "highlightedLine";

        // Remove old highlight if exists
        resetHighlight();
        
        scene.add(highlightLine);
    }

    function resetHighlight() {
        const oldHighlight = scene.getObjectByName("highlightedLine");
        if (oldHighlight) scene.remove(oldHighlight);
    }
}

// Extract agent setup code to a function with nearest-target behavior and enhanced agent features
function setupAgents() {
    // Create multiple target nodes
    const numberOfTargets = 5; // Adjust as needed
    const targetNodes = [];
    
    for (let i = 0; i < numberOfTargets; i++) {
        const targetNode = graph.getRandomNode();
        targetNodes.push(targetNode);
        
        // Draw the target nodes
        const targetNodeMesh = new THREE.Mesh(
            new THREE.SphereGeometry(6),
            new THREE.MeshBasicMaterial({ 
                color: new THREE.Color(0, 1 - (i * 0.2), 0)  // Different shades of green
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
    
    // Create agents with nearest target assignment using path distances
    const agents = [];
    const numAgents = 1000;
    
    // Clear the Agent.allAgents array for social distancing reference
    Agent.allAgents = [];
    
    console.time("Assigning agents to nearest targets");
    for (let i = 0; i < numAgents; i++) {
        let randomNode = graph.getRandomNode();
        
        // Find the nearest target using actual path distances from the precomputed paths
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
        
        // If no path found, fallback to Euclidean distance
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

    // Create Slider UI
    const sliderContainer = document.createElement("div");
    sliderContainer.style.position = "absolute";
    sliderContainer.style.top = "100px";
    sliderContainer.style.left = "10px";
    sliderContainer.style.background = "rgba(255, 255, 255, 0.8)";
    sliderContainer.style.padding = "10px";
    sliderContainer.style.borderRadius = "5px";
    sliderContainer.id = "sliderContainer";

    const sliderLabel = document.createElement("label");
    sliderLabel.innerText = "Time multiplier:";
    sliderLabel.style.display = "block";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = 0;
    slider.max = 50;
    slider.value = 1;
    slider.style.width = "100px";

    const sliderValue = document.createElement("span");
    sliderValue.innerText = ` ${slider.value}`;

    const tickMultiplier = { value: parseInt(slider.value) };
    
    slider.oninput = function () {
        tickMultiplier.value = parseInt(slider.value);
        sliderValue.innerText = ` ${slider.value}`;
    };

    // Add path cache stats
    const cacheStats = document.createElement("div");
    cacheStats.style.marginTop = "10px";
    cacheStats.innerHTML = `<b>Path cache:</b> ${targetNodes.length} targets precomputed`;

    // Add social distance control slider
    const socialDistanceLabel = document.createElement("label");
    socialDistanceLabel.innerText = "Social distance:";
    socialDistanceLabel.style.display = "block";
    socialDistanceLabel.style.marginTop = "10px";

    const socialDistanceSlider = document.createElement("input");
    socialDistanceSlider.type = "range";
    socialDistanceSlider.min = 5;
    socialDistanceSlider.max = 30;
    socialDistanceSlider.value = 15;
    socialDistanceSlider.style.width = "100px";

    const socialDistanceValue = document.createElement("span");
    socialDistanceValue.innerText = ` ${socialDistanceSlider.value}`;

    socialDistanceSlider.oninput = function () {
        // Update the social distance for all agents
        const newDistance = parseInt(socialDistanceSlider.value);
        agents.forEach(agent => {
            agent.socialDistance = newDistance;
        });
        socialDistanceValue.innerText = ` ${newDistance}`;
    };

    // Add stuck threshold control slider
    const stuckThresholdLabel = document.createElement("label");
    stuckThresholdLabel.innerText = "Stuck detection (ms):";
    stuckThresholdLabel.style.display = "block";
    stuckThresholdLabel.style.marginTop = "10px";

    const stuckThresholdSlider = document.createElement("input");
    stuckThresholdSlider.type = "range";
    stuckThresholdSlider.min = 1000;
    stuckThresholdSlider.max = 5000;
    stuckThresholdSlider.value = 3000;
    stuckThresholdSlider.style.width = "100px";

    const stuckThresholdValue = document.createElement("span");
    stuckThresholdValue.innerText = ` ${stuckThresholdSlider.value}`;

    stuckThresholdSlider.oninput = function () {
        // Update the stuck threshold for all agents
        const newThreshold = parseInt(stuckThresholdSlider.value);
        agents.forEach(agent => {
            agent.stuckThreshold = newThreshold;
        });
        stuckThresholdValue.innerText = ` ${newThreshold}`;
    };

    sliderContainer.appendChild(sliderLabel);
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(sliderValue);
    sliderContainer.appendChild(document.createElement("br"));
    sliderContainer.appendChild(socialDistanceLabel);
    sliderContainer.appendChild(socialDistanceSlider);
    sliderContainer.appendChild(socialDistanceValue);
    sliderContainer.appendChild(document.createElement("br"));
    sliderContainer.appendChild(stuckThresholdLabel);
    sliderContainer.appendChild(stuckThresholdSlider);
    sliderContainer.appendChild(stuckThresholdValue);
    sliderContainer.appendChild(document.createElement("br"));
    sliderContainer.appendChild(cacheStats);
    document.body.appendChild(sliderContainer);

    // Return values needed for animation
    return { agents, tickMultiplier, targetNodes };
}


// Add map texture controls
function addMapTextureControls() {
    const controlsContainer = document.createElement("div");
    controlsContainer.style.position = "absolute";
    controlsContainer.style.top = "200px";
    controlsContainer.style.left = "10px";
    controlsContainer.style.background = "rgba(255, 255, 255, 0.8)";
    controlsContainer.style.padding = "10px";
    controlsContainer.style.borderRadius = "5px";
    controlsContainer.id = "mapControlsContainer";

    const opacityLabel = document.createElement("label");
    opacityLabel.innerText = "Map opacity:";
    opacityLabel.style.display = "block";

    const opacitySlider = document.createElement("input");
    opacitySlider.type = "range";
    opacitySlider.min = 0;
    opacitySlider.max = 100;
    opacitySlider.value = 90;
    opacitySlider.style.width = "100px";

    const opacityValue = document.createElement("span");
    opacityValue.innerText = ` ${opacitySlider.value}%`;

    opacitySlider.oninput = function() {
        const opacity = parseInt(opacitySlider.value) / 100;
        const terrain = scene.getObjectByName("terrain");
        if (terrain && terrain.material) {
            terrain.material.opacity = opacity;
        }
        opacityValue.innerText = ` ${opacitySlider.value}%`;
    };

    controlsContainer.appendChild(opacityLabel);
    controlsContainer.appendChild(opacitySlider);
    controlsContainer.appendChild(opacityValue);
    document.body.appendChild(controlsContainer);
}

// Animation code
let agentsData;
let lastUpdateTime;
let accumulatedTime;
const timeStep = 1000 / 60;

// Initialize everything and start animation
async function init() {
    // Setup terrain with texture first
    await setupTerrain();
    
    // Setup roads
   setupRoads();
    
    // Setup agents
    agentsData = setupAgents();
    
    // Initialize animation parameters
    lastUpdateTime = performance.now();
    accumulatedTime = 0;
    
    // Start animation loop
    animate();
}

function animate() {
    stats.begin();

    let deltaTime = performance.now() - lastUpdateTime;
    lastUpdateTime = performance.now();
    accumulatedTime += deltaTime;
    
    while (accumulatedTime >= timeStep) {
        if (agentsData && agentsData.agents) {
            agentsData.agents.forEach(agent => agent.update(graph, timeStep, agentsData.tickMultiplier.value));
        }
        accumulatedTime -= timeStep;
    }

    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    stats.end();
}

// Add a toggle button for map texture
function addMapToggleButton() {
    const toggleBtn = document.createElement("button");
    toggleBtn.innerText = "Toggle Map";
    toggleBtn.style.position = "absolute";
    toggleBtn.style.top = "270px";
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