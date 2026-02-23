// INSPECTOR START
const getIsInspectorOpen = () => {
  return AFRAME.INSPECTOR?.opened;
};
const toggleInspector = () => {
  if (AFRAME.INSPECTOR) {
    AFRAME.INSPECTOR.toggle();
  } else {
    AFRAME.scenes[0].components.inspector.openInspector();
  }
};
const openInspectorButton = document.getElementById("openInspector");
openInspectorButton.addEventListener("click", () => {
  toggleInspector();
});
// INSPECTOR END

// UNO Q START
import UnoQ from "./uno-q/UnoQ.js";
import { throttleLeadingAndTrailing } from "./utils/helpers.js";
const unoQ = new UnoQ();
window.unoQ = unoQ;

const setUnoQAddress = (newUnoQAddress) => {
  unoQConfig.address = newUnoQAddress;
  console.log("unoQConfig.address", unoQConfig.address);
  unoQAddressInput.value = unoQConfig.address;
};
const unoQAddressInput = document.getElementById("unoQAddress");
unoQ.onConnected(() => {
  unoQAddressInput.value = unoQ.address;
});
unoQ.onIsConnected(() => {
  unoQAddressInput.disabled = unoQ.isConnected;
});

const toggleUnoQConnection = () => {
  unoQ.toggleConnection(unoQAddressInput.value);
};
const toggleUnoQConnectionButton = document.getElementById(
  "toggleUnoQConnection"
);
toggleUnoQConnectionButton.addEventListener("click", () => {
  toggleUnoQConnection();
});

unoQ.onConnectionStatus((event) => {
  const { connectionStatus } = event.detail;
  let innerText = connectionStatus;
  switch (connectionStatus) {
    case "not connected":
      innerText = "connect";
      break;
    case "connected":
      innerText = "disconnect";
      break;
  }
  toggleUnoQConnectionButton.innerText = innerText;
});

const setUnoQAutoConnect = (newUnoQAutoConnect) => {
  unoQConfig.autoConnect = newUnoQAutoConnect;
  console.log("unoQConfig.autoConnect", unoQConfig.autoConnect);
  unoQAutoConnectCheckbox.checked = unoQConfig.autoConnect;
};
const unoQAutoConnectCheckbox = document.getElementById("unoQAutoConnect");
unoQAutoConnectCheckbox.addEventListener("input", () => {
  setUnoQAutoConnect(unoQAutoConnectCheckbox.checked);
});
unoQ.onConnected(() => {
  unoQAutoConnectCheckbox.disabled = false;
});
// UNO Q END

// UNO Q CONFIG START
const unoQConfig = {
  address: "https://powerpet.local:7000",
  autoConnect: false,
};
const unoQConfigKey = "unoQConfig";
const saveUnoQConfig = () => {
  localStorage.setItem(unoQConfigKey, JSON.stringify(unoQConfig));
};
const loadUnoQConfig = () => {
  const unoQConfigString = localStorage.getItem(unoQConfigKey);
  if (unoQConfigString) {
    try {
      const newUnoQConfig = JSON.parse(unoQConfigString);
      console.log("newUnoQConfig", newUnoQConfig);
      setUnoQAutoConnect(newUnoQConfig.autoConnect);
      setUnoQAddress(newUnoQConfig.address);
      if (newUnoQConfig.autoConnect) {
        toggleUnoQConnection();
      }
    } catch (error) {
      console.error(error);
    }
  }
};
window.addEventListener("beforeunload", () => {
  saveUnoQConfig();
});
loadUnoQConfig();

unoQ.onConnected(() => {
  unoQConfig.address = unoQ.address;
});
// UNO Q CONFIG END

// ANGLES START
/** @typedef {import("./uno-q/UnoQ.js").AngleType} AngleType */
/** @typedef {import("./uno-q/UnoQ.js").Angles} Angles */

/** @type {Angles} */
const angles = {
  servo: [0, 0],
  stepper: [0],
};

