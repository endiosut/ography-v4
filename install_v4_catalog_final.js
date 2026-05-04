const fs = require('fs');
fs.mkdirSync('C:/Users/Endi Osut/ography-v4/src/app/catalog', {recursive:true});
fs.writeFileSync('C:/Users/Endi Osut/ography-v4/src/app/catalog/page.tsx', `'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Item = {
  id: string; name: string; category: string; subcategory: string | null
  description: string | null; delivery: string; turnaround: string | null
  base_price_usd: number | null; price_note: string | null
  image_url: string | null; style_tags: string[] | null; is_featured: boolean
}
type CartItem = Item & { qty: number }

const CATS = ['all','identity','content','print','digital','event']
const CLABELS: Record<string,string> = {
  all:'All Services', identity:'Identity', content:'Content',
  print:'Print & Physical', digital:'Editorial', event:'Event Media'
}
const STRIPE: Record<string,string> = {
  'Echo Launch Kit': 'https://buy.stripe.com/test_6oU3cva7va74esm7ZXcQU00',
  'Brand Amplification': 'https://buy.stripe.com/test_eVq7sL6Vjbb883Ybc9cQU01',
  'Fractional Creative Partner': 'https://buy.stripe.com/test_bJedR9a7v7YW83YeolcQU02',
}

export default function CatalogPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const cartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('catalog_items')
      .select('id,name,category,subcategory,description,delivery,turnaround,base_price_usd,price_note,image_url,style_tags,is_featured')
      .eq('is_active', true).order('sort_order', { ascending: true })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) setCartOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const visible = filter === 'all' ? items : items.filter(i => i.category === filter)
  const featured = items.filter(i => i.is_featured)
  const cartTotal = cart.reduce((s, i) => s + (i.base_price_usd || 0) * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  const addToCart = (item: Item) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id)
      if (ex) return prev.map(c => c.id === item.id ? {...c, qty: c.qty + 1} : c)
      return [...prev, {...item, qty: 1}]
    })
    setCartOpen(true)
  }
  const removeFromCart = (id: string) => setCart(p => p.filter(c => c.id !== id))
  const updateQty = (id: string, d: number) =>
    setCart(p => p.map(c => c.id === id ? {...c, qty: Math.max(1, c.qty + d)} : c))

  const cartServicesParam = encodeURIComponent(cart.map(c => \`\${c.name} (x\${c.qty})\`).join(', '))
  const checkoutHref = \`/contact?services=\${cartServicesParam}&total=\${cartTotal}\`

  const s = (x: React.CSSProperties) => x

  return (
    <div style={{minHeight:'100vh', background:'#0a0906', fontFamily:'Montserrat,sans-serif'}}>
      <style>{\`
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes badgePop{0%{transform:scale(1.5)}100%{transform:scale(1)}}
        .cat-card{transition:background .2s}
        .cat-card:hover{background:#0f0d0a!important}
        .btn-cart{transition:all .15s}
        .btn-cart:hover{background:rgba(201,169,110,.18)!important}
        .btn-req:hover{background:rgba(201,169,110,.08)!important;color:#c9a96e!important}
        .btn-pay:hover{background:#b8924a!important}
      \`}</style>

      {/* HEADER */}
      <header style={{borderBottom:'1px solid rgba(201,169,110,.1)', padding:'0 2rem', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'rgba(10,9,6,.97)', zIndex:100, backdropFilter:'blur(16px)', height:72}}>
        <a href="/">
          <img src="/logo.svg" alt="OGraphy" style={{height:120, width:'auto', display:'block'}} />
        </a>
        <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
          <Link href="/contact" style={{fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.4)', textDecoration:'none'}}>Contact</Link>
          <Link href="/portal" style={{fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.4)', textDecoration:'none'}}>Portal</Link>

          {/* CART */}
          <div ref={cartRef} style={{position:'relative'}}>
            <button onClick={() => setCartOpen(o => !o)} style={{
              position:'relative', background: cartCount > 0 ? 'rgba(201,169,110,.12)' : 'transparent',
              border:\`1px solid \${cartCount > 0 ? 'rgba(201,169,110,.4)' : 'rgba(201,169,110,.2)'}\`,
              color: cartCount > 0 ? '#c9a96e' : 'rgba(240,232,216,.6)',
              padding:'.4rem .85rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'.5rem',
              fontFamily:'Montserrat,sans-serif', fontSize:'.63rem', letterSpacing:'.08em', transition:'all .2s'
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {cartCount > 0 ? \`Cart (\${cartCount})\` : 'Cart'}
              {cartCount > 0 && (
                <span key={cartCount} style={{
                  position:'absolute', top:-9, right:-9,
                  background:'#c9a96e', color:'#0a0906', borderRadius:'50%',
                  width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'.55rem', fontWeight:700, animation:'badgePop .3s ease-out'
                }}>{cartCount}</span>
              )}
            </button>

            {/* CART DROPDOWN */}
            {cartOpen && (
              <div style={{
                position:'absolute', top:'calc(100% + 10px)', right:0,
                background:'#0f0d0a', border:'1px solid rgba(201,169,110,.15)',
                width:360, zIndex:999, maxHeight:'75vh', display:'flex', flexDirection:'column',
                boxShadow:'0 12px 50px rgba(0,0,0,.8)', animation:'slideIn .2s ease-out'
              }}>
                {/* Cart header */}
                <div style={{padding:'.85rem 1.1rem', borderBottom:'1px solid rgba(201,169,110,.1)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontSize:'.6rem', letterSpacing:'.16em', textTransform:'uppercase', color:'#c9a96e'}}>
                    {cartCount === 0 ? 'Your Cart' : \`\${cartCount} Service\${cartCount > 1 ? 's' : ''} Selected\`}
                  </div>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} style={{background:'transparent', border:'none', color:'rgba(240,232,216,.25)', fontSize:'.55rem', cursor:'pointer', letterSpacing:'.06em'}}>Clear all</button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div style={{padding:'2.5rem 1.5rem', textAlign:'center'}}>
                    <div style={{fontSize:'1.5rem', marginBottom:'.75rem', opacity:.3}}>🛒</div>
                    <div style={{fontSize:'.75rem', color:'rgba(240,232,216,.3)', marginBottom:'.5rem'}}>Your cart is empty</div>
                    <div style={{fontSize:'.62rem', color:'rgba(201,169,110,.4)'}}>Add services using the + Cart button</div>
                  </div>
                ) : (
                  <>
                    <div style={{overflowY:'auto', flex:1, maxHeight:320}}>
                      {cart.map(item => (
                        <div key={item.id} style={{padding:'.85rem 1.1rem', borderBottom:'1px solid rgba(201,169,110,.06)', display:'flex', gap:'.85rem', alignItems:'flex-start'}}>
                          {/* Thumbnail */}
                          <div style={{width:52, height:52, borderRadius:6, overflow:'hidden', flexShrink:0, background:'#161310', border:'1px solid rgba(201,169,110,.08)'}}>
                            {item.image_url
                              ? <img src={item.image_url} alt={item.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                              : <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.42rem', color:'rgba(240,232,216,.2)', textAlign:'center', padding:2}}>{item.category.slice(0,3).toUpperCase()}</div>
                            }
                          </div>
                          <div style={{flex:1, minWidth:0}}>
                            <div style={{fontSize:'.73rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.1rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{item.name}</div>
                            <div style={{fontSize:'.58rem', color:'rgba(240,232,216,.3)', marginBottom:'.4rem', textTransform:'capitalize'}}>{CLABELS[item.category]} · {item.delivery}</div>
                            {item.description && (
                              <div style={{fontSize:'.58rem', color:'rgba(240,232,216,.35)', lineHeight:1.5, marginBottom:'.4rem'}}>
                                {item.description.length > 60 ? item.description.substring(0,60)+'...' : item.description}
                              </div>
                            )}
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.78rem', color:'#c9a96e'}}>
                                {item.base_price_usd ? \`$\${(item.base_price_usd * item.qty).toLocaleString()}\` : 'Quote'}
                              </div>
                              <div style={{display:'flex', alignItems:'center', gap:'.3rem'}}>
                                <button onClick={() => updateQty(item.id, -1)} style={{background:'rgba(201,169,110,.1)', border:'1px solid rgba(201,169,110,.2)', color:'#c9a96e', width:22, height:22, cursor:'pointer', fontSize:'.8rem', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:2}}>−</button>
                                <span style={{fontSize:'.68rem', color:'rgba(240,232,216,.7)', minWidth:18, textAlign:'center', fontFamily:'IBM Plex Mono,monospace'}}>{item.qty}</span>
                                <button onClick={() => updateQty(item.id, 1)} style={{background:'rgba(201,169,110,.1)', border:'1px solid rgba(201,169,110,.2)', color:'#c9a96e', width:22, height:22, cursor:'pointer', fontSize:'.8rem', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:2}}>+</button>
                                <button onClick={() => removeFromCart(item.id)} style={{background:'transparent', border:'none', color:'rgba(239,68,68,.45)', cursor:'pointer', fontSize:'.78rem', marginLeft:'.2rem', padding:'0 .2rem'}}>✕</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Cart footer */}
                    <div style={{padding:'1rem 1.1rem', borderTop:'1px solid rgba(201,169,110,.1)'}}>
                      {/* Price breakdown */}
                      <div style={{marginBottom:'.85rem'}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'.3rem'}}>
                          <span style={{fontSize:'.6rem', color:'rgba(240,232,216,.4)', letterSpacing:'.08em'}}>Total</span>
                          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.95rem', color:'#c9a96e'}}>\${cartTotal.toLocaleString()}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span style={{fontSize:'.55rem', color:'rgba(240,232,216,.25)'}}>Due on submission (50%)</span>
                          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.65rem', color:'rgba(201,169,110,.6)'}}>\${(cartTotal * 0.5).toLocaleString()}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span style={{fontSize:'.55rem', color:'rgba(240,232,216,.25)'}}>Due at delivery (50%)</span>
                          <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.65rem', color:'rgba(201,169,110,.6)'}}>\${(cartTotal * 0.5).toLocaleString()}</span>
                        </div>
                      </div>
                      <Link href={checkoutHref} style={{
                        display:'block', textAlign:'center', background:'#c9a96e', color:'#0a0906',
                        padding:'.75rem', fontFamily:'Montserrat,sans-serif', fontSize:'.67rem',
                        fontWeight:500, letterSpacing:'.12em', textTransform:'uppercase', textDecoration:'none',
                        marginBottom:'.4rem'
                      }}>Request All Services →</Link>
                      <div style={{fontSize:'.52rem', color:'rgba(240,232,216,.2)', textAlign:'center', lineHeight:1.6}}>
                        50% deposit on submission · 50% at delivery
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <div style={{textAlign:'center', padding:'3.5rem 2rem 2.5rem'}}>
        <div style={{fontSize:'.52rem', letterSpacing:'.3em', textTransform:'uppercase', color:'rgba(201,169,110,.55)', marginBottom:'.85rem'}}>Visual Readiness as a Service</div>
        <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:300, color:'#f0e8d8', marginBottom:'.85rem', lineHeight:1.15}}>
          Submit. We execute. You receive.
        </h1>
        <p style={{fontSize:'.78rem', color:'rgba(240,232,216,.45)', maxWidth:480, margin:'0 auto', lineHeight:1.75}}>
          50% on project submission · 50% at delivery · All prices in USD
        </p>
      </div>

      {/* FEATURED STRIP */}
      {featured.length > 0 && (
        <div style={{maxWidth:1100, margin:'0 auto 3rem', padding:'0 2rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
            <div style={{fontSize:'.52rem', letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(201,169,110,.5)'}}>Featured Services</div>
          </div>
          <div style={{display:'flex', gap:'1px', background:'rgba(201,169,110,.1)', overflowX:'auto'}}>
            {featured.slice(0,4).map(item => (
              <div key={item.id} className="cat-card" style={{flex:'0 0 260px', background:'#0a0906', padding:'1.25rem 1.5rem', borderBottom:'2px solid rgba(201,169,110,.25)'}}>
                <div style={{fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(201,169,110,.45)', marginBottom:'.35rem'}}>{CLABELS[item.category]}</div>
                <div style={{fontSize:'.9rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.35rem'}}>{item.name}</div>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.78rem', color:'#c9a96e', marginBottom:'.85rem'}}>{item.price_note || (item.base_price_usd ? \`from $\${item.base_price_usd}\` : '—')}</div>
                <button onClick={() => addToCart(item)} className="btn-cart" style={{background:'rgba(201,169,110,.1)', border:'1px solid rgba(201,169,110,.25)', color:'#c9a96e', padding:'.38rem', fontFamily:'Montserrat,sans-serif', fontSize:'.58rem', letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer', width:'100%'}}>+ Add to Cart</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CATALOG */}
      <div style={{maxWidth:1100, margin:'0 auto', padding:'0 2rem 2rem'}}>
        {/* Filters */}
        <div style={{display:'flex', gap:'.4rem', flexWrap:'wrap', marginBottom:'1.75rem', alignItems:'center'}}>
          {CATS.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              padding:'.38rem .85rem', border:'1px solid', cursor:'pointer',
              fontSize:'.6rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.09em',
              borderColor: filter===c ? '#c9a96e' : 'rgba(201,169,110,.15)',
              background: filter===c ? 'rgba(201,169,110,.08)' : 'transparent',
              color: filter===c ? '#c9a96e' : 'rgba(240,232,216,.42)',
            }}>{CLABELS[c]}</button>
          ))}
          <span style={{marginLeft:'auto', fontSize:'.58rem', color:'rgba(240,232,216,.25)'}}>{visible.length} services</span>
        </div>

        {loading ? (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1px', background:'rgba(201,169,110,.08)'}}>
            {Array(6).fill(0).map((_,i) => (
              <div key={i} style={{background:'#0a0906', padding:'1.75rem'}}>
                <div style={{width:'100%', aspectRatio:'16/9', background:'rgba(201,169,110,.05)', marginBottom:'1rem', borderRadius:4}} />
                <div style={{height:'.65rem', background:'rgba(201,169,110,.06)', width:'40%', marginBottom:'.5rem'}} />
                <div style={{height:'1rem', background:'rgba(201,169,110,.07)', width:'70%', marginBottom:'.5rem'}} />
                <div style={{height:'.7rem', background:'rgba(201,169,110,.05)', marginBottom:'1rem'}} />
                <div style={{height:2.2+'rem', background:'rgba(201,169,110,.06)'}} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1px', background:'rgba(201,169,110,.08)'}}>
            {visible.map(item => {
              const hasStripe = !!STRIPE[item.name]
              const inCart = cart.find(c => c.id === item.id)
              return (
                <div key={item.id} className="cat-card" style={{background:'#0a0906', padding:'1.75rem', display:'flex', flexDirection:'column'}}>
                  {/* Image */}
                  <div style={{width:'100%', aspectRatio:'16/9', background:'#0f0d0a', marginBottom:'1.1rem', overflow:'hidden', borderRadius:4, position:'relative'}}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                      : <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.58rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(240,232,216,.12)'}}>{CLABELS[item.category]}</div>
                    }
                    {inCart && (
                      <div style={{position:'absolute', top:8, right:8, background:'#c9a96e', color:'#0a0906', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.55rem', fontWeight:700}}>{inCart.qty}</div>
                    )}
                  </div>

                  <div style={{fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(201,169,110,.45)', marginBottom:'.35rem'}}>{CLABELS[item.category]}</div>
                  <div style={{fontSize:'.98rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.45rem'}}>{item.name}</div>
                  {item.description && (
                    <div style={{fontSize:'.71rem', color:'rgba(240,232,216,.45)', lineHeight:1.65, marginBottom:'.9rem', flex:1}}>
                      {item.description.length > 95 ? item.description.substring(0,95)+'...' : item.description}
                    </div>
                  )}

                  {/* Price + turnaround */}
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.7rem'}}>
                    <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.9rem', color:'#c9a96e'}}>
                      {item.price_note || (item.base_price_usd ? \`from $\${item.base_price_usd}\` : 'Get quote')}
                    </div>
                    {item.turnaround && <span style={{fontSize:'.52rem', padding:'.12rem .45rem', border:'1px solid rgba(201,169,110,.12)', color:'rgba(240,232,216,.35)'}}>{item.turnaround}</span>}
                  </div>

                  {/* 50/50 note */}
                  {item.base_price_usd && (
                    <div style={{fontSize:'.52rem', color:'rgba(240,232,216,.2)', marginBottom:'.75rem', fontFamily:'IBM Plex Mono,monospace'}}>
                      50% now (\${(item.base_price_usd * 0.5).toLocaleString()}) · 50% on delivery
                    </div>
                  )}

                  {/* ACTION BUTTONS */}
                  <div style={{display:'grid', gridTemplateColumns: hasStripe ? '1fr 1fr' : '1fr 1fr', gap:'1px'}}>
                    {/* Add to Cart */}
                    <button onClick={() => addToCart(item)} className="btn-cart" style={{
                      background: inCart ? 'rgba(201,169,110,.15)' : 'rgba(201,169,110,.08)',
                      border:'1px solid rgba(201,169,110,.3)', color:'#c9a96e',
                      padding:'.58rem .4rem', fontFamily:'Montserrat,sans-serif',
                      fontSize:'.58rem', letterSpacing:'.08em', textTransform:'uppercase', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:'.3rem'
                    }}>
                      {inCart ? \`✓ In Cart (\${inCart.qty})\` : '+ Add to Cart'}
                    </button>

                    {/* Pay upfront OR Request */}
                    {hasStripe ? (
                      <a href={STRIPE[item.name]} target="_blank" rel="noopener noreferrer" className="btn-pay" style={{
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'#c9a96e', color:'#0a0906', border:'none',
                        padding:'.58rem .4rem', fontFamily:'Montserrat,sans-serif',
                        fontSize:'.58rem', fontWeight:500, letterSpacing:'.08em', textTransform:'uppercase', textDecoration:'none', cursor:'pointer'
                      }}>Pay Upfront →</a>
                    ) : (
                      <Link href={\`/contact?service=\${encodeURIComponent(item.name)}\`} className="btn-req" style={{
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background:'transparent', border:'1px solid rgba(201,169,110,.2)',
                        color:'rgba(240,232,216,.5)', padding:'.58rem .4rem',
                        fontFamily:'Montserrat,sans-serif', fontSize:'.58rem',
                        letterSpacing:'.08em', textTransform:'uppercase', textDecoration:'none'
                      }}>Request →</Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{textAlign:'center', padding:'4rem 0 2rem', borderTop:'1px solid rgba(201,169,110,.06)', marginTop:'2rem'}}>
          <div style={{fontSize:'.72rem', color:'rgba(240,232,216,.35)', marginBottom:'1.5rem', lineHeight:1.8}}>
            {cartCount > 0
              ? \`\${cartCount} service\${cartCount > 1 ? 's' : ''} in cart · $\${cartTotal.toLocaleString()} total · $\${(cartTotal * 0.5).toLocaleString()} due on submission\`
              : 'Need something custom? We handle it.'
            }
          </div>
          {cartCount > 0 ? (
            <Link href={checkoutHref} style={{display:'inline-block', background:'#c9a96e', color:'#0a0906', padding:'.9rem 3rem', fontFamily:'Montserrat,sans-serif', fontSize:'.72rem', fontWeight:500, letterSpacing:'.14em', textTransform:'uppercase', textDecoration:'none'}}>
              Request {cartCount} Service{cartCount > 1 ? 's' : ''} →
            </Link>
          ) : (
            <Link href="/contact" style={{display:'inline-block', background:'transparent', border:'1px solid rgba(201,169,110,.25)', color:'#c9a96e', padding:'.9rem 3rem', fontFamily:'Montserrat,sans-serif', fontSize:'.72rem', letterSpacing:'.14em', textTransform:'uppercase', textDecoration:'none'}}>
              Start a Custom Project
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
`, 'utf8');
const lines = fs.readFileSync('C:/Users/Endi Osut/ography-v4/src/app/catalog/page.tsx','utf8').split('\n').length;
console.log('V4 catalog/page.tsx written:', lines, 'lines');
console.log('Has cart system:', fs.readFileSync('C:/Users/Endi Osut/ography-v4/src/app/catalog/page.tsx','utf8').includes('CartItem'));
console.log('Has Stripe links:', fs.readFileSync('C:/Users/Endi Osut/ography-v4/src/app/catalog/page.tsx','utf8').includes('buy.stripe.com'));
console.log('Has 50/50 note:', fs.readFileSync('C:/Users/Endi Osut/ography-v4/src/app/catalog/page.tsx','utf8').includes('50%'));
console.log('Has 120px logo:', fs.readFileSync('C:/Users/Endi Osut/ography-v4/src/app/catalog/page.tsx','utf8').includes('height:120'));
console.log('Done. Restart: Remove-Item -Recurse -Force .next && npm run dev');
