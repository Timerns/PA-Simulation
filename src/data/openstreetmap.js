const getRoadMap = async (minLon, minLat, maxLon, maxLat) => {
    const overpassQuery = `[out:json][timeout:25];(way["highway"]["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service"](${minLat},${minLon},${maxLat},${maxLon}););out geom;`;
    const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(overpassQuery)
    const response = await fetch(url).then(res => res.json());
    return response.elements
}

const getWaterMap = async (minLon, minLat, maxLon, maxLat) => {
    const overpassQuery = `[out:json][timeout:25];
    (
        way["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
        way["waterway"];
        way["man_made"];
    );
    out geom;`;
    const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(overpassQuery)
    const response = await fetch(url).then(res => res.json());
    return response.elements
}

export { getRoadMap, getWaterMap };