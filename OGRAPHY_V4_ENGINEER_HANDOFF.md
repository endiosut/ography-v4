# OGraphy V4 — Full Stack Engineer Handoff
**Prepared for:** Dueng  
**Date:** 12 Aug 2026  
**Status:** Login flow broken, portal misbehaving, admin features not reflected

---

## 1. Repository & Access

| Item | Value |
|------|-------|
| **V4 App URL** | `https://ography-v4-7pvel4ydt-endi-osuts-projects.vercel.app/` |
| **Landing Page Repo** | `C:\Users\Endi Osut\ography-deploy` (git, master, no remote) |
| **V4 Source Code** | `C:\Users\Endi Osut\Downloads\Ventures\01-Ography\03-Source\` |
| **Supabase URL** | `https://unzwefrtgsgmtljlbavf.supabase.co` |
| **Supabase Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTM1MjMsImV4cCI6MjA5MjA4OTUyM30.QPoyf_UYDD82xW1KYaSbukPrfMoTAACVMKPT05HKI90` |
| **Admin Email** | `endiosut.eo@gmail.com` |
| **n8n Webhook** | `https://ographyy.app.n8n.cloud/webhook/ography-new-lead` |
| **Stripe Test Links** | Echo Launch Kit, Brand Amplification, Creative Partner (see CURRENT_STATE.md) |

---

## 2. Stack

