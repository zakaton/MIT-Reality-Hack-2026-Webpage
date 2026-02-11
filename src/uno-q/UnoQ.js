/** @typedef {import("socket.io-client") io} */
/** @typedef {import("socket.io-client").Socket} Socket */

/** @type {io} */
const ioClient = window.io;
const { io } = ioClient;

/** @typedef {"servo" | "stepper"} AngleType */
/** @typedef {Record<AngleType, number[]>} Angles */

/** @typedef {"not connected" | "connecting" | "connected" | "disconnecting"} ConnectionStatus */

/**
 * @typedef {Object} CallbackOptions
 * @property {Boolean} once
 */

/**
 * @typedef {Object} BaseEvent
 * @property {string} type
 * @property {UnoQ} target
 */

/**
 * @typedef {BaseEvent & {
 *   type: "connected"
 * }} ConnectedEvent
 */
/**
 * @callback OnConnectedCallback
 * @param {ConnectedEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "disconnected"
 * }} DisconnectedEvent
 */
/**
 * @callback OnDisconnectedCallback
 * @param {DisconnectedEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "isConnected",
 *   detail: {isConnected: Boolean}
 * }} IsConnectedEvent
 */
/**
 * @callback OnIsConnectedCallback
 * @param {IsConnectedEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "connectionStatus",
 *   detail: {connectionStatus: ConnectionStatus}
 * }} ConnectionStatusEvent
 */
/**
 * @callback OnConnectionStatusCallback
 * @param {ConnectionStatusEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "broadcast",
 *   detail: {message: Object}
 * }} BroadcastEvent
 */
/**
 * @callback OnBroadcastCallback
 * @param {BroadcastEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "state",
 *   detail: {state: Object, diffKeys: string[]}
 * }} StateEvent
 */
/**
 * @callback OnStateCallback
 * @param {StateEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "angles",
 *   detail: {angles: Angles}
 * }} AnglesEvent
 */
/**
 * @callback OnAnglesCallback
 * @param {AnglesEvent} event
 */

/**
 * @typedef { ConnectionStatus |
 * "isConnected" |
 * "broadcast" |
 * "state" |
 * "angles"
 * } EventType
 */

/**
 * @typedef { ConnectedEvent |
 * DisconnectedEvent |
 * IsConnectedEvent |
 * BroadcastEvent |
 * StateEvent |
 * AnglesEvent
 * } Event
 */

class UnoQ {
  // EVENT LISTENERS START
  #eventListeners = {};

