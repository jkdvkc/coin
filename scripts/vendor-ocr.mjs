// Stiahne Tesseract.js vendor súbory (worker, wasm, traineddata) do public/tesseract.
// Použitie: npm run vendor:ocr
// Verzie sú kotvené – zmena verzie vyžaduje update ciest nižšie.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const OUT = "public/tesseract";
mkdirSync(OUT, { recursive: true });

const FILES = [
  {
    name: "tesseract.min.js",
    url: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js",
    bytes: 60000
  },
  {
    name: "worker.min.js",
    url: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/worker.min.js",
    bytes: 100000
  },
  {
    name: "tesseract-core-simd.wasm.js",
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core-simd.wasm.js",
    bytes: 4000000
  },
  {
    name: "tesseract-core-simd-lstm.wasm.js",
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core-simd-lstm.wasm.js",
    bytes: 3000000
  },
  {
    name: "tesseract-core-lstm.wasm.js",
    url: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core-lstm.wasm.js",
    bytes: 3000000
  },
  {
    name: "eng.traineddata",
    // balík obsahuje len .gz – stiahneme a rozbalíme
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz",
    bytes: 2500000,
    gunzip: true
  }
];

for (const f of FILES) {
  const dest = join(OUT, f.name);
  if (existsSync(dest)) {
    console.log("SKIP", f.name);
    continue;
  }
  console.log("FETCH", f.url);
  const res = await fetch(f.url);
  if (!res.ok) {
    console.error("FAIL", f.name, res.status, res.statusText);
    process.exit(1);
  }
  let buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < f.bytes) {
    console.error("FAIL", f.name, "príliš malý:", buf.length, "B");
    process.exit(1);
  }
  if (f.gunzip) {
    buf = gunzipSync(buf);
  }
  writeFileSync(dest, buf);
  console.log("OK", f.name, buf.length, "B");
}
console.log("Vendor OCR hotový.");
