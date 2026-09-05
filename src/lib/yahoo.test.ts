import { describe, expect, it } from "vitest";
import { resolvePreviousClose } from "./yahoo";

describe("resolvePreviousClose", () => {
  it("uses yesterday's daily close after hours, not the 1y chartPreviousClose", () => {
    const closes = [3095.7, 2400, 2320.1, 2304];
    expect(resolvePreviousClose(2304, closes, null)).toBe(2320.1);
  });

  it("prefers Yahoo previousClose when present", () => {
    expect(resolvePreviousClose(2304, [2320, 2304], 2310)).toBe(2310);
  });
});
