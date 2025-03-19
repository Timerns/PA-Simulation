import * as THREE from 'three';

export class Flood {
    constructor(scene, box) {
        this.scene = scene;
        this.box = box;
        this.floodLevel = 0;
        this.floodMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 });
        this.floodMesh = null;
    }

    update() {
        this.floodLevel += 0.1; // Simulate rising water level

        // Remove the previous flood mesh if it exists
        if (this.floodMesh) {
            this.scene.remove(this.floodMesh);
        }

        // Create a new flood mesh at the updated level
        const floodGeometry = new THREE.PlaneGeometry((this.box[2] - this.box[0]) * 111320, (this.box[3] - this.box[1]) * 111132);
        this.floodMesh = new THREE.Mesh(floodGeometry, this.floodMaterial);
        this.floodMesh.position.set(0, this.floodLevel, 0);
        this.floodMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.floodMesh);
    }
}