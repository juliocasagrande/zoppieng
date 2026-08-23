// This environment's corporate SSL-inspection proxy (Forcepoint) intermittently
// drops the certificate chain to Supabase — a single retry isn't enough
// (~70% single-shot failure rate observed), so retry several times with a
// short backoff before giving up. Cheap when the network is healthy: only
// ever costs one round trip in that case.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 6, baseDelayMs = 150): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastError;
}
