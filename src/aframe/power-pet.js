/** @typedef {import("three").Mesh} Mesh */

AFRAME.registerSystem("power-pet", {
  schema: {
    models: { type: "array" },
  },

  init: function () {
    this.components = [];
    this.models = {};

    this.el.addEventListener(
      "power-pet-add-model-file",
      this._onAddModelFile.bind(this)
    );
    this.el.addEventListener(
      "power-pet-add-model",
      this._onAddModel.bind(this)
    );
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

  // COMPONENT START
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
  // COMPONENT END

  // MODEL START
  _onAddModelFile: function (event) {
    const { file } = event.detail;
    this.addModelFile(file);
  },
  addModelFile: function (file) {
    this.addModel(file.name.split(".")[0], URL.createObjectURL(file));
  },

  _onAddModel: function (event) {
    const { name, src } = event.detail;
    this.addModel(name, src);
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
      name,
    });
  },
  // MODEL END
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
  _loadModel: function (name) {
    console.log("loadModel", name);
    if (!this.system.models[name]) {
      console.log(`no model found for name "${name}"`);
      return;
    }
    if (this.models[name]) {
      this.models[name].entity.remove();
      delete this.models[name];
    }

    const modelSrc = this.system.models[name];

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
      this.models[name] = {
        src: modelSrc,
        entity: modelEntity,
        meshTree,
      };
      this.el.emit("power-pet-model-loaded", {
        name,
      });
      this.selectModel(name);
    });
    this.modelContainerEntity.appendChild(modelEntity);
  },
  selectModel: function (name) {
    if (!this.system.models[name]) {
      console.log(`no model found with name "${name}"`);
      return;
    }
    if (!this.models[name]) {
      this._loadModel(name);
      return;
    }
    if (this.models[name].src != this.system.models[name]) {
      console.log(`reloading model "${name}"`);
      this._loadModel(name);
      return;
    }
    //console.log("selectModel", { name });

    const previousname = this.selectedname;
    if (this.models[previousname]) {
      const { entity } = this.models[previousname];
      entity.object3D.visible = false;
    }

    const { entity } = this.models[name];
    entity.object3D.visible = true;

    this.selectedname = name;

    this.el.emit("power-pet-model", {
      name,
    });
    this._updateData("model", name);
  },
  // MODEL END
});
