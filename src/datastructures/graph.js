import { Node } from './node.js';
import { PriorityQueue } from './priorityqueue.js';
class Graph {
    constructor() {
        this.nodes = new Map();
        this.precomputedPaths = new Map(); 
    }

    getNodeKey(x, y, z) {
        // x, y, z are floating point numbers and must not be used using scientific notation

        // return `${x.toFixed(11)},${y.toFixed(11)},${z.toFixed(11)}`;
        return `${x},${y},${z}`;
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

    heuristic(nodeA, nodeB) {
        return nodeA.value.distanceTo(nodeB.value);
    }

    // A* Algorithm Implementation
    aStar(startNode, goalNode) {
        var start = Date.now();
        const openSet = new PriorityQueue();
        openSet.enqueue(startNode, 0);
    
        const cameFrom = new Map();
        const gScore = new Map();
        gScore.set(startNode, 0);
    
        const fScore = new Map();
        fScore.set(startNode, this.heuristic(startNode, goalNode));
    
        while (!openSet.isEmpty()) {
            let current = openSet.dequeue();
    
            if (current === goalNode) {
                console.log("Time taken for A* algorithm: ", Date.now() - start), "ms";
                return this.reconstructPath(cameFrom, current);
            }
    
            for (const [neighbor, weight] of current.neighbors) {
                const tentativeGScore = gScore.get(current) + weight;
    
                if (!gScore.has(neighbor) || tentativeGScore < gScore.get(neighbor)) {
                    cameFrom.set(neighbor, current);
                    gScore.set(neighbor, tentativeGScore);
                    fScore.set(neighbor, tentativeGScore + this.heuristic(neighbor, goalNode));
                    openSet.enqueue(neighbor, fScore.get(neighbor));
                }
            }
        }
        return null; // No path found
    }

    reconstructPath(cameFrom, current) {
        const totalPath = [current];
        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            totalPath.unshift(current);
        }
        return totalPath;
    }

}

export { Graph };