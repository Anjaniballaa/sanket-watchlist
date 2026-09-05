import { retryWithBackoff } from "./retry";

export type ChartPoint = {
  t: number;
  close: number;
  volume: number;
  high: number | null;
  low: number | null;
  open: number | null;
};

export type QuoteSeries = {
  ticker: string;
  price: number;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  high52w: number | null;
  low52w: number | null;
  dailyCloses: number[];
  dailyVolumes: number[];
  sparkline: number[];
  chart: ChartPoint[];
  asOf: string;
  currency: string;
  exchange: string | null;
  shortName: string | null;
  longName: string | null;
};

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketVolume?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        currency?: string;
        regularMarketTime?: number;
        shortName?: string;
        longName?: string;
        symbol?: string;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketOpen?: number;
        exchangeName?: string;
        fullExchangeName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          open?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
};

function chartUrl(ticker: string, range: string, interval: string) {
  const t = encodeURIComponent(ticker);
  return `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=${interval}&range=${range}&events=div%7Csplit`;
}

async function fetchChart(ticker: string, range: string, interval: string): Promise<YahooChart> {
  return retryWithBackoff(
    async () => {
      const res = await fetch(chartUrl(ticker, range, interval), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (res.status === 429) throw new Error("yahoo rate limited");
      if (!res.ok) throw new Error(`yahoo HTTP ${res.status}`);
      return (await res.json()) as YahooChart;
    },
    { attempts: 3, baseMs: 400, label: `yahoo:${ticker}` },
  );
}

function nums(arr: Array<number | null> | undefined): number[] {
  return (arr ?? []).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}

/**
 * Yahoo's `chartPreviousClose` on a 1y chart is the close *before the range
 * starts* (≈ a year ago), not yesterday. Never use it for day change.
 */
export function resolvePreviousClose(
  price: number,
  dailyCloses: number[],
  metaPreviousClose?: number | null,
): number | null {
  if (metaPreviousClose && metaPreviousClose > 0) return metaPreviousClose;
  if (dailyCloses.length >= 2) {
    const last = dailyCloses[dailyCloses.length - 1];
    const prior = dailyCloses[dailyCloses.length - 2];
    if (last > 0 && Math.abs(price - last) / last < 0.02) return prior;
    return last;
  }
  return dailyCloses.length ? dailyCloses[0] : null;
}

export async function fetchYahooQuote(ticker: string): Promise<QuoteSeries> {
  const year = await fetchChart(ticker, "1y", "1d");
  const result = year.chart?.result?.[0];
  if (!result?.meta) {
    throw new Error(year.chart?.error?.description ?? "yahoo empty chart");
  }
  const closes = nums(result.indicators?.quote?.[0]?.close);
  const volumes = nums(result.indicators?.quote?.[0]?.volume);
  const highs = nums(result.indicators?.quote?.[0]?.high);
  const lows = nums(result.indicators?.quote?.[0]?.low);
  const stamps = result.timestamp ?? [];
  const rawClose = result.indicators?.quote?.[0]?.close ?? [];
  const rawVol = result.indicators?.quote?.[0]?.volume ?? [];
  const rawHigh = result.indicators?.quote?.[0]?.high ?? [];
  const rawLow = result.indicators?.quote?.[0]?.low ?? [];
  const rawOpen = result.indicators?.quote?.[0]?.open ?? [];
  const chart: ChartPoint[] = [];
  for (let i = 0; i < stamps.length; i += 1) {
    const close = rawClose[i];
    if (typeof close !== "number" || !Number.isFinite(close)) continue;
    const vol = rawVol[i];
    const hi = rawHigh[i];
    const lo = rawLow[i];
    const op = rawOpen[i];
    chart.push({
      t: stamps[i] * 1000,
      close,
      volume: typeof vol === "number" ? vol : 0,
      high: typeof hi === "number" ? hi : null,
      low: typeof lo === "number" ? lo : null,
      open: typeof op === "number" ? op : null,
    });
  }
  const meta = result.meta;
  const price = meta.regularMarketPrice ?? closes[closes.length - 1];
  if (!price || !Number.isFinite(price)) throw new Error("yahoo missing price");

  const high52w = meta.fiftyTwoWeekHigh ?? (highs.length ? Math.max(...highs) : null);
  const low52w = meta.fiftyTwoWeekLow ?? (lows.length ? Math.min(...lows) : null);
  const asOfSec = meta.regularMarketTime ?? Math.floor(Date.now() / 1000);
  const sessionOpen =
    meta.regularMarketOpen ?? chart.at(-1)?.open ?? rawOpen.filter((n): n is number => typeof n === "number").at(-1) ?? null;

  return {
    ticker,
    price,
    previousClose: resolvePreviousClose(price, closes, meta.previousClose ?? null),
    open: sessionOpen,
    dayHigh: meta.regularMarketDayHigh ?? (highs.length ? highs[highs.length - 1] : null),
    dayLow: meta.regularMarketDayLow ?? (lows.length ? lows[lows.length - 1] : null),
    volume: meta.regularMarketVolume ?? volumes[volumes.length - 1] ?? null,
    high52w: high52w ?? null,
    low52w: low52w ?? null,
    dailyCloses: closes,
    dailyVolumes: volumes,
    sparkline: closes.slice(-30),
    chart:
      chart.length > 0
        ? chart.slice(-120)
        : closes.map((close, i) => ({
            t: Date.now() - (closes.length - 1 - i) * 86400000,
            close,
            volume: volumes[i] ?? 0,
            high: null,
            low: null,
            open: null,
          })),
    asOf: new Date(asOfSec * 1000).toISOString(),
    currency: meta.currency ?? "INR",
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    shortName: meta.shortName ?? null,
    longName: meta.longName ?? null,
  };
}

/** Live check that Yahoo has this symbol. Used so any NSE/BSE ticker can be added. */
export async function resolveYahooIdentity(
  ticker: string,
): Promise<{ ticker: string; name: string } | null> {
  try {
    const data = await fetchChart(ticker, "5d", "1d");
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (!price || !Number.isFinite(price)) return null;
    return {
      ticker: meta.symbol ?? ticker,
      name: meta.shortName ?? meta.longName ?? ticker,
    };
  } catch {
    return null;
  }
}
