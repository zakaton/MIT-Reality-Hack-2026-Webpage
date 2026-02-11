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
// ROBOT END

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
