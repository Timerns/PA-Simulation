import * as THREE from "three";
import { Graph } from "../datastructures/graph";
import { wgs84ToCoordsFromCenter } from "../utils/geoutils.js";

export class Roads {
  constructor() {
    this.roads = null;
    this.graph = new Graph();
  }

  async load(elevation, bounds) {
    this.roads = await this.getRoads(...bounds);
    this.generateGraph(elevation, bounds);
    this.filterRoadGraph();
  }

  async getRoads(minLon, minLat, maxLon, maxLat) {
    const overpassQuery = `[out:json][timeout:25];(way["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
    const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(overpassQuery)
    const response = await fetch(url).then(res => res.json());
    return response.elements
  }

  generateGraph(elevation, bounds) {
    for (var road of this.roads) {
      for (let i = 0; i < road.geometry.length - 1; i++) {
        const coordsP1 = wgs84ToCoordsFromCenter(road.geometry[i].lon, road.geometry[i].lat, bounds);
        const coordsP2 = wgs84ToCoordsFromCenter(road.geometry[i + 1].lon, road.geometry[i + 1].lat, bounds);

        const heightP1 = elevation.getHeight(road.geometry[i].lat, road.geometry[i].lon);
        const heightP2 = elevation.getHeight(road.geometry[i + 1].lat, road.geometry[i + 1].lon);
        const node1 = this.graph.addNode(new THREE.Vector3(coordsP1[0], heightP1, coordsP1[1]));
        const node2 = this.graph.addNode(new THREE.Vector3(coordsP2[0], heightP2, coordsP2[1]));

        const distance = node1.value.distanceTo(node2.value);
        this.graph.addEdge(node1, node2, distance);
        this.graph.addEdge(node2, node1, distance);
      }
    }
  }

  filterRoadGraph() {
    const components = this.graph.connectedComponents();
    let largestComponent = 0;
    for (let i = 0; i < components.length; i++) {
        if (components[i].length > components[largestComponent].length) {
            largestComponent = i;
        }
    }

    for (let i = 0; i < components.length; i++) {
        if (i !== largestComponent) {
            for (let node of components[i]) {
                this.graph.removeNode(node);
            }
        }
    }
  }

  getMesh() {
    const material = new THREE.LineBasicMaterial({ 
      color: 0x0000ff,
      vertexColors: true,
      linewidth: 2
    });
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const drawnEdges = new Set();
    const color = new THREE.Color();  
    const edges = this.graph.connectedComponents()[0];
    for (const node of edges) {
      for (const neighbor of node.neighbors.keys()) {
          let edgeKey = this.graph.getEdgeKey(node, neighbor);
          if (drawnEdges.has(edgeKey)) continue;
          drawnEdges.add(edgeKey);
          positions.push(node.value.x, node.value.y, node.value.z);
          positions.push(neighbor.value.x, neighbor.value.y, neighbor.value.z);
          color.setHex(0x000000);
          colors.push(color.r, color.g, color.b);
          colors.push(color.r, color.g, color.b);
         
      }
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(geometry, material);
    line.name = "roads";

    return line;
  }

  getNodeMesh(scene) {
    
    const geometry = new THREE.SphereGeometry(3, 8, 8);
    const nodes = this.graph.connectedComponents()[0];
    const nodeMeshes = [];

    for (const node of nodes) {
      const material = new THREE.MeshBasicMaterial({ color: 0x3D3A4B  });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(node.value);
      mesh.userData.node = node;
      mesh.userData.isNode = true;
      mesh.userData.isSelected = false 
      nodeMeshes.push(mesh);
    }

    for (const node of nodeMeshes) {
      scene.add(node);
    }

    return nodeMeshes;
  }

  draw(scene) {
    const roadMesh = this.getMesh();
    scene.add(roadMesh);
  }
}

