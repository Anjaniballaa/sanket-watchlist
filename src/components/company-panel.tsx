"use client";

import { useEffect, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { X } from "lucide-react";
import { formatInr, formatPct, formatVolume, relativeTime } from "@/lib/indian-format";
import type { WatchlistRow } from "@/lib/digest";
import { TickerActions } from "@/components/ticker-actions";
import { ListingMap } from "@/components/listing-map";
import { cn } from "@/lib/cn";

type Detail = {
  ticker: string;
  displayName: string;
  sector: string;
  exchange: string | null;
  quote: {
    price: number;
    previousClose: number | null;
    open: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    volume: number | null;
    high52w: number | null;
    low52w: number | null;
    asOf: string;
    stale: boolean;
    source: string;
    currency: string;
  };
  derived: {
    dayChangePct: number | null;
    fromOpenPct: number | null;
    range52: number | null;
    fromHigh52: number | null;
    fromLow52: number | null;
    avgVol20: number;
    volumeVsAvg: number | null;
    avgClose20: number;
    avgClose50: number;
    vsSma20: number | null;
    vsSma50: number | null;
    driftPct: number | null;
    fromNote: number | null;
  };
  chart: Array<{ t: number; close: number; volume: number; high: number | null; low: number | null; open?: number | null }>;
  headlines: Array<{ headline: string; publishedAt: string; url?: string }>;
  lastSeen: { price: number | null; at: string | null; firstFlaggedAt: string | null; quietStreak: number };
  note: number | null;
  events: Array<{ event_type: string; score: number; summary: string | null; confidence: string | null; created_at: string }>;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-mono text-sm">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function CompanyPanel({
  row,
  onClose,
  onSaveNote,
  onMute,
}: {
  row: WatchlistRow;
  onClose: () => void;
  onSaveNote: (ticker: string, price: number | null) => Promise<void>;
  onMute: (ticker: string, days: number) => Promise<void>;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    void (async () => {
      const res = await fetch(`/api/ticker?symbol=${encodeURIComponent(row.ticker)}&force=1`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!live) return;
      if (!res.ok) {
        setError(json.error ?? "Could not load details");
        setLoading(false);
        return;
      }
      setDetail(json as Detail);
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [row.ticker]);

  const up = (detail?.derived.dayChangePct ?? row.dayChangePct ?? 0) >= 0;
  const q = detail?.quote;
  const d = detail?.derived;
  const chart = (detail?.chart ?? []).map((p, i, arr) => {
    const sma = (n: number) => {
      const slice = arr.slice(Math.max(0, i - (n - 1)), i + 1);
      return slice.reduce((a, b) => a + b.close, 0) / slice.length;
    };
    return {
      ...p,
      label: new Date(p.t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      sma20: sma(20),
      sma50: sma(50),
    };
  });
  const uniqueEvents = (detail?.events ?? []).filter((e, i, arr) => {
    const day = e.created_at.slice(0, 10);
    return arr.findIndex((x) => x.event_type === e.event_type && x.created_at.slice(0, 10) === day) === i;
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Company file</p>
            <h2 className="mt-1 text-2xl font-semibold">{detail?.displayName ?? row.displayName}</h2>
            <p className="font-mono text-sm text-[var(--muted)]">
              {row.ticker} · {detail?.sector ?? row.sector}
              {detail?.exchange ? ` · ${detail.exchange}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className={cn("mt-4 font-mono text-4xl", up ? "text-[var(--accent-2)]" : "text-[var(--danger)]")}>
          {formatInr(q?.price ?? row.price, { compact: false })}
          <span className="ml-2 text-lg">
            {formatPct(d?.dayChangePct ?? row.dayChangePct ?? 0)}
          </span>
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          as of {relativeTime(q?.asOf ?? row.asOf)} · {q?.source ?? row.source}
          {q?.stale || row.stale ? " · stale fallback" : ""} · delayed feed
        </p>

        {row.sentence && <p className="mt-4 rounded-2xl border border-[var(--border)] p-3 text-sm">{row.sentence}</p>}
        {row.reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {row.reasons.map((r) => (
              <span key={r} className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                {r}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Price · 20d / 50d averages</p>
          <div className="h-56 rounded-2xl border border-[var(--border)] p-2">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={44} />
                  <Tooltip
                    formatter={(v, name) => [
                      formatInr(Number(v), { compact: false }),
                      String(name),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    name="Close"
                    stroke={up ? "#00b386" : "#e11d48"}
                    fill={up ? "rgba(0,179,134,0.12)" : "rgba(225,29,72,0.1)"}
                    strokeWidth={2}
                  />
                  <Line type="monotone" dataKey="sma20" name="20d avg" stroke="#94a3b8" strokeWidth={1.2} dot={false} />
                  <Line type="monotone" dataKey="sma50" name="50d avg" stroke="#64748b" strokeWidth={1.2} dot={false} strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="grid h-full place-items-center text-sm text-[var(--muted)]">
                {loading ? "Loading chart…" : "No chart history"}
              </p>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Daily volume</p>
          <div className="h-28 rounded-2xl border border-[var(--border)] p-2">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart}>
                  <XAxis dataKey="label" hide />
                  <YAxis hide />
                  <Tooltip formatter={(v) => formatVolume(Number(v))} />
                  <Bar dataKey="volume" name="Volume" fill="#00b386" fillOpacity={0.55} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          <Stat label="Previous close" value={formatInr(q?.previousClose ?? row.previousClose ?? 0, { compact: false })} />
          <Stat label="Open" value={q?.open ? formatInr(q.open, { compact: false }) : "—"} hint={d?.fromOpenPct != null ? formatPct(d.fromOpenPct) + " vs open" : undefined} />
          <Stat label="Day high" value={q?.dayHigh ? formatInr(q.dayHigh, { compact: false }) : "—"} />
          <Stat label="Day low" value={q?.dayLow ? formatInr(q.dayLow, { compact: false }) : "—"} />
          <Stat label="Volume" value={formatVolume(q?.volume ?? row.volume ?? 0)} hint={d?.volumeVsAvg != null ? `${d.volumeVsAvg.toFixed(2)}× 20d avg` : undefined} />
          <Stat label="20d avg vol" value={d ? formatVolume(d.avgVol20) : "—"} />
          <Stat label="52w high" value={q?.high52w ? formatInr(q.high52w, { compact: false }) : "—"} hint={d?.fromHigh52 != null ? formatPct(d.fromHigh52) : undefined} />
          <Stat label="52w low" value={q?.low52w ? formatInr(q.low52w, { compact: false }) : "—"} hint={d?.fromLow52 != null ? formatPct(d.fromLow52) : undefined} />
          <Stat label="vs 20d avg" value={d?.vsSma20 != null ? formatPct(d.vsSma20) : "—"} />
          <Stat label="vs 50d avg" value={d?.vsSma50 != null ? formatPct(d.vsSma50) : "—"} />
          <Stat label="Attention" value={row.enoughHistory ? row.score.toFixed(2) : "n/a"} hint={row.flagged ? "flagged" : "below threshold"} />
          <Stat
            label="Peer / sector"
            value={row.vsSectorPct != null ? formatPct(row.vsSectorPct) : row.sector}
            hint={row.sectorAvgChangePct != null ? `sector ${formatPct(row.sectorAvgChangePct)}` : "no peer set"}
          />
        </div>

        {d?.range52 != null && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Where it sits in the 52-week range</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, Math.max(0, d.range52))}%` }} />
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{d.range52.toFixed(0)}% of the way from 52w low to high</p>
          </div>
        )}

        <div className="mt-4">
          <ListingMap ticker={row.ticker} exchange={detail?.exchange ?? null} />
        </div>

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Why the engine scored this</p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {(
              [
                ["vs noise", row.breakdown.volAdjustedMove],
                ["volume", Math.max(0, row.breakdown.unusualVolume)],
                ["breach", row.breakdown.breach],
                ["drift", row.breakdown.drift],
                ["news", row.breakdown.news],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${Math.min(100, (v / Math.max(1, row.score)) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[var(--muted)]">{label}</p>
                <p className="font-mono text-[10px]">{v.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Since you last saw it</p>
          <p className="mt-1 text-sm">
            Last seen {detail?.lastSeen.price ? formatInr(detail.lastSeen.price, { compact: false }) : "—"}
            {detail?.lastSeen.at ? ` · ${relativeTime(detail.lastSeen.at)}` : ""}
          </p>
          <p className="text-sm text-[var(--muted)]">
            Drift {d?.driftPct != null ? formatPct(d.driftPct) : "n/a"}
            {d?.fromNote != null ? ` · ${formatPct(d.fromNote)} vs your noted price` : " · no personal note yet"}
          </p>
        </div>

        <div className="mt-4">
          <TickerActions row={row} onSaveNote={onSaveNote} onMute={onMute} />
        </div>

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Headlines</p>
          {loading && !detail ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Fetching news…</p>
          ) : !detail?.headlines.length ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No ticker-matched headlines in cache.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {detail.headlines.map((h) => (
                <li key={h.headline} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                  {h.url ? (
                    <a href={h.url} target="_blank" rel="noreferrer" className="hover:text-[var(--accent-2)]">
                      {h.headline}
                    </a>
                  ) : (
                    h.headline
                  )}
                  <p className="mt-1 text-[10px] text-[var(--muted)]">{relativeTime(h.publishedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 pb-8">
          <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Recent engine events</p>
          {!uniqueEvents.length ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No stored flags yet for this name.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {uniqueEvents.map((e, i) => (
                <li key={`${e.created_at}-${i}`} className="text-sm text-[var(--muted)]">
                  <span className="font-medium text-[var(--foreground)]">{e.event_type}</span>
                  {e.summary ? ` · ${e.summary}` : ""} · score {Number(e.score).toFixed(2)} ·{" "}
                  {relativeTime(e.created_at)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
