import { Elevation } from "./elevation";
import { Flood } from "./flood";
import { PopulationDistribution } from "./population";
import { Roads } from "./roads";
import Terrain from "./terrain";

export class Environment {
  constructor() {
    this.bounds = [6.58,46.506415,6.643553,46.531823];
    this.elevation = new Elevation("../assets/2025-02-20-00_00_2025-02-20-23_59_DEM_COPERNICUS_30_DEM_(Raw).tiff");
    this.terrain = new Terrain();
    this.roads = new Roads();
    this.populationDistribution = new PopulationDistribution();
    this.flood = null;
  }

  async load() {
    await this.elevation.load();
    await this.terrain.load(this.elevation, this.bounds);
    await this.roads.load(this.elevation, this.bounds);
    await this.populationDistribution.load(this.bounds, 100);
  }

  start() {
    this.flood = new Flood(this.terrain.geometry);
  }

  update(deltaTime, tickMultiplier) {
      this.flood.addWaterAt(75, 100, 0.05, deltaTime, tickMultiplier);
      this.flood.addWaterAt(155, 85, 0.05, deltaTime, tickMultiplier);
      this.flood.update(deltaTime, tickMultiplier);
  }

}