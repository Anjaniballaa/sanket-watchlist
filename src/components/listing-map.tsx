export function ListingMap({
  ticker,
  exchange,
}: {
  ticker: string;
  exchange: string | null;
}) {
  const venue = ticker.endsWith(".BO") ? "BSE" : "NSE";
  return (
    <div className="rounded-2xl border border-[var(--border)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Where it is listed</p>
      <p className="mt-1 text-sm">
        {exchange ?? venue} · Mumbai (Dalal Street / Bandra-Kurla). Pin is the exchange, not plants or offices.
      </p>
      <svg viewBox="0 0 200 240" className="mt-3 h-44 w-full text-[var(--accent)]" aria-label="India listing map">
        <path
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="1.2"
          d="M92 18c12 4 28 8 38 22 8 12 18 18 22 32 4 14-2 26 4 38 6 12 8 24 2 34-4 8 2 16 0 26-2 12-10 18-12 30-2 10-12 22-24 26-10 4-16 14-28 16-14 2-24-6-36-8-10-2-22 4-30-4-8-8-4-20-6-30-2-12-12-18-10-30 2-10 10-16 12-26 2-12-6-20 0-32 6-12 16-14 24-24 8-10 10-22 22-28 8-4 14-6 22-4z"
        />
        <circle cx="58" cy="148" r="6" fill="#00b386" />
        <circle cx="58" cy="148" r="11" fill="none" stroke="#00b386" strokeWidth="1.5" opacity="0.5" />
        <text x="72" y="144" fontSize="11" fill="currentColor">
          Mumbai
        </text>
        <text x="72" y="158" fontSize="9" fill="currentColor" opacity="0.7">
          {venue} cash market
        </text>
      </svg>
    </div>
  );
}
