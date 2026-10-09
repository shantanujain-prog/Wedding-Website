/* Wedding loader (0-100% until the page has fully loaded) and background
   music with a mute button. Inlined right after <body> by tools/build.js,
   which also fills in the URLs of the two song files.

   Browsers refuse to start audio until the visitor has interacted with the
   page. So at 100% the loader first tries to start the song: if the browser
   allows it, the site opens with the music playing; if not, the loader shows
   an "Open Invitation" button, and that tap opens the site and starts the
   song together. */
(function () {
  'use strict';
  var d = document;
  var w = window;
  var root = d.documentElement;
  var loader = d.getElementById('wl-loader');
  if (!loader) return;

  // ---------------------------------------------------------------- loader

  var ring = d.getElementById('wl-progress');
  var label = d.getElementById('wl-percent-value');
  var caption = d.getElementById('wl-caption');
  var openButton = d.getElementById('wl-open');
  var CIRC = 2 * Math.PI * 34;
  var MIN_MS = 1600; // the counter never runs 0 -> 100 faster than this
  var MAX_MS = 30000; // give up waiting for stragglers after this
  var AUTOPLAY_WAIT_MS = 2500; // how long to wait for the browser's autoplay answer
  var t0 = performance.now();
  var last = t0;
  var shown = 0;
  var target = 0;
  var images = null;
  var loaded = d.readyState === 'complete';
  var fontsReady = false;
  var readied = false;
  var gateOpen = false;
  var finished = false;

  root.classList.add('wl-loading');

  // No scrolling while the loader is up (the smooth-scroll component listens
  // to wheel/touch events, so stop them before they reach it).
  function blockScroll(e) {
    if (!finished) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  function onKey(e) {
    if (finished) return;
    if (gateOpen && (e.key === 'Enter' || e.key === ' ')) {
      blockScroll(e);
      open();
    } else if (/^( |PageUp|PageDown|ArrowUp|ArrowDown|Home|End)$/.test(e.key)) {
      blockScroll(e);
    }
  }
  w.addEventListener('wheel', blockScroll, { capture: true, passive: false });
  w.addEventListener('touchmove', blockScroll, { capture: true, passive: false });
  w.addEventListener('keydown', onKey, true);

  function collectImages() {
    images = Array.prototype.filter.call(d.images, function (img) {
      return img.loading !== 'lazy' || img.complete;
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', collectImages);
  else collectImages();

  function onLoad() {
    loaded = true;
    if (!images) collectImages();
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(function () {
      fontsReady = true;
    });
  }
  if (loaded) onLoad();
  else w.addEventListener('load', onLoad);

  // Progress: 0-30% while the page itself is parsed, 30-95% as its images
  // arrive, 100% once the load event has fired and the fonts are ready. A
  // slow climb towards 90% keeps the counter moving on slow connections.
  function measure(now) {
    if (loaded && fontsReady) return 100;
    if (now - t0 > MAX_MS) return 100;
    var creep = 90 * (1 - Math.exp(-(now - t0) / 6000));
    if (!images) return Math.max(creep, 30 * (1 - Math.exp(-(now - t0) / 1500)));
    var done = 0;
    for (var i = 0; i < images.length; i++) if (images[i].complete) done++;
    var p = Math.max(creep, 30 + 65 * (images.length ? done / images.length : 1));
    return Math.min(loaded ? Math.max(p, 96) : p, 98);
  }

  function render(p) {
    var v = Math.floor(p);
    ring.style.strokeDashoffset = String(CIRC * (1 - p / 100));
    if (label.textContent !== String(v)) {
      label.textContent = String(v);
      loader.setAttribute('aria-valuenow', String(v));
    }
  }

  function tick(now) {
    var dt = Math.min(100, now - last);
    last = now;
    target = Math.max(target, measure(now));
    var step = Math.max(0.2, (target - shown) * 0.1);
    shown = Math.min(target, shown + Math.min(step, (dt * 100) / MIN_MS));
    render(shown);
    if (shown >= 100) ready();
    else requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // 100%: try to start the song. Open straight away if the browser lets it
  // play (or the visitor has muted it before); otherwise ask for one tap.
  function ready() {
    if (readied) return;
    readied = true;
    if (music.isMuted()) return finish();
    var answered = false;
    var timer = setTimeout(function () {
      // Still buffering on a slow connection: open anyway, the song follows.
      if (!answered) {
        answered = true;
        finish();
      }
    }, AUTOPLAY_WAIT_MS);
    music.tryAutoplay().then(function (playing) {
      if (answered) return;
      answered = true;
      clearTimeout(timer);
      if (playing) finish();
      else showGate();
    });
  }

  function showGate() {
    gateOpen = true;
    loader.classList.add('wl-ready');
    caption.textContent = 'Tap to open the invitation';
    openButton.hidden = false;
    try {
      openButton.focus({ preventScroll: true });
    } catch (e) {
      /* focus is a nicety */
    }
    // The whole loader is the tap target, not just the button.
    loader.addEventListener('click', open);
  }

  // Runs inside the visitor's tap, which is what lets the browser play audio.
  function open() {
    if (finished) return;
    music.play();
    finish();
  }

  // Framer plays the hero's entrance animations as soon as the HTML arrives,
  // which is underneath the loader. appear-recorder.js records them; replay
  // them now so visitors see the entrance when the loader lifts.
  function replayEntrance() {
    var records = w.__wlAppearRecords || [];
    var vh = w.innerHeight;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (!r.el.isConnected) continue;
      var box = r.el.getBoundingClientRect();
      if (!box.width || box.bottom < 0 || box.top > vh) continue;
      try {
        r.el.animate(r.keyframes, { duration: r.duration, delay: r.delay, easing: r.easing, fill: 'backwards' });
      } catch (e) {
        /* keep the final state */
      }
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    w.removeEventListener('wheel', blockScroll, true);
    w.removeEventListener('touchmove', blockScroll, true);
    w.removeEventListener('keydown', onKey, true);
    loader.removeEventListener('click', open);
    root.classList.remove('wl-loading');
    replayEntrance();
    loader.classList.add('wl-done');
    setTimeout(function () {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 1000);
    music.start();
  }

  // ----------------------------------------------------------------- music

  var music = (function () {
    var KEY = 'wl-music-muted';
    var VOLUME = 0.7;
    var WEBM = '__WL_SONG_WEBM__';
    var MP3 = '__WL_SONG_MP3__';
    var audio = null;
    var button = null;
    var muted = false;
    var resumeWhenVisible = false;
    try {
      muted = localStorage.getItem(KEY) === '1';
    } catch (e) {
      /* storage unavailable */
    }

    function remember() {
      try {
        if (muted) localStorage.setItem(KEY, '1');
        else localStorage.removeItem(KEY);
      } catch (e) {
        /* storage unavailable */
      }
    }

    function ensureAudio() {
      if (audio) return audio;
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      // Opus is smaller, but only trust a firm "probably": Safari can answer
      // "maybe" and then fail to decode it.
      audio.src = audio.canPlayType('audio/webm; codecs="opus"') === 'probably' ? WEBM : MP3;
      audio.addEventListener('error', function () {
        if (audio.src.indexOf('.webm') < 0) return;
        var wanted = !audio.paused || (!muted && button && !button.classList.contains('wl-waiting'));
        audio.src = MP3;
        if (wanted) play();
      });
      return audio;
    }

    var fading = 0;
    function fadeIn() {
      var start = performance.now();
      var id = ++fading;
      audio.volume = 0;
      (function step() {
        if (id !== fading) return;
        var k = Math.max(0, Math.min(1, (performance.now() - start) / 2500));
        audio.volume = VOLUME * k;
        if (k < 1 && !audio.paused) setTimeout(step, 50);
        else audio.volume = VOLUME;
      })();
    }

    function update(waiting) {
      if (!button) return;
      button.setAttribute('aria-pressed', String(muted || waiting));
      button.setAttribute('aria-label', muted || waiting ? 'Play music' : 'Mute music');
      button.title = muted || waiting ? 'Play music' : 'Mute music';
      button.classList.toggle('wl-waiting', !!waiting && !muted);
    }

    // Playback refused (no interaction yet): glow the button and start on
    // the visitor's first tap, click or key press anywhere.
    function refused() {
      if (!audio.paused) return; // a later attempt already succeeded
      update(true);
      waitForGesture();
    }

    function play() {
      ensureAudio();
      var p;
      try {
        p = audio.play();
      } catch (e) {
        return refused();
      }
      if (p && p.then) {
        p.then(function () {
          fadeIn();
          update(false);
          stopWaiting();
        }).catch(refused);
      } else {
        update(false);
      }
    }

    var gestures = ['pointerdown', 'touchend', 'click', 'keydown'];
    function onGesture(e) {
      if (button && button.contains(e.target)) return; // the button handles itself
      if (!muted) play();
    }
    function waitForGesture() {
      gestures.forEach(function (t) {
        d.addEventListener(t, onGesture, true);
      });
    }
    function stopWaiting() {
      gestures.forEach(function (t) {
        d.removeEventListener(t, onGesture, true);
      });
    }

    function toggle() {
      var waiting = button.classList.contains('wl-waiting');
      if (!muted && !waiting && audio && !audio.paused) {
        muted = true;
        audio.pause();
        update(false);
      } else {
        muted = false;
        play();
      }
      remember();
    }

    function createButton() {
      if (button) return;
      button = d.createElement('button');
      button.id = 'wl-music';
      button.type = 'button';
      button.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<path d="M4 9.5h3.2L11.5 6v12l-4.3-3.5H4z" fill="currentColor" stroke="none"/>' +
        '<g class="wl-on"><path class="wl-wave" d="M14.5 9.2a4 4 0 0 1 0 5.6"/><path class="wl-wave" d="M16.8 6.9a7.3 7.3 0 0 1 0 10.2"/></g>' +
        '<g class="wl-off"><path d="M15 9.5l5 5M20 9.5l-5 5"/></g>' +
        '</svg>';
      button.addEventListener('click', toggle);
      d.body.appendChild(button);
      update(false);
      requestAnimationFrame(function () {
        button.classList.add('wl-visible');
      });
    }

    d.addEventListener('visibilitychange', function () {
      if (!audio) return;
      if (d.hidden && !audio.paused) {
        resumeWhenVisible = true;
        audio.pause();
      } else if (!d.hidden && resumeWhenVisible && !muted) {
        resumeWhenVisible = false;
        play();
      }
    });

    return {
      isMuted: function () {
        return muted;
      },
      // Resolves true if the browser started the song without a tap.
      tryAutoplay: function () {
        ensureAudio();
        var p;
        try {
          p = audio.play();
        } catch (e) {
          return Promise.resolve(false);
        }
        if (!p || !p.then) return Promise.resolve(!audio.paused);
        return p.then(
          function () {
            fadeIn();
            update(false);
            return true;
          },
          function () {
            if (finished) refused(); // the loader already opened on its timeout
            return false;
          }
        );
      },
      play: play,
      // Called when the loader lifts: show the button, and start the song if
      // it is not already playing (or waiting for a tap).
      start: function () {
        createButton();
        if (muted) return update(false);
        if (audio && !audio.paused) return update(false);
        play();
      },
    };
  })();
})();
