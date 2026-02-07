AFRAME.registerSystem("recenter-listener", {
  schema: {
    target: { type: "selector", default: "a-camera" },
    distanceThreshold: { type: "number", default: 0.1 },
    angleThreshold: { type: "number", default: Math.PI / 4 },
  },

  init: function () {
    this.tock = AFRAME.utils.throttleTick(this.tock, 100, this);

    this.targetPosition = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();

    this.lastCameraPosition = new THREE.Vector3();
    this.lastCameraQuaternion = new THREE.Quaternion();

    this.el.sceneEl.addEventListener("enter-vr", () => {
      const { object3D } = this.data.target;
      object3D.getWorldPosition(this.lastCameraPosition);
      object3D.getWorldQuaternion(this.lastCameraQuaternion);

      this.isInXR = true;
    });
    this.el.sceneEl.addEventListener("exit-vr", () => {
      this.isInXR = false;
    });
  },

  tock: function (time, timeDelta) {
    if (!this.isInXR) {
      return;
    }

    const { object3D } = this.data.target;
    object3D.getWorldPosition(this.targetPosition);
    object3D.getWorldQuaternion(this.targetQuaternion);

    const distance = this.targetPosition.distanceTo(this.lastCameraPosition);
    const angle = this.targetQuaternion.angleTo(this.lastCameraQuaternion);

    //console.log({ distance, angle });
    if (
      distance > this.data.distanceThreshold ||
      angle > this.data.angleThreshold
    ) {
      //console.log("recenter detected");
      this.el.sceneEl.emit("recenter", {});
    }

    this.lastCameraPosition.copy(this.targetPosition);
    this.lastCameraQuaternion.copy(this.targetQuaternion);
  },
});
