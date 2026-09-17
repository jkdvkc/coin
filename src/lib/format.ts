export function formatEur(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(new Date(ts));
}

export function isPlausibleYear(year: string): boolean {
  if (!/^\d{1,4}$/.test(year)) return false;
  const n = Number(year);
  return n >= 600 && n <= new Date().getFullYear() + 1;
}

export function pluralKus(n: number): string {
  if (n === 1) return "kus";
  if (n >= 2 && n <= 4) return "kusy";
  return "kusov";
}
