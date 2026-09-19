// Lokálne rozpoznávanie mince z fotky: výrez kruhu, predspracovanie, OCR (Tesseract.js vendor),
// klasifikácia kovu podľa farby. Bez platených API – model sa stiahne raz z vlastného hostingu.

import { parseCoinText, type ParsedCoin } from "./coinparse";
import { loadImage } from "./image";

export type MetalClass =
  | "copper"
  | "gold"
  | "silver"
  | "bimetal"
  | "unknown";

export interface OcrProgress {
  stage: "crop" | "preprocess" | "load-model" | "recognize" | "done";
  progress: number; // 0..1 v rámci stage
}

export interface CoinAutoFill {
  parsed: ParsedCoin;
  metal: MetalClass;
  metalLabel: string;
  materialSuggestion: string;
  weightSuggestion: string;
  hints: string[];
  rawText: string;
  confidence: number;
}

// Musí byť ABSOLÚTNA URL – blob worker nevie resolve-ať root-relatívne cesty v importScripts.
// Relatívne voči document.baseURI → funguje aj v podadresári (GitHub Pages) aj v koreni.
const TESS_BASE = new URL("tesseract/", document.baseURI).href;

let tessLibPromise: Promise<unknown> | null = null;

function loadTesseractLib(): Promise<unknown> {
  if (!tessLibPromise) {
    tessLibPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-cs-tesseract]');
      if (existing) {
        resolve((window as unknown as { Tesseract?: unknown }).Tesseract);
        return;
      }
      const s = document.createElement("script");
      s.src = new URL("tesseract/tesseract.min.js", document.baseURI).href;
      s.async = true;
      s.dataset.csTesseract = "1";
      s.onload = () => resolve((window as unknown as { Tesseract?: unknown }).Tesseract);
      s.onerror = () => reject(new Error("Tesseract skript sa nepodarilo načítať."));
      document.head.appendChild(s);
    });
  }
  return tessLibPromise;
}

interface TesseractWorker {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown> | unknown;
  terminate: () => Promise<unknown>;
}

interface TesseractGlobal {
  // v5 podpis: createWorker(langs, oem, options) – langs MUSÍ byť reťazec/pole, nie options!
  createWorker: (langs: string, oem: number, opts: Record<string, unknown>) => Promise<TesseractWorker>;
}

let workerPromise: Promise<TesseractWorker> | null = null;

// Pozor: do createWorker NEMÔŽEME posielať funkcie (logger/errorHandler) –
// postMessage na Worker by zlyhal na DataCloneError. Progress preto simulujeme časovačom.
function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = (await loadTesseractLib()) as TesseractGlobal | undefined;
      if (!Tesseract?.createWorker) throw new Error("Tesseract nie je dostupný.");
      const worker = await Tesseract.createWorker("eng", 1, {
        workerPath: `${TESS_BASE}/worker.min.js`,
        corePath: `${TESS_BASE}/`,
        langPath: TESS_BASE,
        gzip: false // vendor súbor je už rozbalený (eng.traineddata)
      });
      return worker;
    })();
    // Ak sa tvorba workera nepodarí, resetuj – ďalšie volanie skúsi znova.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  tessLibPromise = null;
  try {
    await w?.terminate();
  } catch {
    // ignoruj
  }
}

