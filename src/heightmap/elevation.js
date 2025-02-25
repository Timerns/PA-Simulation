import { fromUrl } from "geotiff";

// URL of the Copernicus DEM tile (Modify this based on your location)
const DEM_FILENAME = "../assets/2025-02-20-00_00_2025-02-20-23_59_DEM_COPERNICUS_30_DEM_(Raw).tiff";
let demImage, demRasters, lonRes, latRes, width, height, originX, originY;
let minLonDEM, minLatDEM, maxLonDEM, maxLatDEM;
let minHeight, maxHeight;
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

    for (let i = 0; i < demRasters[0].length; i++) {
        if (maxHeight === undefined || demRasters[0][i] > maxHeight) {
            maxHeight = demRasters[0][i];
        }
    }
  


    console.log("DEM Loaded:", width, height, "Resolution:", lonRes, latRes, "Bounds:", minLonDEM, minLatDEM, maxLonDEM, maxLatDEM, "Origin:", originX, originY);
    console.log("Min Height:", minHeight, "Max Height:", maxHeight);
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
    const y = (lat - maxLatDEM) / latRes - y_min;
    const z1 = demRasters[0][y_min * width + x_min];
    const z2 = demRasters[0][y_min * width + x_max];
    const z3 = demRasters[0][y_max * width + x_min];
    const z4 = demRasters[0][y_max * width + x_max];
    return z1 * (1 - x) * (1 - y) + z2 * x * (1 - y) + z3 * (1 - x) * y + z4 * x * y - minHeight;
}

export { getElevation, loadDEM, demImage, demRasters, lonRes, latRes, width, height, originX, originY, minLonDEM, minLatDEM, maxLonDEM, maxLatDEM, minHeight, maxHeight };