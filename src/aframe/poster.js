{
  async function wait(delay) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), delay);
    });
  }

  AFRAME.registerComponent("poster", {
    schema: {
      camera: { type: "selector", default: "a-camera" },
    },
    init: function () {
      this.cameraEntity = this.data.camera ?? AFRAME.scenes[0].camera.el;

      this.el.sceneEl.addEventListener(
        "anchorLoaded",
        this.onAnchorLoaded.bind(this),
        { once: true }
      );
      this.el.sceneEl.addEventListener("enter-vr", this.onEnterXr.bind(this));
      this.el.sceneEl.addEventListener("exit-vr", this.onExitXr.bind(this));
    },

    axisAngle: new THREE.Vector3(0, 1, 0),
    updatePosterPosition: function () {
      const worldMeshEntities = Array.from(
        this.el.sceneEl.querySelectorAll("[data-world-mesh]")
      ).filter((mesh) => mesh.dataset.worldMesh == "wall");
      //console.log("worldMeshEntities", worldMeshEntities);
      if (worldMeshEntities.length == 0) {
        return;
      }
      const worldMeshObjects = worldMeshEntities.map(
        (entity) => entity.object3D
      );

      const raycaster = new THREE.Raycaster();

      const position = new THREE.Vector3();
      position.copy(this.cameraEntity.object3D.position);
      const direction = new THREE.Vector3();
      direction
        .set(0, 0, -1)
        .applyAxisAngle(this.axisAngle, THREE.MathUtils.randFloat(-0.5, 0.5));
      raycaster.set(position, direction);
      // console.log(position, direction);

      const hits = raycaster.intersectObjects(worldMeshObjects, true);
      // console.log("hits", hits);
      if (hits.length == 0) {
        return;
      }

      const { distance, point, normal, object } = hits[0];

      normal.transformDirection(object.matrixWorld);

      const yaw = Math.atan2(normal.x, normal.z);

      const { object3D } = this.el;
      object3D.position.copy(point);
      // console.log({ yaw });
      //object3D.rotation.copy(object.rotation);
      object3D.rotation.y = yaw;
      this.el.setAttribute("visible", "true");
      this.el.setAttribute("anchorable", "");
    },
    onAnchorLoaded: async function (event) {
      //console.log("onAnchorLoaded", event);
      await wait(500);
      this.updatePosterPosition();
    },
    onEnterXr: function (event) {
      this.isInXr = true;
    },
    onExitXr: function (event) {
      this.isInXr = true;
    },
  });
}