/** Vyreže kruh mince (podľa analýzy hrán) a vráti canvas + priemernú farbu kovu. */
export function cropCoinCircle(source: HTMLImageElement | HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  metal: MetalClass;
} {
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const small = document.createElement("canvas");
  const s = 256;
  small.width = s;
  small.height = s;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  if (!sctx) throw new Error("Canvas nie je dostupný.");
  sctx.drawImage(source, 0, 0, s, s);
  const { data } = sctx.getImageData(0, 0, s, s);

  // Grayscale + hrany (zjednodušene: luminancia gradientu)
  const gray = new Float32Array(s * s);
  for (let i = 0; i < s * s; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
  }
  const grad = new Float32Array(s * s);
  for (let y = 1; y < s - 1; y++) {
    for (let x = 1; x < s - 1; x++) {
      const i = y * s + x;
      grad[i] = Math.abs(gray[i - 1] - gray[i + 1]) + Math.abs(gray[i - s] - gray[i + s]);
    }
  }
  let sum = 0;
  let n = 0;
  for (let i = 0; i < s * s; i++) {
    sum += grad[i];
    n++;
  }
  const mean = sum / n;
  const points: Array<{ x: number; y: number }> = [];
  for (let y = 1; y < s - 1; y++) {
    for (let x = 1; x < s - 1; x++) {
      if (grad[y * s + x] > mean * 3) points.push({ x, y });
    }
  }

  let cx = s / 2;
  let cy = s / 2;
  let radius = s * 0.4;
  if (points.length > 30) {
    // priemer extrémov – robustný odhad stredu
    let minX = s, maxX = 0, minY = s, maxY = 0;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    cx = (minX + maxX) / 2;
    cy = (minY + maxY) / 2;
    radius = Math.max(maxX - minX, maxY - minY) / 2;
    radius = Math.min(radius * 1.02, s / 2 - 2);
  }

  // Výrez štvorca okolo kruhu v plnom rozlíšení
  const scaleX = sw / s;
  const scaleY = sh / s;
  const cxFull = cx * scaleX;
  const cyFull = cy * scaleY;
  const rFull = Math.max(16, radius * Math.max(scaleX, scaleY));
  const side = Math.ceil(rFull * 2);
  const crop = document.createElement("canvas");
  crop.width = side;
  crop.height = side;
  const cctx = crop.getContext("2d", { willReadFrequently: true });
  if (!cctx) throw new Error("Canvas nie je dostupný.");
  cctx.drawImage(source, cxFull - rFull, cyFull - rFull, side, side, 0, 0, side, side);

  // Klasifikácia kovu – priemerná farba v kruhu
  const img = cctx.getImageData(0, 0, side, side).data;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const c = side / 2;
  for (let y = 0; y < side; y += 2) {
    for (let x = 0; x < side; x += 2) {
      const dx = x - c;
      const dy = y - c;
      if (dx * dx + dy * dy > rFull * rFull) continue;
      const i = (y * side + x) * 4;
      rSum += img[i];
      gSum += img[i + 1];
      bSum += img[i + 2];
      count++;
    }
  }
  const r = rSum / count / 255;
  const g = gSum / count / 255;
  const b = bSum / count / 255;

  const metal = classifyMetal(r, g, b);
  return { canvas: crop, metal };
}

export function classifyMetal(r: number, g: number, b: number): MetalClass {
  const brightness = (r + g + b) / 3;
  const rg = r - g;
  const gb = g - b;
  const rb = r - b;
  if (brightness < 0.12 || brightness > 0.95) return "unknown";
  // Meď: výrazne viac červenej
  if (rg > 0.16 && rb > 0.24 && r > 0.35) return "copper";
  // Zlatá / mosadz: žltá bez červena
  if (rg > 0.1 && gb > 0.12 && rb > 0.2 && g > 0.4) return "gold";
  // Bimetal: vonkajší aj vnútorný kruh majú odlišný odtieň – vzorkujeme stred vs okraj
  // (detekujeme v cropCoinCircle len približne; presnejšie pri volaní)
  if (Math.abs(rg) < 0.06 && Math.abs(gb) < 0.08 && brightness > 0.3) return "silver";
  return "unknown";
}

