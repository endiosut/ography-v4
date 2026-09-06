# WORKLOG — OGraphy V4

Append-only. Newest entry at the top. One block per working session, human or agent.
Never edit or delete a previous entry — if you were wrong, add a correction below.

Format is defined in `AGENTS.md`. Every entry needs a commit SHA and, if deployed,
a deployment ID and a dirty-tree declaration.

---

## 2026-09-07 (b) · Claude Opus 5 · Deploy unblocked — MY misdiagnosis, corrected

```
ITEM        Get the stalled deployment out. Verify everything on the shipped
            build. Set the UPI rate from a live source.

CORRECTION  ** I GOT THE DIAGNOSIS WRONG AND SENT THE OWNER TO FIX SOMETHING
            THAT WAS NOT BROKEN. ** I concluded Vercel had lost GitHub repo
            access when the repo went private, and had them re-grant the
            GitHub App permission. get_git_deployment_context shows the project
            was linked to endiosut/ography-v4 the entire time.

ROOT CAUSE  vercel.json carried an HOURLY cron ("0 * * * *"). This team is on
            the Hobby plan, which permits at most 2 cron jobs and only ONCE PER
            DAY. Vercel rejects an invalid cron at config validation and
            creates NO deployment record at all — which is precisely why the
            deploy hook kept returning 201 with a job id while list_deployments
            stayed empty, and why there was never a failed build to open.

            The signal I had and misread: deploys stopped at the exact commit
            that introduced the cron (85e598a). The commit before it (59d6785)
            deployed fine and I had personally verified its routes live in
            production. The repo going private was a COINCIDENCE in the same
            window, and I let it explain the evidence instead of the timeline.

CHANGE      vercel.json — both crons daily ("15 3 * * *", "0 6 * * *").
            Cheap: the outbox already drains opportunistically in-process after
            every enqueue, so the schedule is a retry safety net, not the
            delivery path. /api/outbox/drain still accepts ?key=CRON_SECRET so
            an external pinger can run it more often if ever needed.

STATUS      verified-deployed — d04daa4 went live 45 seconds after push.

VERIFY      Routes on the SHIPPED build, unauthenticated — none 404:
              outbox/drain 401 · drain?key=wrong 401 · refresh-rates 401
              issue-link 401 · proofs/review 401 · extend 400
              agreements/accepted 400 · home 200

            Anonymous attacker holding the public anon key:
              upload -> catalog-images / payment-qr / deliverables /
                        brief-files / payment-proofs
                403 "new row violates row-level security policy"
              insert briefs 401 · insert notifications 401
              read payment_methods 200 (storefront intact)

            TWO PROBES WERE INITIALLY WORTHLESS AND WERE REDONE:
              · payment-proofs upload first returned a MIME-type error, which
                is raised BEFORE RLS is evaluated. Redone with
                Content-Type: image/png to get a real answer.
              · reading notifications as anon returned [] while the table was
                EMPTY, which proves nothing. A real admin-audience row was
                inserted via the service role first; the anon read still
                returned []. Probe deleted, notifications back to 0.

RATE SET    1 USD = 94.511608 INR (exchangerate-api), corroborated by
            Frankfurter/ECB at 94.49 — 0.02% apart. Applied by hand this once
            because refresh-rates needs CRON_SECRET or an admin session and
            neither is configured yet; the daily job takes over after that.

OPEN        · env vars unset: RESEND_API_KEY, RESEND_FROM, CRON_SECRET,
              NEXT_PUBLIC_SITE_URL, PAYMENT_WINDOW_MINUTES. Until then the
              outbox marks receipts 'skipped' rather than pretending they sent.
            · no QR image on either rail
            · 8 stalled payments KEPT as test records, by instruction

COMMIT      d04daa4
DEPLOY      live, 45s after push
DIRTY TREE  no
```

---

## 2026-09-07 · Claude Opus 5 · Notification centre, live FX — DEPLOY STILL BROKEN

```
ITEM        Build a notification centre (admin + client). Take the USD->INR
            rate from a live online source rather than a typed number.
            Owner reported the Vercel<->GitHub integration was reconnected.

BLOCKER     ** STILL NOT DEPLOYING. ** Re-checked after the owner's reconnect:
            zero deployments since babe8d3, across ~15 minutes of polling on
            two separate occasions. /api/outbox/drain, /api/admin/payments/
            issue-link and /api/admin/payments/refresh-rates all 404 in prod.
            Local build is clean and every route is in the route table, so this
            is the integration, not the code.
            NEXT LEVER: a Deploy Hook (Project > Settings > Git > Deploy Hooks)
            gives a POST URL that triggers a build independently of the push
            webhook. If the hook also fails, Vercel has lost repo READ access
            and the Git connection must be removed and re-added.

CHANGE      DB 013 — notifications table. One table, two audiences, with a
                     CHECK that a client row carries a client_id and an admin
                     row does not, so a client-targeted row cannot exist
                     unowned. 3 RLS policies: admin all; client SELECT own;
                     client UPDATE own (read-marking only).
            DB 014 — SECURITY DEFINER triggers on payment_proofs and
                     payment_feedback. Those are client-side inserts straight
                     to Postgres and never pass an app server, so no route
                     could reliably notify on them — the same shape as the bug
                     where accepting an agreement notified nobody.
            lib/modules/notifications.ts  notify() + a deliberately small event
                                          catalogue. Admin gets decisions and
                                          bleeding; client gets state changes.
            components/NotificationBell   one component, both audiences. RLS
                                          does the filtering, so there is no
                                          client-side is-admin check to botch.
                                          Mounted in NavBar and AdminSidebar.
            lib/modules/fx.ts             two key-free providers in order.
            api/admin/payments/refresh-rates  cron + on-demand button.
            outbox                        dead-letter now raises a CRITICAL
                                          admin notification.

STATUS      fixed-local / committed / NOT DEPLOYED

VERIFY      Constraints and triggers were PROVEN, not assumed:
              · inserting a client notification with no client_id -> raises
                (a DO block re-raises if it is accepted)
              · inserting a payment_feedback row -> notification count rises;
                probe then deleted, notifications and payment_feedback both
                back to 0
              · updating payment_links.token -> raises (from session e)
            FX providers measured live today:
              open.er-api.com   USD->INR 94.511608
              frankfurter.dev   USD->INR 94.49   (ECB, 2026-09-04)
            Within 0.02% of each other.
            Local: tsc clean, next build clean.

CORRECTION  I earlier told the owner the USD->INR rate was "around 88". It is
            ~94.5. Recorded because it would have mispriced every INR payment.

OPEN        1. THE DEPLOY. Nothing below is live until it is fixed.
            2. RESEND_FROM cannot use ography-v4.vercel.app — you cannot add
               DNS records to a .vercel.app domain, so it can never be verified
               for email. Either use onboarding@resend.dev (sends ONLY to the
               Resend account owner's own address) or register a real domain.
            3. UPI rate still null in prod until refresh-rates can run.
            4. 8 stalled payments KEPT as test records, by instruction.

COMMIT      afa2dd2
DEPLOY      NONE — integration still broken
DIRTY TREE  no
```

