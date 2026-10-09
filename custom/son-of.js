// "Son of <groom's parents>" under the groom's name in the invitation, styled
// like the bride's "Daughter of" lines.
//
// Framer positions every layer absolutely, so this clones the "Daughter of"
// label and the bride's parents line, places the copies under the groom's name
// and makes room for them: the groom's name moves up into the line freed by the
// shorter invitation text, and "and", the bride's name, her parents and "On
// The Following Events" move down by whatever extra space the copies need.
// Offsets use the CSS `translate` property, so Framer's own transform-based
// entrance animations keep working. The copies mirror their originals' inline
// style (opacity and transform), so they animate in together with them.
(function () {
  var LABEL = 'Son of';
  var PARENTS = 'Shri. Pradeep Jain & Smt. Sanjana Jain';
  var BELOW = ['Ampersand — and', 'Bride Name — Drashti', 'Label — Daughter of', 'Bride Parents', 'Label — Events Intro'];

  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function pick(root, name) {
    var list = root.querySelectorAll('[data-framer-name="' + name + '"]:not([data-son-of])');
    for (var i = 0; i < list.length; i++) if (visible(list[i])) return list[i];
    return null;
  }
  function setText(el, text) {
    var p = el.querySelector('p');
    if (p) p.textContent = text;
  }
  function mirror(src, dst) {
    var copy = function () { dst.style.opacity = src.style.opacity; dst.style.transform = src.style.transform; dst.style.willChange = src.style.willChange; };
    copy();
    new MutationObserver(copy).observe(src, { attributes: true, attributeFilter: ['style'] });
  }

  function apply() {
    var boxes = document.querySelectorAll('[data-framer-name="Invitation Details"]');
    for (var b = 0; b < boxes.length; b++) {
      var box = boxes[b];
      if (!visible(box)) continue;
      var groom = pick(box, 'Groom Name — Akash');
      var inv = pick(box, 'Invitation Line');
      var bride = pick(box, 'Bride Name — Drashti');
      var dLabel = pick(box, 'Label — Daughter of');
      var dParents = pick(box, 'Bride Parents');
      if (!groom || !inv || !bride || !dLabel || !dParents) continue;
      if (groom.getAttribute('data-son-of-done') === '1' && box.querySelector('[data-son-of]')) continue;

      // Reset earlier offsets in this box before measuring again.
      var old = box.querySelectorAll('[data-son-of]');
      for (var o = 0; o < old.length; o++) old[o].remove();
      var moved = box.querySelectorAll('[data-son-of-moved]');
      for (var m = 0; m < moved.length; m++) { moved[m].style.translate = ''; moved[m].removeAttribute('data-son-of-moved'); }

      // Resting positions. offsetTop ignores transforms, so entrance and scroll
      // animations that are running do not skew the measurements; the layer's
      // own CSS centring (translate(-50%, -50%) on some breakpoints) is added
      // back by measuring a style-less copy of it.
      var baseTy = function (el) {
        var c = el.cloneNode(true);
        c.removeAttribute('style');
        c.removeAttribute('data-framer-name');
        c.style.visibility = 'hidden';
        el.parentNode.appendChild(c);
        var t = getComputedStyle(c).transform, ty = 0;
        if (t && t !== 'none') { var v = t.match(/-?[\d.]+(e-?\d+)?/g); ty = +v[v.length === 6 ? 5 : 13]; }
        c.remove();
        return ty;
      };
      var top = function (el) { var y = baseTy(el); for (var e = el; e && e !== box; e = e.offsetParent) y += e.offsetTop; return y; };
      var bottom = function (el) { return top(el) + el.offsetHeight; };

      // Spacing taken from the bride's block, so both families look alike.
      var overlap = bottom(bride) - top(dLabel);        // label tucks under the name
      var gap = top(dParents) - bottom(dLabel);         // label -> parents
      var labelH = dLabel.offsetHeight;
      var parentsH = dParents.offsetHeight;
      var lines = inv.querySelectorAll('p');
      var lineH = lines.length ? lines[0].offsetHeight : 0;
      var emptyLine = 0;
      for (var l = 0; l < lines.length; l++) if (!lines[l].textContent.trim()) emptyLine += lineH;

      var up = emptyLine;                               // freed by the shorter invitation
      groom.style.translate = '0 ' + (-up) + 'px';
      groom.setAttribute('data-son-of-moved', '1');

      var groomBottom = bottom(groom) - up;
      var labelTop = groomBottom - overlap;
      var parentsBottom = labelTop + labelH + gap + parentsH;
      // "and" keeps the overlap it had with the groom's name, measured from the
      // new parents line instead, plus the empty space under a name without
      // descenders (the script "and" rises to the top of its box).
      var andEl = pick(box, 'Ampersand — and');
      var nameFs = parseFloat(getComputedStyle(groom.querySelector('p') || groom).fontSize) || 0;
      var andGap = andEl ? top(andEl) - (groomBottom + up) : 0;
      var down = andEl ? Math.max(0, parentsBottom + andGap + 0.3 * nameFs - top(andEl)) : 0;

      var sLabel = dLabel.cloneNode(true);
      var sParents = dParents.cloneNode(true);
      [sLabel, sParents].forEach(function (el) { el.setAttribute('data-son-of', '1'); el.removeAttribute('data-framer-appear-id'); });
      sLabel.setAttribute('data-framer-name', 'Label — Son of');
      sParents.setAttribute('data-framer-name', 'Groom Parents — Son of');
      setText(sLabel, LABEL);
      setText(sParents, PARENTS);
      dLabel.parentNode.insertBefore(sLabel, dLabel);
      dParents.parentNode.insertBefore(sParents, dParents);
      mirror(dLabel, sLabel);
      mirror(dParents, sParents);
      sLabel.style.translate = '0 ' + (labelTop - top(dLabel)) + 'px';
      sParents.style.translate = '0 ' + (labelTop + labelH + gap - top(dParents)) + 'px';

      BELOW.forEach(function (name) {
        var el = pick(box, name);
        if (!el) return;
        el.style.translate = '0 ' + down + 'px';
        el.setAttribute('data-son-of-moved', '1');
      });
      groom.setAttribute('data-son-of-done', '1');
    }
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; try { apply(); } catch (e) { /* never break the page */ } });
  }
  function start() {
    schedule();
    window.addEventListener('resize', function () {
      var done = document.querySelectorAll('[data-son-of-done]');
      for (var i = 0; i < done.length; i++) done[i].removeAttribute('data-son-of-done');
      schedule();
    });
    // Framer swaps breakpoint variants by replacing DOM; re-apply when that happens.
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var t = records[i].target;
        if (t.nodeType === 1 && t.closest && t.closest('[data-son-of]')) continue;
        if (records[i].addedNodes.length) { schedule(); return; }
      }
    }).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  }
  // Wait for React hydration: Framer marks the root once it has rendered.
  if (document.readyState === 'complete') setTimeout(start, 300);
  else window.addEventListener('load', function () { setTimeout(start, 300); });
})();
