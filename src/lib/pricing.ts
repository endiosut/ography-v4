// ─────────────────────────────────────────────────────────────────────────────
//  THE PRICING MATRIX
// ─────────────────────────────────────────────────────────────────────────────
//
// Measured 06 Sep 2026 against catalog_items (17 rows, all priced). The catalog
// is NOT one kind of product — it is three, and they cannot be charged the same
// way. Every previous attempt to "turn on checkout" failed because the code
// treated base_price_usd as a chargeable total for all 17. It is not.
//
//   FIXED     6 rows  price_note is an exact amount, no /mo.
//                     "$95 per set of 15 templates", "$65 - design + 250 cards"
//                     -> base_price_usd IS the total. Chargeable in full today.
//
//   QUOTE     9 rows  price_note starts "From $X". The stated price is a FLOOR,
//                     not a total. "From $320 - full event kit" could invoice at
//                     $320 or $900 depending on scope.
//                     -> charging base_price_usd as "the full amount" would be
//                        billing a number nobody agreed to. Deposit only.
//
//   RECURRING 2 rows  price_note contains "/mo".
//                     "$1,200/mo - ongoing partnership", "$280/mo - 30 templates"
//                     -> a one-time PaymentIntent for $1,200 is not a monthly
//                        retainer. Needs Stripe mode:'subscription'.
//
// Derived from price_note rather than a column because adding a column to the
// production database requires written approval (AGENTS.md rule 4). The
// migration that makes this explicit is in
// supabase/migrations/008_payment_rails.sql — once it is applied, the only
// change needed here is to read the column and keep this parser as the fallback
// for rows the migration has not backfilled.

export type PricingMode = 'fixed' | 'quote' | 'recurring' | 'unavailable';

export type PricedItem = {
  id: string;
  name: string;
  base_price_usd: number | null;
  price_note: string | null;
};

/** Which of the three kinds of product this row is. */
export function pricingMode(item: Pick<PricedItem, 'base_price_usd' | 'price_note'>): PricingMode {
  const price = Number(item.base_price_usd ?? 0);
  if (!Number.isFinite(price) || price <= 0) return 'unavailable';

  const note = (item.price_note || '').toLowerCase();

  // Order matters. "$280/mo — 30 templates" is recurring, and would read as
  // fixed if the /mo test ran second.
  if (/\/\s*mo\b|\bper month\b|\bmonthly\b/.test(note)) return 'recurring';
  if (/\bfrom\s*\$/.test(note) || /^from\b/.test(note.trim())) return 'quote';
  return 'fixed';
}

/** What the cart is allowed to offer, given everything in it. */
export type CheckoutOffer =
  | { kind: 'full_or_deposit' }              // every line is fixed
  | { kind: 'deposit_only'; reason: string } // at least one line is a "From $X"
  | { kind: 'subscription' }                 // every line is recurring
  | { kind: 'blocked'; reason: string };     // mixed, or nothing chargeable

/**
 * Stripe cannot put a $1,200/mo retainer and a $65 one-time card set in one
 * Checkout Session without turning the whole session into a subscription and
 * silently billing the card set every month. So a mixed cart is refused with an
 * explanation rather than quietly mis-charged.
 */
export function offerFor(items: { mode: PricingMode }[]): CheckoutOffer {
  if (items.length === 0) return { kind: 'blocked', reason: 'Your cart is empty.' };

  const modes = new Set(items.map((i) => i.mode));

  if (modes.has('unavailable')) {
    return { kind: 'blocked', reason: 'One of these services has no published price yet.' };
  }

  const hasRecurring = modes.has('recurring');
  const hasOneTime = modes.has('fixed') || modes.has('quote');

  if (hasRecurring && hasOneTime) {
    return {
      kind: 'blocked',
      reason:
        'Monthly retainers and one-time projects have to be checked out separately — ' +
        'otherwise the one-time work would be billed every month too.',
    };
  }

  if (hasRecurring) return { kind: 'subscription' };
  if (modes.has('quote')) {
    return {
      kind: 'deposit_only',
      reason:
        'Some of these are priced from a starting figure, so the final total depends on scope. ' +
        'You pay the booking deposit now and the balance is quoted before work starts.',
    };
  }
  return { kind: 'full_or_deposit' };
}

/**
 * Amount to charge NOW, in whole cents, for one line.
 *
 * `deposit_pct` mirrors agreements.deposit_pct (default 50) so the number the
 * client is charged matches the number the agreement says they owe.
 *
 * For a `quote` line the deposit is the full "From" floor, not 50% of it: that
 * floor is the minimum the job will cost, so it is the smallest honest deposit.
 */
export function chargeCents(
  item: PricedItem,
  mode: PricingMode,
  intent: 'full' | 'deposit',
  depositPct = 50
): number {
  const dollars = Number(item.base_price_usd ?? 0);

  if (mode === 'quote') return Math.round(dollars * 100);
  if (mode === 'recurring') return Math.round(dollars * 100); // per billing period
  if (intent === 'full') return Math.round(dollars * 100);
  return Math.round(dollars * 100 * (depositPct / 100));
}
