'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import { useCart } from '@/context/CartContext';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Catalog Page
//  File: src/app/catalog/page.tsx
// ─────────────────────────────────────────────────────────────────

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unzwefrtgsgmtljlbavf.supabase.co';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTM1MjMsImV4cCI6MjA5MjA4OTUyM30.QPoyf_UYDD82xW1KYaSbukPrfMoTAACVMKPT05HKI90';

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  description: string | null;
  base_price_usd?: number | null;
  price_note?: string | null;
  price?: string | number;
  price_display?: string;
  turnaround?: string | null;
  turnaround_time?: string;
  stripe_link?: string;
  image_url?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
};

// Fallback items in case Supabase connection is unreachable
const FALLBACK_ITEMS: CatalogItem[] = [
  { id: '1', name: 'Echo Launch Kit', category: 'identity', description: 'Logo mark + 3 variants + mini brand system + color palette + typography selection. Everything you need to launch with a cohesive visual identity.', base_price_usd: 180, price_note: 'From $180 — one-time project', turnaround: '5-7 days', is_featured: true, is_active: true, sort_order: 1 },
  { id: '2', name: 'Brand Amplification', category: 'identity', description: 'Full logo system + brand voice blueprint + Charte Graphique + cross-platform asset library. The complete identity architecture.', base_price_usd: 555, price_note: 'From $555 — full system', turnaround: '2 weeks', is_featured: true, is_active: true, sort_order: 2 },
  { id: '3', name: 'Fractional Creative Partner', category: 'identity', description: 'Ongoing identity evolution + monthly asset production + strategic visual direction. Your creative department without the overhead.', base_price_usd: 1200, price_note: '$1,200/mo — ongoing partnership', turnaround: 'Monthly', is_featured: false, is_active: true, sort_order: 3 },
  { id: '4', name: 'Social Media Starter Pack', category: 'content', description: '10 Instagram posts + 5 stories, fully branded, Canva-ready and editable. Launch your social presence in one delivery.', base_price_usd: 95, price_note: '$95 per set of 15 templates', turnaround: '3-5 days', is_featured: false, is_active: true, sort_order: 4 },
  { id: '5', name: 'UGC Asset Kit', category: 'content', description: '15 branded templates — posts, stories, reel covers, thumbnails. Designed for content creators who need volume with consistency.', base_price_usd: 145, price_note: '$145 — 15 templates', turnaround: '5 days', is_featured: true, is_active: true, sort_order: 5 },
  { id: '6', name: 'Monthly Content Bundle', category: 'content', description: '30 templates per month, refreshed every 30 days. Never run out of on-brand content. Cancel anytime.', base_price_usd: 280, price_note: '$280/mo — 30 templates', turnaround: 'Monthly', is_featured: false, is_active: true, sort_order: 6 },
  { id: '7', name: 'Photo Retouch Pack', category: 'content', description: '50 batch retouched images with color grading and polish.', base_price_usd: 75, price_note: '$75 per 50 images', turnaround: '3-4 days', is_featured: false, is_active: true, sort_order: 7 },
  { id: '8', name: 'Custom Lightroom Preset Pack', category: 'content', description: '5 tailored Lightroom presets designed to give your photography consistent aesthetic tone.', base_price_usd: 45, price_note: '$45 — 5 presets', turnaround: '2-3 days', is_featured: false, is_active: true, sort_order: 8 },
  { id: '9', name: 'Event Pull-Up Banner', category: 'print', description: '85×200cm pull-up banner — design + print + delivery. Show up to your event with presence. One submission, one payment, banner arrives.', base_price_usd: 85, price_note: 'From $85 — design + print + delivery', turnaround: '5-7 days', is_featured: true, is_active: true, sort_order: 9 },
  { id: '10', name: 'Business Card Set', category: 'print', description: 'Custom designed business cards — 250 cards printed on premium stock + delivered. First impression, handled.', base_price_usd: 65, price_note: '$65 — design + 250 cards + delivery', turnaround: '5 days', is_featured: false, is_active: true, sort_order: 10 },
  { id: '11', name: 'Framed Wall Print', category: 'print', description: 'Museum-grade framed art prints for office and studio spaces.', base_price_usd: 120, price_note: 'From $120 — depends on size', turnaround: '5-7 days', is_featured: false, is_active: true, sort_order: 11 },
  { id: '12', name: 'Event Identity Kit', category: 'print', description: 'Complete physical collateral kit for corporate events, badges, signage, and folders.', base_price_usd: 320, price_note: 'From $320 — full event kit', turnaround: '7-10 days', is_featured: false, is_active: true, sort_order: 12 },
  { id: '13', name: 'Pitch Deck Design', category: 'digital', description: '20 high-converting slides formatted for investor presentations and sales decks.', base_price_usd: 220, price_note: 'From $220 — 20 slides', turnaround: '5-7 days', is_featured: false, is_active: true, sort_order: 13 },
  { id: '14', name: 'Business Proposal', category: 'digital', description: '15-page branded document template for client pitches and RFPs.', base_price_usd: 180, price_note: 'From $180 — 15 pages', turnaround: '4-6 days', is_featured: false, is_active: true, sort_order: 14 },
  { id: '15', name: 'Student CV & Portfolio', category: 'digital', description: 'Modern, ATS-friendly CV design and digital portfolio showcase.', base_price_usd: 75, price_note: '$75 — CV + cover letter', turnaround: '3 days', is_featured: false, is_active: true, sort_order: 15 },
  { id: '16', name: 'Same-Day Event Edits', category: 'event', description: 'Express delivery of highlight photos within hours of event wrap.', base_price_usd: 350, price_note: 'From $350 — same-day delivery', turnaround: 'Same Day', is_featured: false, is_active: true, sort_order: 16 },
];

