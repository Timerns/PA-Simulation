import * as THREE from 'three';
import Stats from 'stats.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { getRoadMap, getWaterMap } from './data/openstreetmap.js';
import { transformInM } from './data/wgs84.js';
import { Graph } from './datastructures/graph.js';
import { Agent } from './agents/agents.js';
import { getElevation } from './data/elevation.js';


const box = [6.590209,46.506415,6.643553,46.531823];
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


// graph.addNode(new THREE.Vector3(10.00000000001, 0.00000000001, 0.00000000001));
// graph.addNode(new THREE.Vector3(1, 0, 0));
// graph.addNode(new THREE.Vector3(0, 1, 0));
// graph.addNode(new THREE.Vector3(0, 0, 1));
console.log(graph);

const node1 = graph.nodes.get("-990.9881823724136,65.47766372461854,-995.1870599994436");
console.log("Node1 :" );
console.log(node1);
console.log(graph.removeNode(node1));

const node2 = graph.nodes.get("-990.9881823724136,65.47766372461854,-995.1870599994436");
console.log(node2);
