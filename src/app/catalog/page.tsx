'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Catalog Page (Complete Rebuild)
//  File: src/app/catalog/page.tsx
//
//  Fixes from audit:
//  ✅ Prices visible on cards
//  ✅ Description placeholder shown even when empty
//  ✅ Category filters working (match Supabase category field exactly)
//  ✅ Stripe "Pay now" link on items that have it
//  ✅ Cart icon with counter badge
//  ✅ Cart logic: no-stripe = "Request", stripe = "Pay Upfront" + "50/50"
//  ✅ Admin-style card finish (rounded corners, smooth styling)
//  ✅ Float on hover + scroll entrance animation
//  ✅ User profile with signout when logged in
//  ✅ Settings → account/purchases
//  ✅ Auto-captures navigation history for contact form pre-fill
// ─────────────────────────────────────────────────────────────────

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string | number;
  turnaround: string;
  stripe_link?: string;
  deposit_50?: number;
  image_url?: string;
};
type CartItem = CatalogItem & { qty: number };
type User = { email: string; full_name?: string; avatar_url?: string };

const CATEGORY_MAP: Record<string, string[]> = {
  'All': [],
  'Identity Systems': ['Identity Systems', 'Identity', 'Brand Identity'],
  'Content Production': ['Content Production', 'Content', 'UGC'],
  'Print & Physical': ['Print & Physical', 'Print', 'Physical'],
  'Editorial': ['Editorial', 'Print Production', 'Document'],
  'Event Media': ['Event Media', 'Events', 'Photography', 'Event'],
};

