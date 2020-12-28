import React, {Component} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import getNPY from "../helpers/getNPY";
import {Button, Image, Grid, GridColumn, Checkbox, Header} from "semantic-ui-react";
import {Slider} from "react-semantic-ui-range";
import mniCoords from "../helpers/mni_coordinates.npy";
import dcnnLayerFile from "../helpers/dcnn_layer.npy";
import resAllFrqFile from "../helpers/neural_responses_all_frq.npy";
import resAllLfpFile from "../helpers/neural_responses_all_lfp.npy";
import resCtgFrqFile from "../helpers/neural_responses_ctg_frq.npy";
import resCtgLfpFile from "../helpers/neural_responses_ctg_lfp.npy";
import predictiveFile from "../helpers/predictive.npy";
import {hiddenIndexes, hexToRgb, preprocessNpy, redWhiteBlueGradient, momentToMs} from "../helpers/Utility";

const style = {
  height: 750, // we can control scene size by setting container dimensions
};

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

const categories = [
  "house",
  "face",
  "animal",
  "scene",
  "tool",
  "pseudoword",
  "characters",
  "noise",
];

const categoryDropdownOptions = categories.map((cat, i) => {
  return {key: cat, text: cat, value: i.toString()};// content: contentElement(colors[i], cat)};
});

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
    this.setState({
      displaySettings: {
        subSelectImgChecked: false,
        subSelectImage: "",
        onlyPredictiveProbes: false,
        colorCoded: false,
        highGammaFrq: false,
        moment: 0,
      },
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
            value: 20.0,
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
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(width, height);
    this.el.appendChild(this.renderer.domElement); // mount using React ref
  };

  async loadAllNPYs() {
    const brainData = (await getNPY(mniCoords)).data;
    const dcnnLayer = (await getNPY(dcnnLayerFile)).data;
    const resAllFrq = preprocessNpy(await getNPY(resAllFrqFile)).tolist();
    const resAllLfp = preprocessNpy(await getNPY(resAllLfpFile)).tolist();
    const resCtgFrq = preprocessNpy(await getNPY(resCtgFrqFile)).tolist();
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
    // const elapsed = this.state.clock && this.state.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
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

  updateDots() {
    if (this.state.initialized) {
      const mniData = this.state.brainData;
      const pointCount = mniData.length / 3;
      const color = this.state.dots.geometry.attributes.color;
      const opacity = this.state.dots.geometry.attributes.opacity;
      const {
        colorCoded,
        subSelectImage,
        onlyPredictiveProbes,
        subSelectImgChecked,
        moment,
      } = this.state.displaySettings;
      console.log(onlyPredictiveProbes);
      for (let i = 0; i < pointCount * 3; i += 3) {
        const pointCoord = i / 3;

        let value;
        let prevValue;
        let hidden;

        // categories && various datas
        if (subSelectImgChecked && subSelectImage !== "" && (colorCoded === false || dcnn !== -1)) {
          if (this.state.displaySettings.highGammaFrq) {
            value = (this.state.resCtgFrq[subSelectImage][pointCoord][moment] + 3)/6;
            prevValue = moment === 0 ? value : (this.state.resCtgFrq[subSelectImage][pointCoord][moment - 1] + 3)/6;
          } else {
            value = (this.state.resCtgLfp[subSelectImage][pointCoord][moment] + 100)/200;
            prevValue = moment === 0 ? value : (this.state.resCtgLfp[subSelectImage][pointCoord][moment - 1] + 100)/200;
          }
        }
        if (!subSelectImgChecked || subSelectImage === "") {
          if (this.state.displaySettings.highGammaFrq) {
            value = (this.state.resAllFrq[pointCoord][moment] + 3)/6;
            prevValue = moment === 0 ? value : (this.state.resAllFrq[pointCoord][moment - 1] + 3)/6;
          } else {
            value = (this.state.resAllLfp[pointCoord][moment] + 100)/200;
            prevValue = moment === 0 ? value : (this.state.resAllLfp[pointCoord][moment - 1] + 100)/200;
          }
        }

        // dcnn settings
        const dcnn = Number(this.state.dcnnLayer[pointCoord]);
        if (colorCoded === true) {
          if (dcnn !== -1) {
            color.array[i] = dcnnColorsRGB[dcnn][0];
            color.array[i + 1] = dcnnColorsRGB[dcnn][1];
            color.array[i + 2] = dcnnColorsRGB[dcnn][2];
          } else {
            hidden = true;
            opacity.array[pointCoord] = 0.0;
          }
        } else {
          opacity.array[pointCoord] = 1.0;
          const gradientColor = redWhiteBlueGradient(value - prevValue);
          color.array[i] = gradientColor[0];
          color.array[i + 1] = gradientColor[1];
          color.array[i + 2] = gradientColor[2];
        }

        if (!hidden) opacity.array[pointCoord] = value;

        if (onlyPredictiveProbes &&
            subSelectImgChecked &&
            subSelectImage !== "" &&
            Number(this.state.predictive[pointCoord][subSelectImage]) === 0) {
          opacity.array[pointCoord] = 0.0;
        }
      }

      color.needsUpdate = true;
      opacity.needsUpdate = true;
    }
  }

  setupDots() {
    if (this.scene) {
      const mniData = this.state.brainData;
      const pointCount = mniData.length / 3;
      const geometry = new THREE.BufferGeometry();

      const position = new Float32Array(pointCount * 3);
      const opacity = new Float32Array(pointCount);
      const hidden = new Array(pointCount);
      const color = new Float32Array(pointCount * 3);
      console.log(mniData);
      for (let i = 0; i < pointCount * 3; i += 3) {
        const pointCoord = i / 3;
        if (!hiddenIndexes.includes(pointCoord)) {
          const [x, y, z] = [-mniData[i], mniData[i + 2], -mniData[i + 1]];
          position[i] = x;
          position[i + 1] = y;
          position[i + 2] = z;
          color[i] = 1.0;
          color[i + 1] = 1.0;
          color[i + 2] = 1.0;
          /* const point = new THREE.Vector3(x, y, z);
          const raycaster = new THREE.Raycaster();
          raycaster.set(point, new THREE.Vector3(0, 0, 1));
          const intersects = raycaster.intersectObject(mesh);
          if (intersects.length > 0) { // Points is in object
            color[i] = 1.0;
            color[i + 1] = 1.0;
            color[i + 2] = 1.0;
            // hidden[pointCoord] = false;
            // console.log("Point is in object");
          } else {
            color[i] = 1.0;
            color[i + 1] = 0.2;
            color[i + 2] = 0.2;
            // hidden[pointCoord] = true;
            hiddenIndexes.push(pointCoord);
            // opacity[pointCoord] = 0.0;
            // console.log("Point is NOT in object");
          }
          /* for (let i = 0; i < hidden.length; i += 1) {
            if (hidden[i] == true) {
              hiddenIndexes.push(i);
            }
          } */
          opacity[pointCoord] = (this.state.resAllLfp[pointCoord][this.state.displaySettings.moment] + 100)/200;
        }
      }
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute("opacity", new THREE.BufferAttribute(opacity, 1));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));

      const particles = new THREE.Points( geometry, this.state.material );
      particles.initialOpacities = [...opacity];
      particles.hidden = hidden;
      this.scene.add( particles );
      this.setState({dots: particles});
    }
  }

  subSelectImg = () => {
    this.setState((prevState) =>
      ({displaySettings: {
        ...prevState.displaySettings,
        subSelectImgChecked: !prevState.displaySettings.subSelectImgChecked,
      }}));
  };
  togglePredictiveProbes = () => {
    this.setState((prevState) =>
      ({displaySettings: {
        ...prevState.displaySettings,
        onlyPredictiveProbes: !prevState.displaySettings.onlyPredictiveProbes,
      }}));
  };
  toggleHighGammaFrq = () => {
    this.setState((prevState) =>
      ({displaySettings: {
        ...prevState.displaySettings,
        highGammaFrq: !prevState.displaySettings.highGammaFrq,
      }}));
  };
  toggleSubSelectImg = (value) => {
    this.setState((prevState) =>
      ({displaySettings: {
        ...prevState.displaySettings,
        subSelectImage: prevState.displaySettings.subSelectImage === value ? "" : value,
      }}));
  };
  toggleColorCode = () => {
    this.setState((prevState) =>
      ({displaySettings: {
        ...prevState.displaySettings,
        colorCoded: !prevState.displaySettings.colorCoded,
      }}));
  };
  updateMoment = (moment) => {
    this.setState({displaySettings: {...this.state.displaySettings, moment}});
  }

  render() {
    const displaySettings = this.state.displaySettings;
    // console.log(displaySettings);

    return <Grid columns={2}>
      {displaySettings &&
      <GridColumn width={4}>
        <Checkbox
          toggle
          label='Sub-select stimulus image category'
          onChange={this.subSelectImg}
          checked={this.state.displaySettings.subSelectImgChecked}
        />
        {
          this.state.displaySettings.subSelectImgChecked &&
          <Grid columns={4} style={{margin: "0.5rem"}}>
            {categoryDropdownOptions.map(({key, text, value}) =>
              <GridColumn
                key={key}
                width={4}
                style={{
                  padding: "0rem",
                }}>
                <Button
                  style={{padding: "0rem"}}
                  fluid
                  positive={this.state.displaySettings.subSelectImage === value}
                  onClick={() => this.toggleSubSelectImg(value)}>
                  <Image
                    src='https://react.semantic-ui.com/images/wireframe/paragraph.png'/>
                  {/* <Label attached="bottom">{text}</Label> */}
                  <p>{text}</p>
                </Button>
              </GridColumn>)}
          </Grid>
        }
        {
          this.state.displaySettings.subSelectImgChecked &&
          <Checkbox
            toggle
            label="Show only predictive probes"
            onChange={this.togglePredictiveProbes}
            checked={this.state.displaySettings.onlyPredictiveProbes}
          />
        }
        <Checkbox
          toggle
          label="Baseline-normalized neural responses in high gamma"
          onChange={this.toggleHighGammaFrq}
          checked={this.state.displaySettings.highGammaFrq}
        />
        <Checkbox
          toggle
          label="Color-code the probes to reflect visual complexity of their representations based on DCNN mapping"
          onChange={this.toggleColorCode}
          checked={this.state.displaySettings.colorCoded}
        />
        <Header>Time: {momentToMs(this.state.displaySettings.moment)}</Header>
        <Slider
          value={this.state.displaySettings.moment}
          discrete
          color="red"
          settings={{
            start: 0,
            min: 0,
            max: 47,
            step: 1,
            onChange: this.updateMoment,
          }}
        />
      </GridColumn>}
      <GridColumn width={12}>
        <div style={style} ref={(ref) => (this.el = ref)}/>
      </GridColumn>
    </Grid>;
  }

  loadModel(loader, scene, model) {
    return new Promise(((resolve, reject) => {
      loader.load(model, (gltf) => resolve(gltf), null, reject);
    }));
  }
}

export {BrainScene};
