-- 0059: Vyřazení potravin s fyzikálně nemožnými makry z katalogu.
--
-- „Krůtí natural" (76,8 g bílkovin/100 g u čerstvé drůbeže) a podobné
-- poškozené importy: čerstvé maso/drůbež/ryby mají fyzikální mez
-- ~31 g B/100 g. Generátor takové položky od teď filtruje sám
-- (jeKorumpovanaNutrience), ale nemají co dělat ani v katalogu
-- a fulltext vyhledávání – schvaleno=false je vyřadí z view
-- aktualni_ceny i pickerů.
--
-- Výjimky z výrazu:
--   * sušené maso / jerky – 60–70 g B/100 g je skutečných
--   * semínka – „mletá dýňová semínka" zachytí vzorec „mlet" přes
--     slovo mletá, ale není to maso (i když i tam je 37 g pochybné)

update public.foods
set schvaleno = false
where schvaleno
  and bilkoviny > 35
  and nazev ~* 'maso|ku[řr]ec|kr[ůu]t|vep[řr]|hov[ěe]z|telec|jehn[ěe]o|prso|prsa|steak|file|mlet[éeý]|dr[ůu]be[žz]|losos|tu[ňn][aá]k|tresk|pstruh|kapr|sle[ďd]|makrel|tilapi|sardink|krevet|kalam[aá]r|krab|pangas|kachn|hus[ay]'
  and nazev !~* 'su[šs]en|jerky|biltong|pemikan|pemmican|dried|sem[íi]n';
