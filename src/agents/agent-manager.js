import * as THREE from 'three';
import { Agent } from './agent.js';
import { PopulationDistribution } from '../environment/population.js';
import { wgs84ToCoordsFromCenter } from '../utils/geoutils.js';
export class AgentManager {
  constructor() {
    this.agents = [];
    this.agentCount = 200;
    this.populationDistribution = new PopulationDistribution();
    this.targets = [];
    this.targetsCount = []

    this.activeCount = 0;
    this.arrivedCount = 0;
    this.idleCount = 0;

    this.walkingSpeed = [1, 3];
    this.drivingSpeed = [10, 20];
    this.reactionTime = [0, 300];

  }

  async load(environment) {
    this.environment = environment;
    await this.populationDistribution.load(this.environment.bounds, 200);

  }

  start() {
    this.activeCount = this.agentCount;

    // For testing purposes, we can add targets dynamically
    // if(this.targets.length === 0) {
    //   for (let i = 0; i < 5; i++) {
    //     this.addTarget(this.environment.roads.graph.getRandomNode());
    //     this.environment.roads.graph.computeShortestPath(this.targets);
    //   }
    // }


    for (let i = 0; i < this.agentCount; i++) {
      const coordinates = this.populationDistribution.generateRandomCoordinate();
      const coords = wgs84ToCoordsFromCenter(coordinates.lon, coordinates.lat, this.environment.bounds);
      const height = this.environment.elevation.getHeight(coordinates.lat, coordinates.lon);
      const position = new THREE.Vector3(coords[0], height, coords[1]);
      position.x += (Math.random() - 0.5) * 100;
      position.z += (Math.random() - 0.5) * 100;
      const agent = new Agent(position,
        this.targets,
        this.environment.roads.graph,
        this.walkingSpeed,
        this.drivingSpeed,
        this.reactionTime
      );
      this.agents.push(agent);
    }

    this.environment.roads.graph.computeShortestPath(this.targets);
  }

  update(deltaTime, timeMultiplier) {
    this.idleCount = 0;

    for (let i = 0; i < this.agentCount; i++) {

      const agent = this.agents[i];
      if (agent.active) {
        agent.update(this.environment.roads.graph, deltaTime, timeMultiplier, this.agents, this.environment.flood);
        if (agent.reachedTarget) {
          this.arrivedCount++;
          for (let j = 0; j < this.targets.length; j++) {
            const targetNode = this.targets[j];
            if (targetNode.value.equals(agent.segmentEnd)) {
              this.targetsCount[j] = (this.targetsCount[j] || 0) + 1;
            }
          }
        } else if (agent.isIdle) {
          this.idleCount++;
        }
      }
    }
    this.activeCount = this.agentCount - this.arrivedCount - this.idleCount;
    this.updateTargetSprites();
  }

  addTarget(target) {
    this.targets.push(target);
  }

  removeTarget(target) {
    const index = this.targets.indexOf(target);
    if (index > -1) {
      this.targets.splice(index, 1);
    }
  }

  draw(scene) {
    for (let i = 0; i < this.agentCount; i++) {
      const agent = this.agents[i];
      if (agent.active) {
        scene.add(agent.getMesh());
      }
    }

    this.targetMeshes = [];
    this.targetSprites = [];

    for (let i = 0; i < this.targets.length; i++) {
      const targetNode = this.targets[i];

      // Create target sphere
      const targetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(10, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      targetMesh.position.copy(targetNode.value);
      scene.add(targetMesh);
      this.targetMeshes.push(targetMesh);

      // Create text sprite
      const sprite = this.createTextSprite(`0`);
      sprite.position.copy(targetNode.value);
      sprite.position.y += 25; // Position above the target
      scene.add(sprite);
      this.targetSprites.push(sprite);
    }

  }


  createTextSprite(message) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const context = canvas.getContext('2d');

    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.0)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.font = 'Bold 500px Arial';
    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(50, 25, 1);
    return sprite;
  }

  updateTargetSprites() {
    if (!this.targetSprites) return;

    for (let i = 0; i < this.targetSprites.length; i++) {
      const sprite = this.targetSprites[i];
      const count = this.targetsCount[i] || 0;

      // Update sprite texture
      const canvas = sprite.material.map.image;
      const context = canvas.getContext('2d');

      // Clear and redraw
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'rgba(0, 0, 0, 0.0)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = 'Bold 500px Arial';
      context.fillStyle = '#000000';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(count.toString(), canvas.width / 2, canvas.height / 2);

      // Update texture
      sprite.material.map.needsUpdate = true;
    }
  }


}
