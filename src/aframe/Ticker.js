{
  /** @type {import("three")} */
  const THREE = window.THREE;

  class Ticker {
    #duration = 0;
    get duration() {
      return this.#duration;
    }

    #startTime = 0;
    #currentTime = 0;
    #timeOffset = 0;
    wait(duration) {
      this.#startTime = this.#currentTime;
      this.#duration = duration;
    }

    get randomInterpolation() {
      return this.#randomInterpolation;
    }
    #randomInterpolation = 0;
    waitRandom(from, to) {
      this.#randomInterpolation = Math.random();
      this.wait(THREE.MathUtils.lerp(from, to, this.#randomInterpolation));
    }

    #timeInterpolation = -1;
    get timeInterpolation() {
      return this.#timeInterpolation;
    }
    get isDone() {
      return this.#timeInterpolation == -1 || this.#timeInterpolation >= 1;
    }

    tick(time = AFRAME.scenes[0].time) {
      this.#currentTime = time;
      this.#timeOffset = this.#currentTime - this.#startTime;
      this.#timeInterpolation = this.#timeOffset / this.#duration;
      return this.isDone;
    }

    stop() {
      this.#timeInterpolation = -1;
    }
  }

  window.Ticker = Ticker;
}
