// Builds the e-invite pages from data.js. build.cjs prints this page to PDF.
(() => {
  const D = window.INVITE, PHS = window.PLACEHOLDERS;
  const params = new URLSearchParams(location.search);
  // ?bleed: the print-shop version, each page 3 mm (8.5 pt) larger on every side; the trimmed page is unchanged
  if (params.has("bleed")) {
    document.documentElement.style.setProperty("--bleed", "8.5pt");
    const st = document.createElement("style");
    st.textContent = "@page { size: 437pt 612pt; margin: 0; }";
    document.head.appendChild(st);
  }
  const SITE = "../video/assets/site/";
  const used = new Map(); // placeholder id -> { no, where:Set }
  let where = "";

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // a value from data.js: plain text, or a clearly marked placeholder
  function val(v) {
    if (v && typeof v === "object" && v.placeholder) {
      const id = v.placeholder;
      if (!used.has(id)) used.set(id, { no: used.size + 1, where: new Set() });
      const u = used.get(id);
      u.where.add(where);
      return `<span class="ph"><b>PLACEHOLDER P${u.no}</b>${esc(PHS[id] || id)}</span>`;
    }
    return esc(v);
  }
  const isPh = (v) => v && typeof v === "object" && v.placeholder;

  // ---------- ornaments (same motifs as the reel) ----------
  function garland() {
    const W = 1080, swags = 3, sag = 86, y0 = -4, seg = W / swags;
    let s = `<defs>
      <radialGradient id="go" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFC453"/><stop offset=".6" stop-color="#F08A1C"/><stop offset="1" stop-color="#A9520F"/></radialGradient>
      <radialGradient id="gy" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFE98A"/><stop offset=".6" stop-color="#F6BD22"/><stop offset="1" stop-color="#A9780C"/></radialGradient>
      <radialGradient id="gr" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FF8A78"/><stop offset=".6" stop-color="#D83A2C"/><stop offset="1" stop-color="#83201A"/></radialGradient>
      <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9A3A"/><stop offset="1" stop-color="#2F6324"/></linearGradient></defs>`;
    for (let k = 0; k <= swags; k++)
      for (const r of [-28, 0, 28])
        s += `<g transform="translate(${k * seg},${y0 + 6}) rotate(${r})"><path d="M0 0 C16 22 14 58 0 84 C-14 58 -16 22 0 0Z" fill="url(#gl)"/></g>`;
    for (let k = 0; k < swags; k++) {
      const n = Math.round(seg / 23);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = k * seg + t * seg, y = y0 + 4 * sag * t * (1 - t);
        const c = i % 6 === 3 ? "r" : i % 2 ? "y" : "o", rr = 16 + (i % 3) * 1.6;
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr}" fill="url(#g${c})"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr * 0.58}" fill="none" stroke="rgba(120,50,0,.35)" stroke-width="2.4" stroke-dasharray="3 4"/>`;
      }
    }
    return `<svg class="garland" viewBox="0 0 ${W} ${sag + 110}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
  }
  function mandala(cx, cy, r) {
    let s = `<g fill="none" stroke="#C99047" stroke-linecap="round">`;
    for (const f of [1, 0.94, 0.64, 0.61, 0.36, 0.2]) s += `<circle r="${r * f}" stroke-width="1.6"/>`;
    for (let i = 0; i < 24; i++) s += `<path transform="rotate(${i * 15})" stroke-width="1.4" d="M0 ${-r * 0.64} C${r * 0.1} ${-r * 0.74} ${r * 0.08} ${-r * 0.87} 0 ${-r * 0.94} C${-r * 0.08} ${-r * 0.87} ${-r * 0.1} ${-r * 0.74} 0 ${-r * 0.64}Z"/>`;
    for (let i = 0; i < 12; i++) s += `<path transform="rotate(${i * 30 + 15})" stroke-width="1.4" d="M0 ${-r * 0.36} C${r * 0.13} ${-r * 0.44} ${r * 0.11} ${-r * 0.57} 0 ${-r * 0.61} C${-r * 0.11} ${-r * 0.57} ${-r * 0.13} ${-r * 0.44} 0 ${-r * 0.36}Z"/>`;
    s += "</g>";
    return `<svg class="mandala" style="left:${cx - r}mm;top:${cy - r}mm;width:${2 * r}mm;height:${2 * r}mm" viewBox="${-r * 1.02} ${-r * 1.02} ${r * 2.04} ${r * 2.04}">${s}</svg>`;
  }
  const divider = (w = 46) => `<svg class="divider" style="width:${w}mm;height:3mm" viewBox="0 0 ${w * 10} 30"><path d="M0 15 L${w * 5 - 26} 15 M${w * 5 + 26} 15 L${w * 10} 15" stroke="#C99047" stroke-width="2"/><path d="M${w * 5} 3 L${w * 5 + 12} 15 L${w * 5} 27 L${w * 5 - 12} 15Z" fill="#DDA45D"/></svg>`;
  const pin = `<svg viewBox="0 0 22 30" style="width:5.2mm;height:7mm;margin-top:1mm"><path d="M11 0 C4.9 0 0 4.9 0 11 C0 19 11 30 11 30 C11 30 22 19 22 11 C22 4.9 17.1 0 11 0Z" fill="#AB5626"/><circle cx="11" cy="11" r="4.2" fill="#FFF8EE"/></svg>`;
  function mapLinks(m) {
    if (isPh(m)) return val(m);
    return (Array.isArray(m) ? m : [m]).map((l) => {
      const [label, url] = Array.isArray(l) ? l : ["Open in Google Maps", l];
      return `<a href="${esc(url)}">${esc(label)}</a> <span class="url">${esc(url)}</span>`;
    }).join("<br>");
  }
  // keep a bracketed aside on one line: "Magadham Grande (Magdham Resort)"
  const keepAside = (s) => esc(s).replace(/\(([^)]*)\)/g, '<span class="nowrap">($1)</span>');
  const star = (x, y) => `<svg class="corner" style="left:${x}mm;top:${y}mm" viewBox="0 0 60 60"><path d="M30 0 L36 23 L60 30 L36 37 L30 60 L24 37 L0 30 L24 23Z" fill="#DDA45D"/></svg>`;

  let pageNo = 0;
  function page(cls, inner, { footer = true, bells = true, mand = [74, 112, 62] } = {}) {
    pageNo++;
    return `<section class="page ${cls}"><div class="trim">
      ${mand ? mandala(...mand) : ""}
      <div class="frame"></div>${star(2.6, 102.5)}${star(140.4, 102.5)}
      ${garland()}
      ${bells ? `<img class="bell" style="left:9.5mm" src="${SITE}chain-bell.webp"><img class="bell" style="right:9.5mm" src="${SITE}chain-bell.webp">` : ""}
      <div class="content">${inner}</div>
      ${footer ? `<div class="footer">${esc(D.hashtag)}<span class="no">${pageNo}</span></div>` : ""}
    </div></section>`;
  }

  // ---------- pages ----------
  function cover() {
    const c = D.couple;
    return page("cover", `
      <img class="art" src="assets/cover-art.jpg" alt="">
      <img class="shri" src="${SITE}shri-mahaviraya.webp" alt="॥ श्री महावीराय नमः ॥">
      <img class="shlok" src="assets/mangalam-shlok.webp" alt="Mangalam shlok">
      <div class="invite center ivy">${esc(D.invitation)}</div>
      <div class="center" style="position:absolute;left:10mm;right:10mm;top:63mm">
        <div class="name">${esc(c.groom)}</div>
        <div class="parents">${esc(c.groomParents)}</div>
        <div class="weds">weds</div>
        <div class="name">${esc(c.bride)}</div>
        <div class="parents">${esc(c.brideParents)}</div>
        <div style="margin-top:5mm">${divider(40)}</div>
        <div class="when" style="margin-top:3mm">${esc(D.dates)}</div>
        <div class="where label">${esc(D.places)}</div>
        <div class="tag">${esc(D.hashtag)}</div>
      </div>`, { footer: false, mand: [74, 104, 58] });
  }

  function glance() {
    where = "Schedule page";
    const rows = D.events.map((e) => {
      const [dd, mon] = e.date.split(" ");
      const venue = `${esc(e.venue.place)}<br>${esc(e.venue.town)}`;
      return `<div class="row">
        <div class="date"><div class="label" style="letter-spacing:.18em">${esc(e.day.slice(0, 3))}</div><div class="d">${esc(dd)}</div><div class="label" style="letter-spacing:.18em">${esc(mon.slice(0, 3))}</div></div>
        <div class="ev">${esc(e.name)}${e.tag ? ` <span style="font-weight:400;font-size:10pt">(${esc(e.tag)})</span>` : ""}<small>${esc(e.time)}</small></div>
        <div class="venue">${venue}</div></div>`;
    }).join("");
    const s = D.sanchi;
    return page("glance", `
      <div class="center" style="position:absolute;left:12mm;right:12mm;top:17mm">
        <div class="sig" style="font-size:24pt;color:var(--copper);line-height:1">Wedding Timeline</div>
        <div class="label" style="margin-top:2.4mm">${esc(D.dates)}</div>
      </div>
      <div style="position:absolute;left:12mm;right:12mm;top:36mm">${rows}</div>
      <div style="position:absolute;left:12mm;right:12mm;top:149mm;display:grid;grid-template-columns:1fr 1fr;column-gap:4mm">
        <div class="box"><div class="label">Sanchi venue</div>
          <p style="font-family:Ivy,serif;font-weight:500;font-size:10pt;color:var(--brown)">${keepAside(s.name)}</p>
          <p>${s.address.map(val).join(", ")}</p></div>
        <div class="box"><div class="label">From out of town</div>
          ${D.travel.map(([k, v]) => `<p><span class="k">${esc(k)}:</span> ${esc(v)}</p>`).join("")}</div>
      </div>`);
  }

  function eventPage(e, i) {
    where = e.name;
    const v = e.venue;
    // address first, so placeholders are numbered in reading order
    const addrHtml = v.sanchi ? `${keepAside(D.sanchi.name)}<br>${D.sanchi.address.map(val).join(", ")}` : v.address.map(val).join("<br>");
    const mapHtml = mapLinks(v.sanchi ? D.sanchi.map : v.map);
    const sw = e.swatches.length
      ? `<div class="swatches">${e.swatches.map(([n, c]) => `<span class="sw"><i ${c === "glitter" ? 'class="glitter"' : `style="background:${c}"`}></i>${esc(n)}</span>`).join("")}</div>` : "";
    const col = (title, lines) => `<div><div class="label">${title}</div>${lines.map((l) => `<p>${val(l)}</p>`).join("")}</div>`;
    return page(`event ev-${e.art}`, `<div class="stack">
      <div class="head">
        <div class="label">Celebration ${i + 1} of ${D.events.length}</div>
        <h1>${esc(e.name)}${e.tag ? ` <span class="temple">(${esc(e.tag)})</span>` : ""}</h1>
        <div class="subtitle">${esc(e.subtitle)}</div>
        <div class="when">${esc(e.day)} · ${esc(e.date)} · ${esc(e.time)}</div>
      </div>
      <div class="mid">
        <div class="art"><img src="assets/art/${e.art}.jpg" alt=""></div>
        <div class="facts">
          <div class="fact"><div class="label">Theme colours</div><div class="v">${esc(e.theme)}</div>${sw}</div>
          <div class="fact"><div class="label">Dress code</div>
            <ul class="attire">${e.attire.map(([k, a]) => `<li>${k ? `<span>${esc(k)}</span>` : ""}${esc(a)}</li>`).join("")}</ul></div>
        </div>
      </div>
      <div class="lower">
        <div class="box loc">${pin}<div>
          <div class="label">Venue</div>
          <div class="place">${esc(v.place)}</div>
          <div class="town">${esc(v.town)}</div>
          <div class="addr">${addrHtml}</div>
          <div class="map"><span class="k" style="font-weight:500;color:var(--copper)">Map:</span> ${mapHtml}</div>
        </div></div>
        <div class="go">${col("From Bhopal", e.directions.fromBhopal)}${col("From Vidisha", e.directions.fromVidisha)}</div>
      </div></div>`, { mand: [74, 92, 56] });
  }

  function closing() {
    const c = D.couple;
    const [w1, ...rest] = D.closing.split(" ");
    return page("closing", `
      <img class="art" src="assets/closing-art.jpg" alt="">
      <div class="await">
        <div class="sig" style="font-size:34pt;color:var(--copper);line-height:1">${esc(w1)}</div>
        <div class="ivy" style="font-weight:500;font-size:15pt;letter-spacing:.14em;text-transform:uppercase;margin-top:2mm">${esc(rest.join(" "))}</div>
      </div>
      <div class="medal"><img src="assets/medal.jpg" alt="Shantanu & Pragati monogram"></div>
      <div class="center" style="position:absolute;left:12mm;right:12mm;top:147mm">
        <div class="ivy" style="font-size:15pt">${esc(c.groom)} &amp; ${esc(c.bride)}</div>
        <div class="label" style="margin-top:1.6mm">${esc(D.dates)}</div>
        <div class="ivy" style="font-size:11.5pt;color:var(--copper);margin-top:1.8mm">${esc(D.hashtag)}</div>
      </div>
      `, { mand: [74, 98, 60], footer: false });
  }

  function todo() {
    if (!used.size) return "";
    pageNo++;
    const rows = [...used.entries()].map(([id, u]) => `<tr><td style="white-space:nowrap;font-weight:500;color:#8E2318">P${u.no}</td><td>${esc(PHS[id] || id)}</td><td>${[...u.where].map(esc).join(", ")}</td></tr>`).join("");
    // the route sentences were written from the venue address, not supplied: list them for a check
    const routes = [...new Set(D.events.flatMap((e) => [...e.directions.fromBhopal, ...e.directions.fromVidisha]).filter((l) => !isPh(l)))];
    const confirm = [
      ["Travel lines", `from the website’s “How to Reach”, on the schedule page: ${D.travel.map(([k, v]) => `${esc(k)} — ${esc(v)}`).join("; ")}.`],
      ["Directions", `written from the venue address, on the event pages: ${routes.map((r) => `“${esc(r)}”`).join(" ")}`],
      ...(window.CONFIRM || []).map(([k, v]) => [esc(k), esc(v)]),
    ];
    return `<section class="page todo"><div class="trim">
      <div class="frame"></div>
      <div class="content" style="padding:12mm 12mm">
        <span class="warn">NOT PART OF THE INVITE · REMOVE BEFORE SHARING</span>
        <h1 class="ivy" style="font-weight:500;color:var(--copper);font-size:18pt;margin:3mm 0 1mm">Before printing: details to supply</h1>
        <p style="font-size:8pt;line-height:1.4;margin:0 0 2mm">Each item below appears in the invite as a red, dashed <b>PLACEHOLDER</b>. Replace it in <code>invite/data.js</code> and run <code>node invite/build.cjs --final</code>; this page is then left out.</p>
        <table><thead><tr><th>No.</th><th>Detail needed</th><th>Appears on</th></tr></thead><tbody>${rows}</tbody></table>
        <h2>Please confirm</h2>
        <ul>${confirm.map(([k, v]) => `<li><b style="font-weight:500;color:var(--copper-text)">${k}</b> ${v}</li>`).join("")}</ul>
      </div></div></section>`;
  }

  const final = params.has("final");
  const pages = [cover(), glance(), ...D.events.map(eventPage), closing()];
  const todoPage = todo();
  document.getElementById("doc").innerHTML = pages.join("") + (final ? "" : todoPage);
  window.PLACEHOLDERS_USED = [...used.entries()].map(([id, u]) => ({ no: u.no, id, label: PHS[id], where: [...u.where] }));

  window.ready = (async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => im.decode().catch(() => { throw new Error("image failed: " + im.src); })));
    // CSS mask images are fetched lazily; load them before printing
    await Promise.all(["assets/cover-mask.png", "assets/closing-mask.png"].map((src) => { const m = new Image(); m.src = src; return m.decode(); }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // report anything that does not fit its page: text stays inside the inner gold frame and clear of
    // the footer, and each event's theme and dress code fit beside its picture
    const mm = 96 / 25.4, problems = [];
    const what = (el) => `${el.className || el.tagName.toLowerCase()} “${el.textContent.trim().slice(0, 40)}”`;
    document.querySelectorAll(".page").forEach((p, i) => {
      const t = p.querySelector(".trim").getBoundingClientRect();
      const left = t.left + 6 * mm, right = t.right - 6 * mm, bottom = t.bottom - (p.querySelector(".footer") ? 12.5 : 7) * mm;
      const bad = new Set(); // report the outermost element only
      p.querySelectorAll(".content *").forEach((el) => {
        if (el.closest(".content > .art, svg")) return; // the cover and closing pictures run to the edge
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const msg = r.bottom > bottom + 0.5 ? `ends ${((t.bottom - r.bottom) / mm).toFixed(1)} mm from the page bottom`
          : r.right > right + 0.5 || r.left < left - 0.5 ? "runs past the frame" : "";
        if (!msg) return;
        if (!bad.has(el.parentElement)) problems.push(`page ${i + 1}: ${what(el)} ${msg}`);
        bad.add(el);
      });
      p.querySelectorAll(".mid").forEach((m) => {
        const f = m.querySelector(".facts"), mb = m.getBoundingClientRect().bottom;
        if (f.scrollHeight > f.clientHeight + 1 || [...f.children].some((c) => c.getBoundingClientRect().bottom > mb + 0.5)) problems.push(`page ${i + 1}: theme / dress code do not fit beside the picture`);
      });
    });
    return { pages: document.querySelectorAll(".page").length, placeholders: window.PLACEHOLDERS_USED.length, problems };
  })();
})();
