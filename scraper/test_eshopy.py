"""Offline testy eshopových parserů – fixtures z živých API odpovědí.

python -m unittest scraper.test_eshopy
"""

import unittest

from scraper.retailers.kosik import (
    c100_z_produktu,
    gramy_z_produktu,
    nabidka_z_produktu,
)
from scraper.retailers.rohlik import (
    c100_z_karty,
    gramy_z_karty,
    nabidka_z_karty,
)
from scraper.obohaceni_eshop import (
    makra_z_kosiku,
    makra_z_rohliku,
    _extrahuj_pole_json,
)
from scraper.obohaceni_puvodni import bezna_z_detailu


# --- fixtures zachycené z živých API (listopad 2026) ---

ROHLIK_VAZENA = {
    "productId": 1349783,
    "name": "Cibule žlutá 1 ks",
    "brand": None, "unit": "kg", "textualAmount": "cca 130 g",
    "weightedItem": True,
    "prices": {"originalPrice": 3.11, "salePrice": None,
               "unitPrice": 24.9, "currency": "CZK"},
    "image": {"path": "https://cdn.rohlik.cz/x.jpg"},
    "stock": {"availabilityStatus": "AVAILABLE"},
    "archived": False,
}
ROHLIK_SLEVA = {
    "productId": 999, "name": "Jogurt bílý 150 g",
    "brand": "Mlékárna", "unit": "kg", "textualAmount": "150 g",
    "weightedItem": False,
    "prices": {"originalPrice": 16.9, "salePrice": 9.9,
               "unitPrice": 66.0, "saleValidTill": "2026-11-25T00:00:00Z",
               "saleText": "-41 %", "currency": "CZK"},
    "stock": {"availabilityStatus": "AVAILABLE"}, "archived": False,
}
ROHLIK_MIMO = {
    "productId": 998, "name": "Vyprodáno", "unit": "ks",
    "textualAmount": "100 g", "weightedItem": False,
    "prices": {"originalPrice": 10.0, "salePrice": None, "unitPrice": None},
    "stock": {"availabilityStatus": "UNAVAILABLE"}, "archived": False,
}

KOSIK_NORMAL = {
    "id": 98247, "name": "Hera Classic 250 g",
    "brand": {"id": 517, "name": "Hera"}, "isSale": False,
    "image": "https://static-new.kosik.cz/x.jpg",
    "price": 17.9, "recommendedPrice": 44.9, "percentageDiscount": 60,
    "productQuantity": {"prefix": "", "value": 250.0, "unit": "g"},
    "unit": "ks",
}
KOSIK_LITR = {
    "id": 1, "name": "Mléko polotučné 1 l", "brand": None,
    "isSale": False, "price": 24.9, "recommendedPrice": None,
    "percentageDiscount": None,
    "productQuantity": {"value": 1.0, "unit": "l"}, "unit": "ks",
    "pricePerUnit": 24.9,
}


class TestRohlikKarta(unittest.TestCase):
    def test_gramy_cca(self):
        self.assertEqual(gramy_z_karty(ROHLIK_VAZENA), 130)

    def test_vazena_za_kg(self):
        c100, p100, g = c100_z_karty(ROHLIK_VAZENA)
        self.assertEqual(c100, 2.49)   # 24,9 Kč/kg → 2,49/100 g
        self.assertIsNone(p100)
        self.assertEqual(g, 130)

    def test_sleva(self):
        c100, p100, _ = c100_z_karty(ROHLIK_SLEVA)
        self.assertEqual(c100, 6.6)    # unitPrice 66 Kč/kg → 6,6
        self.assertEqual(p100, 11.27)  # orig 16,9 za 150 g → 11,27/100 g
        n = nabidka_z_karty(ROHLIK_SLEVA, "mlecne_vyrobky")
        self.assertTrue(n.je_sleva)
        self.assertEqual(n.sleva_procenta, 41)
        self.assertEqual(n.platnost_do, "2026-11-25")
        self.assertEqual(n.znacka, "Mlékárna")

    def test_vyprodane_preskoci(self):
        self.assertIsNone(nabidka_z_karty(ROHLIK_MIMO, "ostatni"))

    def test_bez_ceny_none(self):
        k = dict(ROHLIK_VAZENA, prices={"originalPrice": None, "unitPrice": None})
        self.assertIsNone(nabidka_z_karty(k, "ostatni"))


