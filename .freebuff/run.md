# CoinScanner – návod na spustenie (run doc)

PWA aplikácia na katalogizáciu mincí (React + TypeScript + Vite). Všetky dáta sú lokálne (IndexedDB), bez servera a platených API. Od v0.2.0 obsahuje lokálne OCR (Tesseract.js) na auto-vyplnenie údajov z fotky.

## 1. Reprodukcia artefaktov (potrebné po čerstvom checkout)

```bash
# a) Inštalácia závislostí (npm, prítomný package-lock.json)
npm install

# b) PWA ikony do public/ (pwa-192.png, pwa-512.png + maskable varianty)
npm run icons

# c) OCR modely do public/tesseract/ (raz, ~13 MB; vyžaduje internet)
npm run vendor:ocr

# d) Service worker – produkčný sa generuje automaticky v rámci build:pwa
#    npm run sw          # len SW do public/ (väčšinou netreba)
#    npm run build:pwa   # ikony + vendor + vite build + SW do dist/
```

`.env` súbory projekt nepoužíva – nič kopírovať z main checkoutu nie je potrebné.

## 2. Spustenie servera

**Vývoj (vite dev, HMR):**

```bash
npm run dev
```

- Predvolený port: 5173. Ak je obsadený, Vite si sám vyberie ďalší voľný.
- Kamera (getUserMedia) funguje na `localhost` bezcertifikátu; z telefónu v LAN je nutné HTTPS (kamera vyžaduje secure context). Pre produkčný build použite `npm run preview`.

**Produkčný build + náhľad (používa tento thread):**

```bash
npm run build:pwa
npm run preview -- --port 4780 --strictPort
```

- Port 4780 je dohodnutý pre Preview tab tohto threadu (default 4173 nechávame voľný).
- Server beží detached; log: `.freebuff/preview-<id>.log`.
- `allowedHosts: true` v `vite.config.ts` – bez toho Vite blokuje požiadavky cez tunnel host.

**Verejná stála adresa (Netlify):**

- URL: **https://coin-scanner-app-512.netlify.app** (zadarmo, verejná, SSO vypnuté)
- Repo: https://github.com/jkdvkc/coin (branch `main`)
- Deploy: ručne `npx netlify-cli deploy --prod --dir=dist` (účet slobodazvierat444) alebo automaticky po prepojení v Netlify UI (Deploys → Link repository → jkdvkc/coin). GitHub Actions robí len build kontrolu (Pages vypnuté kvôli kolízii s doménou jakoda.ch).
- **Pozor:** Netlify CLI pri `deploy --dir` rešpektuje `.gitignore` – tam musí zostať len `/public/sw.js`, NIE všeobecné `sw.js` (inak sa SW nenahrá a PWA offline nefunguje).
- `npm run build` = `npm run build:pwa` (Netlify/Vercel buildy musia obsahovať ikony, OCR vendor aj SW).
- Lokálny push: `git push` (origin/main, credential helper Windows – prihlásený účet jkdvkc).
- Build používa relatívne cesty (`base: "./"` v vite.config.ts) → funguje v koreni aj v podadresári.

**Verejná HTTPS URL pre iPhone (cloudflared tunnel – dočasná alternatíva):**

```bash
# cloudflared je nainštalovaný cez winget (Cloudflare.cloudflared)
"C:/Program Files (x86)/cloudflared/cloudflared.exe" tunnel --url http://localhost:4780 --no-autoupdate > .freebuff/tunnel.log 2>&1 &
sleep 12
grep -o "https://[a-z0-9-]*\.trycloudflare\.com" .freebuff/tunnel.log | head -1
```

- Quick tunnel vygeneruje NOVÚ náhodnú URL pri každom spustení – URL v logu je vždy aktuálna.
- HTTPS je vyriešené Cloudflare-om → kamera getUserMedia funguje na iPhone bez certifikátov.
- Tunnel je dočasné riešenie; pre stálu URL treba Cloudflare účet + named tunnel (cloudflared tunnel login).

## 3. Overenie

- `curl -s -o /dev/null -w "%{http_code}" http://localhost:4780/` → očakáva sa `200`.
- Service worker: `navigator.serviceWorker.controller` musí byť nastavený (offline režim).
- Manuálny dymový test (rýchly tok): tlačidlo **Odfotiť** dole → kamera „Polož mincu do kruhu – odfotím sama“ (auto-fokus a spúšť pri stabilnom kruhu) → výzva na otočenie → druhá strana → obrazovka „Rozpoznaná minca“ s auto-vyplnenými údajmi, orientačnou cenou a max. 3 rozklikávacími tlacovými chybami → **Uložiť** → detail.
- Fallback bez živej kamery: v kamere funguje aj „Kamera / Galéria“ (file input) – vhodné na desktopové testovanie.

## Poznámky

- `npm run typecheck` – kontrola typov (tsc -b --force).
- Dáta v preview sú v IndexedDB pôvodu `keyval-store` (idb-keyval); zmazaním pôvodu v DevTools sa zbierka vyčistí.
- OCR: prvý beh načíta model z `/tesseract/` (niekoľko sekúnd); vendor súbory musia byť v `public/tesseract/`. Worker potrebuje ABSOLÚTNE URL (`origin + '/tesseract'`) a `gzip: false` – vendor traineddata je už rozbalený.
- Testovacie mince z CI vpisov sú odstránené; zbierka začína prázdna.
