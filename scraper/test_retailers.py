"""Offline testy parserů Kupi.cz (python -m unittest scraper.test_retailers)."""

import unittest
from datetime import date

from scraper.normalizace import cesky_stem, stem_nazev
from scraper.retailers.base import BaseScraper, ceny_na_100g, gramaje_z_nazvu
from scraper.retailers.kupi import (
    _c100_z_jednotkove_ceny,
    _cislo,
    gramaje_z_jednotky,
    platnost_do,
)


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


class TestGramajeZJednotky(unittest.TestCase):
    def test_litr(self):
        self.assertEqual(gramaje_z_jednotky("1 l"), 1000)

    def test_multipack(self):
        self.assertEqual(gramaje_z_jednotky("4x 0.33 l"), 1320)

    def test_ks_none(self):
        self.assertIsNone(gramaje_z_jednotky("16 ks"))


class TestCislo(unittest.TestCase):
    def test_cena(self):
        self.assertEqual(_cislo("9,90 Kč"), 9.9)

    def test_procenta(self):
        self.assertEqual(_cislo("–32 %"), 32.0)

    def test_nbsp(self):
        self.assertEqual(_cislo("199,90\xa0Kč"), 199.9)

    def test_prazdne(self):
        self.assertIsNone(_cislo(""))
        self.assertIsNone(_cislo(None))


class TestJednotkovaCena(unittest.TestCase):
    def test_za_100g(self):
        self.assertEqual(_c100_z_jednotkove_ceny("66,63 Kč / 100 g"), 66.63)

    def test_za_litr(self):
        self.assertEqual(_c100_z_jednotkove_ceny("9,90 Kč / 1 l"), 0.99)

    def test_za_kg(self):
        self.assertEqual(_c100_z_jednotkove_ceny("26,90 Kč / 1 kg"), 2.69)

    def test_za_ks_none(self):
        self.assertIsNone(_c100_z_jednotkove_ceny("7,49 Kč / 1 ks"))


class TestPlatnostDo(unittest.TestCase):
    def test_datum(self):
        self.assertEqual(
            platnost_do("platí do úterý 17. 11.", dnes=date(2026, 11, 15)),
            "2026-11-17",
        )

    def test_dnes_konci(self):
        self.assertEqual(
            platnost_do("dnes končí", dnes=date(2026, 11, 15)),
            "2026-11-15",
        )

    def test_pres_rok(self):
        self.assertEqual(
            platnost_do("platí do 5. 1.", dnes=date(2026, 12, 28)),
            "2027-01-05",
        )

    def test_zastaraly_vypis_nezije_11_mesicu(self):
        # leden + „platí do 30. 12." → minulý prosinec (expirovaná),
        # ne prosinec tohoto roku – jinak žije ~11 měsíců
        self.assertEqual(
            platnost_do("platí do 30. 12.", dnes=date(2026, 1, 2)),
            "2025-12-30",
        )

    def test_bez_data(self):
        self.assertIsNone(platnost_do("akce", dnes=date(2026, 11, 15)))


class TestCenyNa100g(unittest.TestCase):
    def test_prevod(self):
        self.assertEqual(ceny_na_100g(25.0, 400), 6.25)

    def test_bez_gramu_none(self):
        self.assertIsNone(ceny_na_100g(25.0, None))


class TestNabidka(unittest.TestCase):
    def test_pct_vypocet(self):
        s = BaseScraper.__new__(BaseScraper)
        s.obchod = "Test"
        s.nalezeno = 0
        n = s._nabidka("Jogurt 150 g", cena=10.0, puvodni=20.0, gramy=150)
        self.assertIsNotNone(n)
        self.assertEqual(n.sleva_procenta, 50)
        self.assertAlmostEqual(n.cena_za_100g, 6.67, places=2)


class TestCeskyStem(unittest.TestCase):
    """Stemmer: letákové skloňované tvary vs. katalogové základní tvary."""

    def test_mnozne_cislo(self):
        self.assertEqual(cesky_stem("citrony"), cesky_stem("citron"))
        self.assertEqual(cesky_stem("banany"), cesky_stem("banan"))
        self.assertEqual(cesky_stem("okurky"), cesky_stem("okurka"))
        self.assertEqual(cesky_stem("jablka"), cesky_stem("jablko"))

    def test_adjektiva(self):
        self.assertEqual(cesky_stem("veprova"), cesky_stem("veprove"))
        self.assertEqual(cesky_stem("kureci"), cesky_stem("kure"))

    def test_nekolapuje(self):
        self.assertNotEqual(cesky_stem("maso"), cesky_stem("maslo"))
        self.assertNotEqual(cesky_stem("vino"), cesky_stem("vinna"))
        self.assertNotEqual(cesky_stem("sul"), cesky_stem("sol"))

    def test_minimalni_delka(self):
        # krátká slova se nespodsekávají pod 3 znaky
        self.assertEqual(cesky_stem("syr"), "syr")
        self.assertEqual(cesky_stem("bio"), "bio")

    def test_stem_nazev(self):
        self.assertEqual(
            stem_nazev("Kuřecí čtvrtky"), "kur ctvrt"
        )


if __name__ == "__main__":
    unittest.main()
