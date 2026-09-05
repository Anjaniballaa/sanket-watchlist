import { retryWithBackoff } from "./retry";
import { getServiceSupabase } from "./supabase";
import type { HeadlineFact } from "./significance";

type GNewsJson = {
  articles?: Array<{ title?: string; url?: string; publishedAt?: string }>;
};

type NewsApiJson = {
  articles?: Array<{ title?: string; url?: string; publishedAt?: string }>;
};

function companyQuery(ticker: string, name?: string): string {
  const root = ticker.replace(/\.NS$/i, "").replace(/-/g, " ");
  return name ? `"${name}"` : root;
}

export function headlineMatchesTicker(
  ticker: string,
  name: string | undefined,
  headline: string,
): boolean {
  const h = headline.toLowerCase();
  const root = ticker.replace(/\.NS$/i, "").toLowerCase();
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`, "i").test(headline)) return true;
  if (name && name.length > 3 && h.includes(name.toLowerCase())) return true;
  return false;
}

async function fromGnews(q: string): Promise<HeadlineFact[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return [];
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&country=in&max=5&token=${key}`;
  const json = await retryWithBackoff(
    async () => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`gnews ${res.status}`);
      return (await res.json()) as GNewsJson;
    },
    { attempts: 2, label: "gnews" },
  );
  return (json.articles ?? [])
    .filter((a) => a.title && a.publishedAt)
    .map((a) => ({
      headline: a.title as string,
      publishedAt: a.publishedAt as string,
      url: a.url,
    }));
}

async function fromNewsApi(q: string): Promise<HeadlineFact[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=5`;
  const json = await retryWithBackoff(
    async () => {
      const res = await fetch(url, {
        headers: { "X-Api-Key": key },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`newsapi ${res.status}`);
      return (await res.json()) as NewsApiJson;
    },
    { attempts: 2, label: "newsapi" },
  );
  return (json.articles ?? [])
    .filter((a) => a.title && a.publishedAt)
    .map((a) => ({
      headline: a.title as string,
      publishedAt: a.publishedAt as string,
      url: a.url,
    }));
}

export type CachedHeadline = HeadlineFact & { url?: string };

export async function getHeadlines(
  ticker: string,
  displayName?: string,
): Promise<CachedHeadline[]> {
  const sb = getServiceSupabase();
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await sb
    .from("news_cache")
    .select("headline,url,published_at")
    .eq("ticker", ticker)
    .gte("fetched_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(5);

  if (existing && existing.length > 0) {
    return existing.map((r) => ({
      headline: r.headline as string,
      publishedAt: r.published_at as string,
      url: (r.url as string) ?? undefined,
    }));
  }

  const q = companyQuery(ticker, displayName);
  let articles: CachedHeadline[] = [];
  try {
    articles = await fromGnews(q);
  } catch {
    articles = [];
  }
  if (!articles.length) {
    try {
      articles = await fromNewsApi(q);
    } catch {
      articles = [];
    }
  }

  if (articles.length) {
    await sb.from("news_cache").insert(
      articles.map((a) => ({
        ticker,
        headline: a.headline,
        url: a.url ?? null,
        published_at: a.publishedAt,
      })),
    );
  }
  return articles;
}
