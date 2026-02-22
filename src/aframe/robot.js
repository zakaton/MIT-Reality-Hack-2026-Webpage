{
  /** @type {import("three")} */
  const THREE = window.THREE;

  /** @typedef {import("../uno-q/UnoQ.js").Angles} Angles */

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
      cameraSelector: { type: "selector", default: "a-camera" },
      followCamera: { type: "boolean", default: false },
      followCameraAngleMin: { type: "vec2", default: { x: -0.32, y: -0.1 } },
      followCameraAngleMax: { type: "vec2", default: { x: 0.32, y: 0.1 } },
      followCameraAngleStep: { type: "vec2", default: { x: 10, y: 10 } },

      sneezeServo0Angle: { type: "number", default: -60 },
      sneezeServo1Angle: { type: "number", default: 60 },
    },

    init: function () {
      this._initUtils();
      this._initDebug();
      this._initAngles();
      this._initPowerPet();
      this._updateSchema();
      this.system._add(this);
    },
    remove: function () {
      this.system._remove(this);
    },

    tick: function (time, timeDelta) {
      this._tickPowerPet(...arguments);
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
    setAngle: function (type, index, angle, isOffset = false, dur = 0) {
      if (!this._angles[type]?.[index]) {
        return;
      }
      if (isOffset) {
        angle = Math.round(this._angles[type][index].angle + angle);
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
          if (this._updateCalledOnce) {
            this.el.emit("robot-angle", {
              type,
              index,
              angle,
            });
          }
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
      this.flushToDOM();
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
        // console.log("update", { [diffKey]: this.data[diffKey] });

        if (diffKey.startsWith(this._anglePrefix)) {
          const [_, type, index] = diffKey.split("_");
          this.setAngle(type, +index, +this.data[diffKey]);
        } else {
          switch (diffKey) {
            case "showDebug":
              this.setShowDebug(this.data.showDebug);
              break;
            case "cameraSelector":
              break;
            case "followCamera":
              this.setFollowCamera(this.data.followCamera);
              break;
            case "followCameraAngleMin":
              this.setFollowCameraAngleMin(this.data.followCameraAngleMin);
              break;
            case "followCameraAngleMax":
              this.setFollowCameraAngleMax(this.data.followCameraAngleMax);
              break;
            case "followCameraAngleStep":
              this.setFollowCameraAngleStep(this.data.followCameraAngleStep);
              break;
            case "sneezeServo0Angle":
              break;
            case "sneezeServo1Angle":
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
    toggleShowDebug: function () {
      this.setShowDebug(!this.data.showDebug);
    },
    // DEBUG END

    // POWER PET START
    _initPowerPet: function () {
      this._sneezeTicker = new Ticker();

      this._tickPowerPetInterval = 100;
      if (this._tickPowerPetInterval > 0) {
        this._tickPowerPet = AFRAME.utils.throttleTick(
          this._tickPowerPet,
          this._tickPowerPetInterval,
          this
        );
      }

      this.powerPetEntity = this.el.querySelector("[power-pet]");
      this.powerPetEntity.addEventListener(
        "power-pet-state",
        this.onPowerPetState.bind(this)
      );
      if (AFRAME.utils.device.checkHeadsetConnected()) {
        this.powerPetEntity.addEventListener(
          "power-pet-about-to-sneeze",
          this.onPowerPetSneeze.bind(this)
        );
      } else {
        this.powerPetEntity.addEventListener(
          "power-pet-sneeze",
          this.onPowerPetSneeze.bind(this)
        );
      }
      this.powerPetEntity.addEventListener(
        "power-pet-sneeze-finish",
        this.onPowerPetSneezeFinish.bind(this)
      );
      //console.log("powerPetEntity", this.powerPetEntity);
      this.cameraEntity = this.data.cameraSelector;
      //console.log("cameraEntity", this.cameraEntity);
    },
    getPowerPetComponent: function () {
      return this.powerPetEntity.components["power-pet"];
    },
    getPowerPetLookables: function () {
      return this.getPowerPetComponent()?._lookables;
    },
    getPowerPetState: function () {
      return this.getPowerPetComponent()?.getPetState?.() ?? "idle";
    },
    _tickPowerPet: function (time, timeDelta) {
      if (!this.data.followCamera) {
        return;
      }
      const petState = this.getPowerPetState();
      if (petState != "idle") {
        return;
      }

      this._sneezeTicker.tick();
      if (this._sneezeTicker.isTicking) {
        return;
      }

      const lookables = this.getPowerPetLookables();
      if (!lookables) {
        return;
      }

      const hands = Array.from(lookables).filter(
        ([entity, lookable]) =>
          entity.parentEl.components["hand-tracking-controls"]
      );
      // console.log("hands", hands);
      const isHandClose = hands.some(([entity, lookable]) => {
        return lookable.distance < 0.1;
      });
      if (isHandClose) {
        console.log({ isHandClose });
        return;
      }

      const lookable = lookables.get(this.cameraEntity);
      if (!lookable) {
        return;
      }
      //console.log("lookable", lookable);
      const { isInView, pitch, yaw, yawInterpolation, pitchInterpolation } =
        lookable;

      //console.log({ yawInterpolation, pitchInterpolation });

      const _yawInterpolation = THREE.MathUtils.inverseLerp(
        this.data.followCameraAngleMin.x,
        this.data.followCameraAngleMax.x,
        yawInterpolation
      );
      const _pitchInterpolation = THREE.MathUtils.inverseLerp(
        this.data.followCameraAngleMin.y,
        this.data.followCameraAngleMax.y,
        pitchInterpolation
      );
      //console.log({ _yawInterpolation, _pitchInterpolation });

      if (
        _yawInterpolation > 0 &&
        _yawInterpolation < 1 &&
        _pitchInterpolation > 0 &&
        _pitchInterpolation < 1
      ) {
        return;
      }

      //console.log({ yawInterpolation, pitchInterpolation });

      let servoAngleOffset =
        pitchInterpolation * this.data.followCameraAngleStep.y;
      servoAngleOffset *= -1;
      servoAngleOffset = Math.round(servoAngleOffset);
      let stepperAngleOffset =
        yawInterpolation * this.data.followCameraAngleStep.x;
      stepperAngleOffset *= -1;
      stepperAngleOffset = Math.round(stepperAngleOffset);

      //console.log({ servoAngleOffset, stepperAngleOffset });

      if (servoAngleOffset == 0 && stepperAngleOffset == 0) {
        return;
      }

      if (this.didSneeze) {
        return;
      }

      const servo0AngleOffset = servoAngleOffset * 0.1;
      const servo1AngleOffset = servoAngleOffset * 1;

      // console.log("tick", {
      //   servo0Angle: servo0AngleOffset,
      //   servo1Angle: servo1AngleOffset,
      // });

      /** @type {Angles} */
      const angles = {
        servo: [servo0AngleOffset, servo1AngleOffset],
        stepper: [stepperAngleOffset],
      };
      //console.log("angles", angles);
      this.el.emit("robot-angles", {
        angles,
        isOffset: true,
      });
    },
    setFollowCamera: function (followCamera) {
      //console.log("setFollowCamera", { followCamera });
      this._updateData("followCamera", followCamera);
    },
    toggleFollowCamera: function () {
      this.setFollowCamera(!this.data.followCamera);
    },

    setFollowCameraAngleMin: function (followCameraAngleMin) {
      // console.log("setFollowCameraAngleMin", followCameraAngleMin);
      this._updateData("followCameraAngleMin", followCameraAngleMin);
    },
    setFollowCameraAngleMax: function (followCameraAngleMax) {
      // console.log("setFollowCameraAngleMax", followCameraAngleMax);
      this._updateData("followCameraAngleMax", followCameraAngleMax);
    },
    setFollowCameraAngleStep: function (followCameraAngleStep) {
      // console.log("setFollowCameraAngleStep", followCameraAngleStep);
      this._updateData("followCameraAngleStep", followCameraAngleStep);
    },

    onPowerPetState: function (event) {
      const { petState, previousPetState } = event.detail;
      //console.log("onPowerPetState", { petState, previousPetState });
    },
    getCurrentAngles: function () {
      return {
        servo0Angle: this.data["angle_servo_0"],
        servo1Angle: this.data["angle_servo_1"],
      };
    },
    onPowerPetSneeze: function (event) {
      //console.log("onPowerPetSneeze");

      const servo0AngleOffset = this.data.sneezeServo0Angle;
      const servo1AngleOffset = this.data.sneezeServo1Angle;

      //console.log("sneeze", { servo0AngleOffset, servo1AngleOffset });

      this.sneezeOriginalAngles = this.getCurrentAngles();

      /** @type {Angles} */
      const angles = {
        servo: [servo0AngleOffset, servo1AngleOffset],
      };
      // console.log("sneeze", angles);
      this.el.emit("robot-angles", {
        angles,
        isOffset: true,
      });
    },
    onPowerPetSneezeFinish: function (event) {
      // console.log("onPowerPetSneezeFinish");

      if (true) {
        const currentAngles = this.getCurrentAngles();
        const originalAngles = this.sneezeOriginalAngles;

        /** @type {Angles} */
        const angles = {
          servo: [
            THREE.MathUtils.lerp(
              currentAngles.servo0Angle,
              originalAngles.servo0Angle,
              0.8
            ),
            THREE.MathUtils.lerp(
              currentAngles.servo1Angle,
              originalAngles.servo1Angle,
              0.8
            ),
          ],
        };
        // console.log("sneezeFinish", angles);
        this.el.emit("robot-angles", {
          angles,
        });
        this._sneezeTicker.wait(100);
      }
    },
    // POWER PET END
  });
}
