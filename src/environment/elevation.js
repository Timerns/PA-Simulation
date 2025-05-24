import { fromBlob } from "geotiff";

export class Elevation {
  constructor(filePath) {
    this.filePath = filePath;

    this.data = null;
    this.bounds = null;
    this.dimensions = null;
    this.resolution = null;
    this.minHeight = null;
  }

  load() {
    return new Promise((resolve, reject) => {
      fromBlob(this.filePath)
        .then((tiff) => {
          console.log("Loading elevation data from:", this.filePath);
          console.log(tiff.getImage());
          return tiff.getImage();
        })
        .then((image) => {
          this.bounds = image.getBoundingBox();
          this.dimensions = [image.getWidth(), image.getHeight()];
          this.resolution = image.getResolution();
          return image.readRasters();
        })
        .then((data) => {
          this.minHeight = data[0].filter((num) => !isNaN(num)).reduce((a, b) => Math.min(a, b), Infinity);
          this.data = data[0];
          resolve(this.data);
        })
        .catch((error) => {
          console.error("Error loading elevation data:", error);
          reject(error);
        });
    });
  }

  getHeight(lat, lon) {
    if (!this.data) {
      console.error("Elevation data not loaded yet!");
      return 0;
    }


    const x_min = Math.floor((lon - this.bounds[0]) / this.resolution[0]);
    const x_max = x_min + 1;
    const y_min = Math.floor((lat - this.bounds[3]) / this.resolution[1]);
    const y_max = y_min + 1;

    if (x_min < 0 || x_max >= this.dimensions[0] || y_min < 0 || y_max >= this.dimensions[1]) {
      console.error("Pixel indices out of bounds!" + this.bounds);
      console.error("lon: " + lon + " lat: " + lat);
      return 0;
    }

    const x = (lon - this.bounds[0]) / this.resolution[0] - x_min;
    const y = (lat - this.bounds[3]) / this.resolution[1] - y_min;
    const z1 = this.data[y_min * this.dimensions[0] + x_min];
    const z2 = this.data[y_min * this.dimensions[0] + x_max];
    const z3 = this.data[y_max * this.dimensions[0] + x_min];
    const z4 = this.data[y_max * this.dimensions[0] + x_max];

    return z1 * (1 - x) * (1 - y) + z2 * x * (1 - y) + z3 * (1 - x) * y + z4 * x * y - this.minHeight;
  }

  getBounds() {
    return this.bounds;
  }
}