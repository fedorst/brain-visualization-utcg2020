import React, {Component} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import getNPY from "../helpers/getNPY";

const style = {
  height: 750, // we can control scene size by setting container dimensions
};

const defaultPeriod = 4;

const sprite = new THREE.TextureLoader().load( "sprites/disc.png" );
const vertexShader = `
attribute float opacity;

varying float fragOpacity;
uniform float maxPointSize;

void main() {
  fragOpacity = opacity;

  gl_PointSize = maxPointSize * opacity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const fragmentShader = `
uniform vec3 color;
uniform sampler2D tex;

varying float fragOpacity;

void main() {

  vec4 col = texture2D(tex, gl_PointCoord.st).rgba;
  float texOpacity = col.a;
  if (texOpacity < 0.5) // bit of a hack for now
    {
        discard;
    }
 
  gl_FragColor = vec4(1, 1, 1, fragOpacity);

}
`;

const brainMaterial = new THREE.MeshLambertMaterial();

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
      material: new THREE.ShaderMaterial({
        uniforms: {
          color: {value: new THREE.Color(1.0, 1.0, 1.0)},
          tex: {
            type: "t",
            value: sprite,
          },
          maxPointSize: {
            type: "f",
            value: 15.0,
          },
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,

      }),
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
      const opacity = this.state.dots.geometry.attributes.opacity;
      const offset = this.state.dots.initialOpacities;
      for (let i = 0; i < opacity.array.length; i++) {
        if (this.state.dots.hidden[i]) {
          continue;
        }
        opacity.array[i] = Math.cos(2 * Math.PI * (elapsed/defaultPeriod + offset[i]));
      }
      opacity.needsUpdate = true;
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
      const mniData = this.state.brainData.data;
      const pointCount = mniData.length / 3;
      const geometry = new THREE.BufferGeometry();

      const position = new Float32Array(pointCount * 3);
      const opacity = new Float32Array(pointCount);
      const hidden = new Array(pointCount);
      for (let i = 0; i < pointCount * 3; i += 3) {
        const pointCoord = i / 3;
        const [x, y, z] = [-mniData[i], mniData[i + 2], -mniData[i + 1]];
        position[i] = x;
        position[i + 1] = y;
        position[i + 2] = z;
        if (y > 64 && ((z > 45 && x < -30) || (x > 20 && z > 50)) || y < -50) {
          hidden[pointCoord] = true;
          opacity[pointCoord] = 0.0;
        } else {
          hidden[pointCoord] = false;
          opacity[pointCoord] = Math.random();
        }
        hidden[i] = !(y > 64 && ((z > 45 && x < -30) || (x > 20 && z > 50)) || y < -50);
      }
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute("opacity", new THREE.BufferAttribute(opacity, 1));
      const particles = new THREE.Points( geometry, this.state.material );
      particles.initialOpacities = [...opacity];
      particles.hidden = hidden;
      this.scene.add( particles );
      this.setState({dots: particles});
    }
  }

  render() {
    return <div style={style} ref={(ref) => (this.el = ref)}/>;
  }

  loadModel(loader, scene, model) {
    loader.load(model, function(gltf) {
      model = gltf.scene.children[0];

      // temporary mesh for smoothing
      const tempGeo = new THREE.Geometry().fromBufferGeometry(model.geometry);
      tempGeo.mergeVertices();
      tempGeo.computeVertexNormals();
      tempGeo.computeFaceNormals();

      // making the mesh Buffered geometry again for effective rendering
      model.geometry = new THREE.BufferGeometry().fromGeometry(tempGeo);
      model.material = brainMaterial;
      model.material.opacity = 0.5;
      model.material.transparent = true;
      model.renderOrder = 1;
      // positioning
      model.position.set(0, 15, 0);
      model.scale.set(1.2, 1.1, 1);

      scene.add(gltf.scene);
    }, undefined, function(error) {
      console.error(error);
    });
  }
}

export {BrainScene};