---

## 2026-09-06 (f) · Claude Opus 5 · Outbox, link integrity, CI — AND A BROKEN DEPLOY HOOK

```
ITEM        Retry/history for sends, fan-out, payment-link creation mechanism,
            link uniqueness/immutability. Repo made private by owner.

BLOCKER     ** VERCEL IS NO LONGER DEPLOYING FROM GITHUB **
            Commit 85e598a is on origin/main (verified: local and origin HEAD
            match). Vercel's latest deployment is still babe8d3, the commit
            BEFORE it. No queued, building or errored deployment exists.
            The repo was flipped to Private between those two commits
            (GitHub API for an unauthenticated caller now returns 404).
            Flipping to private revokes the Vercel GitHub App's repository
            access unless private-repo access is re-granted, so pushes no
            longer reach Vercel.
            => Everything below is committed and builds locally, but is NOT
               live. Fix the integration before trusting production.

ROOT CAUSE  Retry/history: sends fired once; a transient failure lost the
            message and left only a log line. Same failure mode as the dead
            n8n webhook.
            Link creation: a window could only ever be opened at ONE moment,
            agreement acceptance. Balance payments, admin-made payments, the 8
            historical rows and clients who used both renewals had no route.
            Link integrity: token already had UNIQUE, but nothing enforced one
            ACTIVE link per payment, and nothing stopped an UPDATE repointing a
            token at a different payment.

CHANGE      DB 012 — payment_links_one_active_per_payment (partial unique);
                     payment_links_immutable() trigger on token/payment_id/
                     project_id; notification_outbox + dedupe/due indexes + RLS.
            lib/modules/outbox.ts   enqueue/drain, backoff 1m-5m-25m-2h-10h,
                                    row claimed by conditional update, 23505 on
                                    dedupe treated as SUCCESS not error.
            api/outbox/drain        Vercel Cron OR ?key=CRON_SECRET OR
                                    in-process. Fails CLOSED with no secret.
            api/admin/payments/issue-link  open/reopen a window, notify client.
            admin/payments          "Issue Link" button; disabled on null amount.
            admin/payments/proofs   reports OUTBOX status, not hoped-for status.
            .github/workflows       replaced the webpack starter template.

STATUS      fixed-local / committed / NOT DEPLOYED (see BLOCKER)

VERIFY      Immutability was proven, not assumed — a DO block attempted
              update payment_links set token = gen_random_uuid()
            and the trigger raised; the block re-raises if it does NOT.
            Applied-state re-query: one_active_idx 1 · immutable_trigger 1 ·
            outbox_table 1 · outbox_policies 1 · outbox_indexes 3.
            Local: tsc clean, next build clean, all routes in the route table.
            Production probes still return 404 for /api/outbox/drain and
            /api/admin/payments/issue-link — consistent with the BLOCKER, not
            with a code fault.

NOTE        The old CI workflow (`npx webpack`, node 18/20) could not have
            passed once — no webpack in this project, and it needs node 24.x.
            Replaced with npm ci + tsc + build. Lint left NON-blocking: 71
            pre-existing errors would have put CI back to red-on-every-push.

IMPORTANT   Making the repo private does NOT hide NEXT_PUBLIC_SUPABASE_ANON_KEY.
            That key is shipped in the browser bundle of the live site and can
            be read by anyone who opens devtools. RLS is the only thing
            protecting the data — which is why migration 010 mattered and why
            "the repo is private now" is not a substitute for it.

COMMIT      d58879e, 85e598a
DEPLOY      NONE — integration broken
DIRTY TREE  no
```

---

## 2026-09-06 (e) · Claude Opus 5 · Security lock, payment windows, receipts

