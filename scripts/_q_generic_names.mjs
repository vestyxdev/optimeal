// OFF lookup pro podezřelé řádky
const eany = ["8593837230372", "8595014602217", "4011800548513", "8594021040531", "8594177020180", "8595070600837"];
for (const ean of eany) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,nutriments`);
    const j = await r.json();
    const n = j.product?.nutriments ?? {};
    console.log(ean, "|", j.product?.product_name ?? "?");
    console.log(
      "   kcal:", n["energy-kcal_100g"], "b:", n.proteins_100g, "s:", n.carbohydrates_100g, "t:", n.fat_100g,
    );
  } catch (e) {
    console.log(ean, "ERR", e.message);
  }
  await new Promise((r) => setTimeout(r, 1200));
}
