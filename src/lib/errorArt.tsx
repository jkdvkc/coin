// Jednoduché SVG ilustrácie tlacových chýb – náčrtový štýl, zlaté línie na tmavom pozadí.
// Každá ilustrácia zobrazuje kruh mince + znak chyby.

import type { JSX } from "react";

const GOLD = "#d9b45a";
const DIM = "#6f5417";

function CoinBase({ children }: { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg viewBox="0 0 100 100" width="72" height="72" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke={DIM} strokeWidth="1" />
      {children}
    </svg>
  );
}

const ILLUSTRATIONS: Record<string, JSX.Element> = {
  // Posun razby: dva motívy (hlava) posunuté oproti sebe
  shift: (
    <CoinBase>
      <circle cx="42" cy="46" r="12" fill="none" stroke={DIM} strokeWidth="1.5" />
      <circle cx="56" cy="58" r="12" fill="none" stroke={GOLD} strokeWidth="2" />
    </CoinBase>
  ),
  // Dvojraz: zdvojené písmeno
  double: (
    <CoinBase>
      <text x="34" y="64" fontSize="40" fill="none" stroke={DIM} strokeWidth="1" opacity="0.6">A</text>
      <text x="40" y="60" fontSize="40" fill="none" stroke={GOLD} strokeWidth="1.6">A</text>
    </CoinBase>
  ),
  // Odštep razníka: zárez na okraji
  edge: (
    <CoinBase>
      <path d="M 84 38 L 96 30 L 95 48 Z" fill={GOLD} opacity="0.85" />
      <path d="M 84 38 Q 92 40 95 48" fill="none" stroke={GOLD} strokeWidth="1.5" />
    </CoinBase>
  ),
  // Výsek plánžety: oblúkový výsek v okraji
  clipped: (
    <svg viewBox="0 0 100 100" width="72" height="72" aria-hidden="true">
      <path d="M 30 12 A 46 46 0 1 0 70 12 A 58 58 0 0 1 30 12 Z" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <circle cx="50" cy="54" r="30" fill="none" stroke={DIM} strokeWidth="1" />
    </svg>
  ),
  // Výstredný dojem: motív posunutý, časť prázdna
  offcenter: (
    <svg viewBox="0 0 100 100" width="72" height="72" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke={DIM} strokeWidth="1.2" strokeDasharray="4 3" />
      <circle cx="62" cy="58" r="36" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <text x="62" y="70" fontSize="30" textAnchor="middle" fill="none" stroke={GOLD} strokeWidth="1.2">10</text>
    </svg>
  ),
  // Upchatý razník: chýbajúca časť nápisu
  missing: (
    <CoinBase>
      <text x="26" y="60" fontSize="24" fill="none" stroke={GOLD} strokeWidth="1.3">2</text>
      <rect x="44" y="40" width="16" height="24" fill="none" stroke={DIM} strokeWidth="1" strokeDasharray="3 2" />
      <text x="64" y="60" fontSize="24" fill="none" stroke={GOLD} strokeWidth="1.3">5</text>
    </CoinBase>
  ),
  // Brockage: zrkadlový odtlačok
  brockage: (
    <CoinBase>
      <circle cx="50" cy="50" r="20" fill="none" stroke={DIM} strokeWidth="1.5" transform="scale(1,-1) translate(0,-100)" />
      <circle cx="50" cy="50" r="12" fill="none" stroke={GOLD} strokeWidth="2" />
    </CoinBase>
  ),
  // Off-metal: minca v odlišnom odtieni
  offmetal: (
    <CoinBase>
      <circle cx="50" cy="50" r="30" fill={GOLD} opacity="0.25" />
      <text x="50" y="62" fontSize="26" textAnchor="middle" fill={GOLD}>≠</text>
    </CoinBase>
  ),
  // Laminácia: odlupujúce sa šupinky
  lamination: (
    <CoinBase>
      <path d="M 30 60 Q 42 48 56 56 Q 68 62 76 54" fill="none" stroke={GOLD} strokeWidth="1.6" />
      <path d="M 32 68 Q 44 58 58 64 Q 70 70 78 62" fill="none" stroke={DIM} strokeWidth="1.2" />
      <path d="M 34 52 Q 46 40 60 48" fill="none" stroke={DIM} strokeWidth="1" />
    </CoinBase>
  ),
  // Prska v razníku: tenká línia cez motív
  crack: (
    <CoinBase>
      <path d="M 20 70 L 44 54 L 52 58 L 80 30" fill="none" stroke={GOLD} strokeWidth="1.8" />
      <path d="M 44 54 L 48 46" fill="none" stroke={GOLD} strokeWidth="1.2" />
    </CoinBase>
  ),
  // Okrajový vpis: písmená na hrane
  edgeletter: (
    <CoinBase>
      <circle cx="50" cy="50" r="42" fill="none" stroke={GOLD} strokeWidth="1.2" strokeDasharray="2 3" />
      <text x="50" y="24" fontSize="11" textAnchor="middle" fill={GOLD}>• S L O V •</text>
    </CoinBase>
  ),
  // Mule: dve odlišné polovice
  mule: (
    <CoinBase>
      <path d="M 50 12 A 38 38 0 0 0 50 88 Z" fill={GOLD} opacity="0.12" />
      <text x="34" y="60" fontSize="22" textAnchor="middle" fill={GOLD}>A</text>
      <text x="66" y="60" fontSize="22" textAnchor="middle" fill={DIM}>B</text>
      <line x1="50" y1="16" x2="50" y2="84" stroke={GOLD} strokeWidth="1" strokeDasharray="3 2" />
    </CoinBase>
  )
};

export function ErrorIllustration({ id }: { id: string }) {
  return ILLUSTRATIONS[id] ?? (
    <CoinBase>
      <text x="50" y="60" fontSize="24" textAnchor="middle" fill={GOLD}>?</text>
    </CoinBase>
  );
}