```
ITEM        Lock catalog-images and find anything else that could leak. Create
            payment links with a 15-30min expiry, renewable twice, with
            escalation + feedback on expiry. Replace n8n with Resend +
            WhatsApp. Generate and deliver a receipt on proof approval.

ROOT CAUSE  The anon key is in a public repo BY DESIGN, so a storage/RLS grant
            to `public` is a grant to the internet. Found, all live:

              deliverables_storage_select   SELECT -> public, bucket check only
              brief_files_storage_select    SELECT -> public, bucket check only
                => anyone could READ every client's delivered work and every
                   uploaded brief. Both buckets are marked private; the RLS
                   policy overrode that.
              deliverables_storage_insert   INSERT -> public
              brief_files_storage_insert    INSERT -> public
              catalog_images_insert/update/delete -> public
              briefs_insert_public          INSERT -> anon, WITH CHECK (true)
              brief_files_insert            INSERT -> public, WITH CHECK (true)

            Payment windows: payment_links.expires_at existed but nothing ever
            created a row or set one — 8 rows, all NULL — so the countdown had
            never rendered and proof submission was untimed.

            Receipts: payments.receipt_url was READ by /portal and written by
            nothing. No bill was ever generated or sent.

CHANGE      DB 010 — every hole above replaced with is_admin() or owner-scoped
                     policies, via new owns_project_in_path(), which guards the
                     uuid cast (a raw (foldername(name))[n]::uuid raises on a
                     non-uuid segment, and an exception inside an RLS predicate
                     fails the whole query).
            DB 011 — payment_links + payment_id/renewals_used/max_renewals/
                     window_minutes, CHECK window between 15 and 30 and
                     renewals <= max; new payment_feedback table + 3 policies.
            api/agreements/accepted  opens the window on acceptance
            api/payments/extend      NEW, renews at most twice, from NOW
            api/admin/proofs/review  NEW, approval + receipt, admin identity
                                     from the session cookie not the body
            lib/modules/deliver.ts   NEW, Resend + WhatsApp Cloud API
            lib/modules/receipt.ts   NEW, light-theme inline-styled HTML bill
            portal/pay               countdown renders, extend button, expiry
                                     escalation + feedback form
            portal/brief             createClient -> createBrowserClient

STATUS      verified-deployed (code + schema). Channels NOT configured yet.

VERIFY      As an ANONYMOUS caller holding the public anon key:
              upload -> catalog-images / payment-qr / deliverables
                403 {"message":"new row violates row-level security policy"}
              POST /rest/v1/briefs        -> 401
              POST /rest/v1/brief_files   -> 401
              GET  catalog_items          -> 200  (storefront intact)
              GET  payment_methods active -> 200
            Policy counts after 010:
              storage public writes left ......... 0
              storage public selects left ........ 0  (excl. intentionally
                                                       public catalog-images
                                                       and payment-qr reads)
              table INSERT policies WITH CHECK true  0
            Production routes, unauthenticated:
              /api/payments/extend  bad uuid -> 400 · valid uuid -> 401
              /api/admin/proofs/review       -> 401 {"error":"Not signed in"}

            HONEST CAVEAT: deliverables and brief-files hold ZERO objects, so
            "anon list returns []" proves nothing on its own. The policy counts
            and the 403 write refusals are the real evidence.

OPEN        Channels are code-complete but OFF until env vars are set:
              RESEND_API_KEY, RESEND_FROM           (email + receipts)
              WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
              WHATSAPP_RECEIPT_TEMPLATE  (needed outside the 24h window)
              PAYMENT_WINDOW_MINUTES     (optional, 15-30, default 30)
              NEXT_PUBLIC_SITE_URL       (so links in receipts are absolute)
            Until then sendEmail/sendWhatsApp return skipped:true and the admin
            page says so per channel rather than claiming a receipt was sent.

            Still open from earlier:
            - UPI rail rate_per_usd is NULL
            - QR images not uploaded
            - 8 stalled payments KEPT as test records, by instruction
            - repo still public
            - /portal/brief writes projects.notes but `projects` has no UPDATE
              policy, so that write is refused. Pre-existing, not fixed here.

COMMIT      59d6785
DEPLOY      auto from main
DIRTY TREE  no
```

---

## 2026-09-06 (d) · Claude Opus 5 · QR upload, proof formats, QR bucket security

```
ITEM        Owner: no QR upload placeholder on the rail editor (wanted the
            /admin/catalog/upload pattern). Also asked about proof file
            formats, the proof-upload timer, receipts, n8n alternatives,
            repo visibility, and fork status.

ROOT CAUSE  QR: the rail editor persisted qr_code_path but had no control to
            set it, so it could only ever be null.

            SECURITY, found while building it — the pay page read QR codes from
            `catalog-images`, and that bucket's policies are:
              catalog_images_insert / _update / _delete  ->  role `public`
            i.e. ANY anonymous visitor can write or replace an object in it. A
            payment QR stored there could be swapped for an attacker's own
            code and every later payment would go to them, with nothing on the
            page looking wrong. QR codes must not live in that bucket.

            TIMER: there is none. useCountdown reads payment_links.expires_at;
            measured — payment_links has 8 rows and expires_at is NULL on ALL
            8, and no code anywhere creates a payment_link or sets an expiry.
            The countdown UI has never had data to render. So a client has
            unlimited time to submit proof, and nothing expires.

            PROOF FORMATS: accept was 'image/*,application/pdf'. HEIC/HEIF are
            what iPhones actually produce, and several in-app browsers do not
            match HEIC against the bare wildcard — greying out the exact
            screenshot the client is trying to attach.

CHANGE      DB (009_payment_qr_bucket, applied):
              new bucket `payment-qr`, public=true, with SELECT to public and
              INSERT/UPDATE/DELETE gated on is_admin().
            admin/payments/methods  QR uploader: click-the-placeholder, live
                                    preview of the STORED image, 5MB cap,
                                    PNG/JPG/HEIC. Path held on the draft and
                                    written only on save. qr_code_path added to
                                    the save payload (it was being dropped).
            portal/pay/[paymentId]  reads QR from `payment-qr`; proof accept
                                    lists png/jpeg/webp/heic/heif/pdf, shows
                                    the list, rejects >10MB at pick time.

STATUS      verified-deployed

VERIFY      Bucket, re-queried after apply:
              storage.buckets payment-qr public ......... true
              payment_qr_* policies ..................... 4
              of which write policies gated on is_admin() 3
            Production:
              /admin/payments/methods ................... 307 (auth gate)
              GET .../object/public/payment-qr/<missing>  400 (bucket exists)
              anon REST payment_methods?is_active=eq.true returns both rails
            Repo, from the GitHub API:
              fork false · forks_count 0 · visibility public

NOTE        The commit message on 40ab910 lost two words to shell backtick
            substitution (`public` and `payment-qr`). Code unaffected; not
            amended because that would mean force-pushing main. Full detail is
            here instead.

OPEN        Unchanged from (c), plus:
            - catalog-images still grants INSERT/UPDATE/DELETE to `public`
              (1 object in it). Pre-existing and unrelated to payments, so it
              was flagged, not changed. Anyone can overwrite catalog imagery.
            - The 8 stalled payments are being KEPT as-is at the owner's
              instruction, as a record of earlier tests. Do not void them.
            - No receipt document exists. Nothing renders or delivers a bill;
              payments.receipt_url is read by /portal but never written.

COMMIT      40ab910
DEPLOY      auto from main
DIRTY TREE  no
```

