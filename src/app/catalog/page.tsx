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

const SLUG_MAP: Record<string, string> = {
  'Echo Launch Kit': '/catalog/echo_launch_kit.svg',
  'Brand Amplification': '/catalog/brand_amplification.svg',
  'Fractional Creative Partner': '/catalog/fractional_creative_partner.svg',
  'Social Media Starter Pack': '/catalog/social_media_starter_pack.svg',
  'UGC Asset Kit': '/catalog/ugc_asset_kit.svg',
  'Monthly Content Bundle': '/catalog/monthly_content_bundle.svg',
  'Photo Retouch Pack': '/catalog/photo_retouch_pack.svg',
  'Custom Lightroom Preset Pack': '/catalog/custom_lightroom_preset_pack.svg',
  'Event Pull-Up Banner': '/catalog/event_pull_up_banner.svg',
  'Business Card Set': '/catalog/business_card_set.svg',
  'Framed Wall Print': '/catalog/framed_wall_print.svg',
  'Event Identity Kit': '/catalog/event_identity_kit.svg',
  'Pitch Deck Design': '/catalog/pitch_deck_design.svg',
  'Business Proposal': '/catalog/business_proposal.svg',
  'Student CV & Portfolio': '/catalog/student_cv_portfolio.svg',
  'Same-Day Event Edits': '/catalog/same_day_event_edits.svg',
};

// FALLBACK_ITEMS removed 13 Aug 2026.
//
// It was a 16-item hardcoded array with synthetic ids '1'..'16', rendered
// whenever the catalog fetch failed. Two consequences:
//
//  1. Those ids are not catalog_items UUIDs. "Add to cart" stored id '1', and
//     the contact form's step 3 — which matches cart entries against real
//     catalog_items.id — then selected nothing. A broken read produced a
//     silently broken checkout.
//  2. A failed database read rendered a perfect-looking catalog. The failure
//     had no symptom, which is exactly how the ten-week portal bug survived.
//
// A read that fails must LOOK failed. See the error state below.

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
  const [loadError, setLoadError] = useState<string | null>(null);

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
          const body = await res.text();
          console.error('[catalog] fetch failed:', res.status, body);
          setLoadError(`Could not load services (HTTP ${res.status}).`);
          return;
        }

        const rawData = await res.json();
        if (!Array.isArray(rawData)) {
          console.error('[catalog] unexpected payload shape:', rawData);
          setLoadError('Could not load services (unexpected response).');
          return;
        }
        // An empty array is a legitimate answer, not an error. It renders the
        // empty state below rather than being masked by placeholder data.

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
            image_url: SLUG_MAP[i.name] || i.image_url || null,
            is_active: i.is_active,
            is_featured: i.is_featured,
            sort_order: i.sort_order,
          }));

        setItems(clean);
        setFiltered(clean);
      } catch (e) {
        console.error('[catalog] fetch threw:', e);
        setLoadError('Could not reach the service catalog.');
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
          {loading
            ? 'Loading services...'
            : loadError
              ? 'Services unavailable'
              : `${filtered.length} service${filtered.length !== 1 ? 's' : ''}`}
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
        ) : loadError ? (
          // A failed read must look failed. Previously this branch rendered 16
          // hardcoded services and the visitor saw a working catalog.
          <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px solid rgba(224,112,112,.18)', background: 'rgba(224,112,112,.03)', borderRadius: 8 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0e8d8', fontWeight: 300, marginBottom: '.75rem' }}>
              We couldn&apos;t load the services
            </div>
            <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8, maxWidth: 380, margin: '0 auto 1.5rem' }}>
              {loadError} This is on our side, not yours — nothing you did caused it.
            </div>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.location.reload()}
                style={{ background: '#c9a96e', color: '#0a0906', border: 'none', padding: '.75rem 1.75rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
              >
                Try again
              </button>
              <Link href="/contact" style={{ color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '.75rem 1.75rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
                Request directly →
              </Link>
            </div>
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
                {/* Image thumbnail */}
                <div style={{
                  width: '100%', height: 80, borderRadius: 4,
                  background: item.image_url ? '#0d0b08' : 'rgba(201,169,110,.04)',
                  border: item.image_url ? '1px solid rgba(201,169,110,.18)' : '1px dashed rgba(201,169,110,.1)',
                  marginBottom: '1.25rem', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                    {/* Removed 06 Sep 2026: a "Pay Now" link gated on
                        item.stripe_link. catalog_items has no stripe_link
                        column, so this never rendered once — and payment now
                        happens after the agreement, on /portal/pay. */}
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
