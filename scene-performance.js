(() => {
  'use strict';
  const mobile = matchMedia('(pointer: coarse)').matches;
  const lowPower = mobile && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2);
  function createClock() {
    let previous = null;
    let next = 0;
    let interval = 1000 / (lowPower ? 30 : 60);
    let workStarted = 0;
    let slowFrames = 0;
    return {
      take(timestamp, force = false) {
        if (!force && previous !== null && timestamp < next - .5) return 0;
        const delta = previous === null ? 1000 / 60 : Math.min(1000 / 15, timestamp - previous);
        next = force || previous === null || timestamp - next > interval ? timestamp + interval : next + interval;
        previous = timestamp;
        workStarted = performance.now();
        return delta;
      },
      finish() {
        if (!mobile || interval > 30) return;
        slowFrames = performance.now() - workStarted > 18 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (slowFrames >= 12) { interval = 1000 / 30; next = previous + interval; }
      },
      reset() { previous = null; next = 0; }
    };
  }
  window.FlowerPerformance = Object.freeze({
    mobile, lowPower,
    pixelRatio(limit = 2.5) { return Math.min(devicePixelRatio || 1, mobile ? (lowPower ? 1.25 : 1.5) : limit); },
    createClock
  });
})();
