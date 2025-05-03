/**
 * Load building data from OpenStreetMap within a bounding box
 * @param {Array<number>} bbox - [minLon, minLat, maxLon, maxLat]
 * @returns {Promise<Array>} Array of building features
 */
async function loadBuildingsFromOSM(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const overpassUrl = "https://overpass-api.de/api/interpreter";
  
  const query = `
      [out:json];
      (
          way[building](${minLat},${minLon},${maxLat},${maxLon});
          relation[building](${minLat},${minLon},${maxLat},${maxLon});
      );
      out body;
      >;
      out skel qt;
  `;

  try {
      const response = await fetch(`${overpassUrl}?data=${encodeURIComponent(query)}`, {
          method: 'GET',
          headers: {
              'Accept': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const elements = data.elements;
      const buildings = elements.filter(el => el.type === 'way' || el.type === 'relation');
      
      // For simplicity, we'll just use the center points of buildings
      const buildingCenters = buildings.map(building => {
          if (building.center) {
              return { lat: building.center.lat, lon: building.center.lon };
          }
          
          // For ways without center, calculate centroid (simplified)
          if (building.nodes && building.nodes.length > 0) {
              const nodeCoords = building.nodes.map(nodeId => {
                  const node = elements.find(el => el.id === nodeId);
                  return node ? { lat: node.lat, lon: node.lon } : null;
              }).filter(Boolean);
              
              if (nodeCoords.length > 0) {
                  const avgLat = nodeCoords.reduce((sum, coord) => sum + coord.lat, 0) / nodeCoords.length;
                  const avgLon = nodeCoords.reduce((sum, coord) => sum + coord.lon, 0) / nodeCoords.length;
                  return { lat: avgLat, lon: avgLon };
              }
          }
          
          return null;
      }).filter(Boolean);
      
      return buildingCenters;
  } catch (error) {
      console.error("Error fetching OSM data:", error);
      return [];
  }
}

/**
* Create a probability distribution based on building density
* @param {Array} buildings - Array of {lat, lon} points
* @param {Array<number>} bbox - [minLon, minLat, maxLon, maxLat]
* @param {number} gridSize - Number of divisions for the grid
* @returns {Object} Distribution data
*/
function createBuildingDistribution(buildings, bbox, gridSize = 20) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
  
  const lonStep = (maxLon - minLon) / gridSize;
  const latStep = (maxLat - minLat) / gridSize;
  
  // Count buildings in each grid cell
  buildings.forEach(({lat, lon}) => {
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
  
  return {
      grid,
      flatGrid,
      totalBuildings: total,
      gridSize,
      bbox,
      lonStep,
      latStep
  };
}

/**
* Generate random coordinates based on building distribution
* @param {Object} distribution - From createBuildingDistribution
* @returns {Object} {lat, lon} coordinates
*/
function generateRandomCoordinate(distribution) {
  if (distribution.totalBuildings === 0) {
      // If no buildings, return random point in bbox
      const [minLon, minLat, maxLon, maxLat] = distribution.bbox;
      return {
          lat: minLat + Math.random() * (maxLat - minLat),
          lon: minLon + Math.random() * (maxLon - minLon)
      };
  }
  
  // Select a grid cell weighted by building count
  const randomValue = Math.random() * distribution.flatGrid[distribution.flatGrid.length - 1].cumulative;
  const cell = distribution.flatGrid.find(cell => cell.cumulative >= randomValue) || distribution.flatGrid[0];
  
  // Generate random point within the selected cell
  return {
      lat: cell.minLat + Math.random() * (cell.maxLat - cell.minLat),
      lon: cell.minLon + Math.random() * (cell.maxLon - cell.minLon)
  };
}

export { loadBuildingsFromOSM, createBuildingDistribution, generateRandomCoordinate };