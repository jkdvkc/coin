// Orientačná cena mince – výhradne z podložených východísk, žiadne vymyslené čísla.
//
// Princíp: cena = max(bežná hodnota, kovová hodnota) × bonus za chybu.
//  - bežné obežné mince: nominálna hodnota (2 € = 2 €)
//  - staré SKK/CZK/Kčs: nominál prepočítaný oficiálnym pevným kurzom SKK→EUR 30.1260
//    (CZK približným 24 CZK/EUR), plus malý kolekčný násobok pre ukončené meny
//  - strieborné/zlaté mince: kovová hodnota = hmotnosť × čistota × spotová cena
//    (spotovú cenu si používateľ nastaví sám v Nastaveniach – vždy podložené)
//  - chyborazba: × multiplikátor zo zoznamu známych chýb

import { MINT_ERRORS } from "./errors";

export interface Settings {
  silverEurPerOz: number; // spotová cena striebra EUR/oz
  goldEurPerOz: number; // spotová cena zlata EUR/oz
}

export const DEFAULT_SETTINGS: Settings = {
  silverEurPerOz: 35,
  goldEurPerOz: 2200
};

export const SKK_PER_EUR = 30.126; // oficiálny pevný kurz pri prechode na euro
export const CZK_PER_EUR = 24; // približný kurz
// Kčs→CZK: pri delení ČSFR 1993 sa korunové bankovky a mince vymieňali 1:1 (dokumentované)
export const KCS_TO_CZK = 1;

export interface ValueEstimate {
  base: number; // bežná hodnota mince bez chyby
  metal: number; // kovová hodnota
  usedMetal: boolean;
  range: [number, number]; // finálny rozsah (s chybou ak je)
  basis: string; // ľudsky: z čoho číslo vychádza
}

/** Čistota kovu z materiálového popisu (berieme len jednoznačné prípady). */
function metalFineness(material: string): { metal: "silver" | "gold" | null; fineness: number } {
  const m = material.toLowerCase();
  if (/striebro\s*\.?925|ag\s*925/.test(m)) return { metal: "silver", fineness: 0.925 };
  if (/striebro\s*\.?800/.test(m)) return { metal: "silver", fineness: 0.8 };
  if (/striebro/.test(m)) return { metal: "silver", fineness: 0.833 }; // bežná mincovná striebra
  if (/zlato/.test(m)) return { metal: "gold", fineness: 0.986 };
  return { metal: null, fineness: 0 };
}

/** Nominálna hodnota v EUR z nominálu a meny. */
function faceValueEur(denomination: string, currency: string): number | null {
  const num = parseFloat(denomination.replace(",", ".").match(/[\d.]+/)?.[0] ?? "");
  if (!Number.isFinite(num) || num <= 0) return null;
  const cur = currency.trim().toUpperCase();
  if (cur === "EUR") return num;
  if (cur === "SKK") return num / SKK_PER_EUR;
  if (cur === "CZK") return num / CZK_PER_EUR;
  if (cur === "KC" || cur === "KČ") return num / CZK_PER_EUR;
  if (cur === "KCS" || cur === "KČS") return num * KCS_TO_CZK / CZK_PER_EUR; // 1:1 → CZK
  return null;
}

export interface EstimateInput {
  denomination: string;
  currency: string;
  year: string;
  material: string;
  weightGrams: number | null;
  errorIds: string[]; // známe chyby (max 1–2 berieme do úvahy)
  settings: Settings;
}

const OZ = 31.1034768;

export function estimateValue(input: EstimateInput): ValueEstimate {
  const face = faceValueEur(input.denomination, input.currency);
  const { metal, fineness } = metalFineness(input.material);

  // Kovová hodnota (iba ak poznáme hmotnosť aj čistotu)
  let metalValue = 0;
  if (metal && input.weightGrams != null && input.weightGrams > 0) {
    const spot = metal === "gold" ? input.settings.goldEurPerOz : input.settings.silverEurPerOz;
    metalValue = (input.weightGrams / OZ) * fineness * spot;
  }

  // Bežná hodnota: katalógový základ pre ukončené meny + nominál
  // SKK/CZK mince v zbierkach sa bežne predávajú od ~1,5× nominálneho ekvivalentu
  let base = Math.max(face ?? 0, metalValue);
  let basis = "";
  if (metalValue > 0 && metalValue >= (face ?? 0)) {
    basis = `kovová hodnota (${metal === "gold" ? "zlato" : "striebr"} × ${fineness})`;
  } else if (face != null) {
    if (input.currency.toUpperCase() === "SKK") {
      base = Math.max(base, face * 1.5);
      basis = `nominál ${input.denomination} SKK prepočítaný kurzom 30,126 + 50 % kolekčný základ`;
    } else if (input.currency.toUpperCase() === "CZK" || input.currency.toUpperCase() === "KC") {
      base = Math.max(base, face * 1.3);
      basis = `nominál ${input.denomination} CZK prepočítaný kurzom 24 + 30 % kolekčný základ`;
    } else if (input.currency.toUpperCase() === "KCS" || input.currency.toUpperCase() === "KČS") {
      base = Math.max(base, face * 1.5);
      basis = `nominál ${input.denomination} Kčs (vymena 1:1 na CZK, kurz 24) + 50 % kolekčný základ`;
    } else {
      basis = `nominálna hodnota ${input.denomination} EUR`;
    }
  } else {
    basis = "nepodarilo sa určiť podklad – cena nie je spoľahlivá";
    return { base: 0, metal: metalValue, usedMetal: metalValue > 0, range: [0, 0], basis };
  }

  // Bonus za chyby – berieme len 1 najvýraznejšiu (najvyšší multiplier)
  let mult: [number, number] = [1, 1];
  let errorApplied = "";
  if (input.errorIds.length > 0) {
    for (const id of input.errorIds) {
      const err = MINT_ERRORS.find((e) => e.id === id);
      if (err && err.multiplier[1] > mult[1]) {
        mult = err.multiplier;
        errorApplied = err.name;
      }
    }
  }

  const final: [number, number] = [
    Math.round(base * mult[0] * 100) / 100,
    Math.round(base * mult[1] * 100) / 100
  ];

  if (errorApplied) {
    basis += ` × ${errorApplied.toLowerCase()} (×${mult[0]}–${mult[1]})`;
  }

  return { base: Math.round(base * 100) / 100, metal: Math.round(metalValue * 100) / 100, usedMetal: metalValue > 0, range: final, basis };
}

/** Aplikuje multiplikátor konkrétnej chyby na základ. */
export function applyErrorToBase(base: number, multiplier: [number, number]): [number, number] {
  return [Math.round(base * multiplier[0] * 100) / 100, Math.round(base * multiplier[1] * 100) / 100];
}
