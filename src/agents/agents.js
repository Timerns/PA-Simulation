import * as THREE from 'three';

class Agent {
    constructor(node, targetNode) {
        this.currentNode = node;
        this.targetNode = targetNode;
        this.progress = 0;
        this.nextNode = null;
        
        // Randomize speed for each agent (units per second)
        this.speed = 30 + Math.random() * 40; // Speed between 30-70
        
        // Add stuck detection properties
        this.stuckTime = 0;
        this.stuckThreshold = 3000; // 3 seconds of being stuck
        this.lastPosition = new THREE.Vector3().copy(node.value);
        this.movementThreshold = 2; // Minimum movement to not be considered stuck
        
        // Social distancing settings
        this.socialDistance = 15;
        
        // Keep track of alternate paths and visited nodes to avoid loops
        this.visitedNodes = new Set();
        this.visitedNodes.add(this.getNodeKey(node));
        this.alternatePathAttempts = 0;
        this.maxAlternateAttempts = 3;
        
        // Create visual representation
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(5),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        this.mesh.position.copy(node.value);
        
        // For interpolation between ticks
        this.previousPosition = new THREE.Vector3().copy(node.value);
        this.targetPosition = new THREE.Vector3().copy(node.value);
    }

    getNodeKey(node) {
        return `${node.value.x},${node.value.y},${node.value.z}`;
    }

    update(graph, deltaTimeMs, tickMultiplier) {
        // Convert deltaTime from ms to seconds
        const deltaTime = deltaTimeMs / 1000;
        
        // Store previous position for interpolation
        this.previousPosition.copy(this.mesh.position);
        
        // If we've reached the target, nothing more to do
        if (this.currentNode === this.targetNode) return;

        // Check if we're stuck
        if (this.detectStuck(deltaTimeMs)) {
            this.handleStuck(graph);
        }

        // If we don't have a next node yet, get it from the precomputed path
        if (!this.nextNode) {
            this.nextNode = graph.getNextNodeToTarget(this.currentNode, this.targetNode);
            if (!this.nextNode) return; // No path exists
            this.progress = 0;
        }

        // Calculate movement with fixed time step
        let edgeLength = this.currentNode.value.distanceTo(this.nextNode.value);
        let stepSize = this.speed * tickMultiplier * deltaTime;

        // Apply social distancing - slow down if too close to other agents
        stepSize = this.applySocialDistancing(stepSize);

        // Update progress along the edge
        this.progress = Math.min(this.progress + stepSize, edgeLength);
        let alpha = this.progress / edgeLength;
        
        // Calculate new position
        this.targetPosition.lerpVectors(this.currentNode.value, this.nextNode.value, alpha);
        
        // Update mesh position directly (no interpolation in update loop)
        this.mesh.position.copy(this.targetPosition);

        // When we reach the next node
        if (this.progress >= edgeLength) {
            this.mesh.position.copy(this.nextNode.value);
            this.currentNode = this.nextNode;
            this.visitedNodes.add(this.getNodeKey(this.currentNode));
            this.nextNode = graph.getNextNodeToTarget(this.currentNode, this.targetNode);
            this.progress = 0;
            this.stuckTime = 0; // Reset stuck timer when reaching a new node
        }
    }

    detectStuck(deltaTime) {
        // Calculate distance moved since last frame
        const distanceMoved = this.mesh.position.distanceTo(this.lastPosition);
        
        // If we didn't move much, increment stuck time
        if (distanceMoved < this.movementThreshold) {
            this.stuckTime += deltaTime;
            return this.stuckTime > this.stuckThreshold;
        } else {
            // Reset stuck timer if we're moving fine
            this.stuckTime = 0;
            this.lastPosition.copy(this.mesh.position);
            return false;
        }
    }

    handleStuck(graph) {
        // If we've tried too many alternate paths, give up and teleport to a new node
        if (this.alternatePathAttempts >= this.maxAlternateAttempts) {
            console.log("Agent completely stuck, teleporting to a new random node");
            this.currentNode = graph.getRandomNode();
            this.mesh.position.copy(this.currentNode.value);
            this.nextNode = null;
            this.progress = 0;
            this.stuckTime = 0;
            this.alternatePathAttempts = 0;
            this.visitedNodes.clear();
            this.visitedNodes.add(this.getNodeKey(this.currentNode));
            return;
        }
        
        // Find an alternate path
        this.alternatePathAttempts++;
        console.log(`Agent stuck for ${this.stuckTime}ms, trying alternate path (attempt ${this.alternatePathAttempts})`);
        
        // Look for any unvisited neighbor
        let foundAlternatePath = false;
        
        for (const [neighbor, _] of this.currentNode.neighbors.entries()) {
            const neighborKey = this.getNodeKey(neighbor);
            if (!this.visitedNodes.has(neighborKey)) {
                // Found an unvisited neighbor, take that path
                this.nextNode = neighbor;
                this.progress = 0;
                this.stuckTime = 0;
                foundAlternatePath = true;
                break;
            }
        }
        
        // If no unvisited neighbors, reset and try different path
        if (!foundAlternatePath) {
            // Find the neighbor closest to the target
            let bestDistance = Infinity;
            let bestNeighbor = null;
            
            for (const [neighbor, _] of this.currentNode.neighbors.entries()) {
                const distToTarget = neighbor.value.distanceTo(this.targetNode.value);
                if (distToTarget < bestDistance) {
                    bestDistance = distToTarget;
                    bestNeighbor = neighbor;
                }
            }
            
            if (bestNeighbor) {
                this.nextNode = bestNeighbor;
                this.progress = 0;
                this.stuckTime = 0;
            } else {
                // Complete deadend - teleport to a new node
                this.currentNode = graph.getRandomNode();
                this.mesh.position.copy(this.currentNode.value);
                this.nextNode = null;
                this.progress = 0;
                this.stuckTime = 0;
            }
        }
    }

    applySocialDistancing(stepSize) {
        // Only apply social distancing if we have access to all agents
        if (!Agent.allAgents || Agent.allAgents.length === 0) {
            console.warn("Agent.allAgents is not set or empty, skipping social distancing");
            return stepSize;
        }
        
        let closestDistance = Infinity;
        
        // Check distance to all other agents
        for (const other of Agent.allAgents) {
            if (other === this) continue;
            
            const distance = this.mesh.position.distanceTo(other.mesh.position);
            if (distance < closestDistance) {
                closestDistance = distance;
            }
        }
        
        // Apply social distancing by reducing speed when too close
        if (closestDistance < this.socialDistance) {
            // Scale speed based on how close we are to others
            const slowFactor = Math.max(0.2, closestDistance / this.socialDistance);
            return stepSize * slowFactor;
        }
        
        return stepSize;
    }
}

// Static array for all agents to improve social distancing logic
Agent.allAgents = [];

export { Agent };