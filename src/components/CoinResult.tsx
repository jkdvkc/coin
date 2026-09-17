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
  /** priebeh/verdik auto-rozpoznania (pre „nepodarilo sa rozpoznať“ stav) */
  auto?: { rawText: string; confidence: number } | null;
  onSave: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  onRetake: () => void;
}

export default function CoinResult({ coin, settings, suggestedErrorIds, autoFilled, auto, onSave, onEdit, onDiscard, onRetake }: CoinResultProps) {
  // Rozpoznanie zlyhalo, keď auto-vyplnenie nenašlo žiaden rok/krajinu/nominál
  const recognized = autoFilled.length > 0;
  const failed = !recognized;
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
        {recognized && (
          <p className="auto-note muted">Automaticky rozpoznané: {autoFilled.join(", ")}</p>
        )}
        {failed && (
          <div className="recognize-failed">
            <strong>Nepodarilo sa mi prečítať údaje z fotky 🙈</strong>
            <p>
              Fotka bola pravdepodobne rozmazaná alebo minca zle osvetlená. Najlepšie funguje
              denné svetlo, fotenie z rovna a minca vyplnená do zlatého kruhu.
            </p>
            <p className="muted">
              {auto?.rawText
                ? `OCR prečítalo: „${auto.rawText.slice(0, 60)}“`
                : "OCR nenašlo žiadny čitateľný nápis."}
            </p>
            <button type="button" className="btn-primary" onClick={onRetake}>
              📷 Odfotiť znova
            </button>
            <p className="muted">…alebo údaje doplň ručne nižšie cez „Upraviť údaje“.</p>
          </div>
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
