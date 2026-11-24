"""Offline testy čisté logiky scraperu (python -m unittest scraper.test_scraper)."""

import unittest
from unittest.mock import MagicMock, patch

import requests

from scraper.normalizace import (
    cena_za_100g,
    mnozstvi_v_gramech,
    normalizuj_nazev,
    obchod_z_location,
)
from scraper import open_prices
from scraper.db import SupabaseWriter, _platna_puvodni, _req


class TestFoodId(unittest.TestCase):
    """Párování cenových záznamů na potraviny – EAN má přednost, jméno doplňuje EAN."""

    def _writer(self, potraviny: list[dict]) -> SupabaseWriter:
        w = SupabaseWriter(url="http://test", klic="k")
        w._potraviny = potraviny
        return w

    def test_ean_match_prednostne(self):
        w = self._writer([{"id": "f1", "nazev": "Jogurt", "ean": "8590001"}])
        self.assertEqual(w._food_id("8590001", "Cokoliv jiného"), "f1")

    def test_shoda_jmenem_doplni_ean(self):
        w = self._writer([{"id": "f1", "nazev": "Jogurt bílý", "ean": None}])
        with patch("scraper.db.requests.patch") as mock_patch:
            mock_patch.return_value = MagicMock(ok=True)
            fid = w._food_id("8590002", "Jogurt Bily")
        self.assertEqual(fid, "f1")
        mock_patch.assert_called_once()
        self.assertEqual(w._potraviny[0]["ean"], "8590002")

    def test_shoda_jmenem_s_eanem_netepatchuje(self):
        w = self._writer([{"id": "f1", "nazev": "Jogurt", "ean": "111"}])
        with patch("scraper.db.requests.patch") as mock_patch:
            fid = w._food_id("999", "Jogurt")
        self.assertEqual(fid, "f1")
        mock_patch.assert_not_called()

    def test_bez_shody_zadny_patch(self):
        w = self._writer([{"id": "f1", "nazev": "Jogurt", "ean": "5"}])
        with patch("scraper.db.requests.patch") as mock_patch:
            self.assertIsNone(w._food_id(None, "Chleba"))
        mock_patch.assert_not_called()


class TestNormalizaceNazvu(unittest.TestCase):
    def test_bez_diakritiky_a_case(self):
        self.assertEqual(normalizuj_nazev("Kuřecí  Prsa"), "kureci prsa")
        self.assertEqual(normalizuj_nazev("Těstoviny"), "testoviny")

    def test_prazdne(self):
        self.assertEqual(normalizuj_nazev("  "), "")


class TestCenaZa100g(unittest.TestCase):
    def test_kilogram(self):
        # 199 Kč/kg → 19.90 Kč/100g
        self.assertEqual(cena_za_100g(199, "KILOGRAM", None), 19.9)

    def test_unit_s_obsahem(self):
        # 30 Kč za 400 g → 7.5 Kč/100g
        self.assertEqual(cena_za_100g(30, "UNIT", 400), 7.5)

    def test_unit_bez_obsahu_preskoci(self):
        self.assertIsNone(cena_za_100g(30, "UNIT", None))
        self.assertIsNone(cena_za_100g(30, None, None))

    def test_eur_se_prepocte(self):
        # 2 EUR za kg, kurz 25 → 50 Kč/kg → 5 Kč/100g
        self.assertEqual(cena_za_100g(2, "KILOGRAM", None, mena="EUR", kurz_eur=25), 5.0)

    def test_neznamy_mena_preskoci(self):
        self.assertIsNone(cena_za_100g(10, "KILOGRAM", None, mena="USD"))

    def test_neplatna_cena(self):
        self.assertIsNone(cena_za_100g(0, "KILOGRAM", 100))
        self.assertIsNone(cena_za_100g(None, "KILOGRAM", 100))


class TestMnozstvi(unittest.TestCase):
    def test_product_quantity(self):
        self.assertEqual(mnozstvi_v_gramech({"product_quantity": 500}), 500.0)
        self.assertIsNone(mnozstvi_v_gramech({"product_quantity": None}))
        self.assertIsNone(mnozstvi_v_gramech({}))


