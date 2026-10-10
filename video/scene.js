// Save the Date reel: every frame is a pure function of time.
// render.cjs calls window.seek(t) for each frame and screenshots the stage.
// Open scene.html?t=12.5 in a browser (through a local server) to inspect one moment.
(() => {
  const C = window.CONFIG;
  const W = 1080, H = 1920;
  const A = "assets/site/", P = "assets/plates/";
  const TD = 0.6; // transition length, seconds

  // ---------- maths ----------
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, d) => clamp((t - a) / d);
  const ease = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    back: (t) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- DOM helpers ----------
  const stage = document.getElementById("stage");
  const pending = [];
  function el(tag, parent, props = {}, style = {}) {
    const e = document.createElement(tag);
    Object.assign(e, props);
    Object.assign(e.style, style);
    if (parent) parent.appendChild(e);
    return e;
  }
  const div = (parent, style = {}, cls = "") => el("div", parent, { className: cls }, style);
  function img(parent, src, style = {}) {
    const e = el("img", parent, { src }, Object.assign({ position: "absolute" }, style));
    pending.push(e.decode().catch(() => { throw new Error("image failed: " + src); }));
    return e;
  }
  let svgId = 0;
  function svg(parent, w, h, inner, style = {}) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("width", w);
    s.setAttribute("height", h);
    s.setAttribute("viewBox", `0 0 ${w} ${h}`);
    s.innerHTML = inner;
    Object.assign(s.style, Object.assign({ position: "absolute", overflow: "visible" }, style));
    parent.appendChild(s);
    return s;
  }
  function text(parent, str, cls, style = {}) {
    const e = div(parent, style, cls);
    e.textContent = str;
    return e;
  }
  function tf(e, { x = 0, y = 0, s = 1, r = 0, o = null, blur = null } = {}) {
    e.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;
    if (o !== null) e.style.opacity = clamp(o).toFixed(3);
    if (blur !== null) e.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
  }
  // fade + rise + unblur, the default entrance for text
  function fadeUp(e, t, at, { dur = 0.7, dist = 34, blur = 8 } = {}) {
    const p = ease.out(prog(t, at, dur));
    tf(e, { y: (1 - p) * dist, o: p, blur: (1 - p) * blur });
  }
  // left-to-right wipe, used for handwritten script ("weds", "Save the Date")
  function wipe(e, t, at, dur = 0.9) {
    const p = ease.inOut(prog(t, at, dur));
    e.style.clipPath = `inset(-20% ${((1 - p) * 100).toFixed(2)}% -20% 0)`;
    e.style.opacity = p > 0 ? 1 : 0;
  }

  // canvas text measuring for fitting long lines (needs fonts loaded)
  const mctx = document.createElement("canvas").getContext("2d");
  function fitSize(str, font, size, maxW, lsEm = 0) {
    mctx.font = `${font.weight || 400} ${size}px ${font.family}`;
    const w = mctx.measureText(str).width + lsEm * size * str.length;
    return w > maxW ? Math.floor((size * maxW) / w) : size;
  }
  const IVY = { family: "Ivy" }, IVY5 = { family: "Ivy", weight: 500 }, GOT5 = { family: "Gotham", weight: 500 },
    GOT4 = { family: "Gotham", weight: 400 }, SIG = { family: "Sig" };

  // ---------- ornaments ----------
  function mandalaInner(r, color) {
    const k = r / 300;
    let s = `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">`;
    for (const [f, w] of [[1, 2.6], [0.94, 1.4], [0.64, 1.8], [0.61, 1], [0.36, 1.8], [0.2, 1.6], [0.08, 1.4]])
      s += `<circle r="${r * f}" stroke-width="${w * k}"/>`;
    for (let i = 0; i < 24; i++)
      s += `<path transform="rotate(${i * 15})" stroke-width="${1.7 * k}" d="M0 ${-r * 0.64} C${r * 0.1} ${-r * 0.74} ${r * 0.08} ${-r * 0.87} 0 ${-r * 0.94} C${-r * 0.08} ${-r * 0.87} ${-r * 0.1} ${-r * 0.74} 0 ${-r * 0.64}Z"/>`;
    for (let i = 0; i < 24; i++)
      s += `<path transform="rotate(${i * 15 + 7.5})" stroke-width="${1.2 * k}" d="M0 ${-r * 0.66} L0 ${-r * 0.8}"/>`;
    for (let i = 0; i < 12; i++)
      s += `<path transform="rotate(${i * 30 + 15})" stroke-width="${1.7 * k}" d="M0 ${-r * 0.36} C${r * 0.13} ${-r * 0.44} ${r * 0.11} ${-r * 0.57} 0 ${-r * 0.61} C${-r * 0.11} ${-r * 0.57} ${-r * 0.13} ${-r * 0.44} 0 ${-r * 0.36}Z"/>`;
    for (let i = 0; i < 16; i++)
      s += `<path transform="rotate(${i * 22.5})" stroke-width="${1.4 * k}" d="M0 ${-r * 0.2} L${r * 0.035} ${-r * 0.29} L0 ${-r * 0.34} L${-r * 0.035} ${-r * 0.29}Z"/>`;
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180;
      s += `<circle cx="${(Math.sin(a) * r * 0.97).toFixed(1)}" cy="${(-Math.cos(a) * r * 0.97).toFixed(1)}" r="${2.4 * k}" fill="${color}" stroke="none"/>`;
    }
    return s + "</g>";
  }
  function mandala(parent, cx, cy, r, color, opacity) {
    const pad = 10;
    const s = svg(parent, 2 * r + 2 * pad, 2 * r + 2 * pad, `<g transform="translate(${r + pad},${r + pad})">${mandalaInner(r, color)}</g>`,
      { left: cx - r - pad + "px", top: cy - r - pad + "px", opacity, transformOrigin: "50% 50%" });
    return s;
  }

  // marigold bandhanwar (garland swags) across the top edge
  function garland(parent, swags = 3, sag = 86, y0 = -4) {
    const id = "g" + svgId++;
    let s = `<defs>
      <radialGradient id="${id}o" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFC453"/><stop offset=".6" stop-color="#F08A1C"/><stop offset="1" stop-color="#A9520F"/></radialGradient>
      <radialGradient id="${id}y" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFE98A"/><stop offset=".6" stop-color="#F6BD22"/><stop offset="1" stop-color="#A9780C"/></radialGradient>
      <radialGradient id="${id}r" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FF8A78"/><stop offset=".6" stop-color="#D83A2C"/><stop offset="1" stop-color="#83201A"/></radialGradient>
      <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9A3A"/><stop offset="1" stop-color="#2F6324"/></linearGradient></defs>`;
    const seg = W / swags;
    const leaf = (x, y, r) =>
      `<g transform="translate(${x},${y}) rotate(${r})"><path d="M0 0 C16 22 14 58 0 84 C-14 58 -16 22 0 0Z" fill="url(#${id}l)"/><path d="M0 4 L0 78" stroke="#9CC77A" stroke-width="2" opacity=".7"/></g>`;
    let leaves = "";
    for (let k = 0; k <= swags; k++) for (const r of [-28, 0, 28]) leaves += leaf(k * seg, y0 + 6, r);
    s += leaves;
    for (let k = 0; k < swags; k++) {
      const n = Math.round(seg / 23);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = k * seg + t * seg, y = y0 + 4 * sag * t * (1 - t);
        const c = i % 6 === 3 ? "r" : i % 2 ? "y" : "o", rr = 16 + (i % 3) * 1.6;
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr}" fill="url(#${id}${c})"/>` +
          `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr * 0.58}" fill="none" stroke="rgba(120,50,0,.35)" stroke-width="2.4" stroke-dasharray="3 4"/>`;
      }
    }
    return svg(parent, W, sag + 120, s, { left: 0, top: 0, filter: "drop-shadow(0 6px 8px rgba(95,37,15,.25))" });
  }

  // hanging strings (site artwork, 41x293): marigold string with bell, or bell on a chain
  function hanger(parent, kind, x, scale, phase, amp = 2.2) {
    const w = 41 * scale, h = 293 * scale;
    const e = img(parent, A + (kind === "bell" ? "chain-bell.webp" : "toran-bell.webp"),
      { left: x - w / 2 + "px", top: "-6px", width: w + "px", height: h + "px", transformOrigin: "50% 0", filter: "drop-shadow(0 8px 8px rgba(95,37,15,.25))" });
    return { e, update: (t, extra = 0) => tf(e, { r: (amp + extra) * Math.sin(t * 2 * Math.PI * 0.42 + phase) }) };
  }

  // flying birds: two-stroke silhouettes with flapping wings
  function birds(parent, specs) {
    const list = specs.map((b) => {
      const s = svg(parent, 10, 10, `<path fill="none" stroke="rgba(95,37,15,.78)" stroke-linecap="round" stroke-linejoin="round" stroke-width="${b.s * 0.13}"/>`,
        { left: 0, top: 0 });
      return { b, s, p: s.firstChild };
    });
    return (t) => {
      for (const { b, s, p } of list) {
        const u = (t - b.t0) / b.dur;
        if (u < 0 || u > 1) { s.style.display = "none"; continue; }
        s.style.display = "block";
        const x = lerp(b.x0, b.x1, u), y = lerp(b.y0, b.y1, u) + Math.sin(u * 6 + b.ph) * 10;
        const a = Math.sin(t * 2 * Math.PI * b.hz + b.ph), sz = b.s;
        const tip = -a * sz * 0.55, mid = -a * sz * 0.12 - sz * 0.1;
        p.setAttribute("d", `M${-sz} ${tip} Q${-sz * 0.45} ${mid} 0 ${sz * 0.1} Q${sz * 0.45} ${mid} ${sz} ${tip}`);
        s.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${b.x1 < b.x0 ? -1 : 1},1)`;
      }
    };
  }

  // falling petals (marigold / rose / jasmine) or twinkling sparkles, in front of a scene
  function petals(parent, seed, n, palette) {
    const R = rng(seed), list = [];
    for (let i = 0; i < n; i++) {
      const c = palette[Math.floor(R() * palette.length)], size = 14 + R() * 14;
      const s = svg(parent, size, size * 1.4,
        `<ellipse cx="${size / 2}" cy="${size * 0.7}" rx="${size * 0.42}" ry="${size * 0.66}" fill="${c}"/><ellipse cx="${size * 0.45}" cy="${size * 0.55}" rx="${size * 0.12}" ry="${size * 0.3}" fill="rgba(255,255,255,.35)"/>`,
        { left: 0, top: 0, opacity: 0.92 });
      list.push({ s, x: R() * W, off: R() * (H + 200), v: 120 + R() * 140, sway: 30 + R() * 50, f: 0.3 + R() * 0.5, ph: R() * 6.28, rot: (R() - 0.5) * 220 });
    }
    return (t) => {
      for (const q of list) {
        const y = ((q.off + t * q.v) % (H + 200)) - 100, x = q.x + Math.sin(t * q.f * 6.28 + q.ph) * q.sway;
        q.s.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(q.rot * t + q.ph * 50).toFixed(1)}deg)`;
      }
    };
  }
  function sparkles(parent, seed, n, box, color = "#FFF6DA") {
    const R = rng(seed), list = [];
    for (let i = 0; i < n; i++) {
      const sz = 16 + R() * 26;
      const s = svg(parent, sz, sz, `<path d="M${sz / 2} 0 L${sz * 0.58} ${sz * 0.42} L${sz} ${sz / 2} L${sz * 0.58} ${sz * 0.58} L${sz / 2} ${sz} L${sz * 0.42} ${sz * 0.58} L0 ${sz / 2} L${sz * 0.42} ${sz * 0.42}Z" fill="${color}"/>`,
        { left: box[0] + R() * (box[2] - box[0]) + "px", top: box[1] + R() * (box[3] - box[1]) + "px", filter: "drop-shadow(0 0 6px rgba(255,236,190,.9))" });
      list.push({ s, f: 0.4 + R() * 0.8, ph: R() * 6.28 });
    }
    return (t) => {
      for (const q of list) {
        const v = Math.pow(Math.max(0, Math.sin(t * q.f * 6.28 + q.ph)), 3);
        q.s.style.opacity = v.toFixed(3);
        q.s.style.transform = `scale(${(0.4 + 0.6 * v).toFixed(3)}) rotate(${(t * 40).toFixed(1)}deg)`;
      }
    };
  }

  // sky, sun glow and drifting clouds (the site's hero layers)
  function sky(parent, sunX, sunY) {
    const bg = img(parent, A + "sky.webp", { left: "-650px", top: 0, width: "2380px", height: "1920px", transformOrigin: "50% 40%" });
    const sun = img(parent, A + "sun.webp", { left: sunX - 650 + "px", top: sunY - 551 + "px", width: "1300px", height: "1103px" });
    const cl = img(parent, A + "clouds.webp", { left: "-310px", top: "60px", width: "1700px", height: "1371px", opacity: 0.6 });
    return (t) => {
      tf(bg, { s: 1.06 - 0.01 * t });
      tf(sun, { s: 1 + 0.04 * Math.sin(t * 1.3), o: 0.88 + 0.12 * Math.sin(t * 1.1) });
      tf(cl, { x: -30 + 16 * t });
    };
  }

  // a dashed "to be supplied" chip, or the final value once it is filled in
  function valueChip(parent, v, size, top) {
    const wrap = div(parent, { top: top + "px" }, "center");
    if (typeof v === "string") {
      const c = text(wrap, v, "chip final", { fontSize: size + "px" });
      return wrap;
    }
    const tag = text(wrap, "PLACEHOLDER · REPLACE BEFORE PUBLISHING", "todo-tag", {});
    el("br", wrap);
    const c = text(wrap, `[ ${v.placeholder} ]`, "chip todo", { fontSize: fitSize(`[ ${v.placeholder} ]`, GOT5, size, 760) + "px", marginTop: "12px" });
    return wrap;
  }

  // ---------- the event card ----------
  let CARDS;
  function silPath(poly, w, h, kx = 1, ky = 1, ox = 0, oy = 0) {
    return "M" + poly.map(([x, y]) => `${(ox + (0.5 + (x - 0.5) * kx) * w).toFixed(1)} ${(oy + (0.5 + (y - 0.5) * ky) * h).toFixed(1)}`).join(" L") + " Z";
  }
  function cardBox(b, grow) {
    const cx = ((b[0] + b[2]) / 2) * W, cy = ((b[1] + b[3]) / 2) * H, w = (b[2] - b[0]) * W * grow, h = (b[3] - b[1]) * H * grow;
    return { l: cx - w / 2, t: cy - h / 2, w, h };
  }
  function makeCard(parent, ev, box) {
    const id = "c" + svgId++;
    const card = div(parent, { left: box.l + "px", top: box.t + "px", width: box.w + "px", height: box.h + "px", transformOrigin: "50% 45%" }, "card");
    const poly = CARDS.silhouette;
    const outer = silPath(poly, box.w, box.h);
    const ins = 18;
    const inner = silPath(poly, box.w - 2 * ins, box.h - 2 * ins, 1, 1, ins, ins);
    svg(card, box.w, box.h, `
      <defs>
        <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFAF2"/><stop offset="1" stop-color="#FBEAD3"/></linearGradient>
        <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0C87E"/><stop offset=".45" stop-color="#B9853F"/><stop offset=".7" stop-color="#E7BD74"/><stop offset="1" stop-color="#A8742F"/></linearGradient>
      </defs>
      <path d="${outer}" fill="url(#${id}f)" stroke="url(#${id}g)" stroke-width="8"/>
      <path d="${inner}" fill="none" stroke="#D29A52" stroke-width="2.4"/>`,
      { left: 0, top: 0, filter: "drop-shadow(0 22px 34px rgba(60,22,6,.45))" }).classList.add("frame");
    // shimmer band that sweeps across the card once
    const shine = div(card, { left: 0, top: 0, width: box.w + "px", height: box.h + "px", clipPath: `path('${outer}')`, overflow: "hidden", pointerEvents: "none" });
    const band = div(shine, { position: "absolute", left: "-60%", top: "-10%", width: "40%", height: "120%",
      background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,244,214,.75), rgba(255,255,255,0))", transform: "skewX(-18deg)" });

    const RW = 596, RH = 857, k = Math.min(box.w / RW, box.h / RH);
    const inr = div(card, { transform: `translate(${(box.w - RW * k) / 2}px,${(box.h - RH * k) / 2}px) scale(${k})`, left: 0, top: 0 }, "inner");
    const items = [];
    const add = (e) => (items.push(e), e);
    add(svg(inr, 60, 60, `<path d="M30 0 L36 23 L60 30 L36 37 L30 60 L24 37 L0 30 L24 23Z" fill="#DDA45D"/><circle cx="30" cy="30" r="5" fill="#FFF8EE"/>`,
      { left: "268px", top: "44px", width: "60px" }));
    const ts = fitSize(ev.name, IVY5, 104, 470);
    add(text(inr, ev.name, "ivy nowrap", { top: 128 + (104 - ts) * 0.6 + "px", fontSize: ts + "px", fontWeight: 500, color: "var(--copper)", lineHeight: 1 }));
    const divider = (y, w) => svg(inr, w, 24, `<path d="M0 12 L${w / 2 - 22} 12 M${w / 2 + 22} 12 L${w} 12" stroke="#C99047" stroke-width="2"/><path d="M${w / 2} 2 L${w / 2 + 10} 12 L${w / 2} 22 L${w / 2 - 10} 12Z" fill="#DDA45D"/>`,
      { left: (RW - w) / 2 + "px", top: y + "px", width: w + "px" });
    add(divider(262, 330));
    add(text(inr, ev.day, "gotham caps nowrap", { top: "312px", fontSize: "30px", fontWeight: 500, letterSpacing: ".32em", color: "var(--copper)", lineHeight: 1, textIndent: ".32em" }));
    add(text(inr, ev.date, "ivy nowrap", { top: "362px", fontSize: fitSize(ev.date, IVY, 58, 500) + "px", color: "var(--brown)", lineHeight: 1 }));
    add(text(inr, ev.time, "ivy nowrap", { top: "440px", fontSize: "52px", color: "var(--brown)", lineHeight: 1 }));
    add(divider(518, 200));
    add(text(inr, ev.place, "ivy nowrap", { top: "560px", fontSize: fitSize(ev.place, IVY5, 58, 480) + "px", fontWeight: 500, color: "var(--brown)", lineHeight: 1 }));
    const town = div(inr, { top: "636px", display: "flex", justifyContent: "center", alignItems: "center", gap: "12px" });
    svg(town, 22, 30, `<path d="M11 0 C4.9 0 0 4.9 0 11 C0 19 11 30 11 30 C11 30 22 19 22 11 C22 4.9 17.1 0 11 0Z" fill="#AB5626"/><circle cx="11" cy="11" r="4.2" fill="#FFF8EE"/>`,
      { position: "relative" });
    text(town, ev.town, "gotham caps nowrap", { fontSize: "30px", fontWeight: 500, letterSpacing: ".32em", color: "var(--copper)", lineHeight: 1 });
    add(town);
    const sb = img(inr, A + "sunburst.webp", { left: "128px", top: "700px", width: "340px", height: "56px" });
    add(sb);
    return {
      card,
      update(lt) {
        // the frame is opaque from the first frame (it hides the erased area of the plate); only the text fades in
        const p = ease.out(prog(lt, 0, 0.6));
        tf(card, { s: lerp(0.96, 1, p), o: 1, y: (1 - p) * 14 });
        items.forEach((e, i) => fadeUp(e, lt, 0.28 + i * 0.075, { dur: 0.55, dist: 18, blur: 5 }));
        const q = prog(lt, 0.9, 1.1);
        band.style.left = lerp(-60, 130, q) + "%";
        band.style.opacity = q > 0 && q < 1 ? 1 : 0;
      },
    };
  }

  // ---------- scenes ----------
  function scene() {
    const root = div(stage, {}, "scene");
    return { root };
  }

  function intro() {
    const sc = scene(), r = sc.root;
    const skyU = sky(r, 540, 780);
    const mand = mandala(r, 540, 520, 430, "#C99047", 0.22);
    const mtn = img(r, A + "mountains.webp", { left: "-210px", top: "820px", width: "1500px", height: "1486px" });
    const stupa = img(r, A + "hero-stupa.webp", { left: "-80px", top: "860px", width: "1240px", height: "2886px", transformOrigin: "50% 12%" });
    const flyU = birds(r, [
      { x0: 1160, y0: 1010, x1: 620, y1: 900, t0: 0.6, dur: 4.6, s: 20, hz: 3.1, ph: 0 },
      { x0: 1220, y0: 1060, x1: 700, y1: 960, t0: 0.9, dur: 4.4, s: 16, hz: 3.4, ph: 1.3 },
      { x0: 1190, y0: 960, x1: 740, y1: 870, t0: 1.3, dur: 4.2, s: 13, hz: 3.8, ph: 2.1 },
      { x0: -80, y0: 980, x1: 330, y1: 880, t0: 1.8, dur: 3.8, s: 15, hz: 3.6, ph: 0.6 },
    ]);
    const shri = img(r, A + "shri-mahaviraya.webp", { left: "350px", top: "205px", width: "380px", height: "118px" });
    const g = text(r, C.couple.groom, "center ivy glow nowrap", { top: "318px", fontSize: fitSize(C.couple.groom, IVY5, 172, 760) + "px", fontWeight: 500, color: "var(--copper)", lineHeight: 1.05 });
    const weds = text(r, "weds", "center sig glow", { top: "492px", fontSize: "150px", color: "var(--brown)", lineHeight: 1 });
    const b = text(r, C.couple.bride, "center ivy glow nowrap", { top: "600px", fontSize: fitSize(C.couple.bride, IVY5, 172, 760) + "px", fontWeight: 500, color: "var(--copper)", lineHeight: 1.05 });
    const inv = text(r, C.invite, "center gotham glow", { top: "812px", fontSize: fitSize(C.invite, GOT4, 40, 900) + "px", color: "var(--brown)", lineHeight: 1.2 });
    const hang = [
      hanger(r, "toran", 34, 1.45, 0.0), hanger(r, "bell", 96, 2.0, 1.1, 3), hanger(r, "toran", 158, 1.25, 2.0),
      hanger(r, "toran", 922, 1.25, 0.7), hanger(r, "bell", 984, 2.0, 2.6, 3), hanger(r, "toran", 1046, 1.45, 1.6),
    ];
    garland(r);
    return Object.assign(sc, {
      len: 5.6,
      update(t) {
        skyU(t);
        tf(mand, { r: t * 5, o: 0.22 * ease.out(prog(t, 0.2, 1.2)) });
        tf(mtn, { y: -6 * t });
        tf(stupa, { s: 1 + 0.055 * ease.sine(clamp(t / 5.6)), y: 24 - 10 * t });
        flyU(t);
        fadeUp(shri, t, 0.15);
        fadeUp(g, t, 0.45, { dur: 0.9, dist: 44, blur: 12 });
        wipe(weds, t, 1.15, 0.85);
        fadeUp(b, t, 1.6, { dur: 0.9, dist: 44, blur: 12 });
        fadeUp(inv, t, 2.35);
        const strike = Math.exp(-t / 1.6) * 3; // bells swing harder as the reel opens
        hang.forEach((h) => h.update(t, strike));
      },
    });
  }

  function couple() {
    const sc = scene(), r = sc.root;
    r.style.background = "linear-gradient(180deg, #FFF6EC 0%, #FFEFE0 45%, #F8E1C6 100%)";
    const mand = mandala(r, 540, 960, 540, "#DDA45D", 0.13);
    const pea = img(r, A + "peacock-garden.webp", { left: "-50px", top: "1380px", width: "1180px", height: "2767px", transformOrigin: "50% 0" });
    const arch = img(r, A + "floral-arch.webp", { left: "-80px", top: "-34px", width: "1240px", height: "391px", transformOrigin: "50% 0" });
    const c = C.couple;
    const h1 = text(r, "Meet the", "center sig", { top: "300px", fontSize: "112px", color: "var(--copper)", lineHeight: 1 });
    const h2 = text(r, "Couple", "center ivy caps", { top: "420px", fontSize: "80px", fontWeight: 500, letterSpacing: ".16em", textIndent: ".16em", color: "var(--brown)", lineHeight: 1 });
    const lot = img(r, A + "lotus-divider.webp", { left: "390px", top: "512px", width: "300px", height: "118px" });
    const block = (top, name, role, org, parents) => {
      const g = div(r, { top: top + "px" }, "center");
      text(g, name, "ivy nowrap", { fontSize: fitSize(name, IVY5, 118, 900) + "px", fontWeight: 500, color: "var(--copper)", lineHeight: 1.05 });
      text(g, role, "ivy nowrap", { fontSize: "56px", color: "var(--brown)", lineHeight: 1.1, marginTop: "6px" });
      text(g, org, "gotham caps nowrap", { fontSize: "36px", fontWeight: 500, letterSpacing: ".3em", textIndent: ".3em", color: "var(--copper)", lineHeight: 1.2, marginTop: "10px" });
      text(g, parents, "gotham nowrap", { fontSize: fitSize(parents, GOT4, 31, 940) + "px", color: "rgba(95,37,15,.86)", lineHeight: 1.2, marginTop: "16px" });
      return g;
    };
    const gb = block(648, c.groomFull, c.groomRole, c.groomOrg, c.groomParents);
    const amp = text(r, "&", "center sig", { top: "975px", fontSize: "120px", color: "var(--gold-deep)", lineHeight: 1 });
    const bb = block(1080, c.brideFull, c.brideRole, c.brideOrg, c.brideParents);
    return Object.assign(sc, {
      len: 5.6,
      update(t) {
        tf(mand, { r: -t * 4 });
        tf(pea, { y: 40 - 14 * t, s: 1 + 0.01 * t });
        tf(arch, { s: 1 + 0.012 * Math.sin(t * 1.4) });
        fadeUp(h1, t, 0.25);
        fadeUp(h2, t, 0.45);
        fadeUp(lot, t, 0.6, { dist: 10 });
        let p = ease.out(prog(t, 0.8, 0.9));
        tf(gb, { x: (1 - p) * -120, o: p, blur: (1 - p) * 10 });
        p = ease.back(prog(t, 1.45, 0.6));
        tf(amp, { s: lerp(0.4, 1, p), o: clamp(p * 1.4) });
        p = ease.out(prog(t, 1.75, 0.9));
        tf(bb, { x: (1 - p) * 120, o: p, blur: (1 - p) * 10 });
      },
    });
  }

  function shaadiArt(cam) {
    const skyU = sky(cam, 540, 640);
    const gar = img(cam, A + "garden-chhatris.webp", { left: "-160px", top: "700px", width: "1400px", height: "978px" });
    const mandap = img(cam, A + "mandap.webp", { left: "40px", top: "880px", width: "1000px", height: "3746px", transformOrigin: "50% 0" });
    const hang = [hanger(cam, "toran", 40, 1.6, 0.4), hanger(cam, "bell", 110, 2.1, 1.7, 3), hanger(cam, "bell", 970, 2.1, 0.9, 3), hanger(cam, "toran", 1040, 1.6, 2.4)];
    garland(cam);
    return (t) => {
      skyU(t);
      tf(gar, { y: -4 * t });
      tf(mandap, { s: 1 + 0.012 * t });
      hang.forEach((h) => h.update(t, Math.exp(-t / 1.2) * 2));
    };
  }

  function eventScene(ev, i) {
    const sc = scene(), r = sc.root;
    const cam = div(r, { transformOrigin: "50% 30%" }, "layer");
    let artU = null, box;
    if (ev.art) {
      img(cam, P + ev.art + ".jpg", { left: 0, top: 0, width: W + "px", height: H + "px" });
      box = cardBox(CARDS.cards[ev.art].box, 1.035);
    } else {
      artU = shaadiArt(cam);
      box = cardBox(CARDS.cards.haldi.box, 1.035);
    }
    const card = makeCard(cam, ev, box);
    let tag = null;
    if (!ev.art && C.showPlaceholderTags) {
      tag = div(r, { top: box.t + box.h + 26 + "px" }, "center");
      text(tag, "PLACEHOLDER ART · " + ev.artPlaceholder.toUpperCase(), "todo-tag", { fontSize: "21px" });
    }
    const fx = div(r, {}, "layer");
    const palettes = {
      mehndi: ["#F39A1E", "#F7C531", "#E64A6B", "#FFFFFF"], "dev-darshan": ["#FFFFFF", "#FFF4D6", "#F7C531"],
      haldi: ["#F7C531", "#F39A1E", "#E64A6B"], reception: ["#FFFFFF", "#FFE9EC", "#F7C531"], null: ["#D83A2C", "#F39A1E", "#F7C531"],
    };
    const fxU = ev.art === "sangeet" ? sparkles(fx, 77 + i, 26, [40, 980, 1040, 1850]) : petals(fx, 31 + i, 11, palettes[ev.art] || palettes.null);
    return Object.assign(sc, {
      len: 3.9,
      update(t) {
        tf(cam, { s: 1 + 0.055 * ease.sine(clamp(t / 3.9)), y: -8 * t });
        if (artU) artU(t);
        card.update(t);
        if (tag) fadeUp(tag, t, 0.9, { dist: 10 });
        fxU(t);
      },
    });
  }

  function saveTheDate() {
    const sc = scene(), r = sc.root;
    r.style.background = "radial-gradient(ellipse at 50% 46%, #FFF8EF 0%, #FFEFE0 52%, #F6DCC0 100%)";
    const rays = svg(r, 1600, 1600, (() => {
      let s = "";
      for (let i = 0; i < 48; i++) s += `<path transform="rotate(${i * 7.5} 800 800)" d="M800 800 L790 0 L810 0Z" fill="rgba(221,164,93,${i % 2 ? 0.07 : 0.12})"/>`;
      return s;
    })(), { left: "-260px", top: "140px", transformOrigin: "50% 50%" });
    const mand = mandala(r, 540, 940, 470, "#DDA45D", 0.2);
    const arch = img(r, A + "floral-arch.webp", { left: "-80px", top: "-34px", width: "1240px", height: "391px" });
    const archB = img(r, A + "floral-arch.webp", { left: "-80px", top: "1563px", width: "1240px", height: "391px", transform: "scaleY(-1)" });
    const frames = [
      ["mehndi", 52, 300, -8], ["dev-darshan", 798, 286, 7], ["sangeet", 58, 1500, 6], ["reception", 790, 1490, -7],
    ].map(([n, x, y, rot], k) => {
      const f = div(r, { position: "absolute", left: x + "px", top: y + "px", width: "230px", height: "276px", background: "#FFF8EE", padding: "12px",
        boxShadow: "0 16px 30px rgba(60,22,6,.35)", border: "3px solid #DDA45D", transformOrigin: "50% 50%" });
      img(f, P + "couple-" + n + ".jpg", { position: "static", width: "230px", height: "276px" });
      return { f, x, y, rot, k };
    });
    const s1 = text(r, "Save the Date", "center sig", { top: "600px", fontSize: "150px", color: "var(--copper)", lineHeight: 1 });
    const big = text(r, C.dates.range, "center ivy nowrap", { top: "770px", fontSize: "250px", fontWeight: 500, color: "var(--brown)", lineHeight: 1 });
    const my = text(r, C.dates.monthYear, "center gotham caps nowrap", { top: "1040px", fontSize: "56px", fontWeight: 500, letterSpacing: ".34em", textIndent: ".34em", color: "var(--copper)", lineHeight: 1 });
    const cells = [["Thu", "17"], ["Fri", "18"], ["Sat", "19"], ["Sun", "20"]].map(([d, n], k) => {
      const c = div(r, { position: "absolute", left: 204 + k * 174 + "px", top: "1132px", width: "150px", height: "150px", borderRadius: "28px",
        border: "3px solid #DDA45D", background: "rgba(255,250,242,.9)", textAlign: "center", boxShadow: "0 8px 18px rgba(95,37,15,.12)" });
      text(c, d, "gotham caps", { fontSize: "28px", fontWeight: 500, letterSpacing: ".2em", textIndent: ".2em", color: "var(--copper)", marginTop: "22px", lineHeight: 1 });
      text(c, n, "ivy", { fontSize: "70px", fontWeight: 500, color: "var(--brown)", marginTop: "8px", lineHeight: 1 });
      return c;
    });
    const tagW = div(r, { top: "1318px" }, "center");
    const tag = text(tagW, C.hashtag, "ivy nowrap", { display: "inline-block", fontSize: fitSize(C.hashtag, IVY, 58, 820) + "px", color: "var(--copper)",
      background: "#FFF8EE", border: "3px solid #DDA45D", borderRadius: "999px", padding: "14px 40px 18px", lineHeight: 1 });
    const reg = text(r, C.region, "center gotham nowrap", { top: "1434px", fontSize: "32px", color: "var(--brown)", lineHeight: 1 });
    return Object.assign(sc, {
      len: 5.4,
      update(t) {
        tf(rays, { r: t * 6 });
        tf(mand, { r: -t * 7, s: 1 + 0.02 * Math.sin(t * 2) });
        tf(arch, { s: 1 + 0.01 * Math.sin(t * 1.2) });
        for (const { f, rot, k } of frames) {
          const p = ease.out(prog(t, 0.15 + k * 0.12, 0.9));
          const dir = k % 2 ? 1 : -1;
          tf(f, { x: (1 - p) * dir * 260 + Math.sin(t * 0.9 + k) * 10, y: Math.cos(t * 0.8 + k * 1.7) * 14 + (1 - p) * 60, r: rot + Math.sin(t * 0.7 + k) * 2.5, o: p });
        }
        wipe(s1, t, 0.3, 1.0);
        const p = ease.out(prog(t, 0.75, 0.9));
        tf(big, { s: lerp(1.25, 1, p), o: p, blur: (1 - p) * 16 });
        fadeUp(my, t, 1.15);
        cells.forEach((c, k) => {
          const q = ease.back(prog(t, 1.45 + k * 0.14, 0.5));
          tf(c, { s: lerp(0.5, 1, q), o: clamp(q * 1.5), y: (1 - clamp(q)) * 30 });
        });
        const hp = ease.out(prog(t, 2.2, 0.7));
        tf(tagW, { s: lerp(0.85, 1, hp), o: hp });
        tag.style.boxShadow = `0 0 ${(20 + 18 * Math.sin(t * 3)).toFixed(1)}px rgba(221,164,93,${(0.35 * hp).toFixed(2)})`;
        fadeUp(reg, t, 2.5);
      },
    });
  }

  function cta() {
    const sc = scene(), r = sc.root;
    r.style.background = "linear-gradient(180deg, #FFF6EC 0%, #FFEFE0 55%, #F6DCC0 100%)";
    const mand = mandala(r, 540, 900, 560, "#DDA45D", 0.12);
    const gard = img(r, A + "garden-chhatris.webp", { left: "-110px", top: "1390px", width: "1300px", height: "908px" });
    const arch = img(r, A + "floral-arch.webp", { left: "-80px", top: "-34px", width: "1240px", height: "391px" });
    const h = text(r, "Celebrate with us", "center sig", { top: "300px", fontSize: "116px", color: "var(--copper)", lineHeight: 1 });
    const cardStyle = (top, height) => ({ position: "absolute", left: "80px", top: top + "px", width: "920px", height: height + "px", borderRadius: "40px", background: "rgba(255,250,243,.96)",
      border: "3px solid #DDA45D", boxShadow: "0 18px 40px rgba(95,37,15,.18), inset 0 0 0 10px rgba(255,250,243,1), inset 0 0 0 12px rgba(221,164,93,.55)" });
    const c1 = div(r, cardStyle(470, 410));
    const ig = svg(c1, 104, 104, `<rect x="6" y="6" width="92" height="92" rx="28" fill="none" stroke="#AB5626" stroke-width="9"/><circle cx="52" cy="52" r="21" fill="none" stroke="#AB5626" stroke-width="9"/><circle cx="77" cy="27" r="6.5" fill="#AB5626"/>`,
      { left: "408px", top: "40px", transformOrigin: "50% 50%" });
    text(c1, C.cta.instagramTitle, "center ivy nowrap", { width: "920px", top: "166px", fontSize: fitSize(C.cta.instagramTitle, IVY5, 64, 840) + "px", fontWeight: 500, color: "var(--brown)", lineHeight: 1 });
    const ch1 = valueChip(c1, C.cta.instagramHandle, 44, 250);
    ch1.style.width = "920px";
    const c2 = div(r, cardStyle(920, 470));
    const wa = svg(c2, 108, 108, `<path d="M54 6 C27.5 6 6 27.5 6 54 C6 63 8.4 71.4 12.7 78.6 L6 102 L30.1 95.5 C37.1 99.4 45.3 102 54 102 C80.5 102 102 80.5 102 54 C102 27.5 80.5 6 54 6Z" fill="none" stroke="#AB5626" stroke-width="9" stroke-linejoin="round"/><path d="M38 32 C35 32 31 36 31 42 C31 54 45 74 63 77 C69 78 74 74 75 70 L76 65 L66 60 L61 66 C55 64 46 56 43 49 L49 44 L45 33Z" fill="#AB5626"/>`,
      { left: "406px", top: "40px", transformOrigin: "50% 50%" });
    text(c2, C.cta.whatsappTitle, "center ivy nowrap", { width: "920px", top: "168px", fontSize: fitSize(C.cta.whatsappTitle, IVY5, 60, 840) + "px", fontWeight: 500, color: "var(--brown)", lineHeight: 1 });
    text(c2, C.cta.whatsappSub, "center gotham nowrap", { width: "920px", top: "244px", fontSize: fitSize(C.cta.whatsappSub, GOT4, 38, 840) + "px", color: "var(--brown)", lineHeight: 1.2 });
    const ch2 = valueChip(c2, C.cta.whatsappLink, 40, 308);
    ch2.style.width = "920px";
    return Object.assign(sc, {
      len: 4.8,
      update(t) {
        tf(mand, { r: t * 5 });
        tf(gard, { y: -6 * t });
        fadeUp(h, t, 0.3);
        let p = ease.out(prog(t, 0.55, 0.8));
        tf(c1, { y: (1 - p) * 90, o: p });
        p = ease.out(prog(t, 0.95, 0.8));
        tf(c2, { y: (1 - p) * 90, o: p });
        tf(ig, { s: 1 + 0.06 * Math.max(0, Math.sin((t - 1.2) * 4)) });
        tf(wa, { s: 1 + 0.06 * Math.max(0, Math.sin((t - 1.6) * 4)) });
      },
    });
  }

  function closing() {
    const sc = scene(), r = sc.root;
    const skyU = sky(r, 540, 560);
    const flyU = birds(r, [
      { x0: -90, y0: 860, x1: 1170, y1: 700, t0: 0.2, dur: 4.6, s: 20, hz: 3.0, ph: 0 },
      { x0: -170, y0: 920, x1: 1100, y1: 760, t0: 0.4, dur: 4.6, s: 16, hz: 3.4, ph: 1.4 },
      { x0: -140, y0: 820, x1: 1130, y1: 680, t0: 0.8, dur: 4.4, s: 13, hz: 3.7, ph: 2.6 },
      { x0: 1170, y0: 960, x1: 520, y1: 850, t0: 1.6, dur: 4.0, s: 14, hz: 3.5, ph: 0.9 },
    ]);
    const ele = img(r, A + "elephant-pond.webp", { left: "-80px", top: "573px", width: "1240px", height: "1347px", transformOrigin: "60% 100%" });
    const water = div(r, {}, "layer");
    const twk = sparkles(water, 905, 22, [80, 1480, 1000, 1880]);
    const hang = [hanger(r, "bell", 62, 2.05, 0.3, 3.2), hanger(r, "toran", 150, 1.3, 1.5), hanger(r, "toran", 930, 1.3, 2.2), hanger(r, "bell", 1018, 2.05, 1.0, 3.2)];
    garland(r);
    const a1 = text(r, C.closing.split(" ")[0], "center sig glow", { top: "236px", fontSize: "150px", color: "var(--copper)", lineHeight: 1 });
    const rest = C.closing.split(" ").slice(1).join(" ");
    const a2 = text(r, rest, "center ivy caps glow nowrap", { top: "402px", fontSize: fitSize(rest, IVY5, 70, 760, 0.14) + "px", fontWeight: 500, letterSpacing: ".14em", textIndent: ".14em", color: "var(--brown)", lineHeight: 1 });
    const names = `${C.couple.groomFull} & ${C.couple.brideFull}`;
    const nm = text(r, names, "center ivy glow nowrap", { top: "512px", fontSize: fitSize(names, IVY, 64, 760) + "px", color: "var(--brown)", lineHeight: 1 });
    const dt = text(r, `${C.dates.range} ${C.dates.monthYear}`, "center gotham caps glow nowrap", { top: "604px", fontSize: "32px", fontWeight: 500, letterSpacing: ".3em", textIndent: ".3em", color: "var(--copper)", lineHeight: 1 });
    const hs = text(r, C.hashtag, "center ivy glow nowrap", { top: "660px", fontSize: "46px", color: "var(--copper)", lineHeight: 1 });
    return Object.assign(sc, {
      len: 4.7,
      update(t) {
        skyU(t);
        flyU(t);
        tf(ele, { s: 1 + 0.045 * ease.sine(clamp(t / 4.7)), x: -14 * t });
        twk(t);
        const strike = 4 * Math.exp(-t / 1.4);
        hang.forEach((h) => h.update(t, strike));
        wipe(a1, t, 0.35, 0.9);
        fadeUp(a2, t, 0.95);
        fadeUp(nm, t, 1.35);
        fadeUp(dt, t, 1.65);
        fadeUp(hs, t, 1.9);
      },
    });
  }

  // ---------- timeline ----------
  let S = [], scrollRod, flash, vignette, total = 0;
  function build() {
    const list = [
      [intro(), null],
      [couple(), "dissolve"],
      ...C.events.map((ev, i) => [eventScene(ev, i), ["scroll", "dissolve", "push", "glow", "scroll", "dissolve"][i]]),
      [saveTheDate(), "glow"],
      [cta(), "scroll"],
      [closing(), "dissolve"],
    ];
    let t0 = 0;
    S = list.map(([s, tr], i) => {
      if (i > 0) t0 -= TD;
      const o = { s, tr, t0, t1: t0 + s.len };
      t0 += s.len;
      return o;
    });
    total = t0;
    vignette = div(stage, { background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 58%, rgba(70,25,8,.24) 100%)", pointerEvents: "none" }, "layer");
    flash = div(stage, { background: "radial-gradient(circle at 50% 45%, rgba(255,250,240,1) 0%, rgba(255,228,170,.75) 40%, rgba(255,228,170,0) 78%)", opacity: 0 }, "layer");
    scrollRod = svg(stage, W, 60, `
      <defs><linearGradient id="rod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6D592"/><stop offset=".5" stop-color="#B9853F"/><stop offset="1" stop-color="#7A4A17"/></linearGradient></defs>
      <rect x="0" y="22" width="${W}" height="16" fill="url(#rod)"/>
      <rect x="0" y="16" width="${W}" height="4" fill="#DDA45D"/><rect x="0" y="40" width="${W}" height="4" fill="#DDA45D"/>
      ${[90, 540, 990].map((x) => `<path d="M${x} 8 L${x + 22} 30 L${x} 52 L${x - 22} 30Z" fill="#DDA45D" stroke="#7A4A17" stroke-width="2"/>`).join("")}`,
      { left: 0, top: 0, display: "none", filter: "drop-shadow(0 10px 14px rgba(60,22,6,.45))" });
  }

  function seek(t) {
    let rod = null, fl = 0;
    S.forEach((o, i) => {
      const vis = t >= o.t0 && t < o.t1 + 1e-6;
      const root = o.s.root;
      root.style.display = vis ? "block" : "none";
      if (!vis) return;
      o.s.update(t - o.t0);
      let op = 1, tr = "", clip = "none";
      const p = o.tr ? clamp((t - o.t0) / TD) : 1;
      if (o.tr && p < 1) {
        const e = ease.inOut(p);
        if (o.tr === "dissolve") { op = e; tr = `scale(${lerp(1.04, 1, e).toFixed(4)})`; }
        if (o.tr === "glow") { op = e; fl = Math.max(fl, Math.sin(Math.PI * p) * 0.85); }
        if (o.tr === "scroll") { clip = `inset(${((1 - e) * 100).toFixed(3)}% 0 0 0)`; rod = (1 - e) * H; }
        if (o.tr === "push") tr = `translateY(${((1 - e) * H).toFixed(1)}px)`;
      }
      const n = S[i + 1];
      if (n && t >= n.t0) {
        const q = ease.inOut(clamp((t - n.t0) / TD));
        if (n.tr === "push") tr += ` translateY(${(-q * H * 0.3).toFixed(1)}px)`;
        if (n.tr === "scroll") tr += ` translateY(${(-q * 140).toFixed(1)}px)`;
      }
      root.style.opacity = op.toFixed(3);
      root.style.transform = tr || "none";
      root.style.clipPath = clip;
    });
    flash.style.opacity = fl.toFixed(3);
    if (rod === null) scrollRod.style.display = "none";
    else { scrollRod.style.display = "block"; scrollRod.style.transform = `translateY(${(rod - 30).toFixed(1)}px)`; }
  }

  window.ready = (async () => {
    await Promise.all([
      document.fonts.load('400 40px "Ivy"'), document.fonts.load('500 40px "Ivy"'), document.fonts.load('40px "Sig"'),
      document.fonts.load('400 40px "Gotham"'), document.fonts.load('500 40px "Gotham"'),
    ]);
    CARDS = await (await fetch(P + "cards.json")).json();
    build();
    await Promise.all(pending);
    window.DURATION = total;
    window.seek = seek;
    window.SCHEDULE = S.map((o) => ({ t0: +o.t0.toFixed(2), t1: +o.t1.toFixed(2), tr: o.tr }));
    const q = new URLSearchParams(location.search).get("t");
    seek(q ? parseFloat(q) : 0);
    return total;
  })();
})();