---

## 2026-09-06 (c) · Claude Opus 5 · Rails live, proof review, copy-to-pay

```
ITEM        Owner approved the schema and supplied real rail details. Do all
            five open items. Also asked: will buying Anthropic API credits make
            n8n fire?

ROOT CAUSE  n8n: NO, and the two are unrelated. Anthropic credits feed
            ANTHROPIC_API_KEY (/api/ai, /api/ai-studio/*). n8n is a separate
            SaaS, and it is GONE:
              GET https://ographyy.app.n8n.cloud/webhook/ography-new-lead
              -> 404 "<title>404 - No workspace here</title>"
            That is not an inactive workflow — n8n answers those with a JSON
            "webhook not registered". The WORKSPACE does not exist. And it was
            invisible for the life of the project because fireEvent was
              try { await fetch(...) } catch { }
            A 404 is a RESOLVED fetch, so it never reached the catch. Nothing
            was ever logged on any path.

CHANGE      DB (applied with approval, 008a-008d):
              008a  payments_admin_write policy  <- the approval blocker
              008b  payment_proofs.file_path nullable; +txid/paid_amount/
                    paid_currency; UNIQUE(payment_id) -> partial unique on OPEN
                    proofs so a rejected client can resubmit
              008c  payment_methods +network/memo_tag/asset_code/min/max/
                    rate_per_usd/rate_updated_at/settlement_window; CHECK that
                    crypto has a network; payments +payment_method_id/
                    display_currency/display_amount/rate_per_usd/quote_expires_at
              008d  seeded 2 LIVE rails:
                      UPI / Paytm (India)  6352209640@pthdfc  INR
                      USDT — Binance Pay   OGBillions9899     Binance Pay
            Code:
              lib/support.ts          NEW. WhatsApp + email, one definition.
              lib/modules/notify.ts   env-configurable URL, 8s timeout, logs
                                      non-2xx, returns delivered:boolean.
              api/agreements/accepted NEW. Fires AGREEMENT_ACCEPTED, but only
                                      after re-reading the row and confirming
                                      the DB says accepted — cannot be used to
                                      fake a signature.
              admin/payments/proofs   NEW. Review queue: signed URLs (private
                                      bucket), rejection reason required,
                                      approval re-queries the payment row.
              portal/pay/[paymentId]  CopyRow (address/memo/reference), upi://
                                      deep link, crypto network warning, local
                                      -currency amount, rejected proofs reopen
                                      the form, WhatsApp/email escalation.
              portal/page.tsx         Pay button on unsettled payments;
                                      paymentFor() prefers the UNPAID row.
              contact + catalog       removed dead stripe_link UI incl. the
                                      test-mode buy.stripe.com URL.

STATUS      verified-deployed

VERIFY      DB, re-queried after apply (not trusting success responses):
              payments ALL-policy ........ 1
              file_path nullable ......... YES
              old UNIQUE ................. 0   partial unique ... 1
              crypto-network CHECK ....... 1
              new method cols ............ 8   new payment cols . 5
              live rails ................. 2
            Production HTTP:
              POST /api/agreements/accepted {"agreementId":"not-a-uuid"} -> 400
              POST same with an unknown uuid                            -> 404
              /admin/payments/{proofs,methods}                          -> 307
            Shipped bundles (11 chunks off /contact and /catalog) contain no
            "buy.stripe.com". NOTE: an earlier check grepped the PAGE HTML for
            "Pay Now" and passed for the wrong reason — that block never
            rendered anyway, because stripe_link was always undefined.
            get_advisors(security): no new findings; all remaining are
            pre-existing (SECURITY DEFINER helpers, cart tables, leaked-password
            protection off).

OPEN        1. n8n workspace is dead. Recreate it (or use any webhook target)
               and set N8N_WEBHOOK_URL on Vercel. Until then no client or admin
               notification is delivered — the redirect after signing is the
               ONLY thing telling a client to pay.
            2. UPI rail has rate_per_usd NULL, so INR clients are shown "we
               will confirm the exact amount" instead of a figure. Set it in
               /admin/payments/methods. Deliberately not guessed — the rate
               decides how much money arrives.
            3. QR images not uploaded. Put them in the `catalog-images` bucket
               and set payment_methods.qr_code_path to the object path.
            4. The 8 stalled payments are STILL pending with NULL amounts.
               Voiding them changes live rows and was never approved — SQL is
               in section 8 of the migration.
            5. Repo is PUBLIC (githubRepoVisibility flipped in August).

COMMIT      cf6c1a1, 4667333
DEPLOY      auto from main
DIRTY TREE  no
```

---

## 2026-09-06 (b) · Claude Opus 5 · Drop Stripe; wire the P2P settlement loop