let numberOfAngles = 3;
const updateNumberOfAngles = () => {
  let _numberOfAngles = 0;
  forEachAngle((type, index, angle) => {
    _numberOfAngles++;
  });
  numberOfAngles = _numberOfAngles;
  console.log({ numberOfAngles });
};
/** @param {Angles} newAngles */
const updateAngles = (newAngles) => {
  Object.assign(angles, newAngles);
  //console.log("updateAngles", angles);

  forEachAngle((type, index, angle) => {
    angleInputs[type][index].forEach(
      (input) => (input.value = Math.round(angle))
    );
    robotEntity.setAttribute("robot", `angle_${type}_${index}`, angle);
  });
  //updateNumberOfAngles();
  drawBrilliantWearGlassesDisplay();
};
unoQ.onAngles((event) => updateAngles(event.detail.angles));

/**
 *
 * @param {Angles} newAngles
 * @param {boolean} isOffset
 */
const setAngles = (newAngles, isOffset) => {
  //console.log("setAngles", newAngles, { isOffset });
  if (isOffset) {
    const newAngleOffsets = newAngles;
    newAngles = structuredClone(angles);
    for (let type in newAngleOffsets) {
      newAngleOffsets[type].forEach((angle, index) => {
        newAngles[type][index] = newAngles[type][index] + angle;
      });
    }
  }
  //console.log("setAngles", newAngles);
  if (unoQ.isConnected) {
    unoQ.setAngles(newAngles);
  } else {
    updateAngles(newAngles);
  }
};
/**
 * @param {AngleType} type
 * @param {number} index
 * @param {number} angle
 * @param {boolean} isOffset
 */
const setAngle = (type, index, angle, isOffset = false) => {
  //console.log("setAngle", { type, index, angle, isOffset });
  if (isOffset) {
    angle = angles[type][index] + angle;
  }
  if (unoQ.isConnected) {
    unoQ.setAngle(type, index, angle);
  } else {
    const newAngles = structuredClone(angles);
    newAngles[type][index] = angle;
    setAngles(newAngles);
  }
};

/**
 * @param {AngleType} type
 * @param {number} index
 */
const tareAngle = (type, index) => {
  //console.log("tareAngle", { type, index });
  if (unoQ.isConnected) {
    unoQ.tareAngle(type, index);
  } else {
    const newAngles = structuredClone(angles);
    newAngles[type][index] = 0;
    setAngles(newAngles);
  }
};

const anglesContainer = document.getElementById("anglesContainer");
/** @type {HTMLTemplateElement} */
const angleTemplate = document.getElementById("angleTemplate");

/** @param {(type: AngleType, index: number, angle: number) => Promise<void>} callback */
const forEachAngle = async (callback) => {
  for (const type of Object.keys(angles).sort()) {
    const typeAngles = angles[type];
    for (let index in typeAngles) {
      index = +index;
      let angle = typeAngles[index];
      //console.log(typeAngles, { type, index, angle });
      if (isNaN(angle)) {
        angle = typeAngles[index] = 0;
      }
      await callback(type, index, angle);
    }
  }
};

/** @type {Record<AngleType, {min: number, max: number}[]>} */
const angleRanges = {
  servo: [
    { min: 0, max: 160 },
    { min: 0, max: 160 },
  ],
  stepper: [{ min: -180, max: 180 }],
};

/** @type {Record<AngleType, HTMLInputElement[][]>} */
const angleInputs = {
  servo: [],
  stepper: [],
};
forEachAngle((type, index, angle) => {
  // console.log({ type, index, angle });
  /** @type {HTMLElement} */
  const angleContainer = angleTemplate.content
    .cloneNode(true)
    .querySelector(".angle");

  const typeSpan = angleContainer.querySelector("span.type");
  typeSpan.innerText = type;

  const indexSpan = angleContainer.querySelector("span.index");
  indexSpan.innerText = index;

  const tareButton = angleContainer.querySelector("button.tare");
  if (type == "stepper" && index == 0) {
    tareButton.classList.remove("hidden");
  }
  tareButton.addEventListener("click", () => {
    tareAngle(type, index);
  });

  const angleRange = angleContainer.querySelector("input[type='range']");
  const angleInput = angleContainer.querySelector("input[type='number']");
  angleRange.value = angleInput.value = angle;

  const { min, max } = angleRanges[type][index];
  angleRange.min = angleInput.min = min;
  angleRange.max = angleInput.max = max;

  /** @param {InputEvent} event */
  const onInput = (event) => {
    setAngle(type, index, +event.target.value);
  };
  angleRange.addEventListener("input", onInput);
  angleInput.addEventListener("input", onInput);

  angleInputs[type][index] = [angleRange, angleInput];

  anglesContainer.appendChild(angleContainer);
});
// ANGLES END

