/** @typedef {import("socket.io-client") io} */
/** @typedef {import("socket.io-client").Socket} Socket */

import { throttleLeadingAndTrailing, clamp } from "../utils/helpers.js";

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
 * @typedef {BaseEvent & {
 *   type: "clientJoin",
 *   detail: {client: string}
 * }} ClientJoinEvent
 */
/**
 * @callback OnClientJoinCallback
 * @param {ClientJoinEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "clientExit",
 *   detail: {client: string}
 * }} ClientExitEvent
 */
/**
 * @callback OnClientExitCallback
 * @param {ClientExitEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "clients",
 *   detail: {clients: string[]}
 * }} ClientsEvent
 */
/**
 * @callback OnClientsCallback
 * @param {ClientsEvent} event
 */

/**
 * @typedef {BaseEvent & {
 *   type: "clientState",
 *   detail: {client: string, clientState: any}
 * }} ClientStateEvent
 */
/**
 * @callback OnClientStateCallback
 * @param {ClientStateEvent} event
 */

/**
 * @typedef { ConnectionStatus |
 * "isConnected" |
 * "broadcast" |
 * "state" |
 * "angles" |
 * "clientJoin" |
 * "clientExit" |
 * "clients" |
 * "clientState"
 * } EventType
 */

/**
 * @typedef { ConnectedEvent |
 * DisconnectedEvent |
 * IsConnectedEvent |
 * BroadcastEvent |
 * StateEvent |
 * AnglesEvent |
 * ClientJoinEvent |
 * ClientExitEvent |
 * ClientsEvent |
 * ClientStateEvent
 * } Event
 */

const throttleInterval = 50;

class UnoQ {
  constructor() {
    this.setAngles = throttleLeadingAndTrailing(
      this.setAngles.bind(this),
      throttleInterval
    );
  }

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

