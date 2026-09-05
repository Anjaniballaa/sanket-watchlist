/** NSE cash-market hours in IST, Mon–Fri 9:15–15:30. */
export type MarketPhase = "pre_market" | "open" | "closed";

export function nowInIst(date = new Date()): Date {
  const s = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(s);
}

export function getMarketStatus(date = new Date()): {
  phase: MarketPhase;
  label: string;
  isOpen: boolean;
} {
  const ist = nowInIst(date);
  const day = ist.getDay();
  const mins = ist.getHours() * 60 + ist.getMinutes();
  const open = 9 * 60 + 15;
  const close = 15 * 60 + 30;
  const weekday = day >= 1 && day <= 5;

  if (!weekday || mins >= close) {
    return {
      phase: "closed",
      label: "Market closed — showing last close",
      isOpen: false,
    };
  }
  if (mins < open) {
    return {
      phase: "pre_market",
      label: "Pre-market — last close until 9:15 IST",
      isOpen: false,
    };
  }
  return { phase: "open", label: "Market open", isOpen: true };
}

/** 5-minute window used so cron re-runs do not duplicate snapshots. */
export function snapshotWindow(date = new Date()): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  d.setMinutes(m - (m % 5));
  return d;
}

export function expectedStaleMs(isOpen: boolean): number {
  return isOpen ? 8 * 60 * 1000 : 18 * 60 * 60 * 1000;
}