```
ITEM        Owner rejected the Stripe Checkout direction. Wanted: client picks a
            settlement rail (UPI / QR / mobile money / bank transfer / crypto),
            admin manages rails internally. Also asked how and when the deposit
            link reaches the client after they sign.

ROOT CAUSE  IT NEVER REACHED THEM. There is no send, and there was no link.
              - accept() on /portal/agreement writes status='accepted' then
                calls load(), re-rendering the same page.
              - agreements_on_accept opens a `deposit` payments row — but it is
                a DB trigger and cannot notify anyone.
              - fireEvent (the n8n hook) is reachable ONLY from handleLead and
                logEvent. Acceptance goes browser -> Postgres directly and never
                touches the app server, so no event fires.
              - `grep -rn "portal/pay" src/ --include=*.tsx` returns ZERO hrefs.
                /portal/pay/[paymentId] was an orphan route.
            So the client signed, a payment row appeared in the database, and
            nothing linked to it or mentioned it. 2 agreements -> 0 collected.

            SECOND ROOT CAUSE — the admin half was dead at the database.
            `payments` has RLS on, policy payments_select_own (SELECT), and NO
            update policy for any role. /admin/payments ran
              await supabase.from('payments').update(...)  // error discarded
              setPayments(...)                             // optimistic repaint
            Every "Mark Paid" was refused by RLS and rendered as success, then
            reverted on reload. The approval loop has never once worked.

CHANGE      DELETED  src/app/api/checkout/route.ts
                     src/app/api/stripe/webhook/route.ts
                     src/lib/pricing.ts
                     — no code path in the repo creates a Stripe Checkout
                       Session any more.
            portal/agreement/[id]  acceptance resolves the deposit row and
                                   routes to /portal/pay/[id]; accepted view
                                   keeps a persistent "Choose how to pay" link.
            admin/payments         markPaid reads the error and RE-QUERIES the
                                   row; UI changes only if the DB changed.
            admin/payments/methods NEW. Rail manager: create/edit, live toggle
                                   separate from save, zero-live-rails banner,
                                   network required for crypto.
            AdminSidebar           + "Pay Rails".
            CartContext            cart -> quote, no card checkout.
            008_payment_rails.sql  REWRITTEN for the P2P model. NOT APPLIED.

STATUS      verified-deployed (code). Schema NOT applied — needs approval.

VERIFY      Stripe is gone from production:
              curl -o /dev/null -w "%{http_code}" -X POST \
                https://ography-v4.vercel.app/api/checkout   -> 404
              curl -o /dev/null -w "%{http_code}" -X POST \
                https://ography-v4.vercel.app/api/stripe/webhook -> 404
              curl -o /dev/null -w "%{http_code}" \
                https://ography-v4.vercel.app/              -> 200
            Route table from `next build` shows neither route.

OPEN        Blocking, in order:
            1. payment_methods still has 0 rows. Until a rail is live, the pay
               page is still a dead end. /admin/payments/methods now creates
               them but needs your real account details.
            2. Migration section 1 (admin write policy on payments) must be
               applied or "Mark Paid" will keep failing — honestly now, but
               still failing.
            3. Proof review UI (approve/reject) not built yet.
            4. Nothing still notifies the client on acceptance — the in-app
               redirect covers the same-session case only. Email/WhatsApp on
               AGREEMENT_ACCEPTED is not wired.
            5. /portal/pay does not yet show network / memo / local-currency
               amount, and has no copy-to-clipboard (a QR is unusable when the
               client is paying on the same phone).

COMMIT      5e03871 (code) · previous 2fc348d
DEPLOY      auto from main push; /api/checkout + /api/stripe/webhook both 404
DIRTY TREE  no
```

---

## 2026-09-06 · Claude Opus 5 · Homepage intro + the missing checkout rail

```
ITEM        1) Replace the homepage intro copy with three outcome phrases.
            2) "Checkout still cannot take money" — find out why and fix it.
            3) Identify the 8 stalled runs.

ROOT CAUSE  (1) Cosmetic. The two prose lines said something the page never
            repeated; the triad below them ("01 / Build Trust" …) already was
            the message.

            (2) There was NO code path in the repository that created a Stripe
            Checkout Session. `stripe` was in package.json but imported by zero
            files. STRIPE_SECRET_KEY appeared in zero files. Every button in the
            cart footer — including "Pay Upfront — Full Amount" — called
            handleRequestAll(), which does
            `window.location.href = '/contact?services=…'`. The webhook at
            /api/stripe/webhook was waiting for an event nothing could produce.
            Compounding it: the cart's two Stripe branches were gated on
            `item.stripe_link`, and catalog_items HAS NO stripe_link column, so
            `hasStripe`/`allHaveStripe` were permanently false and the cart
            always fell through to the "Request These Services" branch.

            (3) The 8 stalled runs are the 8 rows in `payments`. All 8:
            status='pending', amount_usd IS NULL, stripe_session_id IS NULL,
            paid_at IS NULL, created 27 Jul – 13 Aug. 8 payment_links exist to
            match. They cannot be collected (no amount) or reconciled (no
            session). Also measured: payment_methods has ZERO rows, so
            /portal/pay renders no way to pay even when reached; projects
            total_amount_usd is NULL on all 21.

CHANGE      src/app/page.tsx          intro -> Build Trust / Capture Attention /
                                      Scale Presence, resolving on "Market
                                      authority."; stacked reveal, 4.45s;
                                      prefers-reduced-motion; timer chain
                                      rewritten (nested setTimeout leaked).
            src/lib/pricing.ts        NEW. The pricing matrix: 6 fixed,
                                      9 "From $X" (floor, not total), 2 /mo
                                      retainers. Mixed carts refused.
            src/app/api/checkout/     NEW. Server-priced Stripe Checkout
              route.ts                Session; reuses handleLead + the
                                      agreements_recalc trigger for the amount.
            api/stripe/webhook/       Signature verification (was JSON.parse of
              route.ts                an unauthenticated public POST — a
                                      forgeable sale on a public repo);
                                      accepts the agreement instead of
                                      double-creating client+project;
                                      idempotent on stripe_session_id.
            src/context/CartContext   Real checkout wired to /api/checkout;
              .tsx                    dead stripe_link branches removed;
                                      auto-close timer moved state -> ref.
            supabase/migrations/      NOT APPLIED. Schema proposal + the
              008_payment_rails.sql   payment_methods blocker.

STATUS      verified-deployed (code). Stripe is NOT yet switched on — see below.

VERIFY      Intro, against the SHIPPED BUNDLE not the source:
              curl -s https://ography-v4.vercel.app/ -o live.html
              grep -o '"/_next/static/chunks/[^"]*\.js"' live.html | tr -d '"' | sort -u
              # fetch each; chunk 0-~jck.d63u.6.js contains "Market authority" (1)
              # and "Every great brand" (0).
            NOTE: grepping the page HTML for "Build Trust" proves nothing — that
            string is also in the Outcomes section, and the intro overlay is
            gated on useEffect so it is absent from SSR output entirely.

            Checkout route is live and the matrix works (writes nothing):
              curl -X POST .../api/checkout -d '{"name":"x","email":"a@b.co","items":[]}'
                -> 400 "Your cart is empty."
              curl -X POST .../api/checkout with the $1,200/mo retainer AND the
                $65 card set -> 409 "Monthly retainers and one-time projects
                have to be checked out separately…"

            Webhook now rejects forgery:
              POST /api/stripe/webhook with a hand-written
              checkout.session.completed body and no signature
                -> 500 "Webhook not configured"  (fails CLOSED)
              Row counts before and after all probes: payments 8, clients 17,
              projects 21, agreements 2 — unchanged. Nothing was written.

OPEN        Stripe env vars are NOT set. The webhook probe returns "Webhook not
            configured", which means STRIPE_SECRET_KEY and/or
            STRIPE_WEBHOOK_SECRET are absent on Vercel. Until both are set,
            /api/checkout returns 503 and the cart falls back to the quote flow.
            payment_methods still has 0 rows — the manual rail is still a dead
            end regardless of Stripe.

COMMIT      2fc348d05ba26b92f8fbafe86f0fba1f80565ece
DEPLOY      dpl_BGzbWHgKQHP1LEhT31uC2MLVJ1fS
DIRTY TREE  no
```

