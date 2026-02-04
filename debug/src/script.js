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

  if (!powerPetEntity.getAttribute("power-pet").model) {
    powerPetEntity.setAttribute(
      "power-pet",
      "model",
      powerPetModelSelect.value
    );
  }
});
powerPetEntity.addEventListener("power-pet-model", (event) => {
  const { name } = event.detail;
  powerPetModelSelect.value = name;
});
// POWER PET MODEL SELECT END

// POWER PET VARIANTS START

/** @type {HTMLTemplateElement} */
const variantTemplate = document.getElementById("variantTemplate");
const variantsContainer = document.getElementById("variantsContainer");

const allVariantContainers = {};
const allVariantsContainers = {};

powerPetEntity.addEventListener("power-pet-model-loaded", (event) => {
  const { name, model } = event.detail;
  const { variants } = model;

  const variantContainers = {};

  const _variantsContainer = document.createElement("div");
  _variantsContainer.classList.add("hidden");
  _variantsContainer.dataset.model = name;
  _variantsContainer.classList.add("variantContainers");
  variantsContainer.appendChild(_variantsContainer);

  Object.entries(variants)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([path, oneOf]) => {
      /** @type {HTMLElement} */
      const variantContainer = variantTemplate.content
        .cloneNode(true)
        .querySelector(".variant");

      variantContainer.dataset.variant = path;

      const pathSpan = variantContainer.querySelector("span.path");
      pathSpan.innerText = path;

      const select = variantContainer.querySelector("select");
      const optgroup = variantContainer.querySelector("optgroup");

      variantContainer.select = select;

      optgroup.label = `select ${path}`;
      oneOf.forEach((variant) => {
        optgroup.appendChild(new Option(variant));
      });

      select.addEventListener("input", () => {
        powerPetEntity.setAttribute("power-pet", path, select.value);
      });

      _variantsContainer.appendChild(variantContainer);
      variantContainers[path] = variantContainer;
    });

  allVariantContainers[name] = variantContainers;
  allVariantsContainers[name] = _variantsContainer;
});

powerPetEntity.addEventListener("power-pet-model", (event) => {
  const { name, model } = event.detail;
  const { selectedVariants } = model;
  console.log(event.type, selectedVariants);

  Object.entries(allVariantsContainers).forEach(([_name, container]) => {
    if (_name == name) {
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  });

  Object.entries(selectedVariants).forEach(([path, value]) => {
    allVariantContainers[name][path].select.value = value;
  });
});
powerPetEntity.addEventListener("power-pet-variant", (event) => {
  const { name, path, value } = event.detail;
  //console.log(event.type, { name, path, value }, allVariantContainers);
  allVariantContainers[name][path].select.value = value;
});
// POWER PET VARIANTS END

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
