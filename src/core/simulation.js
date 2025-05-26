import Stats from 'stats.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Environment } from '../environment/environment.js';
import { AgentManager } from '../agents/agent-manager.js';

export class Simulation {
  constructor() {
    this.renderer = null;
    this.camera = null;
    this.scene = null;
    this.controller = null;

    this.stats = new Stats();
    this.stats.showPanel(0);
    this.statsUI = null;
    document.body.appendChild(this.stats.dom);

    this.clock = null;
    this.timeMultiplier = 1;
    this.environment = new Environment();
    this.AgentManager = new AgentManager();
  }

  async load(bounds, filePath) {
    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initControls();
    console.log("Simulation loaded");
    await this.environment.load(bounds, filePath);
    console.log("Environment loaded");

    await this.AgentManager.load(this.environment);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
  }

  selectTarget() {
        console.log("Selecting target nodes...");
        this.environment.terrain.draw(this.scene);
        this.environment.roads.draw(this.scene);
        this.environment.flood.draw(this.scene);

        const nodeMeshes = this.environment.roads.getNodeMesh(this.scene);
        this.nodeMeshes = nodeMeshes;

        this.renderer.domElement.addEventListener('click', this.handleNodeClick.bind(this), false);
        this.renderer.domElement.addEventListener('mousemove', this.handleNodeHover.bind(this), false);
        
        this.SettingsUI();
        this.animate();
    }

  start() {
    for (let i = 0; i < this.nodeMeshes.length; i++) {
      this.scene.remove(this.nodeMeshes[i]);
    }

    // this.environment.start();
    this.environment.draw(this.scene);

    this.AgentManager.start();
    this.AgentManager.draw(this.scene);

    this.clock = performance.now();
    this.SimulationUI()
    this.animate();
  }

  animate() {
    let deltaTime = null
    if (this.clock !== null) {
      deltaTime = performance.now() - this.clock;
      this.clock = performance.now();
    }

    this.stats.begin();
    // only exectute when the simulation is running
    if (this.clock !== null) {
      if (deltaTime > 1000) {
        deltaTime = 1000 / 60;
      }
      this.AgentManager.update(deltaTime, this.timeMultiplier);
      this.environment.update(deltaTime, this.timeMultiplier);

      this.statsUI.innerHTML = `Active Agents: ${this.AgentManager.activeCount} <br> Arrived Agents: ${this.AgentManager.arrivedCount} <br> Idle Agents: ${this.AgentManager.idleCount}`;
    }

    this.stats.end();
    this.renderer.render(this.scene, this.camera);
    this.controller.update();

    
    requestAnimationFrame(this.animate.bind(this));
  }

  reset() {

  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    this.camera.position.set(0, 1000, 0);
    this.camera.lookAt(0, 0, 0);
  }


  initControls() {
    this.controller = new OrbitControls(this.camera, this.renderer.domElement);
    this.controller.enableDamping = true;
    this.controller.dampingFactor = 0.1;
    this.controller.minDistance = 1;
    this.controller.maxDistance = 3000;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.scene.scale.z = -1;

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(100, 200, 100);
    this.scene.add(directionalLight);
  }

