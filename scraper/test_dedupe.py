"""Testy fuzzy dedupe detekce."""

import unittest

from scraper.dedupe_fuzzy import hledej_duplicity, jaccard, norm, skore_keepera, tokeny, trigramy


def p(id, nazev, **kw):
    d = {"id": id, "nazev": nazev, "kategorie": "mlecne", "ean": None,
         "znacka": None, "obrazek": None, "baleni_g": None, "alergeny": None}
    d.update(kw)
    return d


class TestNorm(unittest.TestCase):
    def test_diakritika_a_velikost(self):
        self.assertEqual(norm("Kuřecí ŘÍZEK 300g"), "kureci rizek 300g")

    def test_tokeny_odstrani_stop_slova(self):
        self.assertNotIn("bio", tokeny("Bio Mléko plnotučné"))

    def test_jaccard_identicke(self):
        t = trigramy("Kofola Original")
        self.assertEqual(jaccard(t, t), 1.0)


class TestDedupe(unittest.TestCase):
    def test_najde_duplicitu_s_odlisnou_velikosti(self):
        data = [
            p("1", "Kofola Original"),
            p("2", "Kofola Original 2 l"),
        ]
        vys = hledej_duplicity(data, 0.75)
        self.assertEqual(len(vys), 1)
        self.assertEqual({vys[0]["keeper_id"], vys[0]["loser_id"]}, {"1", "2"})

    def test_ignoruje_ruzne_eany(self):
        data = [
            p("1", "Kofola Original", ean="859111"),
            p("2", "Kofola Original", ean="859222"),
        ]
        self.assertEqual(hledej_duplicity(data, 0.75), [])

    def test_ignoruje_ruzne_kategorie(self):
        data = [
            p("1", "Kofola Original", kategorie="napoje"),
            p("2", "Kofola Original", kategorie="sladke"),
        ]
        self.assertEqual(hledej_duplicity(data, 0.75), [])

    def test_ignoruje_ruzne_znacky(self):
        data = [
            p("1", "Mléko trvanlivé", znacka="Madeta"),
            p("2", "Mléko trvanlivé", znacka="Pragolaktos"),
        ]
        self.assertEqual(hledej_duplicity(data, 0.75), [])

    def test_keeper_preferuje_ean_a_obrazek(self):
        a = p("1", "Mléko plnotučné")
        b = p("2", "Mléko plnotučné", ean="859000", obrazek="http://x")
        self.assertGreater(skore_keepera(b), skore_keepera(a))
        vys = hledej_duplicity([a, b], 0.75)
        self.assertEqual(vys[0]["keeper_id"], "2")

    def test_opakovany_token_nesparuje_radek_sam_se_sebou(self):
        # „Rice … rice bar" obsahuje token dvakrát – bez set() by se řádek
        # zaindexoval 2x a vznikl same-id pár
        data = [p("1", "Rice up coconut rice bar")]
        self.assertEqual(hledej_duplicity(data, 0.6), [])

    def test_razna_procenta_tuku_neslucovat(self):
        data = [
            p("1", "Zakysaná smetana 15%"),
            p("2", "Zakysaná smetana 16 %"),
        ]
        self.assertEqual(hledej_duplicity(data, 0.6), [])

    def test_steajna_procenta_jiny_format_sloucit(self):
        data = [
            p("1", "Mléko plnotučné 3,5%"),
            p("2", "Mléko plnotučné 3,5 %"),
        ]
        self.assertEqual(len(hledej_duplicity(data, 0.6)), 1)

    def test_velikost_baleni_se_nevidi_jako_cislo(self):
        data = [
            p("1", "Kofola Original"),
            p("2", "Kofola Original 2 l"),
        ]
        self.assertEqual(len(hledej_duplicity(data, 0.6)), 1)

    def test_podobne_ale_razne_produkty_preskoci(self):
        data = [
            p("1", "Rajec neperlivá"),
            p("2", "Rajec jemně perlivá"),
        ]
        self.assertEqual(hledej_duplicity(data, 0.9), [])

    def test_vysledek_razeny_podle_podobnosti(self):
        data = [
            p("1", "Mléko plnotučné 3,5%"),
            p("2", "Mléko plnotučné 3,5 %"),
            p("3", "Smetana ke šlehání"),
            p("4", "Smetana ke šlehání 31%"),
        ]
        vys = hledej_duplicity(data, 0.6)
        sims = [d["podobnost"] for d in vys]
        self.assertEqual(sims, sorted(sims, reverse=True))
        self.assertGreaterEqual(len(vys), 1)


if __name__ == "__main__":
    unittest.main()
