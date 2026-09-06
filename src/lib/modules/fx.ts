// Live FX rates.
//
// The UPI rail settles in INR while every amount in this system is USD. Leaving
// rate_per_usd null makes the pay page say "we will confirm the amount", which
// is honest but is friction on the primary rail. Hardcoding a rate is worse: it
// silently drifts, and the drift is money.
//
// Measured 06 Sep 2026: USD->INR was 94.51 (exchangerate-api) / 94.49
// (Frankfurter, ECB). Two independent sources within 0.02% of each other.
//
// Both providers are free and need no API key, which matters — a rate that
// stops updating when a trial expires is the same failure as hardcoding one.

export type RateQuote = {
  currency: string;
  rate: number;          // units of `currency` per 1 USD
  source: string;
  asOf: string;          // ISO
};

type Provider = {
  name: string;
  url: (currency: string) => string;
  parse: (json: unknown, currency: string) => { rate: number; asOf?: string } | null;
};

const PROVIDERS: Provider[] = [
  {
    // Updates roughly daily, broad currency coverage.
    name: 'exchangerate-api',
    url: () => 'https://open.er-api.com/v6/latest/USD',
    parse: (json, currency) => {
      const j = json as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
      if (j?.result !== 'success') return null;
      const rate = j?.rates?.[currency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
      return {
        rate,
        asOf: j.time_last_update_utc ? new Date(j.time_last_update_utc).toISOString() : undefined,
      };
    },
  },
  {
    // European Central Bank reference rates. Business days only, so it can lag
    // the other source by a day — fine as a fallback, wrong as a primary.
    // NOTE: the old frankfurter.app host now 301s; .dev is the live one.
    name: 'frankfurter-ecb',
    url: (c) => `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${encodeURIComponent(c)}`,
    parse: (json, currency) => {
      const j = json as { rates?: Record<string, number>; date?: string };
      const rate = j?.rates?.[currency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
      return { rate, asOf: j.date ? new Date(`${j.date}T00:00:00Z`).toISOString() : undefined };
    },
  },
];

/**
 * Fetch the live rate for one currency, trying each provider in order.
 *
 * Returns null rather than a guess. Every caller must treat null as "tell the
 * client we will confirm the amount" — never as 1:1, which on INR would
 * undercharge by ~94x.
 */
export async function fetchRate(currency: string): Promise<RateQuote | null> {
  const code = (currency || '').toUpperCase().trim();
  if (!code || code === 'USD') {
    return code === 'USD'
      ? { currency: 'USD', rate: 1, source: 'identity', asOf: new Date().toISOString() }
      : null;
  }

  for (const p of PROVIDERS) {
    try {
      const res = await fetch(p.url(code), {
        signal: AbortSignal.timeout(8000),
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        console.error(`[fx] ${p.name} returned ${res.status} for ${code}`);
        continue;
      }
      const parsed = p.parse(await res.json(), code);
      if (!parsed) {
        console.error(`[fx] ${p.name} had no usable rate for ${code}`);
        continue;
      }
      return {
        currency: code,
        rate: parsed.rate,
        source: p.name,
        asOf: parsed.asOf || new Date().toISOString(),
      };
    } catch (e: unknown) {
      console.error(`[fx] ${p.name} failed for ${code}:`, e instanceof Error ? e.message : e);
    }
  }

  console.error(`[fx] NO provider could quote ${code} — leaving the rate unset.`);
  return null;
}

/**
 * A sanity bound on a newly fetched rate against the one already stored.
 *
 * A provider returning a mangled figure (a decimal shift, an inverted quote)
 * would silently change what every Indian client is asked to pay. A move of
 * more than 25% against the stored rate is far outside normal FX movement, so
 * it is refused and surfaced rather than written.
 */
export function isPlausible(previous: number | null | undefined, next: number): boolean {
  if (previous == null || !Number.isFinite(previous) || previous <= 0) return true;
  const ratio = next / previous;
  return ratio > 0.75 && ratio < 1.33;
}
