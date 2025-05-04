// import { Graph } from './datastructures/graph.js';
// import { getRoadMap } from './data/openstreetmap.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMapTexture } from './data/terrain.js';
import { getElevation } from './data/elevation.js';
// import { transformInM } from './data/wgs84.js';
import { Flood } from './flood.js';
import Stats from 'stats.js';

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const box = [6.58,46.506415,6.643553,46.531823];

// const roads = await getRoadMap(...box);

// const graph = new Graph();


// for (var road of roads) {
//     for (let i = 0; i < road.geometry.length - 1; i++) {
//         const node1 = graph.addNode(new THREE.Vector3 (...transformInM(road.geometry[i], ...box)));
//         const node2 = graph.addNode(new THREE.Vector3 (...transformInM(road.geometry[i + 1], ...box)));
//         const distance = node1.value.distanceTo(node2.value);
//         graph.addEdge(node1, node2, distance);
//         graph.addEdge(node2, node1, distance);
//     }
// }

// const targets = [];
// for (let i = 0; i < 10; i++) {
//     const node = graph.getRandomNode();
//     targets.push(node);
// }



// console.time("Precomputing paths");
// graph.computeShortestPath(targets);
// console.timeEnd("Precomputing paths");

// console.log(graph.computedShortestPath);
// console.log(graph.computedShortestPath.get(nodes[1]));
// console.log(graph.computedShortestPath.get(graph.computedShortestPath.get(nodes[1])));
// console.log(graph.computedShortestPath.get(graph.computedShortestPath.get(graph.computedShortestPath.get(nodes[1]))));

// Example usage
// import { loadBuildingsFromOSM, createBuildingDistribution, generateRandomCoordinate } from "./data/population.js";
// async function example() {
//     const box = [83.574371,28.245269,83.609904,28.286696]; // [minLon, minLat, maxLon, maxLat]
    
//     // Load buildings from OSM
//     const buildings = await loadBuildingsFromOSM(box);
//     console.log(`Loaded ${buildings.length} buildings`);
    
//     // Create distribution
//     const distribution = createBuildingDistribution(buildings, box, 40);
    
//     // Generate 10 random coordinates
//     for (let i = 0; i < 10; i++) {
//         const coord = generateRandomCoordinate(distribution);
//         console.log(`Random coordinate ${i + 1}:`, coord);
//     }
// }

// // Run the example
// example().catch(console.error);

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
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(100, 200, 100);
scene.add(directionalLight);

const latScale = 111132;
const lonScale = 111320 * Math.cos((box[1] + box[3]) / 2 * (Math.PI / 180));

const widthSegments = 200;
const heightSegments = 200;
const geometry = new THREE.PlaneGeometry((box[2] - box[0]) * lonScale, (box[3] - box[1]) * latScale, widthSegments, heightSegments);

// add a PlaneGeometry to the scene that is at level 0
// const plane = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x00ff00, side: THREE.DoubleSide }));
// plane.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
// scene.add(plane);


async function setupTerrain() {
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
        console.error("Error setting up terrain:", error);
    }
}

// var tickMultiplier = { value: 1 };

// create a slider for the tick multiplier
// const tickMultiplierSlider = document.createElement('input');
// tickMultiplierSlider.type = 'range';
// tickMultiplierSlider.min = 1;
// tickMultiplierSlider.max = 50;
// tickMultiplierSlider.step = 1;
// tickMultiplierSlider.value = tickMultiplier.value;
// tickMultiplierSlider.style.position = 'absolute';
// tickMultiplierSlider.style.top = '100px';
// tickMultiplierSlider.style.left = '10px';
// tickMultiplierSlider.style.zIndex = 1000;
// document.body.appendChild(tickMultiplierSlider);

// tickMultiplierSlider.addEventListener('input', (event) => {
//     tickMultiplier.value = parseFloat(event.target.value);
// }
// );





var lastUpdateTime = performance.now();
function animate() {
    stats.begin();
    const currentTime = performance.now();
    const deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;
    
    requestAnimationFrame(animate);
    controls.update();
    
    // flood.addWaterAt(75, 100, 0.05, deltaTime, tickMultiplier.value);
    // flood.addWaterAt(155, 85, 0.05, deltaTime, tickMultiplier.value);
    // flood.addWaterAt(37, 50, 0.05, deltaTime, tickMultiplier.value);
    // flood.addWaterAt(70, 42, 0.05, deltaTime, tickMultiplier.value);
    // flood.update(deltaTime, tickMultiplier.value);
    renderer.render(scene, camera);
    stats.end();
}

await setupTerrain();
// const flood = new Flood(scene, box, geometry);
animate();


window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);