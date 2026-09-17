// Generuje PWA ikony do public/ pomocou sharp (nanovo nakreslená minca).
// Spusti: npm run icons
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public";
mkdirSync(OUT, { recursive: true });

function svg(size) {
  const s = size;
  return Buffer.from(`
<svg width="${s}" height="${s}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="${Math.round(512 * 0.22)}" fill="#0b0d12"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8c877"/>
      <stop offset="1" stop-color="#b98f3e"/>
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="150" fill="url(#g)"/>
  <circle cx="256" cy="256" r="128" fill="none" stroke="#8a6a28" stroke-width="6"/>
  <circle cx="256" cy="256" r="112" fill="none" stroke="#a5822f" stroke-width="3"/>
  <text x="256" y="300" font-family="Georgia, serif" font-size="140" font-weight="bold"
        fill="#6f5417" text-anchor="middle">C</text>
</svg>`);
}

function svgMaskable(size) {
  const s = size;
  // maskable: minca menšia, bez zaoblených rohov (systém sám ostrihá)
  return Buffer.from(`
<svg width="${s}" height="${s}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0b0d12"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8c877"/>
      <stop offset="1" stop-color="#b98f3e"/>
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="128" fill="url(#g)"/>
  <circle cx="256" cy="256" r="106" fill="none" stroke="#8a6a28" stroke-width="6"/>
  <text x="256" y="296" font-family="Georgia, serif" font-size="118" font-weight="bold"
        fill="#6f5417" text-anchor="middle">C</text>
</svg>`);
}

const icons = [
  { name: "pwa-192.png", size: 192, maskable: false },
  { name: "pwa-512.png", size: 512, maskable: false },
  { name: "pwa-192-maskable.png", size: 192, maskable: true },
  { name: "pwa-512-maskable.png", size: 512, maskable: true }
];

for (const { name, size, maskable } of icons) {
  const buf = maskable ? svgMaskable(size) : svg(size);
  await sharp(buf).png().toFile(`${OUT}/${name}`);
  console.log("OK", name);
}
