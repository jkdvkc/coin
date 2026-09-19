// Mini-katalóg bežných mincí – výhradne off-line, vstavaný do aplikácie.
// Hmotnosti sú oficiálne špecifikácie (to nie je odhad, ale výrobný parameter).
// Materiály sú uvedené zjednodušene bežným názvom.
// Kľúč: normalizovaný názov krajiny + rok/nominál.

export interface CoinSpec {
  country: string;
  name: string;
  denomination: string;
  material: string;
  weightGrams: number;
  years?: string; // "1993-2022" alebo konkrétny rok
  diameterMm?: number;
}

export const MATERIALS = [
  "Meď",
  "Bronz",
  "Mosadz",
  "Oceľ pozinkovaná",
  "Oceľ s medeným povrchom",
  "Nikel",
  "Niklová mosadz",
  "CuNi (meď-nikel)",
  "Nordic gold",
  "Hliník",
  "Hliník-bronz",
  "Striebro",
  "Striebro .800",
  "Striebro .925 (Ag)",
  "Zlato",
  "Bimetal (CuNi/striebrná ocel)",
  "Iný / neviem"
] as const;

// Najbežnejšie slovenské, české a eurové mince.
export const COIN_SPECS: CoinSpec[] = [
  // --- Eurové mince (všetky krajiny eurozóny majú rovnaké parametre) ---
  { country: "euro", name: "1 cent", denomination: "1 cent", material: "Oceľ s medeným povrchom", weightGrams: 2.3, diameterMm: 16.25 },
  { country: "euro", name: "2 centy", denomination: "2 centy", material: "Oceľ s medeným povrchom", weightGrams: 3.06, diameterMm: 18.75 },
  { country: "euro", name: "5 centov", denomination: "5 centov", material: "Oceľ s medeným povrchom", weightGrams: 3.92, diameterMm: 21.25 },
  { country: "euro", name: "10 centov", denomination: "10 centov", material: "Nordic gold", weightGrams: 4.1, diameterMm: 19.75 },
  { country: "euro", name: "20 centov", denomination: "20 centov", material: "Nordic gold", weightGrams: 5.74, diameterMm: 22.25 },
  { country: "euro", name: "50 centov", denomination: "50 centov", material: "Nordic gold", weightGrams: 7.8, diameterMm: 24.25 },
  { country: "euro", name: "1 euro", denomination: "1 euro", material: "Bimetal (CuNi/striebrná ocel)", weightGrams: 7.5, diameterMm: 23.25 },
  { country: "euro", name: "2 eurá", denomination: "2 eurá", material: "Bimetal (CuNi/striebrná ocel)", weightGrams: 8.5, diameterMm: 25.75 },

  // --- Slovensko (SR, 1993–2008) ---
  { country: "slovensko", name: "1 koruna (SR)", denomination: "1 koruna", material: "Meď pozinkovaná / ocel", weightGrams: 3.8, years: "1993-2008" },
  { country: "slovensko", name: "2 koruny (SR)", denomination: "2 koruny", material: "Nikel", weightGrams: 5.1, years: "1993-2008" },
  { country: "slovensko", name: "5 koruna (SR)", denomination: "5 koruna", material: "CuNi (meď-nikel)", weightGrams: 6.6, years: "1993-2008" },
  { country: "slovensko", name: "10 koruna (SR)", denomination: "10 koruna", material: "CuNi (meď-nikel)", weightGrams: 8.5, years: "1993-2008" },
  { country: "slovensko", name: "20 koruna (SR)", denomination: "20 koruna", material: "CuNi (meď-nikel)", weightGrams: 11.0, years: "1993- r. 2008" },
  { country: "slovensko", name: "50 koruna (SR)", denomination: "50 koruna", material: "CuNi (meď-nikel)", weightGrams: 12.0, years: "1994-2008" },

  // --- Československo (Kčs) ---
  { country: "ceskoslovensko", name: "1 koruna (Kčs)", denomination: "1 koruna", material: "Meď pozinkovaná", weightGrams: 3.7, years: "1920-1992" },
  { country: "ceskoslovensko", name: "3 koruna (Kčs)", denomination: "3 koruny", material: "Meď pozinkovaná", weightGrams: 7.0, years: "1920-1950" },
  { country: "ceskoslovensko", name: "5 koruna (Kčs)", denomination: "5 korun", material: "CuNi (meď-nikel)", weightGrams: 9.0, years: "1928" },
  { country: "ceskoslovensko", name: "10 koruna (Kčs) – 1928", denomination: "10 koruna", material: "Striebro .700", weightGrams: 8.0, years: "1928-1933" },
  { country: "ceskoslovensko", name: "10 koruna (Kčs) – Štefánik", denomination: "10 koruna", material: "CuNi (meď-nikel)", weightGrams: 7.5, years: "1948-1950" },
  { country: "ceskoslovensko", name: "20 koruna (Kčs)", denomination: "20 koruna", material: "Striebro .700", weightGrams: 11.0, years: "1933" },
  { country: "csfr", name: "10 koruna (ČSFR)", denomination: "10 koruna", material: "CuNi (meď-nikel)", weightGrams: 9.0, years: "1991-1992" },

  // --- Česko (ČR) ---
  { country: "cesko", name: "1 koruna (ČR)", denomination: "1 koruna", material: "Oceľ s medeným povrchom", weightGrams: 3.7, years: "1993-" },
  { country: "cesko", name: "2 koruny (ČR)", denomination: "2 koruny", material: "Oceľ s medeným povrchom", weightGrams: 4.4, years: "1993-" },
  { country: "obežné", name: "5 korun (ČR)", denomination: "5 korun", material: "CuNi (meď-nikel)", weightGrams: 4.8, years: "1993-" },
  { country: "cesko", name: "10 koruna (ČR)", denomination: "10 koruna", material: "CuNi (meď-nikel)", weightGrams: 6.8, years: "1993-" },
  { country: "cesko", name: "20 koruna (ČR)", denomination: "20 koruna", material: "CuNi (meď-nikel)", weightGrams: 8.43, years: "1993-" },
  { country: "cesko", name: "50 koruna (ČR)", denomination: "50 koruna", material: "CuNi (meď-nikel)", weightGrams: 9.7, years: "1993-" },

  // --- Maďarsko (bežné) ---
  { country: "madarsko", name: "5 forint (HUF)", denomination: "5 forint", material: "CuNi (meď-nikel)", weightGrams: 4.1, years: "1992-" },
  { country: "madarsko", name: "10 forint (HUF)", denomination: "10 forint", material: "CuNi (meď-nikel)", weightGrams: 6.1, years: "1992-" },
  { country: "madarsko", name: "20 forint (HUF)", denomination: "20 forint", material: "CuNi (meď-nikel)", weightGrams: 6.85, years: "2012-" },
  { country: "madarsko", name: "50 forint (HUF)", denomination: "50 forint", material: "CuNi (meď-nikel)", weightGrams: 7.7, years: "2009-" },
  { country: "madarsko", name: "100 forint (HUF)", denomination: "100 forint", material: "Niklová mosadz", weightGrams: 9.9, years: "1996-" }
];

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface SpecMatch {
  spec: CoinSpec;
  score: number;
}

