import { getElevation } from './elevation.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const box = [6.605444, 46.506415, 6.643553, 46.525028];
const minLon = box[0], minLat = box[1], maxLon = box[2], maxLat = box[3];
/* --- Fetch OSM Data --- */
const overpassQuery = `[out:json][timeout:25];(way["highway"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(overpassQuery);

import { Graph } from './graph';
const graph = new Graph();

var response = await fetch(url)
response = await response.json()

function getCoodinates(geometry) {
    const latScale = 111132; // meters per degree latitude
    const lonScale = 111320 * Math.cos(geometry.lat * (Math.PI / 180)); // meters per degree longitude
    const x = (geometry.lon * lonScale) - ((box[2] + box[0]) / 2 * lonScale);
    const z = ((box[3] + box[1]) / 2 * latScale) - (geometry.lat * latScale) ;
    const y = getElevation(geometry.lat, geometry.lon);

    return new THREE.Vector3(x, y, z);
}

const elements = response.elements;
for (let i = 0; i < elements.length; i++) {
    for (let j = 0; j < elements[i].geometry.length - 1; j++) {
        const node1 = graph.addNode(elements[i].nodes[j], getCoodinates(elements[i].geometry[j]));
        const node2 = graph.addNode(elements[i].nodes[j + 1], getCoodinates(elements[i].geometry[j + 1]));
        graph.addEdge(node1, node2, 1);
        graph.addEdge(node2, node1, 1);
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

const latScale = 111132; // meters per degree latitude
const lonScale = 111320 * Math.cos((box[1] + box[3]) / 2 * (Math.PI / 180)); // meters per degree longitude
const planeGeometry = new THREE.PlaneGeometry((box[2] - box[0]) * lonScale, (box[3] - box[1]) * latScale, 50 , 50);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xB3C8CF, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = Math.PI / 2;
scene.add(plane);

var connectedcomponent = graph.connectedComponents();

for (var component of connectedcomponent){
    var color = new THREE.Color(Math.random() * 0xffffff);
    for (var road of component){
        // create a line between road.value and each of its neighbors
        for (var neighbor of road.neighbors.keys()){
            var geometry = new THREE.BufferGeometry().setFromPoints([road.value, neighbor.value]);
            var line = new THREE.Line(geometry, new THREE.LineBasicMaterial({color: color}));
            scene.add(line);
        }
    
    }
}



function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();