const DISPLAY_CATEGORIES = Object.keys(CATEGORY_MAP);

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [filtered, setFiltered] = useState<CatalogItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<string | null>(null);

  // Track navigation history for contact form
  useEffect(() => {
    const history = JSON.parse(sessionStorage.getItem('og_nav_history') || '[]');
    history.push({ page: 'catalog', time: Date.now() });
    sessionStorage.setItem('og_nav_history', JSON.stringify(history.slice(-10)));
  }, []);

  // Fetch user session
  useEffect(() => {
    const getUser = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(SB_URL, SB_ANON);
        const { data: { user: u } } = await sb.auth.getUser();
        if (u) {
          setUser({
            email: u.email || '',
            full_name: u.user_metadata?.full_name || u.user_metadata?.name,
            avatar_url: u.user_metadata?.avatar_url,
          });
        }
      } catch {}
    };
    getUser();
  }, []);

  // Fetch catalog items
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(
          `${SB_URL}/rest/v1/catalog_items?select=*&order=category,name`,
          { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` } }
        );
        const data = await res.json();
        const clean = (Array.isArray(data) ? data : [])
          .filter((i: CatalogItem) => i.name && i.name !== 'ffdfd' && i.name !== 'dfdf');
        setItems(clean);
        setFiltered(clean);
      } catch (e) {
        console.error('Catalog fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  // Category filter — matches Supabase category values
  useEffect(() => {
    if (activeCategory === 'All') {
      setFiltered(items);
    } else {
      const allowedCategories = CATEGORY_MAP[activeCategory] || [activeCategory];
      setFiltered(items.filter(i =>
        allowedCategories.some(cat =>
          i.category?.toLowerCase().includes(cat.toLowerCase())
        )
      ));
    }
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

  const addToCart = (item: CatalogItem) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id);
      return exists
        ? prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
        : [...prev, { ...item, qty: 1 }];
    });
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 1800);
    setCartOpen(true);
    // Cart auto-hide: close after 5 seconds or on scroll
    const timer = setTimeout(() => setCartOpen(false), 5000);
    const onScroll = () => {
      clearTimeout(timer);
      setCartOpen(false);
      window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { once: true });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => {
    const p = parseFloat(String(i.price).replace(/[^0-9.]/g, '')) || 0;
    return s + p * i.qty;
  }, 0);
  const hasStripe = cart.some(i => i.stripe_link);
  const allHaveStripe = cart.length > 0 && cart.every(i => i.stripe_link);

  const handleRequestAll = () => {
    const services = cart.map(i => i.name).join(',');
    const history = sessionStorage.getItem('og_nav_history') || '[]';
    sessionStorage.setItem('og_contact_services', services);
    sessionStorage.setItem('og_contact_history', history);
    window.location.href = `/contact?services=${encodeURIComponent(services)}`;
  };

  const handleSignOut = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(SB_URL, SB_ANON);
      await sb.auth.signOut();
      setUser(null);
      setProfileOpen(false);
    } catch {}
  };

  const formatPrice = (price: string | number): string => {
    if (!price) return 'Request for price';
    return String(price).startsWith('$') ? String(price) :
      String(price).startsWith('From') ? String(price) :
      isNaN(Number(price)) ? String(price) : `$${price}`;
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>

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
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link href="/contact" style={{ fontSize: '.62rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', textDecoration: 'none' }}>
            Contact
          </Link>
          {user ? (
            <Link href="/portal" style={{ fontSize: '.62rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', textDecoration: 'none' }}>
              Portal
            </Link>
          ) : (
            <Link href="/login" style={{ fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '.35rem .85rem', textDecoration: 'none' }}>
              Sign In
            </Link>
          )}

          {/* Cart Icon with badge */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setCartOpen(o => !o)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '.35rem', display: 'flex', alignItems: 'center', color: '#c9a96e' }}
              title="Cart"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  background: '#c9a96e', color: '#0a0906',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: '.48rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>

          {/* User profile */}
          {user && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: user.avatar_url ? 'transparent' : 'rgba(201,169,110,.15)',
                  border: '1px solid rgba(201,169,110,.3)',
                  cursor: 'pointer', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#c9a96e', fontSize: '.6rem', fontWeight: 500,
                }}
              >
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials
                }
              </button>
              {profileOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '.5rem',
                  background: '#0f0d0a', border: '1px solid rgba(201,169,110,.15)',
                  minWidth: 200, zIndex: 200, padding: '.75rem 0',
                }}>
                  <div style={{ padding: '.5rem 1.25rem 1rem', borderBottom: '1px solid rgba(201,169,110,.08)' }}>
                    <div style={{ fontSize: '.72rem', color: '#e8d5b7', marginBottom: '.25rem' }}>{user.full_name || 'My Account'}</div>
                    <div style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.4)' }}>{user.email}</div>
                  </div>
                  {[
                    { label: 'My Portal', href: '/portal' },
                    { label: 'My Purchases', href: '/portal?tab=purchases' },
                    { label: 'Account Settings', href: '/portal?tab=settings' },
                  ].map(item => (
                    <Link key={item.label} href={item.href} style={{ display: 'block', padding: '.6rem 1.25rem', fontSize: '.68rem', color: 'rgba(232,213,183,.55)', textDecoration: 'none', letterSpacing: '.08em' }}
                      onClick={() => setProfileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(201,169,110,.08)', marginTop: '.5rem', paddingTop: '.5rem' }}>
                    <button
                      onClick={handleSignOut}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '.6rem 1.25rem', fontSize: '.65rem', color: 'rgba(224,112,112,.6)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.08em' }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ── CART SIDEBAR ── */}
      {cartOpen && (
        <>
          <div onClick={() => setCartOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149, background: 'rgba(0,0,0,.5)' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, zIndex: 150,
            background: '#0a0906', borderLeft: '1px solid rgba(201,169,110,.15)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(201,169,110,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                <span style={{ fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,232,216,.45)' }}>
                  Cart {cartCount > 0 ? `· ${cartCount}` : ''}
                </span>
              </div>
              <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(240,232,216,.3)', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(240,232,216,.25)', fontSize: '.75rem', lineHeight: 1.8 }}>
                  Your cart is empty<br />
                  <span style={{ fontSize: '.62rem', color: 'rgba(240,232,216,.15)' }}>Add services to request or purchase</span>
                </div>
              ) : cart.map(item => (
                <div key={item.id} style={{ borderBottom: '1px solid rgba(201,169,110,.07)', padding: '.9rem 0', display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.76rem', color: '#e8d5b7', marginBottom: '.25rem', lineHeight: 1.3 }}>{item.name}</div>
                    <div style={{ fontSize: '.78rem', color: '#c9a96e', fontFamily: 'Cormorant Garamond, serif', marginBottom: '.2rem' }}>{formatPrice(item.price)}</div>
                    {item.turnaround && <div style={{ fontSize: '.58rem', color: 'rgba(240,232,216,.25)' }}>{item.turnaround}</div>}
                    {item.stripe_link && (
                      <Link href={item.stripe_link} target="_blank" style={{ fontSize: '.55rem', color: 'rgba(201,169,110,.4)', textDecoration: 'none', display: 'block', marginTop: '.35rem' }}>
                        Pay directly →
                      </Link>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'rgba(240,232,216,.2)', cursor: 'pointer', fontSize: '1rem', padding: '.2rem', flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(201,169,110,.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '.65rem', color: 'rgba(240,232,216,.35)', letterSpacing: '.06em' }}>Estimated</span>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', color: '#c9a96e' }}>
                    ${cartTotal.toLocaleString()}
                  </span>
                </div>

                {/* Smart cart button logic */}
                {allHaveStripe ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                    <Link href={`/contact?services=${encodeURIComponent(cart.map(i => i.name).join(','))}&pay=upfront`}
                      style={{ display: 'block', textAlign: 'center', background: '#c9a96e', color: '#0a0906', padding: '.85rem', fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>
                      Pay Upfront — Full Amount
                    </Link>
                    <button onClick={handleRequestAll}
                      style={{ background: 'transparent', border: '1px solid rgba(201,169,110,.25)', color: '#c9a96e', padding: '.85rem', fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                      Pay 50% Now → 50% at Delivery
                    </button>
                  </div>
                ) : hasStripe ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                    <button onClick={handleRequestAll}
                      style={{ background: '#c9a96e', color: '#0a0906', border: 'none', padding: '.85rem', fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}>
                      Request Services →
                    </button>
                    <div style={{ fontSize: '.55rem', color: 'rgba(240,232,216,.2)', textAlign: 'center', lineHeight: 1.6 }}>Payment links sent separately for applicable services</div>
                  </div>
                ) : (
                  <button onClick={handleRequestAll}
                    style={{ width: '100%', background: '#c9a96e', color: '#0a0906', border: 'none', padding: '.85rem', fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}>
                    Request These Services →
                  </button>
                )}
                <div style={{ marginTop: '.75rem', fontSize: '.52rem', color: 'rgba(240,232,216,.18)', textAlign: 'center', letterSpacing: '.06em' }}>
                  50% on submission · 50% at delivery · USD
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── HERO ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8.5rem 3rem 2.5rem' }}>
        <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '1rem' }}>Visual Readiness as a Service</div>
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
          {loading ? 'Loading...' : `${filtered.length} service${filtered.length !== 1 ? 's' : ''}`}
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
                  {formatPrice(item.price)}
                </div>

                {/* Turnaround */}
                {item.turnaround && (
                  <div style={{ fontSize: '.56rem', color: 'rgba(232,213,183,.22)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
                    {item.turnaround}
                  </div>
                )}
                {!item.turnaround && <div style={{ marginBottom: '1.25rem' }} />}

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem', marginTop: 'auto' }}>
                  <button
                    onClick={() => addToCart(item)}
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
