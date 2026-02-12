{
  const anglePrefix = "angle_";

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
      numberOfServos: { type: "int", default: 0 },
      numberOfSteppers: { type: "int", default: 0 },

      showDebug: { type: "boolean", default: false },
    },

    init: function () {
      this._initUtils();
      this._initDebug();
      this._initServos();
      this._initSteppers();
      // FILL
      this.system._add(this);
      this._didInit = true;
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

        if (diffKey.startsWith(this._servoPrefix)) {
          this.setServoAngle(diffKey, this.data[diffKey]);
        } else if (diffKey.startsWith(this._stepperPrefix)) {
          this.setStepperAngle(diffKey, this.data[diffKey]);
        } else {
          switch (diffKey) {
            case "numberOfSteppers":
              this.setNumberOfSteppers(this.data.numberOfSteppers);
              break;
            case "numberOfServos":
              this.setNumberOfServos(this.data.numberOfServos);
              break;
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
      if (!this._didInit) {
        return;
      }
      console.log("fuck", this._anglePrefix);
      const servosSchema = this._getServosSchema();
      const steppersSchema = this._getSteppersSchema();
      const extensionSchema = { ...servosSchema, ...steppersSchema };
      console.log("extensionSchema", extensionSchema);
      this.extendSchema(extensionSchema);
      this._setServos();
      this._setSteppers();
      this._flushToDOM();
    },
    // SCHEMA END

    // SERVOS START
    _initServos: function () {
      this._servos = [];
      const servoEntities = Array.from(
        this.el.querySelectorAll("[data-angle-type='servo']")
      ).sort((a, b) => a.dataset.angleIndex - b.dataset.angleIndex);
      // console.log("servoEntities", servoEntities);
      servoEntities.forEach((entity, index) => {
        this._servos[index] = {
          angle: entity.dataset.angle ?? 0,
          axis: entity.dataset.angleAxis ?? "x",
          sign: entity.dataset.angleSign ?? 1,
          offset: entity.dataset.angleOffset ?? 0,
          entity,
        };
        this._servos.forEach((servo) => {
          for (let key in servo) {
            if (!isNaN(servo[key])) {
              servo[key] = +servo[key];
            }
          }
        });
      });
      //console.log("_servos", this._servos);
      this.setNumberOfServos(this._servos.length);
    },
    setNumberOfServos: function (numberOfServos) {
      numberOfServos = Math.max(0, numberOfServos);
      //console.log("setNumberOfServos", { numberOfServos });
      this._servos.length = numberOfServos;
      this._updateData("numberOfServos", numberOfServos);
      this._updateSchema();
    },
    get _servoPrefix() {
      return this._anglePrefix + "servo_";
    },
    _getServosSchema: function () {
      //console.log("_getServosSchema");

      const servosSchema = {};

      Object.keys(this.data)
        .filter((key) => key.startsWith(this._servoPrefix))
        .forEach((key) => {
          this._deleteDataKey(key);
        });

      this._servos.forEach((servo, index) => {
        servosSchema[this._servoPrefix + index] = {
          type: "int",
          default: 0,
        };
      });

      return servosSchema;
    },
    _setServos: function () {
      this._servos.forEach((servo, index) => {
        this.setServoAngle(index, servo.angle);
      });
    },
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

    // STEPPERS START
    _initSteppers: function () {
      this._steppers = [];
      const stepperEntities = Array.from(
        this.el.querySelectorAll("[data-angle-type='stepper']")
      ).sort((a, b) => a.dataset.angleIndex - b.dataset.angleIndex);
      //console.log("stepperEntities", stepperEntities);
      stepperEntities.forEach((entity, index) => {
        this._steppers[index] = {
          angle: entity.dataset.angle ?? 0,
          axis: entity.dataset.angleAxis ?? "x",
          sign: entity.dataset.angleSign ?? 1,
          offset: entity.dataset.angleOffset ?? 0,
          entity,
        };
        this._steppers.forEach((stepper) => {
          for (let key in stepper) {
            if (!isNaN(stepper[key])) {
              stepper[key] = +stepper[key];
            }
          }
        });
      });
      //console.log("_steppers", this._steppers);
      this.setNumberOfSteppers(this._steppers.length);
    },
    setNumberOfSteppers: function (numberOfSteppers) {
      numberOfSteppers = Math.max(0, numberOfSteppers);
      // console.log("setNumberOfSteppers", { numberOfSteppers });
      this._updateData("numberOfSteppers", numberOfSteppers);
      this._updateSchema();
    },
    get _stepperPrefix() {
      return this._anglePrefix + "stepper_";
    },
    _getSteppersSchema: function () {
      //console.log("_getSteppersSchema");

      const steppersSchema = {};

      Object.keys(this.data)
        .filter((key) => key.startsWith(this._stepperPrefix))
        .forEach((key) => {
          this._deleteDataKey(key);
        });

      this._steppers.forEach((stepper, index) => {
        steppersSchema[this._stepperPrefix + index] = {
          type: "int",
          default: 0,
        };
      });

      return steppersSchema;
    },
    _setSteppers: function () {
      this._steppers.forEach((stepper, index) => {
        this.setStepperAngle(index, stepper.angle);
      });
    },
    setStepperAngle: function (index, angle, dur = 0) {
      if (typeof index == "string" && index.startsWith(this._stepperPrefix)) {
        index = Number(index.replace(this._stepperPrefix, ""));
      }
      if (!this._steppers[index]) {
        return;
      }
      angle = THREE.MathUtils.clamp(angle, 0, 160);
      //console.log("setStepperAngle", { index, angle });

      const { entity, axis, sign, offset } = this._steppers[index];

      const entityAngle = (angle + offset) * sign;
      const entityAngleRadians = THREE.MathUtils.degToRad(entityAngle);

      if (dur > 0) {
        // FILL
      } else {
        this._steppers[index].angle = angle;

        entity.object3D.rotation[axis] = entityAngleRadians;

        const dataPath = this._stepperPrefix + index;
        if (dataPath in this.schema) {
          this._updateData(dataPath, angle, false);
          this.el.emit("robot-angle", {
            type: "stepper",
            index,
            angle,
          });
        }
      }
    },
    // STEPPERS END

    // DEBUG START
    _initDebug: function () {
      this._debugEntities = Array.from(this.el.querySelectorAll(".debug"));
      //console.log("_debugEntities", this._debugEntities);
    },
    setShowDebug: function (showDebug) {
      console.log("setShowDebug", { showDebug });
      this._debugEntities.forEach((debugEntity) => {
        debugEntity.object3D.visible = showDebug;
      });
      this._updateData("showDebug", showDebug);
    },
    // DEBUG END
  });
}