// THREE START
/** @type {import("three")} */
const THREE = window.THREE;
// THREE END

// AFRAME ENTITIES START
const cameraEntity = document.getElementById("camera");
const sceneEntity = document.getElementById("scene");
// AFRAME ENTITIES END

// UTILS START
const setupInput = (entity, name, propertyName) => {
  const input = document.querySelector(`[data-${name}="${propertyName}"]`);
  const isCheckbox = input.type == "checkbox";
  input.addEventListener("input", () => {
    const value = isCheckbox ? input.checked : input.value;
    entity.setAttribute(name, { [propertyName]: value });
  });
  entity.addEventListener(`${name}-${propertyName}`, (event) => {
    const { [propertyName]: value } = event.detail;
    if (isCheckbox) {
      input.checked = value;
    } else {
      input.value = value;
    }
  });
};
// UTILS END

// POWER PET START
const powerPetEntity = document.getElementById("powerPet");
unoQ.onBroadcast((event) => {
  const { type, variant, value } = event.detail.message;
  if (type != "variant") {
    return;
  }
  powerPetEntity.setAttribute("power-pet", `variant_${variant}`, value);
});
// POWER PET END

// ROBOT START
const robotEntity = document.getElementById("robot");
robotEntity.addEventListener("robot-angle", (event) => {
  const { type, index, angle, isOffset } = event.detail;
  //console.log("robot-angle", { type, index, angle, isOffset });
  setAngle(type, index, angle, isOffset);
});
robotEntity.addEventListener("robot-angles", (event) => {
  const { angles, isOffset } = event.detail;
  //console.log("robot-angles", { angles, isOffset });
  setAngles(angles, isOffset);
});
robotEntity.addEventListener("robot-tare-angle", (event) => {
  const { type, index } = event.detail;
  //console.log("robot-tare-angle", { type, index });
  tareAngle(type, index);
});

const setupRobotInput = (propertyName) =>
  setupInput(robotEntity, "robot", propertyName);
setupRobotInput("followCamera");
setupRobotInput("showDebug");
setupRobotInput("followCameraAngleMin");
setupRobotInput("followCameraAngleMax");
setupRobotInput("followCameraAngleStep");

sceneEntity.addEventListener("microgesture-left-thumb-tap", () => {
  let { followCamera } = robotEntity.getAttribute("robot");
  followCamera = !followCamera;
  robotEntity.setAttribute("robot", { followCamera });
});
// ROBOT END

// CANVAS INPUT START
const anglesCanvasInput = document.getElementById("anglesCanvasInput");
anglesCanvasInput.addEventListener("input", (event) => {
  const { x, y } = event.target.value;
  // console.log({ x, y });
  const stepperAngle = x;
  const servo0Angle = y;
  setAngles({
    servo: [servo0Angle],
    stepper: [stepperAngle],
  });
});
// CANVAS INPUT END

// POINTER LOCK START
const pointerLockButton = document.getElementById("pointerLock");
const pointerLockScalars = {
  stepper: 1,
  servo0: 1,
};
pointerLockButton.addEventListener("input", (event) => {
  const { x, y } = event.detail;
  const servo0Angle = y * pointerLockScalars.servo0;
  const stepperAngle = x * pointerLockScalars.stepper;
  // console.log({ stepperAngle, servo0Angle });
  setAngles(
    {
      servo: [servo0Angle],
      stepper: [stepperAngle],
    },
    true
  );
});
// POINTER LOCK END

// GAMEPAD START
const gamepadScalars = {
  stepper: -6,
  servo0: -5,
  servo1: -5,
};

