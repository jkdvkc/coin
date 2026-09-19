import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Collection from "./components/Collection";
import CoinEditor, { emptyCoin } from "./components/CoinEditor";
import CoinDetail from "./components/CoinDetail";
import CoinResult from "./components/CoinResult";
import Camera, { type CaptureResult } from "./components/Camera";
import {
  dbGetCollection,
  dbSaveCoin,
  dbDeleteCoin,
  dbGetSettings,
  dbSaveSettings,
  isPriceBacked,
  type CoinRecord
} from "./lib/storage";
import { exportBackup, importBackup } from "./lib/backup";
import { analyzeFromDataUrl } from "./lib/recognize";
import {
  recognizeCoinPhoto,
  extractMetalFromPhoto,
  type CoinAutoFill
} from "./lib/ocr";
import { DEFAULT_SETTINGS, type Settings } from "./lib/estimate";
import { detectErrorHints } from "./lib/errors";
import { suggestSpec } from "./lib/catalog";
import { formatEur } from "./lib/format";

type View =
  | { name: "collection" }
  | { name: "editor"; id: string | null }
  | { name: "detail"; id: string }
  | { name: "result"; coin: CoinRecord; auto: CoinAutoFill | null; autoFilled: string[] }
  | { name: "settings" };

export default function App() {
  const [coins, setCoins] = useState<CoinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: "collection" });
  const [shownIntro, setShownIntro] = useState<boolean | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [metalSettings, setMetalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [quickCamera, setQuickCamera] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await dbGetCollection();
      setCoins(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    void dbGetSettings().then((s) => {
      setShownIntro(s.shownIntro);
      setMetalSettings({
        silverEurPerOz: s.silverEurPerOz ?? DEFAULT_SETTINGS.silverEurPerOz,
        goldEurPerOz: s.goldEurPerOz ?? DEFAULT_SETTINGS.goldEurPerOz
      });
    });
  }, [reload]);

  /** Rýchly tok: obe fotky z auto-kamery → rozpoznanie → výsledná obrazovka. */
  const handleQuickCapture = useCallback(
    async (result: CaptureResult) => {
      setQuickCamera(false);
      const coin = emptyCoin();
      coin.photoObverse = result.obverse;
      coin.photoReverse = result.reverse;

      setProcessing("Rozpoznávam mincu…");
      let auto: CoinAutoFill | null = null;
      try {
        auto = await recognizeCoinPhoto(result.obverse, (p) => {
          const labels: Record<string, string> = {
            crop: "Vystrihujem mincu…",
            preprocess: "Upravujem fotku…",
            "load-model": "Načítavam OCR (prvé spustenie)…",
            recognize: "Čítam nápis…",
            done: "Hotovo"
          };
          setProcessing(labels[p.stage] ?? "Rozpoznávam mincu…");
        });
      } catch {
        auto = null;
      }

      // Materiál z rubu – len rýchla farba kovu (bez pomalého OCR)
      try {
        const revMetal = await extractMetalFromPhoto(result.reverse);
        if (auto && auto.materialSuggestion === "" && revMetal?.materialSuggestion) {
          auto.materialSuggestion = revMetal.materialSuggestion;
        }
      } catch {
        // rub nie je kritický
      }

      const autoFilled: string[] = [];
      if (auto) {
        if (auto.parsed.year) {
          coin.year = auto.parsed.year;
          autoFilled.push("rok");
        }
        if (auto.parsed.country) {
          coin.country = auto.parsed.country;
          autoFilled.push("krajinu");
        }
        if (auto.parsed.denomination) {
          coin.denomination = auto.parsed.denomination;
          autoFilled.push("nominál");
        }
        if (auto.parsed.currency) {
          coin.currency = auto.parsed.currency;
          autoFilled.push("menu");
        }
        if (auto.materialSuggestion) {
          coin.material = auto.materialSuggestion;
          autoFilled.push("materiál");
        }
      }

      // Hmotnosť a presný materiál z mini-katalógu
      const spec = suggestSpec(coin.country, coin.denomination, coin.year);
      if (spec) {
        coin.material = spec.spec.material;
        coin.weightGrams = spec.spec.weightGrams;
        if (!autoFilled.includes("materiál")) autoFilled.push("materiál");
        autoFilled.push("hmotnosť");
      }
      coin.name = [coin.denomination, coin.year].filter(Boolean).join(" ");

      setProcessing(null);
      setView({ name: "result", coin, auto, autoFilled });
    },
    []
  );

  const handleSaved = useCallback(
    async (coin: CoinRecord) => {
      await dbSaveCoin(coin);
      if (coin.recognitionStatus === "none" && (coin.photoObverse || coin.photoReverse)) {
        try {
          const dataUrl = (coin.photoObverse ?? coin.photoReverse) as string;
          const result = await analyzeFromDataUrl(dataUrl);
          coin.recognitionStatus = result.quality === "poor" ? "failed" : "done";
        } catch {
          coin.recognitionStatus = "failed";
        }
        await dbSaveCoin(coin);
      }
      await reload();
      setView({ name: "detail", id: coin.id });
    },
    [reload]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Naozaj odstrániť túto mincu zo zbierky?")) return;
      await dbDeleteCoin(id);
      await reload();
      setView({ name: "collection" });
    },
    [reload]
  );

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const count = await importBackup(file);
        setImportMsg(`Naimportovaných ${count} mincí.`);
        await reload();
      } catch (err) {
        setImportMsg(err instanceof Error ? err.message : "Import sa nepodaril.");
      }
    },
    [reload]
  );

  const dismissIntro = useCallback(() => {
    setShownIntro(true);
    void dbSaveSettings({ shownIntro: true });
  }, []);

  const saveSettings = useCallback((s: Settings) => {
    setMetalSettings(s);
    void dbSaveSettings({ shownIntro: true, silverEurPerOz: s.silverEurPerOz, goldEurPerOz: s.goldEurPerOz });
  }, []);

  const totalPieces = useMemo(
    () => coins.reduce((sum, c) => sum + c.quantity, 0),
    [coins]
  );

  const totalValue = useMemo(
    () =>
      coins.reduce(
        (sum, c) => (isPriceBacked(c) ? sum + (c.priceValue ?? 0) * c.quantity : sum),
        0
      ),
    [coins]
  );

  const currentCoin = useMemo(() => {
    if (view.name === "detail") return coins.find((c) => c.id === view.id) ?? null;
    if (view.name === "editor") {
      return view.id ? coins.find((c) => c.id === view.id) ?? null : emptyCoin();
    }
    return null;
  }, [view, coins]);

  if (shownIntro === null) {
    return <div className="boot-splash" />;
  }

  return (
    <div className="app">
      {shownIntro === false && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Vitaj v CoinScanner</h2>
            <p>
              Klepni na <strong>Odfotiť</strong>, polož mincu do kruhu – aplikácia ju odfotí
              sama, vyzve ťa na otočenie a sama rozpozná všetky údaje aj orientačnú cenu.
              Potom len <strong>Uložiť</strong> – minca pridá do tvojej zbierky.
            </p>
            <p className="muted">
              Tip pre iPhone: pridaj si aplikáciu na plochu (Zdieľať → „Na plochu“) a spúšťaj
              ju odtiaľ – bude fungovať na celú obrazovku aj offline.
            </p>
            <button type="button" className="btn-primary" onClick={dismissIntro}>
              Pokračovať
            </button>
          </div>
        </div>
      )}

      {view.name === "collection" && (
        <Collection
          coins={coins}
          loading={loading}
          onAdd={() => setQuickCamera(true)}
          onOpen={(id) => setView({ name: "detail", id })}
        />
      )}

      {view.name === "result" && (
        <CoinResult
          coin={view.coin}
          settings={metalSettings}
          suggestedErrorIds={
            view.auto
              ? detectErrorHints(view.auto.hints, view.auto.metal !== "unknown", view.auto.metal === "unknown")
              : []
          }
          autoFilled={view.autoFilled}
          auto={view.auto ? { rawText: view.auto.rawText, confidence: view.auto.confidence } : null}
          onSave={() => {
            void dbSaveCoin(view.coin).then(reload).then(() => setView({ name: "detail", id: view.coin.id }));
          }}
          onEdit={() => setView({ name: "editor", id: null })}
          onRetake={() => setQuickCamera(true)}
          onDiscard={() => setView({ name: "collection" })}
        />
      )}

      {view.name === "editor" && (
        <CoinEditor
          key={view.id ?? "new"}
          initial={view.id ? coins.find((c) => c.id === view.id) ?? emptyCoin() : emptyCoin()}
          isNew={view.id === null}
          onCancel={() => setView({ name: "collection" })}
          onSaved={(saved) => void handleSaved(saved)}
        />
      )}

      {view.name === "detail" && currentCoin && (
        <CoinDetail
          coin={currentCoin}
          settings={metalSettings}
          onClose={() => setView({ name: "collection" })}
          onEdit={() => setView({ name: "editor", id: currentCoin.id })}
          onDelete={() => void handleDelete(currentCoin.id)}
        />
      )}

      {view.name === "settings" && (
        <div className="screen">
          <header className="screen-header">
            <button type="button" className="btn-ghost" onClick={() => setView({ name: "collection" })}>
              ← Späť
            </button>
            <h1 className="screen-title">Nastavenia</h1>
            <span className="header-spacer" />
          </header>

          <section className="card">
            <h3 className="section-title">Záloha zbierky</h3>
            <p className="muted">
              Dáta sú uložené lokálne (IndexedDB). Zálohu si pravidelne vyexportuj – pri
              premazaní údajov stránok v Safari by sa mohli stratiť.
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void exportBackup(coins)}
              >
                Exportovať zálohu
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => importInputRef.current?.click()}
              >
                Importovať zálohu
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(e) => void handleImportFile(e)}
              />
            </div>
            {importMsg && <p className="muted">{importMsg}</p>}
          </section>

          <section className="card">
            <h3 className="section-title">Ceny kovov (pre orientačné odhady)</h3>
            <p className="muted">
              Aktualizuj podľa dnešnej spotovej ceny – z nej vychádza hodnota strieborných
              a zlatých mincí. Nastav raz a občas aktualizuj.
            </p>
            <div className="field-row">
              <label className="field">
                <span>Striebro (EUR / trojská unca)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={String(metalSettings.silverEurPerOz)}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(v) && v > 0) saveSettings({ ...metalSettings, silverEurPerOz: v });
                  }}
                />
              </label>
              <label className="field">
                <span>Zlato (EUR / trojská unca)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={String(metalSettings.goldEurPerOz)}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(v) && v > 0) saveSettings({ ...metalSettings, goldEurPerOz: v });
                  }}
                />
              </label>
            </div>
          </section>

          <section className="card">
            <h3 className="section-title">Štatistika</h3>
            <p className="muted">
              {coins.length} {coins.length === 1 ? "typ minci" : "typov mincí"} • {totalPieces} kusov
              • podložená hodnota zbierky: {formatEur(totalValue)}
            </p>
          </section>

          <section className="card">
            <h3 className="section-title">O aplikácii</h3>
            <p className="muted">
              CoinScanner • verzia 0.3.1 • funguje offline, bez servera a bez platených API.
              Po odfotení lica automaticky prečíta nápis (lokálne OCR) a predvyplní rok,
              krajinu, nominál a menu; z farby kovu odhadne materiál. Analýza fotografie
              tiež vyhodnocuje osvetlenie, vycentrovanie a naznačuje možnú chyborazbu.
            </p>
          </section>
        </div>
      )}

      {quickCamera && (
        <Camera
          mode="auto"
          onComplete={(r) => void handleQuickCapture(r)}
          onCancel={() => setQuickCamera(false)}
        />
      )}

      {processing && (
        <div className="modal-overlay">
          <div className="modal processing-modal">
            <div className="spinner" aria-hidden="true" />
            <p>{processing}</p>
          </div>
        </div>
      )}

      <nav className="tab-bar tab-bar-3">
        <button
          type="button"
          className={`tab ${view.name !== "settings" ? "tab-active" : ""}`}
          onClick={() => setView({ name: "collection" })}
        >
          <span className="tab-icon">🗂</span>
          Zbierka
        </button>
        <button type="button" className="tab tab-shoot" onClick={() => setQuickCamera(true)}>
          <span className="shoot-btn">
            <span className="shoot-icon">📷</span>
          </span>
          Odfotiť
        </button>
        <button
          type="button"
          className={`tab ${view.name === "settings" ? "tab-active" : ""}`}
          onClick={() => setView({ name: "settings" })}
        >
          <span className="tab-icon">⚙️</span>
          Nastavenia
        </button>
      </nav>
    </div>
  );
}
