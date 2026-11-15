"""Offline testy parserů letákových nabídek (python -m unittest scraper.test_retailers)."""

import unittest

from scraper.retailers.base import BaseScraper, ceny_na_100g, gramaje_z_nazvu
from scraper.retailers.schwarz import _cislo, _nabidky


class TestGramajeZNazvu(unittest.TestCase):
    def test_gramy(self):
        self.assertEqual(gramaje_z_nazvu("TUC Mini Original 100g"), 100)

    def test_kilogramy(self):
        self.assertEqual(gramaje_z_nazvu("Brambory pozdní 1 kg"), 1000)

    def test_carka_desetinna(self):
        self.assertEqual(gramaje_z_nazvu("Mléko trvanlivé 1,5 l"), 1500)

    def test_multipack_pred(self):
        self.assertEqual(gramaje_z_nazvu("Jogurt 2 x 250 g"), 500)

    def test_multipack_za(self):
        self.assertEqual(gramaje_z_nazvu("Minerálka 500 ml x 6"), 3000)

    def test_bez_mnozstvi(self):
        self.assertIsNone(gramaje_z_nazvu("Svíčková na smetaně"))

    def test_mimo_mezi(self):
        self.assertIsNone(gramaje_z_nazvu("Cisterna 50 l"))


class TestCenyNa100g(unittest.TestCase):
    def test_prevod(self):
        self.assertEqual(ceny_na_100g(25.0, 400), 6.25)

    def test_bez_gramu_none(self):
        self.assertIsNone(ceny_na_100g(25.0, None))

    def test_nulova_cena_none(self):
        self.assertIsNone(ceny_na_100g(0, 400))


class TestCislo(unittest.TestCase):
    def test_string_s_carkou(self):
        self.assertEqual(_cislo("24,90"), 24.9)

    def test_dict_value(self):
        self.assertEqual(_cislo({"value": 12.5}), 12.5)

    def test_none(self):
        self.assertIsNone(_cislo(None))


class TestNabidky(unittest.TestCase):
    def test_najde_offers(self):
        data = {"offers": [{"title": "A"}, {"title": "B"}]}
        self.assertEqual(len(list(_nabidky(data))), 2)

    def test_vnorenou_strukturu(self):
        data = {"flyer": {"items": [{"title": "X"}]}}
        self.assertEqual(len(list(_nabidky(data))), 1)


class TestNabidka(unittest.TestCase):
    def test_pct_vypocet(self):
        s = BaseScraper.__new__(BaseScraper)
        s.obchod = "Test"
        s.nalezeno = 0
        n = s._nabidka("Jogurt 150 g", cena=10.0, puvodni=20.0, gramy=150)
        self.assertIsNotNone(n)
        self.assertEqual(n.sleva_procenta, 50)
        self.assertAlmostEqual(n.cena_za_100g, 6.67, places=2)

    def test_bez_gramu_none(self):
        s = BaseScraper.__new__(BaseScraper)
        s.obchod = "Test"
        self.assertIsNone(s._nabidka("Něco", cena=10.0))


if __name__ == "__main__":
    unittest.main()
