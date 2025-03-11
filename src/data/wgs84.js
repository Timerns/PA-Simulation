import { getElevation } from "./elevation";

function transformInM(geometry, minLon, minLat, maxLon, maxLat) {
    // Get the center of the bounding box
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    
    // Calculate scales
    const latScale = 111132; // meters per degree latitude
    const lonScale = 111320 * Math.cos(centerLat * (Math.PI / 180)); // meters per degree longitude at this latitude
    
    // Convert the point coordinates to meters relative to the center
    return [
        (geometry.lon - centerLon) * lonScale,
        getElevation(geometry.lat, geometry.lon),
        (centerLat - geometry.lat) * latScale
    ];
}

export { transformInM };