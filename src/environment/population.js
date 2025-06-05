export class PopulationDistribution {
  constructor() {
    this.buildings = [];
    this.distribution = null;
  }

  async load(bounds, gridSize) {
    await this.fetchBuildings(bounds);
    this.generateDistribution(bounds, gridSize);
  }

  async fetchBuildings(bounds) {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const overpassUrl = "https://overpass-api.de/api/interpreter";
  
    const query = `
      [out:json];
      (
        way[building][building!~"no|shed|roof|garage|kiosk|toilet"](${minLat},${minLon},${maxLat},${maxLon});
        relation[building][building!~"no|shed|roof|garage|kiosk|toilet"](${minLat},${minLon},${maxLat},${maxLon});
      );
      out center;
      >;
      out skel qt;
    `;
  
    try {
      const response = await fetch(`${overpassUrl}?data=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
  
      const data = await response.json();
      this.buildings = data.elements
        .filter(el => el.type === 'way' || el.type === 'relation')
        .map(building => {
          if (building.center) return { lat: building.center.lat, lon: building.center.lon };
          return null;
        })
        .filter(Boolean);
  
      return this.buildings;
    } catch (error) {
      console.error("Error fetching buildings:", error);
      this.buildings = [];
      return [];
    }
  }

  generateDistribution(bounds, gridSize) {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));

    const lonStep = (maxLon - minLon) / gridSize;
    const latStep = (maxLat - minLat) / gridSize;

    // Count buildings in each grid cell
    this.buildings.forEach(({ lat, lon }) => {
      const x = Math.floor((lon - minLon) / lonStep);
      const y = Math.floor((lat - minLat) / latStep);

      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        grid[y][x]++;
      }
    });

    // Create cumulative distribution
    const flatGrid = [];
    let total = 0;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        total += grid[y][x];
        flatGrid.push({
          x, y,
          minLon: minLon + x * lonStep,
          maxLon: minLon + (x + 1) * lonStep,
          minLat: minLat + y * latStep,
          maxLat: minLat + (y + 1) * latStep,
          count: grid[y][x],
          cumulative: total
        });
      }
    }

    this.distribution = {
      flatGrid,
      totalBuildings: total,
      bounds,
    }
  }

  generateRandomCoordinate() {
    if (!this.distribution || this.distribution.totalBuildings === 0) {
      // If no buildings, return random point in bbox
      const [minLon, minLat, maxLon, maxLat] = this.distribution?.bounds || [0, 0, 1, 1];
      return {
        lat: minLat + Math.random() * (maxLat - minLat),
        lon: minLon + Math.random() * (maxLon - minLon)
      };
    }
    
    // Select a grid cell weighted by building count
    const randomValue = Math.random() * this.distribution.flatGrid[this.distribution.flatGrid.length - 1].cumulative;
    const cell = this.distribution.flatGrid.find(cell => cell.cumulative >= randomValue) || this.distribution.flatGrid[0];
    
    // Generate random point within the selected cell
    return {
      lat: cell.minLat + Math.random() * (cell.maxLat - cell.minLat),
      lon: cell.minLon + Math.random() * (cell.maxLon - cell.minLon)
    };
  }
}