/** Detekcia bimetálu: porovná farbu stredu a vonkajšieho prstencu. */
export function detectBimetal(crop: HTMLCanvasElement): boolean {
  const ctx = crop.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  const side = crop.width;
  const c = side / 2;
  const data = ctx.getImageData(0, 0, side, side).data;
  const sample = (r0: number, r1: number) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < side; y += 2) {
      for (let x = 0; x < side; x += 2) {
        const d = Math.hypot(x - c, y - c);
        if (d < r0 || d > r1) continue;
        const i = (y * side + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    return n ? { r: r / n / 255, g: g / n / 255, b: b / n / 255 } : null;
  };
  const center = sample(0, c * 0.45);
  const ring = sample(c * 0.75, c * 0.95);
  if (!center || !ring) return false;
  const dist = Math.abs(center.r - ring.r) + Math.abs(center.g - ring.g) + Math.abs(center.b - ring.b);
  return dist > 0.35;
}

/** Predspracovanie pre OCR: grayscale, kontrast, zaostrenie okolo kruhu. */
export function preprocessForOcr(crop: HTMLCanvasElement): HTMLCanvasElement {
  const target = 600;
  const side = Math.max(crop.width, crop.height);
  const scale = Math.min(2, Math.max(0.5, target / side));
  const out = document.createElement("canvas");
  out.width = Math.round(crop.width * scale);
  out.height = Math.round(crop.height * scale);
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas nie je dostupný.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(crop, 0, 0, out.width, out.height);

  const { data } = ctx.getImageData(0, 0, out.width, out.height);
  // grayscale + svetlé pozadie (minca môže byť tmavá)
  const w = out.width;
  const h = out.height;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  // auto-kontrast (percentil 5–95)
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  const loCut = gray.length * 0.05;
  const hiCut = gray.length * 0.95;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc < loCut) lo = v;
    if (acc < hiCut) hi = v;
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, ((gray[i] - lo) / range) * 255));
    const j = i * 4;
    data[j] = v;
    data[j + 1] = v;
    data[j + 2] = v;
    data[j + 3] = 255;
  }
  ctx.putImageData(new ImageData(data, w, h), 0, 0);
  return out;
}

/**
 * Iba farba kovu z fotky (bez OCR) – rýchle (~100 ms). Používa sa pre rub,
 * keď líc nevládol určiť materiál, aby sa rub zbytočne ne-OCR-oval.
 */
export async function extractMetalFromPhoto(
  dataUrl: string
): Promise<{ metal: MetalClass; materialSuggestion: string } | null> {
  try {
    const img = await loadImage(dataUrl);
    const { canvas: crop, metal } = cropCoinCircle(img);
    const bimetal = detectBimetal(crop);
    const m: MetalClass = bimetal ? "bimetal" : metal;
    return { metal: m, materialSuggestion: METAL_MATERIAL[m] };
  } catch {
    return null;
  }
}

/** Invertuje grayscale jas (tmavé mince so svetlým nápisom → Tesseract potrebuje opak). */
export function invertCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Zmenší canvas na daný násobok (Tesseract LSTM je trénovaný na text ~30–40 px;
 *  veľké osamelé číslice na minci (~80 px+) preskočí – preto pokus v menšom merítku). */
