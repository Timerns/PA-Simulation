export class UploadInterface {
  constructor(simulation) {
    this.simulation = simulation;
    this.createUI();
  }

  createUI() {
    // Main container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = 'rgba(0,0,0,0.7)';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.zIndex = '1000';

    // Content box
    const content = document.createElement('div');
    content.style.backgroundColor = '#2d2d2d';
    content.style.padding = '20px';
    content.style.borderRadius = '10px';
    content.style.width = '500px';
    content.style.maxWidth = '90%';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Upload DEM File and Set Bounds';
    title.style.color = 'white';
    title.style.textAlign = 'center';
    title.style.marginBottom = '30px';

    // File upload section
    const fileSection = document.createElement('div');
    fileSection.style.marginBottom = '20px';

    const fileLabel = document.createElement('label');
    fileLabel.textContent = 'DEM File (GeoTIFF):';
    fileLabel.style.color = 'white';
    fileLabel.style.display = 'block';
    fileLabel.style.marginBottom = '5px';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.tif,.tiff,.geotiff';
    fileInput.style.width = '100%';
    fileInput.style.padding = '8px';
    fileInput.style.borderRadius = '4px';
    fileInput.style.border = '1px solid #444';

    fileSection.appendChild(fileLabel);
    fileSection.appendChild(fileInput);

    // Bounds section
    const boundsSection = document.createElement('div');
    boundsSection.style.marginBottom = '20px';

    const boundsLabel = document.createElement('label');
    boundsLabel.textContent = 'Simulation Bounds (minLon, minLat, maxLon, maxLat):';
    boundsLabel.style.color = 'white';
    boundsLabel.style.display = 'block';
    boundsLabel.style.marginBottom = '5px';

    const boundsInput = document.createElement('input');
    boundsInput.type = 'text';
    boundsInput.placeholder = 'e.g., 6.58,46.506415,6.643553,46.531823';
    boundsInput.value = '6.58,46.506415,6.643553,46.531823'
    boundsInput.style.width = '100%';
    boundsInput.style.padding = '8px';
    boundsInput.style.borderRadius = '4px';
    boundsInput.style.border = '1px solid #444';

    boundsSection.appendChild(boundsLabel);
    boundsSection.appendChild(boundsInput);

    // Submit button
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Start Simulation';
    submitButton.style.width = '100%';
    submitButton.style.padding = '10px';
    submitButton.style.backgroundColor = '#4CAF50';
    submitButton.style.color = 'white';
    submitButton.style.border = 'none';
    submitButton.style.borderRadius = '4px';
    submitButton.style.cursor = 'pointer';
    submitButton.style.fontSize = '16px';

    submitButton.addEventListener('click', async () => {
      const file = fileInput.files[0];
      const boundsText = boundsInput.value;
      
      if (!file) {
        alert('Please select a DEM file');
        return;
      }

      if (!boundsText) {
        alert('Please enter bounds');
        return;
      }

      const bounds = boundsText.split(',').map(Number);
      
      if (bounds.length !== 4 || bounds.some(isNaN)) {
        alert('Invalid bounds format. Please use format: minLon,minLat,maxLon,maxLat');
        return;
      }

      // Remove the UI
      document.body.removeChild(container);

      // Start loading the simulation
      await this.simulation.load(bounds, file);
      this.simulation.selectTarget();
    });

    // Add elements to content
    content.appendChild(title);
    content.appendChild(fileSection);
    content.appendChild(boundsSection);
    content.appendChild(submitButton);

    // Add content to container
    container.appendChild(content);

    // Add to document
    document.body.appendChild(container);
  }
}