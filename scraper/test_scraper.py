"""Offline testy čisté logiky scraperu (python -m unittest scraper.test_scraper)."""

import unittest

from scraper.normalizace import (
    cena_za_100g,
    mnozstvi_v_gramech,
    normalizuj_nazev,
    obchod_z_location,
)


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


if __name__ == "__main__":
    unittest.main()