export function scaleCanvas(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(16, Math.round(src.width * factor));
  out.height = Math.max(16, Math.round(src.height * factor));
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Vystrihne stredovú časť canvasu (veľká číslica nominálu v strede mince). */
export function cropCenter(src: HTMLCanvasElement, frac: number): HTMLCanvasElement {
  const w = Math.round(src.width * frac);
  const h = Math.round(src.height * frac);
  const x0 = Math.round((src.width - w) / 2);
  const y0 = Math.round((src.height - h) / 2);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(src, x0, y0, w, h, 0, 0, w, h);
  return out;
}

/**
 * Otsu binarizácia – automaticky nájde prah medzi nápisom a povrchom mince.
 * Na reálnych fotkách (odlesky, tiene, špinavý povrch) často zachráni čítanie,
 * keď obyčajný grayscale kontrast nestačí.
 */
export function otsuBinarize(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const n = d.length / 4;
  const hist = new Uint32Array(256);
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const g = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) | 0;
    gray[i] = g;
    hist[g]++;
  }
  // Otsu: maximalizácia medzitriednej variancie
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += v * hist[v];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = v;
    }
  }
  for (let i = 0; i < n; i++) {
    const v = gray[i] > thr ? 255 : 0;
    const j = i * 4;
    d[j] = v;
    d[j + 1] = v;
    d[j + 2] = v;
    d[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/**
 * Rozvinie kruhový prstenec mince do rovného pásu (polar unwrap).
 * Zakrivený nápis (SLOVENSKO, MAGYARORSZÁG…) sa tak premení na normálny
 * riadok, ktorý Tesseract dokáže prečítať.
 *
 * ccw=false → pás začína na ľavom hornom kvadrante, číta horný oblúk.
 * ccw=true  → číta spodný oblúk (obrátený smer).
 * innerFirst=true → prvý riadok výsledku je vnútorný polomer.
 */
export function unwrapRing(
  src: HTMLCanvasElement,
  r0frac: number,
  r1frac: number,
  ccw: boolean,
  innerFirst: boolean,
  offsetRad: number
): HTMLCanvasElement {
  const side = src.width;
  const cx = side / 2;
  const cy = side / 2;
  const r0 = r0frac * (side / 2);
  const r1 = r1frac * (side / 2);
  const rMid = (r0 + r1) / 2;
  const W = Math.max(400, Math.min(2400, Math.round(2 * Math.PI * rMid)));
  const H = Math.max(56, Math.round(r1 - r0));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  const octx = out.getContext("2d", { willReadFrequently: true });
  if (!sctx || !octx) return out;
  const sd = sctx.getImageData(0, 0, side, side).data;
  const oimg = octx.createImageData(W, H);
  const od = oimg.data;

  const sample = (x: number, y: number, o: [number, number, number, number]) => {
    const x0 = Math.max(0, Math.min(side - 2, Math.floor(x)));
    const y0 = Math.max(0, Math.min(side - 2, Math.floor(y)));
    const fx = Math.max(0, Math.min(1, x - x0));
    const fy = Math.max(0, Math.min(1, y - y0));
    for (let k = 0; k < 4; k++) {
      const p00 = sd[(y0 * side + x0) * 4 + k];
      const p10 = sd[(y0 * side + x0 + 1) * 4 + k];
      const p01 = sd[((y0 + 1) * side + x0) * 4 + k];
      const p11 = sd[((y0 + 1) * side + x0 + 1) * 4 + k];
      o[k] = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
    }
  };
  const px: [number, number, number, number] = [0, 0, 0, 255];

  for (let y = 0; y < H; y++) {
    const t = H === 1 ? 0 : y / (H - 1);
    const r = innerFirst ? r0 + t * (r1 - r0) : r1 - t * (r1 - r0);
    for (let x = 0; x < W; x++) {
      const th = ccw ? offsetRad - (x / W) * 2 * Math.PI : offsetRad + (x / W) * 2 * Math.PI;
      sample(cx + r * Math.cos(th), cy + r * Math.sin(th), px);
      const i = (y * W + x) * 4;
      od[i] = px[0];
      od[i + 1] = px[1];
      od[i + 2] = px[2];
      od[i + 3] = 255;
    }
  }
  octx.putImageData(oimg, 0, 0);
  return out;
}

const METAL_LABELS: Record<MetalClass, string> = {
  copper: "Meď / pozinkovaná oceľ s medeným povrchom",
  gold: "Mosadz / Nordic gold / niklová mosadz",
  silver: "Nikel / CuNi / striebrná oceľ",
  bimetal: "Bimetal (dva kovy)",
  unknown: "Nerozpoznaný kov"
};

const METAL_MATERIAL: Record<MetalClass, string> = {
  copper: "Meď",
  gold: "Mosadz",
  silver: "CuNi (meď-nikel)",
  bimetal: "Bimetal (CuNi/striebrná ocel)",
  unknown: ""
};

/**
 * Hlavná funkcia: z data URL fotky urobí auto-vyplnenie formulára.
 * Robí DVA pokusy OCR: klasický predspracovaný obraz a invertovaný (tmavé mince
 * so svetlým nápisom). Berie pokus, ktorý dal zmysluplnnejší text (viac slov + číslic).
 */
export async function recognizeCoinPhoto(
  dataUrl: string,
  onProgress?: (p: OcrProgress) => void
): Promise<CoinAutoFill> {
  const img = await loadImage(dataUrl);
  onProgress?.({ stage: "crop", progress: 0.1 });

  const { canvas: crop, metal } = cropCoinCircle(img);
  const bimetal = detectBimetal(crop);
  const metalFinal: MetalClass = bimetal ? "bimetal" : metal;

  onProgress?.({ stage: "preprocess", progress: 0.3 });
  const pre = preprocessForOcr(crop);
  const preInv = invertCanvas(pre);

  onProgress?.({ stage: "load-model", progress: 0.4 });
  const worker = await getWorker();

  onProgress?.({ stage: "recognize", progress: 0.55 });
  let ticker: ReturnType<typeof setInterval> | null = null;
  try {
    ticker = setInterval(() => {
      onProgress?.({ stage: "recognize", progress: Math.min(0.95, (Date.now() % 100000) / 100000 * 0.4 + 0.55) });
    }, 500);

    const scoreText = (t: string) => {
      const words = (t.match(/[A-Za-zÀ-ž]{3,}/g) ?? []).length;
      const digits = (t.match(/\d{2,}/g) ?? []).length;
      return words * 2 + digits;
    };
    void scoreText;

    // Mince = riedky text na kruhu: default PSM 3 (celostránkový) na nich zlyháva.
    // Pokusy: celá minca (sparse, normálny aj invert), potom ROZVINUTÉ PÁSY
    // okolo okraja – tam je zakrivený nápis krajiny (SLOVENSKO, MAGYARORSZÁG…).
    const attempts: Array<{ canvas: HTMLCanvasElement; psm: string; whitelist?: string }> = [
      { canvas: pre, psm: "11" },
      { canvas: preInv, psm: "11" },
      // PSM 6 (blok textu) chytá veľké osamelé číslice v strede mince,
      // ktoré sparse režim (11) preskočí – napr. veľká „5" na 5 korunách.
      { canvas: pre, psm: "6" },
      { canvas: preInv, psm: "6" }
    ];
    // Otsu binarizácia – pomôže pri reálnych fotkách s odleskami/tieňmi
    try {
      attempts.push({ canvas: otsuBinarize(pre), psm: "11" });
      attempts.push({ canvas: otsuBinarize(pre), psm: "6" });
    } catch {
      // binarizácia nie je kritická
    }
    // Zmenšeninové pokusy – veľké číslice v strede mince ("5", "10", "2 €")
    // sú pre LSTM príliš veľké; v polovičnom merítku ich prečíta.
    try {
      const half = scaleCanvas(pre, 0.5);
      attempts.push({ canvas: half, psm: "11" });
      attempts.push({ canvas: half, psm: "6" });
    } catch {
      // scale nie je kritický
    }
    // CIEĽOVÝ POKUS: stred mince + whitelist číslic a € – číta veľký nominál
    // ("5", "2 €", "10"), ktorý celoplošné režimy ignorujú.
    let centerText = "";
    try {
      const c1 = scaleCanvas(cropCenter(pre, 0.5), 0.55); // ~165 px
      const c2 = scaleCanvas(cropCenter(pre, 0.65), 0.42); // ~164 px
      attempts.push({ canvas: c1, psm: "7", whitelist: "0123456789€ " });
      attempts.push({ canvas: c2, psm: "7", whitelist: "0123456789€ " });
    } catch {
      // center crop nie je kritický
    }
    // Pásy okolo okraja – zakrivený nápis krajiny.
    // Horný oblúk (ccw=false): písmená majú hroty VON (k okraju) → vonkajší polomer
    // musí byť hore pásu (innerFirst=false), inak je text hore-nohami.
    // Spodný oblúk (ccw=true): hroty smerujú DO stredu → vnútorný polomer hore (innerFirst=true).
    const strips: HTMLCanvasElement[] = [];
    try {
      strips.push(unwrapRing(crop, 0.68, 0.92, false, false, -Math.PI * 0.9));
      strips.push(unwrapRing(crop, 0.68, 0.92, false, false, -Math.PI * 0.4));
      strips.push(unwrapRing(crop, 0.68, 0.92, true, true, Math.PI * 0.9));
      strips.push(unwrapRing(crop, 0.68, 0.92, true, true, Math.PI * 0.4));
    } catch {
      // unwrap nie je kritický
    }
    for (const st of strips) {
      attempts.push({ canvas: st, psm: "7" });
      attempts.push({ canvas: invertCanvas(st), psm: "7" });
    }

    // Spojený text VŠETKÝCH úspešných pokusov – parser hľadá v každom kuse,
    // aj keď jeden pokus nenašiel nič (krajina v jednom, rok v druhom).
    let score = -1;
    let combined = "";
    for (const a of attempts) {
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: a.psm,
          tessedit_char_whitelist: a.whitelist ?? ""
        });
        const run = await worker.recognize(a.canvas);
        const text = run.data.text ?? "";
        combined += "\n" + text;
        // whitelistový stredový pokus – ulož si číslicu nominálu
        if (a.whitelist) {
          const digits = text.replace(/[^0-9€]/g, "").trim();
          if (digits && !centerText) centerText = digits;
        }
        const s = scoreText(text);
        if (s > score) score = s;
        if (score >= 6 && strips.length === 0) break; // bez pásov stačí dobrý výsledok z celku
      } catch {
        // pokus zlyhal – skúsime ďalší
      }
    }

    onProgress?.({ stage: "done", progress: 1 });
    // Parse cez SPOJENÝ text (všetky pokusy) – nájde aj roztrieštené časti.
    const parsed = parseCoinText(combined);
    // Doplnenie nominálu zo stredovej číslice: OCR bežne prečíta jednotku
    // (KORUN/EURO CENT) a krajinu, ale veľkú číslicu preskočí.
    if (!parsed.denomination && centerText) {
      const n = centerText.replace(/[^0-9]/g, "");
      if (n && Number(n) > 0 && Number(n) <= 999) {
        if (/CENT/.test(combined)) parsed.denomination = `${n} centov`;
        else if (/K[O0]RUN|KC?[S5]/.test(combined)) parsed.denomination = `${n} korún`;
        else if (/EUR|€/.test(combined)) parsed.denomination = `${n} eur`;
        if (parsed.denomination && !parsed.currency) {
          if (parsed.denomination.includes("cent")) parsed.currency = "EUR";
        }
      }
    }
    const hints: string[] = [];
    if (!parsed.year) hints.push("Rok sa z fotky nepodarilo prečítať – skús lepšie osvetlenie alebo fot z rovna.");
    if (!parsed.country) hints.push("Krajinu sa nepodarilo spoznať z nápisu.");
    if (!parsed.denomination) hints.push("Nominál sa nepodarilo prečítať – doplň ručne.");
    if (parsed.confidence < 0.45) hints.push("Fotka bola príliš rozmazaná/tmavá – pre lepší odhad odfoti znova z rovna pri dobrom svetle.");
    return {
      parsed,
      metal: metalFinal,
      metalLabel: METAL_LABELS[metalFinal],
      materialSuggestion: METAL_MATERIAL[metalFinal],
      weightSuggestion: "",
      hints,
      rawText: combined.trim(),
      confidence: parsed.confidence
    };
  } finally {
    if (ticker) clearInterval(ticker);
  }
}
