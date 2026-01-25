/** @type {import("three")} */
const THREE = window.THREE;

const scene = document.getElementById("scene");
scene.addEventListener(
  "enter-vr",
  async () => {
    await waitForAnchor();
    loadPetTransform();
    anchor.setAttribute("visible", "true");
  },
  { once: true }
);

// PET
const petEntity = document.getElementById("pet");
const petPosition = new THREE.Vector3();
const setPetPosition = (newPetPosition) => {
  petPosition.copy(newPetPosition);
  console.log("petPosition", petPosition);
  petEntity.object3D.position.copy(petPosition);
};

const petEuler = new THREE.Euler(0, 0, 0, "YXZ");
const offsetPetEulerPitch = (pitchOffset) => {
  petEuler.x += pitchOffset;
  onPetEulerUpdate();
};
const offsetPetEulerYaw = (yawOffset) => {
  petEuler.y += yawOffset;
  onPetEulerUpdate();
};
const offsetPetEulerRoll = (rollOffset) => {
  petEuler.z += rollOffset;
  onPetEulerUpdate();
};

const setPetEuler = (newPetEuler) => {
  petEuler.copy(newPetEuler);
  onPetEulerUpdate();
};
const onPetEulerUpdate = () => {
  console.log("petEuler", petEuler);
  petEntity.object3D.rotation.copy(petEuler);
};

/** @typedef {import("three").Object3D} Object3D */

/** @param {Object3D} object3D */
const getRelativeTransform = (object3D) => {
  const relativeMatrix = new THREE.Matrix4();
  const inverseRelativeMatrix = new THREE.Matrix4()
    .copy(anchor.object3D.matrixWorld)
    .invert();

  const relativePosition = new THREE.Vector3();
  const relativeQuaternion = new THREE.Quaternion();
  const relativeScale = new THREE.Vector3();

  relativeMatrix.multiplyMatrices(inverseRelativeMatrix, object3D.matrixWorld);

  relativeMatrix.decompose(relativePosition, relativeQuaternion, relativeScale);

  const transform = {
    position: relativePosition,
    quaternion: relativeQuaternion,
    scale: relativeScale,
  };

  return transform;
};

/** @param {string} transformString */
const loadRelativeTransform = (transformString) => {
  const relativePosition = new THREE.Vector3();
  const relativeQuaternion = new THREE.Quaternion();
  const relativeScale = new THREE.Vector3();

  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();

  const localMatrix = new THREE.Matrix4();
  const referenceMatrix = new THREE.Matrix4().copy(anchor.object3D.matrixWorld);
  const worldMatrix = new THREE.Matrix4();

  const {
    position: positionArray,
    quaternion: quaternionArray,
    scale: scaleArray,
  } = JSON.parse(transformString);
  relativePosition.set(...positionArray);
  relativeQuaternion.set(...quaternionArray);
  relativeScale.set(...scaleArray);

  localMatrix.compose(relativePosition, relativeQuaternion, relativeScale);
  worldMatrix.multiplyMatrices(referenceMatrix, localMatrix);
  worldMatrix.decompose(worldPosition, worldQuaternion, worldScale);

  const worldEuler = new THREE.Euler().setFromQuaternion(worldQuaternion);

  return {
    position: worldPosition,
    quaternion: worldQuaternion,
    scale: worldScale,
    euler: worldEuler,
  };
};

const petTransformLocalStorageKey = "petTransform";
const savePetTransform = () => {
  console.log("savePetTransform");

  const { position, scale, quaternion } = getRelativeTransform(
    petEntity.object3D
  );

  const transform = {
    position: position.toArray(),
    quaternion: quaternion.toArray(),
    scale: scale.toArray(),
  };

  localStorage.setItem(petTransformLocalStorageKey, JSON.stringify(transform));
};
const loadPetTransform = () => {
  console.log("loadPetTransform");
  const petTransformString = localStorage.getItem(petTransformLocalStorageKey);
  if (!petTransformString) {
    return;
  }

  try {
    const { position, euler } = loadRelativeTransform(petTransformString);
    setPetPosition(position);
    setPetEuler(euler);
  } catch (error) {
    console.error("error parsing petTransform", error);
  }
};

// PET RIG
const petYawEntity = petEntity.querySelector(".yaw");
const petPitch1Entity = petEntity.querySelector(".pitch");
const petPitch2Entity = petEntity.querySelector(".pitch2");
const petHeadEntity = petEntity.querySelector(".head");

