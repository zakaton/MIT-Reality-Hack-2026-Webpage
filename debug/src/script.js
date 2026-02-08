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
  setTimeout(() => {
    const localTransformCheckbox = document.querySelector(
      ".local-transform input"
    );
    if (getIsInspectorOpen() && !localTransformCheckbox.checked) {
      localTransformCheckbox.click();
    }
  }, 50);
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
// POWER PET MODEL SELECT END

// POWER PET VARIANTS START
/** @type {HTMLTemplateElement} */
const variantTemplate = document.getElementById("variantTemplate");
const variantsContainer = document.getElementById("variantsContainer");

const allVariantContainers = {};
const allVariantsContainers = {};

powerPetEntity.addEventListener("power-pet-model-loaded", (event) => {
  const { name, model } = event.detail;
  const { variantsArray } = model;
  //console.log("variantsArray", variantsArray);

  const variantContainers = {};

  const _variantsContainer = document.createElement("div");
  _variantsContainer.classList.add("hidden");
  _variantsContainer.dataset.model = name;
  _variantsContainer.classList.add("variantContainers");
  variantsContainer.appendChild(_variantsContainer);

  variantsArray.forEach(([path, oneOf]) => {
    /** @type {HTMLElement} */
    const variantContainer = variantTemplate.content
      .cloneNode(true)
      .querySelector(".variant");

    variantContainer.dataset.path = path;

    const pathSpan = variantContainer.querySelector("span.path");
    pathSpan.innerText = path;

    const select = variantContainer.querySelector("select");
    const optgroup = variantContainer.querySelector("optgroup");

    variantContainer.input = select;

    optgroup.label = `select ${path}`;
    oneOf.forEach((variant) => {
      optgroup.appendChild(new Option(variant));
    });

    select.addEventListener("input", () => {
      const { value } = select;
      //console.log({ path, value });
      powerPetEntity.setAttribute("power-pet", `variant_${path}`, value);
    });

    _variantsContainer.appendChild(variantContainer);
    variantContainers[path] = variantContainer;
  });

  allVariantContainers[name] = variantContainers;
  allVariantsContainers[name] = _variantsContainer;
});

