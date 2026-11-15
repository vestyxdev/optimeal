-- Migrace 0023: formátování názvů potravin
--   1) kapitalizace prvního písmene tam, kde nevznikne kolize s existujícím názvem
--   2) náhrada ´ za ', Nº za N°, odstranění emoji
--   3) překlady zbylých cizích názvů (rumunština, němčina, angličtina)

begin;

-- 1) Kapitalizace počátečního písmene – jen tam, kde kapitalizovaný tvar ještě neexistuje
update foods f
set nazev = upper(substring(f.nazev, 1, 1)) || substring(f.nazev, 2)
where f.nazev ~ '^[a-zá-ž]'
  and not exists (
    select 1 from foods x
    where x.nazev = upper(substring(f.nazev, 1, 1)) || substring(f.nazev, 2)
      and x.id <> f.id
  );

-- 2) Nestandardní znaky
update foods set nazev = replace(nazev, '´', '''') where nazev like '%´%';
update foods set nazev = replace(nazev, 'Nº', 'N°')  where nazev like '%Nº%';
update foods set nazev = regexp_replace(nazev, '\s*🇩🇪\s*$', '') where nazev like '%🇩🇪%';

-- 3) Překlady cizích názvů (cíle ověřené proti kolizím)
update foods set nazev = 'Adicto Go dortíček s jahodovým krémem' where nazev = 'Adicto Go Prăjitură cu cremă de capșuni';
update foods set nazev = 'Kaškaval' where nazev = 'Cașcaval';
update foods set nazev = 'Jogurt smetanový broskev-marakuja' where nazev = 'Sahne Joghurt mild Pfirsich Maracuja';
update foods set nazev = 'Bio mléko (süt)' where nazev = 'Bio süt';
update foods set nazev = 'Müsli lesní plody (Beeren)' where nazev = 'Beeren müsli';
update foods set nazev = 'Jablečný džus (Stop & Shop)' where nazev = 'Apple juice (stop shop)';
update foods set nazev = 'Jablečný džus (Tesco)' where nazev = 'Apple juice (Tesco)';
update foods set nazev = 'Pečené kolečka' where nazev = 'Baked wheels';
update foods set nazev = 'Máslové sušenky shortbread' where nazev = 'All butter shortbread fingers';
update foods set nazev = 'Sušenka (biscuit)' where nazev = 'Biscuit';
update foods set nazev = 'Máslo (Madeta)' where nazev = 'Butter (Madeta)';

commit;
