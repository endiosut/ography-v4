-- 008_payment_rails.sql — P2P settlement model (UPI / mobile money / bank /
-- crypto), Binance-P2P and 1xbet style: the client picks the rail that suits
-- them, pays out of band, submits proof, and an admin approves.
--
-- ####################################################################
-- ##  NOT APPLIED. Requires explicit written approval per AGENTS.md  ##
-- ##  rule 4 before anything here touches unzwefrtgsgmtljlbavf.      ##
-- ####################################################################
--
-- GOOD NEWS FIRST. The schema was already designed for this model:
--
--   payment_methods.method_type CHECK IN
--     ('upi','mobile_money','bank_transfer','crypto','cash','other')
--
-- — exactly the rails wanted. payment_proofs, payment_links and the
-- /portal/pay screen all exist. This migration closes the gaps that stop the
-- existing design from actually settling money.
--
-- Measured state, 06 Sep 2026, production:
--   payment_methods    0 rows      <- the hard blocker: nothing to pick from
--   payment_proofs     0 rows
--   payment_links      8 rows
--   payments           8 rows, all pending, all amount_usd NULL
--   RLS on payments:   SELECT policy ONLY. No UPDATE policy exists at all.


-- ─────────────────────────────────────────────────────────────────────────
-- 1. THE BLOCKER: admin cannot mark anything paid
-- ─────────────────────────────────────────────────────────────────────────
-- `payments` has RLS enabled and exactly one policy, payments_select_own
-- (SELECT). There is NO insert or update policy for any role. The admin page
-- at /admin/payments does:
--
--     await supabase.from('payments').update({status:'paid', ...}).eq('id', id)
--     setPayments(ps => ps.map(...))   // optimistic, error never checked
--
-- The UPDATE is silently refused by RLS and the return value is discarded, so
-- the row turns green in the table and NOTHING CHANGES IN THE DATABASE. The
-- admin approval loop has never been able to work. This is the single most
-- important statement in this file.

create policy payments_admin_write on public.payments
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- Clients must never write their own payment rows — proof submission is the
-- only client-side write, and that goes to payment_proofs.

