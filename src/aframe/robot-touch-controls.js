{
  /** @type {import("three")} */
  const THREE = window.THREE;

  AFRAME.registerSystem("robot-touch-controls", {
    schema: {
      hand: { oneOf: ["left", "right"], default: "right" },
      target: { type: "selector", default: "#robot" },
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
          case "target":
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

      this.targetEntity = this.system.data.target;
      this.targetEntity.object3D.rotation.order = "YXZ";

      this._initVr();

      this._initController();
      if (this.isDominantHand) {
        this._initRaycaster();
        this._initLaser();
        this._initMarker();
        this.system.controller = this;
      }

      this.system._add(this);
    },
    remove: function () {
      this._removeMarker();
      this.system._remove(this);
    },

    // VR START
    _initVr: function () {
      this.el.sceneEl.addEventListener("enter-vr", this.onEnterXr.bind(this));
      this.el.sceneEl.addEventListener("exit-vr", this.onExitXr.bind(this));
    },
    onEnterXr: function (event) {
      //   console.log(event);
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
      const raycaster = this.el.components.raycaster;
      if (!raycaster) return;

      const intersections = raycaster.intersections;
      if (!intersections || intersections.length === 0) return;

      const hit = intersections[0];
      const { point, distance } = hit;

      this.setMarkerPosition(point);
    },

    // RAYCASTER START
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
      this.el.addEventListener(
        "thumbstickmoved",
        this.onThumbstickMoved.bind(this)
      );
    },
    onControllerConnected: function (event) {
      // console.log(event);
    },
    onControllerDisconnected: function (event) {
      // console.log(event);
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
      yaw: -0.03,
      pitch: 0.03,
      roll: -0.03,
      y: -0.003,
    },
    onThumbstickMoved: function (event) {
      // console.log("onThumbstickMoved");
      if (!this.targetEntity) {
        return;
      }
      if (!this.system.isActive) {
        return;
      }
      const { object3D } = this.targetEntity;
      if (object3D.rotation.order != "YXZ") {
        object3D.rotation.reorder("YXZ");
      }
      const { x, y } = event.detail;
      const isXDominant = Math.abs(x) > Math.abs(y);
      const scalars = this._thumbstickMovedScalars;
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
    },

    onLowerButton: function (event) {
      if (!this.system.isActive) {
        return;
      }
      if (this.isDominantHand) {
        this.updateTargetPosition();
      }
    },
    onUpperButton: function (event) {
      if (this.isDominantHand) {
        this.system.toggleIsActive();
      } else {
        this.targetEntity.components["robot"].toggleShowDebug();
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
    },
    // CONTROLLER END

    // TARGET START
    updateTargetPosition: function () {
      if (!this.targetEntity) {
        return;
      }
      this.setTargetPosition(this.markerPosition);
    },
    setTargetPosition: function (position) {
      this.targetEntity.object3D.position.copy(position);
    },
    // TARGET END

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