  SettingsUI() {

    // create a ui on the left bottom corner of the screen where i can control the simulation
    // min max walking speed, driving speed, reaction time, number of adgents, 
    // for the flood the gravity, friction, evaporation rate
    // and a start button
    const ui = document.createElement('div');
    ui.style.position = 'absolute';
    ui.style.bottom = '10px';
    ui.style.left = '10px';
    ui.style.display = 'flex';
    ui.style.flexDirection = 'column';
    ui.style.backgroundColor = 'rgb(35, 35, 35)';

    const minWalkingSpeedGroup = document.createElement('div');
    minWalkingSpeedGroup.style.display = 'flex';
    minWalkingSpeedGroup.style.flexDirection = 'row';
    minWalkingSpeedGroup.style.alignItems = 'center';
    minWalkingSpeedGroup.style.margin= '10px';
    ui.appendChild(minWalkingSpeedGroup);

    const maxWalkingSpeedGroup = minWalkingSpeedGroup.cloneNode(true);
    const minCarSpeedGroup = minWalkingSpeedGroup.cloneNode(true);
    const maxCarSpeedGroup = minWalkingSpeedGroup.cloneNode(true);
    const minReactionTimeGroup = minWalkingSpeedGroup.cloneNode(true);
    const maxReactionTimeGroup = minWalkingSpeedGroup.cloneNode(true);
    const numberOfAgentsGroup = minWalkingSpeedGroup.cloneNode(true);

    const minWalkingSpeedLabel = document.createElement('label');
    minWalkingSpeedLabel.innerHTML = 'Min Walking Speed: ';
    minWalkingSpeedLabel.style.color = 'white';
    minWalkingSpeedLabel.style.fontSize = '20px';
    minWalkingSpeedGroup.appendChild(minWalkingSpeedLabel);

    const minWalkingSpeed = document.createElement('input');
    minWalkingSpeed.type = 'number';
    minWalkingSpeed.value = this.AgentManager.walkingSpeed[0];
    minWalkingSpeedGroup.appendChild(minWalkingSpeed);

    minWalkingSpeed.addEventListener('input', (event) => {
      this.AgentManager.walkingSpeed[0] = event.target.value;
    });

    const maxWalkingSpeedLabel = document.createElement('label');
    maxWalkingSpeedLabel.innerHTML = 'Max Walking Speed: ';
    maxWalkingSpeedLabel.style.color = 'white';
    maxWalkingSpeedLabel.style.fontSize = '20px';
    maxWalkingSpeedGroup.appendChild(maxWalkingSpeedLabel);

    const maxWalkingSpeed = document.createElement('input');
    maxWalkingSpeed.type = 'number';
    maxWalkingSpeed.value = this.AgentManager.walkingSpeed[1];
    maxWalkingSpeedGroup.appendChild(maxWalkingSpeed);

    maxWalkingSpeed.addEventListener('input', (event) => {
      this.AgentManager.walkingSpeed[1] = event.target.value;
    });

    const minCarSpeedLabel = document.createElement('label');
    minCarSpeedLabel.innerHTML = 'Min Car Speed: ';
    minCarSpeedLabel.style.color = 'white';
    minCarSpeedLabel.style.fontSize = '20px';
    minCarSpeedGroup.appendChild(minCarSpeedLabel);

    const minCarSpeed = document.createElement('input');
    minCarSpeed.type = 'number';
    minCarSpeed.value = this.AgentManager.drivingSpeed[0];
    minCarSpeedGroup.appendChild(minCarSpeed);

    minCarSpeed.addEventListener('input', (event) => {
      this.AgentManager.drivingSpeed[0] = event.target.value;
    });

    const maxCarSpeedLabel = document.createElement('label');
    maxCarSpeedLabel.innerHTML = 'Max Car Speed: ';
    maxCarSpeedLabel.style.color = 'white';
    maxCarSpeedLabel.style.fontSize = '20px';
    maxCarSpeedGroup.appendChild(maxCarSpeedLabel);

    const maxCarSpeed = document.createElement('input');
    maxCarSpeed.type = 'number';
    maxCarSpeed.value = this.AgentManager.drivingSpeed[1];
    maxCarSpeedGroup.appendChild(maxCarSpeed);

    maxCarSpeed.addEventListener('input', (event) => {
      this.AgentManager.drivingSpeed[1] = event.target.value;
    });

    const minReactionTimeLabel = document.createElement('label');
    minReactionTimeLabel.innerHTML = 'Min Reaction Time: ';
    minReactionTimeLabel.style.color = 'white';
    minReactionTimeLabel.style.fontSize = '20px';
    minReactionTimeGroup.appendChild(minReactionTimeLabel);

    const minReactionTime = document.createElement('input');
    minReactionTime.type = 'number';
    minReactionTime.value = this.AgentManager.reactionTime[0];
    minReactionTimeGroup.appendChild(minReactionTime);

    minReactionTime.addEventListener('input', (event) => {
      this.AgentManager.reactionTime[0] = event.target.value;
    });

    const maxReactionTimeLabel = document.createElement('label');
    maxReactionTimeLabel.innerHTML = 'Max Reaction Time: ';
    maxReactionTimeLabel.style.color = 'white';
    maxReactionTimeLabel.style.fontSize = '20px';
    maxReactionTimeGroup.appendChild(maxReactionTimeLabel);

    const maxReactionTime = document.createElement('input');
    maxReactionTime.type = 'number';
    maxReactionTime.value = this.AgentManager.reactionTime[1];
    maxReactionTimeGroup.appendChild(maxReactionTime);

    maxReactionTime.addEventListener('input', (event) => {
      this.AgentManager.reactionTime[1] = event.target.value;
    });

    const numberOfAgentsLabel = document.createElement('label');
    numberOfAgentsLabel.innerHTML = 'Number of Agents: ';
    numberOfAgentsLabel.style.color = 'white';
    numberOfAgentsLabel.style.fontSize = '20px';
    numberOfAgentsGroup.appendChild(numberOfAgentsLabel);

    const numberOfAgents = document.createElement('input');
    numberOfAgents.type = 'number';
    numberOfAgents.value = this.AgentManager.agentCount;

    numberOfAgentsGroup.appendChild(numberOfAgents);
    numberOfAgents.addEventListener('input', (event) => {
      this.AgentManager.agentCount = event.target.value;
    });

    const startButton = document.createElement('button');
    startButton.innerHTML = 'Start Simulation';
    startButton.style.color = 'white';
    startButton.style.fontSize = '20px';

    startButton.style.backgroundColor = 'rgb(62, 62, 62)';
    startButton.style.border = 'none';
    startButton.style.padding = '10px 20px';
    startButton.style.cursor = 'pointer';
    startButton.style.margin = '10px';

    startButton.addEventListener('click', () => {
      document.body.removeChild(ui);
      this.start();
    });
    
    const waterSourceGroup = document.createElement('div');
    waterSourceGroup.style.display = 'flex';
    waterSourceGroup.style.flexDirection = 'column';
    waterSourceGroup.style.margin = '10px';
    waterSourceGroup.style.padding = '10px';
    waterSourceGroup.style.border = '1px solid #444';
    
    const waterSourceTitle = document.createElement('h3');
    waterSourceTitle.textContent = 'Water Sources';
    waterSourceTitle.style.color = 'white';
    waterSourceTitle.style.marginTop = '0';
    waterSourceGroup.appendChild(waterSourceTitle);

    const waterSourceInstructions = document.createElement('p');
    waterSourceInstructions.textContent = 'Shift+Click on terrain to add water sources';
    waterSourceInstructions.style.color = 'white';
    waterSourceInstructions.style.margin = '5px 0';
    waterSourceGroup.appendChild(waterSourceInstructions);

    // Water source rate control
    const waterRateGroup = document.createElement('div');
    waterRateGroup.style.display = 'flex';
    waterRateGroup.style.alignItems = 'center';
    waterRateGroup.style.margin = '5px 0';

    const waterRateLabel = document.createElement('label');
    waterRateLabel.textContent = 'Water Source Rate: ';
    waterRateLabel.style.color = 'white';
    waterRateLabel.style.marginRight = '10px';
    waterRateGroup.appendChild(waterRateLabel);

    const waterRateInput = document.createElement('input');
    waterRateInput.type = 'number';
    waterRateInput.value = '0.002';
    waterRateInput.step = '0.001';
    waterRateInput.style.width = '60px';
    waterRateGroup.appendChild(waterRateInput);
    this.currentWaterRate = 0.002;
    waterRateInput.addEventListener('input', (e) => {
        this.currentWaterRate = parseFloat(e.target.value);
    });

    waterSourceGroup.appendChild(waterRateGroup);
    

    ui.appendChild(startButton);
    ui.appendChild(minWalkingSpeedGroup);
    ui.appendChild(maxWalkingSpeedGroup);
    ui.appendChild(minCarSpeedGroup);
    ui.appendChild(maxCarSpeedGroup);
    ui.appendChild(minReactionTimeGroup);
    ui.appendChild(maxReactionTimeGroup);
    ui.appendChild(numberOfAgentsGroup);
    ui.appendChild(waterSourceGroup);

    document.body.appendChild(ui);


    
  }