/** @type {Angles} */
const gamepadAngleOffsets = {
  servo: [],
  stepper: [],
};
let onGamepadTick = (event) => {
  const { gamepadIndex, gamepad, timestamp, axes, thumbsticks } = event.detail;
  thumbsticks.forEach((thumbstick, index) => {
    const { x, y } = thumbstick;
    switch (index) {
      case 0: // left thumbstick
        {
          const servo1Angle = Math.round(y * gamepadScalars.servo1);
          gamepadAngleOffsets.servo[1] = servo1Angle;
          //console.log({ servo1Angle });
        }
        break;
      case 1: // right thumbstick
        {
          const stepperAngle = Math.round(x * gamepadScalars.stepper);
          gamepadAngleOffsets.stepper[0] = stepperAngle;
          const servo0Angle = Math.round(y * gamepadScalars.servo0);
          gamepadAngleOffsets.servo[0] = servo0Angle;
          //console.log({ stepperAngle, servo0Angle });
        }
        break;
    }
  });

  const shouldSetAngles = Object.keys(gamepadAngleOffsets).some((type) => {
    return gamepadAngleOffsets[type].some((angle) => angle != 0);
  });

  // console.log({ shouldSetAngles });
  if (shouldSetAngles) {
    setAngles(gamepadAngleOffsets, true);
  }
};
onGamepadTick = throttleLeadingAndTrailing(onGamepadTick, 50);
window.addEventListener("gamepadtick", onGamepadTick);

window.addEventListener("gamepadthumbstickchange", (event) => {
  const { thumbstickChange, gamepad } = event.detail;
  //console.log("thumbstickChange", thumbstickChange);
});
window.addEventListener("gamepadbuttonchange", (event) => {
  const { buttonChange } = event.detail;
  //console.log("buttonChange", buttonChange);
  const { index, pressed } = buttonChange;

  switch (index) {
    case 5: // right bumper
      if (pressed) {
        tareAngle("stepper", 0);
      }
      break;
  }
});
window.addEventListener("gamepadaxischange", (event) => {
  const { axisChange } = event.detail;
  //console.log("axisChange", axisChange);
});
// GAMEPAD END

// MIDI START
/** @typedef {import("webmidi").WebMidi} WebMidi */
/** @typedef {import("webmidi").InputEventMap} InputEventMap */

/** @type {WebMidi} */
const WebMidi = window.WebMidi;
WebMidi.octaveOffset = 0;

/** @type {InputEventMap["noteon"]} */
const onWebMidiNoteOn = (event) => {
  const { value, note, message } = event;
  const { channel } = message;
  //console.log({ value, note, channel });
  if (channel == 10) {
    switch (note.number) {
      case 43: // PAD 8
        tareAngle("stepper", 0);
        break;
    }
  }
};
/** @type {InputEventMap["noteoff"]} */
const onWebMidiNoteOff = (event) => {
  const { value, note } = event;
  //console.log({ value, note });
};
/** @type {InputEventMap["controlchange"]} */
const onWebMidiControlChange = (event) => {
  const { controller, value } = event;
  const { number } = controller;

  const _value = value;
  // console.log({ number, value, _value });

  switch (number) {
    case 70: // K1
      setAngle("stepper", 0, THREE.MathUtils.lerp(0, -360, _value));
      break;
    case 71: // K2
      setAngle("servo", 1, THREE.MathUtils.lerp(0, 160, _value));
      break;
    case 75: // K6
      setAngle("servo", 0, THREE.MathUtils.lerp(0, 160, _value));
      break;
  }
};

try {
  await WebMidi.enable();
  WebMidi.inputs.forEach((webMidiInput) => {
    webMidiInput.addListener("noteon", onWebMidiNoteOn);
    webMidiInput.addListener("noteoff", onWebMidiNoteOff);
    webMidiInput.addListener("controlchange", onWebMidiControlChange);
  });
} catch (error) {
  console.error(error);
}
// MIDI END

// BRILLIANT WEAR START
import * as BS from "./brilliantwear/brilliantsole.module.min.js";
window.BS = BS;

const bsDevice = new BS.Device();
window.bsDevice = bsDevice;
bsDevice.addEventListener("gameRotation", (event) => {
  const { gameRotation } = event.message;
  // console.log("gameRotation", gameRotation);
  onBrilliantWearOrientation(gameRotation);
});
bsDevice.addEventListener("rotation", (event) => {
  const { rotation } = event.message;
  // console.log("rotation", rotation);
  onBrilliantWearOrientation(rotation);
});

const brilliantWearQuaternion = new THREE.Quaternion();
const brilliantWearEuler = new THREE.Euler().reorder("YXZ");
const brilliantWearTareEuler = new THREE.Euler().reorder("YXZ");
/** @type {Angles} */
const brilliantWearTareAngles = {
  stepper: [],
  servo: [],
};

