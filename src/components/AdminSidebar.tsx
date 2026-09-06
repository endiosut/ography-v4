'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/admin',                label: 'Dashboard',  icon: '◈' },
  { href: '/admin/analytics',      label: 'Analytics',  icon: '→' },
  { href: '/admin/projects',       label: 'Projects',   icon: '◆' },
  { href: '/admin/clients',        label: 'Clients',    icon: '◉' },
  { href: '/admin/catalog',        label: 'Catalog',    icon: '◎' },
  { href: '/admin/catalog/upload', label: 'Add Item',   icon: '＋' },
  { href: '/admin/briefs',         label: 'Briefs',     icon: '◇' },
  { href: '/admin/payments',       label: 'Payments',   icon: '◈' },
  { href: '/admin/payments/proofs',  label: 'Proofs',     icon: '✓' },
  { href: '/admin/payments/methods', label: 'Pay Rails',  icon: '⇄' },
]

export default function AdminSidebar() {
  const path = usePathname()
  return (
    <aside style={{ width: 220, minHeight: '100vh', background: 'var(--dark)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 }}>
      <div style={{ padding: '1.5rem 1.25rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/logo.svg" alt="OGraphy" style={{ width: 100, height: 'auto', objectFit: 'contain', display: 'block' }} />
      </div>
      <nav style={{ flex: 1, padding: '.75rem' }}>
        {nav.map(({ href, label, icon }) => {
          const active = path === href || (href !== '/admin' && path.startsWith(href))
          return (
            <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.55rem .75rem', marginBottom: 2, textDecoration: 'none', fontSize: '.75rem', fontWeight: active ? 500 : 300, color: active ? 'var(--gold)' : 'var(--cream-muted)', background: active ? 'var(--gold-dim2)' : 'transparent', borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent', transition: 'all .2s' }}>
              <span style={{ fontSize: '.8rem', opacity: active ? 1 : .5 }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', fontSize: '.6rem', color: 'rgba(240,232,216,.25)' }}>
        <div>Supabase · Connected</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginTop: '.3rem' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} />
          OGraphy V4 · Live
        </div>
      </div>
    </aside>
  )
}
