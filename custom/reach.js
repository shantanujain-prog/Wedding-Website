/* Places the "How to Reach" section (reach.html) under the RSVP card.
   Inlined at the end of <body> by tools/build.js.

   Framer lays the page out with absolutely positioned frames inside fixed-
   height containers, so nothing moves down by itself when a block is added.
   Once React has hydrated the page, this script:
     1. finds the RSVP card of the layout currently shown;
     2. copies the typography, icon size, dividers, ornament and button style
        from the site's own "Things to know" block and map buttons;
     3. puts the section just below the card and moves every frame below that
        line down by the section's height (via `top`, so Framer's scroll
        animations, which read offsetTop, still trigger at the right place);
     4. grows the page containers by the same amount, first pinning the
        sections inside them at their pixel positions (some are placed at a
        percentage of the container's height and would otherwise move).
   It re-runs when the window is resized, when Framer swaps the layout for
   another breakpoint, and when the section's own height changes. */
(function () {
  'use strict';
  var d = document;
  var w = window;
  var section = d.getElementById('wl-reach');
  if (!section) return;

  var TOLERANCE = 40; // frames starting this close above the line move too
  var applied = []; // [element, property, previous inline value]
  var lastKey = '';

  function visible(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function first(selector, root) {
    var list = (root || d).querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) if (visible(list[i])) return list[i];
    return null;
  }
  // Layout position on the page, ignoring transforms (Framer animates frames
  // in with translate/scale, which must not move the line).
  function pageTop(el) {
    if (!(el instanceof HTMLElement)) return el.getBoundingClientRect().top + w.pageYOffset;
    var y = 0;
    for (var e = el; e; e = e.offsetParent) y += e.offsetTop;
    return y;
  }
  function pageBottom(el) {
    return el instanceof HTMLElement ? pageTop(el) + el.offsetHeight : el.getBoundingClientRect().bottom + w.pageYOffset;
  }
  function hydrated(el) {
    for (var k in el) if (k.indexOf('__reactFiber') === 0) return true;
    return false;
  }

  // The RSVP card: Framer names it on the home page; elsewhere, find the
  // frame around the "Send via WhatsApp" button.
  function findRsvp() {
    var named = first('#main [data-framer-name="RSVP Form"]');
    if (named) return named;
    var nodes = d.querySelectorAll('#main a, #main button');
    for (var i = 0; i < nodes.length; i++) {
      if (!/Send via WhatsApp/i.test(nodes[i].textContent) || !visible(nodes[i])) continue;
      for (var el = nodes[i].parentElement; el && el.id !== 'main'; el = el.parentElement) {
        if (getComputedStyle(el).position === 'absolute' && el.getBoundingClientRect().height >= 150) return el;
      }
    }
    return null;
  }

  // ------------------------------------------------------------ styling

  // Framer shrinks some rows with a CSS scale on phones, so sizes are copied
  // as rendered (computed size x the element's effective scale).
  function renderedScale(el) {
    var h = el.offsetHeight;
    return h ? el.getBoundingClientRect().height / h : 1;
  }
  function copyText(from, to) {
    if (!from) return;
    var cs = getComputedStyle(from);
    var k = renderedScale(from);
    to.style.fontFamily = cs.fontFamily;
    to.style.fontWeight = cs.fontWeight;
    to.style.fontStyle = cs.fontStyle;
    to.style.color = cs.color;
    to.style.textTransform = cs.textTransform;
    to.style.fontSize = parseFloat(cs.fontSize) * k + 'px';
    to.style.lineHeight = cs.lineHeight === 'normal' ? 'normal' : parseFloat(cs.lineHeight) * k + 'px';
    to.style.letterSpacing = cs.letterSpacing === 'normal' ? 'normal' : parseFloat(cs.letterSpacing) * k + 'px';
  }
  function all(selector) {
    return Array.prototype.slice.call(section.querySelectorAll(selector));
  }

  function syncStyles() {
    var things = first('#main [data-framer-name="Things to Know"]');
    var heading = first('[data-framer-name="Things to Know Heading"] p', things || d);
    var scale = heading ? parseFloat(getComputedStyle(heading).fontSize) / 60 : w.innerWidth < 810 ? 0.52 : 1;
    section.style.setProperty('--wl-s', String(Math.max(0.3, Math.min(1.4, scale))));
    copyText(heading, section.querySelector('.wl-reach-title'));
    copyText(first('[data-framer-name="Things to Know Subtext"] p', things || d), section.querySelector('.wl-reach-intro'));
    if (things) {
      var title = first('[data-framer-name$=" Title"] p', things);
      var text = first('[data-framer-name$=" Description"] p', things);
      all('.wl-reach-item-title').forEach(function (el) { copyText(title, el); });
      all('.wl-reach-item-text').forEach(function (el) { copyText(text, el); });
      var icon = first('[data-framer-name$=" Icon"]', things);
      if (icon) {
        var size = Math.round(icon.getBoundingClientRect().height) + 'px';
        all('.wl-reach-icon').forEach(function (el) { el.style.width = el.style.height = size; });
      }
      var item = first('[data-framer-name$=" Item"]', things);
      if (item) {
        var width = Math.round(item.getBoundingClientRect().width) + 'px';
        all('.wl-reach-item').forEach(function (el) { el.style.width = width; el.style.flexBasis = width; });
      }
      var divider = first('[data-framer-name^="Divider"]', things);
      if (divider) {
        var dcs = getComputedStyle(divider);
        var dw = Math.max(1, Math.round(divider.getBoundingClientRect().width)) + 'px';
        all('.wl-reach-divider').forEach(function (el) {
          el.style.background = dcs.backgroundImage !== 'none' ? dcs.backgroundImage : dcs.backgroundColor;
          el.style.width = dw;
          el.style.borderRadius = dcs.borderRadius;
        });
      }
    }
    syncOrnaments(things);
    // The map's "Location" buttons are the site's own button style.
    var buttons = d.querySelectorAll('#main button');
    for (var i = 0; i < buttons.length; i++) {
      if (/^\s*Location 1\s*$/.test(buttons[i].textContent) && visible(buttons[i])) {
        var bcs = getComputedStyle(buttons[i]);
        var link = section.querySelector('.wl-reach-button');
        ['backgroundColor', 'color', 'borderRadius', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'boxShadow', 'border'].forEach(function (p) {
          link.style[p] = bcs[p];
        });
        link.style.padding = '0 ' + Math.max(28, parseFloat(bcs.paddingLeft) * 1.5) + 'px';
        link.style.height = bcs.height;
        break;
      }
    }
  }

  // The site's sunburst ornament (the section opens with it; the block that
  // follows opens with its own): the one above "Things to know" on desktop,
  // otherwise any copy of the same image on the page (phone layouts frame
  // the RSVP card with it), otherwise the file itself.
  var ORNAMENT = 'DIljN6CZ5Ok94fYAeNVQ4nSQOEo';
  function syncOrnaments(things) {
    var source = (things && first('[data-framer-name="Ornament Top"] img', things)) || first('#main img[src*="' + ORNAMENT + '"]');
    var imgs = all('.wl-reach-ornament');
    imgs.forEach(function (img) {
      if (source) {
        if (source.getAttribute('srcset')) img.setAttribute('srcset', source.getAttribute('srcset'));
        if (source.getAttribute('sizes')) img.setAttribute('sizes', source.getAttribute('sizes'));
        if (img.getAttribute('src') !== (source.currentSrc || source.src)) img.src = source.currentSrc || source.src;
      } else if (!img.getAttribute('src')) {
        img.src = '/framerusercontent.com/images/' + ORNAMENT + '.webp?width=1220&height=200';
      }
    });
  }

  // ------------------------------------------------------------- layout

  var created = []; // image copies added by splitImage()
  function undo() {
    for (var i = applied.length - 1; i >= 0; i--) applied[i][0].style[applied[i][1]] = applied[i][2];
    applied = [];
    created.forEach(function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    created = [];
  }

  // A picture that runs across the line (e.g. one background image behind
  // the RSVP card and the countdown) cannot simply move: show its upper part
  // in place, a copy of its lower part moved down with the content, and fill
  // the gap with copies of a thin strip from just above the line, so textures
  // and frame lines continue.
  function splitImage(img, line, amount) {
    var cut = line - pageTop(img);
    var below = img.offsetHeight - cut;
    var strip = Math.max(8, Math.min(60, Math.floor(cut)));
    function copy(clipTop, clipBottom, offset) {
      var c = img.cloneNode(false);
      c.removeAttribute('id');
      c.setAttribute('alt', '');
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('data-wl-reach-copy', '');
      c.style.position = 'absolute';
      c.style.left = img.offsetLeft + 'px';
      c.style.top = img.offsetTop + 'px';
      c.style.width = img.offsetWidth + 'px';
      c.style.height = img.offsetHeight + 'px';
      c.style.maxWidth = 'none';
      c.style.clipPath = 'inset(' + clipTop + 'px 0 ' + clipBottom + 'px 0)';
      c.style.translate = '0px ' + offset + 'px';
      img.parentNode.insertBefore(c, img.nextSibling);
      created.push(c);
    }
    // Inserted right after the original, in reverse, so the moved lower part
    // ends up last (on top of the strips).
    copy(cut, 0, amount);
    for (var y = Math.ceil(amount / strip) - 1; y >= 0; y--) copy(cut - strip, below, strip + y * strip);
    set(img, 'clipPath', 'inset(0 0 ' + below + 'px 0)');
  }
  function set(el, prop, value) {
    applied.push([el, prop, el.style[prop]]);
    el.style[prop] = value;
  }

  // Pin the frames placed directly in a container at their current pixel
  // position and size, so growing the container does not move them.
  function pinChildren(parent) {
    var kids = parent.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el === section) continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'contents') pinChildren(el);
      else if (cs.position === 'absolute') {
        set(el, 'top', cs.top);
        set(el, 'height', cs.height);
      }
    }
  }

  // Move every frame that lies below the line down by `amount`; look inside
  // frames that straddle it (sections, backgrounds) and leave the rest.
  function shiftBelow(root, line, amount) {
    // A snapshot: splitImage() adds copies next to the images it splits.
    var kids = Array.prototype.slice.call(root.children);
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el === section || el.hasAttribute('data-wl-reach-copy')) continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      var r = el.getBoundingClientRect();
      if (cs.display === 'contents' || (r.width === 0 && r.height === 0)) {
        shiftBelow(el, line, amount);
        continue;
      }
      var top = pageTop(el);
      var bottom = pageBottom(el);
      if (top >= line - TOLERANCE) {
        if (cs.position === 'absolute' || cs.position === 'relative') set(el, 'top', (parseFloat(cs.top) || 0) + amount + 'px');
        else set(el, 'translate', '0px ' + amount + 'px');
      } else if (bottom > line + TOLERANCE) {
        if (el.tagName === 'IMG') splitImage(el, line, amount);
        else shiftBelow(el, line, amount);
      }
    }
  }

  function layout() {
    var rsvp = findRsvp();
    if (!rsvp) {
      undo();
      section.hidden = true;
      lastKey = '';
      return;
    }
    // Chain from the card up to the page wrapper directly inside #main.
    var chain = [];
    for (var el = rsvp; el && el.id !== 'main'; el = el.parentElement) chain.push(el);
    var top = chain[chain.length - 1];
    var container = top;
    for (var i = chain.length - 1; i >= 0; i--) {
      var pos = getComputedStyle(chain[i]).position;
      if (pos === 'relative' || pos === 'absolute') {
        container = chain[i];
        break;
      }
    }

    undo();
    if (section.parentElement !== container) container.appendChild(section);
    section.hidden = false;
    syncStyles();

    var scale = parseFloat(section.style.getPropertyValue('--wl-s')) || 1;
    var gap = Math.round(64 * scale);
    var line = pageBottom(rsvp);
    var height = section.offsetHeight;
    // Gap above the section; below it, the original space before the next
    // block stays as it was.
    var amount = height + gap;

    // Page-level containers (at least 90% of the page tall) grow; record
    // their heights before anything moves.
    var docHeight = d.documentElement.scrollHeight;
    var growers = [];
    for (var j = 0; j < chain.length; j++) {
      var h = chain[j].offsetHeight;
      if (h >= docHeight * 0.9) growers.push([chain[j], h]);
    }

    for (var p = 0; p < growers.length; p++) pinChildren(growers[p][0]);
    shiftBelow(top, line, amount);
    set(section, 'top', line + gap - pageTop(container) + 'px');
    for (var k = 0; k < growers.length; k++) {
      var g = growers[k][0];
      if (g.offsetHeight < growers[k][1] + amount - 1) set(g, 'height', growers[k][1] + amount + 'px');
    }
    lastKey = [w.innerWidth, Math.round(line), height, container.className].join('|');
  }

  // ----------------------------------------------------------- triggers

  var timer = 0;
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var rsvp = findRsvp();
      var key = rsvp && section.isConnected && section.parentElement && section.parentElement.contains(rsvp)
        ? [w.innerWidth, Math.round(pageBottom(rsvp)), section.offsetHeight, section.parentElement.className].join('|')
        : '';
      if (key !== lastKey || !key) layout();
    }, delay);
  }

  function start() {
    layout();
    w.addEventListener('resize', function () { schedule(150); });
    // Framer swaps the whole layout when the window crosses a breakpoint.
    // Changes made by this script (the section, image copies) are ignored.
    var main = d.getElementById('main');
    function ours(node) {
      return node.nodeType !== 1 || node === section || section.contains(node) || node.hasAttribute('data-wl-reach-copy');
    }
    if (main && w.MutationObserver) {
      new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (section.contains(r.target)) continue;
          var nodes = Array.prototype.slice.call(r.addedNodes).concat(Array.prototype.slice.call(r.removedNodes));
          if (nodes.length && nodes.every(ours)) continue;
          return schedule(120);
        }
      }).observe(main, { childList: true, subtree: true });
    }
    // Late font loads change the section's height.
    if (w.ResizeObserver) {
      var lastHeight = 0;
      new ResizeObserver(function () {
        var h = section.offsetHeight;
        if (h && h !== lastHeight) {
          lastHeight = h;
          schedule(50);
        }
      }).observe(section);
    }
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { schedule(0); });
  }

  // Wait for React to take over the page: changing Framer's DOM before
  // hydration would make React discard it and render the page again.
  function waitForHydration(tries) {
    var rsvp = findRsvp();
    if (rsvp && hydrated(rsvp)) return start();
    if (tries > 150) return start(); // ~30 s: go ahead anyway
    setTimeout(function () { waitForHydration(tries + 1); }, 200);
  }
  if (d.readyState === 'complete') waitForHydration(0);
  else w.addEventListener('load', function () { waitForHydration(0); });
})();
