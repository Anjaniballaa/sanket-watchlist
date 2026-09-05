import { getRedis } from "./redis";
import { getServiceSupabase } from "./supabase";
import { getCachedQuote, type CachedQuote } from "./quotes";
import { getHeadlines, headlineMatchesTicker } from "./news";
import { explainMoves, type GroqFact } from "./groq";
import {
  computeSignificance,
  DEFAULT_THRESHOLD,
  DEFAULT_WEIGHTS,
  type ScoreWeights,
  type SignificanceResult,
} from "./significance";
import { getMarketStatus } from "./market-hours";
import { findSymbol, inferSector } from "./symbols";
import { persistSnapshot } from "./refresh";
import { snapshotWindow } from "./market-hours";

const VISIT_TTL_SEC = 25 * 60;
const ATTENTION_BUDGET = 5;

export type WatchlistRow = {
  ticker: string;
  displayName: string;
  sector: string;
  price: number;
  previousClose: number | null;
  dayChangePct: number | null;
  volume: number | null;
  sparkline: number[];
  asOf: string;
  stale: boolean;
  source: "live" | "redis";
  score: number;
  flagged: boolean;
  breakdown: SignificanceResult["breakdown"];
  reasons: string[];
  eventTypes: string[];
  muted: boolean;
  mutedUntil: string | null;
  referencePrice: number | null;
  fromReferencePct: number | null;
  sectorAvgChangePct: number | null;
  vsSectorPct: number | null;
  firstFlag: boolean;
  enoughHistory: boolean;
  sentence: string | null;
  confidence: "news_backed" | "price_inferred" | null;
};

export type DigestCard = {
  ticker: string;
  displayName: string;
  score: number;
  sentence: string | null;
  confidence: "news_backed" | "price_inferred";
  reasons: string[];
  price: number;
  dayChangePct: number | null;
  fromReferencePct: number | null;
  firstFlag: boolean;
  breakdown: SignificanceResult["breakdown"];
};

export type DigestResponse = {
  market: ReturnType<typeof getMarketStatus>;
  computedAt: string;
  dataAsOf: string | null;
  visit: "fresh" | "cached";
  quiet: boolean;
  quietStreak: number;
  flagged: DigestCard[];
  rows: WatchlistRow[];
};

type Prefs = ScoreWeights & { threshold: number };

type ItemRow = {
  ticker: string;
  display_name: string | null;
  sector: string | null;
  reference_price: number | string | null;
  muted_until: string | null;
};

async function loadPrefs(userId: string): Promise<Prefs> {
  const sb = getServiceSupabase();
  const { data } = await sb.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (!data) {
    return { ...DEFAULT_WEIGHTS, threshold: DEFAULT_THRESHOLD };
  }
  return {
    w1: Number(data.w1),
    w2: Number(data.w2),
    w3: Number(data.w3),
    w4: Number(data.w4),
    w5: Number(data.w5),
    threshold: Number(data.threshold),
  };
}

