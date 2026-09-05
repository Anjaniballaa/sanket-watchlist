"use client";

import { useMemo, useState } from "react";
import { formatInr, formatPct } from "@/lib/indian-format";
import type { WatchlistRow } from "@/lib/digest";

type Props = {
  row: WatchlistRow;
  onSaveNote: (ticker: string, price: number | null) => Promise<void>;
  onMute: (ticker: string, days: number) => Promise<void>;
};

export function TickerActions({ row, onSaveNote, onMute }: Props) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(row.referencePrice?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  const parsed = Number(draft.replace(/,/g, ""));
  const preview = useMemo(() => {
    if (!Number.isFinite(parsed) || parsed <= 0 || !row.price) return null;
    return ((row.price - parsed) / parsed) * 100;
  }, [parsed, row.price]);

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs hover:border-[var(--accent)]"
          onClick={() => {
            setDraft(row.referencePrice?.toString() ?? (row.price ? String(row.price) : ""));
            setNoteOpen(true);
          }}
        >
          {row.referencePrice ? "Edit note" : "Note price"}
        </button>
        {row.muted ? (
          <button
            type="button"
            className="rounded-full border border-[var(--accent)]/40 px-2 py-0.5 text-xs text-[var(--accent-2)]"
            onClick={() => void onMute(row.ticker, 0)}
          >
            Unmute
          </button>
        ) : (
          <button
            type="button"
            className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs hover:border-[var(--accent)]"
            onClick={() => void onMute(row.ticker, 7)}
          >
            Mute 7d
          </button>
        )}
      </div>
      {row.muted && row.mutedUntil && (
        <p className="mt-1 text-right text-[10px] text-[var(--muted)]">
          muted until {new Date(row.mutedUntil).toLocaleDateString("en-IN")}
        </p>
      )}

      {noteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setNoteOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Note a price</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {row.displayName} · last {formatInr(row.price, { compact: false })}. Entry, target, or
              alert — not a broker order.
            </p>
            <label className="mt-4 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Your noted ₹
            </label>
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-lg outline-none focus:border-[var(--accent)]"
              placeholder="e.g. 2340"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="text-xs text-[var(--accent-2)]"
                onClick={() => setDraft(String(row.price))}
              >
                Use last close
              </button>
            </div>
            {preview !== null && (
              <p className="mt-3 text-sm">
                Last is {formatPct(preview)} from your note of {formatInr(parsed, { compact: false })}.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              {row.referencePrice !== null && (
                <button
                  type="button"
                  className="text-sm text-[var(--muted)]"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onSaveNote(row.ticker, null);
                    setBusy(false);
                    setNoteOpen(false);
                  }}
                >
                  Clear
                </button>
              )}
              <button type="button" className="text-sm" onClick={() => setNoteOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !Number.isFinite(parsed) || parsed <= 0}
                className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-black disabled:opacity-40"
                onClick={async () => {
                  setBusy(true);
                  await onSaveNote(row.ticker, parsed);
                  setBusy(false);
                  setNoteOpen(false);
                }}
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
