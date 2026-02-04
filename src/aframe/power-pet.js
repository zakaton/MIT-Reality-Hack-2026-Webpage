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

  init: function () {
    this._modelInit();
    this.system._add(this);
  },
  remove: function () {
    this.system._remove(this);
  },

  tick: function (time, timeDelta) {},

  // UTILS START
  _updateData: function (key, value, shouldFlushToDOM = true) {
    this.data[key] = value;
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
      if (diffKey.startsWith(this._variantPrefix)) {
        this.selectVariant(diffKey, this.data[diffKey]);
      } else {
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
      // console.log("model-loaded", modelEntity);

      const root = modelEntity.getObject3D("mesh");
      if (!root) {
        console.error("no mesh found in modelEntity");
        return;
      }

      const meshTree = {};
      const variants = {}; // "path.to.mesh": ["each", "possible", "variant"]
      root.traverse((object3D) => {
        if (!object3D.isMesh) return;

        /** @type {Mesh} */
        const mesh = object3D;

        mesh.name = this._variantPrefix + mesh.name;

        const meshPath = mesh.name.split("_");
        const uvCount = Object.keys(mesh.geometry.attributes).filter((name) =>
          name.startsWith("uv")
        ).length;
        const uvMap = {};

        const variantPath = meshPath.join(".");
        variants[variantPath] = [];
        if (uvCount > 1) {
          variants[variantPath] = new Array(uvCount).fill(0).map((_, index) => {
            const uvName =
              mesh.material.userData[`uv${index == 0 ? "" : index}`];
            if (uvName) {
              uvMap[uvName] = index;
              return uvName;
            }
            return index;
          });
        }

        //console.log("mesh", meshPath, { uvCount });

        const onMeshSegment = (meshTree, index = 0) => {
          const variantPath = meshPath.slice(0, index + 1).join(".");
          const segment = meshPath[index];
          const isLast = index == meshPath.length - 1;
          if (isLast) {
            meshTree[segment] = { mesh, uvCount, uvMap, isLast };
          } else {
            if (!meshTree[segment]) {
              meshTree[segment] = {};
            }
          }

          meshTree = meshTree[segment];

          if (!isLast) {
            onMeshSegment(meshTree, index + 1);
            const hasMeshChildren =
              Object.values(meshTree).filter((node) => node.isLast).length > 1;
            if (hasMeshChildren) {
              variants[variantPath] = Object.keys(meshTree).sort();
            }
          }

          if (index > 0) {
            const parentVariantPath = meshPath.slice(0, index).join(".");
            //console.log({ variantPath, parentVariantPath });
            variants[parentVariantPath] = variants[variantPath].slice().sort();
          }
        };
        onMeshSegment(meshTree);
      });
      console.log("meshTree", meshTree);

      Object.entries(variants).forEach(([key, oneOf]) => {
        if (oneOf.length < 2) {
          delete variants[key];
        }
      });

      console.log("variants", variants);

      const selectedVariants = {};
      Object.entries(variants).forEach(([key, oneOf]) => {
        selectedVariants[key] = oneOf.includes("default")
          ? "default"
          : oneOf[0];
      });

      const model = {
        src: modelSrc,
        entity: modelEntity,
        meshTree,
        variants,
        selectedVariants,
      };
      this.models[name] = model;
      this.el.emit("power-pet-model-loaded", {
        name,
        model,
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

    const previousname = this.selectedName;
    if (this.models[previousname]) {
      const { entity } = this.models[previousname];
      entity.object3D.visible = false;
    }

    const { entity } = this.models[name];
    entity.object3D.visible = true;

    this.selectedName = name;
    this._updateVariants();

    this.el.emit("power-pet-model", {
      name,
      model: this.models[name],
    });
    this._updateData("model", name);
  },
  // MODEL END

  // VARIANT START
  _variantPrefix: "~",
  _updateVariants: function () {
    // console.log("_updateVariants");

    const variants = this.models[this.selectedName]?.variants ?? {};
    let selectedVariants =
      this.models[this.selectedName]?.selectedVariants ?? {};
    selectedVariants = structuredClone(selectedVariants);

    const variantsArray = Object.entries(variants);
    const variantSchema = {};

    variantsArray.forEach(([key, oneOf]) => {
      variantSchema[key] = { oneOf };
    });
    this.extendSchema(variantSchema);

    variantsArray.forEach(([key, oneOf]) => {
      this.selectVariant(key, selectedVariants[key]);
    });
    this._flushToDOM();
  },
  selectVariant: function (path, value) {
    //console.log("selectVariant", { path, value });
    if (!this.models[this.selectedName]) {
      console.log("no model selected");
      return;
    }
    const { meshTree, selectedVariants, uvCount, uvMap } =
      this.models[this.selectedName];

    let meshTreeWalker = meshTree;
    const segments = path.split(".");
    const isValid = !segments.some((segment) => {
      if (!meshTreeWalker[segment]) {
        console.error(
          `invalid path "${path}" - no segment "${segment}" found`,
          meshTreeWalker,
          "in",
          meshTree
        );
        return true;
      }
      if (
        meshTreeWalker[segment].isLast &&
        meshTreeWalker[segment].uvCount == 1
      ) {
        console.error(
          `invalid path "${path}" - segment "${segment}" goes past last segment and has single uv`,
          meshTreeWalker,
          "in",
          meshTree
        );
        return true;
      }
      meshTreeWalker = meshTreeWalker[segment];
    });
    if (!isValid) {
      return;
    }

    //console.log("meshTreeWalker", meshTreeWalker);

    if (meshTreeWalker.isLast) {
      const node = meshTreeWalker;
      let channel = 0;
      if (isNaN(value)) {
        channel = node.uvMap[value];
      } else {
        channel = +value;
      }
      if (channel >= node.uvCount) {
        console.error(`invalid uv index ${channel}, max ${node.uvCount - 1}`);
        return;
      }
      console.log(`setting uv index to ${channel}`);
      node.mesh.material.map.channel = channel;
    } else {
      const children = Object.entries(meshTreeWalker);
      children.forEach(([name, child]) => {
        if (child.isLast && isNaN(value)) {
          const visible = name == value;
          child.mesh.visible = visible;
        } else {
          this.selectVariant([segments, name].join("."), value);
        }
      });
    }
    selectedVariants[path] = value;
    this._updateData(path, value, false);
    this.el.emit("power-pet-variant", {
      name: this.selectedName,
      path,
      value,
    });
  },
  // VARIANT END
});
