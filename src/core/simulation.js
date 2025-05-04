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
    document.body.appendChild(this.stats.dom);

    this.clock = null;
    this.timeMultiplier = 1;
    this.environment = new Environment();
    this.AgentManager = new AgentManager();
  }

  async load() {
    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initControls();
    await this.environment.load();
    var targets = []

    await this.AgentManager.load(this.environment, 100, targets);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
  }

  selectTarget() {
    this.scene.add(this.environment.terrain.getMesh());
    this.scene.add(this.environment.roads.getMesh());

    const nodeMeshes = this.environment.roads.getNodeMesh(this.scene);
    this.nodeMeshes = nodeMeshes;

    this.renderer.domElement.addEventListener('click', this.handelNodeClick.bind(this), false);
    this.renderer.domElement.addEventListener('mousemove', this.handelNodeHover.bind(this), false);

    this.SettingsUI()
    this.animate();
  }

  start() {
    for (let i = 0; i < this.nodeMeshes.length; i++) {
      this.scene.remove(this.nodeMeshes[i]);
    }

    this.environment.start();

    this.scene.add(this.environment.terrain.getMesh());
    this.scene.add(this.environment.roads.getMesh());
    this.scene.add(this.environment.flood.createFloodGeometry());
    
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
    const ui = document.createElement('div');
    ui.style.position = 'absolute';
    ui.style.bottom = '10px';
    ui.style.left = '10px';
    ui.style.color = 'white';
    ui.style.fontSize = '20px';
    ui.style.zIndex = 1000;
    ui.innerHTML = `Time Multiplier: ${this.timeMultiplier}`;
    document.body.appendChild(ui);

    const startsimulationButton = document.createElement('button');
    startsimulationButton.innerHTML = 'Start Simulation';
    startsimulationButton.style.position = 'absolute';
    startsimulationButton.style.bottom = '50px';
    startsimulationButton.style.left = '10px';
    startsimulationButton.style.zIndex = 1000;
    document.body.appendChild(startsimulationButton);
    startsimulationButton.addEventListener('click', () => {
      document.body.removeChild(ui);
      document.body.removeChild(startsimulationButton);
      document.body.removeChild(inputNbAgents);
      document.body.removeChild(inputNbAgentsLabel);
      this.start();
    });

    const inputNbAgents = document.createElement('input');
    inputNbAgents.type = 'number';
    inputNbAgents.value = 100;
    inputNbAgents.style.position = 'absolute';
    inputNbAgents.style.bottom = '100px';
    inputNbAgents.style.left = '10px';
    inputNbAgents.style.zIndex = 1000;
    document.body.appendChild(inputNbAgents);
    inputNbAgents.addEventListener('input', (event) => {
      this.AgentManager.agentCount = event.target.value;
    });
    const inputNbAgentsLabel = document.createElement('label');
    inputNbAgentsLabel.innerHTML = 'Number of Agents: ';
    inputNbAgentsLabel.style.position = 'absolute';
    inputNbAgentsLabel.style.bottom = '130px';
    inputNbAgentsLabel.style.left = '10px';
    inputNbAgentsLabel.style.color = 'white';
    inputNbAgentsLabel.style.fontSize = '20px';
    inputNbAgentsLabel.style.zIndex = 1000;
    document.body.appendChild(inputNbAgentsLabel);
    
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
    timemultiplierSlider.min = 1;
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

  }


  // Event handlers
  handelNodeClick(event) {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    const intersects = raycaster.intersectObjects(this.nodeMeshes);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;

      if (clickedObject.userData.isSelected) {
        clickedObject.material.color.setHex(0x0000ff);
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
    }
  }

  handelNodeHover(event) {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Reset all hover states first
    this.nodeMeshes.forEach(mesh => {
      if (!mesh.userData.isSelected) {
        mesh.material.color.setHex(0x0000ff);
      }
    });

    // Set hover state
    const intersects = raycaster.intersectObjects(this.nodeMeshes);
    if (intersects.length > 0 && !intersects[0].object.userData.isSelected) {
      intersects[0].object.material.color.setHex(0x00ffff); // Hover color
    }
  }


}