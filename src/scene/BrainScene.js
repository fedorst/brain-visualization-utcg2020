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
attribute vec3 color;

varying float fragOpacity;
uniform float maxPointSize;
varying vec3 fragColor;

void main() {
  fragOpacity = opacity;
  fragColor = color;

  gl_PointSize = maxPointSize * opacity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const fragmentShader = `
// uniform vec3 color;
uniform sampler2D tex;

varying vec3 fragColor;
varying float fragOpacity;

void main() {

  vec4 col = texture2D(tex, gl_PointCoord.st).rgba;
  float texOpacity = col.a;
  if (texOpacity < 0.5) // bit of a hack for now
    {
        discard;
    }
 
  gl_FragColor = vec4(fragColor.rgb, fragOpacity);

}
`;

const brainMaterial = new THREE.MeshLambertMaterial();

class BrainScene extends Component {
  state = {
    brainData: [],
  }

  async componentDidMount() {
    this.loadModel = this.loadModel.bind(this);
    this.sceneSetup();
    await this.addCustomSceneObjects();
    this.startAnimationLoop();
    window.addEventListener("resize", this.handleWindowResize);
    getNPY((res) => {
      this.setState({
        brainData: res,
      });
      this.dotsSetup();
    });

    this.setState({
      clock: new THREE.Clock(),
      material: new THREE.ShaderMaterial({
        uniforms: {
          // color: {value: new THREE.Color(1.0, 1.0, 1.0)},
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
  async addCustomSceneObjects() {
    const getMeshFromGltf = (gltf) => {
      {
        const model = gltf.scene.children[0];

        // temporary mesh for smoothing
        const tempGeo = new THREE.Geometry().fromBufferGeometry(model.geometry);
        tempGeo.mergeVertices();
        tempGeo.computeVertexNormals();
        tempGeo.computeFaceNormals();

        model.geometry = tempGeo;
        model.material = brainMaterial;

        console.log("setting state for loading model");
        return new THREE.Mesh(model.geometry, model.material);
      }
    };

    const scene = this.scene;

    // load brain models
    const loader = new GLTFLoader();
    loader.setPath("/models/");

    const lh = await this.loadModel(loader, scene, "lh_low.glb");
    const meshLh = getMeshFromGltf(lh);
    const rh = await this.loadModel(loader, scene, "rh_low.glb");
    const meshRh = getMeshFromGltf(rh);
    const combinedGeometry = new THREE.Geometry();
    meshLh.updateMatrix();
    combinedGeometry.merge(meshLh.geometry, meshLh.matrix, 0);

    meshRh.updateMatrix();
    combinedGeometry.merge(meshRh.geometry, meshRh.matrix, 1);

    const combinedMaterial = meshRh.material;
    combinedMaterial.opacity = 0.7;
    combinedMaterial.transparent = true;
    const combinedMesh = new THREE.Mesh(combinedGeometry, combinedMaterial);
    combinedMesh.renderOrder = 1;
    // positioning
    combinedMesh.position.set(0, 15, 0);
    combinedMesh.scale.set(1.2, 1.1, 1);

    scene.add(combinedMesh);
    this.setState({mesh: combinedMesh});

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

    if (this.state.dots && this.state.mesh) {
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
    if (this.state.brainData && this.scene && this.state.mesh) {
      // const [colorWhite, colorRed] = [new THREE.Color(1.0, 1.0, 1.0), new THREE.Color(1.0, 0.2, 0.2)];
      const mesh = this.state.mesh;
      mesh.material.side = THREE.BackSide;
      const mniData = this.state.brainData.data;
      const pointCount = mniData.length / 3;
      const geometry = new THREE.BufferGeometry();

      const position = new Float32Array(pointCount * 3);
      const opacity = new Float32Array(pointCount);
      const hidden = new Array(pointCount);
      const color = new Float32Array(pointCount * 3);
      for (let i = 0; i < pointCount * 3; i += 3) {
        const pointCoord = i / 3;
        const [x, y, z] = [-mniData[i], mniData[i + 2], -mniData[i + 1]];
        position[i] = x;
        position[i + 1] = y;
        position[i + 2] = z;
        const point = new THREE.Vector3(x, y, z);
        const raycaster = new THREE.Raycaster();
        raycaster.set(point, new THREE.Vector3(0, -5000, 0));
        const intersects = raycaster.intersectObject(mesh);
        if (intersects.length > 0) { // Points is in object
          color[i] = 1.0;
          color[i + 1] = 1.0;
          color[i + 2] = 1.0;

          // material = this.state.material;
          // console.log("Point is in object");
        } else {
          color[i] = 1.0;
          color[i + 1] = 0.2;
          color[i + 2] = 0.2;
          // material = this.state.excludedMaterial;
          // console.log("Point is NOT in object");
        }
        hidden[pointCoord] = false;
        opacity[pointCoord] = Math.random();
        /*
        if (y > 64 && ((z > 45 && x < -30) || (x > 20 && z > 50)) || y < -50) {
          hidden[pointCoord] = true;
          opacity[pointCoord] = 0.0;
        } else {
          hidden[pointCoord] = false;
          opacity[pointCoord] = Math.random();
        }
        hidden[i] = !(y > 64 && ((z > 45 && x < -30) || (x > 20 && z > 50)) || y < -50);
         */
      }
      // geometry.setAttribute("color", new THREE.Color(1.0, 1.0, 1.0));
      // color: {value: new THREE.Color(1.0, 1.0, 1.0)},
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute("opacity", new THREE.BufferAttribute(opacity, 1));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));

      const particles = new THREE.Points( geometry, this.state.material );
      particles.initialOpacities = [...opacity];
      particles.hidden = hidden;
      this.scene.add( particles );
      this.setState({dots: particles});
      mesh.material.side = THREE.FrontSide;
    }
  }

  render() {
    return <div style={style} ref={(ref) => (this.el = ref)}/>;
  }

  loadModel(loader, scene, model) {
    return new Promise(((resolve, reject) => {
      loader.load(model, (gltf) => resolve(gltf), null, reject);
    }));
  }
}

export {BrainScene};
