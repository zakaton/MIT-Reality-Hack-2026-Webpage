AFRAME.registerComponent("anchorable", {
  dependencies: ["grabbable"],
  init: function () {
    this.el.addEventListener("loaded", () => {
      this.el.sceneEl.emit("anchorableEntity", this.el);
    });
  },
});

AFRAME.registerComponent("grabbable-anchor", {
  schema: {
    localStorageKey: { type: "string", default: "anchorableTransforms" },
  },
  dependencies: ["anchored", "grabbable"],

  waitForAnchor: async function () {
    if (this.el.components["anchored"]?.anchor) {
      return true;
    }

    return new Promise((resolve) => {
      let intervalId, timeoutId;
      intervalId = setInterval(() => {
        if (this.el.components["anchored"]?.anchor) {
          clearTimeout(timeoutId);
          clearInterval(intervalId);
          resolve(true);
        }
      }, 200);

      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        resolve(false);
      }, 3000);
    });
  },

  init: function () {
    this.el.sceneEl.addEventListener("anchorableEntity", (event) => {
      this._updateAnchorableEntity(event.detail);
    });

    this.el.sceneEl.addEventListener(
      "enter-vr",
      async () => {
        const anchorFound = await this.waitForAnchor();
        console.log({ anchorFound });
        if (anchorFound) {
          this._loadRelativeTransforms();
        }
      },
      { once: true }
    );
    this.el.sceneEl.addEventListener("enter-vr", async () => {
      anchor.setAttribute("visible", "true");
    });
    this.el.sceneEl.addEventListener("exit-vr", async () => {
      anchor.setAttribute("visible", "false");
    });

    this.el.addEventListener("grabstarted", () => {
      this.el.removeAttribute("anchored");
    });

    this.el.addEventListener("grabended", () => {
      this.el.setAttribute("anchored", "persistent: true;");
      this.shouldCreateAnchor = true;
    });

    window.addEventListener("beforeunload", this._onBeforeUnload.bind(this));
  },

  deleteAnchor: async function () {
    this.isDeletingAnchor = true;
    const uuid = localStorage.getItem(this.el.id);
    if (uuid) {
      const frame = this.el.sceneEl.renderer.xr.getFrame();
      console.log("removing persistant anchor");
      try {
        await frame.session.deletePersistentAnchor(uuid);
      } catch (e) {
        console.error(e);
      }
      localStorage.removeItem(this.el.id);
    }
    this.isDeletingAnchor = false;
  },

  tick: function () {
    if (
      this.shouldCreateAnchor &&
      this.el.components["anchored"]?.createAnchor
    ) {
      this.deleteAnchor();
      if (this.isDeletingAnchor) {
        return;
      }
      this.shouldCreateAnchor = false;
      const position = new THREE.Vector3();
      this.el.object3D.getWorldPosition(position);
      const quaternion = new THREE.Quaternion();
      this.el.object3D.getWorldQuaternion(quaternion);
      this.el.components["anchored"].createAnchor(position, quaternion);
    }
  },

  // TRANSFORMS START
  _getRelativeTransform: function (object3D) {
    const relativeMatrix = new THREE.Matrix4();
    const inverseRelativeMatrix = new THREE.Matrix4()
      .copy(this.el.object3D.matrixWorld)
      .invert();

    const relativePosition = new THREE.Vector3();
    const relativeQuaternion = new THREE.Quaternion();
    const relativeScale = new THREE.Vector3();

    relativeMatrix.multiplyMatrices(
      inverseRelativeMatrix,
      object3D.matrixWorld
    );

    relativeMatrix.decompose(
      relativePosition,
      relativeQuaternion,
      relativeScale
    );

    const transform = {
      position: relativePosition,
      quaternion: relativeQuaternion,
      scale: relativeScale,
    };

    return transform;
  },
  _parseRelativeTransforms: function (relativeTransformsString) {
    const relativePosition = new THREE.Vector3();
    const relativeQuaternion = new THREE.Quaternion();
    const relativeScale = new THREE.Vector3();

    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();

    const localMatrix = new THREE.Matrix4();
    const referenceMatrix = new THREE.Matrix4().copy(
      this.el.object3D.matrixWorld
    );
    const worldMatrix = new THREE.Matrix4();

    const parsedRelativeTransforms = JSON.parse(relativeTransformsString);
    // console.log("parsedRelativeTransforms", parsedRelativeTransforms);

    const relativeTransforms = {};
    Object.entries(parsedRelativeTransforms).forEach(
      ([id, parsedRelativeTransform]) => {
        const {
          position: positionArray,
          quaternion: quaternionArray,
          scale: scaleArray,
        } = parsedRelativeTransform;

        relativePosition.set(...positionArray);
        relativeQuaternion.set(...quaternionArray);
        relativeScale.set(...scaleArray);

        localMatrix.compose(
          relativePosition,
          relativeQuaternion,
          relativeScale
        );
        worldMatrix.multiplyMatrices(referenceMatrix, localMatrix);
        worldMatrix.decompose(worldPosition, worldQuaternion, worldScale);

        const worldEuler = new THREE.Euler().setFromQuaternion(worldQuaternion);

        const relativeTransform = {
          position: worldPosition.clone(),
          quaternion: worldQuaternion.clone(),
          scale: worldScale.clone(),
          euler: worldEuler.clone(),
        };
        //console.log(`relativeTransform for "${id}"`, relativeTransform);
        relativeTransforms[id] = relativeTransform;
      }
    );
    //console.log("relativeTransforms", relativeTransforms);
    return relativeTransforms;
  },
  _getAnchorableEntities: function () {
    return Array.from(this.el.sceneEl.querySelectorAll("[anchorable]")).filter(
      (entity) => entity.id
    );
  },
  _saveRelativeTransforms: function () {
    console.log("saveRelativeTransforms");

    const relativeTransforms = {};

    this._getAnchorableEntities().forEach((entity) => {
      const { position, scale, quaternion } = this._getRelativeTransform(
        entity.object3D
      );

      const relativeTransform = {
        position: position.toArray(),
        quaternion: quaternion.toArray(),
        scale: scale.toArray(),
      };

      //console.log(`relativeTransform for "${entity.id}"`, position, quaternion);

      relativeTransforms[entity.id] = relativeTransform;
    });

    //console.log("relativeTransforms", relativeTransforms);
    localStorage.setItem(
      this.data.localStorageKey,
      JSON.stringify(relativeTransforms)
    );
  },
  _loadRelativeTransforms: function () {
    console.log("loadRelativeTransforms");

    const relativeTransformsString = localStorage.getItem(
      this.data.localStorageKey
    );
    //console.log({ relativeTransformsString });
    if (!relativeTransformsString) {
      return;
    }

    try {
      this._relativeTransforms = this._parseRelativeTransforms(
        relativeTransformsString
      );
      this._getAnchorableEntities().forEach((entity) => {
        this._updateAnchorableEntity(entity);
      });
    } catch (error) {
      console.error("error parsing petTransform", error);
    }
  },
  _onBeforeUnload: function () {
    this._saveRelativeTransforms();
  },
  _updateAnchorableEntity: function (entity) {
    if (!this._relativeTransforms?.[entity.id]) {
      //console.log(`no relativeTransform found for anchorableEntity "${entity.id}"`);
      return;
    }
    const { position, euler, quaternion } = this._relativeTransforms[entity.id];
    //console.log(`_updateAnchorableEntity "${entity.id}"`, position, euler);
    const { object3D } = entity;
    object3D.position.copy(position);
    object3D.rotation.copy(euler);
  },
  clear: function () {
    localStorage.removeItem(this.data.localStorageKey);
  },
  // END TRANSFORMS
});
