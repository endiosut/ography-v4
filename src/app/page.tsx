'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import NavBar from '@/components/NavBar';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unzwefrtgsgmtljlbavf.supabase.co';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTM1MjMsImV4cCI6MjA5MjA4OTUyM30.QPoyf_UYDD82xW1KYaSbukPrfMoTAACVMKPT05HKI90';

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  base_price_usd?: number | null;
  price_note?: string | null;
  price?: string | number;
  price_display?: string;
  turnaround?: string | null;
  turnaround_time?: string;
  stripe_link?: string;
};

const HOW_IT_WORKS = [
  { n: '01', title: 'Browse & Select', body: 'Choose from 17 productized services. Add to cart or request directly.' },
  { n: '02', title: 'Submit Your Brief', body: 'Access your client portal. Submit project details — no calls required for most services.' },
  { n: '03', title: 'We Execute', body: 'Your project enters production. Delivered to your portal within the stated turnaround.' },
  { n: '04', title: 'You Receive', body: 'Download files from your portal. Request revisions if needed. Project closed.' },
];

const formatPrice = (priceNote?: string | null, basePrice?: number | string | null): string => {
  if (priceNote && priceNote.trim()) return priceNote.trim();
  if (basePrice !== undefined && basePrice !== null && basePrice !== '') {
    const num = typeof basePrice === 'number' ? basePrice : parseFloat(String(basePrice).replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) return `$${num.toLocaleString()}`;
  }
  return 'Contact for pricing';
};

// Trimmed 13 Aug 2026. Three typed lines at 45ms/char with 1200ms holds put a
// ~9.4s gate in front of the homepage before a first-time visitor saw anything.
// Line 2 ("Your story is your most undervalued asset") also restated the hero
// — "They buy your story" — so it was paying 1.8s to say the same thing twice.
// Two lines, faster cadence, shorter holds: ~4.8s.
const INTRO_LINES = [
  'Every great brand begins with a truth.',
  'We turn lived experience into market authority.',
];

