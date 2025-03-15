import { Node } from './node.js';
import { PriorityQueue } from './priorityqueue.js';

class Graph {
    constructor() {
        this.nodes = new Map();
        this.pathCache = new Map(); // Cache for precomputed paths
    }

    getNodeKey(x, y, z) {
        // Round coordinates to improve node matching
        const precisionFactor = 1000;
        const rx = Math.round(x * precisionFactor) / precisionFactor;
        const ry = Math.round(y * precisionFactor) / precisionFactor;
        const rz = Math.round(z * precisionFactor) / precisionFactor;
        return `${rx},${ry},${rz}`;
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
        const key = this.getNodeKey(node.value.x, node.value.y, node.value.z);
        
        // Also remove any references to this node in neighbors
        for (const otherNode of this.nodes.values()) {
            otherNode.neighbors.delete(node);
        }
        
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
            
            for (const componentNode of component) {
                visited.add(componentNode);
            }
        }
        
        return components;
    }

    // Dijkstra algorithm to find shortest paths from a target node to all other nodes
    dijkstra(target) {
        const distances = new Map();
        const predecessors = new Map();
        const queue = new PriorityQueue();
        
        // Initialize distances
        for (const node of this.nodes.values()) {
            distances.set(node, Infinity);
            predecessors.set(node, null);
        }
        
        // Set distance to target as 0
        distances.set(target, 0);
        
        // Add target to queue
        queue.enqueue(target, 0);
        
        while (!queue.isEmpty()) {
            const current = queue.dequeue();
            const currentDistance = distances.get(current);
            
            // For each neighbor
            for (const [neighbor, weight] of current.neighbors.entries()) {
                const distance = currentDistance + weight;
                
                // If we found a shorter path
                if (distance < distances.get(neighbor)) {
                    distances.set(neighbor, distance);
                    predecessors.set(neighbor, current);
                    queue.enqueue(neighbor, distance);
                }
            }
        }
        
        return { distances, predecessors };
    }
    
    // Precompute paths from every target to all other nodes
    precomputePaths(targets) {
        this.pathCache.clear();
        
        // Run Dijkstra from each target
        for (const target of targets) {
            const targetKey = this.getNodeKey(
                target.value.x, 
                target.value.y, 
                target.value.z
            );
            
            const pathData = this.dijkstra(target);
            this.pathCache.set(targetKey, pathData);
        }
    }

    // Find closest node to a point
    findClosestNode(point) {
        let closestNode = null;
        let closestDistance = Infinity;
        
        for (const node of this.nodes.values()) {
            const distance = node.value.distanceTo(point);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestNode = node;
            }
        }
        
        return closestNode;
    }
    
    // Find k nearest neighbors to a node
    findKNearestNeighbors(node, k) {
        const distances = [];
        
        for (const otherNode of this.nodes.values()) {
            if (otherNode !== node) {
                distances.push({
                    node: otherNode,
                    distance: node.value.distanceTo(otherNode.value)
                });
            }
        }
        
        // Sort by distance
        distances.sort((a, b) => a.distance - b.distance);
        
        // Return k nearest
        return distances.slice(0, k).map(item => item.node);
    }
}

export { Graph };