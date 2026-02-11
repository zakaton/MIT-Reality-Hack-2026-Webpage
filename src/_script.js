/** @type {import("three")} */
const THREE = window.THREE;

const camera = document.getElementById("camera");

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

const wait = async (delay) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), delay);
  });
};
window.wait = wait;

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
  servo: [20, -72 - 45],
  stepper: [0],
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
  toggleShowDebugEntities();
});
const toggleShowDebugEntities = () => setShowDebugEntities(!showDebugEntities);
window.toggleShowDebugEntities = toggleShowDebugEntities;
scene.addEventListener("loaded", () => {
  setShowDebugEntities(true);
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

let isBeingPetSides = {
  left: false,
  right: false,
};
window.petThreshold = 0.12;
AFRAME.registerComponent("hand-tracking-poll", {
  tick() {
    const handTrackingComponent = this.el.components["hand-tracking-controls"];
    if (!handTrackingComponent || !handTrackingComponent.controllerPresent) {
      return;
    }
    const { indexTipPosition } = handTrackingComponent;
    const { hand: side } = handTrackingComponent.data;
    const petHeadPosition = petHeadEntity.object3D.getWorldPosition(
      new THREE.Vector3()
    );
    const distance = new THREE.Vector3()
      .subVectors(indexTipPosition, petHeadPosition)
      .length();
    //console.log({ distance, side, petThreshold });
    isBeingPetSides[side] = distance < window.petThreshold;
    const newIsBeingPet = isBeingPetSides.left || isBeingPetSides.right;
    //console.log(isBeingPetSides);
    setIsBeingPet(newIsBeingPet);
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

// SHOW
const lindasDogEntity = document.getElementById("lindasDog");
const showLindasDog = () => {
  lindasDogEntity.object3D.visible = true;
};
window.showLindasDog = showLindasDog;

// LINDA EYE TRACKING
/** @type {Record<name, Material} */
const lindasDogMaterials = {};
window.lindasDogMaterials = lindasDogMaterials;
lindasDogEntity.addEventListener("model-loaded", () => {
  const root = lindasDogEntity.getObject3D("mesh");
  if (!root) return;

  root.traverse((node) => {
    if (!node.isMesh) return;

    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];

    materials.forEach((material, index) => {
      lindasDogMaterials[material.name] = material;
    });
  });
  console.log("lindasDogMaterials", lindasDogMaterials);
});

const lindasDogPupilRange = {
  left: {
    x: { min: -0.13, max: 0.13 },
    y: { min: -0.15, max: 0.15 },
  },
  right: {
    x: { min: -0.13, max: 0.13 },
    y: { min: -0.15, max: 0.15 },
  },
};

const setLindasDogPupilPosition = (
  isLeft,
  x,
  y,
  startAtNegativeOne = false
) => {
  return;
  if (startAtNegativeOne) {
    x = THREE.MathUtils.inverseLerp(-1, 1, x);
    y = THREE.MathUtils.inverseLerp(-1, 1, y);
  }
  const mesh = Object.values(lindasDogMeshes).find((mesh) => {
    const { name, visible } = mesh;
    return (
      name.includes("Pupil") && name.includes(isLeft ? "_L_" : "_R_") && visible
    );
  });
  if (isLeft) {
    x = 1 - x;
  }
  const { offset } = mesh.material.map;
  const side = isLeft ? "left" : "right";

  offset.x = lerp(lindasDogPupilRange[side].x, x);
  offset.y = lerp(lindasDogPupilRange[side].y, y);
};
window.setLindasDogPupilPosition = setLindasDogPupilPosition;

const testLindasDogPupilsPositions = false;
if (testLindasDogPupilsPositions) {
  scene.addEventListener("mousemove", (event) => {
    const { offsetX, offsetY } = event;
    const x = 1 - offsetX / scene.clientWidth;
    const y = 1 - offsetY / scene.clientHeight;
    //console.log({ x, y });
    setLindasDogPupilPosition(true, x, y);
    setLindasDogPupilPosition(false, x, y);
  });
}

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

    // if (node.name.includes("_L_") && node.name.includes("_Pupil_")) {
    //   node.material = node.material.clone();
    //   node.material.map = node.material.map.clone();

    //   const tex = node.material.map;
    //   tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    //   tex.needsUpdate = true;
    // }
  });
  console.log("lindasDogMeshes", lindasDogMeshes);
  setLindasDogEyePatches("default");
  setLindasDogPupils("default");
  setLindasDogMouth("nomouse");
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

/** @typedef {"default" | "heart" | "emotional" | "star"} LindasDogPupil */
/**
 * @param {boolean} isLeft
 * @param {LindasDogPupil} pupil
 */
const setLindasDogPupil = (isLeft, pupil) => {
  Object.entries(lindasDogMeshes).forEach(([name, mesh]) => {
    if (name.includes(isLeft ? "_L_" : "_R_") && name.includes("Pupil")) {
      mesh.visible = name.toLowerCase().includes(pupil);
    }
  });
};
/** @param {LindasDogPupil} pupil  */
const setLindasDogPupils = (pupil) => {
  setLindasDogPupil(true, pupil);
  setLindasDogPupil(false, pupil);
};
window.setLindasDogPupil = setLindasDogPupil;
window.setLindasDogPupils = setLindasDogPupils;

/** @typedef {"default" | "close" | "serious" | "down"} LindasDogEyePatch */
/**
 * @param {boolean} isLeft
 * @param {LindasDogEyePatch} eyePatch
 */
const setLindasDogEyePatch = (isLeft, eyePatch) => {
  Object.entries(lindasDogMeshes).forEach(([name, mesh]) => {
    if (name.includes("EyePatch") && name.includes(isLeft ? "_L_" : "_R_")) {
      mesh.visible = name.toLowerCase().endsWith(eyePatch);
    }
  });
};
/** @param {LindasDogEyePatch} eyePatch  */
const setLindasDogEyePatches = (eyePatch) => {
  setLindasDogEyePatch(true, eyePatch);
  setLindasDogEyePatch(false, eyePatch);
};
window.setLindasDogEyePatch = setLindasDogEyePatch;
window.setLindasDogEyePatches = setLindasDogEyePatches;

/** @typedef {"nomouse" | "tongue" | "w" | "c" | "o"} LindasDogMouth */
/**  @param {LindasDogMouth} mouth */
const setLindasDogMouth = (mouth) => {
  Object.entries(lindasDogMeshes).forEach(([name, mesh]) => {
    if (name.includes("Mouse")) {
      mesh.visible = name.toLowerCase().includes(mouth);
    }
  });
};
window.setLindasDogMouth = setLindasDogMouth;

// EYE FOLLOWING
/**
 *
 * @param {Object3D} object3D
 * @param {import("three").Vector3} worldVector
 * @returns
 */
function getRelativeAngles(object3D, worldVector) {
  // Step 1: direction from object to target (world space)
  const dirWorld = new THREE.Vector3()
    .subVectors(worldVector, object3D.getWorldPosition(new THREE.Vector3()))
    .normalize();

  // Step 2: convert direction into object local space
  const dirLocal = dirWorld.clone();
  object3D.worldToLocal(dirLocal.add(object3D.position)).sub(object3D.position);
  dirLocal.normalize();

  // Step 3: compute angles
  const horizontal = Math.atan2(dirLocal.x, dirLocal.z); // yaw
  const vertical = Math.atan2(
    dirLocal.y,
    Math.sqrt(dirLocal.x * dirLocal.x + dirLocal.z * dirLocal.z)
  ); // pitch

  return {
    horizontal, // radians
    vertical, // radians
  };
}

setInterval(() => {
  const vector = camera.object3D.getWorldPosition(new THREE.Vector3());

  const object3D = lindasDogEntity.object3D;
  let { horizontal, vertical } = getRelativeAngles(object3D, vector);

  //console.log({ horizontal, vertical });

  let x = THREE.MathUtils.inverseLerp(-7, 7, horizontal);
  x = 1 - THREE.MathUtils.clamp(x, 0, 1);
  let y = THREE.MathUtils.inverseLerp(-1, 1, vertical);
  y = THREE.MathUtils.clamp(y, 0, 1);

  //console.log({ x, y });

  setLindasDogPupilPosition(true, x, 0.6);
  setLindasDogPupilPosition(false, x, 0.6);
}, 200);

let isBeingPet = false;
const setIsBeingPet = (newIsBeingPet) => {
  if (isBeingPet == newIsBeingPet) {
    return;
  }
  isBeingPet = newIsBeingPet;
  console.log({ isBeingPet });
  if (isBeingPet) {
    // setLindasDogEyePatches("down");
    setLindasDogMouth("tongue");
    setLindasDogPupils("heart");
  } else {
    setLindasDogPupils("emotional");
    setLindasDogEyePatches("default");
    setLindasDogMouth("w");
    setTimeout(() => {
      setLindasDogEyePatches("default");
      setLindasDogMouth("nomouse");
      setLindasDogPupils("default");
      blink();
    }, 2000);
  }
};
window.setIsBeingPet = setIsBeingPet;
let isBlinking = false;
const randomBlinkTime = () => Math.random() * 4000 + 800;
const blink = () => {
  if (isBlinking) {
    return;
  }
  isBlinking = true;
  setTimeout(() => {
    if (lindasDogEntity.object3D.visible) {
      const isLeft = Math.random > 0.5;
      setLindasDogEyePatch(isLeft, "close");
      setTimeout(() => {
        setLindasDogEyePatch(!isLeft, "close");
      }, 10);
      setTimeout(() => {
        setLindasDogEyePatch(isLeft, "default");
        setTimeout(() => {
          setLindasDogEyePatch(!isLeft, "default");

          isBlinking = false;
          if (!isBeingPet) {
            blink();
          }
        }, 10);
      }, 150);
    }
  }, randomBlinkTime());
};
blink();

// Socket.io
/** @type {import("socket.io-client")} */
const ioClient = window.io;
const { io } = ioClient;

const unoSocketAddress = "https://powerpet.local:7000"; // FILL YOUR UNO Q's address here, e.g. "http://localhost:7000" or "http://powerpet.local:7000"
/** @type {import("socket.io-client").Socket?} */
let unoSocket;
if (unoSocketAddress.length) {
  unoSocket = io(unoSocketAddress);
  unoSocket.on("connect", () => {
    console.log("connected to uno");
    unoSocket.emit("getAngles", {});
    unoSocket.emit("getState", {});
  });
  unoSocket.on("disconnect", () => {
    console.log("disconnected from uno");
  });
  unoSocket.on("getAngles", (newAngles) => {
    //console.log("getAngles", newAngles);
    updateAngles(newAngles);
  });
  unoSocket.on("state", (state) => {
    console.log("state", state);
    // FILL
  });
  unoSocket.on("stateDiff", (stateDiff) => {
    console.log("stateDiff", stateDiff);
    // FILL
  });
  unoSocket.on("broadcast", (message) => {
    console.log("broadcast", message);
    // FILL
  });
}

let angles = {
  servo: [0, 0],
  stepper: [0],
};
const throttleRate = 20;
const updateAngles = (newAngles) => {
  angles = newAngles;
  //console.log("angles", angles);
  updateAnglesUI();
  updateAnglesEntities();
};
let setAngles = async (newAngles) => {
  console.log("setAngles", newAngles);
  if (unoSocket?.connected) {
    unoSocket.emit("setAngles", newAngles);
  } else {
    updateAngles(newAngles);
  }
};
setAngles = AFRAME.utils.throttleLeadingAndTrailing(setAngles, throttleRate);

/** @type {Record<string, {min: number, max: number}[]>} */
const angleInputRanges = {
  servo: [
    { min: 0, max: 160 },
    { min: 0, max: 160 },
  ],
  stepper: [{ min: -180, max: 180 }],
};

// UI
const anglesContainer = document.getElementById("angles");
const stepperAnglesContainer = document.getElementById("stepper");
const servoAnglesContainer = document.getElementById("servo");
/** @type {Record<string, HTMLElement[]>} */
const angleContainers = {
  servo: [],
  stepper: [],
};
/** @type {HTMLCanvasElement} */
const angles2DCanvas = document.getElementById("angles2D");
const angles2DContext = angles2DCanvas.getContext("2d");
const angles2DMap = {
  x: { type: "servo", index: 0 },
  y: { type: "servo", index: 1 },
};
let isMouseDown = false;
const setIsMouseDown = (newIsMouseDown) => {
  isMouseDown = newIsMouseDown;
  console.log({ isMouseDown });
};
angles2DCanvas.addEventListener("mousedown", (event) => {
  setIsMouseDown(true);
  onAngles2DCanvasMouseEvent(event);
});
angles2DCanvas.addEventListener("mouseup", (event) => {
  setIsMouseDown(false);
  onAngles2DCanvasMouseEvent(event);
});
const angles2DColor = "white";
const angles2DCursor = {
  x: 0,
  y: 0,
};
/** @param {MouseEvent} event */
const onAngles2DCanvasMouseEvent = (event) => {
  const { offsetX, offsetY } = event;
  angles2DCursor.x = offsetX / angles2DCanvas.clientWidth;
  angles2DCursor.y = offsetY / angles2DCanvas.clientHeight;
  //console.log(angles2DCursor);

  drawAngles2D();

  if (isMouseDown) {
    set2DAngles();
  }
};
angles2DCanvas.addEventListener("mousemove", (event) => {
  onAngles2DCanvasMouseEvent(event);
});
let set2DAngles = () => {
  const { x, y } = angles2DCursor;

  const xAngleRange = angleInputRanges[angles2DMap.x.type][angles2DMap.x.index];
  const xAngle = xAngleRange.min + x * (xAngleRange.max - xAngleRange.min);

  const yAngleRange = angleInputRanges[angles2DMap.y.type][angles2DMap.y.index];
  const yAngle = yAngleRange.min + y * (yAngleRange.max - yAngleRange.min);

  //console.log({ xAngle, yAngle });

  const newAngles = unoSocket?.connected
    ? {
        servo: [],
        stepper: [],
      }
    : structuredClone(angles);
  newAngles[angles2DMap.x.type][angles2DMap.x.index] = Math.round(xAngle);
  newAngles[angles2DMap.y.type][angles2DMap.y.index] = Math.round(yAngle);
  //console.log("newAngles", newAngles);
  setAngles(newAngles);
};
const drawAngles2D = () => {
  const { x, y } = angles2DCursor;
  const { width, height } = angles2DCanvas;

  angles2DContext.clearRect(0, 0, width, height);

  angles2DContext.fillStyle = isMouseDown ? "green" : "white";
  angles2DContext.beginPath();
  angles2DContext.arc(x * width, y * height, 5, 0, 2 * Math.PI);
  angles2DContext.fill();
};

/** @type {HTMLTemplateElement} */
const angleTemplate = document.getElementById("angleTemplate");
const updateAnglesUI = () => {
  Object.entries(angles).forEach(([type, typeAngles]) => {
    typeAngles.forEach((angle, index) => {
      let container = angleContainers[type][index];
      if (!container) {
        container = angleTemplate.content
          .cloneNode(true)
          .querySelector(".angle");
        const containerParent =
          type == "servo" ? servoAnglesContainer : stepperAnglesContainer;
        containerParent.appendChild(container);

        container.querySelector("span.index").innerText = index;
        container.querySelector("span.type").innerText = type;

        let setAngle = (angle) => {
          console.log("setAngle", { type, angle, index });
          if (unoSocket?.connected) {
            unoSocket.emit("setAngle", { type, angle, index });
          } else {
            const newAngles = structuredClone(angles);
            newAngles[type][index] = angle;
            updateAngles(newAngles);
          }
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

window.unoSocket = unoSocket;