export default function HomePage() {
  const [featured, setFeatured] = useState<CatalogItem[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [introFading, setIntroFading] = useState(false);
  const [typedText, setTypedText] = useState('');

  const { addToCart } = useCart();

  // Intro typewriter animation (shows on first visit in session)
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem('og_intro_seen');
      if (!seen) {
        setShowIntro(true);
        let lineIdx = 0;
        let charIdx = 0;
        let currentText = '';
        let timeoutId: NodeJS.Timeout;

        const typeChar = () => {
          const targetLine = INTRO_LINES[lineIdx];
          if (charIdx < targetLine.length) {
            currentText += targetLine[charIdx];
            setTypedText(currentText);
            charIdx++;
            timeoutId = setTimeout(typeChar, 32);
          } else {
            timeoutId = setTimeout(() => {
              lineIdx++;
              if (lineIdx < INTRO_LINES.length) {
                charIdx = 0;
                currentText = '';
                setTypedText('');
                timeoutId = setTimeout(typeChar, 300);
              } else {
                // finished all lines
                timeoutId = setTimeout(() => {
                  dismissIntro();
                }, 800);
              }
            }, 900);
          }
        };

        timeoutId = setTimeout(typeChar, 250);

        return () => clearTimeout(timeoutId);
      }
    } catch {
      // ignore
    }
  }, []);

  const dismissIntro = () => {
    try {
      sessionStorage.setItem('og_intro_seen', 'true');
    } catch {
      // ignore
    }
    setIntroFading(true);
    setTimeout(() => setShowIntro(false), 800);
  };

  // Featured services fetch
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          `${SB_URL}/rest/v1/catalog_items?select=*&order=sort_order&limit=6`,
          {
            headers: {
              apikey: SB_ANON,
              Authorization: `Bearer ${SB_ANON}`,
              'Cache-Control': 'no-cache',
            },
            cache: 'no-store',
          }
        );
        if (!r.ok) { console.error('Featured fetch failed:', r.status); return; }
        const data = await r.json();
        const clean = (Array.isArray(data) ? data : [])
          .filter((i: any) => i && i.name && i.name !== 'ffdfd' && i.is_active !== false)
          .map((i: any) => ({
            ...i,
            price: i.base_price_usd ?? 0,
            price_display: formatPrice(i.price_note, i.base_price_usd),
            turnaround: i.turnaround || i.turnaround_time || '',
          }))
          .slice(0, 6);
        setFeatured(clean);
      } catch (e) { console.error('Featured fetch error:', e); }
    })();
  }, []);

  const handleAddToCart = (item: CatalogItem) => {
    addToCart({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      price: item.price_display || (item.base_price_usd ? `$${item.base_price_usd}` : 'Contact for pricing'),
      turnaround: item.turnaround || item.turnaround_time,
      stripe_link: item.stripe_link,
    });
    setAdded(item.id);
    setTimeout(() => setAdded(null), 1500);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7', overflowX: 'hidden' }}>

      {/* Intro Experience Overlay */}
      {showIntro && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: '#050403',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: '2rem', transition: 'opacity 0.8s ease',
          opacity: introFading ? 0 : 1,
          pointerEvents: introFading ? 'none' : 'auto',
        }}>
          <div style={{
            fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.8rem, 4vw, 3.2rem)',
            color: '#f0e8d8', fontWeight: 300, textAlign: 'center', maxWidth: 800, minHeight: '5rem',
            lineHeight: 1.3, letterSpacing: '.02em',
          }}>
            {typedText}
            <span style={{
              display: 'inline-block', width: 3, height: '1.8rem', background: '#c9a96e',
              marginLeft: 6, verticalAlign: 'middle', animation: 'blink 1s infinite',
            }} />
          </div>
          <button
            onClick={dismissIntro}
            style={{
              position: 'absolute', bottom: '3rem', background: 'transparent', border: 'none',
              color: 'rgba(201,169,110,.35)', fontSize: '.6rem', letterSpacing: '.25em',
              textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
            }}
          >
            [ Skip Experience ]
          </button>
          <style>{`
            @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
          `}</style>
        </div>
      )}

      <NavBar />

      {/* Hero */}
      <section className="story-reveal home-hero" style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8rem 4rem 4rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: '.52rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '1.5rem' }}>
          OGraphy · The AI Creator Operating System
        </div>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(2.6rem,6vw,4.8rem)', fontWeight: 300, color: '#f0e8d8', lineHeight: 1.1, marginBottom: '2rem', maxWidth: 880 }}>
          Your next customer doesn&#39;t buy your service first.<br />
          <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>They buy your story.</em>
        </h1>
        <p style={{ fontSize: '.88rem', color: 'rgba(232,213,183,.5)', lineHeight: 1.9, maxWidth: 560, marginBottom: '3rem' }}>
          We turn your lived experiences, lessons, and founder proof into podcasts, videos, newsletters, books, courses, websites, and a compounding personal brand—with AI as your autonomous production engine.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link href="/contact?intent=story-assessment" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.95rem 2.4rem', fontSize: '.7rem', letterSpacing: '.15em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
            Analyze My Story →
          </Link>
          <Link href="/catalog" style={{ display: 'inline-block', background: 'transparent', color: '#c9a96e', border: '1px solid rgba(201,169,110,.4)', padding: '.95rem 2.4rem', fontSize: '.7rem', letterSpacing: '.15em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Build Your Brand OS
          </Link>
        </div>
      </section>

      {/* Outcomes Over Services */}
      <section className="story-reveal" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 4rem 5rem', borderTop: '1px solid rgba(201,169,110,.08)' }}>
        <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '2rem' }}>
          What We Build · Outcomes Over Services
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          <div style={{ background: '#0d0b08', padding: '2rem', border: '1px solid rgba(201,169,110,.12)' }}>
            <div style={{ fontSize: '.6rem', color: '#c9a96e', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: '.75rem' }}>01 / Build Trust</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: '#f0e8d8', marginBottom: '.75rem' }}>Brand Identity &amp; Web OS</div>
            <p style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.45)', lineHeight: 1.7 }}>Strategic visual positioning, high-converting web architecture, and messaging frameworks that turn audience skepticism into immediate trust.</p>
          </div>
          <div style={{ background: '#0d0b08', padding: '2rem', border: '1px solid rgba(201,169,110,.12)' }}>
            <div style={{ fontSize: '.6rem', color: '#c9a96e', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: '.75rem' }}>02 / Capture Attention</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: '#f0e8d8', marginBottom: '.75rem' }}>Visual &amp; UGC Media Engine</div>
            <p style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.45)', lineHeight: 1.7 }}>High-production short-form video, UGC creative assets, photography direction, and social carousels that stop scrolling and capture mindshare.</p>
          </div>
          <div style={{ background: '#0d0b08', padding: '2rem', border: '1px solid rgba(201,169,110,.12)' }}>
            <div style={{ fontSize: '.6rem', color: '#c9a96e', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: '.75rem' }}>03 / Scale Presence</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: '#f0e8d8', marginBottom: '.75rem' }}>Autonomous AI Workflows</div>
            <p style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.45)', lineHeight: 1.7 }}>Automated content generation, podcast distribution, case study engines, and multi-channel asset compilation working 24/7.</p>
          </div>
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
                  {item.price_display || formatPrice(item.price_note, item.base_price_usd)}
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
