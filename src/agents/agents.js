import * as THREE from 'three';

class Agent {
    constructor(node, targetNode) {
        this.currentNode = node;
        this.targetNode = targetNode;
        this.progress = 0;
        this.nextNode = null;
        this.speed = 50; // Movement speed

        // Create visual representation
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(5),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        this.mesh.position.copy(node.value);
    }

    update(graph, deltaTime, tickMultiplier) {
        // If we've reached the target, nothing to do
        if (this.currentNode === this.targetNode) return;

        // If we don't have a next node yet, get it from the precomputed path
        if (!this.nextNode) {
            this.nextNode = graph.getNextNodeToTarget(this.currentNode, this.targetNode);
            if (!this.nextNode) return; // No path exists
            this.progress = 0;
        }

        // Calculate movement
        let edgeLength = this.currentNode.value.distanceTo(this.nextNode.value);
        let stepSize = this.speed * tickMultiplier * (deltaTime / 1000);

        this.progress = Math.min(this.progress + stepSize, edgeLength);
        let alpha = this.progress / edgeLength;
        this.mesh.position.lerpVectors(this.currentNode.value, this.nextNode.value, alpha);

        // When we reach the next node
        if (this.progress >= edgeLength) {
            this.mesh.position.copy(this.nextNode.value);
            this.currentNode = this.nextNode;
            this.nextNode = graph.getNextNodeToTarget(this.currentNode, this.targetNode);
            this.progress = 0;
        }
    }
}

export { Agent };