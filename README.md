# CoinScanner 🪙

Slovenská PWA aplikácia na **rozpoznávanie a katalogizáciu mincí**.
Funguje offline, všetky dáta zostávajú v zariadení (IndexedDB), bez servera a bez platených API.

## 🌐 Verejná adresa (GitHub Pages)

Aplikácia je automaticky nasadzovaná cez GitHub Actions na stálu adresu:

**https://jkdvkc.github.io/coin/**

Každý push do `main` automaticky spustí build a nasadenie (workflow `.github/workflows/deploy.yml`).
Na iPhone: otvor adresu v Safari → **Zdieľať** → **Na plochu** → spúšťaj z ikony.

## Ako to funguje (maximálne jednoducho)

1. Klepni na veľké tlačidlo **📷 Odfotiť** dole.
2. Polož mincu do kruhu – aplikácia **odfotí sama** (sama zameria a stabilizuje obraz).
3. Zobrazí sa výzva **„Otoč mincu“** – otoč, potvrď a druhá strana sa tiež odfotí sama.
4. Aplikácia **sama prečíta a doplní** rok, krajinu, nominál, menu, materiál aj hmotnosť
   (lokálne OCR + mini-katalóg) a **vypočíta orientačnú cenu**.
5. Pozri odhad ceny a **rozbaľ možné tlacové chyby** (max. 3) – pri každej je rozsah ceny.
6. Klepni na **Uložiť** – minca sa uloží do zbierky (ikona 🗂 dole).

Nič netreba vyplňovať – údaje sa dajú kedykoľvek upraviť v detaile mince.

## Funkcie

- 📷 **Fotenie oboch strán mince** (líc aj rub) priamo z aplikácie – živá kamera s kruhovým vodiacim rámom, prepnutie prednej/zadnej kamery, blesk (ak ho zariadenie podporuje), fallback na systémovú kameru/galériu.
- 🗂 **Osobná zbierka** – zoznam mincí s miniatúrami, hľadaním a štatistikou (typy, kusy, chyborazby).
- ℹ️ **Informácie o minci** – názov, krajina, rok, nominál, mena, značka mincovne, katalógové číslo, **materiál**, **orientačná hmotnosť**, stav (grading), poznámka, počet kusov.
- ⚖️ **Materiál a hmotnosť z mini-katalógu** – vstavaný off-line katalóg bežných mincí (eurové, SK, ČR, Československo, HUF) automaticky navrhne materiál a oficiálnu hmotnosť podľa krajiny, nominálu a roku; hmotnosť je výrobný parameter, takže odchýlka môže signalizovať falzifikát.
- ⚠️ **Chyborazby** – vlastný popis (posun razby, odštep…) + filter „Iba chyborazby“ v zozname.
- 💰 **Orientačná cena len ak je podložená** – zapíšeš ju len spolu so zdrojom (výsledok aukcie, katalóg, predajca). Bez vyplneného zdroja sa cena v zbierke nezobrazí a aplikácie na to upozorní. Sama žiadne ceny nevymýšľa. Automaticky počíta hodnotu za všetky kusy a súčet podložených cien celej zbierky.
- 🔍 **Analýza fotografie** (bez plateného API) – vyhodnocuje osvetlenie, kontrast, vycentrovanie mince a nepravidelnosti okraja; pri náznaku chyborazby zobrazí tip na overenie.
- 💰 **Orientačná cena automaticky** – vychádza z nominálnej hodnoty (EUR, SKK kurzom 30,126, CZK kurzom 24, Kčs 1:1→CZK) alebo kovovej hodnoty (hmotnosť × čistota × spotová cena, ktorú si nastavíš v Nastaveniach). Žiadne vymyslené čísla – základ je vždy vysvetlený.
- ⚠️ **Tlacové chyby s cenami** – aplikácia navrhne až 3 najpravdepodobnejšie chyby z 12 známych typov (posun razby, dvojraz, výsek plánžety, výstredný dojem, upchatý razník, brockage, off-metal, laminácia, prska v razníku, chyba okrajového vpisu, mule…). Pri každej je orientačný rozsah ceny (multiplikátory z aukcií), **dôvod návrhu** a **návod ako si chybu overiť lupou** po krokoch.
- 🤖 **Auto-vyplnenie z fotky (v0.2)** – po odfotení lica aplikácia lokálne (Tesseract OCR, vendorovaný v `public/tesseract/`) prečíta nápis a **sama vyplní rok, krajinu, nominál a menu**; z farby kovu (aj z rubu) odhadne **materiál**. Ručne upravené polia auto-vyplňovanie neprepíše.
- 💾 **Lokálne ukladanie** – IndexedDB v telefóne, nič sa neposiela na server.
- 📤 **Záloha** – export/import celej zbierky do JSON (zdieľanie cez systémový dialóg na iPhone).

## Použitie na iPhone

1. Spusti aplikáciu v Safari (alebo ju hostuj, pozri nižšie).
2. Klepni na **Zdieľať** → **Na plochu (Add to Home Screen)** → **Pridať**.
3. Aplikáciu ďalej spúšťaj z ikony na ploche – pobehuje na celú obrazovku, bez Safari lišty a **funguje aj offline**.
4. Pri prvom fotení Safari spýta na povolenie kamery – povol ho. Ak si ho kedysi odmietol: Nastavenia → Safari → Kamera (prípadne Nastavenia → CoinScanner → Kamera).
5. Kamera funguje spoľahlivo len cez **HTTPS** (alebo `localhost`). Pre použitie v LAN pozri `vite.config.ts` (pripravený HTTPS preview) alebo hostuj za reverse proxy s certifikátom.
6. Dáta sú v Safari úložisku zariadenia – pri „premazaní údajov stránok“ by sa mohli stratiť, preto pravidelne **exportuj zálohu** (Nastavenia → Záloha zbierky).

## Vývoj

```bash
npm install
npm run dev        # dev server (kamera vyžaduje localhost/HTTPS)
npm run vendor:ocr # stiahne Tesseract OCR modely do public/tesseract (raz, ~13 MB)
npm run build:pwa  # ikony + vendor OCR + produkčný build + service worker do dist/
npm run preview    # spustenie produkčného buildu
npm run typecheck  # kontrola typov
```

Štruktúra:

- `src/components/` – Camera (fot oboch strán), Collection (zoznam), CoinEditor (formulár), CoinDetail (detail)
- `src/lib/storage.ts` – IndexedDB ukladanie (idb-keyval) + sanitizácia dát
- `src/lib/recognize.ts` – lokálna analýza fotografie (hrany, kruhovosť, okraj)
- `src/lib/ocr.ts` – auto-rozpoznávanie: výrez kruhu, predspracovanie, Tesseract OCR, klasifikácia kovu
- `src/lib/coinparse.ts` – parsovanie textu z OCR (rok, krajina, nominál, mena)
- `src/lib/catalog.ts` – mini-katalóg materiálov a hmotností
- `src/lib/backup.ts` – export/import JSON zálohy
- `scripts/` – generovanie PWA ikon, service workera a vendorovanie OCR

## Roadmapa

- [x] Fotenie + ukladanie zbierky (v0.1.0)
- [x] Auto-vyplnenie údajov z fotky – OCR nápisu + farba kovu (v0.2.0)
- [ ] Rozšírenie rozpoznávania na konkrétne emisie (porovnanie s obrázkovým katalógom)
- [ ] Zdieľanie zbierky medzi zariadeniami (vlastný sync, stále bez cloudu tretej strany)
