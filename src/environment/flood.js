import * as THREE from 'three';

export class Flood {
    constructor(terrainGeometry) {
        this.terrainGeometry = terrainGeometry;
        this.vertices = terrainGeometry.attributes.position.array;
        this.widthNbSegments = terrainGeometry.parameters.widthSegments; 
        this.heightNbSegments = terrainGeometry.parameters.heightSegments;

        // Only water height is needed
        this.waterHeight = new Float32Array(this.vertices.length / 3).fill(0);
        
        // Simulation parameters
        this.gravity = 9.8;
        this.timeStep = 0.016;
        this.friction = 0.1;
        this.minWaterHeight = 0.5;
        this.offset = -0.05;
        this.evaporationRate = 0.00002;
        
        this.timeAccumulator = 0;
        this.maxStepsPerFrame = 10;
        
        // Visual representation
        this.floodMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1E90FF,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            // wireframe    : true
        });

        this.waterSources = []; 
    }

    addWaterSource(x, y, rate) {
        this.waterSources.push({ x, y, rate });
    }

    removeWaterSource(index) {
        this.waterSources.splice(index, 1);
    }

    getWaterSources() {
        return this.waterSources;
    }

    createFloodGeometry() {
        this.floodGeometry = this.terrainGeometry.clone();
        this.floodMesh = new THREE.Mesh(this.floodGeometry, this.floodMaterial);
        this.floodMesh.rotation.x = -Math.PI / 2;
        return this.floodMesh;
    }

    getCellIndex(x, y) {
        return y * (this.widthNbSegments + 1) + x;
    }

    getNeighbors(index) {
        const neighbors = [];
        const x = index % (this.widthNbSegments + 1);
        const y = Math.floor(index / (this.widthNbSegments + 1));

        if (x > 0) neighbors.push(index - 1);
        if (x < this.widthNbSegments) neighbors.push(index + 1);
        if (y > 0) neighbors.push(index - (this.widthNbSegments + 1));
        if (y < this.heightNbSegments) neighbors.push(index + (this.widthNbSegments + 1));

        return neighbors;
    }

    update(deltaTime, timeMultiplier = 1) {
        const adjustedDeltaTime = (deltaTime / 1000) * timeMultiplier;
        this.timeAccumulator += adjustedDeltaTime;
        
        let stepsTaken = 0;
        if (!this.waterSources) {
            console.log("No water sources defined.");
            this.updateVisuals();
            return;
        }
        this.waterSources.forEach(source => {
                this.addWaterAt(source.x, source.y, source.rate, deltaTime, timeMultiplier);
            });

        while (this.timeAccumulator >= this.timeStep && stepsTaken < this.maxStepsPerFrame) {
            this.updateWaterHeight();
            this.timeAccumulator -= this.timeStep;
            stepsTaken++;
        }
        
        if (stepsTaken === this.maxStepsPerFrame && this.timeAccumulator > 0) {
            const partialStep = this.timeAccumulator / this.timeStep;
            this.updateWaterHeight(partialStep);
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
                    const flow = scaledTimeStep * this.gravity * Math.sqrt(this.waterHeight[i]) * totalDiff * this.friction;
                    const actualFlow = Math.min(flow, this.waterHeight[i] / neighbors.length);
                    
                    newHeight[i] -= actualFlow;
                    newHeight[j] += actualFlow;
                    totalOutflow += actualFlow;
                }
            }
            
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
        
        for (let i = 0; i < this.waterHeight.length; i++) {
            this.waterHeight[i] = Math.max(newHeight[i] + this.waterHeight[i] - (this.evaporationRate * stepScale), 0);
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
            const neighbors = this.getNeighbors(index);
            const distributedAmount = amount * 0.5;
            const neighborAmount = (amount * 0.5) / neighbors.length;
            
            this.waterHeight[index] += distributedAmount * deltaTime * timeMultiplier;
            
            for (const neighbor of neighbors) {
                this.waterHeight[neighbor] += neighborAmount * deltaTime * timeMultiplier;
            }
        }
    }

    draw(scene) {
        this.createFloodGeometry();
        this.updateVisuals();
        scene.add(this.floodMesh);
    }
}