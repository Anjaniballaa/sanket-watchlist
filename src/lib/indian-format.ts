export function formatInr(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (opts?.compact !== false) {
    if (abs >= 1_00_00_000) {
      return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
    }
    if (abs >= 1_00_000) {
      return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
    }
  }
  return `${sign}₹${abs.toLocaleString("en-IN", {
    maximumFractionDigits: abs >= 100 ? 2 : 2,
    minimumFractionDigits: 2,
  })}`;
}

export function formatVolume(shares: number): string {
  if (!Number.isFinite(shares)) return "—";
  const abs = Math.abs(shares);
  if (abs >= 1_00_00_000) return `${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(1)}K`;
  return abs.toLocaleString("en-IN");
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function relativeTime(iso: string | Date, now = new Date()): string {
  const t = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Math.max(0, now.getTime() - t.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
