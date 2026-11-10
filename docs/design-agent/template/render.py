import sys, json, glob, os
from playwright.sync_api import sync_playwright
OUT = "/tmp/w/out/cdp_report/template"
PX = 96 / 72
res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 900, "height": 1200}, device_scale_factor=1.5)
    PAT = sys.argv[1] if len(sys.argv) > 1 else "*"
    for f in sorted(glob.glob(f"{OUT}/{PAT}.html")):
        name = os.path.basename(f)[:-5]
        pg.goto("file://" + f); pg.wait_for_load_state("networkidle")
        pg.evaluate("document.fonts.ready")
        info = pg.evaluate("""() => {
          const PX = 96/72; const out = [];
          document.querySelectorAll('section.page').forEach((s, si) => {
            const sr = s.getBoundingClientRect();
            const r = el => { const b = el.getBoundingClientRect(); return [+((b.left-sr.left)/PX).toFixed(2), +((b.top-sr.top)/PX).toFixed(2), +(b.width/PX).toFixed(2), +(b.height/PX).toFixed(2)]; };
            const items = [];
            s.querySelectorAll('[id], [data-block], table tr, img, .card, .callout').forEach(el => items.push({tag: el.tagName, id: el.id || el.dataset.block || '', text: (el.innerText||el.alt||'').slice(0,50).replace(/\\n/g,' | '), box: r(el)}));
            // overflow check: any text element whose scroll size exceeds its box
            const over = [];
            s.querySelectorAll('.abs').forEach(el => { if (el.scrollHeight > el.clientHeight + 1 && el.style.height) over.push((el.innerText||'').slice(0,40)); });
            // lowest content bottom (excluding header/footer)
            let maxb = 0; s.querySelectorAll('.abs').forEach(el => { if (el.closest('header,footer')) return; const b = r(el); if (b[1] > 60 && b[1] < 780 && b[3] < 700) maxb = Math.max(maxb, b[1]+b[3]); });
            const fonts = [...new Set([...s.querySelectorAll('*')].map(e => getComputedStyle(e).fontFamily))];
            out.push({page: si, items, over, maxBottom: +maxb.toFixed(2)});
          });
          return out; }""")
        res[name] = info
        pg.pdf(path=f"/tmp/w/prev_{name}.pdf", prefer_css_page_size=True, print_background=True)
        # screenshots per page
        for i, h in enumerate(pg.query_selector_all("section.page")):
            h.screenshot(path=f"/tmp/w/shot_{name}_{i}.png")
    b.close()
json.dump(res, open("/tmp/w/measure.json", "w"), indent=1)
import sys as _s
for k, v in res.items():
    for pgi in v:
        print(k, "page", pgi["page"], "maxBottom", pgi["maxBottom"], "overflow", pgi["over"])
