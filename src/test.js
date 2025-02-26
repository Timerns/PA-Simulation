import { getElevation } from './heightmap/elevation.js';
import * as THREE from 'three';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Graph } from './datastructures/graph.js';

// Stats Panel
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Define bounding box
// const box = [6.605444, 46.506415, 6.643553, 46.525028];
const box = [6.590209,46.506415,6.643553,46.531823];
// const box = [6.590209,46.514106,6.620550,46.531823];
const [minLon, minLat, maxLon, maxLat] = box;

// Overpass API Query
const overpassQuery = `[out:json][timeout:25];(way["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(overpassQuery);

// Graph Data Structure
const graph = new Graph();
const response = await fetch(url).then(res => res.json());

// Coordinate Transformation Function
function getCoordinates(geometry) {
    const latScale = 111132;
    const lonScale = 111320 * Math.cos(geometry.lat * (Math.PI / 180));
    return new THREE.Vector3(
        (geometry.lon * lonScale) - ((box[2] + box[0]) / 2 * lonScale),
        getElevation(geometry.lat, geometry.lon),
        ((box[3] + box[1]) / 2 * latScale) - (geometry.lat * latScale)
    );
}

// Build Graph from Response Data
for (let element of response.elements) {
    for (let j = 0; j < element.geometry.length - 1; j++) {
        const node1 = graph.addNode(element.nodes[j], getCoordinates(element.geometry[j]));
        const node2 = graph.addNode(element.nodes[j + 1], getCoordinates(element.geometry[j + 1]));
        const distance = node1.value.distanceTo(node2.value);
        const weight = distance / 10; // Adjust weight based on distance
        graph.addEdge(node1, node2, weight);
        graph.addEdge(node2, node1, weight);
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
controls.minDistance = 100;
controls.maxDistance = 3000;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(100, 200, 100);
scene.add(directionalLight);

// Ground Plane
const latScale = 111132;
const lonScale = 111320 * Math.cos((box[1] + box[3]) / 2 * (Math.PI / 180));
const plane = new THREE.Mesh(
    new THREE.PlaneGeometry((box[2] - box[0]) * lonScale, (box[3] - box[1]) * latScale, 50, 50),
    new THREE.MeshBasicMaterial({ color: 0xB3C8CF, side: THREE.DoubleSide })
);
plane.rotation.x = Math.PI / 2;
scene.add(plane);

// Agents & Target
const agents = [];
const agentMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const agentGeometry = new THREE.SphereGeometry(5);
const targetNode = graph.getRandomNode();
const target = new THREE.Mesh(new THREE.SphereGeometry(5), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
target.position.copy(targetNode.value);
scene.add(target);

const astarWorker = new Worker("./datastructures/astarWorker.js");

function calculatePathAsync(startNode, targetNode, callback) {
    astarWorker.onmessage = function (e) {
        callback(e.data);
    };
    astarWorker.postMessage({
        graphData: graph.toJSON(),
        startId: startNode.id,
        endId: targetNode.id
    });
}

// Spawn Agents
for (let i = 0; i < 200; i++) {
    let randomNode = graph.getRandomNode();
    let agent = new THREE.Mesh(agentGeometry, agentMaterial);
    agent.position.copy(randomNode.value);
    agent.currentNode = randomNode;
    agent.targetNode = targetNode;
    agents.push(agent);
    scene.add(agent);
}

for (let agent of agents) {
    calculatePathAsync(agent.currentNode, agent.targetNode, (path) => {
        agent.path = path;
    });
}

// Function to Generate Edge Key
function getEdgeKey(node1, node2) {
    return node1.value.x < node2.value.x
        ? `${node1.value.x},${node1.value.y},${node1.value.z}-${node2.value.x},${node2.value.y},${node2.value.z}`
        : `${node2.value.x},${node2.value.y},${node2.value.z}-${node1.value.x},${node1.value.y},${node1.value.z}`;
}

// Movement Logic
let lastUpdateTime = performance.now(); // Track the last update time
const timeStep = 1000 / 180; // Fixed time step (60 updates per second)
let accumulatedTime = 0;
let tickMultiplier = 1;

function moveAgents(deltaTime) {
    for (let agent of agents) {
        if (agent.currentNode === agent.targetNode) continue;

        if (!agent.path || agent.path.length <= 1) {
            agent.path = graph.aStar(agent.currentNode, agent.targetNode);
            if (!agent.path || agent.path.length < 2) continue;
            agent.progress = 0; // Reset progress along edge
        }

        let nextNode = agent.path[1];
        let edgeLength = agent.currentNode.value.distanceTo(nextNode.value);
        let stepSize = 15 * tickMultiplier * (deltaTime / 1000); // Time-based movement

        agent.progress = Math.min(agent.progress + stepSize, edgeLength);
        let alpha = agent.progress / edgeLength;
        agent.position.lerpVectors(agent.currentNode.value, nextNode.value, alpha);

        if (agent.progress >= edgeLength) {
            agent.position.copy(nextNode.value);
            agent.currentNode = nextNode;
            agent.path.shift();
            agent.progress = 0; // Reset progress for next edge
        }
    }
}
// Process Graph Edges (Batch Rendering)
// Store edges separately for easier interaction
const edges = [];
const edgePositions = [];
const drawnEdges = new Set();
// Process Graph Edges (Batch Rendering with Interactivity)
for (let component of graph.connectedComponents()) {
    for (let road of component) {
        for (let neighbor of road.neighbors.keys()) {
            let edgeKey = getEdgeKey(road, neighbor);
            if (drawnEdges.has(edgeKey)) continue;
            drawnEdges.add(edgeKey);

            const edgeGeometry = new THREE.BufferGeometry().setFromPoints([road.value, neighbor.value]);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
            const edge = new THREE.Line(edgeGeometry, edgeMaterial);
            edge.userData = { node1: road, node2: neighbor };
            edges.push(edge);
            scene.add(edge);
        }
    }
}
if (edgePositions.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgePositions), 3));
    const material = new THREE.LineBasicMaterial({ color: 0x000000 }); // Default black edges
    scene.add(new THREE.LineSegments(geometry, material));
}

// Create Slider UI
const sliderContainer = document.createElement("div");
sliderContainer.style.position = "absolute";
sliderContainer.style.top = "100px";
sliderContainer.style.left = "10px";
sliderContainer.style.background = "rgba(255, 255, 255, 0.8)";
sliderContainer.style.padding = "10px";
sliderContainer.style.borderRadius = "5px";

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

slider.oninput = function () {
    tickMultiplier = parseInt(slider.value);
    sliderValue.innerText = ` ${slider.value}`;
};

sliderContainer.appendChild(sliderLabel);
sliderContainer.appendChild(slider);
sliderContainer.appendChild(sliderValue);
document.body.appendChild(sliderContainer);

// Raycaster and Mouse
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedEdge = null;

// Add event listener for mouse movement
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onClick);

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onClick() {
    if (!selectedEdge) return;

    // Remove edge from the scene
    scene.remove(selectedEdge);

    // Find and remove edge from graph
    let index = edges.indexOf(selectedEdge);
    if (index !== -1) {
        let { node1, node2 } = selectedEdge.userData;
        graph.removeEdge(node1, node2);
        graph.removeEdge(node2, node1);
        edges.splice(index, 1);
    }

    // Check if any agent was using this edge and force path recalculation
    for (let agent of agents) {
        if (agent.path && agent.path.length > 1) {
            let nextNode = agent.path[1];
            let currentNode = agent.currentNode;
            let edgeKey = getEdgeKey(currentNode, nextNode);

            if (drawnEdges.has(edgeKey)) {
                // If agent is on the deleted edge, recalculate path
                agent.path = graph.aStar(currentNode, agent.targetNode);

                // If no path is found, reset agent to a new node
                if (!agent.path || agent.path.length < 2) {
                    let newNode = graph.getRandomNode();
                    agent.position.copy(newNode.value);
                    agent.currentNode = newNode;
                    agent.path = graph.aStar(newNode, agent.targetNode);
                }

                agent.progress = 0; // Reset progress along edge
            }
        }
    }

    selectedEdge = null;
}


// Animation Loop
// Update Animation Loop
function animate() {
    stats.begin();
    let currentTime = performance.now();
    let deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;
    accumulatedTime += deltaTime;
    while (accumulatedTime >= timeStep) {
        moveAgents(timeStep);
        accumulatedTime -= timeStep;
    }

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(edges);
    if (intersects.length > 0) {
        if (selectedEdge !== intersects[0].object) {
            if (selectedEdge) selectedEdge.material.color.set(0x000000); // Reset previous edge color
            selectedEdge = intersects[0].object;
            selectedEdge.material.color.set(0xff0000); // Highlight hovered edge
        }
    } else if (selectedEdge) {
        selectedEdge.material.color.set(0x000000);
        selectedEdge = null;
    }

    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    stats.end();
}
animate();


// Handle Window Resize
window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
