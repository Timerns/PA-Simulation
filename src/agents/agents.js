import * as THREE from 'three';

export class Agent {
    constructor(position, targets, graph) {
        // Main sphere body
        this.sphere = new THREE.Mesh(
            new THREE.SphereGeometry(3),
            new THREE.MeshBasicMaterial({ 
                color: 0xff0000, 
                transparent: true,
                opacity: 0.5,
            })
        );

        // Direction arrow (cone)
        this.arrow = new THREE.Mesh(
            new THREE.ConeGeometry(1.5, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        this.arrow.position.z = 5; // Position in front of the sphere
        this.arrow.rotation.x = Math.PI / 2; // Rotate to point forward

        // Group to contain both elements
        this.mesh = new THREE.Group();
        this.mesh.add(this.sphere);
        this.mesh.add(this.arrow);
        this.mesh.position.copy(position);

        // Movement properties
        this.position = position.clone();
        this.maxSpeed = 10 + Math.random() * 10;
        this.walkingSpeed = 2;
        this.currentSpeed = this.walkingSpeed;
        this.isDriving = false;

        // Progress tracking
        this.targets = targets;
        this.segmentStart = position.clone();
        this.segmentEnd = graph.nearestNode(position).value.clone();
        this.movementVector = this.segmentEnd.clone().sub(this.segmentStart).normalize();
        this.segmentProgress = 0;
        this.segmentLength = this.segmentStart.distanceTo(this.segmentEnd);

        this.bockedAgent = null;

        this.updateArrowDirection();

        // Status properties
        this.reachedTarget = false;
        this.active = true;
    }

    setupNextSegment(nextNode) {
        if (!nextNode) { return; }
        
        this.segmentStart = this.segmentEnd.clone();
        this.segmentEnd = nextNode.value.clone();
        this.segmentLength = this.segmentStart.distanceTo(this.segmentEnd);
        this.movementVector = this.segmentEnd.clone().sub(this.segmentStart).normalize();
        this.segmentProgress = 0;

        // Update arrow direction
        this.updateArrowDirection();
    }

    update(graph, deltaTime, timeMultiplier, agents) {
        if (!this.active) return false;

        const timeStep = (deltaTime / 1000) * timeMultiplier;

        if (this.reachedTarget) {
            this.active = false;
            this.mesh.visible = false;
            return true;
        }

        this.checkCollisions(agents);
        this.moveAlongSegment(timeStep);
        this.mesh.position.copy(this.position);
        this.checkNodeProgress(graph);

        return false;
    }

    updateArrowDirection() {
        // Calculate the angle between the movement vector and the world's forward vector (0,0,1)
        const angle = Math.atan2(this.movementVector.x, this.movementVector.z);
        this.mesh.rotation.y = angle;
    }

    checkCollisions(agents) {
        const safeDistance = 15;
        const stopDistance = 10;
        const angleThreshold = 0.996; // ~11.5 degree cone in front
    
        this.currentSpeed = this.isDriving ? this.maxSpeed : this.walkingSpeed;
        this.sphere.material.color.set(0xff0000); // Default color (red)
        this.bockedAgent = null;
    

        const agentsInFront = agents.filter(other => {
            if (other === this || !other.active || !other.isDriving) return false;
            
            const distance = this.position.distanceTo(other.position);
            if (distance >= safeDistance * 2) return false;
    

            const directionToOther = new THREE.Vector3()
                .subVectors(other.position, this.position)
                .normalize();
            const dotProduct = this.movementVector.dot(directionToOther);
            return dotProduct >= angleThreshold;
        });
    

        agentsInFront.sort((a, b) => 
            this.position.distanceTo(a.position) - this.position.distanceTo(b.position)
        );
    

        for (const other of agentsInFront) {
            const distance = this.position.distanceTo(other.position);
    
            if (distance < stopDistance) {
                this.sphere.material.color.set(0x00ff00); // Change color to green

                this.currentSpeed = 0;
                this.bockedAgent = other;

                
                if (other.bockedAgent === this) {
                    this.sphere.material.color.set(0x0000ff); // Change color to blue
                    if (this.segmentProgress >= other.segmentProgress) {
                        this.currentSpeed = this.isDriving ? this.maxSpeed : this.walkingSpeed;
                        this.bockedAgent = null;
                    }
                }
                break; 
            } 
            else if (distance < safeDistance) {
                this.sphere.material.color.set(0xffff00); // Change color to yellow
                const slowdownFactor = (distance - stopDistance) / (safeDistance - stopDistance);
                this.currentSpeed = Math.min(
                    this.currentSpeed, 
                    this.walkingSpeed * slowdownFactor + 0.1
                );
                this.bockedAgent = other;

                break;
            }
        }
    }

    moveAlongSegment(timeStep) {
        if (!this.segmentStart || !this.segmentEnd) return;

        const distanceToMove = this.currentSpeed * timeStep;
        this.segmentProgress += distanceToMove / this.segmentLength;

        this.position.lerpVectors(this.segmentStart, this.segmentEnd, this.segmentProgress);

        if (this.position.distanceTo(this.segmentStart) >= this.segmentLength) {
            this.position.copy(this.segmentEnd);
            this.segmentProgress = 1;
        }

        this.mesh.position.copy(this.position);
    }

    checkNodeProgress(graph) {
        if (this.segmentProgress >= 1) {

            for (const target of this.targets) {
                if (this.segmentEnd.equals(target.value)) {
                    this.reachedTarget = true;
                    return;
                }
            }

            const nodekey = graph.getNodeKey(this.segmentEnd.x, this.segmentEnd.y, this.segmentEnd.z);
            const nextNode = graph.getNodeByKey(nodekey);
            this.setupNextSegment(graph.computedShortestPath.get(nextNode));
            this.isDriving = true;
        }
    }
}