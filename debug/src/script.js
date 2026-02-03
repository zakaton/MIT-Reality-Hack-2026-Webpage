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
  Object.keys(models).forEach((modelName) => {
    powerPetModelOptgroup.appendChild(new Option(modelName));
  });
});
powerPetEntity.addEventListener("power-pet-model", (event) => {
  const { modelName } = event.detail;
  powerPetModelSelect.value = modelName;
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

// GLB UPLOAD START
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

const glbFileInput = document.getElementById("glbFile");
glbFileInput.addEventListener("input", async () => {
  for (let i = 0; i < glbFileInput.files.length; i++) {
    const file = glbFileInput.files[i];
    if (!file) {
      continue;
    }
    //console.log("input file", file);
    await onFile(file);
  }
  glbFileInput.value = "";
});

/** @param {File} file */
const onFile = async (file) => {
  if (acceptedFileTypes.includes(file.name.split(".")[1])) {
    await loadGlb(file);
  }
};
/** @param {File} glbFile */
const loadGlb = async (glbFile) => {
  console.log("loadGlb", glbFile);
  sceneEntity.systems["power-pet"].addModelFile(glbFile);
};
// GLB UPLOAD STOP
