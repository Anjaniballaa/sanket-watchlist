export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 250;
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) break;
      const wait = baseMs * 2 ** i;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  const prefix = opts.label ? `[${opts.label}] ` : "";
  throw new Error(`${prefix}failed after ${attempts} attempts: ${String(lastError)}`);
}
