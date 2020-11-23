import React, {Component} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import getNPY from "../helpers/getNPY";

const style = {
  height: 750, // we can control scene size by setting container dimensions
};

const defaultPeriod = 2;

class BrainScene extends Component {
  state = {
    brainData: [],
  }

  componentDidMount() {
    this.sceneSetup();
    this.addCustomSceneObjects();
    this.startAnimationLoop();
    window.addEventListener("resize", this.handleWindowResize);
    getNPY((res) => {
      this.setState({
        brainData: res,
        dots: [],
      });
      this.dotsSetup();
    });
    this.setState({
      clock: new THREE.Clock(),
    });
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.handleWindowResize);
    window.cancelAnimationFrame(this.requestID);
    this.controls.dispose();
  }

  // Standard scene setup in Three.js. Check "Creating a scene" manual for more information
  // https://threejs.org/docs/#manual/en/introduction/Creating-a-scene
  sceneSetup() {
    // get container dimensions and use them for scene sizing
    const width = this.el.clientWidth;
    const height = this.el.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
        75, // fov = field of view
        width / height, // aspect ratio
        0.1, // near plane
        1000, // far plane
    );
    this.camera.position.z = 200; // is used here to set some distance from a cube that is located at z = 0
    // OrbitControls allow a camera to orbit around the object
    // https://threejs.org/docs/#examples/controls/OrbitControls
    this.controls = new OrbitControls(this.camera, this.el);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(width, height);
    this.el.appendChild(this.renderer.domElement); // mount using React ref
  };

  // Here should come custom code.
  // Code below is taken from Three.js BoxGeometry example
  // https://threejs.org/docs/#api/en/geometries/BoxGeometry
  addCustomSceneObjects() {
    const scene = this.scene;

    const loader = new GLTFLoader();
    loader.setPath("/models/");

    this.loadModel(loader, scene, "lh.glb");
    this.loadModel(loader, scene, "rh.glb");

    const lights = [];
    lights[0] = new THREE.PointLight(0xffffff, 1, 0);
    lights[1] = new THREE.PointLight(0xffffff, 1, 0);
    lights[2] = new THREE.PointLight(0xffffff, 1, 0);

    lights[0].position.set(0, 200, 0);
    lights[1].position.set(100, 200, 100);
    lights[2].position.set(-100, -200, -100);

    this.scene.add(lights[0]);
    this.scene.add(lights[1]);
    this.scene.add(lights[2]);
  };

  startAnimationLoop = () => {
    // const delta = this.state.clock && this.state.clock.getDelta();
    const elapsed = this.state.clock && this.state.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);

    if (this.state.dots) {
      const newDots = this.state.dots.map((dot) => {
        const {sphere, timeOffset} = dot;
        const newOpacity = Math.cos(Math.PI*((elapsed + timeOffset) % defaultPeriod)/(2*defaultPeriod));
        if (sphere) {
          sphere.material.opacity = newOpacity;
        }
        return ({sphere, timeOffset});
      });
      this.setState({dots: newDots});
    }
    // The window.requestAnimationFrame() method tells the browser that you wish to perform
    // an animation and requests that the browser call a specified function
    // to update an animation before the next repaint
    this.requestID = window.requestAnimationFrame(this.startAnimationLoop);
  };

  handleWindowResize = () => {
    const width = this.el.clientWidth;
    const height = this.el.clientHeight;

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;

    // Note that after making changes to most of camera properties you have to call
    // .updateProjectionMatrix for the changes to take effect.
    this.camera.updateProjectionMatrix();
  };

  dotsSetup() {
    if (this.state.brainData && this.scene) {
      const mniData = this.state.brainData.data;// .map((i) => i/3.5);
      console.log(mniData);
      if (mniData) {
        for (let i = 0; i < Math.min(mniData.length-1, 999); i += 3) {
          const [x, y, z] = [-mniData[i], mniData[i + 2], -mniData[i + 1]];
          const sphere = this.createSphere(x, y, z, 0xffffff, 1); // x,y,z = -x, z, y
          this.scene.add(sphere);
          const dots = this.state.dots;
          dots && dots.push({sphere, timeOffset: Math.random()});
          dots && this.setState({dots});
        }
      }
    }
  }

  render() {
    return <div style={style} ref={(ref) => (this.el = ref)}/>;
  }

  loadModel(loader, scene, model) {
    loader.load(model, function(gltf) {
      model = gltf.scene.children[0];
      model.material.opacity = 0.5;
      model.material.transparent = true;
      model.position.set(0, 10, 0);
      model.scale.set(1.1, 1.1, 1.1);
      model.renderOrder = 1;
      scene.add(gltf.scene);
    }, undefined, function(error) {
      console.error(error);
    });
  }

  createSphere(x, y, z, colorCode, opacity) {
    const geometry = new THREE.SphereGeometry(2, 8, 6);
    const material = new THREE.MeshBasicMaterial({color: colorCode, transparent: true, opacity: opacity});
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, z);
    return sphere;
  }
}

/*
const rootElement = document.getElementById("root");
ReactDOM.render(<Container />, rootElement);
*/
export {BrainScene};
