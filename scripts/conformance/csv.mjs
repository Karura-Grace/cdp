// Minimal RFC 4180 CSV read and write for the spec cross check matrix (quoted fields, doubled quotes, newlines in quotes).
export function parseCsv(text) {
  const out = [], rec = [];
  let f = "", q = false;
  const end = () => { rec.push(f); f = ""; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") end();
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; end(); out.push(rec.splice(0)); }
    else f += c;
  }
  if (f || rec.length) { end(); out.push(rec.splice(0)); }
  const [head, ...body] = out.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function toCsv(rows, cols) {
  const cell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}
