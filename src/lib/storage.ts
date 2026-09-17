import { get, set, del, keys } from "idb-keyval";

export interface RecognitionResult {
  name: string;
  country: string;
  year: string;
  denomination: string;
  currency: string;
  mintMark: string;
  catalogNumber: string;
  gradeEstimate: string;
  confidence: number;
}

export interface CoinRecord {
  id: string;
  createdAt: number;
  updatedAt: number;

  photoObverse: string | null;
  photoReverse: string | null;

  name: string;
  country: string;
  year: string;
  denomination: string;
  currency: string;
  mintMark: string;
  catalogNumber: string;

  // Materiál a hmotnosť (orientačné, voliteľné)
  material: string;
  weightGrams: number | null;

  quantity: number;
  grade: string;
  note: string;
  errors: string;
  purchasedPrice: number | null;

  priceBacked: boolean;
  priceValue: number | null;
  priceSource: string;
  priceNote: string;

  recognitionStatus: "none" | "pending" | "done" | "failed";
  recognized: RecognitionResult | null;
}

export interface AppSettings {
  shownIntro: boolean;
  silverEurPerOz?: number;
  goldEurPerOz?: number;
}

const SETTINGS_KEY = "cs_settings_v1";

/** Cena je „podložená“ len ak ju používateľ potvrdil, vyplnil a uvedl zdroj. */
export function isPriceBacked(c: Pick<CoinRecord, "priceBacked" | "priceValue" | "priceSource">): boolean {
  return c.priceBacked && c.priceValue != null && c.priceSource.trim() !== "";
}

export function newCoinId(): string {
  return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function sanitizeCoin(raw: unknown): CoinRecord {
  const now = Date.now();
  const o = (raw ?? {}) as Partial<CoinRecord>;
  const quantity = Math.max(1, Math.floor(Number(o.quantity) || 1));
  return {
    id: str(o.id) || newCoinId(),
    createdAt: num(o.createdAt) ?? now,
    updatedAt: num(o.updatedAt) ?? now,
    photoObverse: typeof o.photoObverse === "string" ? o.photoObverse : null,
    photoReverse: typeof o.photoReverse === "string" ? o.photoReverse : null,
    name: str(o.name),
    country: str(o.country),
    year: str(o.year),
    denomination: str(o.denomination),
    currency: str(o.currency),
    mintMark: str(o.mintMark),
    catalogNumber: str(o.catalogNumber),
    material: str(o.material),
    weightGrams: num(o.weightGrams),
    quantity,
    grade: str(o.grade),
    note: str(o.note),
    errors: str(o.errors),
    purchasedPrice: num(o.purchasedPrice),
    priceBacked: o.priceBacked === true,
    priceValue: num(o.priceValue),
    priceSource: str(o.priceSource),
    priceNote: str(o.priceNote),
    recognitionStatus:
      o.recognitionStatus === "pending" ||
      o.recognitionStatus === "done" ||
      o.recognitionStatus === "failed"
        ? o.recognitionStatus
        : "none",
    recognized: null
  };
}

export async function dbGetCollection(): Promise<CoinRecord[]> {
  const allKeys = await keys();
  const values = await Promise.all(allKeys.map((k) => get(k)));
  return values
    .filter(
      (v): v is CoinRecord =>
        !!v && typeof v === "object" && typeof (v as CoinRecord).id === "string"
    )
    .map(sanitizeCoin)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function dbGetCoin(id: string): Promise<CoinRecord | undefined> {
  const raw = await get(id);
  return raw ? sanitizeCoin(raw) : undefined;
}

export async function dbSaveCoin(coin: CoinRecord): Promise<void> {
  await set(coin.id, coin);
}

export async function dbDeleteCoin(id: string): Promise<void> {
  await del(id);
}

export async function dbGetSettings(): Promise<AppSettings> {
  const raw = (await get(SETTINGS_KEY)) as Partial<AppSettings> | undefined;
  return { shownIntro: raw?.shownIntro === true, silverEurPerOz: raw?.silverEurPerOz, goldEurPerOz: raw?.goldEurPerOz };
}

export async function dbSaveSettings(s: AppSettings): Promise<void> {
  await set(SETTINGS_KEY, s);
}
