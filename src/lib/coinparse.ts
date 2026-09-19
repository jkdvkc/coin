// Analýza textu z OCR mince → štruktúrované údaje.
// Heuristiky pre slovenské/české/europské mince, všetko off-line.
// OCR na minciach mýli znaky (O↔0, I/l↔1, S↔5, Z↔2, B↔8, G↔6) – pre čísla
// preto normalizujeme text, pre slová používame tolerantné vzory.

export interface ParsedCoin {
  year: string;
  country: string;
  denomination: string;
  currency: string;
  name: string;
  confidence: number; // 0..1 – koľko polí sa podarilo určiť
}

const COUNTRY_PATTERNS: Array<{ re: RegExp; country: string; currency: string }> = [
  // Pozor na poradie: Československo pred Slovenskom (inak by "CESKOSLOVENSKA"
  // spoznal vzor SLOVENSKA vnútri). OCR mýli O/0 a vkladá medzery.
  { re: /CESK[O0]SLOVENSK[AO0]|CESKO\s*-?\s*SL[O0]VENSK[AO0]/, country: "Československo", currency: "Kčs" },
  { re: /S[5L]?LOVENSK[AO0]|SL[O0]VENSK[AO0]/, country: "Slovensko", currency: "SKK" },
  { re: /CESKA\s*REPU?BLI[IK]A|CESKA\s*REPUBLI?K/, country: "Česko", currency: "CZK" },
  { re: /MAGY[AV]R|MAJYAR/, country: "Maďarsko", currency: "HUF" },
  { re: /O[S5]TERREICH|REPUBLIK\s*O[S5]TERREICH/i, country: "Rakúsko", currency: "ATS" },
  { re: /P[O0]LSK[AO]|POLSKA\s*RP/, country: "Poľsko", currency: "PLN" },
  { re: /DEUTSCHES?\s*REICH|BUNDESREPUBLIK|DEUTSCHLAND/, country: "Nemecko", currency: "DEM" },
  { re: /EUROPA|EURO\s*CENT|EUROCENT|EVR?O\s*CENT/, country: "Eurozóna", currency: "EUR" }
];

const NUM_WORDS: Record<string, number> = {
  jedna: 1, jedne: 1, jeden: 1,
  dva: 2, dve: 2,
  tri: 3,
  styri: 4,
  pat: 5,
  ses: 6,
  sedem: 7,
  osem: 8,
  devat: 9,
  desat: 10
};

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Normalizácia pre číselné vzory: OCR zámeny → číslice. */
function digitsNorm(s: string): string {
  return deaccent(s)
    .toUpperCase()
    .replace(/[OQ]/g, "0")
    .replace(/[IL|]/g, "1")
    .replace(/[SZ]/g, "5") // Z→2 by bolo agresívnejšie; S→5 pokrýva väčšinu
    .replace(/B/g, "8")
    .replace(/G/g, "6");
}

function mapDigitChars(s: string): string {
  return s.replace(/[OQ]/g, "0").replace(/[IL|]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/G/g, "6");
}

/** Nájde rok 1800–2099, tolerantný na OCR zámeny (2OO5, Z005, 2O0S…). */
export function findYear(text: string): string {
  // Vzor priamo nad číslicami…
  const plain = text.match(/\b(1[89]\d{2}|20[0-4]\d)\b/g) ?? [];
  if (plain.length > 0) {
    const counts = new Map<string, number>();
    for (const y of plain) counts.set(y, (counts.get(y) ?? 0) + 1);
    let best = plain[plain.length - 1];
    let bestCount = 0;
    for (const [y, c] of counts) {
      if (c >= bestCount) {
        best = y;
        bestCount = c;
      }
    }
    return best;
  }
  // …inak tolerantný vzor nad OCR zámenami
  const t = deaccent(text).toUpperCase();
  const re = /\b([12][89OILSZQ][0-9OILSZQ]{2})\b/g;
  const years: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const digits = mapDigitChars(m[1]);
    if (/^(1[89]\d{2}|20[0-4]\d)$/.test(digits)) years.push(digits);
  }
  if (years.length === 0) return "";
  const counts = new Map<string, number>();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  let best = years[years.length - 1];
  let bestCount = 0;
  for (const [y, c] of counts) {
    if (c >= bestCount) {
      best = y;
      bestCount = c;
    }
  }
  return best;
}

