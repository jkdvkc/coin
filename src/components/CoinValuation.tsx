import { useState } from "react";
import { MINT_ERRORS, ERROR_REASON } from "../lib/errors";
import { ErrorIllustration } from "../lib/errorArt";
import { estimateValue, applyErrorToBase, type Settings } from "../lib/estimate";
import { formatEur } from "../lib/format";
import type { CoinRecord } from "../lib/storage";

interface CoinValuationProps {
  coin: Pick<
    CoinRecord,
    "denomination" | "currency" | "year" | "material" | "weightGrams" | "errors"
  >;
  settings: Settings;
  /** predvyplnené pravdepodobné chyby z auto-rozpoznania (id z MINT_ERRORS) */
  suggestedErrorIds?: string[];
}

/** Z vlastného popisu chyby (voľný text) navrhne známe chyby. */
function matchErrors(errorsText: string): string[] {
  const t = errorsText.toLowerCase();
  const found: string[] = [];
  for (const e of MINT_ERRORS) {
    if (e.keywords.some((k) => t.includes(k))) found.push(e.id);
  }
  return found;
}

export default function CoinValuation({ coin, settings, suggestedErrorIds = [] }: CoinValuationProps) {
  const [open, setOpen] = useState<string | null>(null);

  const parsedErrors = matchErrors(coin.errors);
  // Návrhy z fotky prvé, potom z vlastného textu; max 3
  const errorIds = Array.from(new Set([...suggestedErrorIds, ...parsedErrors])).slice(0, 3);

  const est = estimateValue({
    denomination: coin.denomination,
    currency: coin.currency,
    year: coin.year,
    material: coin.material,
    weightGrams: coin.weightGrams,
    errorIds: [], // hlavička = bežná cena BEZ chyby (chyby sa násobia len v rozkliku)
    settings
  });

  if (est.base <= 0 && est.metal <= 0) {
    return (
      <div className="valuation valuation-empty">
        <strong>Orientačná cena</strong>
        <p className="muted">
          Nepodarilo sa určiť podklad (nominál/mena/kov). Dopĺň údaje alebo zadaj cenu ručne s zdrojom.
        </p>
      </div>
    );
  }

  return (
    <div className="valuation">
      <div className="valuation-head">
        <strong>Orientačná cena (odhad aplikácie)</strong>
        <span className="valuation-range">
          {est.range[0] === est.range[1]
            ? formatEur(est.range[0])
            : `${formatEur(est.range[0])} – ${formatEur(est.range[1])}`}
        </span>
      </div>
      <p className="valuation-basis muted">Základ: {est.basis}</p>

      {errorIds.length > 0 && (
        <>
          <h4 className="valuation-subtitle">Možné tlacové chyby a ich cena</h4>
          <ul className="error-list">
            {errorIds.map((id) => {
              const err = MINT_ERRORS.find((e) => e.id === id);
              if (!err) return null;
              const range = applyErrorToBase(est.base, err.multiplier);
              const isOpen = open === id;
              return (
                <li key={id} className={`error-item ${isOpen ? "error-open" : ""}`}>
                  <button
                    type="button"
                    className="error-toggle"
                    onClick={() => setOpen(isOpen ? null : id)}
                    aria-expanded={isOpen}
                  >
                    <span className="error-art"><ErrorIllustration id={id} /></span>
                    <span className="error-name">{err.name}</span>
                    <span className="error-price">
                      {formatEur(range[0])} – {formatEur(range[1])}
                    </span>
                    <span className="error-chevron">{isOpen ? "▾" : "▸"}</span>
                  </button>
                  {isOpen && (
                    <div className="error-detail">
                      <p>{err.description}</p>
                      {ERROR_REASON[id] && !suggestedErrorIds.includes(id) && (
                        <p className="muted">{ERROR_REASON[id]}</p>
                      )}
                      {suggestedErrorIds.includes(id) && (
                        <p className="error-reason">💡 {ERROR_REASON[id]}</p>
                      )}
                      <p className="verify-title">Ako si overiť lupou:</p>
                      <ol className="verify-steps">
                        {err.verifySteps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                      <p className="muted">
                        Odhad vychádza z bežnej ceny ({formatEur(est.base)}) × {err.multiplier[0]}–{err.multiplier[1]} podľa aukcií.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="valuation-disclaimer muted">
        Odhad je orientačný – vychádza z nominálnej hodnoty, kovu a bežných aukčných násobkov.
        Nie je to katalógová cena. Presnú cenu podlož zdrojom (aukcia, predajca).
      </p>
    </div>
  );
}
