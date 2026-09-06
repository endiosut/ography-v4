'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'

// Payment rails — the admin side of the P2P settlement model.
//
// This screen did not exist. payment_methods had 0 rows and no UI, so
// /portal/pay rendered an empty method list: the page loaded, looked correct,
// and gave the client no way to send money. Every other part of the manual
// payment loop was built; the thing that fills it was not.
//
// A rail here is what a client sees as an option at /portal/pay. It goes live
// the moment `is_active` is on, so the toggle is deliberately separate from
// saving the details — you fill in a wallet address first and switch it on
// second, never both by accident.

type Method = {
  id: string
  label: string
  method_type: string
  country_code: string | null
  currency_code: string
  asset_code: string | null
  network: string | null
  memo_tag: string | null
  instructions: string
  account_holder: string | null
  account_reference: string | null
  qr_code_path: string | null
  rate_per_usd: number | null
  rate_updated_at: string | null
  min_amount_usd: number | null
  max_amount_usd: number | null
  is_active: boolean
  sort_order: number
}

const TYPES = ['upi', 'mobile_money', 'bank_transfer', 'crypto', 'cash', 'other'] as const

const TYPE_LABEL: Record<string, string> = {
  upi: 'UPI', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer',
  crypto: 'Crypto', cash: 'Cash', other: 'Other',
}

// Networks worth offering. Sending USDT to a TRC20 address over BEP20 destroys
// the funds, so this is a required field for crypto, not a nicety.
const NETWORKS = ['TRC20', 'ERC20', 'BEP20', 'SOL', 'Lightning', 'BTC']

// QR codes live in `payment-qr`, NOT `catalog-images`.
//
// catalog-images grants INSERT/UPDATE/DELETE to `public`, so any anonymous
// visitor can overwrite an object in it. A payment QR stored there could be
// swapped for an attacker's own code and silently collect every future
// payment. `payment-qr` is public to read and admin-only to write.
const QR_BUCKET = 'payment-qr'

// HEIC matters: iPhones shoot HEIC by default, and a QR screenshot saved from
// a phone is the most likely file here.
const QR_ACCEPT = 'image/png,image/jpeg,image/webp,image/heic,image/heif,image/*'
const QR_MAX_BYTES = 5 * 1024 * 1024