class TestObchody(unittest.TestCase):
    def test_zname_retezce(self):
        self.assertEqual(obchod_z_location({"osm_name": "Kaufland Praha 4"}), "Kaufland")
        self.assertEqual(obchod_z_location({"osm_display_name": "Lidl, Brno"}), "Lidl")

    def test_neznamy_obchod(self):
        self.assertEqual(obchod_z_location({"osm_name": "Večerka U nádraží"}), "Večerka U nádraží")

    def test_bez_nazvu(self):
        self.assertIsNone(obchod_z_location({"osm_name": None, "osm_display_name": None}))


def _odpoved(json_data):
    r = MagicMock()
    r.json.return_value = json_data
    r.raise_for_status.return_value = None
    return r


class TestStahniStranku(unittest.TestCase):
    """Retry logika stahování stránek Open Prices (mockované HTTP)."""

    @patch("scraper.open_prices.time.sleep")
    @patch("scraper.open_prices.requests.get")
    def test_ok_hned(self, mock_get, _sleep):
        mock_get.return_value = _odpoved({"items": [1, 2]})
        self.assertEqual(open_prices._stahni_stranku(1), {"items": [1, 2]})
        mock_get.assert_called_once()

    @patch("scraper.open_prices.time.sleep")
    @patch("scraper.open_prices.requests.get")
    def test_retry_pri_5xx(self, mock_get, sleep_mock):
        chyba = requests.HTTPError("500 Server Error")
        mock_get.side_effect = chyba
        self.assertIsNone(open_prices._stahni_stranku(1))
        # POKUSY pokusů, POKUSY-1 čekání (po posledním pokusu se už nečeká)
        self.assertEqual(mock_get.call_count, open_prices.POKUSY)
        self.assertEqual(sleep_mock.call_count, open_prices.POKUSY - 1)

    @patch("scraper.open_prices.time.sleep")
    @patch("scraper.open_prices.requests.get")
    def test_timeout_se_znovu_zkusi(self, mock_get, sleep_mock):
        mock_get.side_effect = [
            requests.Timeout(),
            _odpoved({"items": [1]}),
        ]
        self.assertEqual(open_prices._stahni_stranku(1), {"items": [1]})
        self.assertEqual(mock_get.call_count, 2)
        sleep_mock.assert_called_once()

    @patch("scraper.open_prices.time.sleep")
    @patch("scraper.open_prices.requests.get")
    def test_backoff_roste(self, mock_get, sleep_mock):
        mock_get.side_effect = requests.ConnectionError()
        open_prices._stahni_stranku(1)
        cekani = [c.args[0] for c in sleep_mock.call_args_list]
        self.assertEqual(cekani, sorted(cekani))  # exponenciálně roste
        self.assertGreater(cekani[-1], cekani[0])


class TestStahniCenyCz(unittest.TestCase):
    """Vadná stránka se přeskočí, ingest pokračuje dál."""

    @patch("scraper.open_prices.time.sleep")
    @patch("scraper.open_prices.requests.get")
    def test_vadna_stranka_se_preskoci(self, mock_get, _sleep):
        polozka_cz = {
            "location": {"osm_address_country_code": "CZ", "osm_name": "Tesco"},
            "price": 10,
            "price_is_discounted": False,
            "currency": "CZK",
            "product": {"product_name": "Chléb", "code": "1", "product_quantity": 1000},
            "date": "2026-01-01",
        }
        mock_get.side_effect = [
            requests.HTTPError("500"),  # strana 1 padne → přeskočíme
            requests.HTTPError("500"),
            requests.HTTPError("500"),
            _odpoved({"items": [polozka_cz]}),  # strana 2 OK
            _odpoved({"items": []}),  # strana 3 prázdná → konec
        ]
        vysledky = list(open_prices.stahni_ceny_cz(max_stranek=3, kurz_eur=25))
        # jedna vadná stránka nevadí – záznamy z dalších dorazí
        self.assertEqual(len(vysledky), 1)
        self.assertEqual(vysledky[0]["obchod"], "Tesco")

    @patch("scraper.open_prices.time.sleep")
    @patch("scraper.open_prices.requests.get")
    def test_ne_cz_zaznamy_se_filtruji(self, mock_get, _sleep):
        polozka_sk = {
            "location": {"osm_address_country_code": "SK", "osm_name": "Tesco"},
            "price": 10,
            "currency": "EUR",
            "product": {"product_name": "Chléb", "code": "1", "product_quantity": 1000},
            "date": "2026-01-01",
        }
        mock_get.side_effect = [_odpoved({"items": [polozka_sk]}), _odpoved({"items": []})]
        self.assertEqual(list(open_prices.stahni_ceny_cz(max_stranek=2, kurz_eur=25)), [])


