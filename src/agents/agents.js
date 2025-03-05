import * as THREE from 'three';

class Agent {
    constructor(node, targetNode) {
        this.currentNode = node;
        this.targetNode = targetNode;
        this.progress = 0;
        this.path = null;
        this.speed = 50; // Movement speed

        // Create visual representation
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(5),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        this.mesh.position.copy(node.value);
    }

    update(graph, deltaTime, tickMultiplier) {
        if (this.currentNode === this.targetNode) return;

        if (!this.path || this.path.length <= 1) {
            this.path = graph.aStar(this.currentNode, this.targetNode);
            if (!this.path || this.path.length < 2) return;
            this.progress = 0;
        }

        let nextNode = this.path[1];
        let edgeLength = this.currentNode.value.distanceTo(nextNode.value);
        let stepSize = this.speed * tickMultiplier * (deltaTime / 1000);

        this.progress = Math.min(this.progress + stepSize, edgeLength);
        let alpha = this.progress / edgeLength;
        this.mesh.position.lerpVectors(this.currentNode.value, nextNode.value, alpha);

        if (this.progress >= edgeLength) {
            this.mesh.position.copy(nextNode.value);
            this.currentNode = nextNode;
            this.path.shift();
            this.progress = 0;
        }
    }
}

export { Agent };