import { getServiceSupabase } from "@/lib/supabase";
import { formatInr, formatPct, relativeTime } from "@/lib/indian-format";
import type { DigestResponse } from "@/lib/digest";
import { notFound } from "next/navigation";

type SharePayload = DigestResponse & { ownerName?: string; frozenAt?: string };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = getServiceSupabase();
  const { data } = await sb.from("digest_shares").select("payload").eq("token", token).maybeSingle();
  if (!data) notFound();
  const digest = data.payload as SharePayload;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Frozen Sanket digest</p>
      <h1 className="mt-2 text-3xl font-semibold">{digest.ownerName ?? "Investor"}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Snapshot {digest.frozenAt ? relativeTime(digest.frozenAt) : ""} · read-only · no login
      </p>
      {digest.quiet ? (
        <p className="mt-8 text-xl">Nothing significant since last check.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {digest.flagged.map((f) => (
            <li key={f.ticker} className="rounded-2xl border border-[var(--border)] p-4">
              <div className="flex justify-between">
                <span className="font-semibold">{f.displayName}</span>
                <span className="text-xs uppercase text-[var(--muted)]">{f.confidence.replace("_", "-")}</span>
              </div>
              <p className="mt-2 text-sm">{f.sentence}</p>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                {formatInr(f.price)} · {formatPct(f.dayChangePct ?? 0)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