  SimulationUI() {
    const ui = document.createElement('div');
    ui.style.position = 'absolute';
    ui.style.bottom = '10px';
    ui.style.left = '10px';
    ui.style.color = 'white';
    ui.style.fontSize = '20px';
    ui.style.zIndex = 1000;
    ui.innerHTML = `Time Multiplier: ${this.timeMultiplier}`;
    document.body.appendChild(ui);

    const timemultiplierSlider = document.createElement('input');
    timemultiplierSlider.type = 'range';
    timemultiplierSlider.min = 0;
    timemultiplierSlider.max = 50;
    timemultiplierSlider.step = 1;
    timemultiplierSlider.value = this.timeMultiplier;
    timemultiplierSlider.style.position = 'absolute';
    timemultiplierSlider.style.bottom = '50px';
    timemultiplierSlider.style.left = '10px';
    timemultiplierSlider.style.zIndex = 1000;
    document.body.appendChild(timemultiplierSlider);
    timemultiplierSlider.addEventListener('input', (event) => {
      this.timeMultiplier = event.target.value;
      ui.innerHTML = `Time Multiplier: ${this.timeMultiplier}`;
    });

    this.statsUI = document.createElement('div');
    this.statsUI.style.position = 'absolute';
    this.statsUI.style.top = '50px';
    this.statsUI.style.left = '10px';
    this.statsUI.style.color = 'white';
    this.statsUI.style.fontSize = '20px';
    this.statsUI.style.zIndex = 1000;
    this.statsUI.innerHTML = `Active Agents: ${this.AgentManager.activeCount} <br> Arrived Agents: ${this.AgentManager.arrivedCount} <br> Idle Agents: ${this.AgentManager.idleCount}`;
    document.body.appendChild(this.statsUI);





  }


