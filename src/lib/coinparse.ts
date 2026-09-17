// Analýza textu z OCR mince → štruktúrované údaje.
// Heuristiky pre slovenské/české/europské mince, všetko off-line.

export interface ParsedCoin {
  year: string;
  country: string;
  denomination: string;
  currency: string;
  name: string;
  confidence: number; // 0..1 – koľko polí sa podarilo určiť
}

const COUNTRY_PATTERNS: Array<{ re: RegExp; country: string; currency: string }> = [
  { re: /SLOVENSKA\s*REPUBLIKA|SLOVENSKO/i, country: "Slovensko", currency: "SKK" },
  { re: /SLOVENSKA\s*SOCIALISTICKA|CESKOSLOVENSKA\s*SOCIALISTICKA/i, country: "Československo", currency: "Kčs" },
  { re: /CESKOSLOVENSKA\s*REPUBLIKA|REPUBLIKA\s*CESKOSLOVENSKA|CESKOSLOVENSKO/i, country: "Československo", currency: "Kčs" },
  { re: /CESKA\s*REPUBLIKA/i, country: "Česko", currency: "CZK" },
  { re: /MAGYAR/i, country: "Maďarsko", currency: "HUF" },
  { re: /OSTERREICH|REPUBLIK\s*OSTERREICH/i, country: "Rakúsko", currency: "ATS" },
  { re: /POLSKA\s*RP|POLSKA/i, country: "Poľsko", currency: "PLN" },
  { re: /DEUTSCHES?\s*REICH|BUNDESREPUBLIK|DEUTSCHLAND/i, country: "Nemecko", currency: "DEM" },
  { re: /EUROPA|EURO ?CENT|EURO\s*CENT/i, country: "Eurozóna", currency: "EUR" }
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

/** Nájde rok 1800–2099 v texte (najčastejší/positlastný výskyt). */
export function findYear(text: string): string {
  const years = text.match(/\b(1[89]\d{2}|20[0-4]\d)\b/g) ?? [];
  if (years.length === 0) return "";
  // najčastejší výskyt, pri remíze posledný
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

/** Nájde nominál – číslo + mena alebo slovné číslovky. */
export function findDenomination(text: string): { denomination: string; currency: string } {
  const t = deaccent(text).toUpperCase();

  // "2 EURA", "1 EURO CENT", "50 CENTOV", "10 KORUN"…
  const numeric = t.match(/(\d{1,3})\s*(EURO?\s*CENTY?|CENTU?|CENTY|CENT|EUR|EURA|KORUN\w*|KC?S|HALER\w*|FORINT\w*|ZLOTY\w*|SCHILLING\w*)/);
  if (numeric) {
    const value = numeric[1];
    const unit = numeric[2].replace(/\s+/g, " ").trim();
    let currency = "";
    if (/EURO?\s*CENT|CENT/.test(unit)) currency = "EUR";
    else if (/EUR|EURA/.test(unit)) currency = "EUR";
    else if (/HALER/.test(unit)) currency = "hal.";
    else if (/FORINT/.test(unit)) currency = "HUF";
    else if (/ZLOTY/.test(unit)) currency = "PLN";
    else if (/SCHILLING/.test(unit)) currency = "ATS";
    // KORUN/KCS bez slova "československá" – menu určí krajina (SKK/CZK/Kčs)
    else if (/KCS/.test(unit) && /CESKOSLOVENSK|SOCIALIST/.test(t)) currency = "Kčs";
    const label = /CENT/.test(unit) ? `${value} centov` : /KORUN/.test(unit) ? `${value} korún` : `${value} ${unit.toLowerCase()}`;
    return { denomination: label, currency };
  }

  // Slovné číslovky: "DESAŤ KORÚN"
  for (const [word, value] of Object.entries(NUM_WORDS)) {
    const w = deaccent(word).toUpperCase();
    const re = new RegExp(`\\b${w}\\s+(KORUN\\w*|KC?S|EUR\\w*|HALER\\w*)`);
    const m = t.match(re);
    if (m) {
      const currency = /EUR/.test(m[1]) ? "EUR" : /HALER/.test(m[1]) ? "hal." : "";
      return { denomination: `${value} korún`, currency };
    }
  }

  // Koruny bez meny – menu určí krajina neskôr (SKK/CZK/Kčs)
  const koruna = t.match(/(\d{1,3})\s*KORUN/);
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