const CATEGORY_MAP: Record<string, string[]> = {
  'All': [],
  'Identity Systems': ['identity', 'brand'],
  'Content Production': ['content', 'ugc', 'photography'],
  'Print & Physical': ['print', 'physical'],
  'Editorial': ['digital', 'editorial', 'document'],
  'Event Media': ['event', 'events', 'same-day'],
};

const applyFilter = (items: CatalogItem[], cat: string) => {
  if (cat === 'All') return items;
  const allowed = CATEGORY_MAP[cat] || [];
  return items.filter(i => allowed.some(a => (i.category || '').toLowerCase().includes(a.toLowerCase())));
};

const DISPLAY_CATEGORIES = Object.keys(CATEGORY_MAP);

const formatPrice = (priceNote?: string | null, basePrice?: number | string | null): string => {
  if (priceNote && priceNote.trim()) return priceNote.trim();
  if (basePrice !== undefined && basePrice !== null && basePrice !== '') {
    const num = typeof basePrice === 'number' ? basePrice : parseFloat(String(basePrice).replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) return `$${num.toLocaleString()}`;
  }
  return 'Contact for pricing';
};

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [filtered, setFiltered] = useState<CatalogItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<string | null>(null);

  const { addToCart } = useCart();

  // Track navigation history for contact form
  useEffect(() => {
    try {
      const history = JSON.parse(sessionStorage.getItem('og_nav_history') || '[]');
      history.push({ page: 'catalog', time: Date.now() });
      sessionStorage.setItem('og_nav_history', JSON.stringify(history.slice(-10)));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(
          `${SB_URL}/rest/v1/catalog_items?select=*&order=sort_order`,
          {
            headers: {
              apikey: SB_ANON,
              Authorization: `Bearer ${SB_ANON}`,
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            },
            cache: 'no-store',
          }
        );

        if (!res.ok) {
          console.error('Catalog fetch failed:', res.status, await res.text());
          setItems(FALLBACK_ITEMS);
          setFiltered(FALLBACK_ITEMS);
          return;
        }

        const rawData = await res.json();
        if (!Array.isArray(rawData) || rawData.length === 0) {
          setItems(FALLBACK_ITEMS);
          setFiltered(FALLBACK_ITEMS);
          return;
        }

        const clean: CatalogItem[] = rawData
          .filter((i: any) => i && i.name && i.name !== 'ffdfd' && i.name !== 'dfdf' && i.is_active !== false)
          .map((i: any) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            subcategory: i.subcategory,
            description: i.description,
            base_price_usd: i.base_price_usd,
            price_note: i.price_note,
            price: i.base_price_usd ?? 0,
            price_display: formatPrice(i.price_note, i.base_price_usd),
            turnaround: i.turnaround || i.turnaround_time || '',
            turnaround_time: i.turnaround || i.turnaround_time || '',
            stripe_link: i.stripe_link || undefined,
            image_url: i.image_url,
            is_active: i.is_active,
            is_featured: i.is_featured,
            sort_order: i.sort_order,
          }));

        setItems(clean);
        setFiltered(clean);
      } catch (e) {
        console.error('Catalog fetch error:', e);
        setItems(FALLBACK_ITEMS);
        setFiltered(FALLBACK_ITEMS);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    setFiltered(applyFilter(items, activeCategory));
  }, [activeCategory, items]);

  // Scroll entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      const cards = document.querySelectorAll('.catalog-card');
      const observer = new IntersectionObserver(
        entries => entries.forEach(entry => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = '1';
            (entry.target as HTMLElement).style.transform = 'translateY(0)';
          }
        }),
        { threshold: 0.05, rootMargin: '0px 0px -30px 0px' }
      );
      cards.forEach((card, i) => {
        const el = card as HTMLElement;
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `opacity .4s ease ${i * 0.04}s, transform .4s ease ${i * 0.04}s, box-shadow .3s ease, border-color .3s ease, background .2s ease`;
        observer.observe(el);
      });
      return () => observer.disconnect();
    }, 100);
    return () => clearTimeout(timer);
  }, [filtered]);

  const handleAddToCart = (item: CatalogItem) => {
    addToCart({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: item.price_display || (item.base_price_usd ? `$${item.base_price_usd}` : 'Contact for pricing'),
      turnaround: item.turnaround || item.turnaround_time || '',
      stripe_link: item.stripe_link,
    });
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 1800);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>
      <NavBar />

      {/* ── HERO ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8.5rem 3rem 2.5rem' }}>
        <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '1rem' }}>
          Visual Readiness as a Service
        </div>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 300, color: '#f0e8d8', marginBottom: '.75rem' }}>
          Submit. We execute. You receive.
        </h1>
        <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.3)', letterSpacing: '.08em' }}>
          50% on project submission · 50% at delivery · All prices in USD
        </div>
      </div>

      {/* ── CATEGORY FILTERS ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 3rem 2rem' }}>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
          {DISPLAY_CATEGORIES.map((cat: string) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '.4rem 1rem', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                fontSize: '.56rem', letterSpacing: '.1em', textTransform: 'uppercase',
                border: `1px solid ${activeCategory === cat ? '#c9a96e' : 'rgba(201,169,110,.18)'}`,
                background: activeCategory === cat ? 'rgba(201,169,110,.1)' : 'transparent',
                color: activeCategory === cat ? '#c9a96e' : 'rgba(232,213,183,.35)',
                transition: 'all .2s', borderRadius: 2,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '.75rem', fontSize: '.58rem', color: 'rgba(232,213,183,.18)', letterSpacing: '.06em' }}>
          {loading ? 'Loading services...' : `${filtered.length} service${filtered.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* ── CATALOG GRID ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 3rem 8rem' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ background: '#0f0d0a', borderRadius: 8, padding: '1.75rem', height: 220, opacity: 0.4, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'rgba(232,213,183,.3)', fontSize: '.78rem' }}>
            No services in this category yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(288px, 1fr))', gap: 16 }}>
            {filtered.map(item => (
              <div
                key={item.id}
                className="catalog-card"
                style={{
                  background: '#0f0d0a', borderRadius: 8,
                  border: '1px solid rgba(201,169,110,.1)',
                  padding: '1.75rem', display: 'flex', flexDirection: 'column',
                  cursor: 'default', position: 'relative',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = '#141109';
                  el.style.transform = 'translateY(-5px)';
                  el.style.boxShadow = '0 18px 44px rgba(0,0,0,.55)';
                  el.style.borderColor = 'rgba(201,169,110,.25)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = '#0f0d0a';
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = 'none';
                  el.style.borderColor = 'rgba(201,169,110,.1)';
                }}
              >
                {/* Image placeholder */}
                <div style={{
                  width: '100%', aspectRatio: '16/9', borderRadius: 4,
                  background: item.image_url ? 'transparent' : 'rgba(201,169,110,.04)',
                  border: '1px dashed rgba(201,169,110,.1)',
                  marginBottom: '1.25rem', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 80,
                }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,.2)' }}>Visual Coming Soon</span>
                  }
                </div>

                {/* Category tag */}
                <div style={{ fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.4rem' }}>
                  {item.category || 'Service'}
                </div>

                {/* Name */}
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem', lineHeight: 1.25 }}>
                  {item.name}
                </div>

                {/* Description — always shown, placeholder if empty */}
                <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.38)', lineHeight: 1.7, marginBottom: '1rem', flex: 1, minHeight: 48 }}>
                  {item.description
                    ? (item.description.length > 90 ? item.description.slice(0, 90) + '…' : item.description)
                    : <span style={{ color: 'rgba(201,169,110,.2)', fontStyle: 'italic' }}>Description coming soon</span>
                  }
                </div>

                {/* Price — always visible */}
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.55rem', color: '#c9a96e', marginBottom: '.2rem', lineHeight: 1 }}>
                  {item.price_display || formatPrice(item.price_note, item.base_price_usd)}
                </div>

                {/* Turnaround */}
                {(item.turnaround_time || item.turnaround) && (
                  <div style={{ fontSize: '.56rem', color: 'rgba(232,213,183,.22)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
                    {item.turnaround_time || item.turnaround}
                  </div>
                )}
                {!(item.turnaround_time || item.turnaround) && <div style={{ marginBottom: '1.25rem' }} />}

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem', marginTop: 'auto' }}>
                  <button
                    onClick={() => handleAddToCart(item)}
                    style={{
                      padding: '.6rem', background: addedId === item.id ? 'rgba(201,169,110,.12)' : 'transparent',
                      border: `1px solid ${addedId === item.id ? '#c9a96e' : 'rgba(201,169,110,.28)'}`,
                      color: '#c9a96e', fontFamily: 'Montserrat, sans-serif',
                      fontSize: '.56rem', letterSpacing: '.1em', textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'all .2s', borderRadius: 3,
                    }}
                  >
                    {addedId === item.id ? '✓ Added to Cart' : '+ Add to Cart'}
                  </button>

                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <Link
                      href={`/contact?service=${encodeURIComponent(item.name)}`}
                      style={{
                        flex: 1, textAlign: 'center', padding: '.55rem .6rem',
                        background: 'transparent', border: '1px solid rgba(201,169,110,.14)',
                        color: 'rgba(232,213,183,.4)', fontFamily: 'Montserrat, sans-serif',
                        fontSize: '.54rem', letterSpacing: '.1em', textTransform: 'uppercase',
                        textDecoration: 'none', borderRadius: 3, transition: 'all .2s',
                      }}
                    >
                      Request →
                    </Link>
                    {item.stripe_link && (
                      <Link
                        href={item.stripe_link}
                        target="_blank"
                        style={{
                          flex: 1, textAlign: 'center', padding: '.55rem .6rem',
                          background: 'rgba(201,169,110,.06)',
                          border: '1px solid rgba(201,169,110,.2)',
                          color: '#c9a96e', fontFamily: 'Montserrat, sans-serif',
                          fontSize: '.54rem', letterSpacing: '.1em', textTransform: 'uppercase',
                          textDecoration: 'none', borderRadius: 3, transition: 'all .2s',
                        }}
                      >
                        Pay Now →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(201,169,110,.06)', padding: '2rem 3rem', maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.15)', letterSpacing: '.1em' }}>© 2026 OGraphy</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms']].map(([l, h]) => (
            <Link key={l} href={h} style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.15)', textDecoration: 'none' }}>{l}</Link>
          ))}
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
