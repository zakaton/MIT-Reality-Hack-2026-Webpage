const controllers = {
  left: document.getElementById("leftController"),
  right: document.getElementById("rightController"),
};

/** @type {import("three")} */
const THREE = window.THREE;

// PET
const petEntity = document.getElementById("pet");
const petPosition = new THREE.Vector3();
const setPetPosition = (newPetPosition) => {
  petPosition.copy(newPetPosition);
  console.log("petPosition", petPosition);
  petEntity.object3D.position.copy(petPosition);
};

const petEuler = new THREE.Euler();
const offsetPetEulerYaw = (yawOffset) => {
  petEuler.y += yawOffset;
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

const petTransformLocalStorageKey = "petTransform";
const savePetTransform = () => {
  console.log("savePetTransform");

  const relativeMatrix = new THREE.Matrix4();
  const inverseRelativeMatrix = new THREE.Matrix4()
    .copy(anchor.object3D.matrixWorld)
    .invert();

  const relativePosition = new THREE.Vector3();
  const relativeQuaternion = new THREE.Quaternion();
  const relativeScale = new THREE.Vector3();

  relativeMatrix.multiplyMatrices(
    inverseRelativeMatrix,
    petEntity.object3D.matrixWorld
  );

  relativeMatrix.decompose(relativePosition, relativeQuaternion, relativeScale);

  const transform = {
    position: relativePosition.toArray(),
    quaternion: relativeQuaternion.toArray(),
    scale: relativeScale.toArray(),
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
    const relativePosition = new THREE.Vector3();
    const relativeQuaternion = new THREE.Quaternion();
    const relativeScale = new THREE.Vector3();

    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();

    const localMatrix = new THREE.Matrix4();
    const referenceMatrix = new THREE.Matrix4().copy(
      anchor.object3D.matrixWorld
    );
    const worldMatrix = new THREE.Matrix4();

    const {
      position: positionArray,
      quaternion: quaternionArray,
      scale: scaleArray,
    } = JSON.parse(petTransformString);
    relativePosition.set(...positionArray);
    relativeQuaternion.set(...quaternionArray);
    relativeScale.set(...scaleArray);

    localMatrix.compose(relativePosition, relativeQuaternion, relativeScale);
    worldMatrix.multiplyMatrices(referenceMatrix, localMatrix);
    worldMatrix.decompose(worldPosition, worldQuaternion, worldScale);

    const newPetPosition = worldPosition;
    setPetPosition(newPetPosition);

    const newPetEuler = new THREE.Euler().setFromQuaternion(worldQuaternion);
    setPetEuler(newPetEuler);
  } catch (error) {
    console.error("error parsing petTransform", error);
  }
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

// SETUP PET ROTATION
window.offsetPetEulerYawScalar = -0.1;
controllers.right.addEventListener("thumbstickmoved", (event) => {
  const { x } = event.detail;
  //   console.log({ x });
  offsetPetEulerYaw(x * offsetPetEulerYawScalar);
});

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
