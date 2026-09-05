import { getServiceSupabase } from "./supabase";
import { getCachedQuote } from "./quotes";
import { snapshotWindow } from "./market-hours";
import type { CachedQuote } from "./quotes";

export async function refreshTickers(
  tickers: string[],
  opts?: { force?: boolean },
): Promise<{ ok: string[]; failed: string[] }> {
  const windowStart = snapshotWindow().toISOString();
  const ok: string[] = [];
  const failed: string[] = [];

  for (const ticker of tickers) {
    try {
      const quote = await getCachedQuote(ticker, { force: opts?.force });
      await persistSnapshot(quote, windowStart);
      ok.push(ticker);
    } catch {
      failed.push(ticker);
    }
  }
  return { ok, failed };
}

export async function persistSnapshot(quote: CachedQuote, windowStart: string) {
  const sb = getServiceSupabase();
  // Idempotent: unique (ticker, snapshot_window) — re-running cron is a no-op.
  await sb.from("price_snapshots").upsert(
    {
      ticker: quote.ticker,
      price: quote.price,
      volume: quote.volume,
      previous_close: quote.previousClose,
      high_52w: quote.high52w,
      low_52w: quote.low52w,
      snapshot_window: windowStart,
      captured_at: new Date().toISOString(),
    },
    { onConflict: "ticker,snapshot_window" },
  );
}

export async function distinctWatchlistTickers(): Promise<string[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb.from("watchlist_items").select("ticker");
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.ticker as string))];
}