export async function buildDigest(userId: string, opts?: { forceRefresh?: boolean }): Promise<DigestResponse> {
  const redis = getRedis();
  const cacheKey = `visit:v3:${userId}`;
  if (!opts?.forceRefresh) {
    const cached = await redis.get<DigestResponse>(cacheKey);
    if (cached) return { ...cached, visit: "cached" };
  }

  const sb = getServiceSupabase();
  const market = getMarketStatus();
  const prefs = await loadPrefs(userId);

  const { data: items } = await sb
    .from("watchlist_items")
    .select("ticker,display_name,sector,reference_price,muted_until")
    .eq("user_id", userId)
    .order("added_at", { ascending: true });

  const list = (items ?? []) as ItemRow[];
  const now = new Date();
  const quotes = new Map<string, CachedQuote>();

  for (const item of list) {
    try {
      const q = await getCachedQuote(item.ticker, { force: opts?.forceRefresh });
      quotes.set(item.ticker, q);
      await persistSnapshot(q, snapshotWindow().toISOString());
    } catch {
      // row will show empty-history / missing
    }
  }

  const { data: seenRows } = await sb.from("user_last_seen").select("*").eq("user_id", userId);
  const seen = new Map(
    (seenRows ?? []).map((r) => [r.ticker as string, r]),
  );

  const sectorChanges = new Map<string, number[]>();
  const scored: WatchlistRow[] = [];

  for (const item of list) {
    const meta = findSymbol(item.ticker);
    const quote = quotes.get(item.ticker);
    const muted = item.muted_until ? new Date(item.muted_until) > now : false;
    const ref =
      item.reference_price !== null && item.reference_price !== undefined
        ? Number(item.reference_price)
        : null;
    const last = seen.get(item.ticker);
    const enoughHistory = Boolean(quote && quote.dailyCloses.length >= 6);

    if (!quote) {
      scored.push({
        ticker: item.ticker,
        displayName: item.display_name ?? meta?.name ?? item.ticker,
        sector: inferSector(item.sector, item.display_name ?? meta?.name, item.ticker),
        price: 0,
        previousClose: null,
        dayChangePct: null,
        volume: null,
        sparkline: [],
        asOf: now.toISOString(),
        stale: true,
        source: "redis",
        score: 0,
        flagged: false,
        breakdown: {
          volAdjustedMove: 0,
          unusualVolume: 0,
          breach: 0,
          drift: 0,
          news: 0,
          gap: 0,
        },
        reasons: ["not enough history yet"],
        eventTypes: [],
        muted,
        mutedUntil: muted ? item.muted_until : null,
        referencePrice: ref,
        fromReferencePct: null,
        sectorAvgChangePct: null,
        vsSectorPct: null,
        firstFlag: false,
        enoughHistory: false,
        sentence: null,
        confidence: null,
      });
      continue;
    }

    const name = item.display_name ?? meta?.name;
    const rawHeadlines = muted ? [] : await getHeadlines(item.ticker, name);
    const headlines = rawHeadlines.filter((h) =>
      headlineMatchesTicker(item.ticker, name, h.headline),
    );
    const result = computeSignificance(
      {
        price: quote.price,
        previousClose: quote.previousClose,
        lastSeenPrice: last?.last_seen_price ? Number(last.last_seen_price) : null,
        dailyCloses: quote.dailyCloses,
        dailyVolumes: quote.dailyVolumes,
        volumeToday: quote.volume,
        high52w: quote.high52w,
        low52w: quote.low52w,
        headlines: muted ? [] : headlines,
        nowMs: now.getTime(),
      },
      prefs,
      prefs.threshold,
    );

    const dayChangePct =
      quote.previousClose && quote.previousClose > 0
        ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
        : null;
    const fromReferencePct =
      ref && ref > 0 ? ((quote.price - ref) / ref) * 100 : null;

    const sector = inferSector(
      item.sector ?? meta?.sector,
      item.display_name ?? meta?.name,
      item.ticker,
    );
    if (dayChangePct !== null && sector !== "—") {
      const arr = sectorChanges.get(sector) ?? [];
      arr.push(dayChangePct);
      sectorChanges.set(sector, arr);
    }

    const firstFlag = Boolean(result.flagged && !muted && !last?.first_flagged_at);

    scored.push({
      ticker: item.ticker,
      displayName: item.display_name ?? meta?.name ?? item.ticker,
      sector,
      price: quote.price,
      previousClose: quote.previousClose,
      dayChangePct,
      volume: quote.volume,
      sparkline: quote.sparkline,
      asOf: quote.asOf,
      stale: quote.stale,
      source: quote.source,
      score: muted ? 0 : result.score,
      flagged: muted ? false : result.flagged,
      breakdown: result.breakdown,
      reasons: enoughHistory ? result.reasons : ["not enough history yet"],
      eventTypes: result.eventTypes,
      muted,
      mutedUntil: muted ? item.muted_until : null,
      referencePrice: ref,
      fromReferencePct,
      sectorAvgChangePct: null,
      vsSectorPct: null,
      firstFlag,
      enoughHistory,
      sentence: null,
      confidence: headlines.length ? "news_backed" : "price_inferred",
    });
  }

  for (const row of scored) {
    const peers = sectorChanges.get(row.sector);
    if (peers && peers.length >= 2) {
      const avg = peers.reduce((a, b) => a + b, 0) / peers.length;
      row.sectorAvgChangePct = avg;
      if (row.dayChangePct !== null) row.vsSectorPct = row.dayChangePct - avg;
    }
  }

  const candidates = scored
    .filter((r) => r.flagged && r.enoughHistory && !r.muted)
    .sort((a, b) => b.score - a.score)
    .slice(0, ATTENTION_BUDGET);

  const groqFacts: GroqFact[] = candidates.slice(0, 3).map((r) => {
    const q = quotes.get(r.ticker);
    const last = seen.get(r.ticker);
    const driftPct =
      last?.last_seen_price && q
        ? ((q.price - Number(last.last_seen_price)) / Number(last.last_seen_price)) * 100
        : null;
    const volRatio =
      q && q.dailyVolumes.slice(-20).length
        ? (q.volume ?? 0) /
          (q.dailyVolumes.slice(-20).reduce((a, b) => a + b, 0) / q.dailyVolumes.slice(-20).length)
        : null;
    return {
      ticker: r.ticker,
      displayName: r.displayName,
      score: r.score,
      reasons: r.reasons,
      facts: {
        price: r.price,
        dayChangePct: r.dayChangePct,
        volumeRatio: volRatio,
        driftPct,
        headlines: r.confidence === "news_backed" ? r.reasons.filter((x) => x === "fresh headline") : [],
      },
    };
  });

  // Pass actual headlines into Groq
  for (const fact of groqFacts) {
    const hs = await getHeadlines(fact.ticker, fact.displayName);
    fact.facts.headlines = hs
      .filter((h) => headlineMatchesTicker(fact.ticker, fact.displayName, h.headline))
      .map((h) => h.headline)
      .slice(0, 3);
  }

  const lines = await explainMoves(groqFacts);
  const lineMap = new Map(lines.map((l) => [l.ticker, l]));

  for (const row of scored) {
    const line = lineMap.get(row.ticker);
    if (line) {
      row.sentence = line.sentence;
      row.confidence = line.confidence;
    }
  }

  const flagged: DigestCard[] = candidates.map((r) => ({
    ticker: r.ticker,
    displayName: r.displayName,
    score: r.score,
    sentence: lineMap.get(r.ticker)?.sentence ?? (r.reasons[0] ? r.reasons.slice(0, 2).join(" · ") : null),
    confidence: lineMap.get(r.ticker)?.confidence ?? r.confidence ?? "price_inferred",
    reasons: r.reasons,
    price: r.price,
    dayChangePct: r.dayChangePct,
    fromReferencePct: r.fromReferencePct,
    firstFlag: r.firstFlag,
    breakdown: r.breakdown,
  }));

  const quiet = list.length > 0 && flagged.length === 0;
  const prevStreak = Math.max(
    0,
    ...[...seen.values()].map((s) => Number(s.quiet_visit_streak ?? 0)),
  );
  const quietStreak = quiet ? prevStreak + 1 : 0;

  for (const item of list) {
    const q = quotes.get(item.ticker);
    const last = seen.get(item.ticker);
    const row = scored.find((r) => r.ticker === item.ticker);
    const wasFlagged = Boolean(row?.flagged);
    await sb.from("user_last_seen").upsert({
      user_id: userId,
      ticker: item.ticker,
      last_seen_price: q?.price ?? last?.last_seen_price ?? null,
      last_seen_at: now.toISOString(),
      quiet_visit_streak: quietStreak,
      first_flagged_at: wasFlagged
        ? (last?.first_flagged_at ?? now.toISOString())
        : last?.first_flagged_at ?? null,
    });
  }

  for (const card of flagged) {
    const { data: recent } = await sb
      .from("change_events")
      .select("created_at,score")
      .eq("user_id", userId)
      .eq("ticker", card.ticker)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const tooSoon =
      recent?.created_at &&
      Date.now() - new Date(recent.created_at).getTime() < 3 * 60 * 60 * 1000 &&
      Math.abs(Number(recent.score) - card.score) < 0.05;
    if (tooSoon) continue;
    await sb.from("change_events").insert({
      ticker: card.ticker,
      user_id: userId,
      event_type: scored.find((r) => r.ticker === card.ticker)?.eventTypes[0] ?? "drift",
      score: card.score,
      summary: card.sentence,
      confidence: card.confidence,
    });
  }

  const asOfs = scored.map((r) => r.asOf).filter(Boolean);
  const payload: DigestResponse = {
    market,
    computedAt: now.toISOString(),
    dataAsOf: asOfs.length ? asOfs.sort().at(-1)! : null,
    visit: "fresh",
    quiet,
    quietStreak,
    flagged,
    rows: scored,
  };

  await redis.set(cacheKey, payload, { ex: VISIT_TTL_SEC });
  return payload;
}

export async function clearVisitCache(userId: string) {
  await getRedis().del(`visit:v3:${userId}`);
}