CNB_KURZOVNI_LISTEK = """\
14.11.2026 #220
země|měna|množství|kód|kurz
Austrálie|dolar|1|AUD|16,352
EMU|euro|1|EUR|24,485
USA|dolar|1|USD|23,192
"""


class TestKurzEurCnb(unittest.TestCase):
    """Kurz EUR/CZK z ČNB – parse nebo výchozí 25.5."""

    @patch("scraper.open_prices.requests.get")
    def test_emu_radek_se_prevede(self, mock_get):
        mock_get.return_value = MagicMock(text=CNB_KURZOVNI_LISTEK)
        self.assertEqual(open_prices.kurz_eur_cnb(), 24.485)

    @patch("scraper.open_prices.requests.get")
    def test_chybejici_emu_vychozi(self, mock_get):
        mock_get.return_value = MagicMock(text="země|měna\nUSA|dolar|1|USD|23,1\n")
        self.assertEqual(open_prices.kurz_eur_cnb(), 25.5)

    @patch("scraper.open_prices.requests.get")
    def test_chyba_site_vychozi(self, mock_get):
        mock_get.side_effect = requests.ConnectionError()
        self.assertEqual(open_prices.kurz_eur_cnb(), 25.5)

    @patch("scraper.open_prices.requests.get")
    def test_poskozeny_radek_vychozi(self, mock_get):
        mock_get.return_value = MagicMock(text="EMU|euro|1|EUR|neplatné\n")
        self.assertEqual(open_prices.kurz_eur_cnb(), 25.5)


class TestPlatnaPuvodni(unittest.TestCase):
    """Sanity ověřené původní ceny – stejné meze jako view aktualni_ceny."""

    def test_platna_sleva_projde(self):
        self.assertTrue(_platna_puvodni(2.02, 0.99))
        self.assertTrue(_platna_puvodni(11.0, 7.7))

    def test_pod_akcni_nebo_rovna_zamitnuto(self):
        self.assertFalse(_platna_puvodni(4.49, 19.75))
        self.assertFalse(_platna_puvodni(43.89, 43.89))

    def test_sleva_pod_jedno_procento_zamitnuta(self):
        self.assertFalse(_platna_puvodni(10.05, 10.0))
        self.assertTrue(_platna_puvodni(10.1, 10.0))

    def test_nad_dvaapulnasobek_artefakt(self):
        # nad ~60 % slevy je u potravin téměř vždy pack-mismatch
        self.assertFalse(_platna_puvodni(20.13, 5.03))  # −75 % artefakt
        self.assertFalse(_platna_puvodni(12.6, 5.03))   # −60 %+ hranice
        self.assertTrue(_platna_puvodni(12.57, 5.03))   # těsně pod 2,5×

    def test_nuly_a_zapory(self):
        self.assertFalse(_platna_puvodni(0, 5))
        self.assertFalse(_platna_puvodni(10, 0))
        self.assertFalse(_platna_puvodni(-5, 5))