const { degToRad } = THREE.MathUtils;

/** @type {Record<string, number[]>} */
const angleOffsets = {
  servos: [20, -72],
  steppers: [0],
};

const angleEntities = petEntity.querySelectorAll("[data-angle-type]");
console.log("angleEntities", angleEntities);
const updateAnglesEntities = () => {
  angleEntities.forEach((entity) => {
    let { angleType, angleIndex, angleAxis, angleSign } = entity.dataset;
    angleSign ??= 1;
    const angle =
      angles[angleType][angleIndex] * angleSign +
      angleOffsets[angleType][angleIndex];
    const axis = entity.dataset.angleAxis;
    entity.object3D.rotation[axis] = degToRad(angle);
  });
};

// CONTROLLERS
const controllers = {
  left: document.getElementById("leftController"),
  right: document.getElementById("rightController"),
};

// CONTROLLER RAYCASTER
const raycasterDebug = document.getElementById("raycasterDebug");
const raycasterIntersection = new THREE.Vector3();
const setRaycasterIntersection = (newRaycasterIntersection) => {
  raycasterIntersection.copy(newRaycasterIntersection);
  raycasterDebug.object3D.position.copy(raycasterIntersection);
};

let isRaycasterIntersected = false;
const setIsRaycasterIntersected = (newIsRaycasterIntersected) => {
  isRaycasterIntersected = newIsRaycasterIntersected;
  console.log({ isRaycasterIntersected });
  raycasterDebug.object3D.visible = isRaycasterIntersected;
};
controllers.right.addEventListener("raycaster-intersection", (event) => {
  setIsRaycasterIntersected(true);
});
controllers.right.addEventListener("raycaster-intersected-cleared", (event) => {
  setIsRaycasterIntersected(false);
});

AFRAME.registerComponent("raycast-poll", {
  tick() {
    const raycaster = this.el.components.raycaster;
    if (!raycaster) return;

    const intersections = raycaster.intersections;
    if (!intersections || intersections.length === 0) return;

    const hit = intersections[0]; // closest hit
    const { point, distance } = hit;

    //console.log(point, distance);
    setRaycasterIntersection(point);
  },
});
controllers.right.setAttribute("raycast-poll", "");

// SETUP PET POSITION
controllers.right.addEventListener("abuttondown", (event) => {
  if (!isRaycasterIntersected) {
    return;
  }
  setPetPosition(raycasterIntersection);
});
const debugEntities = scene.querySelectorAll(".debug");
console.log("debugEntities", debugEntities);
let showDebugEntities = false;
const setShowDebugEntities = (newShowDebugEntities) => {
  showDebugEntities = newShowDebugEntities;
  console.log({ showDebugEntities });
  debugEntities.forEach(
    (entity) => (entity.object3D.visible = showDebugEntities)
  );
};
window.setShowDebugEntities = setShowDebugEntities;
controllers.right.addEventListener("bbuttondown", (event) => {
  setShowDebugEntities(!showDebugEntities);
});

// SETUP PET ROTATION
window.offsetPetEulerScalars = { yaw: -0.03, pitch: 0.03, roll: -0.03 };
controllers.right.addEventListener("thumbstickmoved", (event) => {
  const { x } = event.detail;
  //   console.log({ x });
  offsetPetEulerYaw(x * offsetPetEulerScalars.yaw);
});

controllers.left.addEventListener("thumbstickmoved", (event) => {
  const { x, y } = event.detail;
  // console.log({ x,y });
  offsetPetEulerPitch(y * offsetPetEulerScalars.pitch);
  offsetPetEulerRoll(x * offsetPetEulerScalars.roll);
});

// HAND TRACKING
const handTracking = {
  left: document.getElementById("leftHand"),
  right: document.getElementById("rightHand"),
};

AFRAME.registerComponent("hand-tracking-poll", {
  tick() {
    const handTrackingComponent = this.el.components["hand-tracking-controls"];
    if (!handTrackingComponent || !handTrackingComponent.controllerPresent) {
      return;
    }
    const { indexTipPosition } = handTrackingComponent;
    const { hand: side } = handTrackingComponent.data;
    if (side == "right") {
      // console.log(
      //   new THREE.Vector3().subVectors(indexTipPosition, petPosition).length()
      // );
    }
  },
});
console.log("handTracking", handTracking);
for (const side in handTracking) {
  handTracking[side].setAttribute("hand-tracking-poll", "");
}

