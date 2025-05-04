import * as THREE from 'three';

export class Flood {
    constructor(terrainGeometry) {
        this.terrainGeometry = terrainGeometry;
        this.vertices = terrainGeometry.attributes.position.array;
        this.widthSegments = terrainGeometry.parameters.widthSegments; 
        this.heightSegments = terrainGeometry.parameters.heightSegments;
        
        // Water state arrays
        this.waterHeight = new Float32Array(this.vertices.length / 3).fill(0);
        this.waterVelocityX = new Float32Array(this.vertices.length / 3).fill(0);
        this.waterVelocityY = new Float32Array(this.vertices.length / 3).fill(0);
        
        // Simulation parameters
        this.gravity = 9.8;
        this.timeStep = 0.016; // Fixed simulation timestep
        this.friction = 0.1;
        this.minWaterHeight = 0.02;
        this.offset = -0.05;
        this.evaporationRate = 0.0002;
        
        // Time accumulator for fixed timestep
        this.timeAccumulator = 0;
        this.maxStepsPerFrame = 10; // Limit steps per frame to prevent lag
        
        // Visual representation
        this.floodMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1E90FF,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            // wireframe: true
        });
        
    }

    createFloodGeometry() {
        this.floodGeometry = this.terrainGeometry.clone();
        this.floodMesh = new THREE.Mesh(this.floodGeometry, this.floodMaterial);
        this.floodMesh.rotation.x = -Math.PI / 2;
        return this.floodMesh;
    }

    getCellIndex(x, y) {
        return y * (this.widthSegments + 1) + x;
    }

    getNeighbors(index) {
        const neighbors = [];
        const x = index % (this.widthSegments + 1);
        const y = Math.floor(index / (this.widthSegments + 1));

        if (x > 0) neighbors.push(index - 1); // Left
        if (x < this.widthSegments) neighbors.push(index + 1); // Right
        if (y > 0) neighbors.push(index - (this.widthSegments + 1)); // Bottom
        if (y < this.heightSegments) neighbors.push(index + (this.widthSegments + 1)); // Top

        return neighbors;
    }

    update(deltaTime, timeMultiplier = 1) {
        const adjustedDeltaTime = (deltaTime / 1000) * timeMultiplier;
        this.timeAccumulator += adjustedDeltaTime;
        
        // Limit the number of steps per frame to prevent lag
        let stepsTaken = 0;
        while (this.timeAccumulator >= this.timeStep && stepsTaken < this.maxStepsPerFrame) {
            this.updateWaterHeight();
            this.updateWaterVelocity();
            this.applyBoundaryConditions();
            this.timeAccumulator -= this.timeStep;
            stepsTaken++;
        }
        
        // If we have remaining time but hit our step limit, apply partial update
        if (stepsTaken === this.maxStepsPerFrame && this.timeAccumulator > 0) {
            const partialStep = this.timeAccumulator / this.timeStep;
            this.updateWaterHeight(partialStep);
            this.updateWaterVelocity(partialStep);
            this.applyBoundaryConditions();
            this.timeAccumulator = 0;
        }
        
        this.updateVisuals();
    }

    updateWaterHeight(stepScale = 1) {
        const newHeight = new Float32Array(this.waterHeight.length);
        const scaledTimeStep = this.timeStep * stepScale;
        
        for (let i = 0; i < this.waterHeight.length; i++) {
            if (this.waterHeight[i] <= this.minWaterHeight) continue;
            
            const neighbors = this.getNeighbors(i);
            let totalOutflow = 0;
            
            for (const j of neighbors) {
                const terrainDiff = this.vertices[i * 3 + 2] - this.vertices[j * 3 + 2];
                const waterDiff = this.waterHeight[i] - this.waterHeight[j];
                const totalDiff = terrainDiff + waterDiff;
                
                if (totalDiff > 0) {
                    // Calculate flow based on water height and gradient
                    const flow = scaledTimeStep * this.gravity * Math.sqrt(this.waterHeight[i]) * totalDiff * this.friction;
                    const actualFlow = Math.min(flow, this.waterHeight[i] / neighbors.length);
                    
                    newHeight[i] -= actualFlow;
                    newHeight[j] += actualFlow;
                    totalOutflow += actualFlow;
                }
            }
            
            // Limit outflow to prevent negative water heights
            if (totalOutflow > this.waterHeight[i]) {
                const correctionFactor = this.waterHeight[i] / totalOutflow;
                for (const j of neighbors) {
                    if (newHeight[j] > 0) {
                        newHeight[j] *= correctionFactor;
                    }
                }
                newHeight[i] = 0;
            }
        }
        
        // Apply changes with evaporation
        for (let i = 0; i < this.waterHeight.length; i++) {
            this.waterHeight[i] = Math.max(newHeight[i] + this.waterHeight[i] - (this.evaporationRate * stepScale), 0);
        }
    }

    updateWaterVelocity(stepScale = 1) {
        const scaledTimeStep = this.timeStep * stepScale;
        
        for (let i = 0; i < this.waterHeight.length; i++) {
            if (this.waterHeight[i] <= this.minWaterHeight) {
                this.waterVelocityX[i] = 0;
                this.waterVelocityY[i] = 0;
                continue;
            }
            
            const x = i % (this.widthSegments + 1);
            const y = Math.floor(i / (this.widthSegments + 1));
            
            let gradX = 0, gradY = 0;
            let neighborCount = 0;
            
            // Calculate gradients more efficiently
            if (x > 0 && x < this.widthSegments) {
                const left = this.getCellIndex(x-1, y);
                const right = this.getCellIndex(x+1, y);
                gradX = (this.vertices[left * 3 + 2] + this.waterHeight[left]) - 
                        (this.vertices[right * 3 + 2] + this.waterHeight[right]);
                neighborCount += 2;
            }
            
            if (y > 0 && y < this.heightSegments) {
                const bottom = this.getCellIndex(x, y-1);
                const top = this.getCellIndex(x, y+1);
                gradY = (this.vertices[bottom * 3 + 2] + this.waterHeight[bottom]) - 
                        (this.vertices[top * 3 + 2] + this.waterHeight[top]);
                neighborCount += 2;
            }
            
            // Normalize gradient by neighbor count
            if (neighborCount > 0) {
                gradX /= neighborCount;
                gradY /= neighborCount;
            }
            
            // Update velocity with damping based on water height
            const damping = 0.9 - (0.2 * Math.min(this.waterHeight[i], 1));
            this.waterVelocityX[i] = this.waterVelocityX[i] * damping - gradX * scaledTimeStep * this.gravity;
            this.waterVelocityY[i] = this.waterVelocityY[i] * damping - gradY * scaledTimeStep * this.gravity;
        }
    }

    applyBoundaryConditions() {
        // Zero out velocity at boundaries
        for (let x = 0; x <= this.widthSegments; x++) {
            const top = this.getCellIndex(x, 0);
            const bottom = this.getCellIndex(x, this.heightSegments);
            this.waterVelocityX[top] = 0;
            this.waterVelocityY[top] = 0;
            this.waterVelocityX[bottom] = 0;
            this.waterVelocityY[bottom] = 0;
        }
        
        for (let y = 0; y <= this.heightSegments; y++) {
            const left = this.getCellIndex(0, y);
            const right = this.getCellIndex(this.widthSegments, y);
            this.waterVelocityX[left] = 0;
            this.waterVelocityY[left] = 0;
            this.waterVelocityX[right] = 0;
            this.waterVelocityY[right] = 0;
        }
    }

    updateVisuals() {
        const positions = this.floodGeometry.attributes.position.array;
        for (let i = 0; i < this.waterHeight.length; i++) {
            positions[i * 3 + 2] = this.vertices[i * 3 + 2] + this.waterHeight[i] + this.offset;
        }
        this.floodGeometry.attributes.position.needsUpdate = true;
        this.floodGeometry.computeVertexNormals();
    }

    addWaterAt(x, y, amount, deltaTime, timeMultiplier = 1) {
        const index = this.getCellIndex(x, y);
        if (index >= 0 && index < this.waterHeight.length) {
            // Distribute water to neighboring cells for smoother appearance
            const neighbors = this.getNeighbors(index);
            const distributedAmount = amount * 0.5; // Keep 50% at center
            const neighborAmount = (amount * 0.5) / neighbors.length;
            
            this.waterHeight[index] += distributedAmount * deltaTime * timeMultiplier;
            
            for (const neighbor of neighbors) {
                this.waterHeight[neighbor] += neighborAmount * deltaTime * timeMultiplier;
            }
        }
    }
}