let brilliantWearYawRevolutions = 0;
let brilliantWearLastYaw = 0;
bsDevice.addEventListener("connected", () => {
  brilliantWearYawRevolutions = 0;
  brilliantWearLastYaw = null;
});

const tareBrilliantWearOrientation = () => {
  brilliantWearTareEuler.copy(brilliantWearEuler);

  Object.assign(brilliantWearTareAngles, structuredClone(angles));
  //console.log("tareBrilliantWearOrientation", brilliantWearTareAngles);

  brilliantWearYawRevolutions = 0;
};
tareBrilliantWearOrientation();

const brilliantWearServoIndex = 0;

/** @param {BS.Quaternion} quaternion */
const onBrilliantWearOrientation = (quaternion) => {
  brilliantWearQuaternion.copy(quaternion);
  brilliantWearEuler.setFromQuaternion(brilliantWearQuaternion);
  if (
    brilliantWearLastYaw != null &&
    Math.abs(brilliantWearLastYaw - brilliantWearEuler.y) > Math.PI
  ) {
    brilliantWearYawRevolutions +=
      brilliantWearLastYaw > brilliantWearEuler.y ? 1 : -1;
    //console.log({ brilliantWearYawRevolutions });
  }
  brilliantWearLastYaw = brilliantWearEuler.y;
  if (tareBrilliantWearOrientationCheckbox.checked) {
    tareBrilliantWearOrientationCheckbox.checked = false;
    tareBrilliantWearOrientation();
  }

  let yawRadians = brilliantWearEuler.y;
  yawRadians -= brilliantWearTareEuler.y;
  let pitchRadians = brilliantWearEuler.x;
  //pitchRadians -= brilliantWearTareEuler.x;
  //console.log({ yawRadians, pitchRadians });

  if (bsDevice.isInsole) {
    pitchRadians *= -1;
    pitchRadians -= 0.1;
    pitchRadians *= 4;
    yawRadians *= 8;
  }

  if (bsDevice.isGlasses) {
    if (invertIfGlassesCheckbox.checked) {
      pitchRadians *= -1;
    }
  }

  let yaw = THREE.MathUtils.radToDeg(yawRadians);
  yaw += brilliantWearTareAngles.stepper[0];
  let pitch = THREE.MathUtils.radToDeg(pitchRadians);
  pitch *= -1;
  if (brilliantWearServoIndex == 0) {
    pitch += 77;
  } else {
    pitch += 73;
  }
  //pitch -= brilliantWearTareAngles.servo[0];

  yaw += brilliantWearYawRevolutions * 360;

  //console.log({ yaw, pitch });

  const stepperAngle = yaw;
  let servo0Angle = pitch;
  let servo1Angle = pitch;
  const newAngles = {
    servo: [servo0Angle, servo1Angle],
    stepper: [stepperAngle],
  };
  newAngles.servo[brilliantWearServoIndex == 0 ? 1 : 0] = null;
  //console.log("newAngles", newAngles);
  setAngles(newAngles);
};

const toggleBrilliantWearConnectionButton = document.getElementById(
  "toggleBrilliantWearConnection"
);
toggleBrilliantWearConnectionButton.addEventListener("click", () => {
  bsDevice.toggleConnection(false);
});
bsDevice.addEventListener("connectionStatus", (event) => {
  const { connectionStatus } = event.message;
  let innerText = connectionStatus;
  switch (connectionStatus) {
    case "notConnected":
      innerText = "connect";
      break;
    case "connected":
      innerText = "disconnect";
      break;
  }
  toggleBrilliantWearConnectionButton.innerText = innerText;
});

/** @type {BS.SensorType} */
const orientationSensorType = "gameRotation";
const orientationSensorRate = 40;

const toggleBrilliantWearOrientationButton = document.getElementById(
  "toggleBrilliantWearOrientation"
);
bsDevice.addEventListener("isConnected", (event) => {
  const { isConnected } = event.message;
  toggleBrilliantWearOrientationButton.disabled = !isConnected;
});
toggleBrilliantWearOrientationButton.addEventListener("click", () => {
  //console.log("toggleSensor", { orientationSensorType, orientationSensorRate });
  bsDevice.toggleSensor(orientationSensorType, orientationSensorRate);
});
bsDevice.addEventListener("getSensorConfiguration", (event) => {
  const { sensorConfiguration } = event.message;
  toggleBrilliantWearOrientationButton.innerText = sensorConfiguration[
    orientationSensorType
  ]
    ? "disable orientation"
    : "enable orientation";
});

