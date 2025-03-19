import * as THREE from 'three';

export class Agent {
    constructor(node, target) {
        // Visual representation
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(3),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        this.mesh.position.copy(node.value);
        
        // Navigation properties
        this.currentNode = node;
        this.targetNode = target;
        this.nextNode = null;
        this.path = []; // Store full path to target
        this.pathIndex = 0;
        
        // Movement properties
        this.position = node.value.clone();
        this.maxSpeed = 10 + Math.random() * 10; // Random speed variation
        this.currentSpeed = this.maxSpeed; // Current speed of the agent
        
        // Progress tracking along current road segment
        this.segmentStart = null;
        this.segmentEnd = null;
        this.segmentProgress = 0;
        this.segmentLength = 0;
        
        // Status properties
        this.stuckTime = 0;
        this.stuckThreshold = 2000; // milliseconds before considering stuck
        this.isStuck = false;
        this.reachedTarget = false;
        this.active = true; // Flag to track if agent should be updated
    }
    
    // Calculate path to target once
    calculatePath(graph) {
        if (this.path.length === 0) {
            this.path = graph.getPathToTarget(this.currentNode, this.targetNode);
            this.pathIndex = 0;
            
            // If path exists, set first target after current node
            if (this.path.length > 1) {
                this.nextNode = this.path[1];
                // Initialize first road segment
                this.setupNextSegment();
            } else {
                // If no path or we're already at target
                this.nextNode = this.targetNode;
                this.reachedTarget = true;
            }
        }
        
        return this.path.length > 0;
    }
    
    // Setup the next road segment to travel on
    setupNextSegment() {
        if (!this.nextNode) return;
        
        this.segmentStart = this.currentNode.value.clone();
        this.segmentEnd = this.nextNode.value.clone();
        this.segmentLength = this.segmentStart.distanceTo(this.segmentEnd);
        this.segmentProgress = 0;
    }
    
    // Update agent position along the road network
    update(graph, deltaTime, timeMultiplier, agents) {
        // Skip update if agent is inactive
        if (!this.active) return false;
        
        // Calculate time step in seconds, with multiplier
        const timeStep = (deltaTime / 1000) * timeMultiplier;
        
        // Ensure we have a path
        if (!this.calculatePath(graph)) return false;
        
        // Check if we've reached the target
        if (this.reachedTarget) {
            this.active = false;
            this.mesh.visible = false;
            return true; // Signal that agent reached target
        }
        
        // Check if agent is stuck
        this.checkIfStuck(deltaTime);
        
        // Only move if not stuck
        if (!this.isStuck) {
            // Check for collisions with other agents
            this.checkCollisions(agents);
            
            // Move along the current road segment
            this.moveAlongSegment(timeStep);
            
            // Update mesh position
            this.mesh.position.copy(this.position);
            
            // Check if reached next node
            this.checkNodeProgress();
        }
        
        return false; // Not reached target yet
    }
    
    // Check for collisions with other agents
    checkCollisions(agents) {
        const safeDistance = 10; // Minimum safe distance between agents
        
        for (const other of agents) {
            if (other === this || !other.active || other.currentNode !== this.currentNode || other.nextNode !== this.nextNode) {
                continue;
            }
            
            // Calculate the distance between this agent and the other agent
            const distance = this.position.distanceTo(other.position);
            
            // If the other agent is ahead and too close, slow down or stop
            if (other.segmentProgress > this.segmentProgress && distance < safeDistance) {
                this.currentSpeed = Math.max(0, this.currentSpeed - 0.1); // Slow down
                return;
            }
        }
        
        // Gradually restore speed if no obstacles
        if (this.currentSpeed < this.maxSpeed) {
            this.currentSpeed = Math.min(this.maxSpeed, this.currentSpeed + 0.1);
        }
    }
    
    // Move strictly along the current road segment
    moveAlongSegment(timeStep) {
        if (!this.segmentStart || !this.segmentEnd) return;
        
        // Calculate how much to move along this segment based on current speed
        const stepDistance = this.currentSpeed * timeStep;
        
        // Convert to progress percentage along segment
        const progressIncrement = stepDistance / this.segmentLength;
        
        // Update progress
        this.segmentProgress = Math.min(this.segmentProgress + progressIncrement, 1);
        
        // Calculate new position by linear interpolation along segment
        this.position.lerpVectors(this.segmentStart, this.segmentEnd, this.segmentProgress);
    }
    
    // Check if we've reached the next node in the path
    checkNodeProgress() {
        if (!this.nextNode) return;
        
        // If we've reached the end of the segment
        if (this.segmentProgress >= 1) {
            // Update current node
            this.currentNode = this.nextNode;
            this.pathIndex++;
            
            // Check if we reached the target
            if (this.currentNode === this.targetNode) {
                this.reachedTarget = true;
                return;
            }
            
            // Get next node in path
            if (this.pathIndex < this.path.length) {
                this.nextNode = this.path[this.pathIndex];
                // Setup next segment
                this.setupNextSegment();
            } else {
                // We've reached the end of our path
                this.nextNode = null;
            }
        }
    }
    
    // Check if agent is stuck (not making progress)
    checkIfStuck(deltaTime) {
        // Consider stuck if there's no valid path or no next node
        if (this.path.length === 0 || !this.nextNode) {
            this.stuckTime += deltaTime;
            
            if (this.stuckTime > this.stuckThreshold) {
                this.isStuck = true;
            }
        } else {
            // Not stuck if we have a valid path and next node
            this.stuckTime = 0;
            this.isStuck = false;
        }
    }
    
    // Try to unstuck agent by recalculating path
    attemptUnstuck(graph) {
        if (!this.isStuck) return;
        
        // Try to recalculate path
        this.path = [];
        this.calculatePath(graph);
        
        // Reset stuck timer
        this.stuckTime = 0;
        this.isStuck = false;
    }
}