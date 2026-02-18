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
    angleInputs[type][index].forEach((input) => (input.value = angle));
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
  // console.log("setAngles", newAngles, { isOffset });
  if (isOffset) {
    const newAngleOffsets = newAngles;
    newAngles = structuredClone(angles);
    for (let type in newAngleOffsets) {
      newAngleOffsets[type].forEach((angle, index) => {
        newAngles[type][index] = Math.round(newAngles[type][index] + angle);
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
  Object.entries(angles).forEach(([type, angles]) => {
    angles.forEach((angle, index) => {
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
  const servoAngle = y;
  setAngles({
    servo: [servoAngle],
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
  stepper: 3,
  servo0: 2,
};
lockPointerButton.addEventListener("mousemove", (event) => {
  if (!isPointerLocked) {
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
// FILL
// MIDI END