const tareBrilliantWearOrientationCheckbox = document.getElementById(
  "tareBrilliantWearOrientation"
);
bsDevice.addEventListener("isConnected", (event) => {
  const { isConnected } = event.message;
  tareBrilliantWearOrientationCheckbox.disabled = !isConnected;
});
bsDevice.addEventListener("getSensorConfiguration", (event) => {
  tareBrilliantWearOrientationCheckbox.disabled =
    event.message.sensorConfiguration[orientationSensorType] != 0;
});

const invertIfGlassesCheckbox = document.getElementById("invertIfGlasses");
// BRILLIANT WEAR END

// BRILLIANT WEAR GLASSES START
const brilliantWearPointerLockButton = document.getElementById(
  "brilliantWearPointerLock"
);
const brilliantWearPointerLockScalars = {
  stepper0: 1,
  servo0: 1,
  servo1: 1,
};
brilliantWearPointerLockButton.addEventListener("input", (event) => {
  const { x, y } = event.detail;
  const { type, index } = selectedAngleRow;

  const value = type == "stepper" ? x : y;
  // console.log({ stepperAngle, servo0Angle });
  let angle = value * brilliantWearPointerLockScalars[`${type}${index}`];
  setAngle(type, index, angle, true);
});
brilliantWearPointerLockButton.addEventListener("isPointerDown", (event) => {
  const { isPointerDown } = event.detail;
  brilliantWearGlassesDisplayCanvasHelper.setColor(
    2,
    brilliantWearGlassesDisplaySelectionColors[isPointerDown ? 1 : 0]
  );

  drawBrilliantWearGlassesDisplay();
});
brilliantWearPointerLockButton.addEventListener("keydown", (event) => {
  const { target, key } = event;
  const { isPointerLocked, isPointerDown } = target;
  if (!isPointerLocked) {
    return;
  }
  //console.log(event);
  let preventDefault = true;
  switch (key) {
    case "ArrowUp":
      if (!isPointerDown) {
        setSelectedAngleRowIndex(-1, true);
      }
      break;
    case "ArrowDown":
      if (!isPointerDown) {
        setSelectedAngleRowIndex(1, true);
      }
      break;
    case "ArrowLeft":
      brilliantWearPointerLockButton.isPointerDown = false;
      break;
    case "ArrowRight":
      brilliantWearPointerLockButton.isPointerDown = true;
      break;
    default:
      //console.log(`uncaught key "${key}"`);
      preventDefault = false;
      break;
  }

  if (preventDefault) {
    event.preventDefault();
  }
});

const brilliantWearGlassesDisplaySelectionColors = ["#0dff00", "#ffae00"];
const brilliantWearGlassesDisplayCanvasHelper = new BS.DisplayCanvasHelper();
brilliantWearGlassesDisplayCanvasHelper.setColor(1, "white");
brilliantWearGlassesDisplayCanvasHelper.setColor(
  2,
  brilliantWearGlassesDisplaySelectionColors[0]
);
brilliantWearGlassesDisplayCanvasHelper.setColor(3, "#424242");
const brilliantWearGlassesDisplayCanvas = document.getElementById(
  "brilliantWearGlassesDisplay"
);
brilliantWearGlassesDisplayCanvasHelper.canvas =
  brilliantWearGlassesDisplayCanvas;
window.brilliantWearGlassesDisplayCanvasHelper =
  brilliantWearGlassesDisplayCanvasHelper;

const bsGlasses = new BS.Device();
const toggleBrilliantWearGlassesConnectionButton = document.getElementById(
  "toggleBrilliantWearGlassesConnection"
);
toggleBrilliantWearGlassesConnectionButton.addEventListener("click", () => {
  bsGlasses.toggleConnection(false);
});
bsGlasses.addEventListener("connectionStatus", (event) => {
  const { connectionStatus } = event.message;
  let innerText = connectionStatus;
  switch (connectionStatus) {
    case "notConnected":
      innerText = "connect";
      break;
    case "connected":
      innerText = "disconnect";
      break;
  }
  toggleBrilliantWearGlassesConnectionButton.innerText = innerText;
});
bsGlasses.addEventListener("connected", () => {
  if (!bsGlasses.isGlasses || !bsGlasses.isDisplayAvailable) {
    bsGlasses.disconnect();
  }
  brilliantWearGlassesDisplayCanvasHelper.device = bsGlasses;
});