---

## 2026-08-14 · Antigravity · Homepage & Catalog sync from latest production capture

```
ITEM        Catalog empty read fix + Homepage sync from endi new capture
ROOT CAUSE  (1) /catalog fetch query requested non-existent columns (price, price_display,
            turnaround_time, stripe_link) causing Supabase HTTP 400 error.
            (2) Production copy and hooks on homepage needed updating to match the
            August 2026 deployed spec.
CHANGE      - src/app/catalog/page.tsx: updated query to select=*&order=sort_order,
              normalized base_price_usd/price_note/turnaround, added fallback catalog data.
            - src/app/page.tsx: integrated story intro typewriter experience, new hero
              headline/copy, "Outcomes Over Services" section, and fixed featured services.
            - .env.local created with Supabase keys for local runs.
            - OGRAPHY_V4_ENGINEER_HANDOFF.md updated with latest Vercel deployment URL.
STATUS      verified-local
VERIFY      npm run build passed cleanly (all 16 routes). Dev server tested on localhost:3000.
COMMIT      pending
DIRTY TREE  no
```

---

## 2026-08-13 · Claude (Cowork) · DEPLOYED — partial win, partial regression

```
ITEM        Merge to main; production deploy
ROOT CAUSE  n/a
CHANGE      recover/reconcile-2026-08-12 merged to main; Vercel built production
            from git for the first time since 29 May. No gitDirty flag.
STATUS      verified-deployed
VERIFY      curl -I /portal -> HTTP 307, Location: /login?next=%2Fportal
            (was: HTTP 200, x-matched-path /login, x-vercel-cache HIT, age 743573)
            Human test: signed in as endidgrace@gmail.com (non-admin, Google).
            Portal renders content. Homepage reachable from on-screen controls.
            Sign-out works. THE TEN-WEEK BUG IS CLOSED.
COMMIT      59d417d
DIRTY TREE  no
```

```
ITEM        REGRESSION — homepage, catalog, admin, AI Studio reverted to 29 May
ROOT CAUSE  MY ERROR, and I should have caught it.
            I claimed "the entire ten-week loss is one file, 124 lines". That was
            measured by diffing git HEAD against 03-Source. NEITHER OF THOSE WAS
            PRODUCTION. The 2 Aug production build contained work that existed in
            git NO, in 03-Source NO, and on disk NOWHERE.
            The evidence was in front of me: production's build id
            fXuUIdGykyjVCB9ugpbth matched nothing on any disk we searched. I
            recorded that as "the repo isn't here". What it actually meant is
            stronger — production was running code I could not inspect anywhere.
            I then measured the gap between the two artifacts I COULD inspect and
            called that the loss.
            Deploying from git therefore reverted every page whose only copy was
            in that vanished build.
CHANGE      none yet
STATUS      open — P1
VERIFY      Lost surfaces confirmed by Endi on 13 Aug:
              - homepage: hooks, feature presentation outdated
              - footer: privacy + terms links GONE
              - cookie consent: GONE
              - /catalog: renders nothing again (17 items, 16 active, SELECT
                policy permits anon — so this is the 29 May read-path bug back)
              - AI Studio: VISIBLE again; was deliberately hidden as
                "coming soon" after user feedback confirmed redundancy
              - admin payments: QR upload placeholder GONE
              - brief form step 3: was reading live catalog_items, back to static
              - AI Studio API: key was migrated HuggingFace -> DeepSeek and
                working; now "Failed to generate. Check your API key"
COMMIT      n/a
DIRTY TREE  n/a
```

```
ITEM        Is the lost work recoverable?
ROOT CAUSE  n/a
CHANGE      none
STATUS      open
VERIFY      Deployment dpl_5A1VcffPteqvqC3s9JCrBXP9nLe1 (2 Aug, the old
            production build) still exists in Vercel and is still servable at
            ography-v4-7pvel4ydt-endi-osuts-projects.vercel.app.
            Source is not downloadable, but the RENDERED HTML is — and for
            presentational surfaces (homepage copy, hooks, footer, consent
            banner) rendered HTML is a sufficient spec to rebuild from.
            The URL is behind Vercel deployment protection; Endi can open it
            while signed in to Vercel. Claude cannot fetch it.
            DO NOT DELETE THAT DEPLOYMENT.
COMMIT      n/a
DIRTY TREE  n/a
```

