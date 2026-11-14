/**
 * seed_demo.mjs – naplní produkční databázi realistickými demo účty
 * pro prezentaci (maturitní obhajoba).
 *
 * Pro každou personu:
 *   1) vytvoří auth uživatele přes GoTrue signUp (anon klíč z .env)
 *   2) potvrdí e-mail přímo v auth.users (postgres přístup obchází RLS)
 *   3) doplní profil + aktivní výživové cíle
 *   4) uloží plány vygenerované SKUTEČNÝM generátorem nad reálným
 *      katalogem (aktualni_ceny) – data vypadají jako od uživatele
 *   5) vytvoří nákupní seznamy (část položek odškrtnutá)
 *
 * Idempotentní: při opakovaném spuštění přeskočí vytvoření uživatele
 * a data přepíše (smaže staré demo plány/seznamy dané persony).
 *
 * Použití: node scripts/seed_demo.mjs "<heslo-k-db>"
 */

import pg from "pg";
import {
  sestavNakupniSeznam,
  vygenerujJidelnicek,
  vygenerujTydenniPlan,
} from "../src/lib/generator/generator.ts";

const HESLO_DB = process.argv[2];
if (!HESLO_DB) {
  console.error('Použití: node scripts/seed_demo.mjs "<heslo>"');
  process.exit(1);
}

const HESLO_DEMO = "OptiMeal2025!";
const DOMENA = "demo.optimeal.cz";

/* ---------- persony ---------- */
const PERSONY = [
  {
    email: `kaja@${DOMENA}`,
    jmeno: "Kája Novák",
    popis: "kulturista – nabírá, 5 jídel",
    profil: {
      vaha_kg: 88, vyska_cm: 186, vek_roku: 24, pohlavi: "m",
      aktivita: "velmi", cil_tela: "zhodnotit",
      tydenny_rozpocet_kc: 2200, pocet_jidel_denne: 5,
      dieta: [], alergie: [],
    },
    cile: { kalorie: 3500, bilkoviny: 250, sacharidy: 350, tuky: 115 },
    plany: [
      { typ: "tyden", predDny: 18 },
      { typ: "den", predDny: 9 },
      { typ: "den", predDny: 2 },
    ],
    seznamy: [{ predDny: 2, podilKoupeno: 0.5, hotovo: false }],
  },
  {
    email: `petra@${DOMENA}`,
    jmeno: "Petra Dvořáková",
    popis: "hubnutí – 1750 kcal, 4 jídla",
    profil: {
      vaha_kg: 78, vyska_cm: 168, vek_roku: 31, pohlavi: "z",
      aktivita: "mirna", cil_tela: "zhubnout",
      tydenny_rozpocet_kc: 1400, pocet_jidel_denne: 4,
      dieta: [], alergie: [],
    },
    cile: { kalorie: 1750, bilkoviny: 130, sacharidy: 150, tuky: 60 },
    plany: [
      { typ: "tyden", predDny: 12 },
      { typ: "den", predDny: 5 },
      { typ: "den", predDny: 1 },
    ],
    seznamy: [
      { predDny: 11, podilKoupeno: 1, hotovo: true },
      { predDny: 1, podilKoupeno: 0.3, hotovo: false },
    ],
  },
  {
    email: `verca@${DOMENA}`,
    jmeno: "Veronika Černá",
    popis: "veganka + alergie na ořechy",
    profil: {
      vaha_kg: 60, vyska_cm: 172, vek_roku: 19, pohlavi: "z",
      aktivita: "aktivni", cil_tela: "udrzet",
      tydenny_rozpocet_kc: 1600, pocet_jidel_denne: 4,
      dieta: ["vegansky"], alergie: ["orisky"],
    },
    cile: { kalorie: 2200, bilkoviny: 95, sacharidy: 280, tuky: 75 },
    plany: [
      { typ: "den", predDny: 6 },
      { typ: "tyden", predDny: 2 },
    ],
    seznamy: [{ predDny: 2, podilKoupeno: 0.4, hotovo: false }],
    recept: {
      nazev: "Čočkový salát s quinoou",
      popis: "Rychlý veganský salát plný bílkovin – můj go-to oběd do školy.",
      kategorie: "hlavni",
      porce: 2,
      cas_minuty: 25,
      postup:
        "Quinou i čočku uvařte zvlášť podle návodu a nechte vychladnout.\n" +
        "Rajče a okurku nakrájejte na kostky, cibuli najemno.\n" +
        "Vše smíchejte, zakápněte olivovým olejem, osolte a opepřete.",
      suroviny: [
        { nazev: "Quinoa", gramy: 80 },
        { nazev: "Čočka červená", gramy: 100 },
        { nazev: "Rajče", gramy: 120 },
        { nazev: "Okurka salátová", gramy: 80 },
        { nazev: "Olivový olej", gramy: 10 },
      ],
    },
  },
  {
    email: `tonda@${DOMENA}`,
    jmeno: "Antonín Svoboda",
    popis: "zaneprázdněný táta – 3 jídla, alergie na ryby",
    profil: {
      vaha_kg: 95, vyska_cm: 182, vek_roku: 42, pohlavi: "m",
      aktivita: "sedava", cil_tela: "zhubnout",
      tydenny_rozpocet_kc: 1800, pocet_jidel_denne: 3,
      dieta: [], alergie: ["ryby"],
    },
    cile: { kalorie: 2100, bilkoviny: 165, sacharidy: 175, tuky: 70 },
    plany: [
      { typ: "den", predDny: 4 },
      { typ: "den", predDny: 1 },
    ],
    seznamy: [
      { predDny: 4, podilKoupeno: 1, hotovo: true },
      { predDny: 0, podilKoupeno: 0.15, hotovo: false },
    ],
  },
];

