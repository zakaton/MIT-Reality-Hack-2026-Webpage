{
  /** @type {import("three")} */
  const THREE = window.THREE;

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
      //console.log({ diffKeys });

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

      squashCenter: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
      squash: { type: "number", default: 1 },
      squashMax: { type: "vec2", default: { x: 1.15, y: 0.85 } },
      showSquashCenter: { default: false },

      squashColliderSize: { type: "number", default: 0.2 },
      squashColliderBuffer: { type: "number", default: -0.02 },
      squashColliderCenter: { type: "vec3", default: { x: 0, y: 0.04, z: 0 } },
      showSquashCollider: { default: false },
      showSquashControlPoint: { default: false },
      squashRadiusThreshold: { type: "number", default: 0.05 },
      squashRadiusBuffer: { type: "number", default: 0.01 },

      tilt: { type: "vec2", default: { x: 0, y: 0 } },
      tiltMin: { type: "vec2", default: { x: -0.3, y: -0.3 } },
      tiltMax: { type: "vec2", default: { x: 0.3, y: 0.3 } },
      squashTiltMax: { type: "vec2", default: { x: 0.3, y: 0.3 } },

      turn: { type: "number", default: 0 },

      pupilName: { type: "string", default: "pupil" },
      showPupil: { type: "boolean", default: false },
    },

    init: function () {
      this._initModel();
      this._initSquash();
      this._initPetting();
      this._initPupils();
      this.system._add(this);
    },
    remove: function () {
      this.system._remove(this);
    },

    tick: function (time, timeDelta) {
      this._tickSquash(...arguments);
      this._tickSquashAnimation(...arguments);
      this._tickPupils(...arguments);
    },

    // UTILS START
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
      this.el.flushToDOM();
      if (this.getIsSelectedInInspector()) {
        AFRAME.INSPECTOR.selectEntity(this.el);
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
    // UTILS END

    update: function (oldData) {
      const diff = AFRAME.utils.diff(oldData, this.data);

      const diffKeys = Object.keys(diff);

      //console.log({ diffKeys });

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
            case "squashRadiusThreshold":
              this.setSquashRadiusThreshold(this.data.squashRadiusThreshold);
              break;
            case "squashColliderBuffer":
              this.setSquashColliderBuffer(this.data.squashColliderBuffer);
              break;
            case "squashRadiusBuffer":
              this.setSquashRadiusBuffer(this.data.squashRadiusBuffer);
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
            case "showPupil":
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
      //console.log("loadModel", name);
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
      modelEntity.classList.add(name);
      modelEntity.classList.add("model");
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
                path,
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
                pupilEntity.setAttribute("visible", this.data.showPupil);
                const { x, y, z } = mesh.position;
                pupilEntity.setAttribute("position", [x, y, z].join(" "));
                pupilEntity.classList.add("pupil");
                pupilEntity.setAttribute("rotation", "90 0 0");

                const pupilDebugCone = document.createElement("a-cone");
                pupilDebugCone.setAttribute("color", "yellow");
                pupilDebugCone.setAttribute("height", "0.01");
                pupilDebugCone.setAttribute("radius-top", "0");
                pupilDebugCone.setAttribute("radius-bottom", "0.005");
                pupilDebugCone.setAttribute("position", "0 0.005 0");
                pupilEntity.appendChild(pupilDebugCone);
                modelEntity.appendChild(pupilEntity);

                meshTreeNode.pupilEntity = pupilEntity;
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

        const pupils = meshTree[this.data.pupilName] ?? {};
        //console.log("pupils", pupils);

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

        const pupilOffsets = {};
        if (this._includeNullPathInPupilSchema) {
          pupilOffsets[""] = { x: 0, y: 0 };
        }
        this._traverseTree(pupils, (subtree, path, isHead) => {
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
        this._traverseTree(pupils, (subtree, path, isHead) => {
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
        this._traverseTree(pupils, (subtree, path, isHead) => {
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
          meshTree,
          allVariants,
          allVariantsArray,
          variants,
          variantsArray,
          pupils,
          pupilOffsets,
          pupilOffsetsArray,
          pupilScales,
          pupilScalesArray,
          pupilRotations,
          pupilRotationsArray,
        };
        // console.log("model", model);
        this.models[name] = model;
        this.el.emit("power-pet-model-loaded", {
          name,
          model,
        });
        this.selectModel(name);
      });
      this.modelsEntity.appendChild(modelEntity);
    },
    getIsModelSelected: function () {
      return this.models[this.selectedName];
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

      this._updateSchema();

      this._updateData("model", newName, true, {
        name: newName,
        model: this.models[newName],
      });
    },
    // MODEL END

    // SCHEMA START
    _updateSchema: function () {
      const variantSchema = this._getVariantSchema();
      const pupilOffsetSchema = this._getPupilOffsetSchema();
      const pupilScaleSchema = this._getPupilScaleSchema();
      const pupilRotationSchema = this._getPupilRotationSchema();
      const extensionSchema = {
        ...variantSchema,
        ...pupilOffsetSchema,
        ...pupilScaleSchema,
        ...pupilRotationSchema,
      };
      //console.log("extensionSchema", extensionSchema);
      this.extendSchema(extensionSchema);
      this._selectVariants();
      this._setPupilOffsets();
      this._setPupilScales();
      this._setPupilRotations();
      this._flushToDOM();
    },
    // SCHEMA END

    // VARIANT START
    _variantPrefix: "variant_",
    _getVariants: function () {
      return this.models[this.selectedName]?.variants ?? {};
    },
    _getVariantsArray: function () {
      return this.models[this.selectedName]?.variantsArray ?? [];
    },
    _getAllVariants: function () {
      return this.models[this.selectedName]?.allVariants ?? {};
    },
    _getAllVariantsArray: function () {
      return this.models[this.selectedName]?.allVariantsArray ?? [];
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
      // console.log("selectVariant", { path, value });
      if (!this.getIsModelSelected()) {
        console.log("no model selected");
        return;
      }

      const { variants, meshTree, pupilOffsets, pupilScales, pupilRotations } =
        this.models[this.selectedName];

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
            if (visible && child.isPupil) {
              if (!this._setPupilPropertyWhenInvisible) {
                this._updateNodeTextureMatrix(child);
              }
            }
          } else {
            this.selectVariant([path, name].join("."), value);
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
      this.squashCenterEntity.setAttribute(
        "visible",
        this.data.showSquashCenter
      );
      this.squashPositionEntity.appendChild(this.squashCenterEntity);

      this.squashCenterSphere = document.createElement("a-sphere");
      this.squashCenterSphere.setAttribute("color", "blue");
      this.squashCenterSphere.setAttribute("radius", "0.005");
      this.squashCenterSphere.setAttribute(
        "material",
        "depthTest: false; depthWrite: false; transparent: true;"
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
    setSquashMax: function (squashMax) {
      this._updateData("squashMax", squashMax);
      this.setSquash(this.data.squash);
    },
    setSquash: function (squash, dur = 0) {
      const { x, y } = this.data.squashMax;

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

    setSquashColliderBuffer: function (squashColliderBuffer) {
      //console.log("setSquashColliderBuffer", squashColliderBuffer);
      this._updateData("squashColliderBuffer", squashColliderBuffer);
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

          this.squashCenterEntity.object3D.worldToLocal(
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
        const fullLength =
          this.data.squashColliderSize / 2 -
          this.data.squashCenter.y +
          this.data.squashColliderCenter.y +
          this.data.squashColliderBuffer;
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
          isNudging = isNudging || squash <= 0.6;
          //console.log({ squash, radius, angle2D, useSquash: isNudging });

          if (isNudging) {
            squash = 1;

            const tiltDirection = angle2D;
            let radiusInterpolation = THREE.MathUtils.inverseLerp(
              this.data.squashColliderSize / 2 - this.data.squashRadiusBuffer,
              0.05,
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
      return this.models[this.selectedName]?.pupils ?? {};
    },
    _setPupilPropertyWhenInvisible: true,
    _setPupilProperty: function (path, value, callback, options) {
      const { prefix, values, valuesArray, eventName, defaultValue, clamp } =
        options;
      path = path ?? "";
      if (path.startsWith(prefix)) {
        path = path.replace(prefix, "");
      }
      if (path.startsWith(this.data.pupilName)) {
        path = path.replace(this.data.pupilName + ".", "");
      }
      if (path.startsWith(".")) {
        path = path.replace(".", "");
      }
      value = value ?? defaultValue;
      if (clamp) {
        value = clamp(value);
      }
      //console.log("_setPupilProperty", path, value, { prefix });
      if (!this.getIsModelSelected()) {
        console.log("no model selected");
        return;
      }

      const { pupils } = this.models[this.selectedName];

      const node = this._walkTree(path, pupils);
      if (!node) {
        return;
      }
      //console.log("node", node);

      if (node.isLast && node.isPupil) {
        if (this._setPupilPropertyWhenInvisible || node.mesh.visible) {
          callback(node);
        }
      } else {
        const children = Object.entries(node);
        children.forEach(([name, childNode]) => {
          this._setPupilProperty(
            [path, name].join("."),
            value,
            callback,
            options
          );
        });
      }

      if (path in values) {
        values[path] = structuredClone(value);
        valuesArray.find(([key, _]) => key == path)[1] = value;
      }

      const dataPath = prefix + path;
      if (dataPath in this.schema) {
        this._updateData(dataPath, value, false);
        this.el.emit(`power-pet-${eventName}`, {
          name: this.selectedName,
          path,
          value,
        });
      }
    },
    _initPupils: function () {},
    _tickPupils: function (time, timeDelta) {},
    // PUPILS END

    // PUPIL OFFSETS START
    _pupilOffsetPrefix: "pupilOffset_",
    _getPupilOffsets: function () {
      return this.models[this.selectedName]?.pupilOffsets ?? {};
    },
    _getPupilOffsetsArray: function () {
      return this.models[this.selectedName]?.pupilOffsetsArray ?? [];
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
    _setPupilNodeOffset: function (node, offset) {
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
          this._updateNodeTextureMatrix(node, { offset });
        },
        {
          prefix: this._pupilOffsetPrefix,
          eventName: "pupilOffset",
          values: this._getPupilOffsets(),
          valuesArray: this._getPupilOffsetsArray(),
          defaultValue: { x: 0, y: 0 },
        }
      );
    },
    // PUPIL OFFSETS END

    // PUPIL SCALES START
    _pupilScalePrefix: "pupilScale_",
    _getPupilScales: function () {
      return this.models[this.selectedName]?.pupilScales ?? {};
    },
    _getPupilScalesArray: function () {
      return this.models[this.selectedName]?.pupilScalesArray ?? [];
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
    _setPupilNodeScale: function (node, scale) {
      const { texture, pupilPath } = node;
      const pupilOffsets = this._getPupilOffsets();
      const offset = pupilOffsets[pupilPath];
      if (this._invertPupilScale) {
        texture.repeat.set(1 / scale.x, 1 / scale.y);
        this._setPupilNodeOffset(node, offset);
      } else {
        texture.repeat.copy(value);
      }
    },
    _updateNodeTextureMatrix: function (node, values = {}) {
      const pupilScales = this._getPupilScales();
      const pupilRotations = this._getPupilRotations();
      const pupilOffsets = this._getPupilOffsets();

      const { pupilPath, texture, isUVMirrored } = node;

      const scale = values.scale ?? pupilScales[pupilPath];
      const offset = values.offset ?? pupilOffsets[pupilPath];
      let rotation = values.rotation ?? pupilRotations[pupilPath];

      if (false) {
        this._setPupilNodeScale(node, scale);
        this._setPupilNodeRotation(node, rotation);
        this._setPupilNodeOffset(node, offset);
      } else {
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
      }
    },
    setPupilScale: function (path, scale) {
      this._setPupilProperty(
        path,
        scale,
        (node) => {
          this._updateNodeTextureMatrix(node, { scale });
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
      return this.models[this.selectedName]?.pupilRotations ?? {};
    },
    _getPupilRotationsArray: function () {
      return this.models[this.selectedName]?.pupilRotationsArray ?? [];
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
    _setPupilNodeRotation: function (node, rotation) {
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
          this._updateNodeTextureMatrix(node, { rotation });
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
  });
}
