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

const box = [6.61,46.506415,6.643553,46.531823];
// const box = [6.863228,46.373207,6.915413,46.402466];

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

// Ground Plane from the bbox and that has a wireframe that maches the heightmap
const latScale = 111132;
const lonScale = 111320 * Math.cos((box[1] + box[3]) / 2 * (Math.PI / 180));
const plane = new THREE.Mesh(
    new THREE.PlaneGeometry((box[2] - box[0]) * lonScale, (box[3] - box[1]) * latScale, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xB3C8CF, side: THREE.DoubleSide })
);
plane.rotation.x = Math.PI / 2;
scene.add(plane);


// Add a terrain
// const geometry = new THREE.PlaneGeometry((box[2] - box[0]) * lonScale, (box[3] - box[1]) * latScale, 100, 100);
// const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });

// for (let i = 0; i < geometry.attributes.position.array.length; i += 3) {
//     const lat = box[1] + (i / 3 % 101) / 100 * (box[3] - box[1]);
//     const lon = box[2] - Math.floor(i / 303) / 100 * (box[2] - box[0]);
//     const elevation = getElevation(lat, lon);
//     // console.log(lon, lat, elevation);
//     geometry.attributes.position.array[i + 2] = elevation;
// }

// const terrain = new THREE.Mesh(geometry, material);
// terrain.rotation.x = -Math.PI / 2;
// scene.add(terrain);

// Roads
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
           graph.removeNode(node)
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

        // Assign a random color for each segment
        // color.setHex(Math.random() * 0xffffff);
        color.setHex(0x000000);
        colors.push(color.r, color.g, color.b);
        colors.push(color.r, color.g, color.b);
    }
}

roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
const roadMaterial = new THREE.LineBasicMaterial({ vertexColors: true });
const roadGrid = new THREE.LineSegments(roadGeometry, roadMaterial);
scene.add(roadGrid);

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredSegment = null;

// Highlight Material
const highlightMaterial = new THREE.LineBasicMaterial({ color: 0xff0000});

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


const targetNode = graph.getRandomNode();

// Draw agents the target node

const targetNodeMesh = new THREE.Mesh(
            new THREE.SphereGeometry(6),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
targetNodeMesh.position.copy(targetNode.value);
scene.add(targetNodeMesh);

const agents = [];
for (let i = 0; i < 0; i++) {
    let randomNode = graph.getRandomNode();
    let agent = new Agent(randomNode, targetNode);
    agents.push(agent);
    scene.add(agent.mesh);
}

var lastUpdateTime = performance.now();
var accumulatedTime = 0;
var timeStep = 1000 / 60;
var tickMultiplier = 1;

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

function animate() {
    stats.begin();

    let deltaTime = performance.now() - lastUpdateTime;
    lastUpdateTime = performance.now();
    accumulatedTime += deltaTime;
    
    while (accumulatedTime >= timeStep) {
        agents.forEach(agent => agent.update(graph, timeStep, tickMultiplier));
        accumulatedTime -= timeStep;
    }

    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    stats.end();
}

animate();

const updateStats = () => {
    setTimeout(updateStats, 1000);
    console.log(renderer.info.render);
}
// updateStats();