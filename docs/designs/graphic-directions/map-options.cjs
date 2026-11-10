// Three culture map options in the website's style (owner critique 26 Oct 2026, Q-RD3: show three options first). Sample figures only, no client data.
// node map-options.cjs out.html, then print with Chrome. Palette approved Q-RD2: cream, ink, PAC orange, grey, four orientation hues. Wording: Now and Preferred.
const fs = require("fs");
const HUE = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
const OR = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"], NAME = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" };
const ORANGE = "#EB5733", INK = "#131313", GREY = "#727070", CREAM = "#FAF7F2", LINE = "#E6DFD4";
const NOW = { ENGAGE: 14, INNOVATE: 10, PERFORM: 36, GOVERN: 40 }, PREF = { ENGAGE: 30, INNOVATE: 34, PERFORM: 24, GOVERN: 12 };
const SQ = { ENGAGE: [-1, -1], INNOVATE: [1, -1], PERFORM: [1, 1], GOVERN: [-1, 1] };
const STONE = "PERFORM";
const pt = (p) => ({ x: (p.INNOVATE + p.PERFORM - p.ENGAGE - p.GOVERN) / 2, y: (p.PERFORM + p.GOVERN - p.ENGAGE - p.INNOVATE) / 2 });
const F = "Inter, 'DejaVu Sans', Arial, sans-serif";

