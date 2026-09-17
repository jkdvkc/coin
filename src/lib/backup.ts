import { dbSaveCoin, sanitizeCoin, type CoinRecord } from "./storage";

export async function exportBackup(all: CoinRecord[]): Promise<void> {
  const payload = {
    app: "CoinScanner",
    version: 1,
    exportedAt: new Date().toISOString(),
    coins: all
  };
  const json = JSON.stringify(payload, null, 2);
  const bytes = new TextEncoder().encode(json);
  const blob = new Blob([bytes], { type: "application/json" });

  const nav = navigator as Navigator;
  if ("canShare" in nav && typeof nav.canShare === "function") {
    const file = new File([blob], "coinscanner-zaloha.json", { type: "application/json" });
    const shareData = { files: [file] };
    try {
      if (nav.canShare(shareData)) {
        await nav.share(shareData);
        return;
      }
    } catch {
      // používateľ zrušil zdieľanie – pokračujeme na stiahnutie
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "coinscanner-zaloha.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function importBackup(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { coins?: unknown };
  if (!parsed || !Array.isArray(parsed.coins)) {
    throw new Error("Neplatný formát zálohy.");
  }
  let imported = 0;
  for (const raw of parsed.coins) {
    const coin = sanitizeCoin(raw);
    if (!coin.id) continue;
    await dbSaveCoin(coin);
    imported++;
  }
  return imported;
}
