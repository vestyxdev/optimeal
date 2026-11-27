# Testy fuzzy párování nabídek na potraviny (SupabaseWriter._food_id_fuzzy).
# Běží offline – katalog se injektne do writeru, žádná DB.
import unittest

from scraper.db import SupabaseWriter, _obsahove_tokeny


def writer_s_katalogem(nazvy: list[str]) -> SupabaseWriter:
    """Writer s injektovaným katalogem – indexy se postaví z názvů."""
    w = SupabaseWriter.__new__(SupabaseWriter)
    w.url = "http://test"
    w.klic = "x"
    w._hlavicky = {}
    w._retailery = {}
    w._potraviny = [
        {"id": f"id-{i}", "nazev": n, "ean": None, "baleni_g": None,
         "obrazek": None, "externi_id": None}
        for i, n in enumerate(nazvy)
    ]
    w._norm_potraviny = []
    w._token_index = None
    w._nazev_index = {}
    w._ean_index = {}
    w._id_index = {}
    w._indexy_hotove = False
    w.nacti_potraviny()  # postaví indexy z injektovaného katalogu
    return w


class TestObsahoveTokeny(unittest.TestCase):
    def test_cisla_a_jednotky_pryc(self):
        self.assertEqual(
            _obsahove_tokeny("coca cola zero 330ml 6 ks"),
            ["coca", "cola", "zero"],
        )

    def test_obsah_zustava(self):
        self.assertEqual(_obsahove_tokeny("kureci prsa"), ["kureci", "prsa"])


class TestStrictMatcher(unittest.TestCase):
    def test_cerna_dira_strict_nematchuje(self):
        """Generické 'Pivo' nesmí pohltit konkrétní SKU v strict režimu."""
        w = writer_s_katalogem(["Mléko"])
        self.assertIsNone(
            w._food_id_fuzzy(None, "Mléko trvanlivé polotučné 1,5% 1l", strict=True)
        )

    def test_cerna_dira_loose_matchuje_zpetna_kompatibilita(self):
        """Letákový (volný) režim generickou shodu zachová – záměr."""
        w = writer_s_katalogem(["Mléko"])
        hit = w._food_id_fuzzy(None, "Mléko trvanlivé polotučné 1,5% 1l", strict=False)
        self.assertEqual(hit, "id-0")

    def test_strict_temperamentni_shoda_prochazi(self):
        """Téměř stejný název (drift balení) strict matchuje."""
        w = writer_s_katalogem(["Coca-Cola Zero"])
        hit = w._food_id_fuzzy(None, "Coca-Cola Zero 330ml", strict=True)
        self.assertEqual(hit, "id-0")

    def test_strict_vicecastkovy_generic_nepohlti(self):
        """Ani dvojtokenová potravina nepohltí delší SKU (krytí < 60 %)."""
        w = writer_s_katalogem(["Kuřecí prsa"])
        self.assertIsNone(
            w._food_id_fuzzy(None, "Kuřecí prsní řízky chlazené 400g", strict=True)
        )

    def test_loose_vicecastkovy_generic_matchuje(self):
        w = writer_s_katalogem(["Kuřecí prsa"])
        hit = w._food_id_fuzzy(None, "Kuřecí prsní řízky chlazené 400g", strict=False)
        self.assertEqual(hit, "id-0")

    def test_strict_presna_shoda_vzdy(self):
        w = writer_s_katalogem(["Birell Světlý nealkoholické pivo"])
        hit = w._food_id_fuzzy(None, "Birell světlý nealkoholické pivo", strict=True)
        self.assertEqual(hit, "id-0")

    def test_strict_ean_vitezi(self):
        w = writer_s_katalogem(["Něco úplně jiného"])
        w._potraviny[0]["ean"] = "1234567890123"
        w._indexy_hotove = False
        w.nacti_potraviny()
        hit = w._food_id_fuzzy("1234567890123", "Libovolný název", strict=True)
        self.assertEqual(hit, "id-0")

    def test_strict_stem_jednotokenovy_prochazi(self):
        """Krytí 1/1 = 100 % – stem-subset funguje i v strict."""
        w = writer_s_katalogem(["Citrón"])
        hit = w._food_id_fuzzy(None, "Citrony", strict=True)
        self.assertEqual(hit, "id-0")

    def test_strict_difflib_podobne_nazvy(self):
        """Skutečně podobný název (překlep/drift) strict chytne difflibem."""
        w = writer_s_katalogem(["Pribináček vanilkový pohár"])
        hit = w._food_id_fuzzy(None, "Pribináček vanilkový", strict=True)
        self.assertEqual(hit, "id-0")


if __name__ == "__main__":
    unittest.main()
