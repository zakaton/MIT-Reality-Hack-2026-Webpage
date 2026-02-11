/** @typedef {import("socket.io-client") io} */
/** @typedef {import("socket.io-client").Socket} Socket */

/** @type {io} */
const ioClient = window.io;
const { io } = ioClient;

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
 * @typedef { ConnectionStatus |
 * "isConnected"
 * } EventType
 */

/**
 * @typedef { ConnectedEvent |
 * DisconnectedEvent |
 * IsConnectedEvent
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
  /**
   * @param {EventType} type
   */
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
  /**
   * @param {EventType} type
   */
  #dispatchEventListener(type, detail) {
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

    this.#dispatchEventListener("connectionStatus", {
      connectionStatus: this.connectionStatus,
    });
    this.#dispatchEventListener(this.connectionStatus);

    switch (this.#connectionStatus) {
      case "not connected":
      case "connected":
        this.#dispatchEventListener("isConnected", {
          isConnected: this.isConnected,
        });
        break;
    }
  }
  // CONNECTION STATUS END

  // CONNECTION START
  /** @param {string} address */
  async connect(address) {
    await this.disconnect();
    this.#setConnectionStatus("connecting");
    this.#socket = io(address);
    this.#socket.on("connect", this.#onConnect.bind(this));
    this.#socket.on("disconnect", this.#onDisconnect.bind(this));
  }
  async disconnect() {
    if (!this.isConnected) {
      return;
    }
    this.#setConnectionStatus("disconnecting");
    this.#socket.disconnect();
  }
  /** @param {string?} address */
  async toggleConnection(address) {
    if (this.isConnected) {
      await this.disconnect();
    } else {
      await this.connect(address);
    }
  }
  // CONNECTION END

  // CONNECTION LISTENERS START
  #onConnect() {
    const { secure, hostname, path, port } = this.#socket.l;

    const address = `${secure ? "https" : "http"}://${hostname}:${port}`;

    this.#address = address;

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
}

export default UnoQ;
