// Stáhne názvy nabídek z kupi.cz /slevy/<řetězec> (lokální IP, ~1.4s tempo).
// Výstup: scripts/_kupi_nazvy.json [{obchod, nazev, jednotka, cena, pct, c100}]
import { JSDOM } from "jsdom";
import { writeFileSync } from "node:fs";

const HLAVICKY = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.7",
};
const OBCHODY = { kaufland: "Kaufland", lidl: "Lidl", albert: "Albert", billa: "Billa", tesco: "Tesco", "penny-market": "Penny", globus: "Globus" };
const MAX_STRAN = 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cislo = (t) => { const m = (t ?? "").replace(/ /g, " ").replace(/ /g, "").match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(",", ".")) : null; };

function c100zJednotkove(t) {
  if (!t) return null;
  const m = t.replace(/ /g, " ").match(/(\d+(?:[.,]\d+)?)\s*Kč\s*\/\s*(\d+(?:[.,]\d+)?)?\s*(100\s*g|kg|g|l|cl|ml|ks)/);
  if (!m) return null;
  const g = { "100g": 100, kg: 1000, g: 1, l: 1000, cl: 10, ml: 1 }[m[3].replace(/ /g, "")];
  if (!g) return null;
  const celkem = g * parseFloat((m[2] ?? "1").replace(",", "."));
  return celkem > 0 ? Math.round((parseFloat(m[1].replace(",", ".")) * 100) / celkem * 100) / 100 : null;
}

const out = [];
for (const [slug, obchod] of Object.entries(OBCHODY)) {
  let stranek = 0;
  for (let p = 1; p <= MAX_STRAN; p++) {
    const url = `https://www.kupi.cz/slevy/${slug}${p > 1 ? `?page=${p}` : ""}`;
    try {
      const r = await fetch(url, { headers: { ...HLAVICKY, Referer: "https://www.kupi.cz/" } });
      if (r.status !== 200) { console.log(`${obchod} p${p}: HTTP ${r.status}`); break; }
      const html = await r.text();
      const doc = new JSDOM(html).window.document;
      const radky = [...doc.querySelectorAll(".discount_row")];
      let n = 0;
      const vsechnyWraps = [...doc.querySelectorAll(".product--wrap")];
      for (const row of radky) {
        // ekvivalent find_previous: nejbližší .product--wrap PŘED řádkem
        const wrap = row.closest(".product--wrap")
          ?? vsechnyWraps.filter((w) => w.compareDocumentPosition(row) & 4).pop();
        if (!wrap) continue;
        const nazevEl = wrap.querySelector(".product_name strong");
        if (!nazevEl) continue;
        const nazev = nazevEl.textContent.replace(/\s+/g, " ").trim();
        const jednotka = wrap.querySelector(".product_name .nowrap span")?.textContent.trim() ?? "";
        const cena = cislo(row.querySelector(".discount_price_value")?.textContent);
        const pct = cislo(row.querySelector(".discount_percentage")?.textContent);
        const c100 = c100zJednotkove(row.querySelector(".price_per_unit")?.textContent);
        if (!nazev || !cena) continue;
        out.push({ obchod, nazev, jednotka, cena, pct, c100 });
        n++;
      }
      stranek++;
      console.log(`${obchod} p${p}: ${n} řádků`);
      if (n < 3) break;
      await sleep(1400);
    } catch (e) { console.log(`${obchod} p${p}: ${e.message}`); break; }
  }
  console.log(`${obchod}: hotovo (${stranek} stránek)`);
}
writeFileSync("scripts/_kupi_nazvy.json", JSON.stringify(out, null, 1));
console.log(`CELKEM ${out.length} nabídek → scripts/_kupi_nazvy.json`);
