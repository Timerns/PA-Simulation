import { getElevation } from "./elevation";

function transformInM(geometry, minLat, minLon, maxLat, maxLon) {
    const latScale = 111132;
    const lonScale = 111320 * Math.cos(geometry.lat * (Math.PI / 180));
    return [
        (geometry.lon * lonScale) - ((maxLat + minLat) / 2 * lonScale),
        getElevation(geometry.lat, geometry.lon),
        ((maxLon + minLon) / 2 * latScale) - (geometry.lat * latScale)
    ];
}

export { transformInM };