import { Node } from './node.js';

class Graph {
    constructor() {
        this.nodes = new Map();
        this.computedShortestPath = new Map();

    }

    getNodeKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    getNodeByKey(key) {
        return this.nodes.get(key);
    }

    getEdgeKey(node1, node2) {
        return node1.value.x < node2.value.x
            ? `${node1.value.x},${node1.value.y},${node1.value.z}-${node2.value.x},${node2.value.y},${node2.value.z}`
            : `${node2.value.x},${node2.value.y},${node2.value.z}-${node1.value.x},${node1.value.y},${node1.value.z}`;
    }

    getRandomNode() {
        const keys = Array.from(this.nodes.keys());
        return this.nodes.get(keys[Math.floor(Math.random() * keys.length)]);
    }

    getEdgeWeight(source, destination) {
        return source.neighbors.get(destination);
    }

    addNode(value) {
        const key = this.getNodeKey(value.x, value.y, value.z);
        if (this.nodes.has(key)) {
            return this.nodes.get(key);
        }
        const node = new Node(value);
        this.nodes.set(key, node);
        return node;
    }

    addEdge(source, destination, weight = 1) {
        source.addNeighbor(destination, weight);
    }

    removeNode(node) {
        var key = this.getNodeKey(node.value.x, node.value.y, node.value.z);
        return this.nodes.delete(key);
    }

    removeEdge(source, destination) {
        source.neighbors.delete(destination);
    }

    bfs(start) {
        const visited = new Set();
        const queue = [start];
        const result = [];
        while (queue.length > 0) {
            const node = queue.shift();
            if (visited.has(node)) {
                continue;
            }
            visited.add(node);
            result.push(node);
            for (const neighbor of node.neighbors.keys()) {
                queue.push(neighbor);
            }
        }
        return result;
    }

    connectedComponents() {
        const visited = new Set();
        const components = [];
        for (const node of this.nodes.values()) {
            if (visited.has(node)) {
                continue;
            }
            const component = this.bfs(node);
            components.push(component);
            for (const node of component) {
                visited.add(node);
            }
        }
        return components;
    }

    nearestNode(postion) {
        let minDistance = Infinity;
        let nearestNode = null;
        for (const otherNode of this.nodes.values()) {
            const distance = postion.distanceTo(otherNode.value);
            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = otherNode;
            }
        }
        return nearestNode;
    }

    computeShortestPath(targetNodes) {
        let time = performance.now();
        this.computedShortestPath.clear();
        
        // If no target nodes, return
        if (targetNodes.length === 0) return;
        
        // Initialize distances and previous nodes
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        
        // Set initial distances: 0 for target nodes, Infinity for others
        for (const node of this.nodes.values()) {
            if (targetNodes.includes(node)) {
                distances.set(node, 0);
            } else {
                distances.set(node, Infinity);
            }
            previous.set(node, null);
            unvisited.add(node);
        }
        
        // Dijkstra's algorithm
        while (unvisited.size > 0) {
            // Find the unvisited node with the smallest distance
            let current = null;
            let smallestDistance = Infinity;
            for (const node of unvisited) {
                const distance = distances.get(node);
                if (distance < smallestDistance) {
                    smallestDistance = distance;
                    current = node;
                }
            }
            
            // If no reachable nodes left, break
            if (current === null || smallestDistance === Infinity) break;
            
            // Remove current from unvisited
            unvisited.delete(current);
            
            // Update distances for neighbors
            for (const [neighbor, weight] of current.neighbors) {
                if (!unvisited.has(neighbor)) continue;
                
                const alt = distances.get(current) + weight;
                if (alt < distances.get(neighbor)) {
                    distances.set(neighbor, alt);
                    previous.set(neighbor, current);
                }
            }
        }
        
        // Store the next node to reach the nearest target for each node
        for (const node of this.nodes.values()) {
            if (previous.get(node) === null && !targetNodes.includes(node)) {
                // No path to any target node
                this.computedShortestPath.set(node, null);
            } else {
                this.computedShortestPath.set(node, previous.get(node));
            }
        }
        time = performance.now() - time
        let numberOfEdges = 0;
        for (const node of this.nodes.values()) {
            for (const neighbor of node.neighbors.keys()) {
                numberOfEdges++;
            }
        }

        console.log(`${this.nodes.size} & ${numberOfEdges} & ${targetNodes.length} & ${time.toFixed(1)}`);
    }
}

export { Graph };