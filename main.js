import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// const box = [7.483685,46.295580,7.498105,46.302118];
const box = [6.605444, 46.506415, 6.643553, 46.525028];

/* --- Setup Three.js Scene --- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(0, 800, 800);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 100;
controls.maxDistance = 3000;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(100, 200, 100);
scene.add(directionalLight);

// add base plane
const planeGeometry = new THREE.PlaneGeometry(800, 600);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xCCDBDC, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = Math.PI / 2;
scene.add(plane);


/* --- Mapping Function --- */
function mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

const minLon = box[0], minLat = box[1], maxLon = box[2], maxLat = box[3];
const outMinX = -400, outMaxX = 400;
const outMinZ = -300, outMaxZ = 300;

/* --- Global Arrays --- */
let roads = [];
let agents = [];
let roadLines = [];
const numAgents = 50;
let graph = {};




/* --- Animation Loop --- */
function animate() {
    requestAnimationFrame(animate);
    agents.forEach(agent => agent.update());
    controls.update();
    renderer.render(scene, camera);
}

/* --- Fetch Elevation Data --- */
import { fromUrl } from "geotiff";

// URL of the Copernicus DEM tile (Modify this based on your location)
const DEM_FILENAME = "./assets/2025-02-20-00_00_2025-02-20-23_59_DEM_COPERNICUS_30_DEM_(Raw).tiff";
let demImage, demRasters, lonRes, latRes, width, height, originX, originY;
let minLonDEM, minLatDEM, maxLonDEM, maxLatDEM;
let minHeight
// Load the DEM file
async function loadDEM() {
  console.log("Loading DEM...");
  const tiff = await fromUrl(DEM_FILENAME);
  demImage = await tiff.getImage();
  demRasters = await demImage.readRasters();

  // Extract metadata
  [lonRes, latRes] = demImage.getResolution();
  width = demImage.getWidth();
  height = demImage.getHeight();
  [originX, originY] = demImage.getOrigin();
  [minLonDEM, minLatDEM, maxLonDEM, maxLatDEM] = demImage.getBoundingBox();
  
  for (let i = 0; i < demRasters[0].length; i++) {
    if (minHeight === undefined || demRasters[0][i] < minHeight) {
      minHeight = demRasters[0][i];
    }
  }

  console.log("DEM Loaded:", width, height, "Resolution:", lonRes, latRes, "Bounds:", minLonDEM, minLatDEM, maxLonDEM, maxLatDEM, "Origin:", originX, originY);
}

await loadDEM();

function getElevation(lat, lon) {
  let x_min, x_max, y_min, y_max;
  if (!demImage) {
      console.error("DEM file not loaded yet!");
      return 0;
  }

  // Convert lat/lon to pixel indices in the DEM but retreave the elevation using dual interpolation
  x_min = Math.floor((lon - minLonDEM) / lonRes);
  x_max = x_min + 1;
  y_min = Math.floor((lat - maxLatDEM) / latRes);
  y_max = y_min + 1;

  // Check if the pixel indices are within bounds
  if (x_min < 0 || x_max >= width || y_min < 0 || y_max >= height) {
      console.error("Pixel indices out of bounds!");
      return 0;
  }

  // Perform the interpolation
  const x = (lon - minLonDEM) / lonRes - x_min;
  const y = (lat- maxLatDEM) / latRes - y_min;
  const z1 = demRasters[0][y_min * width + x_min];
  const z2 = demRasters[0][y_min * width + x_max];
  const z3 = demRasters[0][y_max * width + x_min];
  const z4 = demRasters[0][y_max * width + x_max];
  return z1 * (1 - x) * (1 - y) + z2 * x * (1 - y) + z3 * (1 - x) * y + z4 * x * y - minHeight;
}


console.log(`Elevation at ${minLon} ${minLat}:`, getElevation(minLat, minLon));
console.log(`Elevation at ${maxLon} ${maxLat}:`, getElevation(maxLat, maxLon));

