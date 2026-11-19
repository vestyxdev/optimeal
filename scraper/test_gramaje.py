"""Testy parseru gramáží/objemů z českých letákových názvů.

Pokrytí: standardní jednotky, multipacky, bonusy zdarma, pevný podíl,
cca/od rozsahy a nástrahy (tuk %, % vol, kusy, bílkoviny v názvu).
"""

import unittest

from scraper.retailers.base import cist_nazev, gramaje_z_nazvu


class TestJednotky(unittest.TestCase):
    """Standardní hmotnostní/objemové jednotky."""

    def test_gramy(self):
        self.assertEqual(gramaje_z_nazvu("Máslo 250 g"), 250)
        self.assertEqual(gramaje_z_nazvu("Sýr 200g"), 200)
        self.assertEqual(gramaje_z_nazvu("Paštika 105 g"), 105)
        self.assertEqual(gramaje_z_nazvu("Rohlík 70 g"), 70)
        self.assertEqual(gramaje_z_nazvu("Chléb 1200 g"), 1200)

    def test_kilogramy(self):
        self.assertEqual(gramaje_z_nazvu("Cukr 1 kg"), 1000)
        self.assertEqual(gramaje_z_nazvu("Brambory 5 kg"), 5000)
        self.assertEqual(gramaje_z_nazvu("Brambory 2,5 kg"), 2500)
        self.assertEqual(gramaje_z_nazvu("Mouka 25 kg"), 25000)
        self.assertEqual(gramaje_z_nazvu("Brambory 0,5 kg"), 500)
        self.assertEqual(gramaje_z_nazvu("Brambory 0.5kg"), 500)

    def test_litry_a_mililitry(self):
        self.assertEqual(gramaje_z_nazvu("Mléko trvanlivé 1 l"), 1000)
        self.assertEqual(gramaje_z_nazvu("Mléko 1l"), 1000)
        self.assertEqual(gramaje_z_nazvu("Voda 0,5 l"), 500)
        self.assertEqual(gramaje_z_nazvu("Voda 0.5l"), 500)
        self.assertEqual(gramaje_z_nazvu("Coca-Cola 1,75 l"), 1750)
        self.assertEqual(gramaje_z_nazvu("Pepsi 2 l"), 2000)
        self.assertEqual(gramaje_z_nazvu("Rum 0,7 l"), 700)
        self.assertEqual(gramaje_z_nazvu("Džus 750 ml"), 750)
        self.assertEqual(gramaje_z_nazvu("Zmrzlina 500 ml"), 500)
        self.assertEqual(gramaje_z_nazvu("Sójová omáčka 150 ml"), 150)

    def test_centilitry_a_dekagramy(self):
        self.assertEqual(gramaje_z_nazvu("Pivo 33 cl"), 330)
        self.assertEqual(gramaje_z_nazvu("Máslo 25 dkg"), 250)


class TestMultipacky(unittest.TestCase):
    """N× jednotka – obě pořadí, x i ×, s mezerami i bez."""

    def test_prefix_x(self):
        self.assertEqual(gramaje_z_nazvu("Jogurt 4x100g"), 400)
        self.assertEqual(gramaje_z_nazvu("Jogurt 4 x 100 g"), 400)
        self.assertEqual(gramaje_z_nazvu("Sýr 2×250 g"), 500)  # unicode ×
        self.assertEqual(gramaje_z_nazvu("Voda 6 x 1,5 l"), 9000)
        self.assertEqual(gramaje_z_nazvu("Džus 3 x 1 l"), 3000)
        self.assertEqual(gramaje_z_nazvu("Kapsičky 10x2g"), 20)
        self.assertEqual(gramaje_z_nazvu("Kuřecí vývar 6 x 0,5 l"), 3000)
        self.assertEqual(gramaje_z_nazvu("Pivo 4x 0,33 l"), 1320)

    def test_suffix_x(self):
        self.assertEqual(gramaje_z_nazvu("Balení 0,5 l x 6"), 3000)
        self.assertEqual(gramaje_z_nazvu("Máslo 250 g × 2"), 500)

    def test_ks_po(self):
        self.assertEqual(gramaje_z_nazvu("Šunka 2 ks po 250 g"), 500)
        self.assertEqual(gramaje_z_nazvu("Máslo 4 kusy po 125 g"), 500)

    def test_bonus_zdarma(self):
        self.assertEqual(gramaje_z_nazvu("Jogurt 3+1 zdarma 150 g"), 600)
        self.assertEqual(gramaje_z_nazvu("Pivo 3+1 0,5 l"), 2000)
        self.assertEqual(gramaje_z_nazvu("Tvaroh 250 g 3+1"), 1000)
        self.assertEqual(gramaje_z_nazvu("Jogurt 150 g + 1 zdarma"), 300)

    def test_bonus_gramaz_neni_pocet(self):
        # „500 g + 200 g zdarma" – +200 g je gramáž, ne počet kusů
        self.assertEqual(gramaje_z_nazvu("Těstoviny 500 g + 200 g zdarma"), 500)