/** @type {HTMLProgressElement} */
const brilliantWearFileTransferProgress = document.getElementById(
  "brilliantWearFileTransferProgress"
);
bsGlasses.addEventListener("fileTransferProgress", (event) => {
  const progress = event.message.progress;
  //console.log({ progress });
  brilliantWearFileTransferProgress.value = progress == 1 ? 0 : progress;
});
bsGlasses.addEventListener("fileTransferStatus", () => {
  if (bsGlasses.fileTransferStatus == "ready") {
    brilliantWearFileTransferProgress.value = 0;
  }
});

brilliantWearGlassesDisplayCanvasHelper.addEventListener(
  "deviceSpriteSheetUploadStart",
  () => {
    isUploadingToBrilliantWearGlasses = true;
  }
);
brilliantWearGlassesDisplayCanvasHelper.addEventListener(
  "deviceSpriteSheetUploadComplete",
  () => {
    isUploadingToBrilliantWearGlasses = false;
  }
);
brilliantWearGlassesDisplayCanvasHelper.addEventListener(
  "deviceUpdated",
  () => {
    drawBrilliantWearGlassesDisplay();
  }
);

let isUploadingToBrilliantWearGlasses = false;
let isDrawingToBrilliantWearGlassesDisplay = false;
let isWaitingToRedrawToBrilliantWearGlassesDisplay = false;

let selectedAngleRowIndex = 0;
/** @typedef {{type: AngleType, index: number}} AngleRow */
/** @type {AngleRow[]} */
const angleRows = [];
const updateAngleRows = () => {
  angleRows.length = 0;
  forEachAngle((type, index, angle) => {
    angleRows.push({ type, index });
  });
  //console.log("angleRows", angleRows);
  setSelectedAngleRowIndex(0);
};
/** @type {AngleRow} */
let selectedAngleRow;
const setSelectedAngleRowIndex = (newSelectedAngleRowIndex, isOffset) => {
  if (isOffset) {
    newSelectedAngleRowIndex = selectedAngleRowIndex + newSelectedAngleRowIndex;
  }
  newSelectedAngleRowIndex = THREE.MathUtils.clamp(
    newSelectedAngleRowIndex,
    0,
    numberOfAngles - 1
  );
  //console.log({ newSelectedAngleRowIndex });
  if (newSelectedAngleRowIndex == selectedAngleRowIndex) {
    return;
  }
  selectedAngleRowIndex = newSelectedAngleRowIndex;
  //console.log({ selectedAngleRowIndex });
  selectedAngleRow = angleRows[selectedAngleRowIndex];
  //console.log("selectedAngleRow", selectedAngleRow);
  drawBrilliantWearGlassesDisplay();
};
updateAngleRows();
selectedAngleRow = angleRows[0];

const drawBrilliantWearGlassesDisplay = async () => {
  if (isUploadingToBrilliantWearGlasses) {
    return;
  }
  if (isDrawingToBrilliantWearGlassesDisplay) {
    //console.warn("busy drawing");
    isWaitingToRedrawToBrilliantWearGlassesDisplay = true;
    return;
  }
  isDrawingToBrilliantWearGlassesDisplay = true;

  //console.log("drawBrilliantWearGlassesDisplay");
  const displayCanvasHelper = brilliantWearGlassesDisplayCanvasHelper;

  await displayCanvasHelper.setVerticalAlignment("start");
  await displayCanvasHelper.setHorizontalAlignment("start");
  await displayCanvasHelper.selectSpriteColor(1, 1);
  await displayCanvasHelper.setIgnoreFill(true);
  if (false) {
    await displayCanvasHelper.selectSpriteColor(0, 3);
    await displayCanvasHelper.selectBackgroundColor(3);
    await displayCanvasHelper.setFillBackground(true);
  }
  await displayCanvasHelper.setLineWidth(8);
  let rowIndex = 0;
  await forEachAngle(async (type, index, angle) => {
    const isSelected = selectedAngleRowIndex == rowIndex;
    await displayCanvasHelper.selectSpriteColor(1, isSelected ? 2 : 1);
    await displayCanvasHelper.selectLineColor(isSelected ? 2 : 1);

    angle = Math.round(angle);
    const y = rowIndex * englishFontLineHeight;
    if (true) {
      // FILL - set color
      await displayCanvasHelper.drawSpritesString(0, y, `${type}${index}`);
      // FILL - set color
      await displayCanvasHelper.setHorizontalAlignment("end");
      await displayCanvasHelper.drawSpritesString(280, y, `${angle}`);
      // FILL - set color
      await displayCanvasHelper.setHorizontalAlignment("start");
      let startAngle = 0;
      if (type == "stepper") {
        startAngle = 90;
      } else {
        startAngle = -90;
      }
      let endAngle = angle;
      if (type == "stepper") {
        endAngle *= -1;
      }
      //console.log({ startAngle, endAngle });
      await displayCanvasHelper.drawArc(300, y, 15, startAngle, endAngle);
    } else {
      await displayCanvasHelper.drawSpritesString(
        0,
        y,
        `${type}${index} ${angle}`
      );
    }
    rowIndex++;
  });

  await displayCanvasHelper.show();
};
window.draw = drawBrilliantWearGlassesDisplay;

