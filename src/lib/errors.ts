// Známe tlacové (raziace) chyby slovenských, českých a eurových mincí + orientačný odhad ceny.
// Multiplikátor = koľko-násobok bežnej ceny mince v podobnom stave takeáto chyba obvykle dosahuje.
// Rozsahy vychádzajú z bežných aukčných realizácií – sú ORIENTAČNÉ, nie katalógové ceny.
// Pre vzácne chyby (mule, off-metal) je vždy nutné potvrdenie odborníkom.

export interface MintError {
  id: string;
  name: string;
  description: string;
  // rozsah multiplikátora bežnej ceny
  multiplier: [number, number];
  // ako si chybu overiť lupou – praktické kroky
  verifySteps: string[];
  // kľúčové slová v texte chyby pre spárovanie s vlastným popisom
  keywords: string[];
  // signál z foto-analýzy, ktorý na túto chybu ukazuje (pre poradia návrhov)
  photoSignal?: "rim" | "center" | "contour" | "text" | "metal" | "none";
}

export const MINT_ERRORS: MintError[] = [
  {
    id: "shift",
    name: "Posun razby",
    description:
      "Líc a rub nie sú presne oproti sebe – motív je otočený alebo posunutý. Najčastejšia a medzi zbierateľmi najžiadanejšíš chyba.",
    multiplier: [2, 5],
    verifySteps: [
      "Polož mincu pred seba a nájdi na líci hlavný motív smerom hore.",
      "Bez otáčania mince sa pozri na rub – ak je motív rubu výrazne otáčaný alebo posunutý, ide o posun.",
      "Zmeraj uhol odchýlky – malý (do 15°) je bežný, výrazný (nad 90°) je vzácny a cennejší."
    ],
    keywords: ["posun", "otočen", "otacen", "rotácia", "rotacia"],
    photoSignal: "center"
  },
  {
    id: "double",
    name: "Dvojitý dojem (dvojraz)",
    description:
      "Nápis alebo motív je viditeľne dvojitý – razník udrel dvakrát s malým posunom. Dobre viditeľné na písmenách.",
    multiplier: [2, 6],
    verifySteps: [
      "Pozri si písmená nápisu lupou – čiary pri každom písmene („ducha“) naznačujú dvojraz.",
      "Rozlišuj od opotrebenia: dvojraz má ostré dvojité okraje, opotrebenie jemné.",
      "Skontroluj obe strany – dvojraz býva zvyčajne len na jednej."
    ],
    keywords: ["dvoj", "double", "dvojraz"],
    photoSignal: "contour"
  },
  {
    id: "edge",
    name: "Chyba okraja / odštep razníka",
    description:
      "Kus okraja (perlovec) je nepravidelný alebo chýba časť reliéfu – úlomok razníka bol poškodený.",
    multiplier: [1.5, 3],
    verifySteps: [
      "Obhliadni celý okraj – hľadaj miesto, kde perly alebo ryhy nepravidelne končia.",
      "Skontroluj, či je chyba len na jednom mieste (razník) alebo celom okraji (opotrebenie).",
      "Prska v razníku sa na minci prejavuje ako tenká vyvýšená línia cez motív."
    ],
    keywords: ["okraj", "odštep", "odstep", "prska", "perlovec"],
    photoSignal: "rim"
  },
  {
    id: "clipped",
    name: "Výsek plánžety (clipped planchet)",
    description:
      "Plánžeta (plech pred razením) mala chybný výrez – mince chýba oblúkový kúsky okraja.",
    multiplier: [2, 8],
    verifySteps: [
      "Hľadaj na okraji oblúkovú „výsek“ – hladnú krivku namiesto obvyklého okraja.",
      "Rozlišuj od poškodenia po obehu: výsek má hladné, zaoblené okraje.",
      "Väčší výsek (nad 10 % plochy) je vzácnejší."
    ],
    keywords: ["výsek", "vysek", "clipped", "plánžeta", "planzeta"],
    photoSignal: "rim"
  },
  {
    id: "offcenter",
    name: "Výstredný dojem (off-center)",
    description:
      "Minca bola razená mimo stredu plánžety – časť motívu chýba a časť plochy je nevyrazená.",
    multiplier: [3, 10],
    verifySteps: [
      "Pozri, či je časť motívu chýbajúca a na jej mieste je hladká, nevyrazená plocha.",
      "Zmeraj, koľko percent motívu chýba – nad 50 % je vzácne.",
      "Rozlišuj od posunu: pri výstrednom dojme chýba časť motívu, pri posune je len otáčaný."
    ],
    keywords: ["výstred", "vystred", "off-center", "nevyrazen"],
    photoSignal: "center"
  },
  {
    id: "missing",
    name: "Chýbajúci prvok (upchatý razník)",
    description:
      "Chýba časť nápisu, hviezda alebo rok – razník bol upchatý nečistotami alebo poškodený.",
    multiplier: [2, 6],
    verifySteps: [
      "Porovnaj s bežnou mincou rovnakého typu – čo presne chýba?",
      "Upchatý razník zanecháva mäkko „zaplnené“ miesto, nie hlbokú dieru.",
      "Najznámejšie sú chýbajúce značky mincovne alebo roky."
    ],
    keywords: ["chýba", "chyba prvok", "upchat", "bez značky", "bez znacky"],
    photoSignal: "text"
  },
  {
    id: "brockage",
    name: "Brockage (zrkadlový odtlačok)",
    description:
      "Na jednej strane je zrkadlovo otočený negatívny odtlačok predchádzajúcej mince, ktorá zostala v razníku.",
    multiplier: [5, 15],
    verifySteps: [
      "Pozri, či jedna strana nie je „vyhĺbená“ zrkadlová kópia druhej strany.",
      "Brockage má zrkadlový, prehodený reliéf – nie je to bežný motív.",
      "Vzácnosť rastie s kvalitou odtlačku."
    ],
    keywords: ["brockage", "zrkadlov"],
    photoSignal: "none"
  },
  {
    id: "offmetal",
    name: "Zle razený kov (off-metal)",
    description:
      "Minca je razená v inom kovu, ako má byť (napr. 10 K v mosadzi namiesto CuNi). Veľmi vzácne.",
    multiplier: [10, 50],
    verifySteps: [
      "Porovnaj farbu a hmotnosť s bežnou mincou rovnakého typu.",
      "Odlišný kov má často aj inú hmotnosť – zvaž mincu.",
      "Nezameniteľné s falzifikátom – nutné potvrdenie odborníkom alebo certifikát."
    ],
    keywords: ["off-metal", "offmetal", "iný kov", "iny kov", "zlé kov"],
    photoSignal: "metal"
  },
  {
    id: "lamination",
    name: "Laminácia (olúpanie povrchu)",
    description:
      "Z povrchu mince sa odlupuje tenká vrstva kovu – chyba výroby plánžety.",
    multiplier: [1.5, 4],
    verifySteps: [
      "Hľadaj na povrchu miesta, kde sa kov odlupuje vo vrstvách.",
      "Laminácia má charakteristické „šupinky“ – nie je to poškodenie od nárazu.",
      "Často sa objavuje na medených a pozinkovaných minciach."
    ],
    keywords: ["laminác", "laminac", "olúpan", "olupan", "šupink", "supink"],
    photoSignal: "rim"
  },
  {
    id: "crack",
    name: "Prska v razníku (die crack)",
    description:
      "V razníku vznikla trhlina, ktorá na minci vytvára tenkú vyvýšenú líniu cez motív.",
    multiplier: [1.3, 3],
    verifySteps: [
      "Pozri si motív lupou – hľadaj tenkú, rovnú alebo vetviacu sa líniu.",
      "Línia je vyvýšená (hmatateľná nechtom), nie vyhĺbená.",
      "Väčšie prsky (cez celý motív) sú cennejšie."
    ],
    keywords: ["prska", "trhlina", "crack"],
    photoSignal: "contour"
  },
  {
    id: "edgeletter",
    name: "Chyba okrajového vpisu",
    description:
      "Mince s okrajovým vpisom (napr. 2 € „SLOVENSKO“) – chýbajúce, zdvojené alebo posunuté písmená na hrane.",
    multiplier: [2, 10],
    verifySteps: [
      "Prejdi prstom po hrane mince – vpis má byť rovnomerný a úplný.",
      "Skontroluj celý obvod – chýbajúce úsek alebo dvojité písmená sú chyba.",
      "Pri 2 € minciach je okrajový vpis významný identifikačný znak."
    ],
    keywords: ["okrajový vpis", "okrajovy vpis", "hrana", "vpis na hrane"],
    photoSignal: "rim"
  },
  {
    id: "mule",
    name: "Mule (nezhodné strany)",
    description:
      "Líc od jednej mince, rub od druhej – chyba kombinácie razníkov. Extrémne vzácne.",
    multiplier: [20, 100],
    verifySteps: [
      "Porovnaj obe strany s katalógom – patria spolu?",
      "Mule kombinuje razníky rôznych nominálov alebo rokov.",
      "Takmer vždy vyžaduje expertízu a certifikát (NGC, PCGS)."
    ],
    keywords: ["mule"],
    photoSignal: "none"
  }
];