/* ---------- připojení ---------- */
const pool = new pg.Pool({
  host: "aws-0-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.gduquvqofcohbjzzsicb",
  password: HESLO_DB,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

/** Katalog s aktuálními cenami ve tvaru Potravina (stejné mapování jako plany.ts). */
async function nactiKatalog() {
  const { rows } = await pool.query("select * from public.aktualni_ceny order by nazev");
  return rows.map((r) => ({
    id: r.food_id,
    nazev: r.nazev,
    kategorie: r.kategorie,
    bilkoviny: Number(r.bilkoviny),
    sacharidy: Number(r.sacharidy),
    tuky: Number(r.tuky),
    kalorie: Number(r.kalorie),
    beznaCena: Number(r.bezna_cena),
    aktualniCena: Number(r.aktualni_cena ?? r.bezna_cena),
    obchod: r.sleva ? r.obchod : null,
    sleva: Boolean(r.sleva),
    alergeny: r.alergeny ?? [],
    diety: r.diety ?? [],
    obrazek: r.obrazek ?? null,
  }));
}

/**
 * Založí (nebo najde) auth uživatele přímo v SQL – zkušebně potvrzený
 * e-mail, bcrypt heslo přes pgcrypto. Obchází GoTrue signUp (sdílený
 * SMTP má rate-limit ~2 e-maily/hodinu).
 */
async function zajistiUzivatele(email) {
  const { rows: exist } = await pool.query(
    "select id from auth.users where email = $1", [email]);
  if (exist[0]) return exist[0].id;

  const uid = crypto.randomUUID();
  const meta = JSON.stringify({ sub: uid, email, email_verified: true, phone_verified: false });
  const appMeta = JSON.stringify({ provider: "email", providers: ["email"] });

  await pool.query(
    `insert into auth.users (
       instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at,
       raw_app_meta_data, raw_user_meta_data,
       confirmation_token, recovery_token, email_change_token_new, email_change
     ) values (
       '00000000-0000-0000-0000-000000000000',
       $1, 'authenticated', 'authenticated', $2,
       crypt($3, gen_salt('bf')),
       now(), now(), now(), $4::jsonb, $5::jsonb, '', '', '', ''
     )`,
    [uid, email, HESLO_DEMO, appMeta, meta],
  );
  await pool.query(
    `insert into auth.identities
       (id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at)
     values
       (gen_random_uuid(), $1::text, $1::uuid, $2::jsonb, 'email', now(), now(), now())`,
    [uid, meta],
  );
  return uid;
}

async function seedPersona(p, katalog) {
  const uid = await zajistiUzivatele(p.email);
  console.log(`\n■ ${p.jmeno} (${p.email}) – ${p.popis}`);

  // profil (řádek vytvořil trigger handle_new_user)
  await pool.query(
    `update public.profiles set
       jmeno = $2, vaha_kg = $3, vyska_cm = $4, vek_roku = $5, pohlavi = $6,
       aktivita = $7, cil_tela = $8, tydenny_rozpocet_kc = $9,
       pocet_jidel_denne = $10, dieta = $11, alergie = $12, upraveno = now()
     where id = $1`,
    [
      uid, p.jmeno, p.profil.vaha_kg, p.profil.vyska_cm, p.profil.vek_roku,
      p.profil.pohlavi, p.profil.aktivita, p.profil.cil_tela,
      p.profil.tydenny_rozpocet_kc, p.profil.pocet_jidel_denne,
      p.profil.dieta, p.profil.alergie,
    ],
  );

  // aktivní cíle (deaktivujeme předchozí – jedinečný index)
  await pool.query("update public.nutrition_goals set aktivni = false where user_id = $1", [uid]);
  await pool.query(
    `insert into public.nutrition_goals (user_id, kalorie, bilkoviny, sacharidy, tuky, zdroj)
     values ($1, $2, $3, $4, $5, 'auto')`,
    [uid, p.cile.kalorie, p.cile.bilkoviny, p.cile.sacharidy, p.cile.tuky],
  );

  // staré demo záznamy pryč (idempotence)
  const { rows: stareListy } = await pool.query(
    "select id from public.shopping_lists where user_id = $1", [uid]);
  for (const l of stareListy) {
    await pool.query("delete from public.shopping_list_items where list_id = $1", [l.id]);
  }
  await pool.query("delete from public.shopping_lists where user_id = $1", [uid]);
  await pool.query("delete from public.meal_plans where user_id = $1", [uid]);

  const filtr = { diety: p.profil.dieta, alergeny: p.profil.alergie };
  const planIds = [];

  // plány skutečným generátorem
  for (const pl of p.plany) {
    const vysledek =
      pl.typ === "tyden"
        ? vygenerujTydenniPlan(katalog, p.cile, p.profil.pocet_jidel_denne, filtr)
        : vygenerujJidelnicek(katalog, p.cile, null, 0.85, p.profil.pocet_jidel_denne, filtr);
    const kcal = "celkem" in vysledek ? vysledek.celkem.kalorie : vysledek.tyden.kalorie;
    const { rows } = await pool.query(
      `insert into public.meal_plans
         (user_id, typ, cil_kalorie, cil_bilkoviny, cil_sacharidy, cil_tuky, data, vytvoreno)
       values ($1, $2, $3, $4, $5, $6, $7, now() - ($8 || ' days')::interval)
       returning id`,
      [
        uid, pl.typ, p.cile.kalorie, p.cile.bilkoviny, p.cile.sacharidy, p.cile.tuky,
        JSON.stringify({ cile: p.cile, vysledek }), pl.predDny,
      ],
    );
    planIds.push({ id: rows[0].id, typ: pl.typ, vysledek, predDny: pl.predDny });
    console.log(`  ${pl.typ === "tyden" ? "týdenní" : "denní"} plán před ${pl.predDny} dny (${kcal} kcal/den)`);
  }

  // nákupní seznamy z reálných plánů
  for (const sz of p.seznamy) {
    const zdroj = planIds.reduce((a, b) => (a.predDny <= b.predDny ? a : b));
    const nakup =
      zdroj.typ === "tyden"
        ? zdroj.vysledek.nakup
        : sestavNakupniSeznam(zdroj.vysledek.jidelnicek);
    const { rows } = await pool.query(
      `insert into public.shopping_lists (user_id, nazev, plan_id, hotovo, vytvoreno)
       values ($1, $2, $3, $4, now() - ($5 || ' days')::interval) returning id`,
      [
        uid,
        `Nákup – ${zdroj.typ === "tyden" ? "týdenní" : "denní"} plán`,
        zdroj.id, sz.hotovo, sz.predDny,
      ],
    );
    const listId = rows[0].id;
    let i = 0;
    for (const pol of nakup) {
      const koupeno = i / nakup.length < sz.podilKoupeno;
      await pool.query(
        `insert into public.shopping_list_items
           (list_id, food_id, nazev, gramy, cena_za_100g, obchod, je_sleva, koupeno, vlastni, kategorie)
         values ($1, $2, $3, $4, $5, $6, $7, $8, false, 'ostatni')`,
        [
          listId, pol.id, pol.nazev, Math.round(pol.gramy),
          pol.cenaZa100g, pol.obchod, pol.sleva, koupeno,
        ],
      );
      i++;
    }
    console.log(`  nákupní seznam (${nakup.length} položek${sz.hotovo ? ", dokončený" : `, ${Math.round(sz.podilKoupeno * 100)} % odškrtnuto`})`);
  }

  // vlastní recept (volitelně)
  if (p.recept) {
    const { rows } = await pool.query(
      `insert into public.recipes (user_id, nazev, popis, kategorie, porce, cas_minuty, postup, zdroj)
       values ($1, $2, $3, $4, $5, $6, $7, 'uzivatel') returning id`,
      [uid, p.recept.nazev, p.recept.popis, p.recept.kategorie, p.recept.porce, p.recept.cas_minuty, p.recept.postup],
    );
    const rid = rows[0].id;
    for (const s of p.recept.suroviny) {
      const { rows: f } = await pool.query("select id from public.foods where nazev = $1", [s.nazev]);
      if (!f[0]) { console.log(`  ! surovina ${s.nazev} není v katalogu`); continue; }
      await pool.query(
        `insert into public.recipe_ingredients (recipe_id, food_id, gramy_na_porce)
         values ($1, $2, $3) on conflict do nothing`,
        [rid, f[0].id, s.gramy],
      );
    }
    console.log(`  vlastní recept „${p.recept.nazev}"`);
  }
}

/* ---------- běh ---------- */
try {
  const katalog = await nactiKatalog();
  console.log(`Katalog: ${katalog.length} potravin s aktuálními cenami`);

  for (const p of PERSONY) await seedPersona(p, katalog);

  // úklid testovacího ping uživatele z dřívějšího ověření
  await pool.query("delete from auth.users where email = 'optimeal.test.ping@mailinator.com'");

  console.log("\n✅ Demo data nasazena. Přihlašovací údaje:");
  for (const p of PERSONY) console.log(`   ${p.email}  /  ${HESLO_DEMO}   (${p.popis})`);
} finally {
  await pool.end();
}
