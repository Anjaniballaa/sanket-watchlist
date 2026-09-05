"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_THRESHOLD, DEFAULT_WEIGHTS } from "@/lib/significance";

type Weights = typeof DEFAULT_WEIGHTS & { threshold: number };

const labels: { key: keyof Weights; name: string; hint: string }[] = [
  { key: "w1", name: "Move vs own noise", hint: "|day change| / 20-day volatility" },
  { key: "w2", name: "Unusual volume", hint: "today / 20-day average − 1" },
  { key: "w3", name: "Level breach", hint: "52w high/low or round number" },
  { key: "w4", name: "Drift since last visit", hint: "accumulated move you haven't seen" },
  { key: "w5", name: "News relevance", hint: "recency-weighted headlines" },
  { key: "threshold", name: "Flag threshold", hint: "below this = quiet day" },
];

export function SettingsForm() {
  const [w, setW] = useState<Weights>({ ...DEFAULT_WEIGHTS, threshold: DEFAULT_THRESHOLD });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.weights) setW(json.weights);
    })();
  }, []);

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(w),
        });
        setSaving(false);
        if (!res.ok) toast.error("Could not save");
        else toast.success("Sensitivity saved — next visit uses these weights");
      }}
    >
      {labels.map((l) => (
        <label key={l.key} className="block">
          <div className="mb-1 flex justify-between text-sm">
            <span>{l.name}</span>
            <span className="font-mono">{w[l.key].toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={l.key === "threshold" ? 3 : 2}
            step={0.05}
            value={w[l.key]}
            onChange={(e) => setW({ ...w, [l.key]: Number(e.target.value) })}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-xs text-[var(--muted)]">{l.hint}</p>
        </label>
      ))}
      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-black"
      >
        {saving ? "Saving…" : "Save weights"}
      </button>
    </form>
  );
}
