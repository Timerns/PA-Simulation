import { getElevation } from './elevation.js';
import * as THREE from 'three';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Graph } from './graph';


const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// const box = [6.605444, 46.506415, 6.643553, 46.525028];
const box = [6.605444, 46.506415, 6.643553, 46.525028];
const minLon = box[0], minLat = box[1], maxLon = box[2], maxLat = box[3];
// Main roads
// const overpassQuery = `[out:json][timeout:25];(way["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
// const overpassQuery = `[out:json][timeout:25];(way["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary|residential"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
// const overpassQuery = `[out:json][timeout:25];(way["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
// const overpassQuery = `[out:json][timeout:25];(way["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
const overpassQuery = `[out:json][timeout:25];(way["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;

const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(overpassQuery);

const graph = new Graph();

var response = await fetch(url);
response = await response.json();

function getCoodinates(geometry) {
    const latScale = 111132;
    const lonScale = 111320 * Math.cos(geometry.lat * (Math.PI / 180));
    const x = (geometry.lon * lonScale) - ((box[2] + box[0]) / 2 * lonScale);
    const z = ((box[3] + box[1]) / 2 * latScale) - (geometry.lat * latScale);
    const y = getElevation(geometry.lat, geometry.lon);
    return new THREE.Vector3(x, y, z);
}

const elements = response.elements;
for (let i = 0; i < elements.length; i++) {
    for (let j = 0; j < elements[i].geometry.length - 1; j++) {
        const node1 = graph.addNode(elements[i].nodes[j], getCoodinates(elements[i].geometry[j]));
        const node2 = graph.addNode(elements[i].nodes[j + 1], getCoodinates(elements[i].geometry[j + 1]));
        let distance = node1.value.distanceTo(node2.value);
        let weight = distance / 10; // Adjust weight based on distance and road type
        graph.addEdge(node1, node2, weight);
        graph.addEdge(node2, node1, weight);
    }
}

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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(100, 200, 100);
scene.add(directionalLight);

const latScale = 111132;
const lonScale = 111320 * Math.cos((box[1] + box[3]) / 2 * (Math.PI / 180));
const planeGeometry = new THREE.PlaneGeometry((box[2] - box[0]) * lonScale, (box[3] - box[1]) * latScale, 50, 50);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xB3C8CF, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = Math.PI / 2;
scene.add(plane);


const agents = [];
const agentMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const agentGeometry = new THREE.SphereGeometry(5);
const targetNode = graph.getRandomNode();

const targetMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const targetGeometry = new THREE.SphereGeometry(5);
const target = new THREE.Mesh(targetGeometry, targetMaterial);
target.position.copy(targetNode.value);
scene.add(target);

for (let i = 0; i < 200; i++) {
    let randomNode = graph.getRandomNode();
    let agent = new THREE.Mesh(agentGeometry, agentMaterial);
    agent.position.copy(randomNode.value);
    agent.currentNode = randomNode;
    agent.targetNode = targetNode;
    agents.push(agent);
    scene.add(agent);
}

function getEdgeKey(node1, node2) {
    // create a unique key for the edge between two nodes based one they 3d vector as there values unique for each paire of node
    if (node1.value.x < node2.value.x) {
        return `${node1.value.x},${node1.value.y},${node1.value.z}-${node2.value.x},${node2.value.y},${node2.value.z}`;
    } else {
        return `${node2.value.x},${node2.value.y},${node2.value.z}-${node1.value.x},${node1.value.y},${node1.value.z}`;
    }
}

function moveAgents() {
    edgeAgentCount.clear();

    for (let agent of agents) {
        if (agent.currentNode === agent.targetNode) continue;

        if (!agent.path || agent.path.length <= 1) {
            agent.path = graph.aStar(agent.currentNode, agent.targetNode);
            if (!agent.path || agent.path.length < 2) continue;
        }

        let nextNode = agent.path[1];
        let edgeKey = getEdgeKey(agent.currentNode, nextNode);
        edgeAgentCount.set(edgeKey, (edgeAgentCount.get(edgeKey) || 0) + 1);

        let edgeWeight = graph.getEdgeWeight(agent.currentNode, nextNode) || 1;
        let speed = 0.1 / edgeWeight;
        agent.position.lerp(nextNode.value, speed);

        if (agent.position.distanceTo(nextNode.value) < 1) {
            agent.position.copy(nextNode.value);
            agent.currentNode = nextNode;
            agent.path.shift();
        }
    }
}

var connectedcomponent = graph.connectedComponents();


const edgeAgentCount = new Map(); // Store agent count on edges
const edgeMeshes = new Map(); // Store individual edges
const drawnEdges = new Set();

const colorMap = [
    0xd9ed92,
    0xb5e48c,
    0x99d98c,
    0x76c893,
    0x52b69a,
    0x34a0a4,
    0x168aad,
    0x1a759f,
    0x1e6091,
    0x184e77
]
for (let component of connectedcomponent) {
    var color = colorMap[Math.floor(Math.random() * colorMap.length)];
    for (let road of component) {
        for (let neighbor of road.neighbors.keys()) {
            // console.log(road)
            let edgeKey = getEdgeKey(road, neighbor);

            if (drawnEdges.has(edgeKey)) continue;
            drawnEdges.add(edgeKey);

            const positions = new Float32Array([
                road.value.x, road.value.y, road.value.z,
                neighbor.value.x, neighbor.value.y, neighbor.value.z
            ]);

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            // Define the color of the line based on the number of agents
            const material = new THREE.LineBasicMaterial({ color: color });



            const edgeLine = new THREE.LineSegments(geometry, material);
            scene.add(edgeLine);
            edgeMeshes.set(edgeKey, { line: edgeLine, material });
        }
    }
}

function updateEdgeColors() {
    for (let [edgeKey, edgeData] of edgeMeshes.entries()) {
        let agentCount = edgeAgentCount.get(edgeKey) || 0;
        let t = Math.min(agentCount / 5, 1); // Normalize between 0 and 1
        const currentColor = edgeData.material.color;
        let color = new THREE.Color().lerpColors(currentColor, new THREE.Color(0xff0000), t);

        edgeData.material.color.set(color);
    }
}

function animate() {
    stats.begin();
    moveAgents();
    updateEdgeColors();
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    stats.end();
}

animate();

window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