// ---------------------------------------------------------------- pieces
const quarter = (c, sx, sy, R) => `M${c},${c} L${c + sx * R},${c} A${R},${R} 0 0 ${sx * sy > 0 ? 1 : 0} ${c},${c + sy * R} Z`;
function discs(c, H, kind, uid) {
  // discs are clipped to their own square so they can never spill (critique 647)
  return OR.map((o) => {
    const [sx, sy] = SQ[o], col = HUE[o], R = (v) => (H - 4) * Math.min(v / 50, 1), rn = R(NOW[o]), rp = R(PREF[o]);
    const x0 = sx < 0 ? c - H : c + 2, y0 = sy < 0 ? c - H : c + 2, id = `${uid}${o}`;
    const clip = `<clipPath id="${id}"><rect x="${x0}" y="${y0}" width="${H - 2}" height="${H - 2}" rx="14"/></clipPath>`;
    const solid = `<path d="${quarter(c, sx, sy, rn)}" fill="${col}" fill-opacity=".30"/><path d="${quarter(c, sx, sy, rn)}" fill="none" stroke="${col}" stroke-width="1.6"/>`;
    const dash = `<path d="${quarter(c, sx, sy, rp)}" fill="none" stroke="${ORANGE}" stroke-width="2.2" stroke-dasharray="6 4"/>`;
    const lo = Math.min(rn, rp), hi = Math.max(rn, rp), sw = sx * sy > 0 ? 1 : 0, more = rp > rn;
    const band = hi - lo > 0.5 ? `<path d="M${c + sx * lo},${c} L${c + sx * hi},${c} A${hi},${hi} 0 0 ${sw} ${c},${c + sy * hi} L${c},${c + sy * lo} A${lo},${lo} 0 0 ${1 - sw} ${c + sx * lo},${c} Z" fill="${more ? ORANGE : GREY}" fill-opacity="${more ? ".34" : ".26"}"/>` : "";
    const body = kind === "now" ? solid : kind === "pref" ? dash : solid + band + dash;
    return `<defs>${clip}</defs><g clip-path="url(#${id})">${body}</g>`;
  }).join("");
}
function squares(c, H, labels = true, tint = false) {
  return OR.map((o) => {
    const [sx, sy] = SQ[o], x0 = sx < 0 ? c - H : c + 2, y0 = sy < 0 ? c - H : c + 2, w = H - 2;
    return `<rect x="${x0}" y="${y0}" width="${w}" height="${w}" rx="14" fill="${tint ? HUE[o] : "#fff"}" fill-opacity="${tint ? ".05" : 1}" stroke="${LINE}" stroke-width="1.4"/>` +
      (labels ? `<rect x="${sx < 0 ? x0 + 14 : x0 + w - 14 - 14 - NAME[o].length * 9.9}" y="${sy < 0 ? y0 + 16 : y0 + w - 28}" width="9" height="9" fill="${HUE[o]}"/><text x="${sx < 0 ? x0 + 28 : x0 + w - 14}" y="${sy < 0 ? y0 + 25 : y0 + w - 19}" text-anchor="${sx < 0 ? "start" : "end"}" font-size="11.5" font-weight="800" letter-spacing="1.4" fill="${INK}" font-family="${F}">${NAME[o].toUpperCase()}</text>` : "");
  }).join("");
}
function sides(W, c, H) {
  const g = 26, lab = (t, x, y, r = 0) => `<g transform="rotate(${r} ${x} ${y})"><text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="2.2" fill="${GREY}" font-family="${F}">${t}</text></g>`;
  const arrow = (d) => `<path d="${d}" fill="none" stroke="#CFC7BA" stroke-width="1.4" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
  return `<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="#CFC7BA" stroke-width="1.6"/></marker></defs>
    ${arrow(`M${c - H * .55},${c - H - 14} V${c - H - g + 6} H${c + H * .55} V${c - H - 14}`)}${arrow(`M${c - H * .55},${c + H + 14} V${c + H + g - 6} H${c + H * .55} V${c + H + 14}`)}
    ${arrow(`M${c - H - 14},${c - H * .55} H${c - H - g + 6} V${c + H * .55} H${c - H - 14}`)}${arrow(`M${c + H + 14},${c - H * .55} H${c + H + g - 6} V${c + H * .55} H${c + H + 14}`)}
    ${lab("ADAPTIVE", c, c - H - g + 6)}${lab("STRUCTURED", c, c + H + g - 6)}${lab("INWARD", c - H - g + 6, c, -90)}${lab("OUTWARD", c + H + g - 6, c, 90)}`;
}
const pill = (x, y, t, fill, ink) => { const w = t.length * 7.4 + 20; return `<rect x="${x - w / 2}" y="${y - 10}" width="${w}" height="20" rx="10" fill="${fill}"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10.5" font-weight="800" letter-spacing="1.2" fill="${ink}" font-family="${F}">${t}</text>`; };
function route(c, H, withPills = true) {
  const SC = H / 44, P = (p) => { const q = pt(p); return [c + q.x * SC, c + q.y * SC]; };
  const a = P(NOW), b = P(PREF), [sx, sy] = SQ[STONE];
  const c1 = [b[0], a[1]], c2 = [a[0], b[1]], inSq = (k) => Math.sign(k[0] - c) === sx && Math.sign(k[1] - c) === sy;
  const wp = inSq(c1) ? c1 : inSq(c2) ? c2 : [c + sx * 24, c + sy * 24];
  const line = (p, q, arrow) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${ORANGE}" stroke-width="3" stroke-linecap="round" ${arrow ? 'marker-end="url(#oa)"' : ""}/>`;
  const sh = (p, q, i0, i1) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ux = (q[0] - p[0]) / d, uy = (q[1] - p[1]) / d; return [[p[0] + ux * i0, p[1] + uy * i0], [q[0] - ux * i1, q[1] - uy * i1]]; };
  const r1 = sh(a, wp, 12, 0), r2 = sh(wp, b, 0, 14);
  const chip = (x, y, t) => { const w = t.length * 6.2 + 16; return `<rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="18" rx="9" fill="#fff" stroke="${ORANGE}" stroke-width="1.6"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${INK}" font-family="${F}">${t}</text>`; };
  return `<defs><marker id="oa" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L9,5 L1,9 z" fill="${ORANGE}"/></marker></defs>
    ${line(r1[0], r1[1], false)}${line(r2[0], r2[1], true)}
    <circle cx="${wp[0]}" cy="${wp[1]}" r="6.5" fill="#fff" stroke="${ORANGE}" stroke-width="3"/>${chip(wp[0] + 38, wp[1] + 20, `via ${NAME[STONE]}`)}
    <circle cx="${a[0]}" cy="${a[1]}" r="8" fill="${INK}" stroke="#fff" stroke-width="2.5"/><circle cx="${b[0]}" cy="${b[1]}" r="8" fill="${ORANGE}" stroke="#fff" stroke-width="2.5"/>
    ${withPills ? pill(a[0] - 40, a[1] + 1, "NOW", INK, "#fff") + pill(b[0], b[1] - 24, "PREFERRED", ORANGE, "#fff") : ""}`;
}
function centreMark(c) {   // the website's fingerprint tile: rounded square, orange corner brackets, concentric ridges
  const r = 34, arcs = [7, 12, 17, 22].map((k) => `<path d="M${c - k},${c + 6} A${k},${k} 0 0 1 ${c + k},${c + 6}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M${c - k + 3},${c + 6} V${c + 14 + k * .5}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`).join("");
  const br = (sx, sy) => `<path d="M${c + sx * (r - 8)},${c + sy * (r - 22)} V${c + sy * (r - 8)} H${c + sx * (r - 22)}" fill="none" stroke="${ORANGE}" stroke-width="3" stroke-linecap="round"/>`;
  return `<rect x="${c - r}" y="${c - r}" width="${r * 2}" height="${r * 2}" rx="14" fill="#fff" stroke="${LINE}" stroke-width="1.4"/>${br(-1, -1)}${br(1, -1)}${br(1, 1)}${br(-1, 1)}${arcs}`;
}
const key = (items) => `<div class="key">${items.map(([sw, t]) => `<span><i style="${sw}"></i>${t}</span>`).join("")}</div>`;
const KEY_DISC = [["background:#58A55C;opacity:.55", "Now (solid)"], [`border:2px dashed ${ORANGE}`, "Preferred (dashed)"], [`background:${ORANGE};opacity:.5`, "More wanted than now"], [`background:${GREY};opacity:.4`, "Less wanted than now"]];
const svg = (W, body) => `<svg viewBox="0 0 ${W} ${W}" width="100%" style="display:block">${body}</svg>`;

// ---------------------------------------------------------------- the three options
function opt1() {
  const W = 500, c = W / 2, H = 186;
  const map = svg(W, `${sides(W, c, H)}${squares(c, H)}${centreMark(c)}${route(c, H)}`);
  const small = (kind, label) => { const w = 210, cc = w / 2, h = 98; return `<div class="mini"><svg viewBox="0 0 ${w} ${w}" width="100%">${squares(cc, h, false, true)}${discs(cc, h, kind, "o1" + kind)}</svg><b>${label}</b></div>`; };
  return `<div class="two"><div class="card">${map}</div><div class="card"><h3>Culture fingerprint</h3><p class="s">Each quarter disc is one orientation, sized by how much of it there is. Four orientations, one mark.</p>
    <div class="trio">${small("now", "Now")}${small("pref", "Preferred")}${small("overlay", "Overlaid")}</div>${key(KEY_DISC)}
    <p class="s">The orange route on the map is the move from Now to Preferred. It runs along the axes only, so it passes through the stepping stone, ${NAME[STONE]}.</p><ul class="s"><li><b>Black dot, NOW:</b> where the organisation sits now on the two axes.</li><li><b>Orange dot, PREFERRED:</b> where people want it to be.</li><li><b>Fingerprint:</b> the solid discs are Now, the dashed outlines are Preferred, and in the overlaid mark the shaded edge shows the gap.</li></ul></div></div>`;
}
function opt2() {
  const W = 500, c = W / 2, H = 186;
  const map = svg(W, `${sides(W, c, H)}${squares(c, H, true)}${discs(c, H, "overlay", "o2")}${route(c, H)}`);
  return `<div class="two"><div class="card">${map}</div><div class="card"><h3>How to read it</h3><p class="s">The map and the fingerprint are one picture. Discs stay inside their own square, so there is nothing to untangle.</p>${key(KEY_DISC)}
    <ul class="s"><li><b>Black dot, NOW:</b> where the organisation sits now on the two axes.</li><li><b>Orange dot, PREFERRED:</b> where people want it to be.</li><li><b>Route:</b> the move, through the stepping stone ${NAME[STONE]}.</li><li><b>Shaded edge of a disc:</b> orange means people want more of that orientation, grey means less.</li></ul></div></div>`;
}
function opt3() {
  const W = 340, c = W / 2, H = 156;
  const m = (kind, title, extra, sub) => `<div class="card"><h3>${title}</h3>${svg(W, `${squares(c, H, true)}${discs(c, H, kind, "o3" + kind)}${extra}`)}<p class="s">${sub}</p></div>`;
  const SC = H / 44, P = (p) => { const q = pt(p); return [c + q.x * SC, c + q.y * SC]; };
  const dot = (p, fill, t) => { const [x, y] = P(p); return `<circle cx="${x}" cy="${y}" r="7" fill="${fill}" stroke="#fff" stroke-width="2.2"/>${pill(x - 36, y, t, fill, "#fff")}`; };
  return `<div class="three">${m("now", "Now", dot(NOW, INK, "NOW"), "Solid discs: how much of each orientation there is now.")}${m("pref", "Preferred", dot(PREF, ORANGE, "PREFERRED"), "Dashed outlines: how much people want.")}
    ${m("overlay", "The move", route(c, H, false).replace('id="oa"', 'id="oa3"').replace(/url\(#oa\)/g, "url(#oa3)"), "Orange edge: more wanted. Grey edge: less wanted. The route runs through the stepping stone.")}</div>${key(KEY_DISC)}<div class="card" style="margin-top:8px"><h3>How to read the three maps</h3><ul class="s"><li><b>Now:</b> the black dot is where the organisation sits now, and each solid disc is how much of that orientation there is.</li><li><b>Preferred:</b> the orange dot is where people want it to be, and each dashed outline is how much they want.</li><li><b>The move:</b> orange shading is more wanted than now, grey is less wanted, and the orange route runs along the axes through the stepping stone, ${NAME[STONE]}.</li></ul></div>`;
}

const page = (n, title, sub, body) => `<section class="pg"><div class="hd"><span class="tag">OPTION ${n}</span><h2>${title}</h2><p>${sub}</p></div>${body}</section>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:${CREAM};font-family:${F};color:${INK}}
.pg{width:297mm;height:208mm;padding:10mm 13mm;page-break-after:always;overflow:hidden}.pg:last-child{page-break-after:auto}
.hd h2{font-size:25px;font-weight:800;letter-spacing:-.02em;margin:3px 0 2px}.hd p{font-size:12px;color:${GREY};margin:0 0 9px;max-width:230mm}.tag{font-size:10px;font-weight:800;letter-spacing:2px;color:${ORANGE}}
.card{background:#fff;border:1px solid ${LINE};border-radius:18px;padding:12px 14px}.card h3{margin:0 0 4px;font-size:14px}.s{font-size:12px;color:${GREY};line-height:1.5;margin:4px 0}
.two{display:grid;grid-template-columns:1.5fr 1fr;gap:12px;align-items:stretch}.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.trio{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:6px 0}
.mini b{display:block;text-align:center;font-size:11px;margin-top:2px}.key{display:flex;flex-wrap:wrap;gap:4px 14px;margin:8px 0;font-size:10.5px}.key i{display:inline-block;width:13px;height:13px;border-radius:3px;vertical-align:-2px;margin-right:5px}
ul.s{padding-left:16px}ul.s li{margin:3px 0}
.intro{padding:18mm 20mm}.intro h1{font-size:34px;font-weight:800;letter-spacing:-.02em;margin:0 0 8px}.intro h1 em{color:${ORANGE};font-style:normal}.intro p{font-size:13.5px;line-height:1.6;max-width:220mm}.intro li{font-size:13.5px;margin:6px 0;line-height:1.55}
</style></head><body>
<section class="pg intro"><span class="tag">CULTURE DYNAMICS PROFILE · REPORT GRAPHICS</span><h1>The culture map and fingerprint: <em>three options</em></h1>
<p>Your critique of the draft report: the discs spilled over each other, the labels collided, there was no key, and the map did not look like the website. These three options all use the website's map: cream page, clean white squares, side arrows, NOW and PREFERRED pills and the orange route through the stepping stone. The quarter disc fingerprint you chose is kept, clipped inside its square and always keyed. The wording is Now and Preferred. Same made up figures on every page, no client data.</p>
<ul><li><b>Option 1.</b> The website map with the fingerprint mark in the centre, and the quarter discs shown beside it three ways: Now, Preferred and Overlaid, each keyed.</li>
<li><b>Option 2.</b> One picture: the overlaid discs sit inside the squares of the map, with the route over them and a short how to read it.</li>
<li><b>Option 3.</b> Three small maps in a row: Now, Preferred and the move. Nothing is layered, so each reads at a glance.</li></ul>
<p><b>What I need from you:</b> pick one (or a mix, for example the Option 1 map with the Option 3 row), and say anything to change. Then I rebuild the whole report in the new look.</p></section>
${page(1, "The website map, with the fingerprint beside it", "The map is clean, and the fingerprint has its own keyed panel, so nothing overlaps.", opt1())}
${page(2, "One picture: map and fingerprint together", "The overlaid discs are clipped inside their squares, lightly filled, with the route over them.", opt2())}
${page(3, "Three small maps: Now, Preferred and the move", "Each map shows one idea. The last shows the difference and the route.", opt3())}
</body></html>`;
fs.writeFileSync(process.argv[2], html);
