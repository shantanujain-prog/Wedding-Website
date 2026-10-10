// Wedding Timeline cards: space the details lines evenly.
//
// Each card shows the event name, then day, date, venue (two lines: place and
// town) and time, then "More details below". The Framer template positions
// every line on its own with uneven gaps, and the venue now takes two lines,
// so this lays the five lines out in the space between the event name and
// "More details below": one even line pitch, centred. The lines are found by
// the --wl-day / --wl-date / --wl-venue / --wl-time markers in their inline
// style. Offsets use the CSS `translate` property, so Framer's own transforms
// and animations are untouched, and every card gets the same result.
(function () {
  var NAMES = ['1', '2', '3', '4', '5', '6'];

  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function find(card, marker) { return card.querySelector('p[style*="' + marker + '"]'); }
  function lineRects(p) {
    var r = document.createRange();
    r.selectNodeContents(p);
    var out = [], seen = {};
    var list = r.getClientRects();
    for (var i = 0; i < list.length; i++) {
      var k = Math.round(list[i].top);
      if (!seen[k] && list[i].height > 0) { seen[k] = 1; out.push(list[i]); }
    }
    return out;
  }

  // Cards animate in (scale and slide). Only lay a card out once it has stopped
  // moving; until then, check again shortly.
  var last = new WeakMap();
  function settled(card) {
    var r = card.getBoundingClientRect();
    var vals = [r.top + (window.scrollY || 0), r.left, r.width, r.height];
    // The event name and "More details below" animate on their own too.
    var ps = card.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) {
      var s = ps[i].getAttribute('style') || '';
      if (/IvyOra Display Medium/.test(s) || /More details/i.test(ps[i].textContent)) {
        var q = ps[i].getBoundingClientRect();
        vals.push(q.top - r.top, q.height);
      }
    }
    var key = vals.map(function (v) { return Math.round(v * 10); }).join(',');
    var prev = last.get(card);
    last.set(card, key);
    return prev === key;
  }

  function layout(card) {
    var title = card.querySelector('p[style*="IvyOra Display Medium"]');
    var day = find(card, '--wl-day'), date = find(card, '--wl-date');
    var venue = find(card, '--wl-venue'), time = find(card, '--wl-time');
    if (!title || !day || !date || !venue || !time) return;
    var more = null;
    var ps = card.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) if (/More details/i.test(ps[i].textContent)) more = ps[i];
    if (!more) return;

    var lines = [day, date, venue, time];
    lines.forEach(function (p) { p.style.translate = ''; p.style.lineHeight = ''; });
    // Screen pixels per layout pixel (1 unless the card is scaled).
    var k = card.getBoundingClientRect().height / (card.offsetHeight || 1) || 1;

    var font = (parseFloat(getComputedStyle(day).fontSize) || 12) * k;
    var titleBottom = lineRects(title).pop().bottom;
    var moreTop = lineRects(more)[0].top;
    var gap = 0.45 * font;
    var top = titleBottom + gap, bottom = moreTop - gap;
    var pitch = Math.min((bottom - top) / 5, 1.45 * font);
    var start = top + ((bottom - top) - 5 * pitch) / 2;

    venue.style.lineHeight = (pitch / k) + 'px';
    // Line index of each element's first line in the five-line block.
    [[day, 0], [date, 1], [venue, 2], [time, 4]].forEach(function (pair) {
      var p = pair[0], r = lineRects(p)[0];
      var want = start + pair[1] * pitch + (pitch - r.height) / 2;
      p.style.translate = '0 ' + ((want - r.top) / k).toFixed(2) + 'px';
    });
  }

  function apply() {
    var again = false;
    var secs = document.querySelectorAll('[data-framer-name="2 — Wedding Timeline"]');
    for (var s = 0; s < secs.length; s++) {
      if (!visible(secs[s])) continue;
      NAMES.forEach(function (n) {
        var cards = secs[s].querySelectorAll('[data-framer-name="' + n + '"]');
        for (var c = 0; c < cards.length; c++) {
          if (!visible(cards[c])) continue;
          if (settled(cards[c])) layout(cards[c]);
          else again = true;
        }
      });
    }
    if (again) schedule(250);
  }

  var timer = null;
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(function () { try { apply(); } catch (e) { /* never break the page */ } }, delay || 0);
  }
  function start() {
    schedule(0);
    window.addEventListener('resize', function () { schedule(150); });
    // Scrolling drives some of the entrance animations: re-check after it stops.
    window.addEventListener('scroll', function () { schedule(400); }, { passive: true });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) { schedule(300); return; }
      });
      document.querySelectorAll('[data-framer-name="2 — Wedding Timeline"]').forEach(function (el) { io.observe(el); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { schedule(50); });
  }
  if (document.readyState === 'complete') setTimeout(start, 300);
  else window.addEventListener('load', function () { setTimeout(start, 300); });
})();