// ANCHOR
const anchor = document.getElementById("anchor");
const waitForAnchor = async () => {
  return new Promise((resolve) => {
    let intervalId, timeoutId;
    intervalId = setInterval(() => {
      if (anchor.components["anchored"]?.anchor) {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        resolve(true);
      }
    }, 200);

    timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      console.log("no anchor found");
      resolve(false);
    }, 3000);
  });
};

window.addEventListener("beforeunload", () => {
  savePetTransform();
});

// EYE TRACKING
// FILL

const getRelativeOrientation = (quaternion, position) => {
  // FILL
  const lookAtEuler = new THREE.Euler();
};

// TEST DOGGY
/** @typedef {import("three").Material} Material */
/** @typedef {import("three").Texture} Texture */
/** @type {Record<name, Material} */
const testDoggyMaterials = {};
window.testDoggyMaterials = testDoggyMaterials;
const testDoggyEntity = document.getElementById("testDoggy");
testDoggyEntity.addEventListener("model-loaded", () => {
  const root = testDoggyEntity.getObject3D("mesh");
  if (!root) return;

  root.traverse((node) => {
    if (!node.isMesh) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    materials.forEach((material, index) => {
      testDoggyMaterials[material.name] = material;

      // console.log("node", node);
      // console.log("material", material);

      const textures = {
        map: material.map,
        normalMap: material.normalMap,
        roughnessMap: material.roughnessMap,
        metalnessMap: material.metalnessMap,
        emissiveMap: material.emissiveMap,
        aoMap: material.aoMap,
        alphaMap: material.alphaMap,
      };

      Object.entries(textures).forEach(([key, texture]) => {
        if (!texture) return;
        console.log(`  ${key}:`, {
          uuid: texture.uuid,
          image: texture.image,
          source: texture.image?.src,
        });
      });
    });
  });
});

const testDoggyPupilRange = {
  x: 0.13,
  y: 0.15,
};
const lerp = (halfRange, interpolation) => {
  return THREE.MathUtils.lerp(-halfRange, halfRange, interpolation);
};
const setTestDoggyPupil = (x, y, startAtNegativeOne = false) => {
  if (startAtNegativeOne) {
    x = THREE.MathUtils.inverseLerp(-1, 1, x);
    y = THREE.MathUtils.inverseLerp(-1, 1, y);
  }
  testDoggyMaterials.Pupil.map.offset.x = lerp(testDoggyPupilRange.x, x);
  testDoggyMaterials.Pupil.map.offset.y = lerp(testDoggyPupilRange.y, y);
};
window.setTestDoggyPupil = setTestDoggyPupil;

const testDoggy = false;
if (testDoggy) {
  testDoggyEntity.setAttribute("visible", "true");
  scene.addEventListener("mousemove", (event) => {
    const { offsetX, offsetY } = event;
    const x = 1 - offsetX / scene.clientWidth;
    const y = 1 - offsetY / scene.clientHeight;
    //console.log({ x, y });
    setTestDoggyPupil(x, y);
  });
}

// TEST DOGGY 2
const lindasDogEntity = document.getElementById("lindasDog");
/** @typedef {import("three").Object3D} Object3D */
/** @type {Record<string, Object3D>} */
const lindasDogMeshes = {};
window.lindasDogMeshes = lindasDogMeshes;
lindasDogEntity.addEventListener("model-loaded", () => {
  const root = lindasDogEntity.getObject3D("mesh");
  if (!root) return;

  root.traverse((node) => {
    if (!node.isMesh) return;
    lindasDogMeshes[node.name] = node;
  });
  console.log("lindasDogMeshes", lindasDogMeshes);
});

const allLindasDogMeshNames = [
  "SM_EyePatch_4_L_Down",
  "SM_EyePatch_3_R_Serious",
  "SM_EyePatch_3_L_Serious",
  "SM_EyePatch_2_R_Default",
  "SM_EyePatch_2_L_Default",
  "SM_EyePatch_1_R_Close",
  "SM_EyePatch_1_L_Close",
  "SM_EyeBrows",
  "SM_Ear2",
  "SM_Ear1",
  "SM_Body",
  "SM_Tail",
  "SM_Pupil_4_R_Star",
  "SM_Pupil_4_L_Star",
  "SM_Pupil_3_R_Emotional",
  "SM_Pupil_3_L_Emotional",
  "SM_Pupil_2_R_Heart",
  "SM_Pupil_2_L_Heart",
  "SM_Pupil_1_R__default",
  "SM_Pupil_1_L_default",
  "SM_Nose",
  "SM_Mouse_5_NOMouse",
  "SM_Mouse_4_Tongue",
  "SM_Mouse_3_W",
  "SM_Mouse_2_C",
  "SM_Mouse_1_o",
  "SM_Head1",
  "SM_EyePatch_4_R_Down",
];
const lindasDogMeshNames = allLindasDogMeshNames.filter(
  (name) => name.includes("EyePatch") && name.includes("L")
);