class TestKosikProdukt(unittest.TestCase):
    def test_gramy(self):
        self.assertEqual(gramy_z_produktu(KOSIK_NORMAL), 250)
        self.assertEqual(gramy_z_produktu(KOSIK_LITR), 1000)

    def test_sleva_z_recommended(self):
        c100, p100 = c100_z_produktu(KOSIK_NORMAL)
        self.assertEqual(c100, 7.16)   # 17,9 / 250 g
        self.assertEqual(p100, 17.96)  # 44,9 / 250 g
        n = nabidka_z_produktu(KOSIK_NORMAL, "ostatni")
        self.assertTrue(n.je_sleva)
        self.assertEqual(n.sleva_procenta, 60)
        self.assertEqual(n.znacka, "Hera")

    def test_litr_per_unit(self):
        c100, _ = c100_z_produktu(KOSIK_LITR)
        self.assertEqual(c100, 2.49)   # 24,9 Kč/l → 2,49/100 ml

    def test_bez_ceny_none(self):
        self.assertIsNone(nabidka_z_produktu(dict(KOSIK_NORMAL, price=None), "ostatni"))
        self.assertIsNone(nabidka_z_produktu(dict(KOSIK_NORMAL, name=""), "ostatni"))


# --- obohaceni_eshop: parsování nutric z eshopových zdrojů ---

ROHLIK_HTML = (
    '<html><script>{"a":1,"nutritionalValues":[{"productId":1456109,'
    '"portion":"100 g","values":{"energyKJ":{"amount":1305,"unit":"kJ"},'
    '"energyKCal":{"amount":312,"unit":"kCal"},"fats":{"amount":5.6,'
    '"unit":"g"},"carbohydrates":{"amount":53.7,"unit":"g"},'
    '"protein":{"amount":9.9,"unit":"g"}}}],"ingredients":[{"title":'
    '"Pšeničná mouka [a]"}]}</script></html>'
)

KOSIK_PRODUKT = {
    "id": 714376,
    "detail": {
        "nutritionalValues": {
            "valuesPerGrams": 100,
            "values": [
                {"title": "Energetická hodnota", "value": "2140", "unit": "kJ"},
                {"title": "Energetická hodnota", "value": "512", "unit": "kcal"},
                {"title": "Tuky", "value": "29.6", "unit": "g"},
                {"title": "Sacharidy", "value": "54.3", "unit": "g"},
                {"title": "Bílkoviny", "value": "5.6", "unit": "g"},
            ],
        },
        "parameterGroups": [
            {"title": "Alergeny", "items": [
                {"title": "Lepek", "value": "Ano"},
                {"title": "Vejce", "value": "Ano"},
                {"title": "Ryby", "value": "Ne"},
            ]},
        ],
    },
}


class TestExtrahujPole(unittest.TestCase):
    def test_bracket_matching_s_uvozovkami(self):
        # "]" uvnitř stringu nesmí ukončit pole
        pole = _extrahuj_pole_json('{"x":[{"t":"a]b"}]}', "x")
        self.assertEqual(pole, [{"t": "a]b"}])

    def test_chybejici_klic_none(self):
        self.assertIsNone(_extrahuj_pole_json('{"a":1}', "x"))


class TestMakraRohlik(unittest.TestCase):
    def test_nutritional_values(self):
        m = makra_z_rohliku(ROHLIK_HTML)
        self.assertEqual(m, {"kalorie": 312, "bilkoviny": 9.9,
                             "sacharidy": 53.7, "tuky": 5.6})

    def test_bez_dat_none(self):
        self.assertIsNone(makra_z_rohliku("<html>no data</html>"))

    def test_sanity_mez(self):
        # nesmyslná hodnota (>900 kcal/100g) se odmítne jako parse chyba
        html = '"nutritionalValues":[{"values":{"energyKCal":{"amount":5000}}}]'
        self.assertIsNone(makra_z_rohliku(html))


class TestMakraKosik(unittest.TestCase):
    def test_detail_nutritional_values(self):
        m, ale = makra_z_kosiku(KOSIK_PRODUKT)
        self.assertEqual(m, {"kalorie": 512, "bilkoviny": 5.6,
                             "sacharidy": 54.3, "tuky": 29.6})
        self.assertEqual(sorted(ale), ["lepek", "vejce"])

    def test_bez_detailu_none(self):
        m, ale = makra_z_kosiku({"id": 1})
        self.assertIsNone(m)
        self.assertEqual(ale, [])


# --- obohaceni_puvodni: „běžně stojí" z detailu kupi.cz ---

KUPI_DETAIL = (
    '<html><strong>Mléko trvanlivé Jihočeské Madeta - 1,5% polotučné '
    '1 l</strong> běžně stojí <strong class="nowrap">20,23&nbsp;Kč'
    '</strong>. Akční slevu nyní najdete…</html>'
)


class TestBeznaZDetailu(unittest.TestCase):
    def test_bezne_stoji(self):
        self.assertAlmostEqual(bezna_z_detailu(KUPI_DETAIL), 20.23)

    def test_bez_frazy_none(self):
        self.assertIsNone(bezna_z_detailu("<html>jen leták</html>"))

    def test_nulova_cena_none(self):
        html = 'běžně stojí <strong class="nowrap">0&nbsp;Kč</strong>'
        self.assertIsNone(bezna_z_detailu(html))


if __name__ == "__main__":
    unittest.main()
