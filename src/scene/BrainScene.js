import React, {Component, createRef} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import getNPY from "../helpers/getNPY";
import {Grid, GridColumn, Sticky, Ref} from "semantic-ui-react";
import mniCoords from "../helpers/mni_coordinates.npy";
import dcnnLayerFile from "../helpers/dcnn_layer.npy";
// import resAllFrqFile from "../helpers/neural_responses_all_frq.npy";
import resAllLfpFile from "../helpers/neural_responses_all_lfp.npy";
// import resCtgFrqFile from "../helpers/neural_responses_ctg_frq.npy";
import resCtgLfpFile from "../helpers/neural_responses_ctg_lfp.npy";
import predictiveFile from "../helpers/predictive.npy";
import {hiddenIndexes, hexToRgb, preprocessNpy, maxMoment} from "../helpers/Utility";
import {PageSidebar} from "./PageSidebar";
import {PageHeader} from "./PageHeader";

const sceneStyle = {
  height: 750, // we can control scene size by setting container dimensions
};
const totalTime = 20000; // 20s
const msPerMoment = totalTime / maxMoment;

const dcnnColors = [
  "#25219E",
  "#23479B",
  "#2C5BA7",
  "#00B7EC",
  "#48C69B",
  "#A7D316",
  "#FFD100",
  "#FF5F17",
  "#E61A26",
];

const dcnnColorsRGB = dcnnColors.map((color) => {
  const rgbObj = hexToRgb(color);
  return [parseFloat(rgbObj.r)/255.0, parseFloat(rgbObj.g)/255.0, parseFloat(rgbObj.b)/255.0];
});

const sprite = new THREE.TextureLoader().load( "sprites/disc.png" );
const vertexShader = `
#define PI 3.1415926535

attribute vec3 color;
attribute float hidden;
attribute int dcnn;
attribute float nodeValue;
attribute float nextNodeValue;

uniform float maxPointSize;
uniform float timeToNext;

varying vec3 fragColor;
varying float fragHidden;

vec3 getColor(float nv) {
  if (dcnn != -1) {
    return color;
  }
  if(nv <= 0.0) {
    return vec3(0.0, 0.0, abs(nv)); 
  } else { 
    return vec3(abs(nv), 0.0, 0.0);
  }
}

void main() {
  fragColor = mix(getColor(clamp(nodeValue, -1.0, 1.0)), getColor(clamp(nextNodeValue, -1.0, 1.0)), timeToNext);
  fragHidden = hidden;

  gl_PointSize = maxPointSize * pow(abs(nodeValue), 1.5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const fragmentShader = `
uniform sampler2D tex;

varying float fragHidden;
varying vec3 fragColor;

