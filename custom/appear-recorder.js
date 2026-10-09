/* Records the entrance ("appear") animations Framer starts while the loader
   is covering the page, so loader.js can replay them when it lifts. Inlined
   by tools/build.js right before Framer's appear script, after `animator`
   is defined. Framer creates the real animations a frame later and hands
   each one to an optional callback, which is where they are recorded.
   Framer's own animations are left untouched. */
(function () {
  'use strict';
  if (typeof animator === 'undefined' || !animator.startOptimizedAppearAnimation) return;
  var records = (window.__wlAppearRecords = []);
  var start = animator.startOptimizedAppearAnimation;
  animator.startOptimizedAppearAnimation = function (el, name, keyframes, options, onStart) {
    return start.call(this, el, name, keyframes, options, function (animation) {
      try {
        var timing = animation.effect.getTiming();
        records.push({
          el: el,
          keyframes: animation.effect.getKeyframes().map(function (k) {
            var copy = {};
            for (var p in k) if (p !== 'computedOffset' && p !== 'composite') copy[p] = k[p];
            return copy;
          }),
          duration: timing.duration,
          delay: timing.delay,
          easing: timing.easing,
        });
      } catch (e) {
        /* recording is best effort */
      }
      if (onStart) onStart(animation);
    });
  };
})();