-- Verify (must return true AFTER, false BEFORE):
--   select exists (
--     select 1 from pg_policies
--      where tablename='payments' and cmd in ('ALL','UPDATE')
--   );
-- Then re-query the ROW, not the API response:
--   select status, paid_at from payments where id = '<the one you marked>';


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Reference-only proof submission is broken today
-- ─────────────────────────────────────────────────────────────────────────
-- /portal/pay accepts EITHER a screenshot OR a reference:
--     if (!file && !reference.trim()) { error('Attach a screenshot or enter
--                                              the transaction reference') }
-- and then inserts `file_path: filePath` where filePath is null when no file
-- was chosen. But the column is NOT NULL, so a reference-only submission dies
-- with 23502. The catch block only special-cases 23505, so the client sees
-- "We could not record your submission" with no idea why.
--
-- For crypto this matters more than for anything else: an on-chain txid is
-- verifiable evidence, a screenshot is not.

alter table public.payment_proofs alter column file_path drop not null;

alter table public.payment_proofs
  add column if not exists txid text,           -- on-chain hash / UTR / UPI ref
  add column if not exists paid_amount numeric, -- what they say they actually sent
  add column if not exists paid_currency text;

-- Verify:
--   select is_nullable from information_schema.columns
--    where table_name='payment_proofs' and column_name='file_path';  -- 'YES'


-- ─────────────────────────────────────────────────────────────────────────
-- 3. A rejected proof currently ends the client's ability to pay, forever
-- ─────────────────────────────────────────────────────────────────────────
-- payment_proofs has UNIQUE (payment_id) — one proof per payment, ever. In a
-- manual settlement model rejection is ROUTINE: wrong amount, unreadable
-- screenshot, wrong crypto network, paid the wrong method. With this
-- constraint the client cannot submit a corrected proof, and the payment is
-- stuck permanently. Replace it with a rule that only blocks a SECOND OPEN
-- proof, while allowing a resubmission after a rejection.

alter table public.payment_proofs drop constraint payment_proofs_payment_id_key;

create unique index payment_proofs_one_open_per_payment
  on public.payment_proofs (payment_id)
  where review_status in ('submitted', 'under_review');

-- Verify:
--   -- two rejected + one open on the same payment must be legal:
--   select payment_id, review_status, count(*) from payment_proofs
--    group by 1,2;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Crypto needs a network. Without it, money is destroyed, not delayed.
-- ─────────────────────────────────────────────────────────────────────────
-- payment_methods stores account_reference (a wallet address) but has nowhere
-- to say WHICH CHAIN. USDT sent on BEP20 to a TRC20 address is gone —
-- irrecoverable, not refundable. `memo_tag` matters for the same reason on
-- exchanges that use a shared deposit address: no memo, no attribution.

alter table public.payment_methods
  add column if not exists network text,        -- 'TRC20' | 'ERC20' | 'BEP20' | 'Lightning'
  add column if not exists memo_tag text,       -- required by some exchange deposits
  add column if not exists asset_code text,     -- 'USDT' | 'BTC' — distinct from fiat currency
  add column if not exists min_amount_usd numeric,
  add column if not exists max_amount_usd numeric;

-- A crypto method without a network is a trap. Enforce it.
alter table public.payment_methods
  add constraint payment_methods_crypto_needs_network
  check (method_type <> 'crypto' or network is not null);


-- ─────────────────────────────────────────────────────────────────────────
-- 5. The FX gap — the client is quoted USD but pays in their own currency
-- ─────────────────────────────────────────────────────────────────────────
-- payments.amount_usd is USD. payment_methods.currency_code says the rail
-- settles in (say) INR. Nothing converts between them, so a client choosing
-- UPI is told "$47.50" and has to guess the rupee amount — and whatever they
-- guess, you cannot tell an underpayment from a rate difference.
--
-- Binance P2P solves this by LOCKING a rate for a short window. Same idea:
-- freeze the rate and the local amount onto the payment at selection time, so
-- the number shown is the number owed, whatever the market does next.

alter table public.payment_methods
  add column if not exists rate_per_usd numeric,          -- units of currency_code per 1 USD
  add column if not exists rate_updated_at timestamptz,
  add column if not exists settlement_window_minutes integer not null default 60;

alter table public.payments
  add column if not exists payment_method_id uuid references public.payment_methods(id),
  add column if not exists display_currency text,     -- frozen at selection
  add column if not exists display_amount numeric,    -- frozen at selection
  add column if not exists rate_per_usd numeric,      -- the rate actually honoured
  add column if not exists quote_expires_at timestamptz;

-- NOTE: a NULL rate_per_usd must render as "contact us for the local amount",
-- never as a silent 1:1. 1 USD = 1 INR would undercharge by ~88x.


-- ─────────────────────────────────────────────────────────────────────────
-- 6. is_active DEFAULTS TO FALSE — almost certainly why this table is empty
-- ─────────────────────────────────────────────────────────────────────────
-- A row inserted without is_active explicitly true is invisible to
-- /portal/pay, which filters .eq('is_active', true). The page then renders an
-- empty list: it loads, looks fine, and offers no way to pay.
--
-- Left as-is deliberately (defaulting to visible is worse — a half-configured
-- rail would go live the moment it is created). The admin UI now sets it
-- explicitly and shows the on/off state.


-- ─────────────────────────────────────────────────────────────────────────
-- 7. Seed the rails. FILL IN YOUR REAL DETAILS — placeholders are obviously
--    fake on purpose so this cannot be run by accident.
-- ─────────────────────────────────────────────────────────────────────────
-- Or skip this entirely and use /admin/payments/methods, which now does it
-- through the UI.
--
-- insert into public.payment_methods
--   (label, method_type, country_code, currency_code, asset_code, network,
--    instructions, account_holder, account_reference, rate_per_usd,
--    rate_updated_at, is_active, sort_order)
-- values
--   ('UPI (India)','upi','IN','INR',null,null,
--    'Open any UPI app, send the exact amount, and put the project reference in the note.',
--    '<<YOUR NAME>>','<<yourvpa@bank>>', 88.0, now(), true, 1),
--   ('Mobile money','mobile_money','<<CC>>','<<CUR>>',null,null,
--    'Send to the number below and quote the project reference.',
--    '<<YOUR NAME>>','<<+000000000>>', null, null, true, 2),
--   ('Bank transfer (USD)','bank_transfer',null,'USD',null,null,
--    'IBAN/SWIFT below. Use the project reference as the payment reason.',
--    '<<ACCOUNT HOLDER>>','<<IBAN>>', 1.0, now(), true, 3),
--   ('USDT (Binance, TRC20)','crypto',null,'USD','USDT','TRC20',
--    'Send USDT on the TRON (TRC20) network ONLY. Any other network will lose the funds.',
--    'OGraphy','<<TRC20 WALLET ADDRESS>>', 1.0, now(), true, 4);
--
-- Verify — this MUST return at least one row or /portal/pay is still a dead end:
--   select label, method_type, network, currency_code, is_active
--     from payment_methods where is_active order by sort_order;


-- ─────────────────────────────────────────────────────────────────────────
-- 8. The 8 stalled payments — DECISION NEEDED, nothing here runs by default
-- ─────────────────────────────────────────────────────────────────────────
-- All 8 created 27 Jul – 13 Aug with amount_usd NULL and no agreement. They
-- cannot be collected (no amount to ask for) or reconciled (no session).
--
-- Recommended — void them so the dashboard stops counting dead pipeline,
-- keeping the rows for audit:
--
--   update public.payments
--      set status = 'void'
--    where status = 'pending'
--      and amount_usd is null
--      and created_at < '2026-08-16';
--   -- expected: UPDATE 8
--
-- Verify:
--   select status, count(*), count(amount_usd) priced from payments group by 1;
