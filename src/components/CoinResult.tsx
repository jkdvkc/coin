import { useState } from "react";
import CoinValuation from "./CoinValuation";
import { formatDate } from "../lib/format";
import type { CoinRecord } from "../lib/storage";
import type { Settings } from "../lib/estimate";

interface CoinResultProps {
  coin: CoinRecord;
  settings: Settings;
  suggestedErrorIds: string[];
  /** čo bolo rozpoznané automaticky – pre čitateľné „čo sa doplnilo“ */
  autoFilled: string[];
  onSave: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}

export default function CoinResult({ coin, settings, suggestedErrorIds, autoFilled, onSave, onEdit, onDiscard }: CoinResultProps) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="screen">
      <header className="screen-header">
        <button type="button" className="btn-ghost" onClick={onDiscard}>
          ✕ Zahoď
        </button>
        <h1 className="screen-title">Rozpoznaná minca</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setSaved(true);
            onSave();
          }}
          disabled={saved}
        >
          {saved ? "✓ V zbierke" : "Uložiť"}
        </button>
      </header>

      <div className="photo-pair">
        <figure className="photo-card">
          {coin.photoObverse ? (
            <img src={coin.photoObverse} alt="Líc mince" />
          ) : (
            <div className="photo-empty">Líc chýba</div>
          )}
          <figcaption>líc</figcaption>
        </figure>
        <figure className="photo-card">
          {coin.photoReverse ? (
            <img src={coin.photoReverse} alt="Rub mince" />
          ) : (
            <div className="photo-empty">Rub chýba</div>
          )}
          <figcaption>rub</figcaption>
        </figure>
      </div>

      <div className="detail-card">
        <div className="detail-head">
          <h2>{coin.name || `${coin.denomination || "Mince"} ${coin.year}`.trim()}</h2>
          <span className="detail-date">{formatDate(coin.createdAt)}</span>
        </div>
        {autoFilled.length > 0 && (
          <p className="auto-note muted">Automaticky rozpoznané: {autoFilled.join(", ")}</p>
        )}
        <div className="detail-row">
          <span className="detail-label">Krajina</span>
          <span className="detail-value">{coin.country || "—"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Rok</span>
          <span className="detail-value">{coin.year || "—"}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Nominál</span>
          <span className="detail-value">{coin.denomination || "—"}</span>
        </div>
        {coin.material && (
          <div className="detail-row">
            <span className="detail-label">Materiál</span>
            <span className="detail-value">{coin.material}</span>
          </div>
        )}
        {coin.weightGrams != null && (
          <div className="detail-row">
            <span className="detail-label">Hmotnosť</span>
            <span className="detail-value">{coin.weightGrams} g</span>
          </div>
        )}
      </div>

      <CoinValuation coin={coin} settings={settings} suggestedErrorIds={suggestedErrorIds} />

      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onEdit}>
          Upraviť údaje
        </button>
      </div>
    </div>
  );
}
