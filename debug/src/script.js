// SCENE START
const sceneEntity = document.querySelector("a-scene");
//console.log("sceneEntity", sceneEntity);
// SCENE END

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

// POWER PET START
const powerPetEntity = document.getElementById("powerPet");
// POWER PET END

// POWER PET CONTAINER START
const capitalizeFirstLetter = (string) =>
  string[0].toUpperCase() + string.slice(1);
const onlyShowHighLevelPupils = true;
const setupContainer = (valueName) => {
  const valuesArrayName = `${valueName}sArray`;
  const allValuesName = `all${capitalizeFirstLetter(valueName)}s`;
  //console.log({ valueName, valuesArrayName, allValuesName });

  const valuesContainer = document.getElementById(`${valueName}s`);
  const valueTemplate = valuesContainer.querySelector("template");

  const allValueContainers = {};
  const allValuesContainers = {};

  powerPetEntity.addEventListener("power-pet-model-loaded", (event) => {
    const { name, model } = event.detail;
    const { [valuesArrayName]: valuesArray, [allValuesName]: allValues } =
      model;
    console.log(valuesArrayName, valuesArray);
    console.log(allValuesName, allValues);

    const valueContainers = {};

    const _valuesContainer = document.createElement("div");
    _valuesContainer.classList.add("hidden");
    _valuesContainer.dataset.model = valueName;
    _valuesContainer.classList.add("containers");
    valuesContainer.appendChild(_valuesContainer);

    valuesArray.forEach(([path, value]) => {
      if (
        valueName.startsWith("pupil") &&
        onlyShowHighLevelPupils &&
        path.split(".").length > 1
      ) {
        return;
      }

      /** @type {HTMLElement} */
      const valueContainer = valueTemplate.content
        .cloneNode(true)
        .querySelector(`.${valueName}`);
      valueContainer.dataset.path = path;

      const pathSpan = valueContainer.querySelector("span.path");
      pathSpan.innerText = path;

      const input = valueContainer.querySelector(".input");
      valueContainer.input = input;

      if (allValues) {
        const optgroup = input.querySelector("optgroup");
        optgroup.label = `select ${path}`;
        allValues[path].forEach((value) => {
          optgroup.appendChild(new Option(value));
        });
      }

      input.value = value;

      input.addEventListener("input", () => {
        const { value } = input;
        //console.log({ path }, value);
        powerPetEntity.setAttribute("power-pet", `${valueName}_${path}`, value);
      });

      _valuesContainer.appendChild(valueContainer);
      valueContainers[path] = valueContainer;
    });

    allValueContainers[name] = valueContainers;
    allValuesContainers[name] = _valuesContainer;
  });

  powerPetEntity.addEventListener("power-pet-model", (event) => {
    const { name, model } = event.detail;
    const { [valuesArrayName]: valuesArray } = model;
    //console.log(valuesArrayName, valuesArray);

    Object.entries(allValuesContainers).forEach(([_name, container]) => {
      if (_name == name) {
        container.classList.remove("hidden");
      } else {
        container.classList.add("hidden");
      }
    });

    valuesArray.forEach(([path, value]) => {
      if (
        valueName.startsWith("pupil") &&
        onlyShowHighLevelPupils &&
        path.split(".").length > 1
      ) {
        return;
      }
      allValueContainers[name][path].input.value = value;
    });

    if (valuesArray.length > 0) {
      valuesContainer.classList.remove("hidden");
    } else {
      valuesContainer.classList.add("hidden");
    }
  });
  powerPetEntity.addEventListener(`power-pet-${valueName}`, (event) => {
    const { name, path, value } = event.detail;
    //console.log(event.type, { name, path, value }, allValueContainers);
    const input = allValueContainers[name][path]?.input;
    if (input) {
      input.value = value;
    }
  });
};
// POWER PET CONTAINER END

// POWER PET INPUT START
const setupInput = (name, options = {}) => {
  if (options.range) {
    options = Object.assign({}, options, { min: true, max: true });
  }

  let id = name;
  const { property } = options;
  if (property) {
    id += property[0].toUpperCase() + property.slice(1);
  }

  const input = document.getElementById(id);
  // console.log(options, { id }, input);

  input.addEventListener("input", () => {
    let value = input.type == "checkbox" ? input.checked : input.value;
    if (property) {
      value = { [property]: value };
    }
    //console.log({ [name]: value });
    powerPetEntity.setAttribute("power-pet", name, value);
  });
  const updateValue = (value) => {
    if (property) {
      value = value[property];
    }
    //console.log({ [name]: value });
    if (input.type == "checkbox") {
      input.checked = value;
    } else {
      input.value = value;
    }
  };
  powerPetEntity.addEventListener(`power-pet-${name}`, (event) => {
    let { [name]: value } = event.detail;
    updateValue(value);
  });

  powerPetEntity.addEventListener("loaded", () => {
    updateValue(powerPetEntity.components["power-pet"].data[name]);
  });

  const { min } = options;
  if (min) {
    const minName = name + "Min";
    powerPetEntity.addEventListener(`power-pet-${minName}`, (event) => {
      let { [minName]: value } = event.detail;
      if (typeof min == "string") {
        value = value[min];
      }
      // console.log(minName, value);
      input.min = value;
    });
  }

  const { max } = options;
  if (max) {
    const maxName = name + "Max";
    powerPetEntity.addEventListener(`power-pet-${maxName}`, (event) => {
      let { [maxName]: value } = event.detail;
      if (typeof max == "string") {
        value = value[max];
      }
      // console.log(maxName, value);
      input.max = value;
    });
  }
};
// POWER PET INPUT END

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

  if (!powerPetEntity.getAttribute("power-pet")?.model) {
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

setupInput("showModelBoundingBox");
// POWER PET MODEL SELECT END

// POWER PET VARIANTS START
setupContainer("variant");
// POWER PET VARIANTS END

// POWER PET SQUASH START
setupInput("tilt", { range: true });
setupInput("squash", { min: "y" });

setupInput("showSquashCenter", { range: true });
setupInput("showSquashControlPoint", { range: true });
setupInput("showSquashCollider", { range: true });

setupInput("squashCenter", { property: "y" });
setupInput("squashColliderCenter", { property: "y" });
// POWER PET SQUASH END

// POWER PET TURN START
setupInput("turn");
// POWER PET TURN END

// POWER PET PUPIL START
setupContainer("pupilScale");
setupContainer("pupilOffset");
setupContainer("pupilRotation");
// POWER PET PUPIL END

// POWER PET EYE START
setupInput("blinking");
setupInput("lookAround");
setupContainer("closedEye");
// POWER PET EYE END