/* --- Fetch OSM Data --- */
const overpassQuery = `[out:json][timeout:25];(way["highway"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(overpassQuery);

const highwayColors = {
  motorway: 0xff0000, // Red
  trunk: 0xffa500, // Orange
  primary: 0xffff00, // Yellow
  secondary: 0x008000, // Green
  tertiary: 0x0000ff, // Blue
  residential: 0x808080, // Gray
  service: 0x8b4513, // Brown
  pedestrian: 0xffc0cb, // Pink
  footway: 0x800080, // Purple
  cycleway: 0x00ffff, // Cyan
  unclassified: 0x00ff00, // Light Green
  default: 0xffffff, // White (fallback)
};

console.log(url);


fetch(url)
    .then(response => response.json())
    .then(data => {
        const elements = data.elements;
        let nbRoads = 0;
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element.type === "way" && element.geometry) {
                const road = [];
                for (let j = 0; j < element.geometry.length; j++) {
                    const pt = element.geometry[j];
                    const x = mapRange(pt.lon, minLon, maxLon, outMinX, outMaxX);
                    const z = mapRange(pt.lat, maxLat, minLat, outMinZ, outMaxZ);
                    const y = getElevation(pt.lat, pt.lon);
                    road.push(new THREE.Vector3(x, y, z));
                }

                
                if (road.length >= 2) {
                    // draw a point for each point in the road
                    const highwayType = element.tags.highway || "default";
                    const roadColor = highwayColors[highwayType] || highwayColors.default;
                    
                    // for (let j = 0; j < road.length; j++) {
                    //     const geometry = new THREE.SphereGeometry(0.2, 16, 16);
                    //     const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    //     const sphere = new THREE.Mesh(geometry, material);
                    //     sphere.position.copy(road[j]);
                    //     scene.add(sphere);
                    // }

                    roads.push(road);
                    const geometry = new THREE.BufferGeometry().setFromPoints(road);
                    // const randomColor = Math.random() * 0xffffff;
                    const material = new THREE.LineBasicMaterial({ color: roadColor });
                    const line = new THREE.Line(geometry, material);
                    scene.add(line);
                    nbRoads++;
                    roadLines.push(line);
                }
            }
        }

        // console log all value for tag highway
        console.log("Elements:", [...new Set(elements.map(e => e.tags.highway))]);
        console.log("Roads:", roads);
        console.log("Road Lines:", roadLines);
        console.log("Number of Roads:", nbRoads);

        // --- Build the Road Graph ---
        console.log("Lenth of roads: ", roads.length);
        for (let i = 0; i < roads.length; i++) {
            const road = roads[i];
            for (let j = 0; j < road.length - 1; j++) {
                const startPoint = road[j];
                const endPoint = road[j + 1];

                const startKey = `${startPoint.x},${startPoint.z}`;
                const endKey = `${endPoint.x},${endPoint.z}`;

                if (!graph[startKey]) {
                  graph[startKey] = [];
                }
                if (!graph[endKey]) {
                  graph[endKey] = [];
                }

                graph[startKey].push(endPoint);
            }
        }

        console.log("Road Graph:", graph);
        console.log("Number of Roads:", nbRoads);
        console.log("Number of Road in Graph:", Object.keys(graph).length);
    })
    .catch(error => {
        console.error("Error fetching OSM data:", error);
    });
// add the color label in the top right corner
const colorLabel = document.createElement('div');
colorLabel.style.position = 'absolute';
colorLabel.style.top = '10px';
colorLabel.style.right = '10px';
colorLabel.style.padding = '10px';
colorLabel.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
colorLabel.style.borderRadius = '10px';
colorLabel.style.color = 'black';
colorLabel.style.fontFamily = 'Arial';
colorLabel.style.fontSize = '12px';
colorLabel.style.zIndex = '1';
colorLabel.innerHTML = 'Color Legend:<br>';
for (const [key, value] of Object.entries(highwayColors)) {
    colorLabel.innerHTML += `<span style="color: #${value.toString(16)}">${key}</span><br>`;
}
document.body.appendChild(colorLabel);
animate();

/* --- Handle Window Resize --- */
window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});