const testLindasDogMeshes = false;
const showLindasDogMeshNames = (...names) => {
  //console.log("names", names);
  //console.log("lindasDogMeshNames", lindasDogMeshNames, lindasDogMeshes);

  lindasDogMeshNames
    .map((name) => lindasDogMeshes[name])
    .filter(Boolean)
    .forEach((object3D) => {
      object3D.visible = names.includes(object3D.name);
    });
};
window.showLindasDogMeshNames = showLindasDogMeshNames;
if (testLindasDogMeshes) {
  lindasDogEntity.setAttribute("visible", "true");
  showLindasDogMeshNames();
  scene.addEventListener("mousemove", (event) => {
    const { offsetX, offsetY } = event;
    const x = offsetX / scene.clientWidth;
    const showIndex = Math.floor(x * lindasDogMeshNames.length);
    showLindasDogMeshNames(lindasDogMeshNames[showIndex]);
  });
}

// QUEST TRACKING
// FILL - track relative headset transform
// FILL - track relative hand transform

// Socket.io
/** @type {import("socket.io-client")} */
const ioClient = window.io;
const { io } = ioClient;

const unoSocketAddress = false
  ? "http://localhost:6171"
  : "https://mit-uno-q.ngrok.app";
const unoSocket = io(unoSocketAddress);
unoSocket.on("connect", () => {
  console.log("connected to uno");
  unoSocket.emit("get_angles", {});
});
unoSocket.on("disconnect", () => {
  console.log("disconnected from uno");
});
let angles = {
  servos: [0, 0],
  steppers: [0],
};
const throttleRate = 20;
const updateAngles = (newAngles) => {
  angles = newAngles;
  console.log("angles", angles);
  updateAnglesUI();
  updateAnglesEntities();
};
let setAngles = (newAngles) => {
  unoSocket.emit("set_angles", newAngles);
};
setAngles = AFRAME.utils.throttleLeadingAndTrailing(setAngles, throttleRate);
unoSocket.on("get_angles", (newAngles) => {
  console.log("get_angles", newAngles);
  updateAngles(newAngles);
});

/** @type {Record<string, {min: number, max: number}[]>} */
const angleInputRanges = {
  servos: [
    { min: 0, max: 160 },
    { min: 0, max: 160 },
  ],
  steppers: [{ min: -180, max: 180 }],
};

// UI
const anglesContainer = document.getElementById("angles");
const stepperAnglesContainer = document.getElementById("steppers");
const servoAnglesContainer = document.getElementById("servos");
/** @type {Record<string, HTMLElement[]>} */
const angleContainers = {
  servos: [],
  steppers: [],
};
/** @type {HTMLTemplateElement} */
const angleTemplate = document.getElementById("angleTemplate");
const updateAnglesUI = () => {
  Object.entries(angles).forEach(([type, angles]) => {
    angles.forEach((angle, index) => {
      let container = angleContainers[type][index];
      if (!container) {
        container = angleTemplate.content
          .cloneNode(true)
          .querySelector(".angle");
        const containerParent =
          type == "servos" ? servoAnglesContainer : stepperAnglesContainer;
        containerParent.appendChild(container);

        container.querySelector("span.index").innerText = index;
        container.querySelector("span.type").innerText = type;

        let setAngle = (angle) => {
          unoSocket.emit("set_angle", { type, angle, index });
        };
        setAngle = AFRAME.utils.throttleLeadingAndTrailing(
          setAngle,
          throttleRate
        );
        container.querySelectorAll("input").forEach((input) => {
          const { min, max } = angleInputRanges[type][index];
          input.step = 1;
          input.min = min;
          input.max = max;
          input.addEventListener("input", () => {
            setAngle(+input.value);
          });
        });

        angleContainers[type][index] = container;
      }
      container.querySelectorAll("input").forEach((input) => {
        if (input.isChanging) {
          return;
        }
        input.value = angle;
      });
    });
  });
};
updateAnglesUI();

// FILL - get/set quest head/hands

window.unoSocket = unoSocket;
