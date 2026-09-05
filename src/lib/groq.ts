import { retryWithBackoff } from "./retry";

export type GroqFact = {
  ticker: string;
  displayName: string;
  score: number;
  reasons: string[];
  facts: {
    price: number;
    dayChangePct: number | null;
    volumeRatio: number | null;
    driftPct: number | null;
    headlines: string[];
  };
};

export type GroqLine = {
  ticker: string;
  sentence: string;
  confidence: "news_backed" | "price_inferred";
};

/**
 * Groq only phrases numbers we already computed. If the call fails,
 * callers must still render the numeric digest.
 */
export async function explainMoves(items: GroqFact[]): Promise<GroqLine[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key || items.length === 0) return [];

  const payload = items.map((i) => ({
    ticker: i.ticker,
    name: i.displayName,
    attentionScore: Number(i.score.toFixed(2)),
    reasons: i.reasons,
    facts: {
      ...i.facts,
      headlines: i.facts.headlines.slice(0, 3),
    },
  }));

  try {
    const json = await retryWithBackoff(
      async () => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You write one-sentence market explanations. Use ONLY the provided facts and numbers. Never invent prices, percentages, or headlines. Return JSON {\"explanations\":[{\"ticker\":\"...\",\"sentence\":\"...\"}]}.",
              },
              {
                role: "user",
                content: JSON.stringify(payload),
              },
            ],
          }),
        });
        if (!res.ok) throw new Error(`groq ${res.status}`);
        return (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
      },
      { attempts: 2, baseMs: 500, label: "groq" },
    );

    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      explanations?: Array<{ ticker?: string; sentence?: string }>;
    };
    return (parsed.explanations ?? [])
      .filter((e) => e.ticker && e.sentence)
      .map((e) => {
        const src = items.find((i) => i.ticker === e.ticker);
        const newsBacked = (src?.facts.headlines.length ?? 0) > 0;
        return {
          ticker: e.ticker as string,
          sentence: e.sentence as string,
          confidence: newsBacked ? "news_backed" : "price_inferred",
        };
      });
  } catch {
    return [];
  }
}
