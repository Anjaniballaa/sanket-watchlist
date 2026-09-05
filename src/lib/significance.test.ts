import { describe, expect, it } from "vitest";
import { computeSignificance, DEFAULT_WEIGHTS } from "./significance";

const baseCloses = [
  100, 101, 100.5, 101.2, 100.8, 101, 101.4, 100.9, 101.1, 101.3, 100.7, 101.2,
  101.5, 101.1, 100.9, 101.4, 101.6, 101.2, 101.5, 101.3, 101.4,
];
const baseVols = Array.from({ length: 21 }, () => 1_000_000);

describe("computeSignificance", () => {
  it("stays quiet on a normal day with no last-seen gap", () => {
    const r = computeSignificance({
      price: 101.5,
      previousClose: 101.4,
      lastSeenPrice: 101.4,
      dailyCloses: baseCloses,
      dailyVolumes: baseVols,
      volumeToday: 1_050_000,
      high52w: 120,
      low52w: 80,
      headlines: [],
      nowMs: Date.now(),
    });
    expect(r.flagged).toBe(false);
    expect(r.score).toBeLessThan(1.15);
  });

  it("flags a move large vs own volatility plus volume spike", () => {
    const r = computeSignificance({
      price: 112,
      previousClose: 101.4,
      lastSeenPrice: 101.4,
      dailyCloses: baseCloses,
      dailyVolumes: baseVols,
      volumeToday: 3_200_000,
      high52w: 120,
      low52w: 80,
      headlines: [],
      nowMs: Date.now(),
    });
    expect(r.flagged).toBe(true);
    expect(r.breakdown.volAdjustedMove).toBeGreaterThan(2);
    expect(r.eventTypes).toContain("volume_spike");
  });

  it("flags 52-week high breach", () => {
    const r = computeSignificance({
      price: 119.8,
      previousClose: 118,
      lastSeenPrice: 118,
      dailyCloses: [...baseCloses.slice(0, -1), 118],
      dailyVolumes: baseVols,
      volumeToday: 1_100_000,
      high52w: 120,
      low52w: 80,
      headlines: [],
      nowMs: Date.now(),
    });
    expect(r.eventTypes).toContain("52w_high");
    expect(r.breakdown.breach).toBeGreaterThan(0);
  });

  it("raises news component only for recent headlines", () => {
    const now = Date.parse("2026-09-04T10:00:00+05:30");
    const r = computeSignificance(
      {
        price: 102,
        previousClose: 101.4,
        lastSeenPrice: 101.4,
        dailyCloses: baseCloses,
        dailyVolumes: baseVols,
        volumeToday: 1_000_000,
        high52w: 120,
        low52w: 80,
        headlines: [
          { headline: "Board clears buyback", publishedAt: "2026-09-04T06:00:00+05:30" },
        ],
        nowMs: now,
      },
      DEFAULT_WEIGHTS,
      99,
    );
    expect(r.newsRelevance).toBeGreaterThan(0.5);
    const old = computeSignificance(
      {
        price: 102,
        previousClose: 101.4,
        lastSeenPrice: 101.4,
        dailyCloses: baseCloses,
        dailyVolumes: baseVols,
        volumeToday: 1_000_000,
        high52w: 120,
        low52w: 80,
        headlines: [
          { headline: "Old filing", publishedAt: "2026-01-01T00:00:00+05:30" },
        ],
        nowMs: now,
      },
      DEFAULT_WEIGHTS,
      99,
    );
    expect(old.newsRelevance).toBe(0);
  });

  it("does not flag a quiet tape just because a headline exists", () => {
    const now = Date.parse("2026-09-04T10:00:00+05:30");
    const r = computeSignificance({
      price: 101.5,
      previousClose: 101.4,
      lastSeenPrice: 101.4,
      dailyCloses: baseCloses,
      dailyVolumes: baseVols,
      volumeToday: 1_000_000,
      high52w: 120,
      low52w: 80,
      headlines: [{ headline: "Analyst reiterates view", publishedAt: "2026-09-04T06:00:00+05:30" }],
      nowMs: now,
    });
    expect(r.newsRelevance).toBeGreaterThan(0.2);
    expect(r.flagged).toBe(false);
  });

  it("does not invent flags when history is empty", () => {
    const r = computeSignificance({
      price: 100,
      previousClose: null,
      lastSeenPrice: null,
      dailyCloses: [],
      dailyVolumes: [],
      volumeToday: null,
      high52w: null,
      low52w: null,
      headlines: [],
      nowMs: Date.now(),
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.score)).toBe(true);
  });
});
