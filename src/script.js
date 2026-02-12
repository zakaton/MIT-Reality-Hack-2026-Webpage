// UNO Q START
import UnoQ from "./uno-q/UnoQ.js";
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

/** @param {Angles} newAngles */
const setAngles = (newAngles) => {
  // console.log("setAngles", newAngles);
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
 */
const setAngle = (type, index, angle) => {
  //console.log("setAngle", { type, index, angle });
  if (unoQ.isConnected) {
    unoQ.setAngle(type, index, angle);
  } else {
    const newAngles = structuredClone(angles);
    newAngles[type][index] = angle;
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
  const { type, index, angle } = event.detail;
  //console.log("robot-angle", { type, index, angle });
  setAngle(type, index, angle);
});
// ROBOT END
