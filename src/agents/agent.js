import * as THREE from 'three';

export class Agent {
  constructor(position, targets, graph, walkSpeed = [1, 3], driveSpeed = [10, 20], reactionTime = [0, 300]) {
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

    this.reactionTime = Number(reactionTime[0]) + Number(Math.random() * (reactionTime[1] - reactionTime[0]));

    // Movement properties
    this.inFlood = false;
    this.position = position.clone();
    this.maxSpeed = driveSpeed[0] + Math.random() * (driveSpeed[1] - driveSpeed[0]);
    this.walkingSpeed = walkSpeed[0] + Math.random() * (walkSpeed[1] - walkSpeed[0]);
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
    this.isIdle = true
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

  update(graph, deltaTime, timeMultiplier, agents, flood) {
    if (!this.active) return false;

    const timeStep = (deltaTime / 1000) * timeMultiplier;

    if (this.reactionTime > 0) {
      this.reactionTime -= timeStep;
      // console.log(`Agent reaction time: ${this.reactionTime.toFixed(2)}s`);
      return;
    }
    this.isIdle = false;

    if (this.reachedTarget) {
      this.active = false;
      this.mesh.visible = false;
      return;
    }

    // Check flood status
    if (!this.inFlood) {
      this.inFlood = this.isInFlood(flood);
    }

    if (this.inFlood) {
      // Flooded behavior
      this.sphere.material.color.set(0x800080); // Purple color
      this.currentSpeed = this.walkingSpeed; // Always walking speed
      this.isDriving = false;

      // Move along the path (roads) without checking collisions
      this.moveAlongSegment(timeStep);
    } else {
      // Normal behavior
      this.sphere.material.color.set(0xff0000); // Red color
      this.currentSpeed = this.isDriving ? this.maxSpeed : this.walkingSpeed;

      // Only check collisions when not flooded
      if (!this.inFlood) {
        this.checkCollisions(agents);
      }
      this.moveAlongSegment(timeStep);
    }

    this.mesh.position.copy(this.position);
    this.checkNodeProgress(graph);

    return;
  }

  isInFlood(flood) {
    if (!flood || !flood.waterHeight) return false;

    // Get the agent's position in flood grid coordinates
    const x = Math.round(
      (this.position.x + flood.terrainGeometry.parameters.width / 2) /
      (flood.terrainGeometry.parameters.width / flood.widthNbSegments)
    );
    const y = Math.round(
      (this.position.z + flood.terrainGeometry.parameters.height / 2) /
      (flood.terrainGeometry.parameters.height / flood.heightNbSegments)
    );

    const index = y * (flood.widthNbSegments + 1) + x;
    if (index >= 0 && index < flood.waterHeight.length) {
      return flood.waterHeight[index] > flood.minWaterHeight;
    }
    return false;
  }

  updateArrowDirection() {
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
          this.currentSpeed * slowdownFactor + 0.1
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
          this.active = false;
          return;
        }
      }

      const nodekey = graph.getNodeKey(this.segmentEnd.x, this.segmentEnd.y, this.segmentEnd.z);
      const nextNode = graph.getNodeByKey(nodekey);
      this.setupNextSegment(graph.computedShortestPath.get(nextNode));
      this.isDriving = true;
    }
  }

  getMesh() {
    return this.mesh;
  }
}