---

## 2026-08-12 · Claude (Cowork) · git recovery — steps 2-4

```
ITEM        Reconcile the surviving working copy into a fresh clone
ROOT CAUSE  n/a — recovery
CHANGE      Cloned ography-v4 (Endi), branched recover/reconcile-2026-08-12,
            copied 03-Source/src over the clone additively (no deletions).
STATUS      verified-local — NOT committed, NOT pushed. Step 5 is Endi's.
VERIFY      npm install (378 pkgs) -> npx tsc --noEmit -> silent
            npx next build -> Compiled successfully in 13.8s
            Route table: f /portal  f /admin (+children)  f /login
                         f /portal/ai-studio
            Previously all o (Static) — the stale-prerender condition.
COMMIT      branched from a576a4e; nothing committed yet
DIRTY TREE  yes, intentionally — awaiting Endi's review before commit
```

```
ITEM        How much work was actually lost to the untracked deploys?
ROOT CAUSE  n/a — measurement
CHANGE      none
STATUS      answered
VERIFY      Diffed repo HEAD against 03-Source as it stood BEFORE today's edits:
              src/middleware.ts          124 lines of genuine untracked work
              src/app/portal/page.tsx      0 lines — identical to HEAD
              src/app/login/page.tsx       0 lines — identical to HEAD
            package.json dependency delta: identical.
            Every other "differing" file was CRLF/LF line endings only.
            THE ENTIRE TEN-WEEK LOSS IS ONE FILE, 124 LINES, NOW RECOVERED.
COMMIT      n/a
DIRTY TREE  n/a
```

```
ITEM        supabase/migrations/002_project_events.sql was never run
ROOT CAUSE  002 is committed to main and carries the instruction "Run this in
            Supabase SQL Editor (Dashboard -> SQL Editor)". It was written,
            committed, and never executed. Confirmed against the live database:
            `project_events` does not exist, and neither do the two columns 002
            adds (projects.deliverable_url, projects.status).
            CONSEQUENCE 1: src/lib/modules/workflow.ts:40 inserts into
            project_events inside a try/catch commented "table may not exist
            yet - never block the main flow". Every state change since launch
            has been silently discarded. There is no audit trail.
            CONSEQUENCE 2: workflow.ts:87 writes deliverable_url to a column
            that does not exist.
            CONSEQUENCE 3: the portal reading project.deliverable_url was NOT a
            coding error. It was written against a schema 002 was supposed to
            create. The code was correct for a database that never happened.
            CONSEQUENCE 4: 002 contains
              create policy "Service role full access" ... using (true)
            i.e. the same defect class as the exposure closed today, written
            into a committed migration. The habit is documented, not accidental.
CHANGE      Wrote supabase/migrations/003_project_events_corrected.sql —
            creates project_events with restrictive RLS, deliberately does NOT
            add deliverable_url/status, revokes anon EXECUTE on the two
            SECURITY DEFINER functions, pins search_path on trigger helpers.
STATUS      written, NOT applied — needs review before running
VERIFY      after running: select count(*) from public.project_events; -> 0
                           and get_advisors(security) drops the RPC warnings
COMMIT      n/a
DIRTY TREE  n/a
```

```
ITEM        AGENTS.md and CLAUDE.md were never actually written
ROOT CAUSE  Both exist at repo root, which reads as "discipline files present,
            not honoured". They are not. AGENTS.md is 5 lines of tool-generated
            boilerplate wrapped in <!-- BEGIN:nextjs-agent-rules --> saying only
            "this is not the Next.js you know, read the docs". CLAUDE.md is one
            line: `@AGENTS.md`. Neither contains a single project-specific rule.
            No commit discipline, no deploy rule, no worklog requirement.
            The files were not ignored. There was nothing in them to ignore.
CHANGE      none yet — 05-Scripts/AGENTS.md holds the real rules and must
            replace the stub, preserving the nextjs-agent-rules block.
STATUS      open
VERIFY      repo AGENTS.md > 100 lines and contains the deploy rules
COMMIT      n/a
DIRTY TREE  n/a
```

```
ITEM        Agent debris committed to main
ROOT CAUSE  An agent wrote output using an absolute sandbox path. The result was
            committed as a nested directory:
              src/app/admin/catalog/mnt/user-data/outputs/ography-v4/src/app/...
            containing three .tsx files. Because they sit under src/app/, Next
            treats them as routes.
CHANGE      none — the mounted filesystem denied the delete
STATUS      open — one command for Endi
VERIFY      git rm -r "src/app/admin/catalog/mnt" && npx next build
COMMIT      n/a
DIRTY TREE  n/a
```

---

## 2026-08-12 · Claude (Cowork) · build verification of the code fixes

```
ITEM        Verify the 12 Aug code fixes actually compile and behave
ROOT CAUSE  n/a — verification pass
CHANGE      Copied 03-Source to an isolated sandbox, npm install (378 pkgs),
            npx tsc --noEmit, npx next build.
            Fixed 2 real type errors found: portal purchases tab still read
            `p.name` and `p.service`, neither of which exists on `projects`.
STATUS      verified-local  (NOT deployed — see blocker below)
VERIFY      npx tsc --noEmit  -> clean
            npx next build    -> Compiled successfully
COMMIT      n/a — 03-Source is not a git repository
DIRTY TREE  n/a
```

