// Doplní obrázky jen pro kurátorované základní potraviny (zdroj =
// 'seed-zaklady') – deterministicky podle namapovaného EN dotazu,
// ne podle prvního fuzzy výsledku českého názvu.
import pg from "pg";
import { readFileSync } from "node:fs";

const HESLO = readFileSync(".env.local", "utf8").match(/SUPABASE_DB_PASSWORD=(\S+)/)?.[1]
  ?? process.env.SUPABASE_DB_PASSWORD;
const pool = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com", port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb", password: HESLO, database: "postgres",
  ssl: { rejectUnauthorized: false },
});
const ceka = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = "OptiMeal/1.0 (optimeal-woad.vercel.app)";

// foods.nazev → OFF search dotaz (EN je na OFF nejplodnější)
const DOTAZY = {
  "Banány": "bananas", "Jablka": "apples", "Citrony": "lemons",
  "Pomeranče": "oranges", "Mandarinky čerstvé": "mandarins", "Limetky": "limes",
  "Grapefruit": "grapefruit", "Hrušky": "pears", "Meruňky": "apricots",
  "Broskve": "peaches", "Meloun vodní": "watermelon", "Kokos čerstvý": "coconut",
  "Grepy": "grapefruit", "Pomelo": "pomelo", "Hrušky": "pear",
  "Rajčata": "tomatoes", "Paprika čerstvá": "bell pepper",
  "Okurka hadovka": "cucumber", "Petrželová nať": "fresh parsley",
  "Kedlubna": "kohlrabi", "Ředkvičky": "radish", "Celer": "celery",
  "Zázvor čerstvý": "ginger", "Salát hlávkový": "iceberg lettuce",
  "Zelí bílé": "cabbage", "Dýně": "pumpkin", "Batáty": "sweet potato",
  "Chřest": "asparagus", "Žampiony čerstvé": "champignon mushrooms",
  "Křen čerstvý": "horseradish root",
  "Kuřecí čtvrtky": "chicken leg quarters", "Kuřecí stehna": "chicken thigh",
  "Kuřecí křídla": "chicken wing", "Kuřecí játra": "chicken livers",
  "Kuřecí hřbety": "chicken carcass", "Krůtí prsa": "turkey breast",
  "Vepřová panenská svíčková": "pork tenderloin", "Vepřová plec": "pork neck",
  "Mleté maso vepřové": "minced pork", "Husa": "goose",
  "Králík": "rabbit meat", "Kapr": "carp", "Tilápie filety": "tilapia",
  "Candát filety": "zander fillets", "Hovězí kýta": "beef leg",
  "Kotleta vepřová": "pork chops",
  "Voda Korunní": "mineral water", "Okurky Znojmia": "Znojmia",
  "Jihlavanka mletá": "Jihlavanka", "Jacobs Krönung instantní": "Jacobs Kronung instant coffee",
  "Káva mletá": "mletá káva", "Káva instantní": "instant coffee",
  "Káva zrnková": "coffee beans", "Kávové kapsle": "coffee capsules",
  "Víno bílé": "white wine", "Víno červené": "red wines",
  "Sekt": "sparkling wine", "Pivo": "lager beer", "Meloun vodní": "water melon",
};

async function hledej(dotaz) {
  for (const host of ["world.openfoodfacts.org", "cz.openfoodfacts.org"]) {
    const r = await fetch(
      `https://${host}/cgi/search.pl?search_terms=${encodeURIComponent(dotaz)}` +
      "&search_simple=1&action=process&json=1&page_size=6&fields=image_small_url,image_front_small_url",
      { headers: { "User-Agent": UA } },
    );
    if (!r.ok) continue;
    for (const p of (await r.json()).products ?? []) {
      const img = p.image_small_url ?? p.image_front_small_url;
      if (img) return img;
    }
  }
  return null;
}

const { rows } = await pool.query(
  "select id, nazev from public.foods where zdroj = 'seed-zaklady' and obrazek is null order by nazev",
);
console.log(`${rows.length} základů bez obrázku`);
let ok = 0;
for (const f of rows) {
  const dotaz = DOTAZY[f.nazev] ?? f.nazev;
  try {
    const img = await hledej(dotaz);
    if (img) {
      await pool.query("update public.foods set obrazek = $1 where id = $2", [img, f.id]);
      ok++; console.log(`✔ ${f.nazev} ← "${dotaz}"`);
    } else console.log(`· ${f.nazev} ← "${dotaz}" (OFF nic)`);
  } catch (e) {
    console.log(`✗ ${f.nazev}: ${e.message}`);
  }
  await ceka(500);
}
console.log(`\nHotovo: ${ok}/${rows.length} obrázků`);
await pool.end();
