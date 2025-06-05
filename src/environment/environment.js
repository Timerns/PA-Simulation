import { Elevation } from "./elevation";
import { Flood } from "./flood";
import { PopulationDistribution } from "./population";
import { Roads } from "./roads";
import Terrain from "./terrain";

export class Environment {
  constructor() {
    this.bounds = null
    this.elevation = null
    this.terrain = new Terrain();
    this.roads = new Roads();
    this.populationDistribution = new PopulationDistribution();
    this.flood = null;
  }

  async load(boud, elevationFile) {
    this.bounds = boud;
    this.elevation = new Elevation(elevationFile);
    console.log("Loading environment...");
    await this.elevation.load();
    console.log("Elevation loaded");
    await this.terrain.load(this.elevation, this.bounds);
    console.log("Terrain loaded");
    await this.roads.load(this.elevation, this.bounds);
    console.log("Roads loaded");
    await this.populationDistribution.load(this.bounds, 100);
    console.log("Population loaded");
    this.flood = new Flood(this.terrain.geometry);
  }

  update(deltaTime, tickMultiplier) {
      this.flood.update(deltaTime, tickMultiplier);
  }

  draw(scene) {
    this.terrain.draw(scene);
    this.roads.draw(scene);
    this.flood.draw(scene);
  }

}