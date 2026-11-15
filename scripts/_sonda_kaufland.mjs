const t = [
  ["kaufland nabidky", "https://www.kaufland.cz/aktualni-nabidky.html"],
  ["kaufland letaky sub", "https://letaky.kaufland.cz/"],
  ["kimbino kaufland", "https://www.kimbino.cz/letak/kaufland"],
  ["letaky.cz kaufland", "https://www.letaky.cz/kaufland"],
];
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "cs-CZ,cs;q=0.9",
};
for (const [n, u] of t) {
  try {
    const r = await fetch(u, { headers: H, redirect: "follow" });
    const tx = await r.text();
    console.log(n, r.status, tx.length + "B", "| final:", r.url);
    const m = tx.match(/https?:\/\/[^"' ]*api[^"' ]{0,90}|\/[a-z0-9_-]*api[a-z0-9_/-]{0,60}/gi);
    if (m) console.log("   api:", [...new Set(m)].slice(0, 6).join(" | "));
  } catch (e) {
    console.log(n, "ERR", e.message);
  }
}
