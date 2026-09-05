export type ScoreWeights = {
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  w5: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  w1: 1.0,
  w2: 0.55,
  w3: 0.85,
  w4: 0.65,
  w5: 0.7,
};

export const DEFAULT_THRESHOLD = 1.15;

export type HeadlineFact = {
  headline: string;
  publishedAt: string;
  url?: string;
};

export type ScoreInput = {
  price: number;
  previousClose: number | null;
  lastSeenPrice: number | null;
  dailyCloses: number[];
  dailyVolumes: number[];
  volumeToday: number | null;
  high52w: number | null;
  low52w: number | null;
  headlines: HeadlineFact[];
  nowMs: number;
};

export type ScoreBreakdown = {
  volAdjustedMove: number;
  unusualVolume: number;
  breach: number;
  drift: number;
  news: number;
  gap: number;
};

export type SignificanceResult = {
  score: number;
  breakdown: ScoreBreakdown;
  flagged: boolean;
  reasons: string[];
  eventTypes: string[];
  newsRelevance: number;
};

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev > 0 && cur > 0) out.push((cur - prev) / prev);
  }
  return out;
}

function crossedRound(from: number, to: number): boolean {
  const levels = [50, 100, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 5000, 10000];
  for (const level of levels) {
    if ((from - level) * (to - level) < 0) return true;
  }
  return false;
}

function newsRelevance(headlines: HeadlineFact[], nowMs: number): number {
  if (!headlines.length) return 0;
  let acc = 0;
  for (const h of headlines) {
    const ageH = (nowMs - new Date(h.publishedAt).getTime()) / 3_600_000;
    if (!Number.isFinite(ageH) || ageH > 72) continue;
    acc += Math.max(0, 1 - ageH / 72);
  }
  return Math.min(1.5, acc);
}

/**
 * Pure significance engine. No I/O. Pass facts in, get a score out.
 * Judges: this is the product — attention vs the stock's own noise,
 * not a raw % ticker.
 */
export function computeSignificance(
  input: ScoreInput,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  threshold = DEFAULT_THRESHOLD,
): SignificanceResult {
  const reasons: string[] = [];
  const eventTypes: string[] = [];

  const returns = dailyReturns(input.dailyCloses.filter((n) => n > 0));
  const rollingVol = stdev(returns.slice(-20));
  const safeVol = Math.max(rollingVol, 0.004);

  const dayMove =
    input.previousClose && input.previousClose > 0
      ? (input.price - input.previousClose) / input.previousClose
      : 0;
  const volAdjustedMove = Math.abs(dayMove) / safeVol;

  const avgVol20 =
    input.dailyVolumes.slice(-20).filter((v) => v > 0).reduce((a, b) => a + b, 0) /
    Math.max(1, input.dailyVolumes.slice(-20).filter((v) => v > 0).length);
  const unusualVolume =
    input.volumeToday && avgVol20 > 0 ? input.volumeToday / avgVol20 - 1 : 0;
  const unusualVolumeClamped = Math.max(-0.5, Math.min(3, unusualVolume));

  let breach = 0;
  if (input.high52w && input.price >= input.high52w * 0.995) {
    breach = 1;
    reasons.push("near/at 52-week high");
    eventTypes.push("52w_high");
  } else if (input.low52w && input.price <= input.low52w * 1.005) {
    breach = 1;
    reasons.push("near/at 52-week low");
    eventTypes.push("52w_low");
  }
  const refForRound = input.lastSeenPrice ?? input.previousClose;
  if (refForRound && crossedRound(refForRound, input.price)) {
    breach = Math.max(breach, 0.85);
    reasons.push("crossed a round number");
    eventTypes.push("round_number");
  }

  const drift =
    input.lastSeenPrice && input.lastSeenPrice > 0
      ? (input.price - input.lastSeenPrice) / input.lastSeenPrice
      : 0;
  const driftAbs = Math.abs(drift) / safeVol;

  const news = newsRelevance(input.headlines, input.nowMs);
  if (news > 0.2) {
    reasons.push("fresh headline");
    eventTypes.push("news");
  }
  if (unusualVolume > 0.6) {
    reasons.push("unusual volume");
    eventTypes.push("volume_spike");
  }
  if (driftAbs > 1) {
    reasons.push("accumulated drift since last visit");
    eventTypes.push("drift");
  }

  const gap =
    input.previousClose && input.previousClose > 0 && input.dailyCloses.length >= 2
      ? Math.abs(dayMove) / safeVol > 1.4
        ? Math.abs(dayMove) / safeVol
        : 0
      : 0;
  if (gap > 1.4) reasons.push("gap vs typical noise");

  if (Math.abs(dayMove) > 0.01) {
    reasons.push(`${(dayMove * 100).toFixed(2)}% vs prior close`);
  }

  const breakdown: ScoreBreakdown = {
    volAdjustedMove,
    unusualVolume: unusualVolumeClamped,
    breach,
    drift: driftAbs,
    news,
    gap,
  };

  const score =
    weights.w1 * volAdjustedMove +
    weights.w2 * Math.max(0, unusualVolumeClamped) +
    weights.w3 * breach +
    weights.w4 * driftAbs +
    weights.w5 * news;

  const core =
    weights.w1 * volAdjustedMove +
    weights.w2 * Math.max(0, unusualVolumeClamped) +
    weights.w3 * breach +
    weights.w4 * driftAbs;
  // News confirms a market signal. It must not flag a quiet tape by itself.
  const priceLed =
    core >= threshold * 0.5 ||
    volAdjustedMove >= 1.2 ||
    unusualVolume > 0.6 ||
    breach > 0;

  return {
    score,
    breakdown,
    flagged: score >= threshold && priceLed,
    reasons,
    eventTypes: eventTypes.length ? eventTypes : ["price_move"],
    newsRelevance: news,
  };
}