/** Jednotky – tolerantné na OCR (K0RUN, KORUNY, KC5…, symbol €). */
const UNIT_RE =
  /(€|EURO?CENT|EURO?\s*CENT[YUIA]?|CENT[YUIA]?|EURA?|K[O0]RUN[YSYZ]*|KC?[S5][SZ5]?|HAL[EI]R[OUYZ]*|F[O0]RINT[OUYZ]*|ZL[O0]TY[CH]*|SCHILLING[EP]?)/;

/** Nájde nominál – číslo + mena alebo slovné číslovky. */
export function findDenomination(text: string): { denomination: string; currency: string } {
  const t = deaccent(text).toUpperCase();
  const tn = digitsNorm(text).toUpperCase();

  // "2 EURA", "1 EURO CENT", "50 CENTOV", "10 KORUN", "10 K0RUN", "2 €"…
  // (hľadáme na normalizovanej aj pôvodnej variante, podľa toho, čo dá zmysel)
  for (const src of [t, tn]) {
    const numeric = src.match(new RegExp(`(\\d{1,3})\\s*${UNIT_RE.source}`));
    if (!numeric) continue;
    const value = mapDigitChars(numeric[1]);
    if (Number(value) === 0 || Number(value) > 999) continue;
    const unit = numeric[2].replace(/\s+/g, " ").trim();
    let currency = "";
    if (/CENT/.test(unit)) currency = "EUR";
    else if (/^EUR|^€/.test(unit)) currency = "EUR";
    else if (/HAL/.test(unit)) currency = "hal.";
    else if (/FORINT/.test(unit)) currency = "HUF";
    else if (/ZLOTY/.test(unit)) currency = "PLN";
    else if (/SCHILLING/.test(unit)) currency = "ATS";
    else if (/^KC?[S5]/.test(unit) && /CESKOSLOVENSK|SOCIALIST/.test(t)) currency = "Kčs";
    const label = /CENT/.test(unit)
      ? `${value} centov`
      : /K[O0]RUN|KORUN/.test(unit)
        ? `${value} korún`
        : /^€|^EUR/.test(unit)
          ? `${value} eur`
          : /^KC?[S5]/.test(unit)
            ? `${value} Kčs`
            : `${value} ${unit.toLowerCase()}`;
    return { denomination: label, currency };
  }

  // Slovné číslovky: "DESAŤ KORÚN"
  for (const [word, value] of Object.entries(NUM_WORDS)) {
    const w = deaccent(word).toUpperCase();
    const re = new RegExp(`\\b${w}\\s+(K[O0]RUN\\w*|KC?S[5SZ]?|EUR\\w*|HALER\\w*)`);
    const m = t.match(re) ?? tn.match(re);
    if (m) {
      const currency = /EUR/.test(m[1]) ? "EUR" : /HAL/.test(m[1]) ? "hal." : "";
      return { denomination: `${value} korún`, currency };
    }
  }

  // Koruny bez meny – menu určí krajina neskôr (SKK/CZK/Kčs)
  const koruna = tn.match(/(\d{1,3})\s*K[O0]RUN/) ?? t.match(/(\d{1,3})\s*KORUN/);
  if (koruna) return { denomination: `${koruna[1]} korún`, currency: "" };

  return { denomination: "", currency: "" };
}

/** Spozná krajinu z nápisu na minci. */
export function findCountry(text: string): { country: string; currency: string } {
  const t = deaccent(text);
  for (const { re, country, currency } of COUNTRY_PATTERNS) {
    if (re.test(t)) return { country, currency };
  }
  return { country: "", currency: "" };
}

export function parseCoinText(text: string): ParsedCoin {
  const year = findYear(text);
  const { country, currency: countryCurrency } = findCountry(text);
  const { denomination, currency: denomCurrency } = findDenomination(text);
  let currency = denomCurrency || countryCurrency;
  // Koruny bez jednoznačnej meny: podľa krajiny (Slovensko→SKK, Česko→CZK, Československo→Kčs)
  if (!denomCurrency && /korún|korun/i.test(denomination)) {
    if (country === "Slovensko") currency = "SKK";
    else if (country === "Česko") currency = "CZK";
    else if (country === "Československo") currency = "Kčs";
  }

  let confidence = 0;
  if (year) confidence += 0.4;
  if (country) confidence += 0.3;
  if (denomination) confidence += 0.3;

  return { year, country, denomination, currency, name: "", confidence };
}
