/** @type {import("three")} */
const THREE = window.THREE;

AFRAME.registerSystem("power-pet", {
  getIsInspectorOpen: function () {
    return AFRAME.INSPECTOR?.opened;
  },
  getSelectedInspectorEntity: function () {
    return this.getIsInspectorOpen() && AFRAME.INSPECTOR?.selectedEntity;
  },

  schema: {
    models: { type: "array" },
    tickInInspector: { type: "boolean", default: true },
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

  tick: function (time, timeDelta) {
    if (this.data.tickInInspector && this.getIsInspectorOpen()) {
      this.components.forEach((component) => component.tick(time, timeDelta));
    }
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
        case "tickInInspector":
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
      const selectedEntity = this.getSelectedInspectorEntity();
      if (selectedEntity?.components?.["power-pet"]) {
        AFRAME.INSPECTOR.selectEntity(selectedEntity);
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

    squashCenter: { type: "vec3", default: "0 0 0" },
    squash: { type: "number", default: 1 },
    squashMax: { type: "vec2", default: "1.15 0.85" },
    showSquashCenter: { default: false },

    squashColliderSize: { type: "number", default: "0.2" },
    squashColliderCenter: { type: "vec3", default: "0 0.040 0" },
    showSquashCollider: { default: false },
    showSquashControlPoint: { default: false },

    tilt: { type: "vec2", value: "0 0" },
    tiltMin: { type: "vec2", default: "-0.3 -0.3" },
    tiltMax: { type: "vec2", default: "0.3 0.3" },
  },

  init: function () {
    this._initModel();
    this._initSquash();
    this.system._add(this);
  },
  remove: function () {
    this.system._remove(this);
  },

  tick: function (time, timeDelta) {
    this._tickSquash(time, timeDelta);
  },

  // UTILS START
  getIsInspectorOpen: function () {
    return this.system?.getIsInspectorOpen();
  },
  getSelectedInspectorEntity: function () {
    return this.system?.getSelectedInspectorEntity();
  },
  getIsSelectedInInspector: function () {
    return this.el && this.getSelectedInspectorEntity() == this.el;
  },
  _updateData: function (key, value, shouldFlushToDOM = true, detail) {
    this.data[key] = value;
    this.attrValue[key] = value;

    if (shouldFlushToDOM) {
      this._flushToDOM();
    }

    detail = detail ?? { [key]: value };
    this.el.emit(`power-pet-${key}`, detail);
  },
  _flushToDOM: function () {
    this.el.flushToDOM();
    if (this.getIsSelectedInInspector()) {
      AFRAME.INSPECTOR.selectEntity(this.el);
    }
  },
  // UTILS END

  update: function (oldData) {
    const diff = AFRAME.utils.diff(oldData, this.data);

    const diffKeys = Object.keys(diff);

    //console.log({ diffKeys });

    diffKeys.forEach((diffKey) => {
      // console.log("update", { [diffKey]: this.data[diffKey] });
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
          case "squash":
            this.setSquash(this.data.squash);
            break;
          case "squashCenter":
            this.setSquashCenter(this.data.squashCenter);
            break;
          case "squashMax":
            this.setSquashMax(this.data.squashMax);
            break;
          case "showSquashCenter":
            this.setShowSquashCenter(this.data.showSquashCenter);
            break;
          case "showSquashControlPoint":
            this.setShowSquashControlPoint(this.data.showSquashControlPoint);
            break;
          case "tilt":
            this.setTilt(this.data.tilt);
            break;
          case "tiltMin":
            this.setTiltMin(this.data.tiltMin);
            break;
          case "tiltMax":
            this.setTiltMax(this.data.tiltMax);
            break;
          case "showSquashCollider":
            this.setShowSquashCollider(this.data.showSquashCollider);
            break;
          case "squashColliderSize":
            this.setSquashColliderSize(this.data.squashColliderSize);
            break;
          case "squashColliderCenter":
            this.setSquashColliderCenter(this.data.squashColliderCenter);
            break;
          default:
            console.warn(`uncaught diffKey "${diffKey}"`);
            break;
        }
      }
    });
  },

  // MODEL START
  _initModel: function () {
    this.models = {};
    this.modelsEntity = document.createElement("a-entity");
    this.modelsEntity.setAttribute("rotation", "0 180 0");
    this.modelsEntity.classList.add("models");
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
    this.modelsEntity.appendChild(modelEntity);
  },
  selectModel: function (newName) {
    if (!this.system.models[newName]) {
      console.log(`no model found with name "${newName}"`);
      return;
    }
    if (!this.models[newName]) {
      this._loadModel(newName);
      return;
    }
    if (this.models[newName].src != this.system.models[newName]) {
      console.log(`reloading model "${newName}"`);
      this._loadModel(newName);
      return;
    }
    //console.log("selectModel", { name });

    const previousName = this.selectedName;
    if (this.models[previousName]) {
      const { entity } = this.models[previousName];
      entity.object3D.visible = false;
    }

    const { entity } = this.models[newName];
    entity.object3D.visible = true;

    this.selectedName = newName;
    this._updateVariants();

    this._updateData("model", newName, true, {
      name: newName,
      model: this.models[newName],
    });
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

    const variantsArray = Object.entries(variants).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
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

  // SQUASH START
  _initSquash: function () {
    this.squashEntity = document.createElement("a-entity");
    this.squashEntity.classList.add("squash");
    this.squashEntity.appendChild(this.modelsEntity);
    this.el.appendChild(this.squashEntity);

    this.squashCenterEntity = document.createElement("a-entity");
    this.squashCenterEntity.classList.add("squashCenter");
    this.squashCenterEntity.setAttribute("visible", this.data.showSquashCenter);
    this.squashEntity.appendChild(this.squashCenterEntity);

    this.squashCenterSphere = document.createElement("a-sphere");
    this.squashCenterSphere.setAttribute("color", "blue");
    this.squashCenterSphere.setAttribute("radius", "0.005");
    this.squashCenterSphere.setAttribute(
      "material",
      "depthTest: false; depthWrite: false; transparent: true; renderOrder: 999"
    );
    this.squashCenterEntity.appendChild(this.squashCenterSphere);

    this.squashControlPointEntity = document.createElement("a-entity");
    this.squashControlPointEntity.classList.add("squashControlPoint");
    this.squashControlPointEntity.setAttribute(
      "visible",
      this.data.showSquashControlPoint
    );
    this.squashCenterEntity.appendChild(this.squashControlPointEntity);

    this.squashControlPointSphere = document.createElement("a-sphere");
    this.squashControlPointSphere.setAttribute("color", "green");
    this.squashControlPointSphere.setAttribute("radius", "0.005");
    this.squashControlPointSphere.setAttribute(
      "material",
      "depthTest: false; depthWrite: false; transparent: true; renderOrder: 999"
    );
    this.squashControlPointEntity.appendChild(this.squashControlPointSphere);

    const squashColliderSizeString = `${this.data.squashColliderSize} ${this.data.squashColliderSize} ${this.data.squashColliderSize};`;
    this.squashColliderEntity = document.createElement("a-entity");
    this.squashColliderEntity.setAttribute(
      "obb-collider",
      `size: ${this.data.squashColliderSize};`
    );
    this.squashColliderEntity.classList.add("squashCollider");
    this.squashColliderEntity.setAttribute(
      "visible",
      this.data.showSquashCollider
    );
    this.el.appendChild(this.squashColliderEntity);

    this.squashColliderBox = document.createElement("a-box");
    this.squashColliderBox.setAttribute("opacity", "0.1");
    this.squashColliderBox.setAttribute("color", "red");
    this.squashColliderBox.setAttribute("scale", squashColliderSizeString);
    this.squashColliderEntity.appendChild(this.squashColliderBox);

    this.el.addEventListener(
      "obbcollisionstarted",
      this.onObbcollisionStarted.bind(this)
    );
    this.el.addEventListener(
      "obbcollisionended",
      this.onObbCollisionEnded.bind(this)
    );

    this._squashCollidedEntities = [];

    this._squashCenterWorldPosition = new THREE.Vector3();
    this._squashControlPoint = new THREE.Vector3();
    this._squashControlPoint2d = new THREE.Vector2();
    this._hasSquashControlPoint = false;
    this._squashColliderTempPosition = new THREE.Vector3();
    this._squashColliderClosestPosition = new THREE.Vector3();
  },
  setSquashMax: function (squashMax) {
    this._updateData("squashMax", squashMax);
    this.setSquash(this.data.squash);
  },
  setSquash: function (squash) {
    const { x, y } = this.data.squashMax;

    squash = THREE.MathUtils.clamp(squash, y, 1);
    console.log("setSquash", squash);

    const height = squash;
    const heightLerp = THREE.MathUtils.inverseLerp(1, y, height);
    const width = THREE.MathUtils.lerp(1, x, heightLerp);
    //console.log({ width, height });

    const { scale } = this.squashEntity.object3D;
    scale.y = height;
    scale.x = scale.z = width;

    this._updateData("squash", squash);
  },
  setSquashCenter: function (squashCenter) {
    Object.assign({}, this.data.squashCenter, squashCenter);
    //console.log("setSquashCenter", squashCenter);

    this.squashEntity.object3D.position.copy(squashCenter);
    this.modelsEntity.object3D.position.copy(squashCenter).negate();

    this._updateData("squashCenter", squashCenter);
  },
  setShowSquashCenter: function (showSquashCenter) {
    //console.log("setShowSquashCenter", showSquashCenter);
    this.squashCenterEntity.object3D.visible = showSquashCenter;
    this._updateData("showSquashCenter", showSquashCenter);
  },
  setShowSquashControlPoint: function (showSquashControlPoint) {
    //console.log("setShowSquashControlPoint", showSquashControlPoint);
    this.squashControlPointEntity.object3D.visible =
      this.data.showSquashControlPoint && this._hasSquashControlPoint;
    this._updateData("showSquashControlPoint", showSquashControlPoint);
  },
  setTiltMin: function (tiltMin) {
    this._updateData("tiltMin", tiltMin);
    this.setTilt(this.data.tilt);
  },
  setTiltMax: function (tiltMax) {
    this._updateData("tiltMax", tiltMax);
    this.setTilt(this.data.tilt);
  },
  setTilt: function (tilt) {
    tilt = Object.assign({}, this.data.tilt, tilt);
    const { tiltMin, tiltMax } = this.data;

    tilt.x = THREE.MathUtils.clamp(tilt.x, tiltMin.x, tiltMax.x);
    tilt.y = THREE.MathUtils.clamp(tilt.y, tiltMin.y, tiltMax.y);
    //console.log("setTilt", tilt);

    const roll = tilt.x;
    const pitch = tilt.y;

    //console.log({ pitch, roll });

    const { rotation } = this.squashEntity.object3D;
    rotation.x = pitch;
    rotation.z = roll;

    this._updateData("tilt", tilt);
  },

  setShowSquashCollider: function (showSquashCollider) {
    //console.log("setShowSquashCollider", showSquashCollider);
    this.squashColliderEntity.object3D.visible = showSquashCollider;
    this._updateData("showSquashCollider", showSquashCollider);
  },

  setSquashColliderCenter: function (squashColliderCenter) {
    Object.assign({}, this.data.squashColliderCenter, squashColliderCenter);
    //console.log("setSquashColliderCenter", squashColliderCenter);

    this.squashColliderEntity.object3D.position.copy(squashColliderCenter);

    this._updateData("squashColliderCenter", squashColliderCenter);
  },

  setSquashColliderSize: function (squashColliderSize) {
    squashColliderSize = THREE.MathUtils.clamp(squashColliderSize, 0.1, 0.25);
    //console.log("setSquashColliderSize", squashColliderSize);

    const squashColliderSizeString = `${squashColliderSize} ${squashColliderSize} ${squashColliderSize};`;

    this.squashColliderBox.setAttribute("scale", squashColliderSizeString);
    this.squashColliderEntity.setAttribute(
      "obb-collider",
      `size: ${squashColliderSize};`
    );
    if (this.squashColliderEntity.hasLoaded) {
      this.squashColliderEntity.components["obb-collider"].updateCollider();
    }
    this._updateData("squashColliderSize", squashColliderSize);
  },
  onObbcollisionStarted: function (event) {
    const { withEl } = event.detail;
    console.log(`started collision with "${withEl.id}"`);
    if (!this._squashCollidedEntities.includes(withEl)) {
      this._squashCollidedEntities.push(withEl);
    }
  },
  onObbCollisionEnded: function (event) {
    const { withEl } = event.detail;
    console.log(`ended collision with "${withEl.id}"`);
    if (this._squashCollidedEntities.includes(withEl)) {
      this._squashCollidedEntities.splice(
        this._squashCollidedEntities.indexOf(withEl),
        1
      );
    }
  },
  _tickSquash: function (time, timeDelta) {
    if (this.getIsInspectorOpen()) {
      this.squashColliderEntity.components["obb-collider"].tick();
    }

    if (this._squashCollidedEntities.length > 0) {
      this.squashEntity.object3D.getWorldPosition(
        this._squashCenterWorldPosition
      );
      let closestDistance = Infinity;
      this._hasSquashControlPoint = this._squashCollidedEntities.some(
        (entity) => {
          entity.components["obb-collider"].obb.clampPoint(
            this._squashCenterWorldPosition,
            this._squashColliderTempPosition
          );
          this.squashEntity.object3D.worldToLocal(
            this._squashColliderTempPosition
          );
          //console.log(this._squashColliderTempPosition);

          if (this._squashColliderTempPosition.y < 0) {
            return false;
          }

          const distance = this._squashColliderTempPosition.distanceTo(
            this._squashCenterWorldPosition
          );
          if (distance < closestDistance) {
            this._squashColliderClosestPosition.copy(
              this._squashColliderTempPosition
            );
            closestDistance = distance;
          }

          return true;
        }
      );
    } else {
      this._hasSquashControlPoint = false;
    }

    if (this._hasSquashControlPoint) {
      this._squashControlPoint.copy(this._squashColliderClosestPosition);
      //console.log(this._squashControlPoint);

      this.squashControlPointEntity.object3D.position.copy(
        this._squashControlPoint
      );

      this._squashControlPoint2d.copy({
        x: this._squashControlPoint.x,
        y: -this._squashControlPoint.z,
      });

      const length = this._squashControlPoint.length();
      const fullLength =
        this.data.squashColliderSize / 2 - this.data.squashCenter.y;
      const squash = length / fullLength;
      const radius = this._squashControlPoint2d.length();
      const angle = this._squashControlPoint2d.angle();

      console.log({ squash, radius, angle });

      const useSquash = radius < 0.05;
      console.log({ useSquash });
      if (useSquash) {
      }

      this.setSquash(squash);

      // FILL - calculate squash/tilt
      // FILL - figure animation
    } else {
      // FILL - return to default position
    }

    this.squashControlPointEntity.object3D.visible =
      this.data.showSquashControlPoint && this._hasSquashControlPoint;
  },
  // SQUASH END
});
