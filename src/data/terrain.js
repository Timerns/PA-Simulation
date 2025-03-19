import * as THREE from 'three';

function latLngToTilePixel(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const xtile = (lng + 180) / 360 * n;
    const ytile = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
    
    // Get the exact tile
    const xtileFloor = Math.floor(xtile);
    const ytileFloor = Math.floor(ytile);
    
    // Get the pixel position within the tile (0-255)
    const xpixel = Math.floor((xtile - xtileFloor) * 256);
    const ypixel = Math.floor((ytile - ytileFloor) * 256);
    
    return { 
        x: xtileFloor, 
        y: ytileFloor,
        pixelX: xpixel,
        pixelY: ypixel
    };
}

// Function to create canvas with properly aligned map tiles
export async function createMapTexture(box) {
    // Choose an appropriate zoom level
    const zoom = 15; // Adjust as needed for your area
    
    // Calculate tile coordinates for bounding box corners with pixel precision
    const nwTile = latLngToTilePixel(box[3], box[0], zoom); // Northwest corner
    const seTile = latLngToTilePixel(box[1], box[2], zoom); // Southeast corner
    
    // Calculate how many tiles we need horizontally and vertically
    const xTiles = [];
    for (let x = nwTile.x; x <= seTile.x; x++) {
        xTiles.push(x);
    }
    
    const yTiles = [];
    for (let y = nwTile.y; y <= seTile.y; y++) {
        yTiles.push(y);
    }
    
    // Calculate the total width and height in pixels
    const totalWidth = (xTiles.length * 256) - nwTile.pixelX - (256 - seTile.pixelX);
    const totalHeight = (yTiles.length * 256) - nwTile.pixelY - (256 - seTile.pixelY);
    
    // Create a canvas to hold the cropped map area
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    
    // Function to load a single tile
    function loadTile(x, y) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // Using OpenStreetMap tile server (consider using a different provider if needed)
            img.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
            img.crossOrigin = "Anonymous"; // Important for CORS
            img.onload = () => resolve(img);
            img.onerror = () => {
                // If tile fails to load, create a placeholder
                const placeholder = document.createElement('canvas');
                placeholder.width = 256;
                placeholder.height = 256;
                const pctx = placeholder.getContext('2d');
                pctx.fillStyle = '#F1EEE6'; // Light beige background
                pctx.fillRect(0, 0, 256, 256);
                pctx.strokeStyle = '#CCCCCC';
                pctx.strokeRect(0, 0, 256, 256);
                pctx.font = '10px Arial';
                pctx.fillStyle = '#999999';
                pctx.fillText(`Tile ${x},${y} failed`, 5, 20);
                resolve(placeholder);
            };
        });
    }
    
    // Load all tiles concurrently
    const loadPromises = [];
    for (let i = 0; i < yTiles.length; i++) {
        const y = yTiles[i];
        for (let j = 0; j < xTiles.length; j++) {
            const x = xTiles[j];
            
            // Calculate where to draw this tile on the canvas
            let destX = j * 256 - nwTile.pixelX;
            let destY = i * 256 - nwTile.pixelY;
            
            const tilePromise = loadTile(x, y).then(img => {
                // Draw the tile at the correct position on the canvas
                ctx.drawImage(img, destX, destY);
            });
            loadPromises.push(tilePromise);
        }
    }
    
    // Wait for all tiles to load
    await Promise.all(loadPromises);
    
    // Create a THREE.js texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    // The texture's UV mapping needs to be flipped on the y-axis for THREE.js
    texture.flipY = true;
    
    return texture;
}