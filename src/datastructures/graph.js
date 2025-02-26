
class Node {
    constructor(value) {
        this.value = value;
        this.neighbors = new Map();;
    }

    addNeighbor(node, weight) {
        this.neighbors.set(node, weight);
    }
}

class PriorityQueue {
    constructor() {
        this.items = [];
    }

    enqueue(node, priority) {
        this.items.push({ node, priority });
        this.items.sort((a, b) => a.priority - b.priority); // Min-Heap Sorting
    }

    dequeue() {
        return this.items.shift().node;
    }

    isEmpty() {
        return this.items.length === 0;
    }
}

class Graph {
    constructor() {
        this.nodes = new Map();
    }

    getNode(key) {
        return this.nodes.get(key);
    }

    getRandomNode() {
        const keys = Array.from(this.nodes.keys());
        return this.nodes.get(keys[Math.floor(Math.random() * keys.length)]);
    }

    getEdgeWeight(source, destination) {
        return source.neighbors.get(destination);
    }

    addNode(key, value) {
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

     // Heuristic function (Example: Euclidean Distance)
    heuristic(nodeA, nodeB) {
        return Math.abs(nodeA.value - nodeB.value); // Modify based on the problem context
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

    toJSON() {
        return JSON.stringify([...this.nodes.entries()].map(([key, node]) => ({
            key,
            value: node.value,
            neighbors: [...node.neighbors.entries()].map(([neighbor, weight]) => ({
                neighborKey: [...this.nodes.entries()].find(([k, v]) => v === neighbor)[0], // Get key from node
                weight
            }))
        })));
    }

    static fromJSON(json) {
        const data = JSON.parse(json);
        const graph = new Graph();

        // Create nodes
        data.forEach(({ key, value }) => {
            graph.addNode(key, value);
        });

        // Reconnect neighbors
        data.forEach(({ key, neighbors }) => {
            const node = graph.getNode(key);
            neighbors.forEach(({ neighborKey, weight }) => {
                graph.addEdge(node, graph.getNode(neighborKey), weight);
            });
        });

        return graph;
    }

}

export { Graph, Node };