export function denomScore(nDenom: string, specDenom: string, specName: string): number {
  if (!nDenom) return 0;
  const targets = [normalize(specDenom), normalize(specName)];
  let best = 0;
  for (const t of targets) {
    if (!t) continue;
    if (nDenom === t) {
      best = Math.max(best, 4);
      continue;
    }
    if (nDenom.includes(t) || t.includes(nDenom)) {
      best = Math.max(best, 3);
      continue;
    }
    // Rovnaká hodnota + rovnaký slovný kmeň ("10 korun" ≈ "10 koruna")
    const numA = nDenom.match(/^\d+/)?.[0];
    const numB = t.match(/^\d+/)?.[0];
    const wordA = nDenom.replace(/^\d+\s*/, "");
    const wordB = t.replace(/^\d+\s*/, "");
    if (numA && numB && numA === numB && wordA.slice(0, 4) === wordB.slice(0, 4) && wordA.length > 0) {
      best = Math.max(best, 2);
    }
  }
  return best;
}

function yearScore(specYears: string | undefined, yearNum: number): number {
  if (!Number.isFinite(yearNum) || !specYears) return 0;
  const m = specYears.match(/(\d{4})\s*-\s*(\d{4})?/);
  if (!m) return 0;
  const from = parseInt(m[1], 10);
  const to = m[2] ? parseInt(m[2], 10) : 2100;
  return yearNum >= from && yearNum <= to ? 1 : -1;
}

/** Heuristické vyhľadanie špecifikácie podľa krajiny, nominálu a roku. */
export function findSpec(country: string, denomination: string, year: string): SpecMatch | null {
  const nCountry = normalize(country || "");
  const nDenom = normalize(denomination || "");
  const yearNum = parseInt(year, 10);

  let best: SpecMatch | null = null;

  for (const spec of COIN_SPECS) {
    let score = 0;
    const nSpecCountry = normalize(spec.country);
    if (nCountry && nSpecCountry) {
      if (nCountry === nSpecCountry) score += 2;
      else if (nCountry.includes(nSpecCountry)) score += 1;
    }
    score += denomScore(nDenom, spec.denomination, spec.name);
    score += yearScore(spec.years, yearNum);

    // Nominál, ak je zadaný, musí zodpovedať – inak neriskujeme zlý návrh
    const dScore = denomScore(nDenom, spec.denomination, spec.name);
    const acceptable = nDenom ? dScore >= 2 : score >= 3;
    if (acceptable && (!best || score > best.score)) {
      best = { spec, score };
    }
  }

  return best;
}

/** Odporúčaný materiál + hmotnosť pre formulár (ak sú k dispozícii). */
export function suggestSpec(country: string, denomination: string, year: string): SpecMatch | null {
  return findSpec(country, denomination, year);
}
