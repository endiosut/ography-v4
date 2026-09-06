'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Global Cart Provider + Cart Icon Component
//  Files:
//    src/context/CartContext.tsx  (this file)
//    Import into: src/app/layout.tsx
//
//  Usage in any page:
//    import { useCart, CartIcon, CartSidebar } from '@/context/CartContext';
//    const { cart, addToCart, cartCount } = useCart();
//
//  This makes cart behavior UNIFORM across /, /catalog, and all pages
// ─────────────────────────────────────────────────────────────────

type CartItem = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  /** Display string, e.g. "$1,200/mo — ongoing partnership". Never summed. */
  price: string | number;
  /** Authoritative numeric price from catalog_items.base_price_usd. Summed. */
  unit_price_usd?: number;
  quantity?: number;
  turnaround?: string;
  stripe_link?: string;
};

type CartContextType = {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  cartOpen: boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  setQuantity: (id: string, quantity: number) => void;
  setCartOpen: (open: boolean) => void;
  /** Stop the 5s auto-close. The checkout form lives inside the sidebar, and a
   *  panel that closes itself while someone is typing their email cannot take
   *  a payment. */
  cancelAutoClose: () => void;
};

// Parse a price for ARITHMETIC. The old implementation was
//   parseFloat(String(price).replace(/[^0-9.]/g, ''))
// which strips every non-digit and keeps every dot, so:
//   "$1,200/mo"                  -> "1.200"  -> 1.2      (off by 1000x)
//   "$280/mo — 30 templates"     -> "280.30" -> 280.3
//   "$65 — design + 250 cards"   -> "65.250" -> 65.25
// Prefer the numeric column; fall back to the FIRST money-shaped token only.
export function priceToNumber(item: { unit_price_usd?: number; price?: string | number }): number {
  if (typeof item.unit_price_usd === 'number' && Number.isFinite(item.unit_price_usd)) {
    return item.unit_price_usd;
  }
  if (typeof item.price === 'number') return Number.isFinite(item.price) ? item.price : 0;
  const raw = String(item.price ?? '');
  const m = raw.match(/\d[\d,]*(?:\.\d+)?/);      // first number only
  if (!m) return 0;
  const n = parseFloat(m[0].replace(/,/g, ''));    // commas are separators, not decimals
  return Number.isFinite(n) ? n : 0;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // PERSISTENCE (added 13 Aug 2026)
  // The cart previously lived only in React state, so it was destroyed by any
  // reload or hard navigation — including the /login -> OAuth -> /auth/callback
  // round-trip. A visitor could fill a cart, sign in, and arrive with nothing.
  // localStorage keeps it across reloads and tabs; it is intentionally NOT
  // server-side, because an anonymous cart has no owner to key on yet.
  const CART_KEY = 'og_cart_v1';

  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // Read once on mount. Never during render — that would break SSR hydration.
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CART_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch (e) {
      console.error('[cart] restore failed:', e);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Write on every change, but only after hydration, so the initial empty
  // state never overwrites a stored cart.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('[cart] persist failed:', e);
    }
  }, [cart, hydrated]);
  // Held in a ref, not state: openCartWithAutoClose depended on the timer state
  // it also set, so every add-to-cart produced a new callback identity and the
  // previous timer was read stale. A ref is the same value everywhere.
  const autoCloseRef = useRef<NodeJS.Timeout | null>(null);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  const cancelAutoClose = useCallback(() => {
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
    if (scrollHandlerRef.current) {
      window.removeEventListener('scroll', scrollHandlerRef.current);
      scrollHandlerRef.current = null;
    }
  }, []);

  // Auto-close cart after 5 seconds + close on scroll
  const openCartWithAutoClose = useCallback(() => {
    setCartOpen(true);
    cancelAutoClose();

    autoCloseRef.current = setTimeout(() => setCartOpen(false), 5000);

    const onScroll = () => {
      setCartOpen(false);
      cancelAutoClose();
    };
    scrollHandlerRef.current = onScroll;
    window.addEventListener('scroll', onScroll, { once: true, passive: true });
  }, [cancelAutoClose]);

  useEffect(() => cancelAutoClose, [cancelAutoClose]);

  // Adding an item already in the cart previously did `{ ...c }` — a copy with
  // no change. Quantity controls therefore had nothing to control, and adding
  // the same service twice was a no-op.
  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id);
      if (!exists) return [...prev, { ...item, quantity: item.quantity ?? 1 }];
      return prev.map(c =>
        c.id === item.id ? { ...c, quantity: (c.quantity ?? 1) + (item.quantity ?? 1) } : c
      );
    });
    openCartWithAutoClose();
  }, [openCartWithAutoClose]);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setCart(prev =>
      quantity <= 0
        ? prev.filter(c => c.id !== id)
        : prev.map(c => (c.id === id ? { ...c, quantity } : c))
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  // Count units, not lines — 3 of one service is 3 items in the badge.
  const cartCount = cart.reduce((n, i) => n + (i.quantity ?? 1), 0);
  const cartTotal = cart.reduce((sum, i) => sum + priceToNumber(i) * (i.quantity ?? 1), 0);

  return (
    <CartContext.Provider value={{ cart, cartCount, cartTotal, cartOpen, addToCart, removeFromCart, setQuantity, clearCart, setCartOpen, cancelAutoClose }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

// ── Cart Icon — use in ANY nav ──
export function CartIcon() {
  const { cartCount, setCartOpen, cartOpen } = useCart();
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setCartOpen(!cartOpen)}
        title="Cart"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '.35rem', display: 'flex', alignItems: 'center', color: '#c9a96e', position: 'relative' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        {cartCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#c9a96e', color: '#0a0906', borderRadius: '50%',
            width: 16, height: 16, fontSize: '.48rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, fontFamily: 'Montserrat, sans-serif',
          }}>
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ── Cart Sidebar — use in layout or any page ──
export function CartSidebar() {
  const { cart, cartCount, cartTotal, cartOpen, setCartOpen, removeFromCart, cancelAutoClose } = useCart();

  // Checkout state. `payOpen` reveals the two fields Stripe needs before a
  // session can be created; nothing else is collected here because Stripe's own
  // page collects the card.
  const [payOpen, setPayOpen] = useState(false);
  const [payName, setPayName] = useState('');
  const [payEmail, setPayEmail] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const handleRequestAll = () => {
    const services = cart.map(i => i.name).join(',');
    try { sessionStorage.setItem('og_contact_services', services); } catch { /* ignore */ }
    window.location.href = `/contact?services=${encodeURIComponent(services)}`;
  };

  const openPay = () => {
    cancelAutoClose();      // otherwise the panel closes mid-typing
    setPayError(null);
    setPayOpen(true);
  };

  // Only ids and quantities go up. The server re-reads every price from
  // catalog_items — a price posted from the browser is a browser-written invoice.
  const startCheckout = async (intent: 'full' | 'deposit') => {
    setPayBusy(true);
    setPayError(null);
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payName.trim(),
          email: payEmail.trim(),
          intent,
          items: cart.map(i => ({ id: i.id, quantity: i.quantity ?? 1 })),
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) {
        // 409 = the cart cannot be charged as-is (mixed retainer + one-time).
        // 503 = Stripe keys not set. Both carry a message worth showing.
        setPayError(data.error || 'Could not start checkout.');
        setPayBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      console.error('[cart] checkout failed:', e);
      setPayError('Could not reach the payment service. Please try again.');
      setPayBusy(false);
    }
  };

  const canSubmit =
    payName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payEmail.trim()) &&
    !payBusy;

  if (!cartOpen) return null;

  const formatPrice = (price: string | number) => {
    const s = String(price);
    if (s.startsWith('$') || s.startsWith('From')) return s;
    if (!isNaN(Number(price))) return `$${price}`;
    return s;
  };

  return (
    <>
      {/* Backdrop — click to close */}
      <div onClick={() => setCartOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149, background: 'rgba(0,0,0,.45)' }} />

      {/* Sidebar */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, zIndex: 150,
        background: '#0a0906', borderLeft: '1px solid rgba(201,169,110,.15)',
        display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat, sans-serif',
        animation: 'slideIn .25s ease forwards',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(201,169,110,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            <span style={{ fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,232,216,.45)' }}>
              Cart {cartCount > 0 ? `· ${cartCount} item${cartCount > 1 ? 's' : ''}` : ''}
            </span>
          </div>
          <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(240,232,216,.3)', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(240,232,216,.25)', fontSize: '.75rem', lineHeight: 1.8 }}>
              Your cart is empty<br />
              <Link href="/catalog" onClick={() => setCartOpen(false)} style={{ fontSize: '.62rem', color: 'rgba(201,169,110,.4)', textDecoration: 'none' }}>
                Browse services →
              </Link>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ borderBottom: '1px solid rgba(201,169,110,.07)', padding: '.9rem 0', display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                {/* Image placeholder */}
                <div style={{ width: 40, height: 40, background: 'rgba(201,169,110,.06)', border: '1px dashed rgba(201,169,110,.12)', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '.4rem', color: 'rgba(201,169,110,.3)', letterSpacing: '.06em', textAlign: 'center', lineHeight: 1.4 }}>IMG</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.76rem', color: '#e8d5b7', marginBottom: '.25rem', lineHeight: 1.3 }}>{item.name}</div>
                  <div style={{ fontSize: '.78rem', color: '#c9a96e', fontFamily: 'Cormorant Garamond, serif', marginBottom: '.2rem' }}>{formatPrice(item.price)}</div>
                  {item.turnaround && <div style={{ fontSize: '.58rem', color: 'rgba(240,232,216,.25)' }}>{item.turnaround}</div>}
                  {/* Removed 06 Sep 2026: a per-item "Pay directly" link gated on
                      item.stripe_link. catalog_items has no stripe_link column,
                      so the value was always undefined and the link never once
                      rendered. Payment now goes through /api/checkout. */}
                </div>
                <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'rgba(240,232,216,.2)', cursor: 'pointer', fontSize: '1rem', padding: '.2rem', flexShrink: 0 }}>✕</button>
              </div>
            ))
          )}
        </div>

        {/* Footer CTA */}
        {cart.length > 0 && (
          <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(201,169,110,.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '.65rem', color: 'rgba(240,232,216,.35)' }}>Estimated</span>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', color: '#c9a96e' }}>${cartTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            </div>

            {!payOpen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                <button onClick={openPay} style={primaryBtn}>Checkout &amp; Pay →</button>
                <button onClick={handleRequestAll} style={secondaryBtn}>Request a Quote Instead</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                <input
                  value={payName}
                  onChange={e => setPayName(e.target.value)}
                  onFocus={cancelAutoClose}
                  placeholder="Your name"
                  autoComplete="name"
                  style={payField}
                />
                <input
                  value={payEmail}
                  onChange={e => setPayEmail(e.target.value)}
                  onFocus={cancelAutoClose}
                  placeholder="Email for the receipt"
                  type="email"
                  autoComplete="email"
                  style={payField}
                />

                {payError && (
                  <div style={{
                    fontSize: '.6rem', color: '#e0a0a0', lineHeight: 1.6,
                    background: 'rgba(180,80,80,.08)', border: '1px solid rgba(180,80,80,.2)',
                    padding: '.6rem .7rem',
                  }}>
                    {payError}
                    <button
                      onClick={handleRequestAll}
                      style={{
                        display: 'block', marginTop: '.5rem', background: 'none', border: 'none',
                        padding: 0, color: '#c9a96e', fontSize: '.58rem', cursor: 'pointer',
                        textDecoration: 'underline', fontFamily: 'Montserrat, sans-serif',
                      }}
                    >
                      Request a quote instead →
                    </button>
                  </div>
                )}

                {/* Both intents are offered; the server downgrades "full" to a
                    deposit for any "From $X" line rather than charging a total
                    nobody has agreed to yet. */}
                <button
                  onClick={() => startCheckout('full')}
                  disabled={!canSubmit}
                  style={{ ...primaryBtn, opacity: canSubmit ? 1 : .4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
                >
                  {payBusy ? 'Starting…' : 'Pay Full Amount'}
                </button>
                <button
                  onClick={() => startCheckout('deposit')}
                  disabled={!canSubmit}
                  style={{ ...secondaryBtn, opacity: canSubmit ? 1 : .4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
                >
                  {payBusy ? 'Starting…' : 'Pay 50% Deposit'}
                </button>
              </div>
            )}

            <div style={{ marginTop: '.75rem', fontSize: '.52rem', color: 'rgba(240,232,216,.18)', textAlign: 'center', letterSpacing: '.06em', lineHeight: 1.7 }}>
              50% on submission · 50% at delivery · USD<br />
              Card payment is handled by Stripe
            </div>
          </div>
        )}

        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}

const primaryBtn: React.CSSProperties = {
  width: '100%', background: '#c9a96e', color: '#0a0906', border: 'none',
  padding: '.85rem', fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase',
  cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 500,
};

const payField: React.CSSProperties = {
  width: '100%', background: '#0f0d0a', color: '#e8d5b7',
  border: '1px solid rgba(201,169,110,.2)', padding: '.7rem .8rem',
  fontSize: '.7rem', fontFamily: 'Montserrat, sans-serif', outline: 'none',
};

const secondaryBtn: React.CSSProperties = {
  width: '100%', background: 'transparent', color: '#c9a96e',
  border: '1px solid rgba(201,169,110,.25)', padding: '.85rem',
  fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase',
  cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
};