  // Event handlers
    handleNodeClick(event) {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Check if we clicked on a road node
    const nodeIntersects = raycaster.intersectObjects(this.nodeMeshes);
    if (nodeIntersects.length > 0) {
      const clickedObject = nodeIntersects[0].object;
      if (clickedObject.userData.isSelected) {
        clickedObject.material.color.setHex(0x3D3A4B);
        clickedObject.userData.isSelected = false;
        this.AgentManager.removeTarget(clickedObject.userData.node);
      }
      // Otherwise select it with a new color
      else {
        clickedObject.material.color.setHex(0xff0000);
        clickedObject.userData.isSelected = true;

        const targetNode = clickedObject.userData.node;
        this.AgentManager.addTarget(targetNode);;
      }
      return;
    }

    // Check if we clicked on the terrain to add a water source
    const terrain = this.scene.getObjectByName("terrain");
    if (terrain) {
      const terrainIntersects = raycaster.intersectObject(terrain);
      if (terrainIntersects.length > 0 && event.shiftKey) {
        const point = terrainIntersects[0].point;

        console.log("Adding water source at: ", point);

        // Convert world coordinates to grid coordinates
        const width = terrain.geometry.parameters.width;
        const height = terrain.geometry.parameters.height;
        const widthSegments = this.environment.flood.widthNbSegments;
        const heightSegments = this.environment.flood.heightNbSegments;

        const normalizedX = (point.x + width/2) / width;
        const normalizedZ = (point.z + height/2) / height;

        const x = Math.round(normalizedX * widthSegments);
        const z = heightSegments - Math.round(normalizedZ * heightSegments);

        console.log(`Water source grid position: (${x}, ${z})`);
        // Add water source at this position
        this.environment.flood.addWaterSource(x, z, 0.002);

        // Visual feedback
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(5, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x1E90FF })
        );

        // Convert normalized coordinates back to world coordinates
        const x_ = x / widthSegments * width - width / 2;
        const z_ = z / heightSegments * height - height / 2;

        // Calculate elevation at this point
        const lat = this.environment.bounds[3] - normalizedZ * (this.environment.bounds[3] - this.environment.bounds[1]);
        const lon = this.environment.bounds[0] + normalizedX * (this.environment.bounds[2] - this.environment.bounds[0]);
        const elevation = this.environment.elevation.getHeight(lat, lon);
     
        console.log(`Water source marker position: (${x_}, ${elevation}, ${z_})`);
     
        sphere.position.set(x_, elevation + 1, z_); 
        this.scene.add(sphere);
        this.waterSourceMarkers = this.waterSourceMarkers || [];
        this.waterSourceMarkers.push(sphere);

        
      }
    }
  }


  handleNodeHover(event) {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Reset all hover states first
    this.nodeMeshes.forEach(mesh => {
      if (!mesh.userData.isSelected) {
        mesh.material.color.setHex(0x3D3A4B);
      }
    });

    // Set hover state
    const intersects = raycaster.intersectObjects(this.nodeMeshes);
    if (intersects.length > 0 && !intersects[0].object.userData.isSelected) {
      intersects[0].object.material.color.setHex(0x00ffff); // Hover color
    }
  }


}