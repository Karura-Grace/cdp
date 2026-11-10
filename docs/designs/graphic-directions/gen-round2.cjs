// Three graphic directions for the CDP reports, drawn from sample figures (no client data). Orientation hues are the spec's Table 69; PAC orange and black from the brand book.
const fs = require("fs");
const HUE = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
const OR = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"], NAME = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" };
const ORANGE = "#EA5732", INK = "#131313", GREY = "#727070";
const NOW = { ENGAGE: 14, INNOVATE: 10, PERFORM: 36, GOVERN: 40 }, PREF = { ENGAGE: 30, INNOVATE: 34, PERFORM: 24, GOVERN: 12 };
const pt = (p) => ({ x: (p.INNOVATE + p.PERFORM - p.ENGAGE - p.GOVERN) / 2, y: (p.PERFORM + p.GOVERN - p.ENGAGE - p.INNOVATE) / 2 });   // inward/outward, adaptive/structured, in points

const D = {
  A: { id: "A", title: "Direction A: Bold brand", sub: "PAC orange leads. Heavy, confident marks on warm paper. Serif headings, strong colour blocks.",
    font: "Georgia, 'DejaVu Serif', serif", body: "'DejaVu Sans', Arial, sans-serif", paper: "#FAF7F2", card: "#FFFFFF", line: INK, lw: 2.2, rad: 4, fill: 0.16, head: ORANGE, label: (s) => s.toUpperCase(), shadow: "none", icon: "solid" },
  B: { id: "B", title: "Direction B: Clean and minimal", sub: "White space and hairlines. Colour only where it carries meaning. Sans serif, quiet and precise.",
    font: "'DejaVu Sans', Arial, sans-serif", body: "'DejaVu Sans', Arial, sans-serif", paper: "#FFFFFF", card: "#FFFFFF", line: "#D9D6D2", lw: 1, rad: 0, fill: 0.07, head: INK, label: (s) => s, shadow: "none", icon: "line" },
  C: { id: "C", title: "Direction C: Friendly and illustrated", sub: "Rounded shapes, a symbol for every orientation, soft fills. Warm and approachable for staff and leaders.",
    font: "'DejaVu Sans', Arial, sans-serif", body: "'DejaVu Sans', Arial, sans-serif", paper: "#FFF6EF", card: "#FFFFFF", line: "#F0D9CB", lw: 1.4, rad: 16, fill: 0.2, head: ORANGE, label: (s) => s, shadow: "0 2px 0 #F0D9CB", icon: "round" },
};

const icon = (o, s, x, y, size) => {
  const c = HUE[o], r = size / 2, cx = x + r, cy = y + r;
  const solid = s.icon === "solid", line = s.icon === "line";
  const f = solid ? c : "none", st = c, sw = line ? 1.4 : solid ? 0 : 2.2;
  const wrap = (inner) => `<g fill="${f}" stroke="${solid ? "none" : st}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  if (s.icon === "round") return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" fill-opacity=".18"/>${iconShape(o, cx, cy, r * 0.58, c, "round")}</g>`;
  return wrap(iconShape(o, cx, cy, r * 0.9, c, solid ? "solid" : "line"));
};
function iconShape(o, cx, cy, r, c, mode) {
  const fill = mode === "solid" ? c : "none";
  const sw = mode === "solid" ? 0 : mode === "line" ? 1.4 : 2.2;
  const base = `fill="${fill}" stroke="${mode === "solid" ? "none" : c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  if (o === "ENGAGE") return `<circle cx="${cx - r * .38}" cy="${cy}" r="${r * .62}" ${base} fill-opacity="${mode === "solid" ? .85 : 0}"/><circle cx="${cx + r * .38}" cy="${cy}" r="${r * .62}" ${base} fill-opacity="${mode === "solid" ? .55 : 0}"/>`;
  if (o === "INNOVATE") { const p = []; for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i - Math.PI / 8, rr = i % 2 ? r * .45 : r; p.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`); } return `<polygon points="${p.join(" ")}" ${base}/>`; }
  if (o === "PERFORM") return `<circle cx="${cx}" cy="${cy}" r="${r}" ${base}/><circle cx="${cx}" cy="${cy}" r="${r * .62}" fill="none" stroke="${mode === "solid" ? "#fff" : c}" stroke-width="${mode === "solid" ? 2 : sw}"/><circle cx="${cx}" cy="${cy}" r="${r * .25}" fill="${mode === "solid" ? "#fff" : c}"/>`;
  return `<path d="M${cx},${cy - r} L${cx + r * .85},${cy - r * .5} L${cx + r * .85},${cy + r * .15} Q${cx + r * .85},${cy + r * .75} ${cx},${cy + r} Q${cx - r * .85},${cy + r * .75} ${cx - r * .85},${cy + r * .15} L${cx - r * .85},${cy - r * .5} Z" ${base}/>`;
}

