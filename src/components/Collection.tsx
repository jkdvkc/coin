import { useMemo, useState } from "react";
import type { CoinRecord } from "../lib/storage";
import { isPriceBacked } from "../lib/storage";
import { formatEur, pluralKus } from "../lib/format";

interface CollectionProps {
  coins: CoinRecord[];
  loading: boolean;
  onAdd: () => void;
  onOpen: (id: string) => void;
}

function matches(coin: CoinRecord, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    coin.name.toLowerCase().includes(needle) ||
    coin.country.toLowerCase().includes(needle) ||
    coin.year.includes(needle) ||
    coin.denomination.toLowerCase().includes(needle) ||
    coin.catalogNumber.toLowerCase().includes(needle) ||
    coin.errors.toLowerCase().includes(needle)
  );
}

export default function Collection({ coins, loading, onAdd, onOpen }: CollectionProps) {
  const [query, setQuery] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);

  const filtered = useMemo(
    () => coins.filter((c) => matches(c, query) && (!onlyErrors || c.errors.trim() !== "")),
    [coins, query, onlyErrors]
  );

  const totalPieces = useMemo(
    () => coins.reduce((sum, c) => sum + c.quantity, 0),
    [coins]
  );
  const errorCount = useMemo(
    () => coins.filter((c) => c.errors.trim() !== "").length,
    [coins]
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Moja zbierka</h1>
        <button type="button" className="btn-primary" onClick={onAdd}>
          ＋ Pridať
        </button>
      </header>

      <div className="stats-row">
        <div className="stat">
          <span className="stat-value">{coins.length}</span>
          <span className="stat-label">typov mincí</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalPieces}</span>
          <span className="stat-label">{pluralKus(totalPieces)}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{errorCount}</span>
          <span className="stat-label">chyborazby</span>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Hľadať: názov, krajina, rok…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className={`chip ${onlyErrors ? "chip-active" : ""}`}
          onClick={() => setOnlyErrors((v) => !v)}
        >
          Iba chyborazby
        </button>
      </div>

      {loading && <p className="muted pad">Načítavam zbierku…</p>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-coin" aria-hidden="true">🪙</div>
          <h2>{coins.length === 0 ? "Zbierka je prázdna" : "Nič sa nenašlo"}</h2>
          <p>
            {coins.length === 0
              ? "Začni odfotením prvej mince – líc aj rub. Všetko sa uloží len do tvojho telefónu."
              : "Skús iný výraz vyhľadávania alebo vypni filter chyborazby."}
          </p>
          {coins.length === 0 && (
            <button type="button" className="btn-primary" onClick={onAdd}>
              Odfotiť prvú mincu
            </button>
          )}
        </div>
      )}

      <ul className="coin-list">
        {filtered.map((coin) => (
          <li key={coin.id}>
            <button type="button" className="coin-row" onClick={() => onOpen(coin.id)}>
              <span className="coin-thumb">
                {coin.photoObverse ? (
                  <img src={coin.photoObverse} alt="" />
                ) : coin.photoReverse ? (
                  <img src={coin.photoReverse} alt="" />
                ) : (
                  <span className="thumb-placeholder">🪙</span>
                )}
              </span>
              <span className="coin-row-main">
                <span className="coin-row-title">{coin.name || "Neurčená minca"}</span>
                <span className="coin-row-sub">
                  {[coin.country, coin.year, coin.denomination].filter(Boolean).join(" · ") || "Bez údajov"}
                </span>
                {coin.errors && <span className="coin-row-errors">⚠ {coin.errors}</span>}
              </span>
              <span className="coin-row-right">
                <span className="coin-qty">{coin.quantity}× </span>
                {isPriceBacked(coin) && coin.priceValue != null && (
                  <span className="coin-price">{formatEur(coin.priceValue * coin.quantity)}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
