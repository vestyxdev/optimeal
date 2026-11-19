// Probe: co dnes vygeneruje a proč vymenJidlo vrací null
import { vygenerujJidelnicek, vymenJidlo } from "../src/lib/generator/generator.ts";
const p = (id,nazev,b,s,t,kal,bezna,aktualni=bezna,obchod=null) =>
  ({id,nazev,bilkoviny:b,sacharidy:s,tuky:t,kalorie:kal,beznaCena:bezna,aktualniCena:aktualni,obchod,sleva:aktualni<bezna});
const KATALOG = [
  p("1","Kuřecí prsa",31,0,3.5,165,12,9.49,"Billa"),
  p("2","Tvaroh polotučný",12,4,1.5,85,6,4.49,"Tesco"),
  p("3","Vejce",13,0.7,11,155,8),
  p("4","Sýr Eidam",25,1,30,380,9),
  p("5","Ovesné vločky",13.5,60,7,380,4.5),
  p("6","Rýže basmati",7,78,1,350,4),
  p("7","Čočka červená",25,52,1,320,5.5,4.1,"Kaufland"),
  p("8","Krabí tyčky",10,3,1,60,3),
  p("9","Jogurt bílý 3,5%",4,5,3.5,70,1.5),
  p("10","Brambory",2,17,0.1,77,2,1.49,"Billa"),
  p("11","Arašidy",26,9,49,567,8),
  p("12","Banán",1.1,23,0.3,97,3),
];
const CILE = { kalorie: 2450, bilkoviny: 184, sacharidy: 244, tuky: 82 };
const den = vygenerujJidelnicek(KATALOG, CILE);
for (const [n, s] of Object.entries(den.jidelnicek)) {
  console.log(n, "→", s.jidla.map(j=>j.nazev).join(", "));
  const v = vymenJidlo(KATALOG, den, n, CILE);
  console.log("   výměna:", v ? "OK" : "NULL");
}
