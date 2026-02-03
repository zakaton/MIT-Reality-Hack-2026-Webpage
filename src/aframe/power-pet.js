/** @typedef {import("three").Mesh} Mesh */

AFRAME.registerSystem("power-pet", {
  schema: {
    models: { type: "array" },
  },

  init: function () {
    this.components = [];
    this.models = {};
  },

  update: function (oldData) {
    const diff = AFRAME.utils.diff(oldData, this.data);

    const diffKeys = Object.keys(diff);
    //console.log({ diffKeys });

    diffKeys.forEach((diffKey) => {
      //console.log("update", { [diffKey]: this.data[diffKey] });
      switch (diffKey) {
        case "models":
          this.data.models.forEach((modelSrc) => {
            this.addModel(modelSrc.replaceAll("#", ""), modelSrc);
          });
          break;
        default:
          console.warn(`uncaught diffKey "${diffKey}"`);
          break;
      }
    });
  },

  _add: function (component) {
    console.log("_add", component);
    this.components.push(component);
  },
  _remove: function (component) {
    if (this.components.includes(component)) {
      console.log("_remove", component);
      this.component.splice(this.components.indexOf(component), 1);
    }
  },

  addModelFile: function (file) {
    this.addModel(file.name.split(".")[0], URL.createObjectURL(file));
  },
  addModel: function (name, src) {
    console.log("addModel", name, src);
    if (this.models[name]) {
      URL.revokeObjectURL(this.models[name]);
      this.models[name] = src;
      this.components.forEach((component) => {
        if (component.data.model == name) {
          component.selectModel(name);
        }
      });
    } else {
      this.models[name] = src;
      AFRAME.components["power-pet"].schema.model.oneOf.push(name);
      if (AFRAME.INSPECTOR?.opened) {
        const selected = AFRAME.INSPECTOR.selectedEntity;
        if (selected?.components?.["power-pet"]) {
          AFRAME.INSPECTOR.selectEntity(selected);
        }
      }
    }
    console.log("models", this.models);
    this.el.emit("power-pet-model-added", {
      models: this.models,
      modelName: name,
    });
  },
});

AFRAME.registerComponent("power-pet", {
  schema: {
    model: { oneOf: [] },
  },
  dependencies: [],

  init: function () {
    this._modelInit();
    this.system._add(this);
  },
  remove: function () {
    this.system._remove(this);
  },

  tick: function () {
    // FILL
  },

  // UTILS START
  _updateData: function (key, value, shouldFlushToDOM = true) {
    this.attrValue[key] = value;
    if (shouldFlushToDOM) {
      this._flushToDOM();
    }
  },
  _flushToDOM: function () {
    this.el.flushToDOM();
    if (AFRAME.INSPECTOR?.opened) {
      const selected = AFRAME.INSPECTOR.selectedEntity;
      if (selected === this.el) {
        AFRAME.INSPECTOR.selectEntity(selected);
      }
    }
  },
  // UTILS END

  update: function (oldData) {
    const diff = AFRAME.utils.diff(oldData, this.data);

    const diffKeys = Object.keys(diff);

    //console.log({ diffKeys });

    diffKeys.forEach((diffKey) => {
      //console.log("update", { [diffKey]: this.data[diffKey] });
      switch (diffKey) {
        case "model":
          if (this.data.model.startsWith("#")) {
            const model = this.data.model.replaceAll("#", "");
            this._updateData("model", model);
            this.system.addModel(model, this.data.model);
          } else {
            this.selectModel(this.data.model);
          }
          break;
        default:
          console.warn(`uncaught diffKey "${diffKey}"`);
          break;
      }
    });
  },

  // MODEL START
  _modelInit: function () {
    this.models = {};
    this.modelContainerEntity = document.createElement("a-entity");
    this.el.appendChild(this.modelContainerEntity);
  },
  _loadModel: function (modelName) {
    console.log("loadModel", modelName);
    if (!this.system.models[modelName]) {
      console.log(`no model found for modelName "${modelName}"`);
      return;
    }
    if (this.models[modelName]) {
      this.models[modelName].entity.remove();
      delete this.models[modelName];
    }

    const modelSrc = this.system.models[modelName];

    //console.log("creating new entity");
    const modelEntity = document.createElement("a-entity");
    modelEntity.setAttribute("gltf-model", modelSrc);
    modelEntity.setAttribute("visible", "false");
    modelEntity.addEventListener("model-loaded", () => {
      //console.log("model-loaded", modelEntity);

      const root = modelEntity.getObject3D("mesh");
      if (!root) {
        console.error("no mesh found in modelEntity");
        return;
      }

      const meshTree = {};
      root.traverse((node) => {
        if (!node.isMesh) return;

        /** @type {Mesh} */
        const mesh = node;

        const meshPath = mesh.name.split("_");
        const uvCount = Object.keys(mesh.geometry.attributes).filter((name) =>
          name.startsWith("uv")
        ).length;

        console.log("mesh", meshPath, { uvCount });

        let meshTreeWalker = meshTree;
        meshPath.forEach((segment, index) => {
          const isLast = index == meshPath.length - 1;
          if (isLast) {
            meshTreeWalker[segment] = { mesh, uvCount, isLast };
          } else {
            if (!meshTreeWalker[segment]) {
              meshTreeWalker[segment] = {};
            }
            meshTreeWalker = meshTreeWalker[segment];
          }
        });
      });

      console.log("meshTree", meshTree);
      this.models[modelName] = {
        src: modelSrc,
        entity: modelEntity,
        meshTree,
      };
      this.el.emit("power-pet-model-loaded", {
        modelName,
      });
      this.selectModel(modelName);
    });
    this.modelContainerEntity.appendChild(modelEntity);
  },
  selectModel: function (modelName) {
    if (!this.system.models[modelName]) {
      console.log(`no model found with modelName "${modelName}"`);
      return;
    }
    if (!this.models[modelName]) {
      this._loadModel(modelName);
      return;
    }
    if (this.models[modelName].src != this.system.models[modelName]) {
      console.log(`reloading model "${modelName}"`);
      this._loadModel(modelName);
      return;
    }
    //console.log("selectModel", { modelName });

    const previousModelName = this.selectedModelName;
    if (this.models[previousModelName]) {
      const { entity } = this.models[previousModelName];
      entity.object3D.visible = false;
    }

    const { entity } = this.models[modelName];
    entity.object3D.visible = true;

    this.selectedModelName = modelName;

    this.el.emit("power-pet-model", {
      modelName,
    });
    this._updateData("model", modelName);
  },
  // MODEL END
});
