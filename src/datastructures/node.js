class Node {
    constructor(value) {
        this.value = value;
        this.neighbors = new Map();;
    }

    addNeighbor(node, weight) {
        this.neighbors.set(node, weight);
    }
}

export { Node };