class TestReqRetry(unittest.TestCase):
    """_req: retry+backoff na 429/5xx a síťové chyby, 4xx hned zpět."""

    def _odpoved(self, status: int) -> MagicMock:
        r = MagicMock()
        r.status_code = status
        r.ok = status < 400
        return r

    def test_503_pak_200_zkus_znovu(self):
        with patch("scraper.db.requests.get") as m_get, \
             patch("scraper.db.time.sleep"):
            m_get.side_effect = [self._odpoved(503), self._odpoved(200)]
            r = _req("get", "http://x/rest/v1/foods", timeout=5)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(m_get.call_count, 2)

    def test_429_vycerpani_pokusu_vrati_posledni(self):
        with patch("scraper.db.requests.post") as m_post, \
             patch("scraper.db.time.sleep"):
            m_post.return_value = self._odpoved(429)
            r = _req("post", "http://x/rest/v1/foods", timeout=5)
        self.assertEqual(r.status_code, 429)
        self.assertEqual(m_post.call_count, 3)  # _DB_POKUSY

    def test_4xx_se_neopakuje(self):
        with patch("scraper.db.requests.post") as m_post, \
             patch("scraper.db.time.sleep"):
            m_post.return_value = self._odpoved(409)
            r = _req("post", "http://x/rest/v1/foods", timeout=5)
        self.assertEqual(r.status_code, 409)
        m_post.assert_called_once()

    def test_sitova_chyba_propaguje_po_poslednim_pokusu(self):
        with patch("scraper.db.requests.get") as m_get, \
             patch("scraper.db.time.sleep"):
            m_get.side_effect = requests.ConnectionError("reset")
            with self.assertRaises(requests.ConnectionError):
                _req("get", "http://x/rest/v1/foods", timeout=5)
        self.assertEqual(m_get.call_count, 3)


if __name__ == "__main__":
    unittest.main()


class TestOffImport(unittest.TestCase):
    """off_import: parsing OFF produktu, český filtr, balení, sanity brzdy."""

    def _produkt(self, **kw):
        base = {
            "code": "8594000123456",
            "product_name": "Jogurt bílý",
            "brands": "Mlékárna",
            "quantity": "150 g",
            "countries_tags": ["en:czechia"],
            "nutriments": {"energy-kcal_100g": 70, "proteins_100g": 4.0,
                           "carbohydrates_100g": 5.0, "fat_100g": 3.5, "fiber_100g": 0.5},
            "allergens_tags": ["en:milk"],
            "traces_tags": ["en:nuts"],
        }
        base.update(kw)
        return base

    def test_parsuj_kompletni(self):
        from scraper.off_import import parsuj_produkt
        r = parsuj_produkt(self._produkt())
        self.assertIsNotNone(r)
        assert r is not None
        self.assertEqual(r["nazev"], "Jogurt bílý")
        self.assertEqual(r["ean"], "8594000123456")
        self.assertEqual(r["znacka"], "Mlékárna")
        self.assertEqual(r["baleni_g"], 150.0)
        self.assertEqual(r["vlaknina"], 0.5)
        self.assertEqual(r["alergeny"], ["mleko"])
        self.assertEqual(r["alergeny_stopy"], ["orisky"])
        self.assertEqual(r["kategorie"], "mlecne_vyrobky")

    def test_bez_kcal_preskocit(self):
        from scraper.off_import import parsuj_produkt
        p = self._produkt()
        del p["nutriments"]["energy-kcal_100g"]
        self.assertIsNone(parsuj_produkt(p))

    def test_nemozne_makro_preskocit(self):
        from scraper.off_import import parsuj_produkt
        p = self._produkt()
        p["nutriments"]["proteins_100g"] = 95.0
        p["nutriments"]["carbohydrates_100g"] = 20.0
        self.assertIsNone(parsuj_produkt(p))

    def test_baleni_6pack(self):
        from scraper.off_import import _baleni
        self.assertEqual(_baleni("6 x 33 cl"), (1980.0, "Balení"))
        self.assertEqual(_baleni("1 l"), (1000.0, "Láhev"))
        self.assertEqual(_baleni("500 g"), (500.0, "Balení"))
        self.assertEqual(_baleni(None), (100.0, "Balení"))

    def test_je_cesky(self):
        from scraper.off_import import je_cesky
        self.assertTrue(je_cesky(self._produkt()))
        self.assertTrue(je_cesky(self._produkt(code="4001686301233")))
        self.assertFalse(je_cesky(self._produkt(code="4001686301233", countries_tags=["en:germany"])))

    def test_neplatny_ean_zahodit(self):
        from scraper.off_import import parsuj_produkt
        r = parsuj_produkt(self._produkt(code="12ab"))
        assert r is not None
        self.assertIsNone(r["ean"])