  // CLIENT START
  get id() {
    return this.#socket?.id;
  }
  #clients = [];
  get clients() {
    return this.#clients;
  }
  #onClients(clients) {
    this.#clients.length = 0;
    this.#clients.push(...clients);
    // console.log("clients", this.clients);
    this.#dispatchEvent("clients", { clients });
  }
  async #getClients() {
    if (!this.isConnected) {
      return;
    }
    const promise = this.waitForEvent("clients");
    this.#socket.emit("getClients", {});
    await promise;
  }

  #onClientJoin({ client }) {
    //console.log("onClientJoin", { client });
    if (this.#clients.includes(client)) {
      return;
    }
    this.#clients.push(client);
    this.#dispatchEvent("clientJoin", { client });
  }
  #onClientExit({ client }) {
    //console.log("onClientExit", { client });
    if (!this.#clients.includes(client)) {
      return;
    }
    this.#clients.splice(this.#clients.indexOf(client), 1);
    this.#dispatchEvent("clientExit", { client });
  }

  /**
   * @param {OnClientsCallback} callback
   * @param {CallbackOptions} options
   */
  onClients(callback, options) {
    this.#addEventListener("clients", callback, options);
  }
  /** @param {OnClientsCallback} callback */
  offClients(callback) {
    this.#removeEventListener("clients", callback);
  }

  /**
   * @param {OnClientJoinCallback} callback
   * @param {CallbackOptions} options
   */
  onClientJoin(callback, options) {
    this.#addEventListener("clientJoin", callback, options);
  }
  /** @param {OnClientJoinCallback} callback  */
  offClientJoin(callback) {
    this.#removeEventListener("clientJoin", callback);
  }

  /**
   * @param {OnClientExitCallback} callback
   * @param {CallbackOptions} options
   */
  onClientExit(callback, options) {
    this.#addEventListener("clientExit", callback, options);
  }
  /** @param {OnClientExitCallback} callback */
  offClientExit(callback) {
    this.#removeEventListener("clientExit", callback);
  }

  /**
   * @param {OnClientStateCallback} callback
   * @param {CallbackOptions} options
   */
  onClientState(callback, options) {
    this.#addEventListener("clientState", callback, options);
  }
  /** @param {OnClientStateCallback} callback */
  offClientState(callback) {
    this.#removeEventListener("clientState", callback);
  }
  // CLIENT END

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
    this.#socket.on("clientJoin", this.#onClientJoin.bind(this));
    this.#socket.on("clientExit", this.#onClientExit.bind(this));
    this.#socket.on("clients", this.#onClients.bind(this));
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

    await this.#getClients();
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
  /** @param {OnConnectedCallback} callback */
  offConnected(callback) {
    this.#removeEventListener("connected", callback);
  }

  /**
   * @param {OnDisconnectedCallback} callback
   * @param {CallbackOptions} options
   */
  onDisconnected(callback, options) {
    this.#addEventListener("disconnected", callback, options);
  }
  /** @param {OnDisconnectedCallback} callback */
  offDisconnected(callback) {
    this.#removeEventListener("disconnected", callback);
  }

  /**
   * @param {OnIsConnectedCallback} callback
   * @param {CallbackOptions} options
   */
  onIsConnected(callback, options) {
    this.#addEventListener("isConnected", callback, options);
  }
  /** @param {OnIsConnectedCallback} callback */
  offIsConnected(callback) {
    this.#removeEventListener("isConnected", callback);
  }

  /**
   * @param {OnConnectionStatusCallback} callback
   * @param {CallbackOptions} options
   */
  onConnectionStatus(callback, options) {
    this.#addEventListener("connectionStatus", callback, options);
  }
  /** @param {OnConnectionStatusCallback} callback */
  offConnectionStatus(callback) {
    this.#removeEventListener("connectionStatus", callback);
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
  /** @param {OnBroadcastCallback} callback */
  offBroadcast(callback) {
    this.#removeEventListener("broadcast", callback);
  }
  // BROADCAST END

  // STATE START
  #state;
  #onState(state) {
    this.#state = state;
    const diffKeys = Object.keys(state);
    //console.log("state", this.state);
    this.#dispatchEvent("state", {
      state: this.state,
      diffKeys,
    });
    diffKeys.forEach((diffKey) => {
      if (this.clients.includes(diffKey)) {
        this.#dispatchEvent("clientState", {
          client: diffKey,
          clientState: this.state[diffKey],
        });
      }
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
  setState(newState) {
    if (!this.isConnected) {
      return;
    }
    this.#socket.emit("setState", newState);
  }
  setClientState(newState, client = this.id) {
    if (!this.clients.includes(client)) {
      console.error(`client "${client}" not found`);
      return;
    }
    this.setState({ [client]: newState });
  }

  #onStateDiff(stateDiff) {
    const diffKeys = Object.keys(stateDiff);
    diffKeys.forEach((key) => {
      if (stateDiff[key] == null) {
        delete stateDiff[key];
        delete this.state?.[key];
      }
    });
    this.#state = Object.assign({}, this.state, stateDiff);
    this.#dispatchEvent("state", {
      state: this.state,
      diffKeys,
    });

    diffKeys.forEach((diffKey) => {
      if (this.clients.includes(diffKey)) {
        this.#dispatchEvent("clientState", {
          client: diffKey,
          clientState: this.state[diffKey],
        });
      }
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
  /** @param {OnStateCallback} callback */
  offState(callback) {
    this.#removeEventListener("state", callback);
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
  async #setAngle(type, index, angle) {
    if (!this.isConnected) {
      return;
    }
    angle = this.#sanitizeAngle(type, index, angle);
    //console.log({ type, index, angle });
    const promise = this.waitForEvent("angles");
    this.#socket.emit("setAngle", { type, index, angle });
    await promise;
  }
  #throttledSetAngleFunctions = {};
  /**
   * @param {AngleType} type
   * @param {number} index
   * @param {number} angle
   * @param {boolean} isOffset
   */
  async setAngle(type, index, angle, isOffset) {
    if (this.angles[type]?.[index] == angle) {
      return;
    }
    if (isOffset) {
      angle = this.angles[type][index] + angle;
    }
    angle = Math.round(angle);
    const key = [type, index].join(".");
    if (!this.#throttledSetAngleFunctions[key]) {
      this.#throttledSetAngleFunctions[key] = throttleLeadingAndTrailing(
        this.#setAngle.bind(this),
        throttleInterval
      );
    }
    await this.#throttledSetAngleFunctions[key](type, index, angle);
  }
  /**
   *
   * @param {AngleType} type
   * @param {number} index
   * @param {number} angle
   */
  #sanitizeAngle(type, index, angle) {
    if (isNaN(angle)) {
      return undefined;
    }
    switch (type) {
      case "servo":
        angle = clamp(angle, 0, 160);
        break;
      case "stepper":
        break;
    }
    return Math.round(angle);
  }
  /** @param {Angles} angles */
  async setAngles(angles) {
    if (!this.isConnected) {
      return;
    }
    const promise = this.waitForEvent("angles");
    Object.entries(angles).forEach(([type, angles]) => {
      angles.forEach((angle, index) => {
        angles[index] = this.#sanitizeAngle(type, index, angle);
      });
    });
    //console.log("setAngles", angles);
    this.#socket.emit("setAngles", angles);
    await promise;
  }

  /**
   * @param {AngleType} type
   * @param {number} index
   */
  async tareAngle(type, index = 0) {
    if (this.angles[type]?.[index] == 0) {
      return;
    }
    const promise = this.waitForEvent("angles");
    this.#socket.emit("tareAngle", { type, index });
    await promise;
  }

  /**
   * @param {OnAnglesCallback} callback
   * @param {CallbackOptions} options
   */
  onAngles(callback, options) {
    this.#addEventListener("angles", callback, options);
  }
  /** @param {OnAnglesCallback} callback */
  offAngles(callback) {
    this.#removeEventListener("angles", callback);
  }
  // ANGLES END
}

export default UnoQ;
