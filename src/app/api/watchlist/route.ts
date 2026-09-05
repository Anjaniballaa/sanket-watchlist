import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { findSymbol, inferSector, looksLikeTicker, normalizeTicker, searchSymbols } from "@/lib/symbols";
import { clearVisitCache } from "@/lib/digest";
import { resolveYahooIdentity } from "@/lib/yahoo";

const addSchema = z.object({
  ticker: z.string().min(1),
  referencePrice: z.number().positive().optional().nullable(),
});

const patchSchema = z.object({
  ticker: z.string().min(1),
  referencePrice: z.number().positive().nullable().optional(),
  muteDays: z.number().int().min(0).max(30).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q");
  if (q !== null) {
    const results = searchSymbols(q);
    const extras: { symbol: string; name: string; sector: string }[] = [];
    if (looksLikeTicker(q)) {
      const ns = normalizeTicker(q);
      if (!results.some((r) => r.symbol === ns)) {
        extras.push({
          symbol: ns,
          name: ns.endsWith(".BO") ? "BSE live quote" : "NSE live quote",
          sector: "Custom",
        });
      }
      if (ns.endsWith(".NS")) {
        const bo = ns.replace(/\.NS$/, ".BO");
        extras.push({ symbol: bo, name: "BSE live quote (if not on NSE)", sector: "Custom" });
      }
    }
    return NextResponse.json({ results, extras });
  }
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("watchlist_items")
    .select("*")
    .eq("user_id", session.user.id)
    .order("added_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = addSchema.parse(await req.json());
  const requested = normalizeTicker(body.ticker);
  if (!looksLikeTicker(requested)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }
  const catalog = findSymbol(requested);
  let ticker = requested;
  let displayName = catalog?.name ?? ticker;
  let sector = catalog?.sector ?? null;
  if (!catalog) {
    let live = await resolveYahooIdentity(requested);
    if (!live && requested.endsWith(".NS")) {
      live = await resolveYahooIdentity(requested.replace(/\.NS$/, ".BO"));
    }
    if (!live) {
      return NextResponse.json(
        {
          error: `No live quote for ${requested}. For BSE-only names like Aurique, search AURIQUE.BO (not .NS).`,
        },
        { status: 400 },
      );
    }
    ticker = live.ticker;
    displayName = live.name;
    sector = inferSector(null, live.name, ticker);
  }
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("watchlist_items")
    .upsert(
      {
        user_id: session.user.id,
        ticker,
        display_name: displayName,
        sector,
        reference_price: body.referencePrice ?? null,
      },
      { onConflict: "user_id,ticker" },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await clearVisitCache(session.user.id);
  return NextResponse.json({ item: data });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = patchSchema.parse(await req.json());
  const ticker = normalizeTicker(body.ticker);
  const patch: Record<string, unknown> = {};
  if (body.referencePrice !== undefined) patch.reference_price = body.referencePrice;
  if (body.muteDays !== undefined) {
    patch.muted_until =
      body.muteDays === 0
        ? null
        : new Date(Date.now() + body.muteDays * 86400000).toISOString();
  }
  const sb = getServiceSupabase();
  const { error } = await sb
    .from("watchlist_items")
    .update(patch)
    .eq("user_id", session.user.id)
    .eq("ticker", ticker);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await clearVisitCache(session.user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ticker = normalizeTicker(new URL(req.url).searchParams.get("ticker") ?? "");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const sb = getServiceSupabase();
  const { error } = await sb
    .from("watchlist_items")
    .delete()
    .eq("user_id", session.user.id)
    .eq("ticker", ticker);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await clearVisitCache(session.user.id);
  return NextResponse.json({ ok: true });
}
