import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Camera, { type CameraSide } from "./Camera";
import { analyzeFromDataUrl, type AnalyzeResult } from "../lib/recognize";
import { recognizeCoinPhoto, type CoinAutoFill } from "../lib/ocr";
import type { CoinRecord } from "../lib/storage";
import { newCoinId } from "../lib/storage";
import { pluralKus } from "../lib/format";
import { COIN_SPECS, MATERIALS, suggestSpec } from "../lib/catalog";

interface CoinEditorProps {
  initial: CoinRecord;
  isNew: boolean;
  onCancel: () => void;
  onSaved: (coin: CoinRecord) => void;
}

export function emptyCoin(): CoinRecord {
  return {
    id: newCoinId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    photoObverse: null,
    photoReverse: null,
    name: "",
    country: "",
    year: "",
    denomination: "",
    currency: "",
    mintMark: "",
    catalogNumber: "",
    material: "",
    weightGrams: null,
    quantity: 1,
    grade: "",
    note: "",
    errors: "",
    purchasedPrice: null,
    priceBacked: false,
    priceValue: null,
    priceSource: "",
    priceNote: "",
    recognitionStatus: "none",
    recognized: null
  };
}

type Draft = Omit<CoinRecord, "purchasedPrice" | "priceValue" | "weightGrams"> & {
  purchasedPrice: string;
  priceValue: string;
  weightGrams: string;
};

function toDraft(c: CoinRecord): Draft {
  return {
    ...c,
    purchasedPrice: c.purchasedPrice != null ? String(c.purchasedPrice) : "",
    priceValue: c.priceValue != null ? String(c.priceValue) : "",
    weightGrams: c.weightGrams != null ? String(c.weightGrams) : ""
  };
}

function fromDraft(d: Draft): CoinRecord {
  const price = d.priceValue.trim().replace(",", ".");
  const purchased = d.purchasedPrice.trim().replace(",", ".");
  const weight = d.weightGrams.trim().replace(",", ".");
  return {
    ...d,
    purchasedPrice: purchased ? Number(purchased) : null,
    priceValue: price ? Number(price) : null,
    weightGrams: weight ? Number(weight) : null,
    updatedAt: Date.now()
  };
}

