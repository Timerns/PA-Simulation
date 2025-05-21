import { Elevation } from "./elevation";
import { Flood } from "./flood";
import { PopulationDistribution } from "./population";
import { Roads } from "./roads";
import Terrain from "./terrain";

export class Environment {
  constructor() {
    this.bounds = [6.58,46.506415,6.643553,46.531823];
    // this.bounds = [85.284634,27.671671,85.365486,27.720460]
    // this.bounds = [85.284634,27.671671,85.325486,27.690460]
    this.elevation = new Elevation("../assets/lausanne2.tiff");
    // this.elevation = new Elevation("../assets/kathmandu.tiff");
    this.terrain = new Terrain();
    this.roads = new Roads();
    this.populationDistribution = new PopulationDistribution();
    this.flood = null;
  }

  async load() {
    console.log("Loading environment...");
    await this.elevation.load();
    console.log("Elevation loaded");
    await this.terrain.load(this.elevation, this.bounds);
    console.log("Terrain loaded");
    await this.roads.load(this.elevation, this.bounds);
    console.log("Roads loaded");
    await this.populationDistribution.load(this.bounds, 100);
    console.log("Population loaded");
  }

  start() {
    this.flood = new Flood(this.terrain.geometry);
  }

  update(deltaTime, tickMultiplier) {
      this.flood.addWaterAt(75, 100, 0.002, deltaTime, tickMultiplier);
      this.flood.addWaterAt(155, 85, 0.002, deltaTime, tickMultiplier);
      this.flood.update(deltaTime, tickMultiplier);
  }

  draw(scene) {
    this.terrain.draw(scene);
    this.roads.draw(scene);
    this.flood.draw(scene);
  }

}