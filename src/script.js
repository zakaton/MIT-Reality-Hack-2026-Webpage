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

/** @param {(type: AngleType, index: number, angle: number) => void} callback */
const forEachAngle = (callback) => {
  Object.entries(angles).forEach(([type, typeAngles]) => {
    typeAngles.forEach((angle, index) => {
      // console.log(typeAngles, { type, index, angle });
      if (isNaN(angle)) {
        angle = typeAngles[index] = 0;
      }
      callback(type, index, angle);
    });
  });
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

// POWER PET START
const powerPetEntity = document.getElementById("powerPet");
// POWER PET END

// ROBOT START
const robotEntity = document.getElementById("robot");
robotEntity.addEventListener("robot-angle", (event) => {
  const { type, index, angle, isOffset } = event.detail;
  //console.log("robot-angle", { type, index, angle, isOffset });
  setAngle(type, index, angle, isOffset);
});
robotEntity.addEventListener("robot-tare-angle", (event) => {
  const { type, index } = event.detail;
  //console.log("robot-tare-angle", { type, index });
  tareAngle(type, index);
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
const lockPointerButton = document.getElementById("lockPointer");
lockPointerButton.addEventListener("click", async () => {
  if (isPointerLocked) {
    return;
  }
  lockPointerButton.requestPointerLock();
});
const lockPointerScalars = {
  stepper: 1,
  servo0: 1,
};
let isPointerDown = false;
const usePointerAsToggle = true;
const setIsPointerDown = (newIsPointerDown) => {
  isPointerDown = newIsPointerDown;
  // console.log({ isPointerDown });
};
lockPointerButton.addEventListener("mousedown", () => {
  if (usePointerAsToggle) {
    setIsPointerDown(!isPointerDown);
  } else {
    setIsPointerDown(true);
  }
});
lockPointerButton.addEventListener("mouseup", () => {
  if (usePointerAsToggle) {
  } else {
    setIsPointerDown(false);
  }
});
lockPointerButton.addEventListener("mousemove", (event) => {
  if (!isPointerLocked) {
    return;
  }
  if (!isPointerDown) {
    return;
  }
  const { movementX, movementY } = event;
  // console.log({ movementX, movementY });
  const servo0Angle = movementY * lockPointerScalars.servo0;
  const stepperAngle = movementX * lockPointerScalars.stepper;
  // console.log({ stepperAngle, servo0Angle });
  setAngles(
    {
      servo: [servo0Angle],
      stepper: [stepperAngle],
    },
    true
  );
});

let isPointerLocked = false;
const setIsPointerLocked = (newIsPointerLocked) => {
  isPointerLocked = newIsPointerLocked;
  //console.log({ isPointerLocked });
  lockPointerButton.innerText = isPointerLocked
    ? "pointer locked"
    : "lock pointer";
};
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === lockPointerButton) {
    setIsPointerLocked(true);
  } else {
    setIsPointerLocked(false);
  }
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
  console.log("tareBrilliantWearOrientation", brilliantWearTareAngles);

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