export default function CoinEditor({ initial, isNew, onCancel, onSaved }: CoinEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [cameraSide, setCameraSide] = useState<CameraSide | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoFill, setAutoFill] = useState<CoinAutoFill | null>(null);
  const [autoFillBusy, setAutoFillBusy] = useState(false);
  const [autoProgress, setAutoProgress] = useState<string>("");
  const autoTouched = useRef<Set<string>>(new Set());
  const autoCounter = useRef(0);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /** Nastaví hodnotu automaticky – prepíše len polia, ktoré používateľ ručne nezmenil. */
  const setAuto = (key: keyof Draft, value: string) => {
    if (autoTouched.current.has(key)) return;
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const setManual = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    autoTouched.current.add(key as string);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const openCamera = (side: CameraSide) => setCameraSide(side);

  const handleCaptured = useCallback(
    async (dataUrl: string) => {
      if (!cameraSide) return;
      const side = cameraSide;
      setCameraSide(null);
      setDraft((d) => ({
        ...d,
        [side === "obverse" ? "photoObverse" : "photoReverse"]: dataUrl
        }));
      setAnalysis(null);
      setAnalyzing(true);
      try {
        const result = await analyzeFromDataUrl(dataUrl);
        setAnalysis(result);
      } catch {
        setAnalysis(null);
      } finally {
        setAnalyzing(false);
      }

      // Auto-rozpoznávanie: líc čítame text, rub len farbu kovu
      const runOcr = side === "obverse";
      setAutoFillBusy(true);
      const myRun = ++autoCounter.current;
      try {
        if (runOcr) {
          setAutoProgress("Čítam nápis z mince…");
          const result = await recognizeCoinPhoto(dataUrl, (p) => {
            const labels: Record<string, string> = {
              crop: "Vystrihujem mincu…",
              preprocess: "Upravujem fotku…",
              "load-model": "Načítavam OCR model (prvé spustenie)…",
              recognize: "Čítam nápis…",
              done: "Hotovo"
            };
            setAutoProgress(labels[p.stage] ?? "");
          });
          if (myRun !== autoCounter.current) return;
          setAutoFill(result);
          if (result.parsed.year) setAuto("year", result.parsed.year);
          if (result.parsed.country) setAuto("country", result.parsed.country);
          if (result.parsed.denomination) setAuto("denomination", result.parsed.denomination);
          if (result.parsed.currency) setAuto("currency", result.parsed.currency);
          if (result.materialSuggestion) setAuto("material", result.materialSuggestion);
        } else {
          // Rub: rýchla klasifikácia kovu bez OCR
          setAutoProgress("Zisťujem materiál…");
          const result = await recognizeCoinPhoto(dataUrl, () => undefined);
          if (myRun !== autoCounter.current) return;
          if (result.materialSuggestion) {
            setAutoFill((prev) => prev ?? result);
            setAuto("material", result.materialSuggestion);
          }
        }
      } catch {
        setAutoProgress("");
      } finally {
        if (myRun === autoCounter.current) {
          setAutoFillBusy(false);
          setAutoProgress("");
        }
      }
    },
    [cameraSide]
  );

  const canSave = draft.photoObverse !== null || draft.photoReverse !== null;
  const estimated = useMemo(() => {
    if (!draft.priceBacked || draft.priceValue.trim() === "") return null;
    const v = Number(draft.priceValue.replace(",", "."));
    return Number.isFinite(v) ? v * draft.quantity : null;
  }, [draft.priceBacked, draft.priceValue, draft.quantity]);

  // Automatický návrh materiálu a hmotnosti z mini-katalógu
  const spec = useMemo(() => {
    const m = suggestSpec(draft.country, draft.denomination, draft.year);
    return m ? m.spec : null;
  }, [draft.country, draft.denomination, draft.year]);
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!spec) return;
    const key = `${spec.name}|${spec.weightGrams}`;
    setDraft((d) => {
      const prevSpec = appliedRef.current
        ? COIN_SPECS.find((s) => `${s.name}|${s.weightGrams}` === appliedRef.current) ?? null
        : null;
      const materialFollows = d.material === "" || (prevSpec != null && d.material === prevSpec.material);
      const weightFollows = d.weightGrams === "" || (prevSpec != null && Number(d.weightGrams.replace(",", ".")) === prevSpec.weightGrams);
      if (!materialFollows && !weightFollows) return d;
      appliedRef.current = key;
      return {
        ...d,
        material: materialFollows ? spec.material : d.material,
        weightGrams: weightFollows ? String(spec.weightGrams) : d.weightGrams
      };
    });
  }, [spec]);

  const applySpec = () => {
    if (!spec) return;
    appliedRef.current = `${spec.name}|${spec.weightGrams}`;
    setDraft((d) => ({
      ...d,
      material: spec.material,
      weightGrams: String(spec.weightGrams)
    }));
  };

  const save = () => {
    if (!canSave) return;
    onSaved(fromDraft(draft));
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          ✕ Zrušiť
        </button>
        <h1 className="screen-title">{isNew ? "Pridať mincu" : "Upraviť mincu"}</h1>
        <button type="button" className="btn-primary" onClick={save} disabled={!canSave}>
          Uložiť
        </button>
      </header>

      <section className="card">
        <h3 className="section-title">Fotografie</h3>
        <div className="photo-pair">
          <button
            type="button"
            className="photo-slot"
            onClick={() => openCamera("obverse")}
          >
            {draft.photoObverse ? (
              <img src={draft.photoObverse} alt="Líc mince" />
            ) : (
              <span className="photo-slot-empty">
                <span className="photo-plus">＋</span>
                Vyfotiť líc
              </span>
            )}
            <span className="photo-slot-label">líc</span>
          </button>
          <button
            type="button"
            className="photo-slot"
            onClick={() => openCamera("reverse")}
          >
            {draft.photoReverse ? (
              <img src={draft.photoReverse} alt="Rub mince" />
            ) : (
              <span className="photo-slot-empty">
                <span className="photo-plus">＋</span>
                Vyfotiť rub
              </span>
            )}
            <span className="photo-slot-label">rub</span>
          </button>
        </div>
        {analyzing && <p className="muted">Analyzujem fotografiu…</p>}
        {autoFillBusy && autoProgress && <p className="muted ocr-progress">{autoProgress}</p>}
        {autoFill && !autoFillBusy && (
          <div className={`analysis ${autoFill.confidence >= 0.7 ? "good" : autoFill.confidence >= 0.4 ? "fair" : "poor"}`}>
            <strong>Auto-rozpoznanie z fotky</strong>
            <ul>
              {autoFill.parsed.year && <li>Rok: <strong>{autoFill.parsed.year}</strong></li>}
              {autoFill.parsed.country && <li>Krajina: <strong>{autoFill.parsed.country}</strong></li>}
              {autoFill.parsed.denomination && <li>Nominál: <strong>{autoFill.parsed.denomination}</strong></li>}
              {autoFill.metal !== "unknown" && <li>Kov: <strong>{autoFill.metalLabel}</strong></li>}
              {autoFill.rawText && <li className="ocr-raw">Prečítaný text: „{autoFill.rawText.slice(0, 80)}“</li>}
              {autoFill.hints.map((h, i) => <li key={i}>{h}</li>)}
              {autoFill.confidence === 0 && autoFill.metal === "unknown" && (
                <li>Nepodarilo sa nič prečítať – údaje doplň ručne.</li>
              )}
            </ul>
            <button
              type="button"
              className="btn-ghost btn-small"
              onClick={() => {
                setAutoFill(null);
                autoTouched.current.clear();
              }}
            >
              Zabudnúť rozpoznané a znovu vyplniť z ďalšej fotky
            </button>
          </div>
        )}
        {analysis && (
          <div className={`analysis ${analysis.quality}`}>
            <strong>Analýza fotografie</strong>
            <ul>
              {analysis.hints.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
              {analysis.hints.length === 0 && <li>Foto vyzerá dobre – minca je vycentrovaná a dobre osvetlená.</li>}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="section-title">Identifikácia</h3>
        <label className="field">
          <span>Názov / motív</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="napr. 1 koruna 1928 – 10. výročie"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Krajina{autoFill?.parsed.country && !autoTouched.current.has("country") ? " (auto)" : ""}</span>
            <input type="text" value={draft.country} onChange={(e) => setManual("country", e.target.value)} placeholder="Československo" />
          </label>
          <label className="field">
            <span>Rok{autoFill?.parsed.year && !autoTouched.current.has("year") ? " (auto)" : ""}</span>
            <input
              type="text"
              inputMode="numeric"
              value={draft.year}
              onChange={(e) => setManual("year", e.target.value)}
              placeholder="1928"
            />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Nominál{autoFill?.parsed.denomination && !autoTouched.current.has("denomination") ? " (auto)" : ""}</span>
            <input type="text" value={draft.denomination} onChange={(e) => setManual("denomination", e.target.value)} placeholder="1 koruna" />
          </label>
          <label className="field">
            <span>Mena</span>
            <input type="text" value={draft.currency} onChange={(e) => setManual("currency", e.target.value)} placeholder="Kčs / EUR / USD" />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Značka mincovne</span>
            <input type="text" value={draft.mintMark} onChange={(e) => set("mintMark", e.target.value)} placeholder="napr. o / B / Kremnica" />
          </label>
          <label className="field">
            <span>Katalógové číslo</span>
            <input type="text" value={draft.catalogNumber} onChange={(e) => set("catalogNumber", e.target.value)} placeholder="napr. P / KM 1" />
          </label>
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Materiál a hmotnosť</h3>
        {spec && (
          <div className="spec-suggest">
            <span>
              Podľa katalógu: <strong>{spec.name}</strong> – {spec.material}, {spec.weightGrams} g
              {spec.diameterMm ? `, ⌀ ${spec.diameterMm} mm` : ""}
            </span>
            <button type="button" className="btn-secondary btn-small" onClick={applySpec}>
              Použiť
            </button>
          </div>
        )}
        <div className="field-row">
          <label className="field">
            <span>Materiál{autoFill?.materialSuggestion && !autoTouched.current.has("material") ? " (auto z fotky)" : ""}</span>
            <select value={draft.material} onChange={(e) => setManual("material", e.target.value)}>
              <option value="">– neviem / neuvádza sa –</option>
              {MATERIALS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Hmotnosť (gram)</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.weightGrams}
              onChange={(e) => setManual("weightGrams", e.target.value)}
              placeholder="napr. 8.5"
            />
          </label>
        </div>
        {spec && draft.material === spec.material && Number(draft.weightGrams) === spec.weightGrams && (
          <p className="field-hint">
            Hmotnosť je oficiálny výrobný parameter – ak ju minca nemá, môže ísť o chyborazbu alebo falzifikát.
          </p>
        )}
      </section>

      <section className="card">
        <h3 className="section-title">Zbierka</h3>
        <div className="field-row">
          <label className="field">
            <span>Počet kusov</span>
            <div className="stepper">
              <button
                type="button"
                onClick={() => set("quantity", Math.max(1, draft.quantity - 1))}
                aria-label="Znížiť počet"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={String(draft.quantity)}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  set("quantity", Number.isFinite(n) && n > 0 ? n : 1);
                }}
              />
              <button
                type="button"
                onClick={() => set("quantity", draft.quantity + 1)}
                aria-label="Zvýšiť počet"
              >
                +
              </button>
            </div>
          </label>
          <label className="field">
            <span>Stav (grading)</span>
            <select value={draft.grade} onChange={(e) => set("grade", e.target.value)}>
              <option value="">– neuvádza sa –</option>
              <option value="Unc">Unc (UNC)</option>
              <option value="AU">AU (takmer neobehaná)</option>
              <option value="XF">XF (extrémne finá)</option>
              <option value="VF">VF (veľmi pekná)</option>
              <option value="F">F (pekná)</option>
              <option value="VG">VG</option>
              <option value="G">G</option>
              <option value="PoW">PoW (prova / patent)</option>
            </select>
            {draft.quantity > 1 && (
              <span className="field-hint">{draft.quantity} {pluralKus(draft.quantity)}</span>
            )}
          </label>
        </div>
        <label className="field">
          <span>Chyborazba / poškodenie</span>
          <input
            type="text"
            value={draft.errors}
            onChange={(e) => set("errors", e.target.value)}
            placeholder="napr. posun razby, odštep na okraji"
          />
        </label>
        <label className="field">
          <span>Poznámka</span>
          <textarea
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            rows={3}
            placeholder="osobné postrehy, pôvod mince…"
          />
        </label>
      </section>

      <section className="card">
        <h3 className="section-title">Cena</h3>
        <p className="muted">
          Aplikácia nikdy nezobrazuje ceny z vzduchu. Orientačnú cenu môžeš zapísať len vtedy,
          keď máš podklad – napríklad výsledok aukcie, katalóg alebo cenu predajcu. Keď podklad
          chýba, pole sa jednoducho nezobrazí.
        </p>

        <label className="field">
          <span>Obstarávacia cena – koľko si za mincu dal (EUR, voliteľné)</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.purchasedPrice}
            onChange={(e) => set("purchasedPrice", e.target.value)}
            placeholder="napr. 12.50"
          />
          <span className="field-hint">Toto je tvoja vlastná cena – nezobrazuje sa ako orientačná.</span>
        </label>

        <label className="field">
          <span>Orientačná cena za 1 ks (EUR) – len ak máš podklad</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.priceValue}
            onChange={(e) => {
              set("priceValue", e.target.value);
              set("priceBacked", e.target.value.trim() !== "");
            }}
            placeholder="napr. 25"
          />
          <span className="field-hint">
            Zobrazí sa v zbierke a v detaili až po vyplnení zdroja nižšie.
          </span>
        </label>

        {draft.priceValue.trim() !== "" && (
          <>
            <label className="field">
              <span>Zdroj ceny (povinné pre zobrazenie) *</span>
              <input
                type="text"
                value={draft.priceSource}
                onChange={(e) => set("priceSource", e.target.value)}
                placeholder="napr. aukcia XYZ 3/2024, katalóg US 2025"
              />
            </label>
            <label className="field">
              <span>Poznámka k cene (voliteľné)</span>
              <input
                type="text"
                value={draft.priceNote}
                onChange={(e) => set("priceNote", e.target.value)}
                placeholder="napr. cena za stav VF, razenie 1928"
              />
            </label>
            {estimated != null && (
              <p className="price-total">
                Spolu {draft.quantity} {pluralKus(draft.quantity)}: <strong>{estimated.toFixed(2)} EUR</strong>
              </p>
            )}
            {draft.priceSource.trim() === "" && (
              <p className="price-warning">
                ⚠ Bez uvedenia zdroja sa cena nebude zobrazovať – doplň, odkiaľ číslo pochádza.
              </p>
            )}
          </>
        )}
      </section>

      {cameraSide && (
        <Camera
          mode="manual"
          side={cameraSide}
          onSingleCapture={(dataUrl) => void handleCaptured(dataUrl)}
          onCancel={() => setCameraSide(null)}
        />
      )}
    </div>
  );
}
