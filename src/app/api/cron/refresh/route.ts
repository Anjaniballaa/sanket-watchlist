import { NextResponse } from "next/server";
import { distinctWatchlistTickers, refreshTickers } from "@/lib/refresh";
import { getMarketStatus } from "@/lib/market-hours";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization");
  const query = new URL(req.url).searchParams.get("secret");
  return header === `Bearer ${secret}` || query === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const market = getMarketStatus();
  const force = new URL(req.url).searchParams.get("force") === "1";
  // Outside hours we still refresh once so last close is cached; Yahoo returns last close.
  const tickers = await distinctWatchlistTickers();
  if (tickers.length === 0) {
    return NextResponse.json({ ok: true, market, tickers: 0, note: "empty universe" });
  }
  const result = await refreshTickers(tickers, { force: force || market.isOpen });
  return NextResponse.json({
    ok: true,
    market,
    refreshed: result.ok,
    failed: result.failed,
    windowNote: "snapshots keyed by 5-minute window — duplicate cron is a no-op",
  });
}

export async function POST(req: Request) {
  return GET(req);
}