/**
 * Navrhne pravdepodobné chyby z výsledkov foto-analýzy.
 * Vráti ID zoradené podľa sily signálu (najpravdepodobnejšie prvé).
 */
export function detectErrorHints(
  hints: string[],
  rimIrregular: boolean,
  metalUnknown = false
): string[] {
  const text = hints.join(" ").toLowerCase();
  const found: string[] = [];

  if (rimIrregular || /okraj|nepravidel/i.test(text)) {
    found.push("edge", "clipped", "lamination");
  }
  if (/centrova|posun|nesúmern/i.test(text)) {
    found.push("shift", "offcenter");
  }
  if (/dvojit|ducha|kontúr/i.test(text)) {
    found.push("double", "crack");
  }
  if (metalUnknown) {
    found.push("offmetal");
  }
  if (/nepodarilo prečíta|nedostatok detail/i.test(text)) {
    found.push("missing");
  }

  return Array.from(new Set(found));
}

/** Popis pre UI – prečo je chyba označená za pravdepodobnú. */
export const ERROR_REASON: Record<string, string> = {
  shift: "Analýza naznačila nesúmernosť medzi stredom lica a rubu.",
  offcenter: "Časť motívu môže byť nevyrazená – overiť vystredenie.",
  edge: "Okraj mince na fotke pôsobí nepravidelne.",
  clipped: "Na okraji môže byť výsek plánžety.",
  lamination: "Povrch môže vykazovať odlupovanie kovu.",
  double: "Dvojité kontúry na fotke môžu naznačovať dvojraz.",
  crack: "Tenká línia cez motív môže byť prska v razníku.",
  offmetal: "Farba kovu nezodpovedá bežnému vyhotoveniu.",
  missing: "Časť nápisu sa na fotke nepodarilo prečítať.",
  brockage: "Nezistiteľné z fotky – len ako informácia.",
  mule: "Nezistiteľné z fotky – len ako informácia.",
  edgeletter: "Overiť okrajový vpis na hrane mince."
};
