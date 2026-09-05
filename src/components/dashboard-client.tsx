"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, List, RefreshCw, Share2 } from "lucide-react";
import { CommandAdd } from "@/components/command-add";
import { Sparkline } from "@/components/sparkline";
import { TickerActions } from "@/components/ticker-actions";
import { CompanyPanel } from "@/components/company-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatInr, formatPct, formatVolume, relativeTime } from "@/lib/indian-format";
import type { DigestResponse, WatchlistRow } from "@/lib/digest";
import { cn } from "@/lib/cn";

type Props = { user: { name: string; email: string; image: string | null } };

export function DashboardClient({ user }: Props) {
  const [data, setData] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "heat">("list");
  const [error, setError] = useState<string | null>(null);
  const [openTicker, setOpenTicker] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/digest${force ? "?force=1" : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load digest");
      setData(json as DigestResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const addTicker = async (ticker: string) => {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Could not add");
      return;
    }
    toast.success(`Added ${ticker.replace(".NS", "")}`);
    await load(true);
  };

  const removeTicker = (row: WatchlistRow) => {
    const ticker = row.ticker;
    setData((d) => (d ? { ...d, rows: d.rows.filter((r) => r.ticker !== ticker) } : d));
    toast("Removed " + ticker.replace(".NS", ""), {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          void addTicker(ticker);
        },
      },
      onAutoClose: async () => {
        await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, { method: "DELETE" });
        await load(true);
      },
      onDismiss: async () => {
        await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, { method: "DELETE" });
      },
    });
  };

  const mute = async (ticker: string, days: number) => {
    const res = await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, muteDays: days }),
    });
    if (!res.ok) {
      toast.error("Could not update mute");
      return;
    }
    toast.success(days === 0 ? "Unmuted — back on the digest" : `Muted for ${days} days`);
    await load(true);
  };

  const setRef = async (ticker: string, referencePrice: number | null) => {
    const res = await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, referencePrice }),
    });
    if (!res.ok) {
      toast.error("Could not save note");
      return;
    }
    toast.success(referencePrice ? `Noted ₹${referencePrice}` : "Note cleared");
    await load(true);
  };

  const share = async () => {
    const res = await fetch("/api/share", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      toast.error("Share failed");
      return;
    }
    const url = `${window.location.origin}${json.url}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  };

  const maxScore = useMemo(
    () => Math.max(0.01, ...(data?.rows.map((r) => r.score) ?? [1])),
    [data],
  );
  const openRow = data?.rows.find((r) => r.ticker === openTicker) ?? null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--accent)] text-sm text-black">
              S
            </span>
            Sanket
          </Link>
          <div className="flex items-center gap-2">
            <CommandAdd onAdd={addTicker} />
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)]"
              title="Force refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)]"
              title="Share frozen digest"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <Link href="/settings" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              {user.name.split(" ")[0]}
            </Link>
          </div>
        </div>
        {data && (
          <div className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-2 text-center text-sm">
            <span className="font-medium">{data.market.label}</span>
            {data.dataAsOf && (
              <span className="text-[var(--muted)]">
                {" "}
                · digest {relativeTime(data.computedAt)} · data as of {relativeTime(data.dataAsOf)} IST
              </span>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <p className="mb-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Since you last checked</p>
            {loading && !data ? (
              <p className="mt-3 text-[var(--muted)]">Scoring your universe…</p>
            ) : !data?.rows.length ? (
              <div className="mt-3">
                <h2 className="text-2xl font-semibold">Your radar is empty</h2>
                <p className="mt-2 text-[var(--muted)]">
                  Press ⌘K and add NSE names. Scores appear after the first live snapshot — we
                  never fake a number.
                </p>
              </div>
            ) : data.quiet ? (
              <div className="mt-3">
                <h2 className="text-2xl font-semibold">Nothing significant since you last checked</h2>
                <p className="mt-2 text-[var(--muted)]">
                  Quiet-day badge on purpose. Moves stayed inside each stock&apos;s own noise band.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <h2 className="text-2xl font-semibold">
                  {data.flagged.length} name{data.flagged.length === 1 ? "" : "s"} deserve attention
                </h2>
                {data.flagged.map((f) => (
                  <article
                    key={f.ticker}
                    className="cursor-pointer rounded-2xl border border-[var(--border)] p-4 hover:border-[var(--accent)]"
                    onClick={() => setOpenTicker(f.ticker)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{f.displayName}</span>
                      <span className="font-mono text-sm text-[var(--muted)]">
                        {f.ticker.replace(".NS", "")}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                          f.confidence === "news_backed"
                            ? "bg-[var(--accent)]/15 text-[var(--accent-2)]"
                            : "bg-[var(--border)] text-[var(--muted)]",
                        )}
                      >
                        {f.confidence === "news_backed" ? "news-backed" : "price-inferred"}
                      </span>
                      {f.firstFlag && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase text-amber-700 dark:text-amber-300">
                          first time on your radar
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{f.sentence}</p>
                    <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                      {formatInr(f.price)} · {formatPct(f.dayChangePct ?? 0)} vs close
                      {f.fromReferencePct !== null && (
                        <> · {formatPct(f.fromReferencePct)} from your noted price</>
                      )}
                      {" · "}score {f.score.toFixed(2)}
                    </p>
                    <ScoreBars breakdown={f.breakdown} />
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Check-in streak</p>
            <p className="mt-3 text-4xl font-semibold">{data?.quietStreak ?? 0}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">quiet check-ins in a row</p>
            <p className="mt-6 text-sm text-[var(--muted)]">
              Overchecking doesn&apos;t make a portfolio wiser. Sanket only pings when the composite
              score clears your threshold.
            </p>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Watchlist</h3>
          <p className="text-xs text-[var(--muted)]">Click a name for the full company file</p>
          <div className="flex rounded-full border border-[var(--border)] p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn("rounded-full p-2", view === "list" && "bg-[var(--accent)] text-black")}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("heat")}
              className={cn("rounded-full p-2", view === "heat" && "bg-[var(--accent)] text-black")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {view === "heat" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(data?.rows ?? []).map((row) => {
              const intensity = Math.min(1, row.score / maxScore);
              return (
                <div
                  key={row.ticker}
                  className="cursor-pointer rounded-2xl p-4 text-black"
                  onClick={() => setOpenTicker(row.ticker)}
                  style={{
                    background: `color-mix(in srgb, var(--heat) ${20 + intensity * 70}%, #0c1c16)`,
                    color: intensity > 0.45 ? "#04110c" : "var(--foreground)",
                  }}
                >
                  <p className="text-xs opacity-80">{row.ticker.replace(".NS", "")}</p>
                  <p className="text-lg font-semibold">{formatInr(row.price)}</p>
                  <p className="text-xs">attention {row.score.toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[var(--card)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-3">Ticker</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Day</th>
                  <th className="px-3 py-3">Volume</th>
                  <th className="px-3 py-3">Spark</th>
                  <th className="px-3 py-3">Attention</th>
                  <th className="px-3 py-3">Sector</th>
                  <th className="px-3 py-3">As of</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row) => {
                  const up = (row.dayChangePct ?? 0) >= 0;
                  return (
                    <tr
                      key={row.ticker}
                      className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--accent)]/5"
                      onClick={() => setOpenTicker(row.ticker)}
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium">{row.displayName}</div>
                        <div className="font-mono text-xs text-[var(--muted)]">
                          {row.ticker.replace(".NS", "")}
                          {row.muted && " · muted"}
                          {row.firstFlag && " · first flag"}
                        </div>
                        {row.fromReferencePct !== null && (
                          <div className="text-xs text-[var(--accent-2)]">
                            {formatPct(row.fromReferencePct)} from your noted{" "}
                            {formatInr(row.referencePrice ?? 0)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono">{formatInr(row.price)}</td>
                      <td className={cn("px-3 py-3 font-mono", up ? "text-[var(--accent-2)]" : "text-[var(--danger)]")}>
                        {formatPct(row.dayChangePct ?? 0)}
                      </td>
                      <td className="px-3 py-3 font-mono">{formatVolume(row.volume ?? 0)}</td>
                      <td className="px-3 py-3">
                        <Sparkline data={row.sparkline} up={up} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono">{row.enoughHistory ? row.score.toFixed(2) : "—"}</div>
                        {!row.enoughHistory && (
                          <div className="text-[10px] text-[var(--muted)]">not enough history yet</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
                          {row.sector}
                          {row.vsSectorPct !== null && (
                            <> · {formatPct(row.vsSectorPct)} vs peers</>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted)]">
                        {relativeTime(row.asOf)}
                        {row.stale && (
                          <span className="ml-1 rounded bg-amber-500/20 px-1 uppercase">stale</span>
                        )}
                        <div className="text-[10px]">may be delayed</div>
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <TickerActions row={row} onSaveNote={setRef} onMute={mute} />
                        <button
                          type="button"
                          className="mt-1 text-xs text-[var(--danger)]"
                          onClick={() => removeTicker(row)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      {openRow && (
        <CompanyPanel
          row={openRow}
          onClose={() => setOpenTicker(null)}
          onSaveNote={setRef}
          onMute={mute}
        />
      )}
    </div>
  );
}

function ScoreBars({
  breakdown,
}: {
  breakdown: WatchlistRow["breakdown"];
}) {
  const items = [
    ["vs noise", breakdown.volAdjustedMove],
    ["volume", Math.max(0, breakdown.unusualVolume)],
    ["breach", breakdown.breach],
    ["drift", breakdown.drift],
    ["news", breakdown.news],
  ] as const;
  const max = Math.max(1, ...items.map(([, v]) => v));
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {items.map(([label, v]) => (
        <div key={label}>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${Math.min(100, (v / max) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-[var(--muted)]">{label}</p>
        </div>
      ))}
    </div>
  );
}