// ---------------------------------------------------------------- the culture map with its fingerprint, and the route through a stepping stone
const SQ = { ENGAGE: [-1, -1], INNOVATE: [1, -1], PERFORM: [1, 1], GOVERN: [-1, 1] };
const STONE = "PERFORM";   // Govern to Innovate is diagonal: the engine names the stepping stone (spec 6.5.1), here the stronger neighbour today
function fingerprintMarks(s, v, C, H, prof, kind) {
  // kind "now": solid; kind "pref": outline. v 1 = nested squares, v 2 = quarter discs (a rose), both sized by the score (50 = a full square)
  return OR.map((o) => {
    const [sx, sy] = SQ[o], f = Math.min(prof[o] / 50, 1), L = (H - 3) * f, col = HUE[o];
    const x0 = sx < 0 ? C - L : C + 0, y0 = sy < 0 ? C - L : C + 0;
    const fill = kind === "now" ? `fill="${col}" fill-opacity="${s.id === "B" ? .3 : .38}" stroke="${col}" stroke-width="${s.id === "B" ? 1 : 1.6}"` : `fill="none" stroke="${ORANGE}" stroke-width="${s.id === "B" ? 1.8 : 2.6}" stroke-dasharray="${kind === "pref" ? "5 3" : ""}"`;
    if (v === 1) return `<rect x="${x0}" y="${y0}" width="${L}" height="${L}" rx="${s.rad ? Math.min(s.rad, 8) : 0}" ${fill}/>`;
    const R = L * 1.12, ex = C + sx * R, ey = C + sy * R;
    return `<path d="M${C},${C} L${ex},${C} A${R},${R} 0 0 ${sx * sy > 0 ? 1 : 0} ${C},${ey} Z" ${fill}/>`;
  }).join("");
}
function cultureMap(s, W = 430, v = 1, route = true, labels = true) {
  const C = W / 2, H = W * .39, SC = H / 44;
  const P = (p) => { const q = pt(p); return [C + q.x * SC, C + q.y * SC]; };
  const a = P(NOW), b = P(PREF);
  // the corner of the two axis legs that lies in the stepping stone's square
  const [sx, sy] = SQ[STONE];
  const c1 = [b[0], a[1]], c2 = [a[0], b[1]];
  const inSq = (c) => Math.sign(c[0] - C) === sx && Math.sign(c[1] - C) === sy;
  const wp = inSq(c1) ? c1 : inSq(c2) ? c2 : [C + sx * 20, C + sy * 20];
  const sq = (o) => { const [qx, qy] = SQ[o], x0 = qx < 0 ? C - H : C + 3, y0 = qy < 0 ? C - H : C + 3, w = H - 3; return `<rect x="${x0}" y="${y0}" width="${w}" height="${w}" rx="${s.rad}" fill="${HUE[o]}" fill-opacity="${s.fill * .55}" stroke="${HUE[o]}" stroke-opacity=".5" stroke-width="${s.lw}"/>` +
    (labels ? `<text x="${qx < 0 ? x0 + 10 : x0 + w - 10}" y="${qy < 0 ? y0 + 20 : y0 + w - 10}" text-anchor="${qx < 0 ? "start" : "end"}" font-size="12" font-weight="700" letter-spacing="1" fill="${HUE[o]}" font-family="${s.body}">${s.label(NAME[o])}</text>` : ""); };
  const seg = (p, q, arrow) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${ORANGE}" stroke-width="${s.id === "B" ? 2 : 3}" stroke-linecap="round" ${arrow ? 'marker-end="url(#h' + s.id + v + ')"' : ""}/>`;
  const shorten = (p, q, i0, i1) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ux = (q[0] - p[0]) / d, uy = (q[1] - p[1]) / d; return [[p[0] + ux * i0, p[1] + uy * i0], [q[0] - ux * i1, q[1] - uy * i1]]; };
  const dot = (p, fill, label, above) => `<circle cx="${p[0]}" cy="${p[1]}" r="9" fill="${fill}" stroke="#fff" stroke-width="2.5"/>` + (above ? `<text x="${p[0]}" y="${p[1] - 15}" text-anchor="middle" font-size="10" font-weight="700" fill="${INK}" font-family="${s.body}">${label}</text>` : `<text x="${p[0] - 14}" y="${p[1] + 4}" text-anchor="end" font-size="10" font-weight="700" fill="${INK}" font-family="${s.body}">${label}</text>`);
  const r1 = shorten(a, wp, 11, 0), r2 = shorten(wp, b, 0, 12);
  return `<svg viewBox="0 0 ${W} ${W}" width="100%"><defs><marker id="h${s.id}${v}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1,1 L9,5 L1,9 z" fill="${ORANGE}"/></marker></defs>
    ${OR.map(sq).join("")}
    ${fingerprintMarks(s, v, C, H, NOW, "now")}${fingerprintMarks(s, v, C, H, PREF, "pref")}
    <path d="M${C - H},${C} H${C + H} M${C},${C - H} V${C + H}" stroke="${s.id === "B" ? "#bbb" : INK}" stroke-opacity="${s.id === "B" ? 1 : .3}" stroke-width="1"/>
    ${labels ? [["ADAPTIVE", C, 14], ["STRUCTURED", C, W - 6]].map(([t, x, y]) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" letter-spacing="2" fill="${GREY}" font-family="${s.body}">${t}</text>`).join("") + `<text x="10" y="${C}" font-size="9" letter-spacing="2" fill="${GREY}" text-anchor="middle" transform="rotate(-90 10 ${C})" font-family="${s.body}">INWARD</text><text x="${W - 4}" y="${C}" font-size="9" letter-spacing="2" fill="${GREY}" text-anchor="middle" transform="rotate(90 ${W - 4} ${C})" font-family="${s.body}">OUTWARD</text>` : ""}
    ${route ? seg(r1[0], r1[1], false) + seg(r2[0], r2[1], true) + `<circle cx="${wp[0]}" cy="${wp[1]}" r="6" fill="#fff" stroke="${ORANGE}" stroke-width="2.6"/><rect x="${wp[0] + 10}" y="${wp[1] - 8}" width="${(`via ${NAME[STONE]}`).length * 5.6 + 8}" height="15" rx="7.5" fill="#fff" fill-opacity=".92" stroke="${ORANGE}" stroke-width="1"/><text x="${wp[0] + 14}" y="${wp[1] + 3}" text-anchor="start" font-size="9.5" font-weight="700" fill="${INK}" font-family="${s.body}">via ${NAME[STONE]}</text>${dot(a, INK, "TODAY", false)}${dot(b, ORANGE, "PREFERRED", true)}` : ""}</svg>`;
}

// ---------------------------------------------------------------- radar
function radar(s, W = 300) {
  const C = W / 2, R = W * .36, ang = [-90, 0, 90, 180].map((d) => (d * Math.PI) / 180), key = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"];
  const poly = (p, max = 50) => key.map((k, i) => `${C + (p[k] / max) * R * Math.cos(ang[i])},${C + (p[k] / max) * R * Math.sin(ang[i])}`).join(" ");
  const ring = (f) => `<polygon points="${key.map((k, i) => `${C + f * R * Math.cos(ang[i])},${C + f * R * Math.sin(ang[i])}`).join(" ")}" fill="none" stroke="${s.id === "B" ? "#e4e1dd" : "#d9d3cc"}" stroke-width="1"/>`;
  return `<svg viewBox="-34 -6 ${W + 68} ${W + 12}" width="100%">${[.25, .5, .75, 1].map(ring).join("")}
    ${key.map((k, i) => `<line x1="${C}" y1="${C}" x2="${C + R * Math.cos(ang[i])}" y2="${C + R * Math.sin(ang[i])}" stroke="#d9d3cc"/><text x="${C + (R + 22) * Math.cos(ang[i])}" y="${C + (R + 22) * Math.sin(ang[i]) + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${HUE[k]}" font-family="${s.body}">${s.label(NAME[k])}</text>`).join("")}
    <polygon points="${poly(PREF)}" fill="${ORANGE}" fill-opacity="${s.id === "B" ? .08 : .18}" stroke="${ORANGE}" stroke-width="${s.lw + .6}" stroke-dasharray="${s.id === "A" ? "" : "5 3"}"/>
    <polygon points="${poly(NOW)}" fill="${INK}" fill-opacity="${s.id === "B" ? .05 : .12}" stroke="${INK}" stroke-width="${s.lw + .6}"/>
    ${key.map((k, i) => `<circle cx="${C + (NOW[k] / 50) * R * Math.cos(ang[i])}" cy="${C + (NOW[k] / 50) * R * Math.sin(ang[i])}" r="4" fill="${INK}"/>`).join("")}</svg>`;
}

