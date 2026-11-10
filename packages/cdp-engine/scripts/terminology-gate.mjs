#!/usr/bin/env node
// Terminology build gate (spec §0.2). Fails the build on any deny-listed term in source, seed data, UI strings,
// locale files, report templates or AI prompts. The deny-list is PAC-restricted: pass its path via CDP_DENY_LIST
// (a CI secret file), never commit it. Usage: node scripts/terminology-gate.mjs [dir ...]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
const listPath = process.env.CDP_DENY_LIST;
if (!listPath || !existsSync(listPath)) { console.error("terminology-gate: CDP_DENY_LIST not set or missing — failing closed"); process.exit(2); }
const terms = readFileSync(listPath, "utf8").split("\n").map((t) => t.trim().toLowerCase()).filter((t) => t && !t.startsWith("#"));
const exts = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".sql", ".md", ".html", ".yaml", ".yml", ".txt", ".po"]);
const skip = new Set(["node_modules", ".git", "dist", ".next", "coverage"]);
const hits = [];
const walk = (d) => { for (const f of readdirSync(d)) { if (skip.has(f)) continue; const p = join(d, f); const s = statSync(p);
  if (s.isDirectory()) walk(p); else if (exts.has(extname(f))) readFileSync(p, "utf8").split("\n").forEach((ln, i) => { const l = ln.toLowerCase(); if (terms.some((t) => l.includes(t))) hits.push(`${p}:${i + 1}`); }); } };
(process.argv.slice(2).length ? process.argv.slice(2) : ["."]).forEach(walk);
if (hits.length) { console.error(`terminology-gate: ${hits.length} hit(s)\n` + hits.join("\n")); process.exit(1); }
console.log(`terminology-gate: clean (${terms.length} terms)`);
