-- 008_payment_rails.sql
--
-- ####################################################################
-- ##  NOT APPLIED. Requires explicit written approval per AGENTS.md  ##
-- ##  rule 4 before anything here touches unzwefrtgsgmtljlbavf.      ##
-- ####################################################################
--
-- Measured state, 06 Sep 2026, production:
--
--   catalog_items         17 rows, 17 priced, NO stripe_link column
--   agreements             2 rows, both 'sent', never accepted
--   payments               8 rows, ALL status='pending',
--                                  ALL amount_usd IS NULL,
--                                  ALL stripe_session_id IS NULL
--   payment_methods        0 rows  <-- nothing for a client to pay INTO
--   payment_links          8 rows
--   payment_proofs         0 rows
--   checkout_sessions      0 rows
--   projects              21 rows, total_amount_usd NULL on all 21
--
-- Sections 1 and 2 are safe and additive. Section 3 writes to live rows and
-- needs a decision from you first. Section 4 is the one that actually unblocks
-- the manual rail and needs YOUR account details — I will not invent them.


-- ─────────────────────────────────────────────────────────────────────────
-- 1. Make the pricing matrix explicit instead of regex-derived
-- ─────────────────────────────────────────────────────────────────────────
-- src/lib/pricing.ts currently classifies each row by parsing price_note:
--   "/mo"      -> recurring  (2 rows)  must be a Stripe subscription
--   "From $X"  -> quote      (9 rows)  the price is a FLOOR, deposit only
--   otherwise  -> fixed      (6 rows)  chargeable in full
-- That works, but the day someone edits a price_note to "Starting at $320" the
-- classification silently flips to `fixed` and the site charges a total nobody
-- agreed to. A column cannot be broken by copywriting.

alter table public.catalog_items
  add column if not exists pricing_mode text
    check (pricing_mode in ('fixed','quote','recurring'));

update public.catalog_items
   set pricing_mode = case
         when price_note ~* '/\s*mo\b|per month|monthly' then 'recurring'
         when price_note ~* 'from\s*\$'                  then 'quote'
         else 'fixed'
       end
 where pricing_mode is null;

-- Verify (expected: recurring 2, quote 9, fixed 6):
--   select pricing_mode, count(*) from catalog_items group by 1 order by 2 desc;


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Stop payments rows being created with no amount
-- ─────────────────────────────────────────────────────────────────────────
-- All 8 existing rows have amount_usd NULL. /portal/pay renders the amount as
-- "—", so even a client who reached that page could not know what to send.
-- A payment with no amount is not a payment.
--
-- NOT NULL cannot be added while those 8 rows exist, so this is a CHECK that
-- only bites new rows once the backfill in section 3 has run.

-- Run AFTER section 3:
-- alter table public.payments
--   add constraint payments_amount_present
--   check (amount_usd is not null and amount_usd >= 0) not valid;
-- alter table public.payments validate constraint payments_amount_present;

-- Idempotency guard for the Stripe webhook — two retries of the same event must
-- not become two sales. This is the DB-level backstop for the check the webhook
-- already does in code.
create unique index if not exists payments_stripe_session_uniq
  on public.payments (stripe_session_id)
  where stripe_session_id is not null;


-- ─────────────────────────────────────────────────────────────────────────
-- 3. The 8 stalled payments — DECISION NEEDED, nothing here runs by default
-- ─────────────────────────────────────────────────────────────────────────
-- All 8 were created 27 Jul – 13 Aug, before the agreements pipeline existed.
-- None has an amount, a Stripe session, or a linked agreement, so none can be
-- collected and none can be reconciled. They are not recoverable as payments —
-- only as leads.
--
-- Option A (recommended) — mark them void so dashboards stop counting dead
-- pipeline, keeping the row for audit:
--
--   update public.payments
--      set status = 'void'
--    where status = 'pending'
--      and amount_usd is null
--      and stripe_session_id is null
--      and created_at < '2026-08-16';
--   -- expected: UPDATE 8
--
-- Option B — price them from their project's agreement, where one exists.
-- Currently 0 of the 8 projects has an agreement_id, so this updates 0 rows.
-- Listed only so it is on record that it was considered:
--
--   update public.payments p
--      set amount_usd = a.deposit_usd
--     from public.projects pr
--     join public.agreements a on a.id = pr.agreement_id
--    where p.project_id = pr.id and p.amount_usd is null;
--
-- Verify either way:
--   select status, count(*), count(amount_usd) priced from payments group by 1;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. payment_methods is EMPTY — this is the manual rail's hard blocker
-- ─────────────────────────────────────────────────────────────────────────
-- /portal/pay/[paymentId] renders the list of ways to pay from this table.
-- With 0 active rows it renders an empty list: the page loads, looks fine, and
-- offers the client no way to send money. No amount of front-end work fixes
-- that — the data is not there.
--
-- Note `is_active` DEFAULTS TO FALSE, so a row inserted without it explicitly
-- set stays invisible. That is almost certainly how this table ended up empty
-- in effect even if rows were attempted.
--
-- FILL IN YOUR REAL DETAILS. Placeholders are left obviously fake on purpose so
-- this cannot be run by accident.
--
--   insert into public.payment_methods
--     (label, method_type, country_code, currency_code, instructions,
--      account_holder, account_reference, is_active, sort_order)
--   values
--     ('UPI (India)', 'upi', 'IN', 'INR',
--      'Send the exact amount and put the project reference in the note.',
--      '<<YOUR NAME>>', '<<yourvpa@bank>>', true, 1),
--     ('Mobile money', 'mobile_money', '<<CC>>', '<<CUR>>',
--      'Send to the number below and quote the project reference.',
--      '<<YOUR NAME>>', '<<+000000000>>', true, 2),
--     ('Bank transfer', 'bank_transfer', null, 'USD',
--      'IBAN/SWIFT below. Quote the project reference as the payment reason.',
--      '<<ACCOUNT HOLDER>>', '<<IBAN / ACCOUNT NO>>', true, 3);
--
-- Verify:
--   select label, method_type, is_active from payment_methods order by sort_order;
--   -- must return at least one row with is_active = true, or the pay page is
--   -- still a dead end.
