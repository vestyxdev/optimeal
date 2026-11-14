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


if __name__ == "__main__":
    unittest.main()
