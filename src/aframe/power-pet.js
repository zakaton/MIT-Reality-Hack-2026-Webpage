{
  /** @type {import("three")} */
  const THREE = window.THREE;

  /** @type {import("./Ticker")} */
  const Ticker = window.Ticker;

  /** @typedef {import("three").Mesh} Mesh */
  /** @typedef {import("three").Texture} Texture */

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
      handTrackingJoints: {
        type: "array",
        default: [8],
      },
      jointSize: { type: "number", default: 0.025 },
    },

    init: function () {
      this.components = [];
      this.models = {};

      this.obbColliders;

      this.el.addEventListener(
        "power-pet-add-model-file",
        this._onAddModelFile.bind(this)
      );
      this.el.addEventListener(
        "power-pet-add-model",
        this._onAddModel.bind(this)
      );

      this.handTrackingControls = {};
      this.sceneEl.addEventListener("loaded", () => {
        this.el
          .querySelectorAll("[hand-tracking-controls]")
          .forEach((entity) => {
            const component = entity.components["hand-tracking-controls"];
            const { hand } = component.data;
            this.handTrackingControls[hand] = component;
            const joints = this.data.handTrackingJoints;
            joints.map(Number).forEach((joint) => {
              if (hand == "left") {
                joint = 24 - joint;
              }
              //console.log({ hand, joint });
              const entity = document.createElement("a-entity");
              entity.setAttribute(
                "obb-collider",
                `trackedObject3D: parentEl.components.hand-tracking-controls.bones.${joint}; size: ${this.data.jointSize};`
              );
              component.el.appendChild(entity);
            });
          });
        //console.log("handTrackingControls", this.handTrackingControls);
      });
    },

    tick: function (time, timeDelta) {
      if (this.data.tickInInspector && this.getIsInspectorOpen()) {
        this.sceneEl.systems["obb-collider"].colliderEls.forEach((entity) =>
          entity.components["obb-collider"].tick(time, timeDelta)
        );
        this.components.forEach((component) => component.tick(time, timeDelta));
      }
    },

    update: function (oldData) {
      const diff = AFRAME.utils.diff(oldData, this.data);

      const diffKeys = Object.keys(diff);
      //console.log("diffKeys", diffKeys);

      diffKeys.forEach((diffKey) => {
        if (this.data[diffKey] == undefined) {
          // return;
        }
        //console.log("update", { [diffKey]: this.data[diffKey] });
        switch (diffKey) {
          case "models":
            this.data.models.forEach((modelSrc) => {
              this.addModel(modelSrc.replaceAll("#", ""), modelSrc);
            });
            break;
          case "tickInInspector":
            break;
          case "handTrackingJoints":
            break;
          case "jointSize":
            break;
          default:
            console.warn(`uncaught diffKey "${diffKey}"`);
            break;
        }
      });
    },

    // COMPONENT START
    _add: function (component) {
      //console.log("_add", component);
      this.components.push(component);
    },
    _remove: function (component) {
      if (this.components.includes(component)) {
        //console.log("_remove", component);
        this.components.splice(this.components.indexOf(component), 1);
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
      //console.log("addModel", name, src);
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
      //console.log("models", this.models);
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
      showModelBoundingBox: { type: "boolean", default: false },

      squashCenter: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
      squash: { type: "number", default: 1 },
      squashMin: { type: "vec2", default: { x: 1.15, y: 0.85 } },
      showSquashCenter: { default: false },

      squashColliderSize: { type: "number", default: 0.2 },
      squashColliderCenter: { type: "vec3", default: { x: 0, y: 0.04, z: 0 } },
      showSquashCollider: { type: "boolean", default: false },
      showSquashControlPoint: { type: "boolean", default: false },
      squashRadiusThreshold: { type: "number", default: 0.05 },
      squashRadiusBuffer: { type: "number", default: 0.03 },

      tilt: { type: "vec2", default: { x: 0, y: 0 } },
      tiltMin: { type: "vec2", default: { x: -0.3, y: -0.3 } },
      tiltMax: { type: "vec2", default: { x: 0.3, y: 0.3 } },
      squashTiltMax: { type: "vec2", default: { x: 0.3, y: 0.3 } },

      turn: { type: "number", default: 0 },

      pupilName: { type: "string", default: "pupil" },
      eyeName: { type: "string", default: "eye" },
      eyeCloseName: { type: "string", default: "close" },

      showLookAtPupils: { type: "boolean", default: false },
      showLookAt: { type: "boolean", default: false },
      lookAtPosition: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
      lookAtOffsetAngleMin: {
        type: "vec2",
        default: { x: -Math.PI / 2, y: -Math.PI / 2 },
      },
      lookAtOffsetAngleMax: {
        type: "vec2",
        default: { x: Math.PI / 2, y: Math.PI / 2 },
      },
      lookAtOffsetMin: { type: "vec2", default: { x: -0.03, y: -0.1 } },
      lookAtOffsetMax: { type: "vec2", default: { x: 0.03, y: 0.1 } },

      lookableAngleMin: { type: "vec2", default: { x: -1, y: -1 } },
      lookableAngleMax: { type: "vec2", default: { x: 1, y: 1 } },

      lookableDistanceMin: { type: "number", default: 0.05 },
      lookableDistanceMax: { type: "number", default: 0.5 },

      lookableSelector: { type: "string", default: "power-pet-lookable" },
      lookAround: { type: "boolean", default: true },

      lookableTickerMin: { type: "number", default: 3000 },
      lookableTickerMax: { type: "number", default: 5000 },

      lookableAsideTickerMin: { type: "number", default: 500 },
      lookableAsideTickerMax: { type: "number", default: 1000 },

      lookAtLookableNoiseTickerMin: { type: "number", default: 100 },
      lookAtLookableNoiseTickerMax: { type: "number", default: 800 },

      lookableWorldMeshTickerMin: { type: "number", default: 750 },
      lookableWorldMeshTickerMax: { type: "number", default: 2300 },

      lookAtLookableNoiseMin: { type: "number", default: 0.01 },
      lookAtLookableNoiseMax: { type: "number", default: 0.08 },

      isModelFacingBack: { type: "boolean", default: true },

      lookableWorldMeshAngleMin: { type: "vec2", default: { x: -1, y: -0.2 } },
      lookableWorldMeshAngleMax: { type: "vec2", default: { x: 1, y: 1 } },

      blinking: { type: "boolean", default: true },

      blinkOpenTickerMin: { type: "number", default: 1000 },
      blinkOpenTickerMax: { type: "number", default: 5000 },
      blinkCloseTickerMin: { type: "number", default: 30 },
      blinkCloseTickerMax: { type: "number", default: 200 },
    },

    init: function () {
      this._initUtils();
      this._initModel();
      this._initSquash();
      this._initPetting();
      this._initPupils();
      this._initLookAt();
      this._initLookables();
      this._initEyes();
      this.system._add(this);
    },
    remove: function () {
      this._removeLookAt();
      this._removeLookables();
      this.system._remove(this);
    },

    tick: function (time, timeDelta) {
      this._tickSquash(...arguments);
      this._tickSquashAnimation(...arguments);
      this._tickPupils(...arguments);
      this._tickLookAt(...arguments);
      if (this.data.lookAround) {
        this._tickLookables(...arguments);
      }
      this._tickEyes(...arguments);
    },

    // UTILS START
    _initUtils: function () {
      this._worldToLocalScale = new THREE.Vector3();
    },
    _getVectorAngles: function (direction) {
      const { x, y, z } = direction;
      const yaw = Math.atan2(x, z);
      const pitch = Math.atan2(y, Math.sqrt(x * x + z * z));
      return { yaw, pitch };
    },
    worldToLocal: function (object3D, vector3, excludeScale = false) {
      //console.log("worldToLocal", object3D, vector3);
      object3D.worldToLocal(vector3);
      if (excludeScale) {
        object3D.getWorldScale(this._worldToLocalScale);
        vector3.divide(this._worldToLocalScale);
      }
    },
    sortEntries: function (entries) {
      // console.log("sortEntries", entries);
      return entries.sort((a, b) => a[0].localeCompare(b[0]));
    },
    sortObjectEntries: function (object) {
      // console.log("sortObjectEntries", object);
      return this.sortEntries(Object.entries(object));
    },
    clampFloatToZero: function (number) {
      if (number == -0) {
        return 0;
      }
      return number.toString().includes("e") ? 0 : number;
    },
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
      //this.data[key] = value;
      //this.attrValue[key] = value;
      this.attrValueProxy[key] = value;

      if (shouldFlushToDOM) {
        this._flushToDOM();
      }

      detail = detail ?? { [key]: value };
      this.el.emit(`power-pet-${key}`, detail);
    },
    _deleteDataKey: function (key) {
      delete this.data[key];
      delete this.attrValue[key];
      delete this.attrValueProxy[key];
    },
    _flushToDOM: function () {
      this.flushToDOM();
      if (this.getIsSelectedInInspector()) {
        AFRAME.INSPECTOR.selectEntity(this.el);
      }
    },
    _updateValue: function ({
      prefix,
      path,
      values,
      value,
      eventName,
      valuesArray,
      shouldFlushToDOM,
      detail,
    }) {
      if (path in values) {
        values[path] = structuredClone(value);
        valuesArray.find(([key, _]) => key == path)[1] = value;
      }

      const dataPath = prefix + path;
      if (dataPath in this.schema) {
        this._updateData(dataPath, value, shouldFlushToDOM, detail);
        this.el.emit(`power-pet-${eventName}`, {
          name: this.selectedName,
          path,
          value,
        });
      }
    },

    _walkTree: function (path, tree, filterCallback) {
      let treeWalker = tree;
      const segments = path.split(".").filter(Boolean);
      const isValid = segments.every((segment) => {
        if (!treeWalker[segment]) {
          console.error(
            `invalid path "${path}" - no segment "${segment}" found`,
            treeWalker,
            "in",
            tree
          );
          return false;
        }
        if (filterCallback) {
          if (!filterCallback(treeWalker[segment], treeWalker, segment)) {
            return false;
          }
        }
        treeWalker = treeWalker[segment];
        return true;
      });
      //console.log("meshTreeWalker", { isValid }, meshTreeWalker);
      if (isValid) {
        return treeWalker;
      }
    },
    _traverseTree: function (tree, callback, segments = []) {
      //console.log("_traverseTree", tree, segments);
      Object.entries(tree).forEach(([segment, subTree]) => {
        const _segments = [...segments, segment];
        const path = _segments.join(".");
        const _continue = callback(subTree, path, true);
        if (_continue && !subTree.isLast) {
          this._traverseTree(subTree, callback, _segments);
          callback(subTree, path, false);
        }
      });
    },
    _sanitizePath: function (path, prefix, name) {
      path = path ?? "";
      if (path.startsWith(prefix)) {
        path = path.replace(prefix, "");
      }
      if (path.startsWith(name)) {
        path = path.replace(name, "");
      }
      if (path.startsWith(".")) {
        path = path.replace(".", "");
      }
      return path;
    },
    _setNodeProperty: function (path, value, callback, options) {
      const {
        prefix,
        values,
        valuesArray,
        eventName,
        defaultValue,
        clamp,
        name,
        nodes,
        isProperty,
        setPropertyWhenInvisible,
      } = options;
      path = this._sanitizePath(path, prefix, name);
      value = value ?? defaultValue;
      if (clamp) {
        value = clamp(value);
      }
      //console.log("_setProperty", path, value, { prefix });
      if (!this.getIsModelSelected()) {
        console.warn("no model selected");
        return;
      }

      const node = this._walkTree(path, nodes);
      if (!node) {
        return;
      }
      //console.log("node", node);

      if (node.isLast && node[isProperty]) {
        if (setPropertyWhenInvisible || node.mesh.visible) {
          callback(node);
        }
      } else {
        const children = Object.entries(node);
        children.forEach(([name, childNode]) => {
          this._setNodeProperty(
            [path, name].join("."),
            value,
            callback,
            options
          );
        });
      }

      this._updateValue({
        prefix,
        path,
        values,
        value,
        eventName,
        valuesArray,
        shouldFlushToDOM: false,
      });
    },
    // UTILS END

    update: function (oldData) {
      const diff = AFRAME.utils.diff(oldData, this.data);

      const diffKeys = Object.keys(diff);

      //console.log("diffKeys", diffKeys);

      diffKeys.forEach((diffKey) => {
        if (this.data[diffKey] == undefined) {
          return;
        }
        //console.log("update", { [diffKey]: this.data[diffKey] });
        if (diffKey.startsWith(this._variantPrefix)) {
          this.selectVariant(diffKey, this.data[diffKey]);
        } else if (diffKey.startsWith(this._pupilOffsetPrefix)) {
          this.setPupilOffset(diffKey, this.data[diffKey]);
        } else if (diffKey.startsWith(this._pupilScalePrefix)) {
          this.setPupilScale(diffKey, this.data[diffKey]);
        } else if (diffKey.startsWith(this._pupilRotationPrefix)) {
          this.setPupilRotation(diffKey, this.data[diffKey]);
        } else if (diffKey.startsWith(this._eyeClosePrefix)) {
          this.setEyeClose(diffKey, this.data[diffKey]);
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
            case "showModelBoundingBox":
              this.setShowModelBoundingBox(this.data.showModelBoundingBox);
              break;
            case "squash":
              this.setSquash(this.data.squash);
              break;
            case "squashRadiusThreshold":
              this.setSquashRadiusThreshold(this.data.squashRadiusThreshold);
              break;
            case "squashRadiusBuffer":
              this.setSquashRadiusBuffer(this.data.squashRadiusBuffer);
              break;
            case "squashCenter":
              this.setSquashCenter(this.data.squashCenter);
              break;
            case "squashMin":
              this.setSquashMin(this.data.squashMin);
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
            case "squashTiltMax":
              this.setSquashTiltMax(this.data.squashTiltMax);
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
            case "turn":
              this.setTurn(this.data.turn);
              break;
            case "pupilName":
              break;
            case "eyeName":
              break;
            case "eyeCloseName":
              break;
            case "showLookAt":
              this.setShowLookAt(this.data.showLookAt);
              break;
            case "showLookAtPupils":
              this.setShowLookAtPupils(this.data.showLookAtPupils);
              break;
            case "lookAtPosition":
              if (this._updateCalledOnce) {
                this.setLookAtPosition(this.data.lookAtPosition);
              }
              break;
            case "lookAtOffsetMin":
              this.setLookAtOffsetMin(this.data.lookAtOffsetMin);
              break;
            case "lookAtOffsetMax":
              this.setLookAtOffsetMax(this.data.lookAtOffsetMax);
              break;
            case "lookAtOffsetAngleMin":
              this.setLookAtOffsetAngleMin(this.data.lookAtOffsetAngleMin);
              break;
            case "lookAtOffsetAngleMax":
              this.setLookAtOffsetAngleMax(this.data.lookAtOffsetAngleMax);
              break;
            case "lookableAngleMin":
              this.setLookableAngleMin(this.data.lookableAngleMin);
              break;
            case "lookableAngleMax":
              this.setLookableAngleMax(this.data.lookableAngleMax);
              break;
            case "lookableWorldMeshAngleMin":
              this.setLookableWorldMeshAngleMin(
                this.data.lookableWorldMeshAngleMin
              );
              break;
            case "lookableWorldMeshAngleMax":
              this.setLookableWorldMeshAngleMax(
                this.data.lookableWorldMeshAngleMax
              );
              break;

            case "lookableDistanceMin":
              this.setLookableDistanceMin(this.data.lookableDistanceMin);
              break;
            case "lookableDistanceMax":
              this.setLookableDistanceMax(this.data.lookableDistanceMax);
              break;
            case "lookableSelector":
              if (this._updateCalledOnce) {
                this.setLookableSelector(this.data.lookableSelector);
              }
              break;
            case "lookAround":
              this.setLookAround(this.data.lookAround);
              break;
            case "lookableTickerMin":
              this.setLookableTickerMin(this.data.lookableTickerMin);
              break;
            case "lookableTickerMax":
              this.setLookableTickerMax(this.data.lookableTickerMax);
              break;
            case "lookableAsideTickerMin":
              this.setLookableAsideTickerMin(this.data.lookableAsideTickerMin);
              break;
            case "lookableAsideTickerMax":
              this.setLookableAsideTickerMax(this.data.lookableAsideTickerMax);
              break;
            case "lookableWorldMeshTickerMin":
              this.setLookableWorldMeshTickerMin(
                this.data.lookableWorldMeshTickerMin
              );
              break;
            case "lookableWorldMeshTickerMax":
              this.setLookableWorldMeshTickerMax(
                this.data.lookableWorldMeshTickerMax
              );
              break;
            case "lookAtLookableNoiseTickerMin":
              this.setLookAtLookableNoiseTickerMin(
                this.data.lookAtLookableNoiseTickerMin
              );
              break;
            case "lookAtLookableNoiseTickerMax":
              this.setLookAtLookableNoiseTickerMax(
                this.data.lookAtLookableNoiseTickerMax
              );
              break;
            case "lookAtLookableNoiseMin":
              this.setLookAtLookableNoiseMin(this.data.lookAtLookableNoiseMin);
              break;
            case "lookAtLookableNoiseMax":
              this.setLookAtLookableNoiseMax(this.data.lookAtLookableNoiseMax);
              break;
            case "isModelFacingBack":
              this.setIsModelFacingBack(this.data.isModelFacingBack);
              break;
            case "blinking":
              this.setBlinking(this.data.blinking);
              break;
            case "blinkOpenTickerMin":
              this.setBlinkOpenTickerMin(this.data.blinkOpenTickerMin);
              break;
            case "blinkOpenTickerMax":
              this.setBlinkOpenTickerMax(this.data.blinkOpenTickerMax);
              break;
            case "blinkCloseTickerMin":
              this.setBlinkCloseTickerMin(this.data.blinkCloseTickerMin);
              break;
            case "blinkCloseTickerMax":
              this.setBlinkCloseTickerMax(this.data.blinkCloseTickerMax);
              break;
            default:
              console.warn(`uncaught diffKey "${diffKey}"`);
              break;
          }
        }
      });
      this._updateCalledOnce = true;
    },

    // MODEL START
    _initModel: function () {
      this.models = {};
      this.modelsEntity = document.createElement("a-entity");
      this.modelsEntity.setAttribute(
        "rotation",
        `0 ${this.data.isModelFacingBack ? 180 : 0} 0`
      );
      this.modelsEntity.classList.add("models");
    },
    setIsModelFacingBack: function (isModelFacingBack) {
      //console.log("setIsModelFacingBack", isModelFacingBack);
      this.modelsEntity.setAttribute(
        "rotation",
        `0 ${isModelFacingBack ? 180 : 0} 0`
      );
      this._updateData("isModelFacingBack", isModelFacingBack);
    },
    _loadModel: function (name) {
      //console.log("loadModel", name);
      if (!this.system.models[name]) {
        console.warn(`no model found for name "${name}"`);
        return;
      }
      if (this.models[name]) {
        this.models[name].entity.remove();
        delete this.models[name];
      }

      const modelSrc = this.system.models[name];

      //console.log("creating new entity");
      const modelEntity = document.createElement("a-entity");
      modelEntity.classList.add(name);
      modelEntity.classList.add("model");
      modelEntity.setAttribute("gltf-model", modelSrc);
      modelEntity.setAttribute("visible", "false");

      const modelBoundingBoxEntity = document.createElement("a-box");
      modelBoundingBoxEntity.setAttribute(
        "visible",
        this.data.showModelBoundingBox
      );
      modelBoundingBoxEntity.setAttribute("color", "green");
      modelBoundingBoxEntity.setAttribute("opacity", "0.1");
      const modelBoundingBoxSize = new THREE.Vector3();
      const modelBoundingBoxCenter = new THREE.Vector3();
      const modelBoundingBox = new THREE.Box3();
      const onModelEntityLoaded = () => {
        //console.log("model-loaded", modelEntity);

        /** @type {Mesh} */
        const root = modelEntity.getObject3D("mesh");
        if (!root) {
          console.error("no mesh found in modelEntity");
          return;
        }

        modelBoundingBox.setFromObject(root);
        //console.log("modelBoundingBox", modelBoundingBox);
        // modelEntity.object3D.worldToLocal(modelBoundingBox.min);
        // modelEntity.object3D.worldToLocal(modelBoundingBox.max);
        modelBoundingBox.getSize(modelBoundingBoxSize);
        modelBoundingBox.getCenter(modelBoundingBoxCenter);
        modelEntity.object3D.worldToLocal(modelBoundingBoxCenter);
        //console.log(modelBoundingBoxSize, modelBoundingBoxCenter);
        modelBoundingBoxEntity.setAttribute(
          "scale",
          modelBoundingBoxSize.toArray().join(" ")
        );
        modelBoundingBoxEntity.setAttribute(
          "position",
          modelBoundingBoxCenter.toArray().join(" ")
        );
        this.modelsEntity.appendChild(modelBoundingBoxEntity);
        modelBoundingBoxEntity.classList.add("modelBoundingBox");
        //console.log("modelBoundingBoxEntity", modelBoundingBoxEntity);

        const meshTree = {};
        const allVariants = {}; // "path.to.mesh": ["each", "possible", "variant"]
        const textures = [];
        root.traverse((object3D) => {
          if (!object3D.isMesh) return;

          /** @type {Mesh} */
          const mesh = object3D;

          const meshPath = mesh.name.split("_");
          const uvCount = Object.keys(mesh.geometry.attributes).filter((name) =>
            name.startsWith("uv")
          ).length;
          const uvMap = {};
          const hasMultipleUv = uvCount > 1;

          const path = meshPath.join(".");
          allVariants[path] = [];
          if (hasMultipleUv) {
            allVariants[path] = new Array(uvCount).fill(0).map((_, index) => {
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

          const isPupil = path.startsWith(this.data.pupilName);
          const isEye = path.startsWith(this.data.eyeName);
          const isEyeClose = path
            .toLowerCase()
            .endsWith(this.data.eyeCloseName);

          const onMeshSegment = (meshTree, index = 0) => {
            const _path = meshPath.slice(0, index + 1).join(".");
            const segment = meshPath[index];
            const isLast = index == meshPath.length - 1;
            if (isLast) {
              /** @type {Texture} */
              let texture = mesh.material.map;
              const meshTreeNode = {
                mesh,
                uvCount,
                hasMultipleUv,
                uvMap,
                isLast,
                isPupil,
                texture,
                modelEntity,
                modelBoundingBoxEntity,
                path,
                isEye,
                isEyeClose,
              };
              meshTree[segment] = meshTreeNode;
              if (isPupil) {
                meshTreeNode.pupilPath = path.replace(
                  this.data.pupilName + ".",
                  ""
                );

                if (textures.includes(texture)) {
                  //console.log(`duplicate texture found in "${mesh.name}" mesh`);
                  mesh.material = mesh.material.clone();
                  mesh.material.map = mesh.material.map.clone();
                  texture = mesh.material.map;
                  meshTreeNode.texture = texture;
                }
                textures.push(texture);
                Object.assign(texture.center, { x: 0.5, y: 0.5 });
                texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
                const isUVMirrored = mesh.material.userData.isUVMirrored;
                //console.log({ isUVMirrored });
                meshTreeNode.isUVMirrored = isUVMirrored;
                texture.needsUpdate = true;

                const pupilEntity = document.createElement("a-entity");
                pupilEntity.setAttribute(
                  "position",
                  mesh.position.toArray().join(" ")
                );
                pupilEntity.classList.add("pupil");
                modelEntity.appendChild(pupilEntity);

                const pupilShowEntity = document.createElement("a-entity");
                pupilShowEntity.classList.add("pupilShow");
                pupilEntity.appendChild(pupilShowEntity);

                const pupilShowCone = document.createElement("a-cone");
                pupilShowCone.setAttribute("color", "yellow");
                pupilShowCone.setAttribute("height", "0.01");
                pupilShowCone.setAttribute("radius-top", "0");
                pupilShowCone.setAttribute("radius-bottom", "0.005");
                pupilShowCone.setAttribute("position", "0 0 0.005");
                pupilShowCone.setAttribute("rotation", "90 0 0");
                pupilShowCone.setAttribute("visible", "true");
                pupilShowEntity.appendChild(pupilShowCone);

                meshTreeNode.pupilEntity = pupilEntity;
                meshTreeNode.pupilShowEntity = pupilShowEntity;
                meshTreeNode.lookAtPosition = new THREE.Vector3();
                meshTreeNode.localLookAtPosition = new THREE.Vector3();
                meshTreeNode.normalizedLocalLookAtPosition =
                  new THREE.Vector3();
                meshTreeNode.lookAtDistance = 0;
              }

              if (isEye) {
                meshTreeNode.eyePath = path.replace(
                  this.data.eyeName + ".",
                  ""
                );
              }
            } else {
              if (!meshTree[segment]) {
                meshTree[segment] = {};
              }
            }

            meshTree = meshTree[segment];

            if (!isLast) {
              onMeshSegment(meshTree, index + 1);

              const hasMeshChildren =
                Object.values(meshTree).filter((node) => node.isLast).length >
                1;
              if (hasMeshChildren) {
                allVariants[_path] = Object.keys(meshTree).sort();
              }
            }

            if (index > 0) {
              const parentPath = meshPath.slice(0, index).join(".");
              //console.log({ path, _path, parentPath });
              allVariants[parentPath] = allVariants[_path].slice().sort();
            }
          };
          onMeshSegment(meshTree);
        });
        //console.log("meshTree", meshTree);

        Object.entries(allVariants).forEach(([key, oneOf]) => {
          if (oneOf.length < 2) {
            delete allVariants[key];
          }
        });
        //console.log("allVariants", allVariants);

        const allVariantsArray = this.sortObjectEntries(allVariants);

        const variants = {};
        Object.entries(allVariants).forEach(([key, oneOf]) => {
          variants[key] = oneOf.includes("default") ? "default" : oneOf[0];
        });
        //console.log("variants", variants);

        const variantsArray = this.sortObjectEntries(variants);
        //console.log("variantsArray", variantsArray);

        const eyes = meshTree[this.data.eyeName] ?? {};
        //console.log("eyes", eyes);

        const eyeNodes = [];
        this._traverseTree(eyes, (subTree, path, isHead) => {
          if (!isHead) {
            return;
          }
          if (subTree.isLast) {
            eyeNodes.push(subTree);
          }
          return true;
        });
        //console.log("eyeNodes", eyeNodes);

        const eyesClose = {};
        if (this._includeNullPathInEyeSchema) {
          eyesClose[""] = false;
        }
        this._traverseTree(eyes, (subTree, path, isHead) => {
          if (!isHead || subTree.isLast) {
            return;
          }
          eyesClose[path] = false;
          return true;
        });
        //console.log("eyesClose", eyesClose);

        const eyesCloseArray = this.sortObjectEntries(eyesClose);
        //console.log("eyesCloseArray", eyesCloseArray);

        const eyesOpen = {};
        if (this._includeNullPathInEyeSchema) {
          eyesOpen[""] = "default";
        }
        this._traverseTree(eyes, (subTree, path, isHead) => {
          if (!isHead || subTree.isLast) {
            return;
          }
          eyesOpen[path] = "default";
          return true;
        });
        //console.log("eyesOpen", eyesOpen);

        const pupils = meshTree[this.data.pupilName] ?? {};
        //console.log("pupils", pupils);

        const pupilNodes = [];
        this._traverseTree(pupils, (subTree, path, isHead) => {
          if (!isHead) {
            return;
          }
          if (subTree.isLast) {
            pupilNodes.push(subTree);
          }
          return true;
        });
        //console.log("pupilNodes", pupilNodes);

        const pupilCenterEntity = document.createElement("a-entity");
        const pupilCenterLookAtEntity = document.createElement("a-entity");
        pupilCenterEntity.appendChild(pupilCenterLookAtEntity);

        const pupilCenter = new THREE.Vector3();
        pupilNodes.forEach((pupilNode) => {
          const { mesh } = pupilNode;
          pupilCenter.add(mesh.position);
        });
        pupilCenter.divideScalar(pupilNodes.length);
        pupilCenterEntity.setAttribute(
          "position",
          pupilCenter.toArray().join(" ")
        );
        //console.log("pupilCenter", pupilCenter);
        pupilCenterEntity.classList.add("pupilCenter");
        modelEntity.appendChild(pupilCenterEntity);

        const pupilOffsets = {};
        if (this._includeNullPathInPupilSchema) {
          pupilOffsets[""] = { x: 0, y: 0 };
        }
        this._traverseTree(pupils, (subTree, path, isHead) => {
          if (!isHead) {
            return;
          }
          pupilOffsets[path] = { x: 0, y: 0 };
          return true;
        });
        //console.log("pupilOffsets", pupilOffsets);

        const pupilOffsetsArray = this.sortObjectEntries(pupilOffsets);
        //console.log("pupilOffsetsArray", pupilOffsetsArray);

        const pupilScales = {};
        if (this._includeNullPathInPupilSchema) {
          pupilScales[""] = { x: 1, y: 1 };
        }
        this._traverseTree(pupils, (subTree, path, isHead) => {
          if (!isHead) {
            return;
          }
          pupilScales[path] = { x: 1, y: 1 };
          return true;
        });
        //console.log("pupilScales", pupilScales);

        const pupilScalesArray = this.sortObjectEntries(pupilScales);
        //console.log("pupilScalesArray", pupilScalesArray);

        const pupilRotations = {};
        if (this._includeNullPathInPupilSchema) {
          pupilRotations[""] = 0;
        }
        this._traverseTree(pupils, (subTree, path, isHead) => {
          if (!isHead) {
            return;
          }
          pupilRotations[path] = 0;
          return true;
        });
        //console.log("pupilRotations", pupilRotations);

        const pupilRotationsArray = this.sortObjectEntries(pupilRotations);
        //console.log("pupilRotationsArray", pupilRotationsArray);

        const model = {
          src: modelSrc,
          entity: modelEntity,
          boundingBoxEntity: modelBoundingBoxEntity,
          size: modelBoundingBoxSize,
          center: modelBoundingBoxCenter,
          box: modelBoundingBox,
          meshTree,
          allVariants,
          allVariantsArray,
          variants,
          variantsArray,
          pupilCenterEntity,
          pupilCenterLookAtEntity,
          pupilCenter,
          pupils,
          pupilNodes,
          pupilOffsets,
          pupilOffsetsArray,
          pupilScales,
          pupilScalesArray,
          pupilRotations,
          pupilRotationsArray,
          eyes,
          eyeNodes,
          eyesCloseArray,
          eyesOpen,
        };
        // console.log("model", model);
        this.models[name] = model;
        this.el.emit("power-pet-model-loaded", {
          name,
          model,
        });
        this.selectModel(name);
      };
      modelEntity.addEventListener("model-loaded", () => {
        const v = modelEntity.object3D.worldToLocal(new THREE.Vector3());
        //console.log(v.toArray());
        onModelEntityLoaded();
      });
      this.modelsEntity.appendChild(modelEntity);
    },
    getIsModelSelected: function () {
      return this._getModel();
    },
    _autoUpdateSquashColliderCenter: false,
    selectModel: function (newName) {
      if (!this.system.models[newName]) {
        console.warn(`no model found with name "${newName}"`);
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
        const { entity, boundingBoxEntity } = this.models[previousName];
        entity.object3D.visible = false;
        boundingBoxEntity.object3D.visible = false;
      }

      const { entity, boundingBoxEntity, center, size } = this.models[newName];
      entity.object3D.visible = true;
      boundingBoxEntity.object3D.visible = this.data.showModelBoundingBox;

      if (this._autoUpdateSquashColliderCenter) {
        this.setSquashColliderCenter(center);
      }

      this.selectedName = newName;

      this._updateSchema();

      this._updateData("model", newName, true, {
        name: newName,
        model: this.models[newName],
      });
    },
    _isModelLoaded: function () {
      return Boolean(this._getModel());
    },
    _getModel: function () {
      return this.models[this.selectedName];
    },
    setShowModelBoundingBox: function (showModelBoundingBox) {
      //console.log("setShowModelBoundingBox", showModelBoundingBox);

      if (!this._isModelLoaded()) {
        return;
      }

      const { boundingBoxEntity } = this._getModel();
      boundingBoxEntity.object3D.visible = this.data.showModelBoundingBox;

      this._updateData("showModelBoundingBox", showModelBoundingBox);
    },
    // MODEL END

    // SCHEMA START
    _updateSchema: function () {
      const variantSchema = this._getVariantSchema();
      const pupilOffsetSchema = this._getPupilOffsetSchema();
      const pupilScaleSchema = this._getPupilScaleSchema();
      const pupilRotationSchema = this._getPupilRotationSchema();
      const eyesCloseSchema = this._getEyesCloseSchema();
      const extensionSchema = {
        ...variantSchema,
        ...pupilOffsetSchema,
        ...pupilScaleSchema,
        ...pupilRotationSchema,
        ...eyesCloseSchema,
      };
      //console.log("extensionSchema", extensionSchema);
      this.extendSchema(extensionSchema);
      this._selectVariants();
      this._setPupilOffsets();
      this._setPupilScales();
      this._setPupilRotations();
      this._setEyesClose();
      this._flushToDOM();
    },
    // SCHEMA END

    // VARIANT START
    _variantPrefix: "variant_",
    _getVariants: function () {
      return this._getModel()?.variants ?? {};
    },
    _getVariantsArray: function () {
      return this._getModel()?.variantsArray ?? [];
    },
    _getAllVariants: function () {
      return this._getModel()?.allVariants ?? {};
    },
    _getAllVariantsArray: function () {
      return this._getModel()?.allVariantsArray ?? [];
    },
    _selectVariants: function () {
      const variantsArray = structuredClone(this._getVariantsArray());
      variantsArray.forEach(([key, value]) => {
        this.selectVariant(key, value);
      });
    },
    _getVariantSchema: function () {
      // console.log("_getVariantSchema");

      const variantSchema = {};
      const allVariantsArray = this._getAllVariantsArray();

      Object.keys(this.data)
        .filter((key) => key.startsWith(this._variantPrefix))
        .forEach((key) => {
          this._deleteDataKey(key);
        });

      allVariantsArray.forEach(([key, oneOf]) => {
        variantSchema[this._variantPrefix + key] = { oneOf };
      });

      return variantSchema;
    },
    _invertPupilScale: true,
    selectVariant: function (path, value) {
      if (path.startsWith(this._variantPrefix)) {
        path = path.replace(this._variantPrefix, "");
      }
      if (value == undefined) {
        return;
      }
      //console.log("selectVariant", { path, value });
      if (!this.getIsModelSelected()) {
        console.warn("no model selected");
        return;
      }

      const { variants, meshTree } = this._getModel();

      if (!this._includeNullPathInPupilSchema && path == "") {
        return;
      }

      const node = this._walkTree(
        path,
        meshTree,
        (node, treeWalker, segment) => {
          if (node.isLast && !node.hasMultipleUv) {
            console.error(
              `invalid path "${path}" - no segment "${segment}" found and only 1 uvCount`,
              treeWalker,
              "in",
              meshTree
            );
            return false;
          }
          return true;
        }
      );
      if (!node) {
        return;
      }
      //console.log("node", node);

      const _value = value;
      const isEye = path.startsWith(this.data.eyeName);
      if (isEye) {
        value = this._setEyeClose(path, value);
      }

      if (node.isLast) {
        let channel = 0;
        if (isNaN(value)) {
          channel = node.uvMap[value];
        } else {
          channel = +value;
          Object.entries(node.uvMap).some(([key, _channel]) => {
            if (_channel == channel) {
              value = key;
              return true;
            }
          });
        }
        if (channel >= node.uvCount) {
          console.error(`invalid uv index ${channel}, max ${node.uvCount - 1}`);
          return;
        }
        //console.log(`setting uv index to ${channel}`);
        node.texture.channel = channel;
      } else {
        const children = Object.entries(node);
        children.forEach(([name, child]) => {
          if (child.isLast && isNaN(value)) {
            const visible = name == value;
            child.mesh.visible = visible;
            if (child.isPupil) {
              this._updateShowLookAtPupil(child);
            }
            if (visible && child.isPupil) {
              if (!this._setPupilPropertyWhenInvisible) {
                this._updateTextureMatrix(child);
                this._updateShowLookAt(child);
                this._updateLookAtPosition(child);
              }
            }
          } else {
            this.selectVariant([path, name].join("."), _value);
          }
        });
      }

      if (path in variants) {
        variants[path] = value;
      }
      const dataPath = this._variantPrefix + path;
      if (dataPath in this.schema) {
        this._updateData(dataPath, value, false);
        this.el.emit("power-pet-variant", {
          name: this.selectedName,
          path,
          value,
        });
      }
    },
    // VARIANT END

    // SQUASH START
    _initSquash: function () {
      this.squashPositionEntity = document.createElement("a-entity");
      this.squashPositionEntity.classList.add("squashPosition");
      this.el.appendChild(this.squashPositionEntity);

      this.squashTiltEntity = document.createElement("a-entity");
      this.squashTiltEntity.classList.add("squashTilt");
      this.squashPositionEntity.appendChild(this.squashTiltEntity);

      this.squashScaleEntity = document.createElement("a-entity");
      this.squashScaleEntity.classList.add("squashScale");
      this.squashScaleEntity.appendChild(this.modelsEntity);
      this.squashTiltEntity.appendChild(this.squashScaleEntity);

      this.squashCenterEntity = document.createElement("a-entity");
      this.squashCenterEntity.classList.add("squashCenter");
      this.squashPositionEntity.appendChild(this.squashCenterEntity);

      this.squashCenterSphere = document.createElement("a-sphere");
      this.squashCenterSphere.setAttribute("color", "blue");
      this.squashCenterSphere.setAttribute("radius", "0.005");
      this.squashCenterSphere.setAttribute(
        "material",
        "depthTest: false; depthWrite: false; transparent: true;"
      );
      this.squashCenterSphere.setAttribute(
        "visible",
        this.data.showSquashCenter
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
        "depthTest: false; depthWrite: false; transparent: true;"
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

      this._tickSquashInterval = 40;
      if (this._tickSquashInterval > 0) {
        this._tickSquash = AFRAME.utils.throttleTick(
          this._tickSquash,
          this._tickSquashInterval,
          this
        );
      }
    },
    setSquashMin: function (squashMin) {
      this._updateData("squashMin", squashMin);
      this.setSquash(this.data.squash);
    },
    setSquash: function (squash, dur = 0) {
      const { x, y } = this.data.squashMin;

      squash = THREE.MathUtils.clamp(squash, y, 1);
      //console.log("setSquash", squash);

      const height = squash;
      const heightLerp = THREE.MathUtils.inverseLerp(1, y, height);
      const width = THREE.MathUtils.lerp(1, x, heightLerp);
      //console.log({ width, height, dur });

      if (dur > 0) {
        this.squashScaleEntity.removeAttribute("animation__squash");
        this.squashScaleEntity.addEventListener(
          "animationcomplete__squash",
          () => {
            this._updateData("squash", squash);
          },
          { once: true }
        );
        this.squashScaleEntity.setAttribute("animation__squash", {
          property: "scale",
          to: { x: width, y: height, z: width },
          dur: dur - 0,
          easing: "linear",
        });
      } else {
        const { scale } = this.squashScaleEntity.object3D;
        scale.y = height;
        scale.x = scale.z = width;
        this._updateData("squash", squash);
      }
    },
    setSquashCenter: function (squashCenter) {
      value = Object.assign({}, this.data.squashCenter, squashCenter);
      //console.log("setSquashCenter", squashCenter);

      this.squashPositionEntity.object3D.position.copy(squashCenter);
      this.modelsEntity.object3D.position.copy(squashCenter).negate();

      this._updateData("squashCenter", squashCenter);
    },
    setShowSquashCenter: function (showSquashCenter) {
      //console.log("setShowSquashCenter", showSquashCenter);
      this.squashCenterSphere.object3D.visible = showSquashCenter;
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
    setSquashTiltMax: function (squashTiltMax) {
      this._updateData("squashTiltMax", squashTiltMax);
    },
    setTilt: function (tilt, dur = 0) {
      tilt = Object.assign({}, this.data.tilt, tilt);
      const { tiltMin, tiltMax } = this.data;

      tilt.x = THREE.MathUtils.clamp(tilt.x, tiltMin.x, tiltMax.x);
      tilt.y = THREE.MathUtils.clamp(tilt.y, tiltMin.y, tiltMax.y);
      //console.log("setTilt", tilt);

      const roll = this.clampFloatToZero(tilt.x);
      const pitch = this.clampFloatToZero(tilt.y);

      //console.log({ roll, pitch, dur });

      if (dur > 0) {
        const pitchDeg = this.clampFloatToZero(THREE.MathUtils.radToDeg(pitch));
        const rollDeg = this.clampFloatToZero(THREE.MathUtils.radToDeg(roll));

        this.squashTiltEntity.removeAttribute("animation__tilt");
        this.squashTiltEntity.addEventListener(
          "animationcomplete__tilt",
          () => {
            this._updateData("tilt", tilt);
          },
          { once: true }
        );

        const { rotation } = this.squashTiltEntity.object3D;
        rotation.x = this.clampFloatToZero(rotation.x);
        rotation.y = this.clampFloatToZero(rotation.y);
        rotation.z = this.clampFloatToZero(rotation.z);
        this.squashTiltEntity.setAttribute("animation__tilt", {
          property: "rotation",
          to: {
            x: pitchDeg,
            y: 0,
            z: rollDeg,
          },
          dur: dur - 0,
          easing: "linear",
        });
      } else {
        const { rotation } = this.squashTiltEntity.object3D;
        rotation.x = pitch;
        rotation.z = roll;
        this._updateData("tilt", tilt);
      }
    },

    setShowSquashCollider: function (showSquashCollider) {
      //console.log("setShowSquashCollider", showSquashCollider);
      this.squashColliderEntity.object3D.visible = showSquashCollider;
      this._updateData("showSquashCollider", showSquashCollider);
    },
    setSquashRadiusBuffer: function (squashRadiusBuffer) {
      //console.log("setSquashRadiusBuffer", squashColliderBuffer);
      this._updateData("squashRadiusBuffer", squashRadiusBuffer);
    },
    setSquashRadiusThreshold: function (squashRadiusThreshold) {
      //console.log("setSquashRadiusThreshold", squashRadiusThreshold);
      this._updateData("squashRadiusThreshold", squashRadiusThreshold);
    },

    setSquashColliderCenter: function (squashColliderCenter) {
      squashColliderCenter = Object.assign(
        {},
        this.data.squashColliderCenter,
        squashColliderCenter
      );
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
      //console.log(`started collision with "${withEl.id}"`);
      if (!this._squashCollidedEntities.includes(withEl)) {
        this._squashCollidedEntities.push(withEl);
      }
    },
    onObbCollisionEnded: function (event) {
      const { withEl } = event.detail;
      //console.log(`ended collision with "${withEl.id}"`);
      if (this._squashCollidedEntities.includes(withEl)) {
        this._squashCollidedEntities.splice(
          this._squashCollidedEntities.indexOf(withEl),
          1
        );
      }
    },
    _tickSquash: function (time, timeDelta) {
      if (!this._isModelLoaded()) {
        return;
      }

      const { size, center } = this._getModel();

      let newHasSquashControlPoint = false;
      let controlPointColliderIndex;
      let isNudging = false;
      if (this._squashCollidedEntities.length > 0) {
        this.squashCenterEntity.object3D.getWorldPosition(
          this._squashCenterWorldPosition
        );
        // console.log(this._squashCenterWorldPosition);
        let closestDistance = Infinity;
        this._squashCollidedEntities.forEach((entity, index) => {
          if (entity.components["hand-tracking-grab-controls"]) {
            return;
          }

          const { obb } = entity.components["obb-collider"];
          obb.clampPoint(
            this._squashCenterWorldPosition,
            this._squashColliderTempPosition
          );
          this._squashColliderTempPosition.addVectors(
            obb.center,
            this._squashColliderTempPosition
              .subVectors(this._squashColliderTempPosition, obb.center)
              .setLength(obb.halfSize.x)
          );

          this.worldToLocal(
            this.squashCenterEntity.object3D,
            this._squashColliderTempPosition
          );
          // console.log(this._squashColliderTempPosition);

          if (this._squashColliderTempPosition.y < 0) {
            return;
          }

          const distance = this._squashColliderTempPosition.length();
          // console.log({ distance, index });
          if (distance < closestDistance) {
            this._squashColliderClosestPosition.copy(
              this._squashColliderTempPosition
            );
            closestDistance = distance;
            newHasSquashControlPoint = true;
            controlPointColliderIndex = index;
          }
        });
        // console.log({ closestDistance });
      }

      let squash = 1;
      let tilt = { x: 0, y: 0 };

      // console.log({ newHasSquashControlPoint });
      if (newHasSquashControlPoint) {
        this._squashControlPoint.copy(this._squashColliderClosestPosition);
        //console.log(this._squashControlPoint);

        this.squashControlPointEntity.object3D.position.copy(
          this._squashControlPoint
        );

        this._squashControlPoint2d.copy({
          x: this._squashControlPoint.x,
          y: -this._squashControlPoint.z,
        });
        const radius = this._squashControlPoint2d.length();
        const angle2D = this._squashControlPoint2d.angle();

        const length = this._squashControlPoint.length();
        const fullLength = size.y / 2 - this.data.squashCenter.y + center.y;
        const lengthInterpolation = length / fullLength;
        squash = lengthInterpolation;

        const squashTilt = {
          x: Math.atan2(
            -this._squashControlPoint.x,
            this._squashControlPoint.y
          ),
          y: Math.atan2(this._squashControlPoint.z, this._squashControlPoint.y),
        };
        const overshotTilt =
          squashTilt.x > this.data.tiltMax.x ||
          squashTilt.y > this.data.tiltMax.y;

        if (squash <= 1.03) {
          isNudging = radius > this.data.squashRadiusThreshold;
          isNudging = isNudging || squash <= 0.57;
          //console.log({ squash, radius, angle2D, useSquash: isNudging });

          if (isNudging) {
            squash = 1;

            const tiltDirection = angle2D;
            let radiusInterpolation = THREE.MathUtils.inverseLerp(
              this.data.squashColliderSize / 2 - this.data.squashRadiusBuffer,
              0.055,
              radius
            );
            radiusInterpolation = Math.max(0, radiusInterpolation);
            let nudgeInterpolation = lengthInterpolation;
            nudgeInterpolation *= 1;
            // console.log({ radiusInterpolation, lengthInterpolation });
            const nudgeTilt = {
              x:
                nudgeInterpolation *
                this.data.squashTiltMax.x *
                radiusInterpolation *
                Math.cos(tiltDirection),
              y:
                nudgeInterpolation *
                this.data.squashTiltMax.y *
                radiusInterpolation *
                Math.sin(tiltDirection),
            };
            // console.log(nudgeTilt);
            tilt = nudgeTilt;
          } else {
            tilt = squashTilt;
          }
        }
        squash = THREE.MathUtils.clamp(squash, 0, 1);
      }

      const wasNudging = this._isNudging;
      this._isNudging = isNudging;

      if (
        newHasSquashControlPoint ||
        this._hasSquashControlPoint != newHasSquashControlPoint
      ) {
        const interval = newHasSquashControlPoint
          ? this._tickSquashInterval
          : 100;
        this.setSquash(squash, interval);
        this.setTilt(tilt, interval);
      }
      this._hasSquashControlPoint = newHasSquashControlPoint;

      this.squashControlPointEntity.object3D.visible =
        this.data.showSquashControlPoint && this._hasSquashControlPoint;

      const isBeingPet = squash != 1 || tilt.x != 0 || tilt.y != 0;
      this._setIsBeingPet(isBeingPet);
    },

    _tickSquashAnimation: function (time, timeDelta) {
      if (this.getIsInspectorOpen()) {
        this.squashScaleEntity.components["animation__squash"]?.tick(
          time,
          timeDelta
        );
        this.squashTiltEntity.components["animation__tilt"]?.tick(
          time,
          timeDelta
        );
      }
    },
    // SQUASH END

    // PETTING START
    _initPetting: function () {
      this._isBeingPet = false;
    },
    _setIsBeingPet: function (newIsBeingPet) {
      if (this._isBeingPet == newIsBeingPet) {
        return;
      }
      this._isBeingPet = newIsBeingPet;
      //console.log("isBeingPet", newIsBeingPet);
      this.el.emit("power-pet-isBeingPet", { isBeingPet: this._isBeingPet });
    },
    // PETTING END

    // TURN START
    setTurn: function (turn, dur = 0) {
      turn = THREE.MathUtils.clamp(turn, -180, 180);
      // console.log("setTurn", turn);

      const yaw = turn;

      if (dur > 0) {
        this.squashScaleEntity.removeAttribute("animation__turn");
        this.squashScaleEntity.addEventListener(
          "animationcomplete__turn",
          () => {
            this._updateData("turn", turn);
          },
          { once: true }
        );
        this.squashScaleEntity.setAttribute("animation__turn", {
          property: "rotation",
          to: { x: 0, y: yaw, z: 0 },
          dur: dur - 0,
          easing: "linear",
        });
      } else {
        const yawRadians = THREE.MathUtils.degToRad(yaw);
        const { rotation } = this.squashScaleEntity.object3D;
        rotation.y = yawRadians;
        this._updateData("turn", turn);
      }
    },
    // TURN END

    // PUPILS START
    _ignorePupilsWithNoSiblingsInSchema: true,
    _onlyShowFirstLevelPupilsInSchema: true,
    _includeNullPathInPupilSchema: true,
    _verifyPupilSchema: function (path) {
      if (
        this._onlyShowFirstLevelPupilsInSchema ||
        this._ignorePupilsWithNoSiblingsInSchema
      ) {
        const segments = path.split(".");
        if (segments.length > 1) {
          if (this._onlyShowFirstLevelPupilsInSchema) {
            return;
          }
          const parentPath = segments.slice(0, -1).join(".");
          const siblingCount =
            pupilOffsetsArray.filter(([path, _]) => path.startsWith(parentPath))
              .length - 1;
          if (siblingCount == 1) {
            return;
          }
        }
      }
      return true;
    },
    _getPupils: function () {
      return this._getModel()?.pupils ?? {};
    },
    _getPupilNodes: function () {
      return this._getModel()?.pupilNodes ?? [];
    },
    _setPupilPropertyWhenInvisible: true,
    _setPupilProperty: function (path, value, callback, options) {
      Object.assign(options, {
        isProperty: "isPupil",
        name: this.data.pupilName,
        nodes: this._getPupils(),
        setPropertyWhenInvisible: this._setPupilPropertyWhenInvisible,
      });
      this._setNodeProperty(path, value, callback, options);
    },
    _updateTextureMatrixDirectly: true,
    _updateTextureMatrix: function (node, values = {}) {
      const pupilScales = this._getPupilScales();
      const pupilRotations = this._getPupilRotations();
      const pupilOffsets = this._getPupilOffsets();

      const { pupilPath, texture, isUVMirrored } = node;

      const scale = values.scale ?? pupilScales[pupilPath];
      const offset = values.offset ?? pupilOffsets[pupilPath];

      let rotation = values.rotation ?? pupilRotations[pupilPath];
      rotation = this._useDegreesForPupilRotation
        ? THREE.MathUtils.degToRad(rotation)
        : rotation;
      if (isUVMirrored) {
        rotation *= -1;
      }

      texture.matrixAutoUpdate = false;
      texture.matrix
        .identity()
        .translate(offset.x * (isUVMirrored ? -1 : 1), offset.y)
        .translate(-0.5, -0.5)
        .rotate(rotation)
        .scale(1 / scale.x, 1 / scale.y)
        .translate(0.5, 0.5);
    },
    _initPupils: function () {},
    _tickPupils: function (time, timeDelta) {},
    // PUPILS END

    // PUPIL OFFSETS START
    _pupilOffsetPrefix: "pupilOffset_",
    _getPupilOffsets: function () {
      return this._getModel()?.pupilOffsets ?? {};
    },
    _getPupilOffsetsArray: function () {
      return this._getModel()?.pupilOffsetsArray ?? [];
    },
    _setPupilOffsets: function () {
      const pupilOffsetsArray = structuredClone(this._getPupilOffsetsArray());
      pupilOffsetsArray.forEach(([key, offset]) => {
        this.setPupilOffset(key, offset);
      });
    },
    _getPupilOffsetSchema: function () {
      // console.log("_getPupilOffsetSchema");

      const pupilOffsetSchema = {};
      const pupilOffsetsArray = this._getPupilOffsetsArray();

      Object.keys(this.data)
        .filter((key) => key.startsWith(this._pupilOffsetPrefix))
        .forEach((key) => {
          this._deleteDataKey(key);
        });

      pupilOffsetsArray.forEach(([path]) => {
        if (!this._verifyPupilSchema(path)) {
          return;
        }

        pupilOffsetSchema[this._pupilOffsetPrefix + path] = {
          type: "vec2",
          default: { x: 0, y: 0 },
        };
      });

      return pupilOffsetSchema;
    },
    _setPupilOffset: function (node, offset) {
      const { texture, isUVMirrored } = node;

      if (this._invertPupilScale) {
        texture.offset.set(
          offset.x * texture.repeat.x,
          offset.y * texture.repeat.y
        );
      } else {
        texture.offset.copy(offset);
      }

      if (isUVMirrored) {
        texture.offset.x *= -1;
      }
    },
    setPupilOffset: function (path, offset) {
      this._setPupilProperty(
        path,
        offset,
        (node) => {
          if (this._updateTextureMatrixDirectly) {
            this._updateTextureMatrix(node, { offset });
          } else {
            this._setPupilOffset(node, offset);
          }
        },
        {
          prefix: this._pupilOffsetPrefix,
          eventName: "pupilOffset",
          values: this._getPupilOffsets(),
          valuesArray: this._getPupilOffsetsArray(),
          defaultValue: { x: 0, y: 0 },
          clamp: ({ x, y }) => ({
            x: THREE.MathUtils.clamp(x, -1, 1),
            y: THREE.MathUtils.clamp(y, -1, 1),
          }),
        }
      );
    },
    // PUPIL OFFSETS END

    // PUPIL SCALES START
    _pupilScalePrefix: "pupilScale_",
    _getPupilScales: function () {
      return this._getModel()?.pupilScales ?? {};
    },
    _getPupilScalesArray: function () {
      return this._getModel()?.pupilScalesArray ?? [];
    },
    _setPupilScales: function () {
      const pupilScalesArray = structuredClone(this._getPupilScalesArray());
      pupilScalesArray.forEach(([key, scale]) => {
        this.setPupilScale(key, scale);
      });
    },
    _getPupilScaleSchema: function () {
      // console.log("_getPupilScaleSchema");

      const pupilScaleSchema = {};
      const pupilScalesArray = this._getPupilScalesArray();

      Object.keys(this.data)
        .filter((key) => key.startsWith(this._pupilScalePrefix))
        .forEach((key) => {
          this._deleteDataKey(key);
        });

      pupilScalesArray.forEach(([path]) => {
        if (!this._verifyPupilSchema(path)) {
          return;
        }

        pupilScaleSchema[this._pupilScalePrefix + path] = {
          type: "vec2",
          default: { x: 1, y: 1 },
        };
      });

      return pupilScaleSchema;
    },
    _setPupilScale: function (node, scale) {
      const { texture, pupilPath } = node;
      const pupilOffsets = this._getPupilOffsets();
      const offset = pupilOffsets[pupilPath];
      if (this._invertPupilScale) {
        texture.repeat.set(1 / scale.x, 1 / scale.y);
        this._setPupilOffset(node, offset);
      } else {
        texture.repeat.copy(value);
      }
    },
    setPupilScale: function (path, scale) {
      this._setPupilProperty(
        path,
        scale,
        (node) => {
          if (this._updateTextureMatrixDirectly) {
            this._updateTextureMatrix(node, { scale });
          } else {
            this._setPupilScale(node, scale);
          }
        },
        {
          prefix: this._pupilScalePrefix,
          eventName: "pupilScale",
          values: this._getPupilScales(),
          valuesArray: this._getPupilScalesArray(),
          defaultValue: { x: 1, y: 1 },
        }
      );
    },
    // PUPIL SCALES END

    // PUPIL ROTATIONS START
    _pupilRotationPrefix: "pupilRotation_",
    _useDegreesForPupilRotation: true,
    _getPupilRotations: function () {
      return this._getModel()?.pupilRotations ?? {};
    },
    _getPupilRotationsArray: function () {
      return this._getModel()?.pupilRotationsArray ?? [];
    },
    _setPupilRotations: function () {
      const pupilRotationsArray = structuredClone(
        this._getPupilRotationsArray()
      );
      pupilRotationsArray.forEach(([key, rotation]) => {
        this.setPupilRotation(key, rotation);
      });
    },
    _getPupilRotationSchema: function () {
      // console.log("_getPupilRotationSchema");

      const pupilRotationSchema = {};
      const pupilRotationsArray = this._getPupilRotationsArray();

      Object.keys(this.data)
        .filter((key) => key.startsWith(this._pupilRotationPrefix))
        .forEach((key) => {
          this._deleteDataKey(key);
        });

      pupilRotationsArray.forEach(([path]) => {
        if (!this._verifyPupilSchema(path)) {
          return;
        }

        pupilRotationSchema[this._pupilRotationPrefix + path] = {
          type: "number",
          default: 0,
        };
      });

      return pupilRotationSchema;
    },
    _setPupilRotation: function (node, rotation) {
      const { texture, isUVMirrored } = node;
      // console.log("setting pupilRotation", node.mesh.name, rotation);
      texture.rotation = this._useDegreesForPupilRotation
        ? THREE.MathUtils.degToRad(rotation)
        : rotation;
      if (isUVMirrored) {
        texture.rotation *= -1;
      }
    },
    setPupilRotation: function (path, rotation) {
      this._setPupilProperty(
        path,
        rotation,
        (node) => {
          if (this._updateTextureMatrixDirectly) {
            this._updateTextureMatrix(node, { rotation });
          } else {
            this._setPupilRotation(node, rotation);
          }
        },
        {
          prefix: this._pupilRotationPrefix,
          eventName: "pupilRotation",
          values: this._getPupilRotations(),
          valuesArray: this._getPupilRotationsArray(),
          defaultValue: 0,
        }
      );
    },
    // PUPIL ROTATIONS END

    // LOOKAT START
    _initLookAt: function () {
      const lookAtEntity = document.createElement("a-entity");
      lookAtEntity.classList.add("lookAtEntity");
      lookAtEntity.powerPet = this;
      lookAtEntity.setAttribute("visible", this.data.showLookAt);
      const { x, y, z } = this.data.lookAtPosition;
      lookAtEntity.setAttribute("position", [x, y, z].join(" "));
      this.el.sceneEl.appendChild(lookAtEntity);
      this._lookAtEntity = lookAtEntity;
      this._lookAtEntityPosition = new THREE.Vector3();

      const sphereEntity = document.createElement("a-sphere");
      sphereEntity.setAttribute("color", "blue");
      sphereEntity.setAttribute("radius", "0.01");
      lookAtEntity.appendChild(sphereEntity);
    },
    _removeLookAt: function () {
      //console.log("_removeLookAt");
      this._lookAtEntity.remove();
    },

    _setLookAtPositionWhenInvisible: false,

    setShowLookAt: function (showLookAt) {
      //console.log("setShowLookAt", showLookAt);
      this._lookAtEntity.object3D.visible = showLookAt;
      this._updateData("showLookAt", showLookAt);
    },
    _updateShowLookAtPupil: function (node, showLookAtPupil) {
      showLookAtPupil = showLookAtPupil ?? this.data.showLookAtPupils;
      showLookAtPupil = showLookAtPupil && node.mesh.visible;
      // console.log("_updateShowLookAtPupil", node.mesh.name, {
      //   showLookAtPupil,
      // });
      const { pupilShowEntity } = node;
      pupilShowEntity.object3D.visible = showLookAtPupil;
    },
    setShowLookAtPupils: function (showLookAtPupils) {
      //console.log("setShowLookAtPupils", showLookAtPupils);
      const pupilNodes = this._getPupilNodes();
      pupilNodes.forEach((node) => {
        this._updateShowLookAtPupil(node, showLookAtPupils);
      });
      this._updateData("showLookAtPupils", showLookAtPupils);
    },

    _updateLookAtPosition: function (pupilNode, lookAtPosition) {
      lookAtPosition = lookAtPosition ?? this.data.lookAtPosition;
      //console.log("_updateLookAtPosition", node.path, lookAtPosition);
      const {
        pupilEntity,
        pupilShowEntity,
        lookAtPosition: _lookAtPosition,
        localLookAtPosition,
        normalizedLocalLookAtPosition,
        path,
      } = pupilNode;

      _lookAtPosition.copy(lookAtPosition);
      localLookAtPosition.copy(lookAtPosition);
      this.worldToLocal(pupilEntity.object3D, localLookAtPosition);
      // console.log("localLookAtPosition", localLookAtPosition);

      pupilNode.lookAtDistance = localLookAtPosition.length();

      normalizedLocalLookAtPosition.copy(localLookAtPosition).normalize();

      const { yaw, pitch } = this._getVectorAngles(
        normalizedLocalLookAtPosition
      );
      const { rotation } = pupilShowEntity.object3D;
      rotation.x = -pitch;
      rotation.y = yaw;
      //console.log({ pitch, yaw });

      let offsetX = THREE.MathUtils.inverseLerp(
        this.data.lookAtOffsetAngleMin.x,
        this.data.lookAtOffsetAngleMax.x,
        -yaw
      );
      offsetX = THREE.MathUtils.clamp(offsetX, 0, 1);
      //offsetX = 0.5 + (offsetX - 0.5) ** 2 * Math.sign(offsetX - 0.5);
      offsetX = THREE.MathUtils.lerp(
        this.data.lookAtOffsetMin.x,
        this.data.lookAtOffsetMax.x,
        offsetX
      );

      let offsetY = THREE.MathUtils.inverseLerp(
        this.data.lookAtOffsetAngleMin.y,
        this.data.lookAtOffsetAngleMax.y,
        pitch
      );
      offsetY = THREE.MathUtils.clamp(offsetY, 0, 1);
      //offsetY = 0.5 + (offsetY - 0.5) ** 2 * Math.sign(offsetY - 0.5);
      offsetY = THREE.MathUtils.lerp(
        this.data.lookAtOffsetMin.y,
        this.data.lookAtOffsetMax.y,
        offsetY
      );
      const offset = {
        x: offsetX,
        y: offsetY,
      };
      //console.log("offset", offset);

      let pupilPath = path;
      if (this._onlyShowFirstLevelPupilsInSchema) {
        pupilPath = pupilPath.split(".").slice(0, -1).join(".");
      }
      this.setPupilOffset(pupilPath, offset);

      // TODO - scale pupils if close
    },

    setLookAtPosition: function (lookAtPosition, dur = 0) {
      lookAtPosition = Object.assign(
        {},
        this.data.lookAtPosition,
        lookAtPosition
      );

      //console.log("setLookAtPosition", lookAtPosition, { dur });
      if (this.data.showLookAt) {
        this._lookAtEntity.object3D.position.copy(lookAtPosition);
        this._lookAtEntityPosition.copy(lookAtPosition);
      }

      const pupilNodes = this._getPupilNodes();
      pupilNodes.forEach((pupilNode) => {
        if (!this._setLookAtPositionWhenInvisible && !pupilNode.mesh.visible) {
          return;
        }
        this._updateLookAtPosition(pupilNode, lookAtPosition);
      });
      this._updateData("lookAtPosition", lookAtPosition);
    },

    getIsLookAtSelectedInInspector: function () {
      return this.el && this.getSelectedInspectorEntity() == this._lookAtEntity;
    },
    _tickLookAt: function (time, timeDelta) {
      if (!this.data.showLookAt) {
        return;
      }
      if (!this.getIsLookAtSelectedInInspector()) {
        return;
      }

      if (
        this._lookAtEntityPosition.equals(this._lookAtEntity.object3D.position)
      ) {
        return;
      }
      this.setLookAtPosition(this._lookAtEntity.object3D.position);
    },

    setLookAtOffsetMin: function (lookAtOffsetMin) {
      lookAtOffsetMin = Object.assign(
        {},
        this.data.lookAtOffsetMax,
        lookAtOffsetMin
      );
      //console.log("setLookAtOffsetMin", lookAtOffsetMin);
      if (this.data.lookAround) {
        this.setLookAtPosition();
      }
      this._updateData("lookAtOffsetMin", lookAtOffsetMin);
    },
    setLookAtOffsetMax: function (lookAtOffsetMax) {
      lookAtOffsetMax = Object.assign(
        {},
        this.data.lookAtOffsetMax,
        lookAtOffsetMax
      );
      //console.log("setLookAtOffsetMax", lookAtOffsetMax);
      if (this.data.lookAround) {
        this.setLookAtPosition();
      }
      this._updateData("lookAtOffsetMax", lookAtOffsetMax);
    },
    setLookAtOffsetAngleMin: function (lookAtOffsetAngleMin) {
      lookAtOffsetAngleMin = Object.assign(
        {},
        this.data.lookAtOffsetAngleMax,
        lookAtOffsetAngleMin
      );
      //console.log("setLookAtOffsetAngleMin", lookAtOffsetAngleMin);
      if (this.data.lookAround) {
        this.setLookAtPosition();
      }
      this._updateData("lookAtOffsetAngleMin", lookAtOffsetAngleMin);
    },
    setLookAtOffsetAngleMax: function (lookAtOffsetAngleMax) {
      lookAtOffsetAngleMax = Object.assign(
        {},
        this.data.lookAtOffsetAngleMax,
        lookAtOffsetAngleMax
      );
      //console.log("setLookAtOffsetAngleMax", lookAtOffsetAngleMax);
      if (this.data.lookAround) {
        this.setLookAtPosition();
      }
      this._updateData("lookAtOffsetAngleMax", lookAtOffsetAngleMax);
    },
    // LOOKAT END

    // LOOKABLES START
    setLookAround: function (lookAround) {
      //console.log("setLookAround", lookAround);
      this._updateData("lookAround", lookAround);
    },
    setLookableDistanceMin: function (lookableDistanceMin) {
      //console.log("setLookableDistanceMin", lookableDistanceMin);
      this._updateData("lookableDistanceMin", lookableDistanceMin);
    },
    setLookableDistanceMax: function (lookableDistanceMax) {
      //console.log("setLookableDistanceMax", lookableDistanceMax);
      this._updateData("lookableDistanceMax", lookableDistanceMax);
    },

    setLookableTickerMin: function (lookableTickerMin) {
      //console.log("setLookableTickerMin", lookableTickerMin);
      this._updateData("lookableTickerMin", lookableTickerMin);
    },
    setLookableTickerMax: function (lookableTickerMax) {
      //console.log("setLookableTickerMax", lookableTickerMax);
      this._updateData("lookableTickerMax", lookableTickerMax);
    },

    setLookableAsideTickerMin: function (lookableAsideTickerMin) {
      //console.log("setLookableAsideTickerMin", lookableAsideTickerMin);
      this._updateData("lookableAsideTickerMin", lookableAsideTickerMin);
    },
    setLookableAsideTickerMax: function (lookableAsideTickerMax) {
      //console.log("setLookableAsideTickerMax", lookableAsideTickerMax);
      this._updateData("lookableAsideTickerMax", lookableAsideTickerMax);
    },

    setLookableWorldMeshTickerMin: function (lookableWorldMeshTickerMin) {
      //console.log("setLookableWorldMeshTickerMin", lookableWorldMeshTickerMin);
      this._updateData(
        "lookableWorldMeshTickerMin",
        lookableWorldMeshTickerMin
      );
    },
    setLookableWorldMeshTickerMax: function (lookableWorldMeshTickerMax) {
      //console.log("setLookableWorldMeshTickerMax", lookableWorldMeshTickerMax);
      this._updateData(
        "lookableWorldMeshTickerMax",
        lookableWorldMeshTickerMax
      );
    },

    setLookAtLookableNoiseTickerMin: function (lookAtLookableNoiseTickerMin) {
      //console.log("setLookAtLookableNoiseTickerMin", lookAtLookableNoiseTickerMin);
      this._updateData(
        "lookAtLookableNoiseTickerMin",
        lookAtLookableNoiseTickerMin
      );
    },
    setLookAtLookableNoiseTickerMax: function (lookAtLookableNoiseTickerMax) {
      //console.log("setLookAtLookableNoiseTickerMax", lookAtLookableNoiseTickerMax);
      this._updateData(
        "lookAtLookableNoiseTickerMax",
        lookAtLookableNoiseTickerMax
      );
    },

    setLookAtLookableNoiseMin: function (lookAtLookableNoiseMin) {
      //console.log("setLookAtLookableNoiseMin", lookAtLookableNoiseMin);
      this._updateData("lookAtLookableNoiseMin", lookAtLookableNoiseMin);
    },
    setLookAtLookableNoiseMax: function (lookAtLookableNoiseMax) {
      //console.log("setLookAtLookableNoiseMax", lookAtLookableNoiseMax);
      this._updateData("lookAtLookableNoiseMax", lookAtLookableNoiseMax);
    },

    _tickLookAtLookableInterval: 100,
    _initLookables: function () {
      this._tickLookAtLookable = AFRAME.utils.throttleTick(
        this._tickLookAtLookable,
        this._tickLookAtLookableInterval,
        this
      );

      this._lookAtLookableAxisAngle = new THREE.Vector3(0, 0, 1);
      this._lookAtLookablePosition = new THREE.Vector3();
      this._lookAtLookableQuaternion = new THREE.Quaternion();
      this._lookAtLookableNoise = new THREE.Vector3();

      this._tickUpdateLookables = AFRAME.utils.throttleTick(
        this._tickUpdateLookables,
        this._tickUpdateLookablesInterval,
        this
      );
      this._updateLookablesTicker = new Ticker();
      this._updateWorldMeshLookableTicker = new Ticker();
      this._lookAtLookableNoiseTicker = new Ticker();

      this._worldMeshLookable = {
        entity: null,
        position: new THREE.Vector3(),
        localPosition: new THREE.Vector3(),
        distance: Infinity,
        distanceInterpolation: 0,
        normalizedLocalPosition: new THREE.Vector3(),
        yaw: 0,
        pitch: 0,
        yawInterpolation: 0,
        pitchInterpolation: 0,
        score: -Infinity,
      };
      this._worldMeshEntities = [];
      this._worldMeshRaycaster = new THREE.Raycaster();
      this._worldMeshRaycasterDirection = new THREE.Vector3();
      this._worldMeshRaycasterOrigin = new THREE.Vector3();
      this._worldMeshRaycasterQuaternion = new THREE.Quaternion();
      this._worldMeshRaycasterEuler = new THREE.Euler(0, 0, 0, "YXZ");

      this._lookables = new Map();
      this._lookableObserver = new MutationObserver((mutations) => {
        //console.log("mutations", mutations);
        for (const mutation of mutations) {
          const { type, attributeName, target, addedNodes, removedNodes } =
            mutation;
          switch (type) {
            case "childList":
              addedNodes.forEach((lookable) => {
                if (lookable.hasAttribute(this.data.lookableSelector)) {
                  this._addLookable(lookable);
                }

                if ("worldMesh" in lookable.dataset) {
                  this._addWorldMeshEntity(lookable);
                }
              });
              removedNodes.forEach((lookable) => {
                this._removeLookable(lookable);
                this._removeWorldMeshEntity(lookable);
              });
              break;
            case "attributes":
              {
                const lookable = target;
                if (attributeName === this.data.lookableSelector) {
                  if (lookable.hasAttribute(this.data.lookableSelector)) {
                    this._addLookable(lookable);
                  } else {
                    this._removeLookable(lookable);
                  }

                  if ("worldMesh" in lookable.dataset) {
                    this._addWorldMeshEntity(lookable);
                  } else {
                    this._removeWorldMeshEntity(lookable);
                  }
                }
              }
              break;
          }
        }
      });
      this._observeLookables();
    },
    _tickLookables: function (time, timeDelta) {
      this._tickUpdateLookables(...arguments);
      this._tickLookAtLookable(...arguments);
    },
    _removeLookables: function () {
      this._stopObservingLookables();
    },

    _observeLookables: function (lookableSelector) {
      this._stopObservingLookables();
      lookableSelector = lookableSelector ?? this.data.lookableSelector;
      //console.log("_observeLookables", { lookableSelector });
      this._lookableObserver.observe(this.el.sceneEl, {
        subtree: true,
        attributes: true,
        childList: true,
        attributeFilter: [lookableSelector, "data-world-mesh"],
      });
      this._updateLookableList(lookableSelector);
      this._updateWorldMeshLookableList();
    },
    _stopObservingLookables: function () {
      //console.log("_stopObservingLookables");
      this._lookables.forEach((lookable) => this._removeLookable(lookable));
      this._worldMeshEntities.forEach((worldMeshEntity) =>
        this._removeWorldMeshEntity(worldMeshEntity)
      );
      this._lookableObserver.disconnect();
    },

    _addLookable: function (lookableEntity) {
      //console.log("_addLookable", lookableEntity);
      if (this._lookables.has(lookableEntity)) {
        //console.log("already added lookable", lookableEntity);
        return;
      }
      this._lookables.set(lookableEntity, {
        entity: lookableEntity,
        position: new THREE.Vector3(),
        localPosition: new THREE.Vector3(),
        distance: Infinity,
        distanceInterpolation: 0,
        normalizedLocalPosition: new THREE.Vector3(),
        yaw: 0,
        pitch: 0,
        yawInterpolation: 0,
        pitchInterpolation: 0,
        score: -Infinity,
      });
      //console.log("added lookable", lookableEntity);
    },
    _removeLookable: function (lookableEntity) {
      //console.log("_removeLookable", lookableEntity);
      if (!this._lookables.has(lookableEntity)) {
        //console.log("lookableEntity not found");
        return;
      }
      this._lookables.delete(lookableEntity);
      //console.log("removed lookable", lookableEntity);
    },

    _updateLookableList: function (lookableSelector) {
      lookableSelector = lookableSelector ?? this.data.lookableSelector;
      //console.log("_updateLookableList", { lookableSelector });
      const lookables = this.el.sceneEl.querySelectorAll(
        `[${this.data.lookableSelector}]`
      );
      //console.log("lookables", lookables);
      lookables.forEach((lookable) => {
        this._addLookable(lookable);
      });
    },
    _updateWorldMeshLookableList: function () {
      const worldMeshEntities =
        this.el.sceneEl.querySelectorAll("[data-world-mesh]");
      //console.log("worldMeshEntities", worldMeshEntities);
      worldMeshEntities.forEach((worldMeshEntity) => {
        this._addWorldMeshEntity(worldMeshEntity);
      });
    },
    setLookableSelector: function (lookableSelector) {
      //console.log("setLookableSelector", lookableSelector);
      this._observeLookables(lookableSelector);
      this._updateData("lookableSelector", lookableSelector);
    },

    setLookableAngleMin: function (lookableAngleMin) {
      lookableAngleMin = Object.assign(
        {},
        this.data.lookableAngleMax,
        lookableAngleMin
      );
      //console.log("setLookableAngleMin", lookableAngleMin);
      if (this.data.lookAround) {
        this.setLookAtPosition();
      }
      this._updateData("lookableAngleMin", lookableAngleMin);
    },
    setLookableAngleMax: function (lookableAngleMax) {
      lookableAngleMax = Object.assign(
        {},
        this.data.lookableAngleMax,
        lookableAngleMax
      );
      //console.log("setLookableAngleMax", lookableAngleMax);
      if (this.data.lookAround) {
        this.setLookAtPosition();
      }
      this._updateData("lookableAngleMax", lookableAngleMax);
    },

    setLookableWorldMeshAngleMin: function (lookableWorldMeshAngleMin) {
      lookableWorldMeshAngleMin = Object.assign(
        {},
        this.data.lookableWorldMeshAngleMax,
        lookableWorldMeshAngleMin
      );
      //console.log("setLookableWorldMeshAngleMin", lookableWorldMeshAngleMin);
      if (this.data.lookAround) {
        this.setLookAtPosition();
      }
      this._updateData("lookableWorldMeshAngleMin", lookableWorldMeshAngleMin);
    },
    setLookableWorldMeshAngleMax: function (lookableWorldMeshAngleMax) {
      lookableWorldMeshAngleMax = Object.assign(
        {},
        this.data.lookableWorldMeshAngleMax,
        lookableWorldMeshAngleMax
      );
      //console.log("setLookableWorldMeshAngleMax", lookableWorldMeshAngleMax);
      if (this.data.lookAround) {
        this.setLookAtPosition();
      }
      this._updateData("lookableWorldMeshAngleMax", lookableWorldMeshAngleMax);
    },

    _getPupilCenterEntity: function () {
      return this._getModel()?.pupilCenterEntity;
    },
    _getPupilCenterLookAtEntity: function () {
      return this._getModel()?.pupilCenterLookAtEntity;
    },
    _getPupilCenter: function () {
      return this._getModel()?.pupilCenter;
    },
    _updateLookable: function (lookable) {
      const pupilCenterEntity = this._getPupilCenterEntity();
      const { entity, position, localPosition, normalizedLocalPosition } =
        lookable;

      entity.object3D.getWorldPosition(position);
      localPosition.copy(position);
      this.worldToLocal(pupilCenterEntity.object3D, localPosition);

      const distance = localPosition.length();
      let distanceInterpolation = THREE.MathUtils.inverseLerp(
        this.data.lookableDistanceMin,
        this.data.lookableDistanceMax,
        distance
      );
      distanceInterpolation = THREE.MathUtils.clamp(
        distanceInterpolation,
        0,
        1
      );

      normalizedLocalPosition.copy(localPosition).normalize();

      const { yaw, pitch } = this._getVectorAngles(normalizedLocalPosition);
      Object.assign(lookable, { yaw, pitch });

      let yawInterpolation = THREE.MathUtils.inverseLerp(
        this.data.lookableAngleMin.x,
        this.data.lookableAngleMax.x,
        -yaw
      );
      yawInterpolation -= 0.5;
      yawInterpolation *= 2;
      // yawInterpolation = THREE.MathUtils.clamp(yawInterpolation, -1, 1);

      let pitchInterpolation = THREE.MathUtils.inverseLerp(
        this.data.lookableAngleMin.y,
        this.data.lookableAngleMax.y,
        pitch
      );
      pitchInterpolation -= 0.5;
      pitchInterpolation *= 2;
      // pitchInterpolation = THREE.MathUtils.clamp(pitchInterpolation, -1, 1);

      const isInView =
        distanceInterpolation >= 0 &&
        Math.abs(yawInterpolation) <= 1 &&
        Math.abs(pitchInterpolation) <= 1;

      let score = -Infinity;
      if (isInView) {
        score =
          (1 - yawInterpolation) *
          (1 - pitchInterpolation) *
          (1 - distanceInterpolation);
      }

      Object.assign(lookable, {
        distance,
        yawInterpolation,
        pitchInterpolation,
        isInView,
        score,
        distanceInterpolation,
      });
    },
    _focusOnLookable: function (lookable) {
      // console.log("_focusOnLookable", lookable);
      this._focusedLookable = lookable ?? this._updateWorldMeshLookable();
    },
    _tickUpdateLookablesInterval: 200,
    _tickUpdateLookables: function (time, timeDelta) {
      this._updateLookables();
    },
    _updateLookables: function () {
      if (!this._isModelLoaded()) {
        return;
      }
      this._lookables.forEach((lookable) => {
        this._updateLookable(lookable);
      });

      const sortedLookables = Array.from(this._lookables)
        .map(([entity, lookable]) => lookable)
        .filter((lookable) => lookable.isInView)
        .sort((a, b) => b.score - a.score);

      let closestLookable = sortedLookables[0];

      const ticker = this._updateLookablesTicker;

      if (sortedLookables.length > 1) {
        if (this.asideLookable) {
        } else {
          if (ticker.isDone) {
            ticker.waitRandom(
              this.data.lookableTickerMin,
              this.data.lookableTickerMax
            );
          }
        }
        ticker.tick();
        if (ticker.isDone) {
          if (this.asideLookable) {
            delete this.asideLookable;
          } else {
            this.asideLookable =
              sortedLookables[
                THREE.MathUtils.randInt(1, sortedLookables.length - 1)
              ];
            closestLookable = this.asideLookable;
            ticker.waitRandom(
              this.data.lookableAsideTickerMin,
              this.data.lookableAsideTickerMax
            );
          }
        }
        closestLookable = this.asideLookable ?? closestLookable;
      } else {
        delete this.asideLookable;
        ticker.stop();
      }
      this._focusOnLookable(closestLookable);
    },

    _addWorldMeshEntity: function (entity) {
      if (this._worldMeshEntities.includes(entity)) {
        return;
      }
      //console.log("_addWorldMeshEntity", entity);
      this._worldMeshEntities.push(entity);
    },
    _removeWorldMeshEntity: function (entity) {
      if (!this._worldMeshEntities.includes(entity)) {
        return;
      }
      //console.log("_removeWorldMeshEntity", entity);
      this._worldMeshEntities.splice(
        this._worldMeshEntities.indexOf(entity),
        1
      );
    },
    _updateWorldMeshLookable: function () {
      if (this._worldMeshEntities.length == 0) {
        return;
      }

      const lookable = this._worldMeshLookable;

      const ticker = this._updateWorldMeshLookableTicker;
      if (ticker.isDone) {
        ticker.waitRandom(
          this.data.lookableWorldMeshTickerMin,
          this.data.lookableWorldMeshTickerMax
        );
      }
      ticker.tick();
      if (!ticker.isDone && lookable.entity) {
        return lookable;
      }

      const {
        _worldMeshRaycaster: raycaster,
        _worldMeshRaycasterDirection: direction,
        _worldMeshRaycasterOrigin: origin,
        _worldMeshRaycasterQuaternion: quaternion,
        _worldMeshRaycasterEuler: euler,
      } = this;

      const pupilCenterEntity = this._getPupilCenterEntity();
      pupilCenterEntity.object3D.getWorldPosition(origin);

      direction.set(0, 0, this.data.isModelFacingBack ? 1 : -1);

      const pitch = THREE.MathUtils.randFloat(
        this.data.lookableWorldMeshAngleMin.y,
        this.data.lookableWorldMeshAngleMax.y
      );
      euler.x = -pitch;

      const yaw = THREE.MathUtils.randFloat(
        this.data.lookableWorldMeshAngleMin.x,
        this.data.lookableWorldMeshAngleMax.x
      );
      euler.y = yaw;
      direction.applyEuler(euler);

      // console.log({ pitch, yaw });

      pupilCenterEntity.object3D.getWorldQuaternion(quaternion);
      direction.applyQuaternion(quaternion);

      raycaster.set(origin, direction);
      const worldMeshObjects = this._worldMeshEntities.map(
        (entity) => entity.object3D
      );
      const hits = raycaster.intersectObjects(worldMeshObjects, true);
      if (hits.length == 0) {
        return;
      }

      const { distance, point, normal, object } = hits[0];
      let distanceInterpolation = THREE.MathUtils.inverseLerp(
        this.data.lookableDistanceMin,
        this.data.lookableDistanceMax,
        distance
      );
      distanceInterpolation = THREE.MathUtils.clamp(
        distanceInterpolation,
        0,
        1
      );
      //console.log(distance, point);
      Object.assign(lookable, {
        pitch,
        yaw,
        distance,
        entity: object.el,
        distanceInterpolation,
      });
      lookable.position.copy(point);
      return lookable;
    },
    _tickLookAtLookable: function (time, timeDelta) {
      this._lookAtLookable();
    },
    _lookAtLookable: function () {
      if (!this._focusedLookable) {
        return;
      }
      if (!this._isModelLoaded()) {
        return;
      }
      // console.log("_lookAtLookable");

      const lookable = this._focusedLookable;

      const position = this._lookAtLookablePosition;
      position.copy(lookable.position);

      // TODO (optional) - use raycaster to look towards point, intersecting with lookable.entity at some hit[0].point

      const pupilCenterLookAtEntity = this._getPupilCenterLookAtEntity();
      pupilCenterLookAtEntity.object3D.lookAt(position);

      const quaternion = this._lookAtLookableQuaternion;
      pupilCenterLookAtEntity.object3D.getWorldQuaternion(quaternion);

      const noise = this._lookAtLookableNoise;

      const ticker = this._lookAtLookableNoiseTicker;
      ticker.tick();
      if (ticker.isDone) {
        ticker.waitRandom(
          this.data.lookAtLookableNoiseTickerMin,
          this.data.lookAtLookableNoiseTickerMax
        );

        const { distanceInterpolation } = lookable;

        const noiseLength =
          THREE.MathUtils.lerp(
            this.data.lookAtLookableNoiseMin,
            this.data.lookAtLookableNoiseMax,
            ticker.randomInterpolation
          ) * distanceInterpolation;
        // console.log({ noiseLength });
        noise
          .set(1, 0, 0)
          .setLength(noiseLength)
          .applyAxisAngle(
            this._lookAtLookableAxisAngle,
            THREE.MathUtils.randFloat(0, 2 * Math.PI)
          )
          .applyQuaternion(quaternion);
      }

      position.add(noise);
      this.setLookAtPosition(position);
    },
    // LOOKABLES END

    // EYES START
    _ignoreEyesWithNoSiblingsInSchema: true,
    _onlyShowFirstLevelEyesInSchema: true,
    _includeNullPathInEyeSchema: true,
    _verifyEyeSchema: function (path) {
      if (
        this._onlyShowFirstLevelEyesInSchema ||
        this._ignoreEyesWithNoSiblingsInSchema
      ) {
        const segments = path.split(".");
        if (segments.length > 1) {
          if (this._onlyShowFirstLevelEyesInSchema) {
            return;
          }
          const parentPath = segments.slice(0, -1).join(".");
          const siblingCount =
            pupilOffsetsArray.filter(([path, _]) => path.startsWith(parentPath))
              .length - 1;
          if (siblingCount == 1) {
            return;
          }
        }
      }
      return true;
    },
    _getEyes: function () {
      return this._getModel()?.eyes ?? {};
    },
    _getEyeNodes: function () {
      return this._getModel()?.eyeNodes ?? [];
    },
    _setEyePropertyWhenInvisible: true,
    _setEyeProperty: function (path, value, callback, options) {
      Object.assign(options, {
        isProperty: "isEye",
        name: this.data.eyeName,
        nodes: this._getEyes(),
        setPropertyWhenInvisible: this._setEyePropertyWhenInvisible,
      });
      this._setNodeProperty(path, value, callback, options);
    },

    _initEyes: function () {
      this._blinkTicker = new Ticker();
      this._blinkSequence = [];
    },

    _eyeClosePrefix: "eyeClose_",
    _getEyesClose: function () {
      return this._getModel()?.eyesClose ?? {};
    },
    _getEyesCloseArray: function () {
      return this._getModel()?.eyesCloseArray ?? [];
    },
    _getEyesOpen: function () {
      return this._getModel()?.eyesOpen ?? {};
    },
    _setEyesClose: function () {
      const eyesCloseArray = structuredClone(this._getEyesCloseArray());
      eyesCloseArray.forEach(([key, close]) => {
        this.setEyeClose(key, close);
      });
    },
    _getEyesCloseSchema: function () {
      // console.log("_getEyesCloseSchema");

      const eyesCloseSchema = {};
      const eyesCloseArray = this._getEyesCloseArray();

      Object.keys(this.data)
        .filter((key) => key.startsWith(this._eyeClosePrefix))
        .forEach((key) => {
          this._deleteDataKey(key);
        });

      eyesCloseArray.forEach(([path]) => {
        if (!this._verifyEyeSchema(path)) {
          return;
        }

        eyesCloseSchema[this._eyeClosePrefix + path] = {
          type: "boolean",
          default: false,
        };
      });

      return eyesCloseSchema;
    },
    _sanitizeEyeClosePath: function (path) {
      path = this._sanitizePath(path, this._eyeClosePrefix, this.data.eyeName);
      return path;
    },

    _setEyeClose: function (variantPath, close) {
      const path = this._sanitizeEyeClosePath(variantPath);
      // console.log({ path, close });
      const variants = this._getVariants();
      const eyesOpen = this._getEyesOpen();

      let value;
      if (typeof close == "string") {
        value = close;
        close = value == this.data.eyeCloseName;
      } else if (typeof close == "boolean") {
        value = close ? this.data.eyeCloseName : eyesOpen[path];
      } else {
        console.error(`uncaught type "${typeof close}" for close`, close);
      }
      value = value ?? variants[variantPath];

      if (!close) {
        eyesOpen[path] = value;
      }

      this._updateValue({
        prefix: this._eyeClosePrefix,
        path,
        values: this._getEyesClose(),
        value: close,
        eventName: "eyeClose",
        valuesArray: this._getEyesCloseArray(),
        shouldFlushToDOM: true,
      });

      return value;
    },
    setEyeClose: function (path, close) {
      path = this._sanitizeEyeClosePath(path);

      let variantPath = path;
      if (variantPath == "") {
        variantPath = this.data.eyeName;
      } else {
        variantPath = [this.data.eyeName, variantPath].join(".");
      }
      //console.log({ path, variantPath, close });
      this.selectVariant(variantPath, close);
    },
    setEyesClose: function (close) {
      //console.log("setEyesClose", { close });
      this.setEyeClose("", close);
    },
    closeEyes: function () {
      this.setEyesClose(true);
    },
    openEyes: function () {
      this.setEyesClose(false);
    },
    _tickEyes: function (time, timeDelta) {
      this._tickBlink(...arguments);
    },
    _tickBlink: function (time, timeDelta) {
      if (!this.data.blinking) {
        return;
      }
      const sequence = this._blinkSequence;

      const ticker = this._blinkTicker;
      if (ticker.isDone) {
        if (this._isBlinking == undefined) {
          this._isBlinking = false;
        } else {
          this._isBlinking = !this._isBlinking;
        }

        const segment = sequence.at(-1);
        if (this._isBlinking) {
          if (segment?.[0]) {
            ticker.wait(segment[0]);
          } else {
            ticker.waitRandom(
              this.data.blinkCloseTickerMin,
              this.data.blinkCloseTickerMax
            );
          }
        } else {
          if (segment?.[1]) {
            ticker.wait(segment[1]);
            sequence.pop();
          } else {
            ticker.waitRandom(
              this.data.blinkOpenTickerMin,
              this.data.blinkOpenTickerMax
            );
          }
        }
        //console.log("isBlinking", this._isBlinking, ticker.duration);
        this.setEyesClose(this._isBlinking);
      }
      ticker.tick();
    },
    blink: function () {
      this.setBlinkSequence([]);
    },
    setBlinkSequence: function (..._sequence) {
      const ticker = this._blinkTicker;
      const sequence = this._blinkSequence;
      ticker.stop();
      sequence.length = 0;
      sequence.push(..._sequence);
    },
    setBlinking: function (blinking) {
      //console.log("setBlinking", blinking);
      this._updateData("blinking", blinking);

      const ticker = this._blinkTicker;
      const sequence = this._blinkSequence;

      if (!blinking) {
        this._isBlinking = false;
        ticker.stop();
        sequence.length = 0;
      }
    },

    setBlinkOpenTickerMin: function (blinkOpenTickerMin) {
      //console.log("setBlinkOpenTickerMin", blinkOpenTickerMin);
      this._updateData("blinkOpenTickerMin", blinkOpenTickerMin);
    },
    setBlinkOpenTickerMax: function (blinkOpenTickerMax) {
      //console.log("setBlinkOpenTickerMax", blinkOpenTickerMax);
      this._updateData("blinkOpenTickerMax", blinkOpenTickerMax);
    },
    setBlinkCloseTickerMin: function (blinkCloseTickerMin) {
      //console.log("setBlinkCloseTickerMin", blinkCloseTickerMin);
      this._updateData("blinkCloseTickerMin", blinkCloseTickerMin);
    },
    setBlinkCloseTickerMax: function (blinkCloseTickerMax) {
      //console.log("setBlinkCloseTickerMax", blinkCloseTickerMax);
      this._updateData("blinkCloseTickerMax", blinkCloseTickerMax);
    },

    // EYES END
  });
}