void main() {

  if(fragHidden > 0.9) discard;
  float texOpacity = texture2D(tex, gl_PointCoord.st).a;
  if(texOpacity < 0.5) discard;
 
  gl_FragColor = vec4(fragColor.rgb, texOpacity);
}
`;

const brainMaterial = new THREE.MeshLambertMaterial();

class BrainScene extends Component {
  contextRef = createRef();

  state = {
    brainData: [],
  }

  async componentDidMount() {
    document.title = "Human Brain Activity";
    this.setState({
      displaySettings: {
        subSelectImgChecked: false,
        subSelectImage: "",
        onlyPredictiveProbes: false,
        colorCoded: false,
        highGammaFrq: false,
        moment: 0,
      },
      playing: false,
      brainOpacity: 0.4,
      initialized: false,
      clock: new THREE.Clock(),
      material: new THREE.ShaderMaterial({
        uniforms: {
          tex: {
            type: "t",
            value: sprite,
          },
          maxPointSize: {
            type: "f",
            value: 25.0,
          },
          timeToNext: {
            type: "f",
            value: 0.0,
          },
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    });
    this.loadModel = this.loadModel.bind(this);
    this.sceneSetup();
    await this.addCustomSceneObjects();
    this.startAnimationLoop();
    window.addEventListener("resize", this.handleWindowResize);
    await this.loadAllNPYs();
    this.setupDots();
    this.setState({initialized: true});
    this.updateDots();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (JSON.stringify(prevState.displaySettings) !== JSON.stringify(this.state.displaySettings)) {
      this.updateDots();
    }
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
    this.renderer = new THREE.WebGLRenderer({alpha: true});
    this.renderer.setClearColor( 0xffffff, 0);
    this.renderer.setSize(width, height);
    this.el.appendChild(this.renderer.domElement); // mount using React ref
  };

  async loadAllNPYs() {
    const brainData = (await getNPY(mniCoords)).data;
    const dcnnLayer = (await getNPY(dcnnLayerFile)).data;
    const resAllFrq = [];// preprocessNpy(await getNPY(resAllFrqFile)).tolist();
    const resAllLfp = preprocessNpy(await getNPY(resAllLfpFile)).tolist();
    const resCtgFrq = [];// preprocessNpy(await getNPY(resCtgFrqFile)).tolist();
    const resCtgLfp = preprocessNpy(await getNPY(resCtgLfpFile)).tolist();
    const predictive = preprocessNpy(await getNPY(predictiveFile)).tolist();

    this.setState({
      brainData,
      dcnnLayer,
      resAllFrq,
      resAllLfp,
      resCtgFrq,
      resCtgLfp,
      predictive,
    });
  }

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
    combinedMaterial.opacity = this.state.brainOpacity;
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
    const delta = this.state.clock && this.state.clock.getDelta();
    // const elapsed = this.state.clock && this.state.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
    // The window.requestAnimationFrame() method tells the browser that you wish to perform
    // an animation and requests that the browser call a specified function
    // to update an animation before the next repaint
    if (!this.state.clock.running && this.state.playing) {
      this.state.clock.start();
    }
    if (this.state.clock.running && !this.state.playing) {
      this.state.clock.stop();
    }
    if (this.state.displaySettings.moment >= maxMoment && this.state.clock.running) {
      this.hooks.togglePlayPause();
      this.state.clock.stop();
    } else if (this.state.clock.running && this.state.playing) {
      this.updateMoment(this.state.displaySettings.moment + 1000*delta/msPerMoment);
    }
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

  updateDots() {
    if (this.state.initialized) {
      const mniData = this.state.brainData;
      const pointCount = mniData.length / 3;
      const color = this.state.dots.geometry.attributes.color;
      const nodeValue = this.state.dots.geometry.attributes.nodeValue;
      const nextNodeValue = this.state.dots.geometry.attributes.nextNodeValue;
      const hidden = this.state.dots.geometry.attributes.hidden;
      const dcnnAttribute = this.state.dots.geometry.attributes.dcnn;

      const {
        colorCoded,
        subSelectImage,
        onlyPredictiveProbes,
        subSelectImgChecked,
        moment,
      } = this.state.displaySettings;

      const timeToNextUniform = this.state.material.uniforms.timeToNext;

      // categories && various datas
      let curMoment;
      let nextMoment;
      let timeToNext;

      if (moment % 1 === 0) {
        curMoment = moment;
        timeToNext = 0.0;
      } else {
        curMoment = Math.floor(moment);
        timeToNext = moment - curMoment;
      }
      timeToNextUniform.value = timeToNext;
      timeToNextUniform.needsUpdate = true;

      nextMoment = curMoment + 1;
      if (curMoment === maxMoment) {
        nextMoment = curMoment;
      }

      console.log(timeToNext);

      for (let i = 0; i < pointCount * 3; i += 3) {
        const pointCoord = i / 3;

        let value;
        let nextValue;

        // hidden check - only if we're colour coding and the electrode does not correspond to any dcnn level
        // or if the index is supposed to be hidden
        const dcnn = Number(this.state.dcnnLayer[pointCoord]);
        // filter out probes with hidden indexes
        if (hiddenIndexes.includes(pointCoord)) {
          continue;
          // filter out non-colored probes if we're using dcnn colour codes
        } else if (colorCoded === true && dcnn === -1) {
          hidden.array[pointCoord] = 1;
          continue;
          // filter out non-predictive probes
        } else if (onlyPredictiveProbes &&
            subSelectImgChecked &&
            subSelectImage !== "" &&
            Number(this.state.predictive[pointCoord][subSelectImage]) === 0) {
          hidden.array[pointCoord] = 1;
          continue;
        } else {
          hidden.array[pointCoord] = 0;
        }


        if (subSelectImgChecked && subSelectImage !== "" && (colorCoded === false || dcnn !== -1)) {
          if (this.state.displaySettings.highGammaFrq) {
            value = (this.state.resCtgFrq[subSelectImage][pointCoord][curMoment] + 3)/6;
            nextValue = (this.state.resCtgFrq[subSelectImage][pointCoord][nextMoment] + 3)/6;
          } else {
            value = (this.state.resCtgLfp[subSelectImage][pointCoord][curMoment] + 100)/200;
            nextValue = (this.state.resCtgLfp[subSelectImage][pointCoord][nextMoment] + 100)/200;
          }
        }
        if (!subSelectImgChecked || subSelectImage === "") {
          if (this.state.displaySettings.highGammaFrq) {
            value = (this.state.resAllFrq[pointCoord][curMoment] + 3)/6;
            nextValue = (this.state.resAllFrq[pointCoord][nextMoment] + 3)/6;
          } else {
            value = (this.state.resAllLfp[pointCoord][curMoment] + 100)/200;
            nextValue = (this.state.resAllLfp[pointCoord][nextMoment] + 100)/200;
          }
        }

        dcnnAttribute.array[pointCoord] = dcnn;
        // handle colours
        if (colorCoded === true && dcnn !== -1) {
          color.array[i] = dcnnColorsRGB[dcnn][0];
          color.array[i + 1] = dcnnColorsRGB[dcnn][1];
          color.array[i + 2] = dcnnColorsRGB[dcnn][2];
        } else {
          dcnnAttribute.array[pointCoord] = -1;
        }
        nodeValue.array[pointCoord] = value * 2 - 1;
        nextNodeValue.array[pointCoord] = nextValue * 2 - 1;
      }

      color.needsUpdate = true;
      hidden.needsUpdate = true;
      nodeValue.needsUpdate = true;
      nextNodeValue.needsUpdate = true;
      dcnnAttribute.needsUpdate = true;
    }
  }

  setupDots() {
    if (this.scene && this.state.brainData) {
      const mniData = this.state.brainData;
      const pointCount = mniData.length / 3;
      const geometry = new THREE.BufferGeometry();

      const position = new Float32Array(pointCount * 3);
      const nodeValue = new Float32Array(pointCount);
      const nextNodeValue = new Float32Array(pointCount);
      const hidden = new Array(pointCount);
      const dcnn = new Int8Array(pointCount);
      const color = new Float32Array(pointCount * 3);

      for (let i = 0; i < pointCount * 3; i += 3) {
        const pointCoord = i / 3;
        dcnn[pointCoord] = -1;
        if (!hiddenIndexes.includes(pointCoord)) {
          const [x, y, z] = [-mniData[i], mniData[i + 2], -mniData[i + 1]];
          position[i] = x;
          position[i + 1] = y;
          position[i + 2] = z;
          nodeValue[pointCoord] = this.state.resAllLfp[pointCoord][this.state.displaySettings.moment]/100;
          nextNodeValue[pointCoord] = this.state.resAllLfp[pointCoord][this.state.displaySettings.moment + 1]/100;
          hidden[pointCoord] = 0;
        } else {
          hidden[pointCoord] = 1;
        }
      }
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
      geometry.setAttribute("hidden", new THREE.Float32BufferAttribute(hidden, 1));
      geometry.setAttribute("nodeValue", new THREE.Float32BufferAttribute(nodeValue, 1));
      geometry.setAttribute("nextNodeValue", new THREE.Float32BufferAttribute(nextNodeValue, 1));
      geometry.setAttribute("dcnn", new THREE.Int32BufferAttribute(dcnn, 1));

      const particles = new THREE.Points( geometry, this.state.material );
      this.scene.add( particles );
      this.setState({dots: particles});
    }
  }

  hooks = {
    subSelectImg: () => {
      this.setState((prevState) =>
        ({displaySettings: {
          ...prevState.displaySettings,
          subSelectImgChecked: !prevState.displaySettings.subSelectImgChecked,
        }}));
    },
    togglePredictiveProbes: () => {
      this.setState((prevState) =>
        ({displaySettings: {
          ...prevState.displaySettings,
          onlyPredictiveProbes: !prevState.displaySettings.onlyPredictiveProbes,
        }}));
    },
    toggleHighGammaFrq: () => {
      this.setState((prevState) =>
        ({displaySettings: {
          ...prevState.displaySettings,
          highGammaFrq: !prevState.displaySettings.highGammaFrq,
        }}));
    },
    toggleSubSelectImg: (value) => {
      this.setState((prevState) =>
        ({displaySettings: {
          ...prevState.displaySettings,
          subSelectImage: prevState.displaySettings.subSelectImage === value ? "" : value,
        }}));
    },
    toggleColorCode: () => {
      this.setState((prevState) =>
        ({displaySettings: {
          ...prevState.displaySettings,
          colorCoded: !prevState.displaySettings.colorCoded,
        }}));
    },
    timeForward: () => {
      if (this.state.displaySettings.moment !== maxMoment) {
        this.updateMoment(this.state.displaySettings.moment + 1);
      }
      if (this.state.displaySettings.moment === maxMoment) {
        this.setState({playing: false});
      }
    },
    timeBackward: () => {
      if (this.state.displaySettings.moment !== 0) {
        this.updateMoment(this.state.displaySettings.moment - 1);
      }
    },
    updateBrainOpacity: (brainOpacity) => {
      this.setState({brainOpacity});
      if (this.state.mesh) {
        const material = this.state.mesh.material;
        material.opacity = brainOpacity;
      }
    },
    togglePlayPause: () => {
      if (this.state.clock.running) {
        this.state.clock.stop();
      } else {
        this.state.clock.start();
        console.log("started clock!");
      }
      this.setState({playing: !this.state.playing});
    },
    resetTime: () => {
      this.setState({playing: false});
      this.updateMoment(0);
    },
  }

  updateMoment = (moment) => {
    this.setState({displaySettings: {...this.state.displaySettings, moment}});
  }


  render() {
    return <Ref innerRef={this.contextRef}>
      <Grid columns={2}>
        <GridColumn width={4} style={{
          paddingLeft: "2rem",
          marginTop: "5rem",
        }}>
          <PageSidebar
            displaySettings={this.state.displaySettings}
            playing={this.state.playing}
            hooks={this.hooks}
            updateMoment={this.updateMoment}
            slider={this.slider}
            brainOpacity={this.state.brainOpacity}
          />
        </GridColumn>
        <GridColumn width={12}>
          <Sticky context={this.contextRef}>
            <PageHeader/>
            <div style={sceneStyle} ref={(ref) => (this.el = ref)}/>
          </Sticky>
        </GridColumn>
      </Grid>
    </Ref>;
  }

  loadModel(loader, scene, model) {
    return new Promise(((resolve, reject) => {
      loader.load(model, (gltf) => resolve(gltf), null, reject);
    }));
  }
}

export {BrainScene};
