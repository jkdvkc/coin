import { loadImage } from "./image";

export interface AnalyzeResult {
  centeredCircle: boolean;
  circularity: number;
  rimDamage: boolean;
  rimDamageScore: number;
  brightness: number;
  contrast: number;
  quality: "good" | "fair" | "poor";
  hints: string[];
}

export function analyzeCoinImage(img: HTMLImageElement): AnalyzeResult {
  const w = 320;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas nie je dostupný.");
  ctx.drawImage(img, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    sum += gray[i];
  }
  const brightness = sum / (w * h);

  let varSum = 0;
  for (let i = 0; i < w * h; i++) varSum += (gray[i] - brightness) ** 2;
  const contrast = Math.sqrt(varSum / (w * h));

  const grad = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] +
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      grad[i] = Math.hypot(gx, gy);
    }
  }

  let gradMax = 0;
  for (let i = 0; i < grad.length; i++) if (grad[i] > gradMax) gradMax = grad[i];
  const thresh = gradMax * 0.28;
  const edge = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) edge[i] = grad[i] > thresh ? 1 : 0;

  let sx = 0;
  let sy = 0;
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (edge[y * w + x]) {
        sx += x;
        sy += y;
        total++;
      }
    }
  }
  const hints: string[] = [];
  if (total < 40) {
    return {
      centeredCircle: false,
      circularity: 0,
      rimDamage: false,
      rimDamageScore: 0,
      brightness,
      contrast,
      quality: "poor",
      hints: ["Nedostatok detailov – odfot mincu na jednofarebnom podklade pri dennom svetle."]
    };
  }
  const cx = sx / total;
  const cy = sy / total;

  const dists: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (edge[y * w + x]) dists.push(Math.hypot(x - cx, y - cy));
    }
  }
  dists.sort((a, b) => a - b);
  const median = dists[Math.floor(dists.length / 2)];
  const p90 = dists[Math.floor(dists.length * 0.9)];

  const bandHalf = Math.max(4, median * 0.22);
  const angles = new Uint8Array(72);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!edge[y * w + x]) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < median - bandHalf || d > p90 + bandHalf) continue;
      const a = Math.atan2(y - cy, x - cx);
      const idx = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 72);
      angles[idx] = 1;
    }
  }
  let covered = 0;
  for (let i = 0; i < 72; i++) if (angles[i]) covered++;
  const circularity = covered / 72;

  // Nerovnosti okraja – signál chyborazby
  let rimDeviations = 0;
  let rimPoints = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!edge[y * w + x]) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < median - bandHalf || d > p90 + bandHalf) continue;
      rimPoints++;
      if (d > p90 + bandHalf * 0.5 || d < median - bandHalf * 0.5) rimDeviations++;
    }
  }
  const rimDamageScore = rimPoints > 0 ? rimDeviations / rimPoints : 0;
  const rimDamage = rimDamageScore > 0.32;

  const centered =
    circularity >= 0.82 &&
    cx > w * 0.2 && cx < w * 0.8 &&
    cy > h * 0.2 && cy < h * 0.8;

  const quality: AnalyzeResult["quality"] =
    brightness < 0.2 || brightness > 0.85 || contrast < 0.12
      ? "poor"
      : brightness < 0.3 || contrast < 0.16
        ? "fair"
        : "good";

  if (!centered) {
    hints.push("Mincu sa nepodarilo spoľahlivo vycentrovať – fot z rovného nadhľadu.");
  }
  if (quality !== "good") {
    hints.push("Slabé svetlo alebo nízky kontrast – fot pri dennom svetle, bez blesku.");
  }
  if (rimDamage) {
    hints.push("Okraj pôsobí nepravidelne – over možnú chyborazbu (odštep, posun razby).");
  }

  return {
    centeredCircle: centered,
    circularity,
    rimDamage,
    rimDamageScore,
    brightness,
    contrast,
    quality,
    hints
  };
}

export function analyzeFromDataUrl(dataUrl: string): Promise<AnalyzeResult> {
  return loadImage(dataUrl).then(analyzeCoinImage);
}
