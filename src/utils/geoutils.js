
export function wgs84ToCoordsFromCenter(lon, lat, box) {
    // Get the center of the bounding box
    const lonCenter = (box[0] + box[2]) / 2
    const latCenter = (box[1] + box[3]) / 2

    // Calculate scales
    const latScale = 111132; // meters per degree latitude
    const lonScale = 111320 * Math.cos(latCenter * (Math.PI / 180)); // meters per degree longitude at this latitude

    // Convert the point coordinates to meters relative to the center
    return [
        (lon - lonCenter) * lonScale,
        (lat - latCenter) * latScale
    ];
}
