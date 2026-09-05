import symbols from "@/data/nse-symbols.json";

const UNKNOWN = "\u2014";

export type NseSymbol = {
  symbol: string;
  name: string;
  sector: string;
};

export const NSE_SYMBOLS = symbols as NseSymbol[];

export function searchSymbols(q: string, limit = 12): NseSymbol[] {
  const s = q.trim().toLowerCase();
  if (!s) return NSE_SYMBOLS.slice(0, limit);
  return NSE_SYMBOLS.filter(
    (x) =>
      x.symbol.toLowerCase().includes(s) ||
      x.name.toLowerCase().includes(s) ||
      x.sector.toLowerCase().includes(s),
  ).slice(0, limit);
}

export function findSymbol(ticker: string): NseSymbol | undefined {
  const t = ticker.toUpperCase();
  const withNs = t.endsWith(".NS") ? t : `${t}.NS`;
  return NSE_SYMBOLS.find((x) => x.symbol === withNs || x.symbol === t);
}

export function looksLikeTicker(raw: string): boolean {
  return /^[A-Z0-9.&-]{1,24}(\.(NS|BO))?$/i.test(raw.trim());
}

export function inferSector(
  stored: string | null | undefined,
  name?: string | null,
  ticker?: string,
): string {
  const known = stored?.trim();
  if (known && known !== UNKNOWN && known.toLowerCase() !== "custom") return known;
  const blob = `${name ?? ""} ${ticker ?? ""}`.toLowerCase();
  if (/pharma|pharmaceutical|biocon/.test(blob)) return "Pharma";
  if (/chem|fertiliz|paint/.test(blob)) return "Materials";
  if (/bank|finserv|nbfc/.test(blob)) return "Banking";
  if (/insur/.test(blob)) return "Insurance";
  if (/infra|urban|port|cement|construct/.test(blob)) return "Infrastructure";
  if (/steel|metal|alum|copper|zinc/.test(blob)) return "Metals";
  if (/software|infotech|consultancy/.test(blob)) return "IT";
  if (/power|utilities|renew/.test(blob)) return "Utilities";
  if (/hotel|travel|tourism/.test(blob)) return "Travel";
  if (/auto|motor|vehicle/.test(blob)) return "Auto";
  if (/oil|gas|petroleum|refiner/.test(blob)) return "Energy";
  return UNKNOWN;
}

export function normalizeTicker(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return t;
  if (t.endsWith(".NS") || t.endsWith(".BO")) return t;
  return `${t}.NS`;
}