// ---------------------------------------------------------------- heatmap with hatched, suppressed cells
const ROWS = [["Operations", 142, [-9, -4, 8, 5]], ["Finance", 88, [3, -2, -6, 5]], ["Sales", 104, [-2, 9, 4, -11]], ["Nairobi", 230, [1, 0, 1, -2]], ["Mombasa", 104, [-3, 1, -2, 4]], ["Executives", 5, [-14, -6, 11, 9]], ["New joiners", 3, null]];
function fingerprintOnly(s, v, kind) {
  const W = 200, C = W / 2, H = 86;
  const quad = OR.map((o) => { const [qx, qy] = SQ[o], x0 = qx < 0 ? C - H : C + 2, y0 = qy < 0 ? C - H : C + 2; return `<rect x="${x0}" y="${y0}" width="${H - 2}" height="${H - 2}" rx="${s.rad}" fill="${HUE[o]}" fill-opacity=".07" stroke="${HUE[o]}" stroke-opacity=".35" stroke-width="1"/>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${W}" width="100%">${quad}${fingerprintMarks(s, v, C, H, kind === "now" ? NOW : PREF, kind)}</svg>`;
}
function heatmap(s) {
  const cw = 78, rh = 30, x0 = 118, y0 = 36, W = x0 + cw * 4 + 10, H = y0 + rh * ROWS.length + 28;
  const shade = (d, o) => { const v = Math.min(Math.abs(d) / 12, 1); const base = d >= 0 ? HUE[o] : ORANGE; return [base, 0.12 + v * 0.55]; };
  let g = `<defs><pattern id="hatch${s.id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#f3efea"/><line x1="0" y1="0" x2="0" y2="7" stroke="#b9b2aa" stroke-width="2"/></pattern></defs>`;
  OR.forEach((o, i) => { g += `<text x="${x0 + cw * i + cw / 2}" y="22" text-anchor="middle" font-size="10" font-weight="700" fill="${HUE[o]}" font-family="${s.body}">${s.label(NAME[o])}</text>`; });
  ROWS.forEach(([n, cnt, v], r) => {
    const y = y0 + r * rh;
    g += `<text x="0" y="${y + 19}" font-size="11" fill="${INK}" font-family="${s.body}">${n}</text><text x="${x0 - 8}" y="${y + 19}" text-anchor="end" font-size="9" fill="${GREY}" font-family="${s.body}">${v ? "n " + cnt : ""}</text>`;
    if (!v) { g += `<rect x="${x0}" y="${y + 2}" width="${cw * 4 - 4}" height="${rh - 4}" rx="${s.rad / 3}" fill="url(#hatch${s.id})" stroke="#cfc8bf"/><text x="${x0 + cw * 2 - 2}" y="${y + 19}" text-anchor="middle" font-size="10" font-style="italic" fill="${INK}" font-family="${s.body}">below reporting threshold, merged into the organisation</text>`; return; }
    v.forEach((d, i) => { const [c, op] = shade(d, OR[i]); g += `<rect x="${x0 + cw * i}" y="${y + 2}" width="${cw - 4}" height="${rh - 4}" rx="${s.rad / 3}" fill="${c}" fill-opacity="${op}"/><text x="${x0 + cw * i + (cw - 4) / 2}" y="${y + 19}" text-anchor="middle" font-size="11" font-weight="${Math.abs(d) >= 8 ? 700 : 400}" fill="${INK}" font-family="${s.body}">${d > 0 ? "+" : ""}${d}${Math.abs(d) >= 8 ? "  ▲" : ""}</text>`; });
  });
  g += `<text x="0" y="${H - 6}" font-size="9" fill="${GREY}" font-family="${s.body}">Cell = group minus organisation, in points. Marked at 8 or more.</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg>`;
}

// ---------------------------------------------------------------- gauges and score tiles
function gauge(s, label, val, max, band, note, color) {
  const W = 150, H = 100, R = 56, cx = 75, cy = 82, a0 = Math.PI, f = val / max;
  const arc = (t) => `${cx + R * Math.cos(a0 + Math.PI * t)},${cy + R * Math.sin(a0 + Math.PI * t)}`;
  return `<div class="tile"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:96px"><path d="M${arc(0)} A${R},${R} 0 0 1 ${arc(1)}" fill="none" stroke="${s.id === "B" ? "#ece9e5" : "#eadfd5"}" stroke-width="${s.id === "B" ? 8 : 13}" stroke-linecap="${s.id === "A" ? "butt" : "round"}"/>
    <path d="M${arc(0)} A${R},${R} 0 0 1 ${arc(f)}" fill="none" stroke="${color}" stroke-width="${s.id === "B" ? 8 : 13}" stroke-linecap="${s.id === "A" ? "butt" : "round"}"/>
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="24" font-weight="700" fill="${INK}" font-family="${s.font}">${val}</text></svg>
    <div class="tl">${label}</div><div class="tn"><b>${band}</b>. ${note}</div></div>`;
}
const tile = (s, label, big, note, color) => `<div class="tile"><div class="big" style="color:${color}">${big}</div><div class="tl">${label}</div><div class="tn">${note}</div></div>`;

// ---------------------------------------------------------------- cover and divider
function cover(s) {
  const dark = s.id === "A";
  return `<div class="cover" style="background:${s.id === "B" ? "#fff" : ORANGE};border:${s.id === "B" ? "1px solid #D9D6D2" : "none"};border-radius:${s.id === "C" ? 18 : s.id === "A" ? 0 : 0}px">
    ${s.id === "A" ? `<svg viewBox="0 0 300 200" class="deco"><polygon points="0,200 120,60 190,200" fill="#8B2F16" fill-opacity=".55"/><polygon points="190,200 250,90 300,200" fill="#727070" fill-opacity=".7"/><polygon points="230,0 300,0 300,70" fill="#131313" fill-opacity=".85"/></svg>` : ""}
    ${s.id === "C" ? `<svg viewBox="0 0 300 200" class="deco"><circle cx="250" cy="40" r="46" fill="#fff" fill-opacity=".18"/><circle cx="290" cy="120" r="30" fill="#fff" fill-opacity=".14"/><circle cx="40" cy="190" r="50" fill="#fff" fill-opacity=".12"/></svg>` : ""}
    ${s.id === "B" ? `<div style="position:absolute;left:0;top:0;bottom:0;width:10px;background:${ORANGE}"></div>` : ""}
    <div class="ct" style="color:${s.id === "B" ? INK : "#fff"}"><div class="ce">PRIORITY ACTIVATOR CONSULTING</div><div class="ch" style="font-family:${s.font}">Culture Dynamics Profile</div><div class="cs">Sub-culture report · October 2026</div></div>
    <div style="position:absolute;right:12px;top:10px;display:flex;gap:4px">${OR.map((o) => `<svg width="20" height="20" viewBox="0 0 26 26">${s.id === "B" ? iconShape(o, 13, 13, 11, HUE[o], "line") : `<circle cx="13" cy="13" r="13" fill="#fff" fill-opacity=".95"/>${iconShape(o, 13, 13, 8.5, HUE[o], s.id === "A" ? "solid" : "round")}`}</svg>`).join("")}</div></div>`;
}
function divider(s) {
  const bg = s.id === "A" ? INK : s.id === "B" ? "#F5F3F0" : "#FFE8D9";
  const fg = s.id === "A" ? "#fff" : INK;
  return `<div class="cover" style="background:${bg};height:62px;border-radius:${s.rad ? 16 : 0}px"><div class="ct" style="color:${fg};top:10px"><div class="ce" style="color:${ORANGE};margin-bottom:2px">PART 3</div><div class="ch" style="font-size:15px;font-family:${s.font}">What the groups say</div></div>
    <svg width="44" height="44" viewBox="0 0 64 64" style="position:absolute;right:14px;top:9px">${iconShape("PERFORM", 32, 32, 28, s.id === "A" ? "#fff" : ORANGE, s.id === "A" ? "line" : s.id === "B" ? "line" : "round")}</svg></div>`;
}
const legend = (s) => `<div style="display:flex;flex-wrap:wrap;gap:2px 10px">` + OR.map((o) => `<span class="lg"><svg width="16" height="16">${s.id === "B" ? `<rect x="2" y="2" width="12" height="12" fill="none" stroke="${HUE[o]}" stroke-width="2"/>` : `<rect x="1" y="1" width="14" height="14" rx="${s.rad / 3}" fill="${HUE[o]}"/>`}</svg>${NAME[o]}</span>`).join("") + `</div>`;
const verdict = (s, w, c) => `<span class="vd" style="background:${c}1f;color:${c};border:1px solid ${c}55;border-radius:${s.rad ? 20 : 2}px">${w}</span>`;

function sheet(s, v) {
  const css = `
  .sheet{width:100%;font-family:${s.body};color:${INK};background:${s.paper};padding:0}
  .sheet h1{font-family:${s.font};font-size:18px;margin:0 0 1px;color:${s.head}}
  .sheet .sub{font-size:10px;color:${GREY};margin-bottom:6px}
  .grid{display:grid;grid-template-columns:.9fr 1fr 1.15fr;gap:9px}
  .card{background:${s.card};border:${s.lw}px solid ${s.line};border-radius:${s.rad}px;padding:6px 8px;box-shadow:${s.shadow}}
  .card h2{font-family:${s.font};font-size:12.5px;margin:0 0 6px;color:${s.id === "B" ? INK : s.head};${s.id === "A" ? "letter-spacing:.5px;text-transform:uppercase;font-family:" + s.body + ";font-size:10.5px" : ""}}
  .tiles{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .tile{background:${s.id === "B" ? "#fff" : "#fff"};border:${s.id === "B" ? "1px solid #E4E1DD" : s.lw + "px solid " + s.line};border-radius:${s.rad ? s.rad - 4 : 0}px;padding:6px 8px;text-align:center}
  .tl{font-size:9px;font-weight:700;margin-top:1px}.tn{font-size:8px;color:${GREY};margin-top:1px}.big{font-family:${s.font};font-size:21px;font-weight:700}
  .lg{font-size:9.5px;display:inline-flex;align-items:center;gap:3px;white-space:nowrap}
  .cover{position:relative;height:84px;overflow:hidden}.deco{position:absolute;inset:0;width:100%;height:100%}.ct{position:absolute;left:14px;top:30px;right:14px}
  .ce{font-size:8px;letter-spacing:2.5px;font-weight:700;margin-bottom:6px}.ch{font-size:19px;font-weight:700;line-height:1.1}.cs{font-size:10px;margin-top:8px;opacity:.9}
  .vd{font-size:9px;font-weight:700;padding:2px 8px;display:inline-block;margin-right:4px}
  .ics{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ics div{font-size:9.5px;text-align:center}
  .recs{font-size:9.5px;line-height:1.35}.recs li{margin:2px 0}
  .callout{border-left:${s.id === "B" ? 2 : 4}px solid ${ORANGE};background:${s.id === "B" ? "#fff" : "#FFF1EA"};padding:6px 9px;font-size:10px;border-radius:${s.rad ? 8 : 0}px;margin-top:6px}`;
  const icons = `<div class="ics">${OR.map((o) => `<div><svg width="44" height="44" viewBox="0 0 44 44">${icon(o, s, 4, 4, 36)}</svg><br>${NAME[o]}</div>`).join("")}</div>`;
  const scoped = css.replace(/(^|\})\s*([^{}]+)\{/g, (m, a, sel) => a + sel.split(",").map((x) => `.S${s.id} ${x.trim()}`).join(",") + "{");
  return `<div class="S${s.id}"><section class="sheet"><style>${scoped}</style>
    <h1>${s.title} (variant ${s.id}${v})</h1><div class="sub">${s.sub} ${v === 1 ? "Fingerprint: nested squares." : "Fingerprint: quarter discs, like a rose."}</div>
    <div class="grid">
      <div class="card"><h2>Culture map</h2><div style="max-width:236px;margin:0 auto">${cultureMap(s, 430, v)}</div>${legend(s)}<div class="callout"><b>A move never cuts across a diagonal.</b> Govern to Innovate runs through its stepping stone, Perform, shown as a labelled dot. Filled shapes are today, dashed outlines are preferred.</div></div>
      <div class="card"><h2>Culture fingerprint: today and preferred</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div><div style="max-width:150px;margin:0 auto">${fingerprintOnly(s, v, "now")}</div><div style="text-align:center;font-size:9.5px;font-weight:700">Today</div></div><div><div style="max-width:150px;margin:0 auto">${fingerprintOnly(s, v, "pref")}</div><div style="text-align:center;font-size:9.5px;font-weight:700">Preferred</div></div></div><div style="font-size:9px;color:${GREY};margin-top:4px">Each square grows with the share of that orientation. The same mark appears on every cover, summary and group page.</div></div>
      <div class="card"><h2>Groups against the organisation</h2>${heatmap(s)}</div>
    </div>
    <div class="grid" style="margin-top:9px;grid-template-columns:.9fr 1fr 1.15fr">
      <div class="card"><h2>Cover and section divider</h2>${cover(s)}<div style="height:6px"></div>${divider(s)}</div>
      <div class="card"><h2>Symbols and verdicts</h2>${icons}<div style="margin-top:10px">${verdict(s, "HIT", HUE.GOVERN)}${verdict(s, "PARTIAL HIT", "#B7791F")}${verdict(s, "MISS", HUE.PERFORM)}</div><div style="font-size:9px;color:${GREY};margin-top:5px">Every verdict carries its word, never colour alone.</div></div>
      <div class="card"><h2>Gauges and score tiles</h2>
        <div class="tiles">${gauge(s, "Transformation readiness", 3.4, 5, "Provisional", "leader coverage 42%", ORANGE)}${tile(s, "Alignment with the target", "72%", "Partial hit", ORANGE)}${tile(s, "Employee voice index", "+7.1", "Two categories negative", HUE.ENGAGE)}</div>
        <div style="margin-top:6px" class="tiles">${tile(s, "Perception gap", "6.4", "Executives and staff differ", HUE.PERFORM)}${tile(s, "Sub-cultures confirmed", "2 of 7", "Operations, Executives", HUE.INNOVATE)}${gauge(s, "Psychological safety", 3.1, 5, "Watch", "below 3.5 holds work", HUE.GOVERN)}</div>
      </div>
    </div>
  </section></div>`;
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:9mm}body{margin:0}.pg{page-break-after:always}.pg:last-child{page-break-after:auto}
  .intro{font-family:Georgia,serif}.intro h1{font-size:26px;color:${ORANGE};margin:0 0 6px}.intro p{font-size:12px;line-height:1.5;max-width:210mm}.intro li{font-size:12px;margin:3px 0}</style></head><body>
  <div class="pg intro"><h1>CDP report graphics, round 2: six variants</h1>
  <p>Same format as round 1, now with your two changes, on the same made up figures (no client data).</p>
  <ul><li><b>The culture map never cuts across a diagonal.</b> A shift between opposite corners goes through its stepping stone (spec 6.5.1). In the sample, Govern to Innovate runs through Perform: the line is Today, then the Perform square (a labelled dot, "via Perform"), then Preferred. The stone is chosen by the rule in the specification, not drawn by hand.</li>
  <li><b>Today and preferred are a culture fingerprint.</b> Each of the four squares fills according to how much of that orientation there is: solid for today, dashed outline for preferred, on the same map and again as a small mark you can reuse on covers and group pages.</li></ul>
  <p><b>Two fingerprint shapes, three styles, six variants.</b> Variant 1 (nested squares) and variant 2 (quarter discs, like a rose), each in the three styles from round 1: A bold brand, B clean and minimal, C friendly and illustrated. Pages 2 to 7 are A1, A2, B1, B2, C1, C2.</p>
  <p><b>What I need from you.</b> Tell me the variant, or mix (for example A1 cover with the C2 fingerprint), and anything to change.</p></div>
  ${[["A", 1], ["A", 2], ["B", 1], ["B", 2], ["C", 1], ["C", 2]].map(([k, v]) => `<div class="pg">${sheet(D[k], v)}</div>`).join("")}</body></html>`;
fs.writeFileSync(process.argv[2], html);
