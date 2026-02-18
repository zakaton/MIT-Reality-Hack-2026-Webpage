export async function wait(delay) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), delay);
  });
}

/**
 * https://github.com/aframevr/aframe/blob/v1.7.1/src/utils/index.js#L82
 * @param {function} functionToThrottle
 * @param {number} minimumInterval - Minimal interval between calls (milliseconds).
 * @param {object} optionalContext - If given, bind function to throttle to this context.
 * @returns {function} Throttled function.
 */
export function throttleLeadingAndTrailing(
  functionToThrottle,
  minimumInterval,
  optionalContext
) {
  var lastTime;
  var deferTimer;
  if (optionalContext) {
    functionToThrottle = functionToThrottle.bind(optionalContext);
  }
  var args;
  var timerExpired = function () {
    // Reached end of interval, call function
    lastTime = Date.now();
    functionToThrottle.apply(this, args);
    deferTimer = undefined;
  };

  return function () {
    var time = Date.now();
    var sinceLastTime =
      typeof lastTime === "undefined" ? minimumInterval : time - lastTime;
    if (sinceLastTime >= minimumInterval) {
      // Outside of minimum interval, call throttled function.
      // Clear any pending timer as timeout imprecisions could otherwise cause two calls
      // for the same interval.
      clearTimeout(deferTimer);
      deferTimer = undefined;
      lastTime = time;
      functionToThrottle.apply(null, arguments);
    } else {
      // Inside minimum interval, create timer if needed.
      deferTimer =
        deferTimer || setTimeout(timerExpired, minimumInterval - sinceLastTime);
      // Update args for when timer expires.
      args = arguments;
    }
  };
}