const blank = (): Partial<Method> => ({
  label: '', method_type: 'upi', country_code: '', currency_code: 'USD',
  asset_code: '', network: '', memo_tag: '', instructions: '',
  account_holder: '', account_reference: '', rate_per_usd: null,
  min_amount_usd: null, max_amount_usd: null, is_active: false, sort_order: 0,
})

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Partial<Method> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [qrBusy, setQrBusy] = useState(false)
  // Public URL for the QR currently on the draft, so the admin sees the actual
  // stored image rather than a filename they have to trust.
  const [qrPreview, setQrPreview] = useState<string | null>(null)

  const qrPublicUrl = useCallback((path: string | null | undefined) => {
    if (!path) return null
    const { data } = supabase.storage.from(QR_BUCKET).getPublicUrl(path)
    return data?.publicUrl ?? null
  }, [])

  // Keep the preview in step with whichever rail is being edited.
  useEffect(() => {
    setQrPreview(qrPublicUrl(draft?.qr_code_path))
  }, [draft?.qr_code_path, qrPublicUrl])

  const uploadQr = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('The QR must be an image file.')
      return
    }
    if (file.size > QR_MAX_BYTES) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — keep it under 5MB.`)
      return
    }

    setQrBusy(true); setError(null); setNotice(null)

    // Path is keyed on the rail where one exists, and on a timestamp for a rail
    // that has not been saved yet, so two drafts cannot collide.
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
    const key = draft?.id || `new-${Date.now()}`
    const path = `${key}/${Date.now()}-${safe}`

    const { error: upErr } = await supabase.storage
      .from(QR_BUCKET).upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) {
      console.error('[admin/methods] qr upload:', upErr.message)
      setError(
        /row-level security|not authorized|403/i.test(upErr.message)
          ? 'Storage refused the upload. Confirm you are signed in as the admin account.'
          : `QR upload failed: ${upErr.message}`
      )
      setQrBusy(false)
      return
    }

    // Held on the draft only. It reaches the database when the rail is saved,
    // so an accidental upload can be abandoned by cancelling.
    setDraft(d => (d ? { ...d, qr_code_path: path } : d))
    setQrBusy(false)
    setNotice('QR uploaded. Save the rail to publish it.')
  }

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('payment_methods').select('*').order('sort_order')
    if (err) {
      console.error('[admin/methods] load:', err.message)
      setError(`Could not load payment methods: ${err.message}`)
    } else {
      setMethods((data || []) as Method[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const isCrypto = draft?.method_type === 'crypto'

  const validate = (d: Partial<Method>): string | null => {
    if (!d.label?.trim()) return 'Give the rail a name — this is what the client sees.'
    if (!d.currency_code?.trim()) return 'Currency is required.'
    if (!d.account_reference?.trim()) {
      return 'Without an account reference the client has nowhere to send money.'
    }
    if (d.method_type === 'crypto' && !d.network?.trim()) {
      return 'Crypto needs a network. USDT sent on the wrong chain is unrecoverable.'
    }
    if (!d.instructions?.trim()) {
      return 'Instructions are required — this is the only thing telling the client what to do.'
    }
    return null
  }

  const save = async () => {
    if (!draft) return
    const problem = validate(draft)
    if (problem) { setError(problem); return }

    setBusy(true); setError(null); setNotice(null)

    // Empty strings must become NULL, not ''. A '' country_code would fail to
    // match any region filter while looking populated in the table.
    const payload = {
      label: draft.label!.trim(),
      method_type: draft.method_type,
      country_code: draft.country_code?.trim() || null,
      currency_code: draft.currency_code!.trim().toUpperCase(),
      asset_code: draft.asset_code?.trim().toUpperCase() || null,
      network: draft.network?.trim() || null,
      memo_tag: draft.memo_tag?.trim() || null,
      instructions: draft.instructions!.trim(),
      account_holder: draft.account_holder?.trim() || null,
      account_reference: draft.account_reference!.trim(),
      qr_code_path: draft.qr_code_path || null,
      rate_per_usd: draft.rate_per_usd ?? null,
      rate_updated_at: draft.rate_per_usd != null ? new Date().toISOString() : null,
      min_amount_usd: draft.min_amount_usd ?? null,
      max_amount_usd: draft.max_amount_usd ?? null,
      is_active: Boolean(draft.is_active),
      sort_order: Number(draft.sort_order) || 0,
    }

    const q = draft.id
      ? supabase.from('payment_methods').update(payload).eq('id', draft.id)
      : supabase.from('payment_methods').insert(payload)

    // The error is CHECKED, not discarded. /admin/payments does
    // `await supabase...update(...)` and then optimistically repaints the row,
    // so an RLS refusal shows as success and the database never changes.
    const { error: err } = await q
    if (err) {
      console.error('[admin/methods] save:', err.message, err.code)
      setError(
        err.code === '42501'
          ? 'The database refused this write (RLS). Confirm you are signed in as the admin account.'
          : `Save failed: ${err.message}`
      )
      setBusy(false)
      return
    }

    setDraft(null)
    setBusy(false)
    setNotice('Saved.')
    await load()
  }

  const toggleActive = async (m: Method) => {
    setError(null); setNotice(null)
    const next = !m.is_active
    const { error: err } = await supabase
      .from('payment_methods').update({ is_active: next }).eq('id', m.id)
    if (err) {
      console.error('[admin/methods] toggle:', err.message)
      setError(`Could not change visibility: ${err.message}`)
      return
    }
    // Re-read rather than patching local state, so what is shown is what the
    // database actually holds.
    await load()
    setNotice(next ? 'Rail is now live for clients.' : 'Rail hidden from clients.')
  }

  const remove = async (m: Method) => {
    if (!confirm(`Delete "${m.label}"? Past payments that used it keep their record.`)) return
    const { error: err } = await supabase.from('payment_methods').delete().eq('id', m.id)
    if (err) { setError(`Delete failed: ${err.message}`); return }
    await load()
  }

  const activeCount = methods.filter(m => m.is_active).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '2.5rem', minWidth: 0 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '.55rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.4rem' }}>
            Finance · <Link href="/admin/payments" style={{ color: 'var(--cream-muted)' }}>Payments</Link> / Rails
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '1.8rem', fontWeight: 300, color: 'var(--cream)' }}>
            Payment Methods
          </h1>
          <p style={{ fontSize: '.75rem', color: 'var(--cream-muted)', marginTop: '.5rem', lineHeight: 1.7, maxWidth: 620 }}>
            What a client can choose from on their payment screen. A rail is only
            offered when it is live.
          </p>
        </div>

        {/* The one number that decides whether anyone can pay at all. */}
        {!loading && activeCount === 0 && (
          <div style={{ border: '1px solid rgba(245,158,11,.35)', background: 'rgba(245,158,11,.07)', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '.78rem', color: '#f59e0b', lineHeight: 1.7 }}>
            <strong>No live payment methods.</strong> Every client reaching the payment
            screen right now sees an empty list and cannot pay. Add a rail below and
            switch it on.
          </div>
        )}

        {error && (
          <div style={{ border: '1px solid rgba(239,68,68,.35)', background: 'rgba(239,68,68,.07)', padding: '.85rem 1.1rem', marginBottom: '1rem', fontSize: '.75rem', color: '#ef4444', lineHeight: 1.6 }}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ border: '1px solid rgba(39,174,96,.3)', background: 'rgba(39,174,96,.07)', padding: '.85rem 1.1rem', marginBottom: '1rem', fontSize: '.75rem', color: '#27ae60' }}>
            {notice}
          </div>
        )}

        {!draft && (
          <button onClick={() => { setDraft(blank()); setError(null); setNotice(null) }} style={btnPrimary}>
            + Add a payment rail
          </button>
        )}

        {draft && (
          <div style={{ border: '1px solid var(--border)', background: 'var(--dark)', padding: '1.5rem', marginBottom: '1.75rem' }}>
            <div style={{ fontSize: '.62rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1.25rem' }}>
              {draft.id ? 'Edit rail' : 'New rail'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
              <Field label="Name the client sees" hint="e.g. “UPI (India)”, “USDT — Binance”">
                <input style={input} value={draft.label || ''} onChange={e => setDraft({ ...draft, label: e.target.value })} />
              </Field>

              <Field label="Type">
                <select style={input} value={draft.method_type} onChange={e => setDraft({ ...draft, method_type: e.target.value })}>
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </Field>

              <Field label="Account holder" hint="Name the client will see on their end">
                <input style={input} value={draft.account_holder || ''} onChange={e => setDraft({ ...draft, account_holder: e.target.value })} />
              </Field>

              <Field
                label={isCrypto ? 'Wallet address' : 'Account reference'}
                hint={isCrypto ? 'The address funds are sent to' : 'VPA, phone number, IBAN or account number'}
              >
                <input style={input} value={draft.account_reference || ''} onChange={e => setDraft({ ...draft, account_reference: e.target.value })} />
              </Field>

              {isCrypto && (
                <>
                  <Field label="Network — required" hint="Wrong network = funds destroyed, not delayed">
                    <select style={input} value={draft.network || ''} onChange={e => setDraft({ ...draft, network: e.target.value })}>
                      <option value="">Select a network…</option>
                      {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field label="Asset" hint="USDT, BTC…">
                    <input style={input} value={draft.asset_code || ''} onChange={e => setDraft({ ...draft, asset_code: e.target.value })} />
                  </Field>
                  <Field label="Memo / tag" hint="Only if the receiving exchange requires one">
                    <input style={input} value={draft.memo_tag || ''} onChange={e => setDraft({ ...draft, memo_tag: e.target.value })} />
                  </Field>
                </>
              )}

              <Field label="Currency" hint="What the client actually sends">
                <input style={input} value={draft.currency_code || ''} onChange={e => setDraft({ ...draft, currency_code: e.target.value })} />
              </Field>

              <Field label="Country code" hint="Blank = offered everywhere">
                <input style={input} value={draft.country_code || ''} onChange={e => setDraft({ ...draft, country_code: e.target.value })} />
              </Field>

              <Field label="Rate per 1 USD" hint="Blank = client is told to ask. Never assumed 1:1.">
                <input
                  style={input} type="number" step="0.0001"
                  value={draft.rate_per_usd ?? ''}
                  onChange={e => setDraft({ ...draft, rate_per_usd: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </Field>

              <Field label="Min (USD)" hint="Blank = no minimum">
                <input style={input} type="number" value={draft.min_amount_usd ?? ''} onChange={e => setDraft({ ...draft, min_amount_usd: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>

              <Field label="Max (USD)" hint="Blank = no maximum">
                <input style={input} type="number" value={draft.max_amount_usd ?? ''} onChange={e => setDraft({ ...draft, max_amount_usd: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>

              <Field label="Order" hint="Lower shows first">
                <input style={input} type="number" value={draft.sort_order ?? 0} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
              </Field>
            </div>

            {/* ── QR CODE ─────────────────────────────────────────────────
                Same click-the-placeholder pattern as /admin/catalog/upload.
                Optional by design: the copyable UPI ID or Pay ID is what most
                clients will actually use, because they are paying on the same
                phone that would otherwise have to display the QR. */}
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '.55rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--cream-dim)', marginBottom: '.35rem' }}>
                  QR code
                </div>
                <label
                  htmlFor="qr-input"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 150, height: 150, cursor: qrBusy ? 'wait' : 'pointer',
                    border: `1px dashed ${qrPreview ? 'var(--border)' : 'rgba(201,169,110,.4)'}`,
                    background: qrPreview ? '#fff' : 'var(--dark2, #0f0d0a)',
                    borderRadius: 6, overflow: 'hidden',
                  }}
                >
                  {qrBusy ? (
                    <span style={{ fontSize: '.6rem', color: 'var(--cream-muted)' }}>Uploading…</span>
                  ) : qrPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrPreview} alt="Payment QR" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                  ) : (
                    <span style={{ fontSize: '.6rem', color: 'rgba(201,169,110,.55)', textAlign: 'center', lineHeight: 1.6, padding: '0 .75rem' }}>
                      ＋<br />Click to upload<br />
                      <span style={{ fontSize: '.52rem', color: 'var(--cream-dim)' }}>PNG · JPG · HEIC</span>
                    </span>
                  )}
                </label>
                <input
                  id="qr-input"
                  type="file"
                  accept={QR_ACCEPT}
                  disabled={qrBusy}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    // Reset so re-picking the same file still fires onChange.
                    e.target.value = ''
                    if (f) uploadQr(f)
                  }}
                  style={{ display: 'none' }}
                />
                {draft.qr_code_path && !qrBusy && (
                  <button
                    onClick={() => setDraft({ ...draft, qr_code_path: null })}
                    style={{ ...btnTiny, marginTop: '.5rem', color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}
                  >
                    Remove QR
                  </button>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 240 }}>
                <Field label="Instructions the client reads" hint="Be literal. This is the only thing telling them what to do.">
                  <textarea
                    style={{ ...input, minHeight: 110, resize: 'vertical' }}
                    value={draft.instructions || ''}
                    onChange={e => setDraft({ ...draft, instructions: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginTop: '1rem', fontSize: '.75rem', color: 'var(--cream-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(draft.is_active)} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} />
              Live — offer this to clients now
            </label>

            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.25rem' }}>
              <button onClick={save} disabled={busy} style={{ ...btnPrimary, opacity: busy ? .5 : 1 }}>
                {busy ? 'Saving…' : 'Save rail'}
              </button>
              <button onClick={() => { setDraft(null); setError(null) }} style={btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--cream-muted)', padding: '3rem', textAlign: 'center' }}>Loading…</div>
        ) : methods.length === 0 ? (
          <div style={{ color: 'var(--cream-muted)', padding: '3rem', textAlign: 'center', fontSize: '.85rem' }}>
            No payment rails configured yet.
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', marginTop: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--dark)' }}>
                  {['Rail', 'Type', 'Sends to', 'Currency', 'Rate/USD', 'Live', ''].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {methods.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: i < methods.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--dark)' }}>
                    <td style={{ ...td, color: 'var(--cream)' }}>
                      {m.label}
                      {m.method_type === 'crypto' && m.network && (
                        <span style={{ marginLeft: '.5rem', fontSize: '.55rem', color: 'var(--gold)', border: '1px solid rgba(201,169,110,.3)', padding: '.1rem .35rem' }}>
                          {m.network}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, color: 'var(--cream-muted)' }}>{TYPE_LABEL[m.method_type] || m.method_type}</td>
                    <td style={{ ...td, fontFamily: 'IBM Plex Mono,monospace', fontSize: '.62rem', color: 'var(--cream-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.account_reference || '—'}
                    </td>
                    <td style={{ ...td, color: 'var(--cream-muted)' }}>{m.asset_code || m.currency_code}</td>
                    <td style={{ ...td, fontFamily: 'IBM Plex Mono,monospace', color: m.rate_per_usd == null ? '#f59e0b' : 'var(--cream-muted)' }}>
                      {m.rate_per_usd == null ? 'not set' : m.rate_per_usd}
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => toggleActive(m)}
                        style={{
                          fontSize: '.58rem', padding: '.2rem .6rem', cursor: 'pointer',
                          fontFamily: 'Montserrat,sans-serif', letterSpacing: '.08em',
                          border: `1px solid ${m.is_active ? 'rgba(39,174,96,.45)' : 'var(--border)'}`,
                          color: m.is_active ? '#27ae60' : 'var(--cream-dim)',
                          background: m.is_active ? 'rgba(39,174,96,.1)' : 'transparent',
                        }}
                      >
                        {m.is_active ? 'Live' : 'Hidden'}
                      </button>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button onClick={() => { setDraft(m); setError(null); setNotice(null) }} style={btnTiny}>Edit</button>
                      <button onClick={() => remove(m)} style={{ ...btnTiny, color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '.55rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--cream-dim)', marginBottom: '.35rem' }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: '.58rem', color: 'var(--cream-dim)', marginTop: '.3rem', lineHeight: 1.5 }}>{hint}</div>}
    </label>
  )
}

const input: React.CSSProperties = {
  width: '100%', background: 'var(--dark2, #0f0d0a)', color: 'var(--cream)',
  border: '1px solid var(--border)', padding: '.55rem .7rem', fontSize: '.75rem',
  fontFamily: 'Montserrat,sans-serif', outline: 'none', boxSizing: 'border-box',
}

const th: React.CSSProperties = {
  padding: '.75rem 1rem', textAlign: 'left', fontSize: '.52rem', letterSpacing: '.14em',
  textTransform: 'uppercase', color: 'var(--cream-dim)', fontWeight: 400,
}

const td: React.CSSProperties = { padding: '.8rem 1rem', fontSize: '.72rem' }

const btnPrimary: React.CSSProperties = {
  background: 'var(--gold)', color: '#0a0906', border: 'none', padding: '.6rem 1.4rem',
  fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer',
  fontFamily: 'Montserrat,sans-serif', fontWeight: 500,
}

const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--cream-muted)', border: '1px solid var(--border)',
  padding: '.6rem 1.4rem', fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase',
  cursor: 'pointer', fontFamily: 'Montserrat,sans-serif',
}

const btnTiny: React.CSSProperties = {
  background: 'transparent', color: 'var(--cream-muted)', border: '1px solid var(--border)',
  padding: '.2rem .55rem', fontSize: '.58rem', cursor: 'pointer', marginRight: '.35rem',
  fontFamily: 'Montserrat,sans-serif', letterSpacing: '.06em',
}