powerPetEntity.addEventListener("power-pet-model", (event) => {
  const { name, model } = event.detail;
  const { variantsArray, selectedVariants } = model;
  //console.log("selectedVariants", selectedVariants);

  Object.entries(allVariantsContainers).forEach(([_name, container]) => {
    if (_name == name) {
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  });

  Object.entries(selectedVariants).forEach(([path, value]) => {
    allVariantContainers[name][path].input.value = value;
  });

  if (variantsArray.length > 0) {
    variantsContainer.classList.remove("hidden");
  } else {
    variantsContainer.classList.add("hidden");
  }
});
powerPetEntity.addEventListener("power-pet-variant", (event) => {
  const { name, path, value } = event.detail;
  //console.log(event.type, { name, path, value }, allVariantContainers);
  allVariantContainers[name][path].input.value = value;
});
// POWER PET VARIANTS END

// POWER PET SQUASH START
const squashContainer = document.getElementById("squashContainer");

const tiltInput = document.getElementById("tilt");
const mirrorTiltInput = {
  x: false,
  y: false,
  apply(tilt) {
    if (this.x || this.y) {
      tilt = structuredClone(tilt);
      if (this.x) {
        tilt.x *= -1;
      }
      if (this.y) {
        tilt.y *= -1;
      }
    }
    return tilt;
  },
};
tiltInput.addEventListener("input", () => {
  const tilt = tiltInput.value;
  powerPetEntity.setAttribute("power-pet", "tilt", tilt);
});
powerPetEntity.addEventListener("power-pet-tilt", (event) => {
  const { tilt } = event.detail;
  tiltInput.value = tilt;
});
powerPetEntity.addEventListener("power-pet-tiltMin", (event) => {
  let { tiltMin } = event.detail;
  //console.log("tiltMin", tiltMin);
  tiltMin = mirrorTiltInput.apply(tiltMin);
  tiltInput.min = tiltMin;
});
powerPetEntity.addEventListener("power-pet-tiltMax", (event) => {
  let { tiltMax } = event.detail;
  //console.log("tiltMax", tiltMax);
  tiltMax = mirrorTiltInput.apply(tiltMax);
  tiltInput.max = tiltMax;
});

const squashInput = document.getElementById("squash");
squashInput.addEventListener("input", () => {
  const squash = +squashInput.value;
  //console.log({ squash });
  powerPetEntity.setAttribute("power-pet", "squash", squash);
});
powerPetEntity.addEventListener("power-pet-squash", (event) => {
  const { squash } = event.detail;
  squashInput.value = squash;
});
powerPetEntity.addEventListener("power-pet-squashMax", (event) => {
  const { squashMax } = event.detail;
  squashInput.min = squashMax.y;
});

const showSquashCenterInput = document.getElementById("showSquashCenter");
showSquashCenterInput.addEventListener("input", () => {
  const showSquashCenter = showSquashCenterInput.checked;
  console.log({ showSquashCenter });
  powerPetEntity.setAttribute(
    "power-pet",
    "showSquashCenter",
    showSquashCenter
  );
});
powerPetEntity.addEventListener("power-pet-showSquashCenter", (event) => {
  const { showSquashCenter } = event.detail;
  showSquashCenterInput.checked = showSquashCenter;
});

const showSquashControlPointInput = document.getElementById(
  "showSquashControlPoint"
);
showSquashControlPointInput.addEventListener("input", () => {
  const showSquashControlPoint = showSquashControlPointInput.checked;
  console.log({ showSquashControlPoint });
  powerPetEntity.setAttribute(
    "power-pet",
    "showSquashControlPoint",
    showSquashControlPoint
  );
});
powerPetEntity.addEventListener("power-pet-showSquashControlPoint", (event) => {
  const { showSquashControlPoint } = event.detail;
  showSquashControlPointInput.checked = showSquashControlPoint;
});

const showSquashColliderInput = document.getElementById("showSquashCollider");
showSquashColliderInput.addEventListener("input", () => {
  const showSquashCollider = showSquashColliderInput.checked;
  console.log({ showSquashCollider });
  powerPetEntity.setAttribute(
    "power-pet",
    "showSquashCollider",
    showSquashCollider
  );
});
powerPetEntity.addEventListener("power-pet-showSquashCollider", (event) => {
  const { showSquashCollider } = event.detail;
  showSquashColliderInput.checked = showSquashCollider;
});

const squashCenterYInput = document.getElementById("squashCenterY");
squashCenterYInput.addEventListener("input", () => {
  const squashCenterY = +squashCenterYInput.value;
  //console.log({ squashCenterY });
  powerPetEntity.setAttribute("power-pet", "squashCenter", {
    y: squashCenterY,
  });
});
powerPetEntity.addEventListener("power-pet-squashCenter", (event) => {
  const { squashCenter } = event.detail;
  squashCenterYInput.value = squashCenter.y;
});

const squashColliderCenterYInput = document.getElementById(
  "squashColliderCenterY"
);
squashColliderCenterYInput.addEventListener("input", () => {
  const squashColliderCenterY = +squashColliderCenterYInput.value;
  //console.log({ squashColliderCenterY });
  powerPetEntity.setAttribute("power-pet", "squashColliderCenter", {
    y: squashColliderCenterY,
  });
});
powerPetEntity.addEventListener("power-pet-squashColliderCenter", (event) => {
  const { squashColliderCenter } = event.detail;
  //console.log("squashColliderCenter", squashColliderCenter);
  squashColliderCenterYInput.value = squashColliderCenter.y;
});
// POWER PET SQUASH END

// POWER PET TURN START
const turnInput = document.getElementById("turn");
turnInput.addEventListener("input", () => {
  const turn = +turnInput.value;
  // console.log({ turn });
  powerPetEntity.setAttribute("power-pet", "turn", turn);
});
powerPetEntity.addEventListener("power-pet-turn", (event) => {
  const { turn } = event.detail;
  //console.log("turn", turn);
  turnInput.value = turn;
});
// POWER PET TURN END

// POWER PET PUPIL OFFSETS START
/** @type {HTMLTemplateElement} */
const pupilOffsetTemplate = document.getElementById("pupilOffsetTemplate");
const pupilOffsetsContainer = document.getElementById("pupilOffsetsContainer");

const allPupilOffsetContainers = {};
const allPupilOffsetsContainers = {};

const onlyShowHighLevelPupilOffsets = true;

powerPetEntity.addEventListener("power-pet-model-loaded", (event) => {
  const { name, model } = event.detail;
  const { pupilOffsetsArray } = model;
  console.log("pupilOffsetsArray", pupilOffsetsArray);

  const pupilOffsetContainers = {};

  const _pupilOffsetsContainer = document.createElement("div");
  _pupilOffsetsContainer.classList.add("hidden");
  _pupilOffsetsContainer.dataset.model = name;
  _pupilOffsetsContainer.classList.add("pupilOffsetContainers");
  pupilOffsetsContainer.appendChild(_pupilOffsetsContainer);

  pupilOffsetsArray.forEach(([path, offset]) => {
    if (onlyShowHighLevelPupilOffsets && path.split(".").length > 1) {
      return;
    }

    /** @type {HTMLElement} */
    const pupilOffsetContainer = pupilOffsetTemplate.content
      .cloneNode(true)
      .querySelector(".pupilOffset");

    pupilOffsetContainer.dataset.path = path;

    const pathSpan = pupilOffsetContainer.querySelector("span.path");
    pathSpan.innerText = path;

    const input = pupilOffsetContainer.querySelector("[data-input]");
    pupilOffsetContainer.input = input;

    input.value = offset;

    input.addEventListener("input", () => {
      const { value } = input;
      //console.log({ path }, value);
      powerPetEntity.setAttribute("power-pet", `pupil_${path}`, value);
    });

    _pupilOffsetsContainer.appendChild(pupilOffsetContainer);
    pupilOffsetContainers[path] = pupilOffsetContainer;
  });

  allPupilOffsetContainers[name] = pupilOffsetContainers;
  allPupilOffsetsContainers[name] = _pupilOffsetsContainer;
});

powerPetEntity.addEventListener("power-pet-model", (event) => {
  const { name, model } = event.detail;
  const { pupilOffsetsArray } = model;
  //console.log("pupilOffsetsArray", pupilOffsetsArray);

  Object.entries(allPupilOffsetsContainers).forEach(([_name, container]) => {
    if (_name == name) {
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  });

  pupilOffsetsArray.forEach(([path, value]) => {
    if (onlyShowHighLevelPupilOffsets && path.split(".").length > 1) {
      return;
    }
    allPupilOffsetContainers[name][path].input.value = value;
  });

  if (pupilOffsetsArray.length > 0) {
    pupilOffsetsContainer.classList.remove("hidden");
  } else {
    pupilOffsetsContainer.classList.add("hidden");
  }
});
powerPetEntity.addEventListener("power-pet-pupilOffset", (event) => {
  const { name, path, value } = event.detail;
  //console.log(event.type, { name, path, value }, allPupilOffsetContainers);
  const input = allPupilOffsetContainers[name][path]?.input;
  if (input) {
    input.value = value;
  }
});

// POWER PET PUPIL OFFSETS END
