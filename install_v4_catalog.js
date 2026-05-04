const fs = require('fs');
// Install V4 catalog page with cart system
fs.mkdirSync('C:/Users/Endi Osut/ography-v4/src/app/catalog', {recursive:true});
fs.writeFileSync('C:/Users/Endi Osut/ography-v4/src/app/catalog/page.tsx', `'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Item = {
  id: string; name: string; category: string; subcategory: string | null
  description: string | null; delivery: string; turnaround: string | null
  base_price_usd: number | null; price_note: string | null
  image_url: string | null; style_tags: string[] | null; is_featured: boolean
}

type CartItem = Item & { qty: number }

const CATEGORIES = ['all','identity','content','print','digital','event']
const CATEGORY_LABELS: Record<string,string> = {
  all:'All Services', identity:'Identity', content:'Content',
  print:'Print & Physical', digital:'Editorial', event:'Event Media'
}

export default function PublicCatalog() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    supabase.from('catalog_items')
      .select('id,name,category,subcategory,description,delivery,turnaround,base_price_usd,price_note,image_url,style_tags,is_featured')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const visible = filter === 'all' ? items : items.filter(i => i.category === filter)
  const featured = items.filter(i => i.is_featured)
  const cartTotal = cart.reduce((s, i) => s + (i.base_price_usd || 0) * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  const addToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? {...c, qty: c.qty + 1} : c)
      return [...prev, {...item, qty: 1}]
    })
    setCartOpen(true)
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id))
  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => c.id === id ? {...c, qty: Math.max(1, c.qty + delta)} : c).filter(c => c.qty > 0))
  }

  const checkoutUrl = cart.length > 0
    ? \`\${process.env.NEXT_PUBLIC_APP_URL || ''}/contact?services=\${encodeURIComponent(cart.map(c => c.name).join(', '))}\`
    : '/contact'

  return (
    <div style={{minHeight:'100vh', background:'#0a0906', fontFamily:'Montserrat,sans-serif'}}>
      {/* Cart dropdown overlay */}
      {cartOpen && (
        <div style={{position:'fixed',inset:0,zIndex:998}} onClick={() => setCartOpen(false)} />
      )}

      {/* Header */}
      <header style={{borderBottom:'1px solid rgba(201,169,110,.1)', padding:'1.25rem 2rem', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'rgba(10,9,6,.97)', zIndex:100, backdropFilter:'blur(16px)'}}>
        <a href="/" style={{textDecoration:'none'}}>
          <img src="/logo.svg" alt="OGraphy" style={{height:40, width:'auto'}} />
        </a>
        <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
          <Link href="/contact" style={{fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.4)', textDecoration:'none'}}>Contact</Link>
          <Link href="/portal" style={{fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.4)', textDecoration:'none'}}>Client Portal</Link>

          {/* Cart button */}
          <div style={{position:'relative'}}>
            <button
              onClick={() => setCartOpen(o => !o)}
              style={{
                position:'relative', background:'transparent',
                border:'1px solid rgba(201,169,110,.25)',
                color:'rgba(240,232,216,.7)', padding:'.4rem .75rem',
                cursor:'pointer', display:'flex', alignItems:'center', gap:'.4rem',
                fontFamily:'Montserrat,sans-serif', fontSize:'.65rem', letterSpacing:'.08em',
                transition:'all .2s'
              }}
            >
              {/* Cart icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              Cart
              {cartCount > 0 && (
                <span style={{
                  position:'absolute', top:-8, right:-8,
                  background:'#c9a96e', color:'#0a0906',
                  borderRadius:'50%', width:18, height:18,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'.55rem', fontWeight:600, lineHeight:1
                }}>{cartCount}</span>
              )}
            </button>

            {/* Cart dropdown */}
            {cartOpen && (
              <div style={{
                position:'absolute', top:'calc(100% + 8px)', right:0,
                background:'#0f0d0a', border:'1px solid rgba(201,169,110,.15)',
                width:340, zIndex:999, maxHeight:'70vh', display:'flex', flexDirection:'column',
                boxShadow:'0 8px 40px rgba(0,0,0,.7)'
              }} onClick={e => e.stopPropagation()}>
                <div style={{padding:'.75rem 1rem', borderBottom:'1px solid rgba(201,169,110,.1)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{fontSize:'.6rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(201,169,110,.7)'}}>
                    Cart {cartCount > 0 ? \`(\${cartCount})\` : ''}
                  </div>
                  <button onClick={() => setCartOpen(false)} style={{background:'transparent', border:'none', color:'rgba(240,232,216,.35)', cursor:'pointer', fontSize:'.9rem'}}>✕</button>
                </div>

                {cart.length === 0 ? (
                  <div style={{padding:'2rem', textAlign:'center', color:'rgba(240,232,216,.3)', fontSize:'.75rem'}}>
                    Your cart is empty.<br/>
                    <span style={{fontSize:'.65rem', color:'rgba(201,169,110,.4)'}}>Browse services below.</span>
                  </div>
                ) : (
                  <>
                    <div style={{overflowY:'auto', flex:1}}>
                      {cart.map(item => (
                        <div key={item.id} style={{padding:'.75rem 1rem', borderBottom:'1px solid rgba(201,169,110,.06)', display:'flex', gap:'.75rem', alignItems:'flex-start'}}>
                          {/* Item image */}
                          <div style={{width:48, height:48, borderRadius:4, overflow:'hidden', flexShrink:0, background:'#161310'}}>
                            {item.image_url
                              ? <img src={item.image_url} alt={item.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                              : <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.42rem', color:'rgba(240,232,216,.2)', textAlign:'center'}}>{item.category.slice(0,3).toUpperCase()}</div>
                            }
                          </div>
                          <div style={{flex:1, minWidth:0}}>
                            <div style={{fontSize:'.72rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.15rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{item.name}</div>
                            <div style={{fontSize:'.6rem', color:'rgba(240,232,216,.35)', marginBottom:'.35rem', textTransform:'capitalize'}}>{item.category} · {item.delivery}</div>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.75rem', color:'#c9a96e'}}>
                                {item.base_price_usd ? \`$\${(item.base_price_usd * item.qty).toLocaleString()}\` : 'Quote'}
                              </div>
                              <div style={{display:'flex', alignItems:'center', gap:'.3rem'}}>
                                <button onClick={() => updateQty(item.id, -1)} style={{background:'rgba(201,169,110,.1)', border:'1px solid rgba(201,169,110,.2)', color:'#c9a96e', width:20, height:20, cursor:'pointer', fontSize:'.7rem', display:'flex', alignItems:'center', justifyContent:'center'}}>-</button>
                                <span style={{fontSize:'.65rem', color:'rgba(240,232,216,.6)', minWidth:16, textAlign:'center'}}>{item.qty}</span>
                                <button onClick={() => updateQty(item.id, 1)} style={{background:'rgba(201,169,110,.1)', border:'1px solid rgba(201,169,110,.2)', color:'#c9a96e', width:20, height:20, cursor:'pointer', fontSize:'.7rem', display:'flex', alignItems:'center', justifyContent:'center'}}>+</button>
                                <button onClick={() => removeFromCart(item.id)} style={{background:'transparent', border:'none', color:'rgba(239,68,68,.5)', cursor:'pointer', fontSize:'.75rem', marginLeft:'.2rem'}}>✕</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Cart footer */}
                    <div style={{padding:'.75rem 1rem', borderTop:'1px solid rgba(201,169,110,.1)'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.75rem'}}>
                        <span style={{fontSize:'.6rem', color:'rgba(240,232,216,.4)', letterSpacing:'.08em', textTransform:'uppercase'}}>Estimated Total</span>
                        <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.9rem', color:'#c9a96e'}}>\${cartTotal.toLocaleString()}</span>
                      </div>
                      <a href={\`/contact?services=\${encodeURIComponent(cart.map(c => c.name).join(', '))}\`} style={{
                        display:'block', textAlign:'center',
                        background:'#c9a96e', color:'#0a0906',
                        padding:'.7rem', fontFamily:'Montserrat,sans-serif',
                        fontSize:'.65rem', fontWeight:500, letterSpacing:'.12em',
                        textTransform:'uppercase', textDecoration:'none',
                        marginBottom:'.4rem'
                      }}>Proceed to Request</a>
                      <button onClick={() => setCart([])} style={{
                        display:'block', width:'100%', background:'transparent',
                        border:'none', color:'rgba(240,232,216,.25)',
                        fontSize:'.55rem', cursor:'pointer', letterSpacing:'.08em'
                      }}>Clear Cart</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{textAlign:'center', padding:'4rem 2rem 3rem'}}>
        <div style={{fontSize:'.55rem', letterSpacing:'.3em', textTransform:'uppercase', color:'rgba(201,169,110,.6)', marginBottom:'1rem'}}>Visual Readiness as a Service</div>
        <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'clamp(2rem,5vw,3.5rem)', fontWeight:300, color:'#f0e8d8', marginBottom:'1rem', lineHeight:1.15}}>
          One contact. One invoice.<br/>One coordinated result.
        </h1>
        <p style={{fontSize:'.8rem', color:'rgba(240,232,216,.5)', maxWidth:520, margin:'0 auto 2rem', lineHeight:1.7}}>
          Submit your requirements. We execute. You receive.
        </p>
      </div>

      {/* Featured strip */}
      {featured.length > 0 && (
        <div style={{maxWidth:1100, margin:'0 auto 3rem', padding:'0 2rem'}}>
          <div style={{fontSize:'.52rem', letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(201,169,110,.5)', marginBottom:'1rem'}}>Featured Services</div>
          <div style={{display:'flex', gap:'1px', background:'rgba(201,169,110,.1)', overflowX:'auto'}}>
            {featured.slice(0,4).map(item => (
              <div key={item.id} style={{flex:'0 0 260px', background:'#0a0906', padding:'1.25rem', borderBottom:'2px solid rgba(201,169,110,.3)'}}>
                <div style={{fontSize:'.52rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(201,169,110,.5)', marginBottom:'.4rem'}}>{item.category}</div>
                <div style={{fontSize:'.9rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.4rem'}}>{item.name}</div>
                <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.75rem', color:'#c9a96e', marginBottom:'.75rem'}}>{item.price_note || (item.base_price_usd ? \`from $\${item.base_price_usd}\` : '—')}</div>
                <button onClick={() => addToCart(item)} style={{background:'rgba(201,169,110,.1)', border:'1px solid rgba(201,169,110,.2)', color:'#c9a96e', padding:'.35rem .75rem', fontFamily:'Montserrat,sans-serif', fontSize:'.55rem', letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer', width:'100%'}}>+ Add to Cart</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category filters */}
      <div style={{maxWidth:1100, margin:'0 auto', padding:'0 2rem 2rem'}}>
        <div style={{display:'flex', gap:'.5rem', flexWrap:'wrap', marginBottom:'2rem', alignItems:'center'}}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              padding:'.4rem 1rem', border:'1px solid', cursor:'pointer',
              fontSize:'.6rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.1em',
              borderColor: filter===c ? '#c9a96e' : 'rgba(201,169,110,.15)',
              background: filter===c ? 'rgba(201,169,110,.08)' : 'transparent',
              color: filter===c ? '#c9a96e' : 'rgba(240,232,216,.45)',
            }}>{CATEGORY_LABELS[c] || c}</button>
          ))}
          <span style={{marginLeft:'auto', fontSize:'.6rem', color:'rgba(240,232,216,.3)', alignSelf:'center'}}>{visible.length} services</span>
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:'4rem', color:'rgba(240,232,216,.3)', fontSize:'.8rem'}}>Loading catalog...</div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1px', background:'rgba(201,169,110,.08)'}}>
            {visible.map(item => (
              <div key={item.id} style={{background:'#0a0906', padding:'1.75rem', display:'flex', flexDirection:'column'}}>
                <div style={{width:'100%', aspectRatio:'16/9', background:'#0f0d0a', marginBottom:'1.25rem', overflow:'hidden', borderRadius:4}}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                    : <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.6rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(240,232,216,.15)'}}>{CATEGORY_LABELS[item.category]}</div>
                  }
                </div>
                <div style={{fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(201,169,110,.5)', marginBottom:'.4rem'}}>{CATEGORY_LABELS[item.category]}</div>
                <div style={{fontSize:'1rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.5rem'}}>{item.name}</div>
                {item.description && (
                  <div style={{fontSize:'.72rem', color:'rgba(240,232,216,.5)', lineHeight:1.6, marginBottom:'1rem', flex:1}}>
                    {item.description.length > 100 ? item.description.substring(0,100)+'...' : item.description}
                  </div>
                )}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.75rem'}}>
                  <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.9rem', color:'#c9a96e'}}>
                    {item.price_note || (item.base_price_usd ? \`from $\${item.base_price_usd}\` : 'Get quote')}
                  </div>
                  <div style={{display:'flex', gap:'.4rem'}}>
                    {item.turnaround && <span style={{fontSize:'.55rem', padding:'.15rem .5rem', border:'1px solid rgba(201,169,110,.15)', color:'rgba(240,232,216,.4)'}}>{item.turnaround}</span>}
                  </div>
                </div>
                {/* Two buttons: Request + Add to Cart */}
                <div style={{display:'flex', gap:'1px'}}>
                  <a href={\`/contact?service=\${encodeURIComponent(item.name)}\`} style={{
                    flex:1, display:'block', textAlign:'center',
                    background:'transparent', border:'1px solid rgba(201,169,110,.25)',
                    color:'rgba(240,232,216,.6)', padding:'.55rem .4rem',
                    fontFamily:'Montserrat,sans-serif', fontSize:'.58rem',
                    letterSpacing:'.08em', textTransform:'uppercase', textDecoration:'none'
                  }}>Request</a>
                  <button onClick={() => addToCart(item)} style={{
                    flex:1, background:'rgba(201,169,110,.1)',
                    border:'1px solid rgba(201,169,110,.3)', color:'#c9a96e',
                    padding:'.55rem .4rem', fontFamily:'Montserrat,sans-serif',
                    fontSize:'.58rem', letterSpacing:'.08em', textTransform:'uppercase',
                    cursor:'pointer'
                  }}>+ Cart</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{textAlign:'center', padding:'4rem 0 2rem'}}>
          <div style={{fontSize:'.72rem', color:'rgba(240,232,216,.4)', marginBottom:'1.5rem'}}>Need something custom? We handle it.</div>
          <Link href="/contact" style={{display:'inline-block', background:'#c9a96e', color:'#0a0906', padding:'.85rem 2.5rem', fontFamily:'Montserrat,sans-serif', fontSize:'.72rem', fontWeight:500, letterSpacing:'.14em', textTransform:'uppercase', textDecoration:'none'}}>Start Your Project</Link>
        </div>
      </div>
    </div>
  )
}
`, 'utf8');
console.log('✓ catalog/page.tsx with cart system written');
console.log('Lines:', fs.readFileSync('C:/Users/Endi Osut/ography-v4/src/app/catalog/page.tsx','utf8').split('\n').length);
