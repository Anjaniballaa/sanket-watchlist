import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRight } from "lucide-react";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,179,134,0.18),_transparent_55%)]" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] font-semibold text-black">
            S
          </span>
          <span className="text-lg font-semibold tracking-tight">Sanket</span>
        </div>
        <ThemeToggle />
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-10 md:grid-cols-2 md:pt-20">
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-2)]">
            Code, by Groww · Smart Market Watchlist
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            Not what moved.
            <br />
            <span className="text-[var(--accent)]">What deserves you.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-[var(--muted)]">
            Sanket remembers the last price you actually saw. On return it scores each
            ticker against its own noise — volatility, unusual volume, level breaches,
            drift, and news — then says why, in one honest sentence.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
            className="mt-8"
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 font-medium text-black hover:opacity-90"
            >
              Sign in with Google
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-4 text-sm text-[var(--muted)]">
            NSE data via Yahoo Finance · delayed · never silently stale
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
          <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Since you last checked</p>
          <p className="mt-2 text-2xl font-semibold">3 names crossed your radar</p>
          <ul className="mt-6 space-y-4">
            {[
              {
                t: "RELIANCE",
                s: "Move is 2.4× its own 20-day noise, with volume 1.8× average.",
                tag: "price-inferred",
              },
              {
                t: "TCS",
                s: "Headline on deal wins, plus a drift of +1.1% since your last visit.",
                tag: "news-backed",
              },
              {
                t: "SBIN",
                s: "Quiet vs peers — muted from digest for 7 days if you want.",
                tag: "peer chip",
              },
            ].map((row) => (
              <li key={row.t} className="rounded-2xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{row.t}</span>
                  <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--accent-2)]">
                    {row.tag}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{row.s}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            Sample copy. Your digest is computed live from your last visit.
          </p>
        </div>
      </section>
    </main>
  );
}