brilliantWearGlassesDisplayCanvasHelper.addEventListener("ready", () => {
  isDrawingToBrilliantWearGlassesDisplay = false;
  if (isWaitingToRedrawToBrilliantWearGlassesDisplay) {
    isWaitingToRedrawToBrilliantWearGlassesDisplay = false;
    drawBrilliantWearGlassesDisplay();
  }
});

const fontSize = 42;
/** @type {BS.DisplaySpriteSheet} */
let englishSpriteSheet;
let englishFontLineHeight = 0;

const fontName = "roboto.ttf";
const fontSpriteSheetLocalStorageKey = `fontSpriteSheet.${fontName}.${fontSize}`;
try {
  const fontSpriteSheetString = localStorage.getItem(
    fontSpriteSheetLocalStorageKey
  );
  if (fontSpriteSheetString) {
    englishSpriteSheet = JSON.parse(fontSpriteSheetString);
  } else {
    const response = await fetch(`./assets/font/${fontName}`);
    const arrayBuffer = await response.arrayBuffer();
    const englishFont = await BS.parseFont(arrayBuffer);

    englishSpriteSheet = await BS.fontToSpriteSheet(
      englishFont,
      fontSize,
      "english"
    );
    localStorage.setItem(
      fontSpriteSheetLocalStorageKey,
      JSON.stringify(englishSpriteSheet)
    );
  }
  //console.log("englishSpriteSheet", englishSpriteSheet);

  englishFontLineHeight = englishSpriteSheet.sprites[0].height;
  //console.log({ englishFontLineHeight });

  await brilliantWearGlassesDisplayCanvasHelper.uploadSpriteSheet(
    englishSpriteSheet
  );
  await brilliantWearGlassesDisplayCanvasHelper.selectSpriteSheet(
    englishSpriteSheet.name
  );
  await brilliantWearGlassesDisplayCanvasHelper.setSpritesLineHeight(
    englishFontLineHeight
  );
  await drawBrilliantWearGlassesDisplay();
} catch (error) {
  console.error("error parsing font", error);
}

/** @type {HTMLSelectElement} */
const setBrilliantWearGlassesDisplayBrightnessSelect = document.getElementById(
  "setBrilliantWearGlassesDisplayBrightness"
);

/** @type {HTMLOptGroupElement} */
const setBrilliantWearGlassesDisplayBrightnessOptgroup =
  setBrilliantWearGlassesDisplayBrightnessSelect.querySelector("optgroup");
BS.DisplayBrightnesses.forEach((displayBrightness) => {
  setBrilliantWearGlassesDisplayBrightnessOptgroup.appendChild(
    new Option(displayBrightness)
  );
});
setBrilliantWearGlassesDisplayBrightnessSelect.addEventListener(
  "input",
  (event) => {
    brilliantWearGlassesDisplayCanvasHelper.setBrightness(event.target.value);
  }
);
setBrilliantWearGlassesDisplayBrightnessSelect.value =
  brilliantWearGlassesDisplayCanvasHelper.brightness;
// BRILLIANT WEAR GLASSES END
