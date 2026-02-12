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
    schema: {
      showDebug: { type: "boolean", default: false },
    },

    init: function () {
      this._initUtils();
      this._initDebug();
      this._initAngles();
      this._updateSchema();
      // FILL
      this.system._add(this);
    },
    remove: function () {
      // FILL
      this.system._remove(this);
    },

    tick: function (time, timeDelta) {
      // FILL
    },

    // ANGLES START
    get _anglePrefix() {
      return "angle_";
    },
    _initAngles: function () {
      //console.log("_initAngles");
      this._angles = {
        servo: [],
        stepper: [],
      };
      const angleEntities = Array.from(
        this.el.querySelectorAll("[data-angle-type]")
      );
      // console.log("angleEntities", angleEntities);
      angleEntities.forEach((entity) => {
        const type = entity.dataset.angleType;
        const index = entity.dataset.angleIndex;
        const angle = {
          angle: entity.dataset.angle ?? 0,
          axis: entity.dataset.angleAxis ?? "x",
          sign: entity.dataset.angleSign ?? 1,
          offset: entity.dataset.angleOffset ?? 0,
          entity,
        };
        for (let key in angle) {
          if (!isNaN(angle[key])) {
            angle[key] = +angle[key];
          }
        }
        this._angles[type][index] = angle;
      });
      // console.log("_angles", this._angles);
    },
    _forEachAngle: function (callback) {
      for (const type in this._angles) {
        this._angles[type].forEach((angle, index) => {
          callback(type, index, angle.angle);
        });
      }
    },
    _getAnglesSchema: function () {
      //console.log("_getAnglesSchema");

      const anglesSchema = {};

      Object.keys(this.data)
        .filter((key) => key.startsWith(this._anglePrefix))
        .forEach((key) => {
          this._deleteDataKey(key);
        });

      this._forEachAngle((type, index, angle) => {
        anglesSchema[this._anglePrefix + [type, index].join("_")] = {
          type: "int",
          default: 0,
        };
      });

      return anglesSchema;
    },
    _setAngles: function () {
      this._forEachAngle((type, index, angle) => {
        this.setAngle(type, index, angle);
      });
    },
    setAngle: function (type, index, angle, dur = 0) {
      if (!this._angles[type]?.[index]) {
        return;
      }
      switch (type) {
        case "servo":
          angle = THREE.MathUtils.clamp(angle, 0, 160);
          break;
      }
      //console.log("setAngle", { type, index, angle });

      const { entity, axis, sign, offset } = this._angles[type][index];
      const entityAngle = (angle + offset) * sign;
      const entityAngleRadians = THREE.MathUtils.degToRad(entityAngle);

      if (dur > 0) {
        // FILL
      } else {
        this._angles[type][index].angle = angle;

        entity.object3D.rotation[axis] = entityAngleRadians;

        const dataPath = this._anglePrefix + [type, index].join("_");
        if (dataPath in this.schema) {
          this._updateData(dataPath, angle, false);
          this.el.emit("robot-angle", {
            type,
            index,
            angle,
          });
        }
      }
    },
    // ANGLES END

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
      this.el.emit(`robot-${key}`, detail);
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

        if (diffKey.startsWith(this._anglePrefix)) {
          const [_, type, index] = diffKey.split("_");
          this.setAngle(type, +index, +this.data[diffKey]);
        } else {
          switch (diffKey) {
            case "showDebug":
              this.setShowDebug(this.data.showDebug);
              break;
            default:
              console.warn(`uncaught diffKey "${diffKey}"`);
              break;
          }
        }
      });
      this._updateCalledOnce = true;
    },

    // SCHEMA START
    _updateSchema: function () {
      const anglesSchema = this._getAnglesSchema();
      const extensionSchema = { ...anglesSchema };
      // console.log("extensionSchema", extensionSchema);
      this.extendSchema(extensionSchema);
      this._setAngles();
      this._flushToDOM();
    },
    // SCHEMA END

    // SERVOS START
    setServoAngle: function (index, angle, dur = 0) {
      if (typeof index == "string" && index.startsWith(this._servoPrefix)) {
        index = Number(index.replace(this._servoPrefix, ""));
      }
      if (!this._servos[index]) {
        return;
      }
      angle = THREE.MathUtils.clamp(angle, 0, 160);
      //console.log("setServoAngle", { index, angle });

      const { entity, axis, sign, offset } = this._servos[index];

      const entityAngle = (angle + offset) * sign;
      const entityAngleRadians = THREE.MathUtils.degToRad(entityAngle);

      if (dur > 0) {
        // FILL
      } else {
        this._servos[index].angle = angle;

        entity.object3D.rotation[axis] = entityAngleRadians;

        const dataPath = this._servoPrefix + index;
        if (dataPath in this.schema) {
          this._updateData(dataPath, angle, false);
          this.el.emit("robot-angle", {
            type: "servo",
            index,
            angle,
          });
        }
      }
    },
    // SERVOS END

    // DEBUG START
    _initDebug: function () {
      this._debugEntities = Array.from(this.el.querySelectorAll(".debug"));
      //console.log("_debugEntities", this._debugEntities);
    },
    setShowDebug: function (showDebug) {
      //console.log("setShowDebug", { showDebug });
      this._debugEntities.forEach((debugEntity) => {
        debugEntity.object3D.visible = showDebug;
      });
      this._updateData("showDebug", showDebug);
    },
    // DEBUG END
  });
}
