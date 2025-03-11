import * as THREE from 'three';

class Agent {
    constructor(node, targetNode) {
        this.currentNode = node;
        this.targetNode = targetNode;
        this.progress = 0;
        this.nextNode = null;
        
        // Randomize speed for each agent
        this.speed = 30 + Math.random() * 40; // Speed between 30-70
        
        // Add stuck detection properties
        this.stuckTime = 0;
        this.stuckThreshold = 3000; // 3 seconds of being stuck
        this.lastPosition = new THREE.Vector3().copy(node.value);
        this.movementThreshold = 2; // Minimum movement to not be considered stuck
        
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
    }

    getNodeKey(node) {
        return `${node.value.x},${node.value.y},${node.value.z}`;
    }

    update(graph, deltaTime, tickMultiplier) {
        // If we've reached the target, nothing to do
        if (this.currentNode === this.targetNode) return;

        // Check if we're stuck
        if (this.detectStuck(deltaTime)) {
            this.handleStuck(graph);
        }

        // If we don't have a next node yet, get it from the precomputed path
        if (!this.nextNode) {
            this.nextNode = graph.getNextNodeToTarget(this.currentNode, this.targetNode);
            if (!this.nextNode) return; // No path exists
            this.progress = 0;
        }

        // Calculate movement
        let edgeLength = this.currentNode.value.distanceTo(this.nextNode.value);
        let stepSize = this.speed * tickMultiplier * (deltaTime / 1000);

        // Apply social distancing - slow down if too close to other agents
        stepSize = this.applySocialDistancing(stepSize);

        this.progress = Math.min(this.progress + stepSize, edgeLength);
        let alpha = this.progress / edgeLength;
        
        // Store previous position for stuck detection
        this.lastPosition.copy(this.mesh.position);
        
        // Update position
        this.mesh.position.lerpVectors(this.currentNode.value, this.nextNode.value, alpha);

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
        // Get all nearby meshes to simulate social distancing
        const socialDistance = 15; // Minimum distance between agents
        let closestDistance = Infinity;
        
        // We need a reference to all other agents to check distances
        // This would typically be passed in from the main simulation
        // For now, we'll check scene objects (a bit inefficient)
        if (this.mesh.parent) {
            this.mesh.parent.children.forEach(child => {
                // Only check other agent meshes
                if (child !== this.mesh && child.type === 'Mesh' && 
                    child.geometry.type === 'SphereGeometry' && 
                    child.geometry.parameters.radius === 5) {
                    
                    const distance = this.mesh.position.distanceTo(child.position);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                    }
                }
            });
        }
        
        // Apply social distancing by reducing speed when too close
        if (closestDistance < socialDistance) {
            // Scale speed based on how close we are to others
            const slowFactor = Math.max(0.2, closestDistance / socialDistance);
            return stepSize * slowFactor;
        }
        
        return stepSize;
    }
}

// Add a static array for all agents to improve social distancing logic
Agent.allAgents = [];

export { Agent };