```
ITEM        force-dynamic was silently doing nothing
ROOT CAUSE  `export const dynamic = 'force-dynamic'` was placed inside
            portal/page.tsx, admin/page.tsx and login/page.tsx — all of which
            are 'use client' components. Next.js IGNORES route segment config in
            Client Components. The first build still reported these routes as
            ○ (Static), i.e. the exact condition that let production serve
            /portal, /admin and /login from a 7.7-day-old edge-cached prerender.
            This would have shipped looking correct and fixed nothing.
CHANGE      Added pass-through Server Component layouts carrying the config:
              src/app/portal/layout.tsx
              src/app/admin/layout.tsx
              src/app/login/layout.tsx
            each exporting `dynamic = 'force-dynamic'` and `revalidate = 0`.
            Removed the inert exports from the client pages, replaced with a
            pointer comment so nobody re-adds them.
STATUS      verified-local
VERIFY      next build route table now reports:
              ƒ /portal   ƒ /admin (+ all children)   ƒ /login
              ƒ /portal/ai-studio
            Previously all ○ (Static).
COMMIT      n/a — 03-Source is not a git repository
DIRTY TREE  n/a
```

```
ITEM        BUILD_ID hunt — production tree still NOT located
ROOT CAUSE  n/a
CHANGE      none
STATUS      open — BLOCKER
VERIFY      Reported result was
              C:\Users\Endi Osut\tradelynk-v2\.next\BUILD_ID -> -4KtxXqhFeH9hmQyr6x2g
            That is the TradeLynk project, and the id does NOT match.
            OGraphy production build id is fXuUIdGykyjVCB9ugpbth.
            The ography-v4 git repository has not been found yet. Nothing can be
            deployed until it is.
COMMIT      n/a
DIRTY TREE  n/a
```

---

## 2026-08-12 · Claude (Cowork) · database hotfix

```
ITEM        Anonymous write access to all client-owned tables
ROOT CAUSE  Every RLS policy on clients, projects, payments, briefs, deliverables,
            catalog_items and brief_files was USING (true) for the `public` role,
            covering SELECT/UPDATE/DELETE. The anon key is published in the site's
            client JS, so any visitor could read, alter or destroy all client data.
CHANGE      Migration `hotfix_revoke_public_write_policies` — dropped all
            unconditional INSERT/UPDATE/DELETE policies on those tables.
            Migration `hotfix_close_brief_files_writes` — same for brief_files.
            SELECT policies deliberately left untouched so no read path broke.
            Preserved one intentional public write: briefs_insert_public (+ brief_files
            insert) so anonymous brief submission still works.
STATUS      verified-deployed
VERIFY      select count(*) from pg_policies where schemaname='public'
              and cmd in ('INSERT','UPDATE','DELETE','ALL')
              and roles::text like '%public%'
              and coalesce(qual,'true')='true'
              and coalesce(with_check,'true')='true';
            → returns 1 (brief_files_insert, intentional)
COMMIT      n/a — database migration, not repository code
DIRTY TREE  n/a
```

```
ITEM        Client portal empty for every user who has ever logged in
ROOT CAUSE  clients.user_id was NULL on all 10 rows while 7 accounts existed in
            auth.users. Nothing linked a signup to a client record, so the portal's
            `clients where user_id = auth.uid()` lookup returned zero rows for
            everyone. No client -> no projects -> blank page.
CHANGE      Migration `link_auth_users_to_clients` —
            (1) backfilled clients.user_id by case-insensitive email match
            (2) added security-definer function public.link_client_on_signup() and
                trigger on_auth_user_created_link_client on auth.users, which claims
                an existing client row by email or creates one
            (3) backfilled client rows for auth users that had none
STATUS      verified-deployed
VERIFY      select count(*) from auth.users u where not exists
              (select 1 from public.clients c where c.user_id = u.id);
            → returns 0 (was 4)
COMMIT      n/a — database migration, not repository code
DIRTY TREE  n/a
```

```
ITEM        Open findings handed to engineer, not fixed in this session
ROOT CAUSE  n/a — recorded so they are not lost
CHANGE      none
STATUS      open
VERIFY      see Engineer Handoff Rev 2, sections 5-9:
            D3  RLS SELECT still USING (true) — read exposure remains (P0)
            D4  middleware refresh_token_already_used — login loop (P1)
            D5  gated routes serve 7.7-day edge-cached login shell (P1)
            D6  portal has no navigation — testers could not leave the page (P1)
            D7  window.location.href races the cookie write after sign-in (P1)
            D8  x-og-client-state header written by middleware, read by nobody (P2)
            D9  portal reads project.deliverable_url; files live in `deliverables` (P2)
            D10 portal shows no payment status, deadline or project_ref (P2)
            D11 catalog renders 0 services though 16 of 17 rows are active (P2)
            D12 cart funnel: 12 carts, 0 cart_items, 0 checkout_sessions (P3)
            D13 production deployed from an uncommitted tree since 2026-05-29 (BLOCKER)
COMMIT      n/a
DIRTY TREE  n/a
```

---

## 2026-05-29 → 2026-08-02 · Codex / Claude Code in VS Code · UNRECORDED

```
ITEM        Unknown — approximately ten weeks of production changes
ROOT CAUSE  Four production deploys were made via Vercel CLI from a working tree with
            uncommitted changes, all recording the stale SHA a576a4e3. No agent had a
            standing instruction to commit before deploying or to record its work.
            This file, and AGENTS.md, exist to prevent recurrence.
CHANGE      Unknown. The working tree is at
            C:\Users\Endi Osut\Downloads\Ventures\01-Ography\03-Source\
            and must be reconciled into git before any further work.
STATUS      open — BLOCKER
VERIFY      `git status` in the source directory; capture the full diff; commit or
            discard; push to main; redeploy from git; confirm the new deployment
            carries no gitDirty flag and a current SHA.
COMMIT      last trustworthy: a576a4e3a455422e31aff20ddcf2df42167e70bd (2026-05-29 10:20 UTC)
DIRTY TREE  YES — on all four deploys after that commit
```

---

<!--
Template — copy this block, fill it, place it at the TOP of the file.

## YYYY-MM-DD · <who> · <short session label>

```
ITEM
ROOT CAUSE
CHANGE
STATUS      in-progress | fixed-local | deployed | verified-deployed
VERIFY
COMMIT      <sha>
DEPLOY      <vercel deployment id>
DIRTY TREE  no
```
-->
