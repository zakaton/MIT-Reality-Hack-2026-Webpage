// THREE START
/** @type {import("three")} */
const THREE = window.THREE;

/** @typedef {import("three").Object3D} Object3D */
/** @typedef {import("three").Material} Material */
/** @typedef {import("three").Texture} Texture */
// THREE END

// AFRAME START
const sceneEntity = document.querySelector("a-scene");
console.log("sceneEntity", sceneEntity);
// AFRAME END

// POWER PET START
const powerPetEntity = document.getElementById("powerPet");
// POWER PET END

// POWER PET MODEL SELECT START
const powerPetModelSelect = document.getElementById("powerPetModel");
const powerPetModelOptgroup = powerPetModelSelect.querySelector("optgroup");
powerPetModelSelect.addEventListener("input", () => {
  powerPetEntity.setAttribute("power-pet", "model", powerPetModelSelect.value);
});
sceneEntity.addEventListener("power-pet-model-added", (event) => {
  const { models } = event.detail;

  powerPetModelOptgroup.innerHTML = "";
  Object.keys(models).forEach((name) => {
    powerPetModelOptgroup.appendChild(new Option(name));
  });
});
powerPetEntity.addEventListener("power-pet-model", (event) => {
  const { name } = event.detail;
  powerPetModelSelect.value = name;
});
// POWER PET MODEL SELECT END

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

// FILE UPLOAD START
window.addEventListener("dragover", (e) => {
  e.preventDefault();
});

window.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  //console.log("dropped file", file);
  if (file) {
    await onFile(file);
  }
});

const acceptedFileTypes = ["glb", "gltf"];
window.addEventListener("paste", async (event) => {
  const items = event.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    //console.log("pasted item", item);
    const file = item.getAsFile();
    if (!file) {
      return;
    }
    //console.log("pasted file", file);
    await onFile(file);
  }
});

const modelFileInput = document.getElementById("modelFile");
modelFileInput.addEventListener("input", async () => {
  for (let i = 0; i < modelFileInput.files.length; i++) {
    const file = modelFileInput.files[i];
    if (!file) {
      continue;
    }
    //console.log("input file", file);
    await onFile(file);
  }
  modelFileInput.value = "";
});

/** @param {File} file */
const onFile = async (file) => {
  if (acceptedFileTypes.includes(file.name.split(".")[1])) {
    await loadModelFile(file);
  }
};
/** @param {File} file */
const loadModelFile = async (file) => {
  console.log("loadModelFile", file);
  sceneEntity.emit("power-pet-add-model-file", { file });
};
// FILE UPLOAD STOP
