'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CartIcon, useCart } from '@/context/CartContext';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string | number;
  price_display?: string;
  turnaround_time?: string;
  stripe_link?: string;
};

const HOW_IT_WORKS = [
  { n: '01', title: 'Browse & Select', body: 'Choose from 17 productized services. Add to cart or request directly.' },
  { n: '02', title: 'Submit Your Brief', body: 'Access your client portal. Submit project details — no calls required for most services.' },
  { n: '03', title: 'We Execute', body: 'Your project enters production. Delivered to your portal within the stated turnaround.' },
  { n: '04', title: 'You Receive', body: 'Download files from your portal. Request revisions if needed. Project closed.' },
];

const formatPrice = (price: string | number | null | undefined): string => {
  if (price === null || price === undefined || price === '') return 'Contact for pricing';
  const s = String(price).trim();
  if (s.startsWith('$') || s.toLowerCase().startsWith('from')) return s;
  if (/^\d+(\.\d+)?$/.test(s)) return `$${parseFloat(s).toLocaleString()}`;
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (!isNaN(n) && n > 0) return `$${n.toLocaleString()}`;
  return s || 'Contact for pricing';
};

export default function HomePage() {
  const [featured, setFeatured] = useState<CatalogItem[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<{ email: string } | null>(null);

  const { addToCart } = useCart();

  // Auth check — show Portal only when logged in
  useEffect(() => {
    (async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(SB_URL, SB_ANON);
      const { data: { user } } = await sb.auth.getUser();
      if (user) setSessionUser({ email: user.email || '' });
    })();
  }, []);

  // Featured services fetch
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          `${SB_URL}/rest/v1/catalog_items?select=*&order=created_at&limit=6`,
          { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` } }
        );
        if (!r.ok) { console.error('Featured fetch failed:', r.status); return; }
        const data = await r.json();
        setFeatured(Array.isArray(data) ? data.filter((i: CatalogItem) => i.name && i.name !== 'ffdfd').slice(0, 6) : []);
      } catch (e) { console.error('Featured fetch error:', e); }
    })();
  }, []);

  const handleAddToCart = (item: CatalogItem) => {
    addToCart({ id: item.id, name: item.name, category: item.category, description: item.description, price: item.price_display || item.price, turnaround: item.turnaround_time, stripe_link: item.stripe_link });
    setAdded(item.id);
    setTimeout(() => setAdded(null), 1500);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7', overflowX: 'hidden' }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '.65rem 4rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', background: 'rgba(10,9,6,.96)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(201,169,110,.18)',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo.svg" alt="OGraphy" style={{ width: 148, height: 'auto', objectFit: 'contain' }} />
        </Link>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <Link href="/catalog" style={{ fontSize: '.67rem', letterSpacing: '.17em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', textDecoration: 'none' }}>Services</Link>
          <Link href="/contact" style={{ fontSize: '.67rem', letterSpacing: '.17em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', textDecoration: 'none' }}>Contact</Link>
          {sessionUser ? (
            <Link href="/portal" style={{ fontSize: '.67rem', letterSpacing: '.17em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', textDecoration: 'none' }}>Portal</Link>
          ) : (
            <Link href="/login" style={{ fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', background: '#c9a96e', color: '#0a0906', padding: '.38rem .9rem', textDecoration: 'none', fontWeight: 500 }}>Sign In</Link>
          )}
          <CartIcon />
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8rem 4rem 4rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: '.52rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '1.5rem' }}>
          Visual Identity · Print · Content · Delivery
        </div>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(3rem,7vw,5.5rem)', fontWeight: 300, color: '#f0e8d8', lineHeight: 1.05, marginBottom: '2rem', maxWidth: 700 }}>
          One contact.<br />One invoice.<br /><em style={{ color: '#c9a96e', fontStyle: 'italic' }}>One result.</em>
        </h1>
        <p style={{ fontSize: '.85rem', color: 'rgba(232,213,183,.45)', lineHeight: 1.9, maxWidth: 420, marginBottom: '3rem' }}>
          OGraphy is a managed visual identity studio. Browse productized services, submit your brief, and receive polished output — without the agency overhead.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link href="/catalog" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.95rem 2.4rem', fontSize: '.7rem', letterSpacing: '.15em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}>
            Browse Services
          </Link>
          <Link href="/contact" style={{ display: 'inline-block', background: 'transparent', color: '#c9a96e', border: '1px solid rgba(201,169,110,.4)', padding: '.95rem 2.4rem', fontSize: '.7rem', letterSpacing: '.15em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Start a Project
          </Link>
        </div>
      </section>

      {/* Featured Services */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 4rem 5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2.5rem' }}>
          <div>
            <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '.75rem' }}>Featured Services</div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.6rem,3vw,2.5rem)', fontWeight: 300, color: '#f0e8d8' }}>
              What we build
            </h2>
          </div>
        </div>

        {featured.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(232,213,183,.2)', fontSize: '.75rem' }}>
            Loading services...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: 'rgba(201,169,110,.06)' }}>
            {featured.map(item => (
              <div
                key={item.id}
                style={{ background: '#0a0906', padding: '2rem', display: 'flex', flexDirection: 'column', transition: 'transform .3s ease, background .3s ease, box-shadow .3s ease', cursor: 'default' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = '#0f0d0a';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-5px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(0,0,0,.45)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = '#0a0906';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '.48rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>{item.category}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem', lineHeight: 1.2 }}>{item.name}</div>
                <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.38)', lineHeight: 1.7, marginBottom: '1.25rem', flex: 1 }}>
                  {item.description?.slice(0, 80)}{(item.description?.length ?? 0) > 80 ? '...' : ''}
                </div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#c9a96e', marginBottom: '1rem' }}>
                  {formatPrice(item.price_display || item.price)}
                </div>
                <button
                  onClick={() => handleAddToCart(item)}
                  style={{
                    padding: '.6rem', background: added === item.id ? 'rgba(201,169,110,.15)' : 'transparent',
                    border: `1px solid ${added === item.id ? '#c9a96e' : 'rgba(201,169,110,.25)'}`,
                    color: '#c9a96e', fontFamily: 'Montserrat, sans-serif', fontSize: '.58rem',
                    letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  {added === item.id ? '✓ Added' : '+ Add to Cart'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <Link href="/catalog" style={{
            display: 'inline-block', padding: '.85rem 2.6rem',
            background: 'transparent', border: '1px solid rgba(201,169,110,.3)',
            color: '#c9a96e', fontFamily: 'Montserrat, sans-serif',
            fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            See All 17 Services →
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '4rem 4rem 6rem', borderTop: '1px solid rgba(201,169,110,.06)' }}>
        <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '2.5rem' }}>How It Works</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2.5rem' }}>
          {HOW_IT_WORKS.map(step => (
            <div key={step.n}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '.6rem', color: 'rgba(201,169,110,.3)', marginBottom: '.75rem', letterSpacing: '.1em' }}>{step.n}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', color: '#f0e8d8', marginBottom: '.6rem', fontWeight: 300 }}>{step.title}</div>
              <div style={{ fontSize: '.74rem', color: 'rgba(232,213,183,.38)', lineHeight: 1.7 }}>{step.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(201,169,110,.06)', padding: '2rem 4rem', maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.15)', letterSpacing: '.1em' }}>© 2026 OGraphy · Studio Platform</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Services', '/catalog']].map(([l, h]) => (
            <Link key={l} href={h} style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.15)', textDecoration: 'none' }}>{l}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
