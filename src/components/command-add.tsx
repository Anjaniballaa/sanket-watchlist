"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type Hit = { symbol: string; name: string; sector: string };

export function CommandAdd({ onAdd }: { onAdd: (ticker: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [extras, setExtras] = useState<Hit[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/watchlist?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results?: Hit[]; extras?: Hit[]; custom?: Hit | null };
      setHits(json.results ?? []);
      setExtras(json.extras ?? (json.custom ? [json.custom] : []));
    }, 120);
    return () => clearTimeout(t);
  }, [q, open]);

  const pick = async (symbol: string) => {
    setAdding(true);
    try {
      await onAdd(symbol);
      setOpen(false);
      setQ("");
    } finally {
      setAdding(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--accent)]"
      >
        <Search className="h-3.5 w-3.5" />
        Add ticker
        <kbd className="rounded bg-[var(--border)] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]" onClick={() => setOpen(false)}>
      <Command
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        shouldFilter={false}
      >
        <Command.Input
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder="Search list, or type any NSE symbol (IRFC, TATACHEM.NS)…"
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-base outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--muted)]">
            Type an NSE Yahoo symbol. We verify it live — nothing is hardcoded as a price.
          </Command.Empty>
          {extras.map((h) => (
            <Command.Item
              key={h.symbol}
              value={h.symbol}
              disabled={adding}
              onSelect={() => void pick(h.symbol)}
              className="mb-1 flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-[var(--accent)]/40 px-3 py-2 data-[selected=true]:bg-[var(--accent)]/15"
            >
              <span>
                <span className="font-medium">{h.symbol}</span>
                <span className="ml-2 text-sm text-[var(--muted)]">
                  {adding ? "Checking Yahoo…" : h.name}
                </span>
              </span>
              <span className="text-xs text-[var(--muted)]">{h.sector}</span>
            </Command.Item>
          ))}
          {hits.map((h) => (
            <Command.Item
              key={h.symbol}
              value={`${h.symbol} ${h.name}`}
              onSelect={() => void pick(h.symbol)}
              className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 data-[selected=true]:bg-[var(--accent)]/15"
            >
              <span>
                <span className="font-medium">{h.symbol.replace(".NS", "")}</span>
                <span className="ml-2 text-sm text-[var(--muted)]">{h.name}</span>
              </span>
              <span className="text-xs text-[var(--muted)]">{h.sector}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
