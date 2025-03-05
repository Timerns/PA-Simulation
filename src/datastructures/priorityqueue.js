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

export { PriorityQueue };