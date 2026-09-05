import { getRedis } from "./redis";
import { fetchYahooQuote, type QuoteSeries } from "./yahoo";

export type CachedQuote = QuoteSeries & {
  stale: boolean;
  source: "live" | "redis";
};

const TTL_SEC = 4 * 60;

export async function getCachedQuote(
  ticker: string,
  opts?: { force?: boolean },
): Promise<CachedQuote> {
  const redis = getRedis();
  const key = `quote:v4:${ticker}`;

  if (!opts?.force) {
    const cached = await redis.get<QuoteSeries>(key);
    if (cached && cached.price) {
      return { ...cached, stale: false, source: "redis" };
    }
  }

  try {
    const live = await fetchYahooQuote(ticker);
    await redis.set(key, live, { ex: TTL_SEC });
    await redis.set(`quote:last:v4:${ticker}`, live, { ex: 60 * 60 * 24 * 7 });
    return { ...live, stale: false, source: "live" };
  } catch {
    const last = await redis.get<QuoteSeries>(`quote:last:v4:${ticker}`);
    if (last && last.price) {
      return { ...last, stale: true, source: "redis" };
    }
    const short = await redis.get<QuoteSeries>(key);
    if (short && short.price) {
      return { ...short, stale: true, source: "redis" };
    }
    throw new Error(`no price for ${ticker} (yahoo down, cache empty)`);
  }
}
