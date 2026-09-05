import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getCachedQuote } from "@/lib/quotes";
import { normalizeTicker } from "@/lib/symbols";

const paramsSchema = z.object({ ticker: z.string().min(1) });

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { ticker: raw } = paramsSchema.parse(await ctx.params);
  const ticker = normalizeTicker(raw);
  const url = new URL(_req.url);
  const force = url.searchParams.get("force") === "1";
  try {
    const quote = await getCachedQuote(ticker, { force });
    return NextResponse.json({
      ticker: quote.ticker,
      price: quote.price,
      previousClose: quote.previousClose,
      volume: quote.volume,
      asOf: quote.asOf,
      stale: quote.stale,
      source: quote.source,
      sparkline: quote.sparkline,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "quote failed" },
      { status: 502 },
    );
  }
}
