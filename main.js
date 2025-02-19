import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const box = [6.605444, 46.506415, 6.643553, 46.525028];

/* --- Setup Three.js Scene --- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(0, 800, 800);
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

/* --- Mapping Function --- */
function mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

const minLon = box[0], minLat = box[1], maxLon = box[2], maxLat = box[3];
const outMinX = -400, outMaxX = 400;
const outMinZ = -300, outMaxZ = 300;

/* --- Global Arrays --- */
let roads = [];
let agents = [];
let roadLines = [];
const numAgents = 50;
let graph = {};




/* --- Animation Loop --- */
function animate() {
    requestAnimationFrame(animate);
    agents.forEach(agent => agent.update());
    controls.update();
    renderer.render(scene, camera);
}

/* --- Fetch OSM Data --- */
const overpassQuery = `[out:json][timeout:25];(way["highway"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(overpassQuery);

console.log(url);

fetch(url)
    .then(response => response.json())
    .then(data => {
        const elements = data.elements;
        let nbRoads = 0;
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element.type === "way" && element.geometry) {
                const road = [];
                for (let j = 0; j < element.geometry.length; j++) {
                    const pt = element.geometry[j];
                    const x = mapRange(pt.lon, minLon, maxLon, outMinX, outMaxX);
                    const z = mapRange(pt.lat, minLat, maxLat, outMinZ, outMaxZ);
                    road.push(new THREE.Vector3(x, 0, z));
                }
                if (road.length >= 2) {
                    // draw a point for each point in the road
                    for (let j = 0; j < road.length; j++) {
                        const geometry = new THREE.SphereGeometry(1, 16, 16);
                        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                        const sphere = new THREE.Mesh(geometry, material);
                        sphere.position.copy(road[j]);
                        scene.add(sphere);
                    }

                    roads.push(road);
                    const geometry = new THREE.BufferGeometry().setFromPoints(road);
                    const randomColor = Math.random() * 0xffffff;
                    const material = new THREE.LineBasicMaterial({ color: randomColor });
                    const line = new THREE.Line(geometry, material);
                    scene.add(line);
                    nbRoads++;
                    roadLines.push(line);
                }
            }
        }

        // --- Build the Road Graph ---
        console.log("Lenth of roads: ", roads.length);
        for (let i = 0; i < roads.length; i++) {
            const road = roads[i];
            for (let j = 0; j < road.length - 1; j++) {
                const startPoint = road[j];
                const endPoint = road[j + 1];

                const startKey = `${startPoint.x},${startPoint.z}`;
                const endKey = `${endPoint.x},${endPoint.z}`;

                if (!graph[startKey]) {
                    [startKey] = [];
                }
                if (!graph[endKey]) {
                    graph[endKey] = [];
                }

                graph[startKey].push(endPoint);
            }
        }

        console.log("Road Graph:", graph);
        console.log("Number of Roads:", nbRoads);
        console.log("Number of Road in Graph:", Object.keys(graph).length);
    })
    .catch(error => {
        console.error("Error fetching OSM data:", error);
    });

animate();

/* --- Handle Window Resize --- */
window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});