  /**
   * @param {EventType} type
   * @param {CallbackOptions} options
   */
  #addEventListener(type, callback, options = {}) {
    this.#eventListeners[type] = this.#eventListeners[type] ?? [];
    this.#eventListeners[type].push({ callback, options });
  }
  /** @param {EventType} type */
  #removeEventListener(type, callback) {
    const eventListeners = this.#eventListeners[type];
    if (!eventListeners) {
      return;
    }
    const index = eventListeners.findIndex(
      (eventListener) => eventListener.callback == eventListener.callback
    );
    if (index == -1) {
      return;
    }
    eventListeners.splice(index, 1);
  }
  /** @param {EventType} type */
  #dispatchEvent(type, detail) {
    const eventListeners = this.#eventListeners[type];
    if (!eventListeners) {
      return;
    }
    this.#eventListeners[type] = eventListeners.filter(
      ({ callback, options }) => {
        callback({ type, target: this, detail });
        if (options.once) {
          return false;
        }
        return true;
      }
    );
  }
  /** @param {EventType} type */
  async waitForEvent(type) {
    return new Promise((resolve) => {
      const onceListener = (event) => {
        resolve(event);
      };
      this.#addEventListener(type, onceListener, { once: true });
    });
  }
  // EVENT LISTENERS END

  // SOCKET START
  /** @type {Socket?} */
  #socket;
  #address;
  get address() {
    return this.#address;
  }
  // SOCKET END

  // CONNECTION STATUS START
  get isConnected() {
    return this.#socket?.connected;
  }

  /** @type {ConnectionStatus} */
  #connectionStatus = "not connected";
  get connectionStatus() {
    return this.#connectionStatus;
  }
  /** @param {ConnectionStatus} newConnectionStatus */
  #setConnectionStatus(newConnectionStatus) {
    if (newConnectionStatus == this.#connectionStatus) {
      return;
    }
    this.#connectionStatus = newConnectionStatus;
    //console.log({ connectionStatus: newConnectionStatus });

    this.#dispatchEvent("connectionStatus", {
      connectionStatus: this.connectionStatus,
    });
    this.#dispatchEvent(this.connectionStatus);

    switch (this.#connectionStatus) {
      case "not connected":
      case "connected":
        this.#dispatchEvent("isConnected", {
          isConnected: this.isConnected,
        });
        break;
    }
  }
  // CONNECTION STATUS END

  // CONNECTION START
  /** @param {string} address */
  async connect(address) {
    address = address ?? this.address;
    await this.disconnect();
    this.#setConnectionStatus("connecting");
    const promise = this.waitForEvent("connected");
    this.#socket = io(address);
    this.#socket.on("connect", this.#onConnect.bind(this));
    this.#socket.on("disconnect", this.#onDisconnect.bind(this));
    this.#socket.on("broadcast", this.#onBroadcast.bind(this));
    this.#socket.on("state", this.#onState.bind(this));
    this.#socket.on("stateDiff", this.#onStateDiff.bind(this));
    this.#socket.on("angles", this.#onAngles.bind(this));
    await promise;
  }
  async disconnect() {
    if (this.#connectionStatus == "connecting") {
      this.#setConnectionStatus("disconnecting");
      this.#socket.disconnect();
      this.#setConnectionStatus("not connected");
      return;
    }

    if (!this.isConnected) {
      return;
    }
    const promise = this.waitForEvent("not connected");
    this.#socket.disconnect();
    await promise;
  }
  /** @param {string?} address */
  async toggleConnection(address) {
    if (this.isConnected || this.connectionStatus == "connecting") {
      await this.disconnect();
    } else {
      await this.connect(address);
    }
  }
  // CONNECTION END

  // CONNECTION LISTENERS START
  async #onConnect() {
    const { secure, hostname, path, port } = this.#socket.l;
    const address = `${secure ? "https" : "http"}://${hostname}:${port}`;
    this.#address = address;

    await this.#getState();
    await this.#getAngles();

    this.#setConnectionStatus("connected");
  }
  #onDisconnect() {
    this.#setConnectionStatus("not connected");
  }

  /**
   * @param {OnConnectedCallback} callback
   * @param {CallbackOptions} options
   */
  onConnected(callback, options) {
    this.#addEventListener("connected", callback, options);
  }
  /**
   * @param {OnConnectedCallback} callback
   * @param {CallbackOptions} options
   */
  offConnected(callback, options) {
    this.#removeEventListener("connected", callback, options);
  }

  /**
   * @param {OnDisconnectedCallback} callback
   * @param {CallbackOptions} options
   */
  onDisconnected(callback, options) {
    this.#addEventListener("disconnected", callback, options);
  }
  /**
   * @param {OnDisconnectedCallback} callback
   * @param {CallbackOptions} options
   */
  offDisconnected(callback, options) {
    this.#removeEventListener("disconnected", callback, options);
  }

  /**
   * @param {OnIsConnectedCallback} callback
   * @param {CallbackOptions} options
   */
  onIsConnected(callback, options) {
    this.#addEventListener("isConnected", callback, options);
  }
  /**
   * @param {OnIsConnectedCallback} callback
   * @param {CallbackOptions} options
   */
  offIsConnected(callback) {
    this.#removeEventListener("isConnected", callback, options);
  }

  /**
   * @param {OnConnectionStatusCallback} callback
   * @param {CallbackOptions} options
   */
  onConnectionStatus(callback, options) {
    this.#addEventListener("connectionStatus", callback, options);
  }
  /**
   * @param {OnConnectionStatusCallback} callback
   * @param {CallbackOptions} options
   */
  offConnectionStatus(callback) {
    this.#removeEventListener("connectionStatus", callback, options);
  }
  // CONNECTION LISTENERS END

  // BROADCAST START
  broadcast(message) {
    if (!this.isConnected) {
      return;
    }
    this.#socket.emit("broadcast", message);
  }
  #onBroadcast(message) {
    //console.log("#onBroadcast", message);
    this.#dispatchEvent("broadcast", { message });
  }

  /**
   * @param {OnBroadcastCallback} callback
   * @param {CallbackOptions} options
   */
  onBroadcast(callback, options) {
    this.#addEventListener("broadcast", callback, options);
  }
  /**
   * @param {OnBroadcastCallback} callback
   * @param {CallbackOptions} options
   */
  offBroadcast(callback) {
    this.#removeEventListener("broadcast", callback, options);
  }
  // BROADCAST END

  // STATE START
  #state;
  #onState(state) {
    this.#state = state;
    //console.log("state", this.state);
    this.#dispatchEvent("state", {
      state: this.state,
      diffKeys: Object.keys(state),
    });
  }
  get state() {
    return this.#state;
  }
  async #getState() {
    if (!this.isConnected) {
      return;
    }
    const promise = this.waitForEvent("state");
    this.#socket.emit("getState", {});
    await promise;
  }
  async setState(newState) {
    if (!this.isConnected) {
      return;
    }
    const promise = this.waitForEvent("state");
    this.#socket.emit("setState", newState);
    await promise;
  }

  #onStateDiff(stateDiff) {
    this.#state = Object.assign({}, this.state, stateDiff);
    this.#dispatchEvent("state", {
      state: this.state,
      diffKeys: Object.keys(stateDiff),
    });
  }
  async updateState(stateDiff) {
    if (!this.isConnected) {
      return;
    }
    const promise = this.waitForEvent("state");
    this.#socket.emit("updateState", stateDiff);
    await promise;
  }

  /**
   * @param {OnStateCallback} callback
   * @param {CallbackOptions} options
   */
  onState(callback, options) {
    this.#addEventListener("state", callback, options);
  }
  /**
   * @param {OnStateCallback} callback
   * @param {CallbackOptions} options
   */
  offState(callback) {
    this.#removeEventListener("state", callback, options);
  }
  // STATE END

  // ANGLES START
  /** @type {Angles} */
  #angles = {
    servo: [],
    stepper: [],
  };
  get angles() {
    return this.#angles;
  }
  #onAngles(angles) {
    Object.assign(this.#angles, angles);
    this.#dispatchEvent("angles", { angles: this.angles });
  }
  async #getAngles() {
    if (!this.isConnected) {
      return;
    }
    const promise = this.waitForEvent("angles");
    this.#socket.emit("getAngles", {});
    await promise;
  }
  /**
   * @param {AngleType} type
   * @param {number} index
   * @param {number} angle
   */
  async setAngle(type, index, angle) {
    if (!this.isConnected) {
      return;
    }
    console.log({ type, index, angle });
    const promise = this.waitForEvent("angles");
    this.#socket.emit("setAngle", { type, index, angle });
    await promise;
  }
  /** @param {Angles} angles */
  async setAngles(angles) {
    if (!this.isConnected) {
      return;
    }
    const promise = this.waitForEvent("angles");
    this.#socket.emit("setAngles", angles);
    await promise;
  }

  /**
   * @param {OnAnglesCallback} callback
   * @param {CallbackOptions} options
   */
  onAngles(callback, options) {
    this.#addEventListener("angles", callback, options);
  }
  /**
   * @param {OnAnglesCallback} callback
   * @param {CallbackOptions} options
   */
  offAngles(callback) {
    this.#removeEventListener("angles", callback, options);
  }
  // ANGLES END
}

export default UnoQ;
