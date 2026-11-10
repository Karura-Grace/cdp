// Preview sheet of the chosen culture graphic (owner picks Q-RD15 to Q-RD22): three framed maps, the concentric chart and a key, on made up figures (no client data).
// Run: node --experimental-strip-types scripts/map-chosen.mts out.html   then print with Chrome.
import { writeFileSync } from "node:fs";
import { C, concentricDrawing, mapDrawing, toSvg, type Prof } from "../apps/web/lib/graphics/culture.ts";

const NOW: Prof = { ENGAGE: 14, INNOVATE: 10, PERFORM: 36, GOVERN: 40 }, PREF: Prof = { ENGAGE: 30, INNOVATE: 34, PERFORM: 24, GOVERN: 12 };
const key = `<div class="key"><span><i style="background:#58A55C;opacity:.55"></i>Now (solid)</span><span><i style="border:2px dashed ${C.orange}"></i>Preferred (dashed)</span><span><i style="background:${C.orange};opacity:.5"></i>More wanted than Now</span><span><i style="background:${C.grey};opacity:.4"></i>Less wanted than Now</span><span><b style="font-size:11px">36</b>&nbsp;the score on its ring (points)</span></div>`;
const card = (t: string, body: string, note: string) => `<div class="card"><h3>${t}</h3>${body}<p class="s">${note}</p></div>`;
const page = (title: string, sub: string, body: string) => `<section class="pg"><div class="hd"><span class="tag">CHOSEN GRAPHIC · PREVIEW</span><h2>${title}</h2><p>${sub}</p></div>${body}</section>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:${C.cream};font-family:Inter,'Segoe UI','DejaVu Sans',Arial,sans-serif;color:${C.ink}}
.pg{width:297mm;height:208mm;padding:10mm 13mm;page-break-after:always;overflow:hidden}.pg:last-child{page-break-after:auto}
.hd h2{font-size:25px;font-weight:800;letter-spacing:-.02em;margin:3px 0 2px}.hd p{font-size:12px;color:${C.grey};margin:0 0 9px;max-width:240mm}.tag{font-size:10px;font-weight:800;letter-spacing:2px;color:${C.orange}}
.card{background:#fff;border:1px solid ${C.line};border-radius:18px;padding:10px 12px}.card h3{margin:0 0 2px;font-size:14px;font-weight:800}.s{font-size:11.5px;color:${C.grey};line-height:1.5;margin:4px 0}
.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.two{display:grid;grid-template-columns:1.6fr 1fr;gap:12px;align-items:start}
.key{display:flex;flex-wrap:wrap;gap:4px 16px;margin:8px 0;font-size:11px}.key i{display:inline-block;width:13px;height:13px;border-radius:3px;vertical-align:-2px;margin-right:5px}
</style></head><body>
${page("Now, Preferred and the move, on the rings", "Each map has the frame, the rings at 10 to 40 points, the four scores as labelled points, and the map dot. The last map shows the gap and the route through the stepping stone.",
  `<div class="three">${card("Now", toSvg(mapDrawing("now", NOW, PREF, "PERFORM", 340), "a"), "Solid discs and black points: how much of each orientation there is now.")}${card("Preferred", toSvg(mapDrawing("pref", NOW, PREF, "PERFORM", 340), "b"), "Dashed outlines and orange points: how much people want.")}${card("The move", toSvg(mapDrawing("move", NOW, PREF, "PERFORM", 340), "c"), "Orange edge: more wanted. Grey edge: less wanted. The route runs along the axes through the stepping stone.")}</div>${key}`)}
${page("The same scores on a concentric chart", "Four slices in the squares' corners, each filled to its Now score, with the Preferred edge dashed and the rings at 10, 20, 30 and 40 points.",
  `<div class="two">${card("Concentric chart", toSvg(concentricDrawing(NOW, PREF, 420), "d"), "A slice reaching the outer ring is a full square (50 points). Numbers on the slices are the Now scores; orange tags are the Preferred scores where they differ clearly.")}<div class="card"><h3>How to read it</h3><ul class="s"><li>Each slice is one orientation, in the same corner as its square on the map.</li><li>The rings are score levels in points: 10, 20, 30 and 40.</li><li>Solid colour is Now. The dashed orange edge is Preferred.</li><li>Where the dashed edge is outside the solid slice, people want more of that orientation. Inside, they want less.</li></ul>${key}</div></div>`)}
</body></html>`;
writeFileSync(process.argv[2] ?? "map-chosen.html", html);
