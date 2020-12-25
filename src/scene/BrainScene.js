import React, {Component} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import getNPY from "../helpers/getNPY";
import {Container, Dropdown, Icon} from "semantic-ui-react";

const style = {
  height: 750, // we can control scene size by setting container dimensions
};

const defaultPeriod = 4;
const colors = [
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

const contentElement = (color, text) => {
  return <div ><Icon style={{color: color}} name={"circle"}/>{text}</div>;
};

const dropdownOptions = colors.map((c, i) => {
  return {key: i.toString(), text: i.toString(), value: i.toString(), content: contentElement(c, i)};
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
      // const mesh = this.state.mesh;
      const mniData = this.state.brainData.data;
      const pointCount = mniData.length / 3;
      const geometry = new THREE.BufferGeometry();

      const position = new Float32Array(pointCount * 3);
      const opacity = new Float32Array(pointCount);
      const hidden = new Array(pointCount);
      const color = new Float32Array(pointCount * 3);
      const hiddenIndexes = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
        24, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 85, 86, 87, 88, 97,
        98, 99, 105, 106, 107, 108, 109, 110, 111, 112, 113, 116, 121, 122,
        123, 124, 462, 463, 587, 617, 1213, 1223, 1225, 2329, 2330, 2331, 2332,
        2333, 2334, 2942, 2985, 2994, 3243, 3244, 3266, 3433, 3449, 3450, 3457,
        3458, 3459, 3495, 3496, 3497, 3560, 3561, 3562, 3563, 3564, 3570, 3571,
        3572, 3573, 3864, 3865, 3912, 3913, 3923, 3924, 3939, 3944, 3945, 3946,
        3947, 3948, 3949, 4069, 4070, 4084, 4192, 4217, 4643, 4651, 4656, 4657,
        4668, 4703, 4815, 4816, 4817, 5008, 5010, 5032, 5033, 5034, 5035, 5036,
        5037, 5137, 5138, 5183, 5255, 5288, 5289, 5291, 5296, 5297, 5298, 5323,
        6052, 6281, 6282, 6283, 6284, 6301, 6341, 6342, 6352, 6353, 6943, 6944,
        6945, 6946, 6947, 7360, 7545, 7733, 7737, 7739, 7784, 7880, 7882, 7883,
        8446, 8455, 8507, 9217, 9850, 10162, 10493, 10494, 10495, 10661, 10700,
        10719, 10975, 10976, 10981, 11060, 11079, 11085, 11113, 11116, 11214, 11215,
        11216, 11270, 11271, 10246, 6174, 8228, 6210, 6211, 6212, 6213, 6218, 8268,
        8269, 10360, 6265, 10361, 10362, 10363, 10369, 2187, 6285, 6286, 146, 147, 148,
        4255, 4256, 4257, 4258, 4259, 4260, 4261, 10437, 10438, 10439, 6354, 4309, 4310,
        4311, 4312, 4313, 4314, 4315, 4316, 10453, 10454, 10455, 10510, 10511, 10512, 10524,
        10525, 10526, 10527, 10528, 10529, 2354, 8522, 331, 8523, 2385, 2386, 8537, 2393, 2394,
        2395, 2396, 2397, 2401, 2402, 2403, 356, 357, 358, 2404, 2405, 2406, 2407, 2408,
        2409, 2410, 2411, 10605, 10606, 10611, 10618, 9852, 9853, 424, 425, 436, 437, 438,
        439, 440, 8630, 8637, 8638, 446, 447, 448, 449, 450, 451, 452, 453, 454, 8639,
        6607, 6652, 2559, 8715, 8716, 8717, 8718, 8719, 8731, 10794, 10795, 10796, 10797,
        10798, 10799, 568, 10835, 6740, 6741, 2648, 8792, 8793, 8794, 8795, 8796, 6763,
        10865, 10866, 631, 10872, 10873, 4732, 4733, 2689, 2690, 2691, 2692, 10883, 10884,
        4743, 10885, 10886, 10887, 2701, 2702, 6799, 10895, 10896, 10897, 10898, 10899,
        10900, 10901, 10903, 10904, 10902, 6810, 8859, 8862, 10912, 10913, 8868, 8869,
        8878, 6832, 6833, 4787, 4788, 10931, 10932, 8890, 6843, 8891, 8892, 8894, 8895,
        8900, 8901, 2758, 8906, 8907, 2764, 8908, 8909, 8910, 8911, 8912, 8913, 8914,
        8932, 6908, 6909, 6910, 6911, 6912, 780, 781, 2852, 2853, 8999, 2856, 2857, 2859,
        2860, 2861, 2862, 2863, 11057, 9051, 9052, 9053, 9054, 9055, 9056, 9057, 9059, 9079,
        7063, 939, 7096, 5058, 5059, 964, 5060, 5061, 971, 972, 977, 978, 979, 980, 990,
        991, 992, 996, 7141, 7142, 1004, 1018, 1019, 1020, 1021, 3078, 3079, 3080, 9254,
        9255, 9275, 3161, 9330, 1145, 1146, 1147, 1148, 5251, 9393, 9394, 9395, 9396, 9419,
        9420, 9421, 5324, 9425, 9461, 9462, 9463, 7430, 5399, 5400, 1343, 1344, 1345, 1346,
        1347, 1348, 9552, 9564, 9565, 1375, 3434, 3435, 9579, 1391, 9585, 9586, 9587, 9588,
        9589, 9590, 9591, 9592, 9593, 9594, 9595, 9596, 1401, 1402, 1403, 1404, 1405, 3451,
        9597, 9599, 3469, 3470, 9623, 3494, 3499, 7601, 3506, 5563, 3574, 5654, 1560, 1561,
        1562, 1563, 1564, 1565, 1566, 1567, 1568, 1569, 1570, 3656, 3657, 3658, 3659, 3660,
        3663, 1620, 7769, 7770, 7771, 3685, 3686, 3697, 3698, 1657, 1658, 9851, 1659, 1660,
        1661, 1662, 9856, 1663, 1664, 1665, 1666, 1667, 7812, 9854, 9855, 3721, 9857, 9858,
        9859, 9860, 9861, 9862, 9863, 9864, 9865, 9869, 9870, 9871, 9876, 9877, 9878, 9879,
        9880, 9881, 9882, 9883, 9884, 9885, 9886, 9887, 9888, 9889, 9890, 9891, 9892, 9893,
        9894, 9895, 9896, 9897, 9898, 9899, 9900, 9901, 9902, 9903, 5810, 9904, 9905, 9906,
        9907, 5840, 5841, 9936, 9937, 3796, 9938, 9941, 9942, 9943, 7925, 7978, 7996, 7997,
        7998, 1893, 1897, 10097, 1919, 1927, 1928, 1929, 1930, 1931, 10121, 10133, 10134,
        10135, 10142, 10143, 10144, 10147, 10150, 10151, 10169, 10170, 2005, 2019, 8173,
        8174, 2042, 6209, 5698, 7778, 7687, 10924, 4653, 2190, 7502, 2771, 3191, 3928, 5790];

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
          opacity[pointCoord] = Math.random();
        }
      }
      // console.log(JSON.stringify(hiddenIndexes));
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
    }
  }

  render() {
    return <Container>
      <Dropdown
        multiple
        text={"Select image category"}
        selection
        fluid
        button
        options={dropdownOptions}
      />
      <div style={style} ref={(ref) => (this.el = ref)}/>
    </Container>;
    // return ;
  }

  loadModel(loader, scene, model) {
    return new Promise(((resolve, reject) => {
      loader.load(model, (gltf) => resolve(gltf), null, reject);
    }));
  }
}

export {BrainScene};
