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
        if(agent.reachedTarget) {

          this.arrivedCount++;
        } else if(agent.isIdle) {
          this.idleCount++;
        }
      }
    }
    this.activeCount = this.agentCount - this.arrivedCount - this.idleCount;
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

    for (let i = 0; i < this.targets.length; i++) {
      const targetNode = this.targets[i];
      const targetMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      targetMesh.position.copy(targetNode.value);
      scene.add(targetMesh);
    }

  }









}
