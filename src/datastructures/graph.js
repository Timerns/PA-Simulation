import { Node } from './node.js';
import { PriorityQueue } from './priorityqueue.js';

class Graph {
    constructor() {
        this.nodes = new Map();
        this.pathCache = new Map(); // Cache for precomputed paths
    }

    getNodeKey(x, y, z) {
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


    precomputePaths(targetNodes) {
        // Clear the existing path cache
        this.pathCache.clear();

        // For each target node, compute paths from all nodes to it
        for (const target of targetNodes) {
            const distances = new Map();
            const previous = new Map();
            const queue = new PriorityQueue();

            // Initialize distances and queue
            for (const node of this.nodes.values()) {
                distances.set(node, Infinity);
                queue.enqueue(node, Infinity);
            }
            distances.set(target, 0);
            queue.enqueue(target, 0);

            // Dijkstra's algorithm
            while (!queue.isEmpty()) {
                const current = queue.dequeue();

                // If we've reached infinity distance, no more paths to process
                if (distances.get(current) === Infinity) break;

                for (const [neighbor, weight] of current.neighbors.entries()) {
                    const distance = distances.get(current) + weight;

                    if (distance < distances.get(neighbor)) {
                        distances.set(neighbor, distance);
                        previous.set(neighbor, current);
                        queue.enqueue(neighbor, distance);
                    }
                }
            }

            // Store the path information in the cache
            const targetKey = this.getNodeKey(target.value.x, target.value.y, target.value.z);
            this.pathCache.set(targetKey, { previous, distances });
        }
    }

    getNextNodeToTarget(source, target) {
        // If source and target are the same, return the source
        if (source === target) return source;

        const targetKey = this.getNodeKey(target.value.x, target.value.y, target.value.z);

        // Check if we have precomputed paths for this target
        if (!this.pathCache.has(targetKey)) {
            // If not precomputed, compute it on-demand
            this.precomputePaths([target]);
        }

        const { previous } = this.pathCache.get(targetKey);

        // Build the path from target to source
        let path = [];
        let current = source;

        // If there's no path to the target
        if (!previous.has(source)) {
            return null;
        }

        // Reconstruct the path
        while (current !== target) {
            path.push(current);
            current = previous.get(current);

            // Safety check to prevent infinite loops
            if (!current) return null;
        }

        // Return the first node in the path after the source
        return path.length > 1 ? path[1] : previous.get(source);
    }

    getPathToTarget(source, target) {
        // If source and target are the same, return just the source
        if (source === target) return [source];

        const targetKey = this.getNodeKey(target.value.x, target.value.y, target.value.z);

        // Check if we have precomputed paths for this target
        if (!this.pathCache.has(targetKey)) {
            // If not precomputed, compute it on-demand
            this.precomputePaths([target]);
        }

        const { previous } = this.pathCache.get(targetKey);

        // Build the path from source to target
        let path = [];
        let current = source;

        // If there's no path to the target
        if (!previous.has(source)) {
            return [];
        }

        // Reconstruct the path
        while (current !== target) {
            path.push(current);
            current = previous.get(current);

            // Safety check to prevent infinite loops
            if (!current) return [];
        }

        // Add the target to the path
        path.push(target);

        return path;
    }
    

    

}

export { Graph };