- **Framework:** Next.js 16.2.4 (App Router)
- **React:** 19.2.4
- **Language:** TypeScript
- **Auth:** Supabase Auth (Google OAuth + Magic Link + Email/Password for admin)
- **Database:** Supabase (PostgreSQL) with RLS
- **Payments:** Stripe
- **AI:** Claude claude-sonnet-4-6 via `/api/ai`
- **Styling:** Inline styles, dark/gold theme (#0a0906, #c9a96e, #f0e8d8)
- **Fonts:** Montserrat (body) + Cormorant Garamond (headings)

---

## 3. Database Schema (Key Tables)

```
clients → id, user_id, name, email, phone, company, instagram, country, source, status, notes
projects → id, project_ref (OG-YYYY-NNN), client_id, catalog_item_id, service_name, stage, 
           total_amount_usd, deposit_paid_usd, balance_due_usd, deadline, delivered_at, notes
briefs → id, project_id, client_id, business_name, business_description, target_audience,
         industry, style_direction, colors_liked, status
payments → id, project_id, client_id, stripe_payment_intent, amount_usd, milestone, status, paid_at
deliverables → id, project_id, file_name, file_url, file_type, version, is_final, notes
catalog_items → id, name, category, subcategory, description, base_price_usd, is_featured, is_active
brief_files → id, brief_id, client_id, file_name, file_url, file_type
```

**Project Stage Flow:**
```
payment_received → brief_submitted → in_production → review → revision → delivering → completed
```

**Portal Status Flow (client-facing):**
```
lead → confirmed → in_production → review → delivered → completed
```

---

## 4. Login Flow (Current Implementation)

### Routes
| Route | Access | Description |
|-------|--------|-------------|
| `/login` | Public | Login page (Google, Magic Link, Admin email/password) |
| `/auth/callback` | Public | OAuth callback handler |
| `/portal` | Authenticated client | Client dashboard |
| `/portal/ai-studio` | Authenticated client | AI Studio (4 tabs) |
| `/portal/brief/[projectId]` | Authenticated client | 3-step brief wizard |
| `/admin` | Admin only (endiosut.eo@gmail.com) | Admin dashboard |
| `/admin/projects` | Admin | Project management |
| `/admin/clients` | Admin | Client management |
| `/admin/briefs` | Admin | Brief management |
| `/admin/payments` | Admin | Payment tracking |
| `/admin/catalog` | Admin | Catalog management |
| `/admin/analytics` | Admin | Analytics dashboard |

### Auth Flow
1. **Client Login:** Google OAuth or Magic Link → `/auth/callback` → checks email → if admin → `/admin`, else → `/portal`
2. **Admin Login:** Email/password → `signInWithPassword()` → checks email → redirects to `/admin`
3. **Middleware:** Checks Supabase session on every request, redirects unauthenticated users to `/login`

### Known Login Bugs (from STATUS.md, May 28 audit)
- `/login` redirects logged-in admin to `/admin` → crashes ("page couldn't load")
- Portal sign-in button inactive on mobile

---

## 5. What the Portal Should Show (Client-Facing)

The portal (`/portal`) should display:

### Header
- Welcome message with client name
- Company name (if set)
- "+ New Request" button → `/contact`

### Stats Cards
- Active Projects count
- Completed Projects count
- Available Services count (from catalog)

### AI Studio CTA Banner
- Link to `/portal/ai-studio`
- "Generate briefs, explore aesthetics, get brand guidance"

### Tabs
1. **Active Projects** — Shows projects with:
   - Service name
   - Creation date
   - Status badge (Request Received → Confirmed → In Production → Under Review → Delivered → Completed)
   - Progress bar (6 stages)
   - Notes preview
   - "Download Files" button (if deliverable_url exists)
   - "Ask AI Assistant" button (if in_production or review)

2. **All Requests** — Lists all projects with status

3. **Account** — Shows:
   - Name, Email, Company, Account Status
   - Sign Out button

---

## 6. What the Admin Has That Portal Should Reflect

The admin dashboard (`/admin`) has features that should be reflected on the portal:

### Admin Features to Mirror on Portal

| Admin Feature | Portal Equivalent | Status |
|---------------|-------------------|--------|
| **Project Stage Tracking** (7 stages) | Status flow (6 stages) | ✅ Exists but may not update |
| **Pipeline View** (Kanban) | Project cards with progress bar | ✅ Exists |
| **Client Info** (name, email, company) | Account settings | ✅ Exists |
| **Brief Management** | Brief submission wizard (`/portal/brief/[projectId]`) | ✅ Exists |
| **Payment Tracking** | Not shown on portal | ❌ Missing |
| **Deliverable Files** | "Download Files" button | ⚠️ Partial (only if deliverable_url exists) |
| **Project Notes** | Notes preview on project cards | ⚠️ Partial (truncated to 120 chars) |
| **Deadline Display** | Not shown on portal | ❌ Missing |
| **Project Reference** (OG-YYYY-NNN) | Not shown on portal | ❌ Missing |

### What's Missing on Portal
1. **Payment status** — Clients can't see if they've paid or have a balance due
2. **Deadline** — Clients can't see project deadlines
3. **Project reference** — Clients can't see their OG-YYYY-NNN reference number
4. **Deliverable files** — Only works if `deliverable_url` is set on the project row; should use `deliverables` table
5. **Brief status** — Clients can't see the status of their submitted briefs
6. **Brief files** — Clients can't see uploaded files from `brief_files` table

---

## 7. Specific Bugs to Fix

### Bug 1: Login Redirect Crash
**Symptom:** `/login` redirects logged-in admin to `/admin` → crashes  
**File:** `src/app/login/page.tsx` (line 68)  
**Issue:** After `signInWithPassword()`, the code does `window.location.href = data.user?.email === ADMIN_EMAIL ? '/admin' : '/portal'` — but the middleware may not have the session cookies set yet, causing a race condition.  
**Fix:** Use `router.push()` instead of `window.location.href`, or add a small delay to let cookies propagate. Also check that the middleware's `/login` handler (lines 157-178) properly handles the redirect when user is already logged in.

### Bug 2: Portal Shows Empty State for New Clients
**Symptom:** New clients see "Your request is being reviewed" even after submitting  
**File:** `src/app/portal/page.tsx` (line 237)  
**Issue:** The portal checks `if (!client)` and shows the pending state. But the middleware sets `x-og-client-state` header which the portal never reads. The portal should use this header or check the client state from Supabase.  
**Fix:** Read the `x-og-client-state` header or add a more robust check for whether the client has submitted a brief.

### Bug 3: Portal Doesn't Show Deliverables Properly
**Symptom:** "Download Files" button doesn't appear  
**File:** `src/app/portal/page.tsx` (line 317)  
**Issue:** The code checks `project.deliverable_url` but the schema doesn't have this field on `projects`. Deliverables are in a separate `deliverables` table.  
**Fix:** Query the `deliverables` table for each project and show download links from there.

### Bug 4: Portal Missing Payment Info
**Symptom:** Clients can't see payment status  
**File:** `src/app/portal/page.tsx`  
**Issue:** No payment data is fetched or displayed.  
**Fix:** Query `payments` table for the client's projects and display payment status, amounts, and receipts.

### Bug 5: Portal Missing Deadline and Project Ref
**Symptom:** Clients can't see deadlines or reference numbers  
**File:** `src/app/portal/page.tsx`  
**Issue:** The `Project` type doesn't include `deadline` or `project_ref` fields.  
**Fix:** Add these fields to the type and display them on project cards.

---

## 8. Files Dueng Needs to Work With

### Core Files
| File | Purpose |
|------|---------|
| `src/middleware.ts` | Auth routing, session check, client state detection |
| `src/app/login/page.tsx` | Login page (Google, Magic Link, Admin) |
| `src/app/auth/callback/route.ts` | OAuth callback handler |
| `src/app/portal/page.tsx` | Client dashboard (main target) |
| `src/app/portal/ai-studio/page.tsx` | AI Studio |
| `src/app/portal/brief/[projectId]/page.tsx` | Brief submission wizard |
| `src/app/admin/page.tsx` | Admin dashboard (reference) |
| `src/app/admin/projects/page.tsx` | Admin project management (reference) |
| `src/lib/supabase.ts` | Supabase client + query functions |
| `src/components/NavBar.tsx` | Navigation component |
| `src/components/AdminSidebar.tsx` | Admin sidebar |

### Reference Files
| File | Purpose |
|------|---------|
| `docs/CURRENT_STATE.md` | Landing page state |
| `docs/CHANGELOG.md` | Landing page changelog |
| `OGraphy — STATUS.md` | Known bugs list |
| `02-Architecture/ography_v4_schema.sql` | Full database schema |
| `.claude/projects/c--Users-Endi-Osut-ography-v4/memory/project_ography_v4.md` | Project context |

---

## 9. Environment Variables Needed

```env
NEXT_PUBLIC_SUPABASE_URL=https://unzwefrtgsgmtljlbavf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTM1MjMsImV4cCI6MjA5MjA4OTUyM30.QPoyf_UYDD82xW1KYaSbukPrfMoTAACVMKPT05HKI90
ANTHROPIC_API_KEY=<needed for AI Studio>
```

---

## 10. Priority Fix Order

1. **Fix login redirect crash** — Most critical, blocks all access
2. **Fix portal deliverables** — Clients need to download their files
3. **Add payment status to portal** — Clients need to see what they've paid
4. **Add deadline and project ref to portal** — Clients need to see their project details
5. **Fix portal empty state for new clients** — Better onboarding experience
6. **Mobile sign-in button** — Responsive fix

---

## 11. Testing Checklist

- [ ] Login with Google OAuth → redirects to `/portal` (not `/admin` unless admin email)
- [ ] Login with Magic Link → email sent, link works, redirects correctly
- [ ] Admin login with email/password → redirects to `/admin` without crash
- [ ] Portal shows client name and company
- [ ] Portal shows active/completed project counts
- [ ] Portal shows project cards with status badges and progress bars
- [ ] Portal shows "Download Files" button when deliverables exist
- [ ] Portal shows payment status (paid/pending/balance due)
- [ ] Portal shows project deadlines and reference numbers
- [ ] Portal AI Studio loads and functions
- [ ] Portal brief wizard works end-to-end
- [ ] Mobile responsive on all pages
- [ ] Admin dashboard loads without crash
- [ ] Admin can advance project stages
- [ ] Admin can view client details

---

*End of handoff document.*
