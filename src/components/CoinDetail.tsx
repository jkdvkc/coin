import { useMemo } from "react";
import type { CoinRecord } from "../lib/storage";
import { isPriceBacked } from "../lib/storage";
import { formatEur, formatDate, pluralKus } from "../lib/format";
import CoinValuation from "./CoinValuation";
import type { Settings } from "../lib/estimate";

interface CoinDetailProps {
  coin: CoinRecord;
  settings: Settings;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function PriceBlock({ coin }: { coin: CoinRecord }) {
  const backed = isPriceBacked(coin);
  const total = useMemo(
    () => (backed && coin.priceValue != null ? coin.priceValue * coin.quantity : null),
    [backed, coin]
  );
  if (!backed) {
    return (
      <div className="price-unbacked">
        <strong>Orientačná cena nie je zobrazená.</strong>
        <span>
          Zobrazuje sa len vtedy, keď ju podložíš zdrojom (aukcia, katalóg, predajca).
          Bez podkladu by išlo o špekuláciu.
        </span>
      </div>
    );
  }
  return (
    <div className="price-backed">
      <div className="detail-row">
        <span className="detail-label">Orientačná cena (1 ks)</span>
        <span className="detail-value price">{coin.priceValue != null ? formatEur(coin.priceValue) : "—"}</span>
      </div>
      <p className="price-source-note">
        Podložené zdrojom: <strong>{coin.priceSource}</strong>
      </p>
      {total != null && (
        <div className="detail-row">
          <span className="detail-label">Spolu {coin.quantity} {pluralKus(coin.quantity)}</span>
          <span className="detail-value price">{formatEur(total)}</span>
        </div>
      )}
      <Row label="Zdroj ceny" value={coin.priceSource} />
      <Row label="Poznámka k cene" value={coin.priceNote} />
    </div>
  );
}

export default function CoinDetail({ coin, settings, onClose, onEdit, onDelete }: CoinDetailProps) {
  return (
    <div className="screen">
      <header className="screen-header">
        <button type="button" className="btn-ghost" onClick={onClose}>
          ← Späť
        </button>
        <h1 className="screen-title">Detail mince</h1>
        <button type="button" className="btn-ghost" onClick={onEdit}>
          Upraviť
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
          <h2>{coin.name || "Neurčená minca"}</h2>
          <span className="detail-date">Pridané {formatDate(coin.createdAt)}</span>
        </div>

        <Row label="Krajina" value={coin.country} />
        <Row label="Rok" value={coin.year} />
        <Row label="Nominál" value={coin.denomination} />
        <Row label="Mena" value={coin.currency} />
        <Row label="Značka mincovne" value={coin.mintMark} />
        <Row label="Katalógové číslo" value={coin.catalogNumber} />
        <Row label="Materiál" value={coin.material} />
        <Row
          label="Hmotnosť"
          value={coin.weightGrams != null ? `${coin.weightGrams} g` : ""}
        />

        <div className="detail-row">
          <span className="detail-label">Počet kusov</span>
          <span className="detail-value">
            {coin.quantity} {pluralKus(coin.quantity)}
          </span>
        </div>

        <Row label="Stav (grading)" value={coin.grade} />
        <Row label="Chyborazba" value={coin.errors} />
        <Row label="Poznámka" value={coin.note} />

        {coin.purchasedPrice != null && (
          <div className="detail-row">
            <span className="detail-label">Obstarávacia cena</span>
            <span className="detail-value">{formatEur(coin.purchasedPrice)}</span>
          </div>
        )}
      </div>

      <div className="detail-card">
        <h3 className="section-title">Orientačná cena</h3>
        {isPriceBacked(coin) ? (
          <PriceBlock coin={coin} />
        ) : (
          <CoinValuation coin={coin} settings={settings} />
        )}
      </div>

      <div className="detail-card">
        <h3 className="section-title">Rozpoznávanie</h3>
        <p className="muted">
          {coin.recognitionStatus === "done"
            ? "Fotografie boli analyzované – výsledky nájdeš pri jednotlivých poliach."
            : "Automatická analýza fotografii ešte neprebehla. Spusti ju v editácii mince."}
        </p>
      </div>

      <button type="button" className="btn-danger" onClick={onDelete}>
        Odstrániť zo zbierky
      </button>
    </div>
  );
}
