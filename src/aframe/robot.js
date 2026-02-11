{
  /** @type {import("three")} */
  const THREE = window.THREE;

  AFRAME.registerSystem("robot", {
    getIsInspectorOpen: function () {
      return AFRAME.INSPECTOR?.opened;
    },
    getSelectedInspectorEntity: function () {
      return this.getIsInspectorOpen() && AFRAME.INSPECTOR?.selectedEntity;
    },

    schema: {
      tickInInspector: { type: "boolean", default: true },
    },

    init: function () {
      this.components = [];
    },

    tick: function (time, timeDelta) {
      if (this.data.tickInInspector && this.getIsInspectorOpen()) {
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
  });

  AFRAME.registerComponent("robot", {
    schema: {},

    init: function () {
      this._initUtils();
      // FILL
      this.system._add(this);
    },
    remove: function () {
      // FILL
      this.system._remove(this);
    },

    tick: function (time, timeDelta) {
      //FILL
    },

    // UTILS START
    _initUtils: function () {
      this._worldToLocalScale = new THREE.Vector3();
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
      this.el.flushToDOM();
      if (this.getIsSelectedInInspector()) {
        AFRAME.INSPECTOR.selectEntity(this.el);
      }
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

        switch (diffKey) {
          default:
            console.warn(`uncaught diffKey "${diffKey}"`);
            break;
        }
      });
      this._updateCalledOnce = true;
    },

    // SCHEMA START
    _updateSchema: function () {
      // const variantSchema = this._getVariantSchema();
      const extensionSchema = {};
      //console.log("extensionSchema", extensionSchema);
      this.extendSchema(extensionSchema);
      // this._selectVariants();
      this._flushToDOM();
    },
    // SCHEMA END

    // SERVOS START
    // FILL
    // SERVOS END

    // STEPPERS START
    // FILL
    // STEPPERS END

    // VARIANT START
    // _variantPrefix: "variant_",
    // _getVariants: function () {
    //   return this._getModel()?.variants ?? {};
    // },
    // _getVariantsArray: function () {
    //   return this._getModel()?.variantsArray ?? [];
    // },
    // _getAllVariants: function () {
    //   return this._getModel()?.allVariants ?? {};
    // },
    // _getAllVariantsArray: function () {
    //   return this._getModel()?.allVariantsArray ?? [];
    // },
    // _selectVariants: function () {
    //   const variantsArray = structuredClone(this._getVariantsArray());
    //   variantsArray.forEach(([key, value]) => {
    //     this.selectVariant(key, value);
    //   });
    // },
    // _getVariantSchema: function () {
    //   // console.log("_getVariantSchema");

    //   const variantSchema = {};
    //   const allVariantsArray = this._getAllVariantsArray();

    //   Object.keys(this.data)
    //     .filter((key) => key.startsWith(this._variantPrefix))
    //     .forEach((key) => {
    //       this._deleteDataKey(key);
    //     });

    //   allVariantsArray.forEach(([key, oneOf]) => {
    //     variantSchema[this._variantPrefix + key] = { oneOf };
    //   });

    //   return variantSchema;
    // },
    // _invertPupilScale: true,
    // selectVariant: function (path, value) {
    //   if (path.startsWith(this._variantPrefix)) {
    //     path = path.replace(this._variantPrefix, "");
    //   }
    //   if (value == undefined) {
    //     return;
    //   }
    //   // console.log("selectVariant", { path, value });
    //   if (!this.getIsModelSelected()) {
    //     console.log("no model selected");
    //     return;
    //   }

    //   const { variants, meshTree, pupilOffsets, pupilScales, pupilRotations } =
    //     this._getModel();

    //   if (!this._includeNullPathInPupilSchema && path == "") {
    //     return;
    //   }

    //   const node = this._walkTree(
    //     path,
    //     meshTree,
    //     (node, treeWalker, segment) => {
    //       if (node.isLast && !node.hasMultipleUv) {
    //         console.error(
    //           `invalid path "${path}" - no segment "${segment}" found and only 1 uvCount`,
    //           treeWalker,
    //           "in",
    //           meshTree
    //         );
    //         return false;
    //       }
    //       return true;
    //     }
    //   );
    //   if (!node) {
    //     return;
    //   }
    //   //console.log("node", node);

    //   if (node.isLast) {
    //     let channel = 0;
    //     if (isNaN(value)) {
    //       channel = node.uvMap[value];
    //     } else {
    //       channel = +value;
    //       Object.entries(node.uvMap).some(([key, _channel]) => {
    //         if (_channel == channel) {
    //           value = key;
    //           return true;
    //         }
    //       });
    //     }
    //     if (channel >= node.uvCount) {
    //       console.error(`invalid uv index ${channel}, max ${node.uvCount - 1}`);
    //       return;
    //     }
    //     //console.log(`setting uv index to ${channel}`);
    //     node.texture.channel = channel;
    //   } else {
    //     const children = Object.entries(node);
    //     children.forEach(([name, child]) => {
    //       if (child.isLast && isNaN(value)) {
    //         const visible = name == value;
    //         child.mesh.visible = visible;
    //         if (visible && child.isPupil) {
    //           if (!this._setPupilPropertyWhenInvisible) {
    //             this._updateTextureMatrix(child);
    //             this._updateShowLookAt(child);
    //             this._updateLookAtPosition(child);
    //           }
    //         }
    //       } else {
    //         this.selectVariant([path, name].join("."), value);
    //       }
    //     });
    //   }

    //   if (path in variants) {
    //     variants[path] = value;
    //   }
    //   const dataPath = this._variantPrefix + path;
    //   if (dataPath in this.schema) {
    //     this._updateData(dataPath, value, false);
    //     this.el.emit("power-pet-variant", {
    //       name: this.selectedName,
    //       path,
    //       value,
    //     });
    //   }
    // },
    // VARIANT END
  });
}
