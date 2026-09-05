import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCachedQuote } from "@/lib/quotes";
import { getHeadlines, headlineMatchesTicker } from "@/lib/news";
import { getServiceSupabase } from "@/lib/supabase";
import { findSymbol, inferSector, normalizeTicker } from "@/lib/symbols";
import { persistSnapshot } from "@/lib/refresh";
import { snapshotWindow } from "@/lib/market-hours";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const raw = new URL(req.url).searchParams.get("symbol");
  if (!raw) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  const ticker = normalizeTicker(raw);
  const force = new URL(req.url).searchParams.get("force") === "1";

  try {
    const quote = await getCachedQuote(ticker, { force });
    await persistSnapshot(quote, snapshotWindow().toISOString());
    const catalog = findSymbol(ticker);
    const sb = getServiceSupabase();
    const { data: item } = await sb
      .from("watchlist_items")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("ticker", ticker)
      .maybeSingle();
    const { data: seen } = await sb
      .from("user_last_seen")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("ticker", ticker)
      .maybeSingle();
    const { data: events } = await sb
      .from("change_events")
      .select("event_type,score,summary,confidence,created_at")
      .eq("ticker", ticker)
      .order("created_at", { ascending: false })
      .limit(8);
    const displayName = item?.display_name ?? catalog?.name ?? quote.longName ?? quote.shortName ?? ticker;
    const headlines = (await getHeadlines(ticker, displayName)).filter((h) =>
      headlineMatchesTicker(ticker, displayName, h.headline),
    );
    const avgVol20 =
      quote.dailyVolumes.slice(-20).filter((v) => v > 0).reduce((a, b) => a + b, 0) /
      Math.max(1, quote.dailyVolumes.slice(-20).filter((v) => v > 0).length);
    const avgClose20 =
      quote.dailyCloses.slice(-20).reduce((a, b) => a + b, 0) /
      Math.max(1, quote.dailyCloses.slice(-20).length);
    const avgClose50 =
      quote.dailyCloses.slice(-50).reduce((a, b) => a + b, 0) /
      Math.max(1, quote.dailyCloses.slice(-50).length);
    const dayChangePct =
      quote.previousClose && quote.previousClose > 0
        ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
        : null;
    const fromOpenPct =
      quote.open && quote.open > 0 ? ((quote.price - quote.open) / quote.open) * 100 : null;
    const range52 =
      quote.high52w && quote.low52w && quote.high52w > quote.low52w
        ? ((quote.price - quote.low52w) / (quote.high52w - quote.low52w)) * 100
        : null;
    const fromHigh52 =
      quote.high52w && quote.high52w > 0 ? ((quote.price - quote.high52w) / quote.high52w) * 100 : null;
    const fromLow52 =
      quote.low52w && quote.low52w > 0 ? ((quote.price - quote.low52w) / quote.low52w) * 100 : null;
    const lastSeenPrice = seen?.last_seen_price ? Number(seen.last_seen_price) : null;
    const driftPct =
      lastSeenPrice && lastSeenPrice > 0 ? ((quote.price - lastSeenPrice) / lastSeenPrice) * 100 : null;
    const ref = item?.reference_price !== null && item?.reference_price !== undefined
      ? Number(item.reference_price)
      : null;
    const fromNote = ref && ref > 0 ? ((quote.price - ref) / ref) * 100 : null;

    return NextResponse.json({
      ticker: quote.ticker,
      displayName,
      sector: inferSector(item?.sector ?? catalog?.sector, displayName, ticker),
      exchange: quote.exchange,
      shortName: quote.shortName,
      longName: quote.longName,
      quote: {
        price: quote.price,
        previousClose: quote.previousClose,
        open: quote.open,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        volume: quote.volume,
        high52w: quote.high52w,
        low52w: quote.low52w,
        asOf: quote.asOf,
        stale: quote.stale,
        source: quote.source,
        currency: quote.currency,
      },
      derived: {
        dayChangePct,
        fromOpenPct,
        range52,
        fromHigh52,
        fromLow52,
        avgVol20,
        volumeVsAvg: avgVol20 > 0 && quote.volume ? quote.volume / avgVol20 : null,
        avgClose20,
        avgClose50,
        vsSma20: avgClose20 > 0 ? ((quote.price - avgClose20) / avgClose20) * 100 : null,
        vsSma50: avgClose50 > 0 ? ((quote.price - avgClose50) / avgClose50) * 100 : null,
        driftPct,
        fromNote,
      },
      chart: quote.chart ?? [],
      sparkline: quote.sparkline,
      headlines,
      lastSeen: {
        price: lastSeenPrice,
        at: seen?.last_seen_at ?? null,
        firstFlaggedAt: seen?.first_flagged_at ?? null,
        quietStreak: seen?.quiet_visit_streak ?? 0,
      },
      note: ref,
      mutedUntil: item?.muted_until ?? null,
      events: events ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "detail failed" },
      { status: 502 },
    );
  }
}
