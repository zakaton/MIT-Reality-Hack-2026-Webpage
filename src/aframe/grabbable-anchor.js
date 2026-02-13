AFRAME.registerComponent("anchorable", {
  dependencies: ["grabbable"],
  init: function () {
    this.el.addEventListener("loaded", () => {
      this.el.sceneEl.emit("anchorableEntity", this.el);
    });
    this.el.addEventListener("grabstarted", this.onGrabStarted.bind(this));
    this.el.addEventListener("grabended", this.onGrabEnded.bind(this));
  },

  onGrabStarted: function () {},
  onGrabEnded: function () {
    this.el.sceneEl.emit("saveAnchorableTransforms", this.component);
  },
});

AFRAME.registerComponent("grabbable-anchor", {
  schema: {
    localStorageKey: { type: "string", default: "anchorableTransforms" },
    autoUpdate: { type: "boolean", default: true },
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

    this.el.sceneEl.addEventListener("recenter", () => {
      this._loadRelativeTransforms();
    });

    this.el.sceneEl.addEventListener(
      "enter-vr",
      async () => {
        const anchorFound = await this.waitForAnchor();
        console.log({ anchorFound });
        if (anchorFound) {
          this._loadRelativeTransforms();
          this.el.emit("anchorLoaded", {
            anchor: this.el,
            relativeTransforms: this._relativeTransforms,
          });
        }
      },
      { once: !this.data.autoUpdate }
    );
    this.el.sceneEl.addEventListener("exit-vr", (event) => {
      console.log(event);
      if (this.data.autoUpdate) {
        this._saveRelativeTransforms();
      }
    });

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

    window.addEventListener(
      "beforeunload",
      this._saveRelativeTransforms.bind(this)
    );
    this.el.sceneEl.addEventListener(
      "saveAnchorableTransforms",
      this._saveRelativeTransforms.bind(this)
    );
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
    if (!this.el.components["anchored"]?.anchor) {
      return;
    }

    //console.log("saveRelativeTransforms");

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
    //console.log("loadRelativeTransforms");

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
      this._updateAnchorableEntities();
    } catch (error) {
      console.error("error parsing petTransform", error);
    }
  },
  _updateAnchorableEntities: function () {
    this._getAnchorableEntities().forEach((entity) => {
      this._updateAnchorableEntity(entity);
    });
  },

  _updateAnchorableEntity: function (entity) {
    if (!this._relativeTransforms?.[entity.id]) {
      //console.log(`no relativeTransform found for anchorableEntity "${entity.id}"`);
      return;
    }

    const relativeTransform = this._relativeTransforms[entity.id];
    const { position, euler, quaternion } = relativeTransform;
    //console.log(`_updateAnchorableEntity "${entity.id}"`, position, euler);
    const { object3D } = entity;
    object3D.position.copy(position);
    object3D.rotation.copy(euler);
    entity.emit("anchored", { relativeTransform });
  },
  clear: function () {
    localStorage.removeItem(this.data.localStorageKey);
  },
  // END TRANSFORMS
});
