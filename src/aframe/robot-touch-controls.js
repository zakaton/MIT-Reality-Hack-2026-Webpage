{
  /** @type {import("three")} */
  const THREE = window.THREE;

  AFRAME.registerSystem("robot-touch-controls", {
    schema: {
      hand: { oneOf: ["left", "right"], default: "right" },
      robot: { type: "selector", default: "#robot" },
      active: { type: "boolean", default: false },
    },

    init: function () {
      this.components = [];
      this.isActive = this.data.active;
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
          case "active":
            this.setIsActive(this.data.active);
            break;
          case "hand":
            break;
          case "robot":
            break;
          default:
            console.warn(`uncaught diffKey "${diffKey}"`);
            break;
        }
      });
    },

    setIsActive: function (isActive) {
      this.isActive = isActive;
      this.components.forEach((component) => {
        component.onIsActive(this.isActive);
      });
    },
    toggleIsActive: function () {
      this.setIsActive(!this.isActive);
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

  AFRAME.registerComponent("robot-touch-controls", {
    schema: {
      raycasterObjects: {
        type: "string",
        default:
          "[data-world-mesh='table'],[data-world-mesh='floor'],[data-world-mesh='desk']",
      },
      raycasterFar: { type: "number", default: 5 },
    },
    dependencies: ["meta-touch-controls"],

    getIsDominantHand: function () {
      return this.hand == this.system.data.hand;
    },
    getDominantController: function () {
      return this.system.controller;
    },

    init: function () {
      this.touchControls = this.el.components["meta-touch-controls"];
      const { hand } = this.touchControls.data;
      this.hand = hand;
      this.isDominantHand = this.getIsDominantHand();

      this.textContainer = this.el.querySelector(".text");
      this.textContainer.setAttribute("visible", "false");
      this.textEntity = this.textContainer.querySelector("a-text");
      this.textBackgroundEntity =
        this.textContainer.querySelector(".background");
      this.textContainer.object3D.position.z = -0.05;
      this.textContainer.object3D.position.x =
        this.hand == "left" ? -0.05 : 0.05;

      this.robotEntity = this.system.data.robot;
      this.robotEntity.object3D.rotation.order = "YXZ";

      this._initVr();

      this._initController();
      if (this.isDominantHand) {
        this._initRaycaster();
        this._initLaser();
        this._initMarker();
        this.system.controller = this;
      }

      this.robotEntity.addEventListener("componentinitialized", (event) => {
        if (event.detail.name == "robot") {
          this._updateText();
        }
      });
      this._updateText();

      this.system._add(this);
    },
    remove: function () {
      this._removeMarker();
      this.system._remove(this);
    },

    _setTextVisible: function (textVisible) {
      this.textContainer.object3D.visible = textVisible;
    },
    _updateText: function () {
      let strings = [];
      if (this.hand == "right") {
        strings.push("B: ", "A: ");
      } else {
        strings.push("Y: ", "X: ");
      }
      strings.push("left/right: ");
      strings.push("up/down: ");
      const isActive = this.getIsActive();

      const robotComponent = this.getRobotComponent();

      if (this.isDominantHand) {
        strings[0] += !isActive ? "move marker" : "teleoperate";
        if (isActive) {
          strings[1] += "set position";
        } else {
          strings[1] = "";
        }
        if (isActive) {
          strings[2] += "yaw";
          strings[3] += "pitch";
        } else {
          strings[2] += "yaw";
          strings[3] += "pitch";
        }
      } else {
        const showDebug = robotComponent?.data?.showDebug ?? false;
        strings[0] += showDebug ? "hide debug" : "show debug";
        strings[1] += "tare yaw";

        if (isActive) {
          strings[2] += "roll";
          strings[3] += "height";
        } else {
          strings[2] = "";
          strings[3] += "head pitch";
        }
      }
      strings = strings.filter(Boolean);
      const string = strings.join("\n");
      // console.log(
      //   "updateText",
      //   { hand: this.hand, isActive, isDominantHand: this.isDominantHand },
      //   strings
      // );
      this.textEntity.setAttribute("value", string);
    },

    // VR START
    _initVr: function () {
      this.el.sceneEl.addEventListener("enter-vr", this.onEnterXr.bind(this));
      this.el.sceneEl.addEventListener("exit-vr", this.onExitXr.bind(this));
    },
    onEnterXr: function (event) {
      // console.log(event);
      this.isInXr = true;
      if (this.isDominantHand) {
        this.setMarkerVisible(false);
        this.setRaycasterEnabled(false);
        this.setRaycasterVisible(false);
      }
    },
    onExitXr: function (event) {
      this.isInXr = true;
    },
    // VR END

    tick: function (time, timeDelta) {
      this._tickRaycaster(...arguments);
      this._tickController(...arguments);
    },

    _tickController: function (time, timeDelta) {
      if (!this.robotEntity) {
        return;
      }
      const isActive = this.getIsActive();
      let { x, y } = this.thumbstick;
      if (x == 0 && y == 0) {
        return;
      }
      // console.log({ x, y });

      const { object3D } = this.robotEntity;
      if (object3D.rotation.order != "YXZ") {
        object3D.rotation.reorder("YXZ");
      }

      const timeDeltaScaler = timeDelta / 1000;

      const isXDominant = Math.abs(x) > Math.abs(y);
      const scalars = this._thumbstickMovedScalars;

      x *= timeDeltaScaler;
      y *= timeDeltaScaler;

      if (isActive) {
        if (this.isDominantHand) {
          if (isXDominant) {
            const yawOffset = x * scalars.yaw;
            // console.log({ yawOffset });
            object3D.rotation.y += yawOffset;
          } else {
            const pitchOffset = y * scalars.pitch;
            // console.log({ pitchOffset });
            object3D.rotation.x += pitchOffset;
          }
        } else {
          if (isXDominant) {
            const rollOffset = x * scalars.roll;
            // console.log({ rollOffset });
            object3D.rotation.z += rollOffset;
          } else {
            const yOffset = y * scalars.y;
            // console.log({ yOffset });
            object3D.position.y += yOffset;
          }
        }
      } else {
        //console.log({ isXDominant, x, y });
        if (this.isDominantHand) {
          if (isXDominant) {
            const stepper0Angle = x * scalars.stepper;
            this._setAngle("stepper", 0, stepper0Angle, true);
          } else {
            const servo0Angle = y * scalars.servo0;
            this._setAngle("servo", 0, servo0Angle, true);
          }
          //console.log({ stepper0Angle, servo0Angle });
        } else {
          if (isXDominant) {
          } else {
            const servo1Angle = y * scalars.servo1;
            this._setAngle("servo", 1, servo1Angle, true);
            //console.log({ servo1Angle });
          }
        }
      }
    },
    _setAngle: function (type, index, angle, isOffset) {
      this.robotEntity.emit("robot-angle", {
        type,
        index,
        angle,
        isOffset,
      });
    },

    // RAYCASTER START
    _tickRaycaster: function (time, timeDelta) {
      const raycaster = this.el.components.raycaster;
      if (!raycaster) return;

      const intersections = raycaster.intersections;
      if (!intersections || intersections.length === 0) return;

      const hit = intersections[0];
      const { point, distance } = hit;

      this.setMarkerPosition(point);
    },
    _initRaycaster: function () {
      if (this.hand == "left") {
        return;
      }
      this.el.addEventListener(
        "raycaster-intersection",
        this.onRaycasterIntersection.bind(this)
      );
      this.el.addEventListener(
        "raycaster-intersection-cleared",
        this.onRaycasterIntersectionCleared.bind(this)
      );
      this.el.setAttribute("raycaster", {
        objects: this.data.raycasterObjects,
        far: this.data.raycasterFar,
        showLine: false,
        enabled: false,
      });
    },
    setRaycasterVisible: function (raycasterVisible) {
      this.raycasterVisible = raycasterVisible;
      // console.log({ raycasterVisible });
      this.el.setAttribute("raycaster", "showLine", raycasterVisible);
    },
    toggleRaycasterVisible: function () {
      this.setRaycasterVisible(!this.raycasterVisible);
    },
    setRaycasterEnabled: function (raycasterEnabled) {
      // console.log({ raycasterEnabled });
      this.el.setAttribute("raycaster", { enabled: raycasterEnabled });
    },
    toggleRaycasterEnabled: function () {
      this.setRaycasterEnabled(!this.raycasterEnabled);
    },
    onRaycasterIntersection: function (event) {
      //console.log("onRaycasterIntersection");
      this.raycaster = event.detail.el;
    },
    onRaycasterIntersectionCleared: function (event) {
      //console.log("onRaycasterIntersectionCleared");
      this.raycaster = null;
    },
    // RAYCASTER END

    // CONTROLLER START
    _initController: function () {
      this.el.addEventListener(
        "controllerconnected",
        this.onControllerConnected.bind(this)
      );
      this.el.addEventListener(
        "controllerdisconnected",
        this.onControllerDisconnected.bind(this)
      );
      this.el.addEventListener(
        "controllermodelready",
        this.onControllerModelReady.bind(this)
      );

      this.el.addEventListener("abuttondown", this.onAButtonDown.bind(this));
      this.el.addEventListener("bbuttondown", this.onBButtonDown.bind(this));
      this.el.addEventListener("xbuttondown", this.onXButtonDown.bind(this));
      this.el.addEventListener("ybuttondown", this.onYButtonDown.bind(this));

      this.thumbstick = { x: 0, y: 0 };
      this.el.addEventListener(
        "thumbstickmoved",
        this.onThumbstickMoved.bind(this)
      );
    },

    onControllerConnected: function (event) {
      // console.log(event);
      this._setTextVisible(true);
    },
    onControllerDisconnected: function (event) {
      // console.log(event);
      this._setTextVisible(false);
    },
    onControllerModelReady: function (event) {
      // console.log(event);
    },
    onBButtonDown: function (event) {
      // console.log("onBButtonDown");
      this.onUpperButton(event);
    },
    onAButtonDown: function (event) {
      // console.log("onAButtonDown");
      this.onLowerButton(event);
    },
    onYButtonDown: function (event) {
      // console.log("onYButtonDown");
      this.onUpperButton(event);
    },
    onXButtonDown: function (event) {
      // console.log("onXButtonDown");
      this.onLowerButton(event);
    },
    _thumbstickMovedScalars: {
      yaw: -0.7,
      pitch: 0.5,
      roll: -0.5,
      y: -0.05,
      servo0: 400,
      servo1: 800,
      stepper: -800,
    },
    onThumbstickMoved: function (event) {
      const { x, y } = event.detail;
      Object.assign(this.thumbstick, { x, y });
      // console.log("onThumbstickMoved", this.thumbstick);
    },
    onUpperButton: function (event) {
      if (this.isDominantHand) {
        this.system.toggleIsActive();
      } else {
        this.getRobotComponent().toggleShowDebug();
        this._updateText();
      }
    },
    onLowerButton: function (event) {
      if (this.isDominantHand) {
        if (this.system.isActive) {
          this.updateRobotPosition();
        }
      } else {
        this.robotEntity.emit("robot-tare-angle", {
          type: "stepper",
          index: 0,
        });
      }
    },
    getIsActive: function () {
      return this.system.isActive;
    },
    onIsActive: function () {
      const isActive = this.getIsActive();
      if (this.isDominantHand) {
        // console.log("onIsActive", { isActive });
        this.setMarkerVisible(isActive);
        this.setRaycasterVisible(isActive);
        this.setRaycasterEnabled(isActive);
      }
      this._updateText();
    },
    // CONTROLLER END

    // ROBOT START
    updateRobotPosition: function () {
      if (!this.robotEntity) {
        return;
      }
      this.setRobotPosition(this.markerPosition);
    },
    setRobotPosition: function (position) {
      this.robotEntity.object3D.position.copy(position);
    },
    getRobotComponent: function () {
      return this.robotEntity.components["robot"];
    },
    // ROBOT END

    // LASER START
    _initLaser: function () {
      const { hand } = this;
      this.el.setAttribute("laser-controls", {
        hand,
      });
    },
    // LASER END

    // MARKER START
    _initMarker: function () {
      this.markerPosition = new THREE.Vector3();

      this.markerContainerEntity = document.createElement("a-entity");
      this.markerContainerEntity.setAttribute("visible", "false");

      this.markerEntity = document.createElement("a-ring");
      this.markerEntity.setAttribute("color", "black");
      this.markerEntity.setAttribute("radius-inner", "0.05");
      this.markerEntity.setAttribute("radius-outer", "0.08");
      this.markerEntity.setAttribute("rotation", "-90 0 0");
      this.markerEntity.setAttribute("position", "0 0 0");
      this.markerEntity.setAttribute("color", "black");
      this.markerContainerEntity.appendChild(this.markerEntity);

      this.el.sceneEl.appendChild(this.markerContainerEntity);
    },
    _removeMarker: function () {
      this.markerContainerEntity.remove();
    },
    setMarkerVisible: function (markerVisible) {
      this.markerVisible = markerVisible;
      // console.log({ ringVisible });
      if (this.markerContainerEntity.object3D) {
        this.markerContainerEntity.object3D.visible = markerVisible;
      } else {
        this.markerContainerEntity.setAttribute("visible", markerVisible);
      }
    },
    toggleMarkerVisible: function () {
      this.setMarkerVisible(!this.markerVisible);
    },
    setMarkerPosition: function (position) {
      this.markerPosition.copy(position);
      if (this.markerContainerEntity.object3D) {
        this.markerContainerEntity.object3D.position.copy(position);
      } else {
        this.markerContainerEntity.setAttribute(
          "position",
          position.toArray().join(" ")
        );
      }
    },
    // MARKER END
  });
}
