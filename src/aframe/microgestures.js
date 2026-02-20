AFRAME.registerSystem("microgestures", {
  schema: {
    debugSelector: { type: "selector", default: "" },
    showDebug: { type: "boolean", default: false },
    includePinch: { type: "boolean", default: false },
  },
  init() {
    this.debugTextEntity = this.data.debugSelector;
    //console.log("debugTextEntity", this.debugTextEntity);
  },

  onMicrogesture: function ({ hand, label }) {
    if (!this.debugTextEntity) {
      return;
    }
    clearTimeout(this.timeoutId);
    this.debugTextEntity.setAttribute("value", `${hand}-${label}`);
    this.timeoutId = window.setTimeout(() => {
      this.debugTextEntity.setAttribute("value", "");
    }, 1000);
  },
});

AFRAME.registerComponent("microgestures", {
  dependencies: ["hand-tracking-controls"],

  getController: function () {
    return (
      this.el.components["tracked-controls"] &&
      this.el.components["tracked-controls"].controller
    );
  },
  init: function () {
    this.el.sceneEl.addEventListener("enter-vr", this.onEnterXr.bind(this));
    this.el.sceneEl.addEventListener("exit-vr", this.onExitXr.bind(this));
    this.downButtons = [];
    this.hand = this.el.components["hand-tracking-controls"].data.hand;
  },
  microgestureLabels: {
    0: "pinch",
    5: "swipe-left",
    6: "swipe-right",
    7: "swipe-forward",
    8: "swipe-backward",
    9: "thumb-tap",
  },
  tick: function (time, timeDelta) {
    if (!this.isInXr) {
      return;
    }
    const controller = this.getController();
    if (!controller?.gamepad) {
      return;
    }
    /** @type {Gamepad} */
    const gamepad = controller.gamepad;
    gamepad.buttons.forEach((button, index) => {
      if (this.downButtons[index] != button.pressed) {
        this.downButtons[index] = button.pressed;
        const label = this.microgestureLabels[index];
        if (label && button.pressed) {
          if (label == "pinch" && !this.system.data.includePinch) {
            return;
          }
          const detail = {
            label,
            hand: this.hand,
          };
          //console.log(detail);
          this.el.emit("microgesture", detail);
          this.el.emit(`microgesture-${label}`);

          this.el.emit("microgesture", detail);
          this.el.sceneEl.emit(`microgesture-${label}`, detail);
          this.el.sceneEl.emit(`microgesture-${this.hand}`, detail);
          this.el.sceneEl.emit(`microgesture-${this.hand}-${label}`, detail);

          this.system.onMicrogesture(detail);
        }
      }
    });
  },

  onEnterXr: function (event) {
    this.isInXr = true;
  },
  onExitXr: function (event) {
    this.isInXr = true;
  },
});