class TestRozsahyAPodily(unittest.TestCase):
    """Pevný podíl, cca/od rozsahy – vítězí celkový obsah balení."""

    def test_pevny_podil_celkova_gramaz(self):
        self.assertEqual(gramaje_z_nazvu("Tuňák ve vlastní šťávě 185 g / 130 g"), 185)
        self.assertEqual(gramaje_z_nazvu("Kukuřice 340 g / 285 g"), 340)

    def test_cca_a_od(self):
        self.assertEqual(gramaje_z_nazvu("Meloun cca 2 kg"), 2000)
        self.assertEqual(gramaje_z_nazvu("Kapusta cca 1,5 kg"), 1500)
        self.assertEqual(gramaje_z_nazvu("Vodní meloun cca 5 kg"), 5000)
        self.assertEqual(gramaje_z_nazvu("Řízek od 400 g"), 400)


class TestNeplatne(unittest.TestCase):
    """Vzorce, které nesmí vrátit gramáž (None)."""

    def test_procenta_nejsou_gramy(self):
        self.assertIsNone(gramaje_z_nazvu("Mléko 3,5 %"))
        self.assertIsNone(gramaje_z_nazvu("Sýr 30 %"))
        self.assertIsNone(gramaje_z_nazvu("Pivo 4,2 % vol"))
        self.assertIsNone(gramaje_z_nazvu("Vinný ocet 8 %"))
        self.assertIsNone(gramaje_z_nazvu("Salám 45 %"))

    def test_kusy_nejsou_gramy(self):
        self.assertIsNone(gramaje_z_nazvu("Vejce 10 ks"))
        self.assertIsNone(gramaje_z_nazvu("Toaletní papír 8 ks"))
        self.assertIsNone(gramaje_z_nazvu("Balení vajec 10 ks"))

    def test_prazdne_a_bez_jednotky(self):
        self.assertIsNone(gramaje_z_nazvu(""))
        self.assertIsNone(gramaje_z_nazvu("Pánev"))
        self.assertIsNone(gramaje_z_nazvu("Víno cuvée"))

    def test_podezrele_male_gramy(self):
        self.assertIsNone(gramaje_z_nazvu("Šafrán 1 g"))


class TestNastraneVzory(unittest.TestCase):
    """Reálná letáková pojmenování – více čísel v jednom názvu."""

    def test_bilkoviny_vs_baleni(self):
        # „20 g bílkovin" v názvu tyčinky vs. skutečných 45 g balení
        self.assertEqual(gramaje_z_nazvu("Proteinová tyčinka 20 g bílkovin 45 g"), 45)
        self.assertEqual(gramaje_z_nazvu("Tyčinka 45 g, 20 g bílkovin"), 45)

    def test_procenta_vedle_jednotky(self):
        self.assertEqual(gramaje_z_nazvu("Sýr Eidam 45 % 250 g"), 250)
        self.assertEqual(gramaje_z_nazvu("Máslo 250 g 82 %"), 250)
        self.assertEqual(gramaje_z_nazvu("Rum 40 % 0,7 l"), 700)
        self.assertEqual(gramaje_z_nazvu("Jack Daniel's 0,7 l 40 %"), 700)
        self.assertEqual(gramaje_z_nazvu("Mléko 1,5 % 1 l"), 1000)
        self.assertEqual(gramaje_z_nazvu("Mléko polotučné 1,5 l 3,5 %"), 1500)
        self.assertEqual(gramaje_z_nazvu("Pivo Kozel 11° 0,5 l"), 500)

    def test_ks_bez_po_neni_multiplikator(self):
        # „2 ks 400 g" = 2 kusy dohromady 400 g – ne 800
        self.assertEqual(gramaje_z_nazvu("Bageta 2 ks 400 g"), 400)

    def test_sada_s_multiplikatem(self):
        self.assertEqual(gramaje_z_nazvu("Sada 6 x 200 ml"), 1200)


class TestCistNazev(unittest.TestCase):
    """Normalizace názvů – whitespace, typografické uvozovky/pomlčky."""

    def test_mezery(self):
        self.assertEqual(cist_nazev("  Jogurt   bílý  "), "Jogurt bílý")
        self.assertEqual(cist_nazev("Mléko\n trvanlivé"), "Mléko trvanlivé")

    def test_typografy(self):
        self.assertEqual(cist_nazev("Lay\u2019s chips"), "Lay's chips")
        self.assertEqual(cist_nazev("Pivo \u201eKozel\u201c"), 'Pivo "Kozel"')
        self.assertEqual(cist_nazev("Sýr \u2013 eidam"), "Sýr - eidam")

    def test_diakritika_zustava(self):
        self.assertEqual(cist_nazev("Kuřecí řízek"), "Kuřecí řízek")


if __name__ == "__main__":
    unittest.main()
