const fs = require('fs');
fs.writeFileSync('C:/Users/Endi Osut/ography-v4/src/app/page.tsx', `import Link from 'next/link'
import { supabase } from '@/lib/supabase'

async function getFeaturedItems() {
  const { data } = await supabase
    .from('catalog_items')
    .select('id,name,category,description,base_price_usd,price_note,turnaround,delivery,image_url')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('sort_order', { ascending: true })
    .limit(6)
  return data || []
}

const CATEGORY_LABELS: Record<string,string> = {
  identity:'Identity Systems', content:'Content Production',
  print:'Print & Physical', digital:'Editorial', event:'Event Media'
}

export default async function HomePage() {
  const featured = await getFeaturedItems()

  return (
    <div style={{ minHeight:'100vh', background:'#0a0906', fontFamily:'Montserrat,sans-serif' }}>
      {/* Nav */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, borderBottom:'1px solid rgba(201,169,110,.08)', background:'rgba(10,9,6,.95)', backdropFilter:'blur(12px)', padding:'.9rem 2.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <img src="/logo.svg" alt="OGraphy" style={{ height:32, width:'auto' }} />
        <div style={{ display:'flex', gap:'2rem', alignItems:'center' }}>
          <Link href="/catalog" style={{ fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.45)', textDecoration:'none' }}>Services</Link>
          <Link href="/contact" style={{ fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.45)', textDecoration:'none' }}>Contact</Link>
          <Link href="/portal" style={{ fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.45)', textDecoration:'none' }}>Client Portal</Link>
          <Link href="/login" style={{ fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'#c9a96e', textDecoration:'none', border:'1px solid rgba(201,169,110,.3)', padding:'.35rem .85rem' }}>Sign In</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ paddingTop:'12rem', paddingBottom:'6rem', textAlign:'center', padding:'12rem 2rem 6rem' }}>
        <div style={{ fontSize:'.52rem', letterSpacing:'.35em', textTransform:'uppercase', color:'rgba(201,169,110,.5)', marginBottom:'1.5rem' }}>Visual Readiness as a Service</div>
        <h1 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'clamp(2.5rem,6vw,5rem)', fontWeight:300, color:'#f0e8d8', lineHeight:1.1, marginBottom:'1.75rem', maxWidth:700, margin:'0 auto 1.75rem' }}>
          We don&apos;t capture moments.<br/>We design how they&apos;re remembered.
        </h1>
        <p style={{ fontSize:'.82rem', color:'rgba(240,232,216,.45)', maxWidth:480, margin:'0 auto 3rem', lineHeight:1.8 }}>
          One contact. One invoice. One coordinated result.<br/>Submit your requirements — we execute — you receive.
        </p>
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/catalog" style={{ background:'#c9a96e', color:'#0a0906', padding:'.9rem 2.5rem', fontFamily:'Montserrat,sans-serif', fontSize:'.7rem', fontWeight:500, letterSpacing:'.14em', textTransform:'uppercase', textDecoration:'none', display:'inline-block' }}>
            Browse Services
          </Link>
          <Link href="/contact" style={{ background:'transparent', color:'rgba(240,232,216,.7)', border:'1px solid rgba(201,169,110,.25)', padding:'.9rem 2.5rem', fontFamily:'Montserrat,sans-serif', fontSize:'.7rem', letterSpacing:'.14em', textTransform:'uppercase', textDecoration:'none', display:'inline-block' }}>
            Start a Project
          </Link>
        </div>
      </div>

      {/* Featured services */}
      {featured.length > 0 && (
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 2rem 6rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'2rem' }}>
            <div style={{ fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(201,169,110,.5)' }}>Featured Services</div>
            <Link href="/catalog" style={{ fontSize:'.6rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(201,169,110,.6)', textDecoration:'none' }}>View All →</Link>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1px', background:'rgba(201,169,110,.08)' }}>
            {featured.map(item => (
              <div key={item.id} style={{ background:'#0a0906', padding:'1.75rem' }}>
                <div style={{ fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(201,169,110,.4)', marginBottom:'.5rem' }}>
                  {CATEGORY_LABELS[item.category] || item.category}
                </div>
                <div style={{ fontSize:'1rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.6rem' }}>{item.name}</div>
                {item.description && (
                  <div style={{ fontSize:'.72rem', color:'rgba(240,232,216,.45)', lineHeight:1.6, marginBottom:'1rem' }}>
                    {item.description.length > 90 ? item.description.substring(0,90)+'...' : item.description}
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:'.82rem', color:'#c9a96e' }}>
                    {item.price_note || (item.base_price_usd ? \`from $\${item.base_price_usd}\` : 'Get quote')}
                  </span>
                  {item.turnaround && <span style={{ fontSize:'.55rem', color:'rgba(240,232,216,.3)', padding:'.15rem .5rem', border:'1px solid rgba(201,169,110,.12)' }}>{item.turnaround}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{ maxWidth:900, margin:'0 auto', padding:'0 2rem 6rem', textAlign:'center' }}>
        <div style={{ fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(201,169,110,.5)', marginBottom:'3rem' }}>How It Works</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'2rem' }}>
          {[
            ['01', 'Browse & Request', 'Browse our catalog of services. Select what fits. Submit your request — takes 3 minutes.'],
            ['02', 'We Execute', 'Your brief goes directly to production. No middlemen. No revision chaos. Coordinated delivery.'],
            ['03', 'You Receive', 'Files delivered to your portal. Physical products shipped. One invoice, paid. Done.'],
          ].map(([num, title, desc]) => (
            <div key={num} style={{ padding:'2rem 1.5rem', border:'1px solid rgba(201,169,110,.08)' }}>
              <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:'1.5rem', color:'rgba(201,169,110,.2)', marginBottom:'1rem' }}>{num}</div>
              <div style={{ fontSize:'.82rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.75rem' }}>{title}</div>
              <div style={{ fontSize:'.72rem', color:'rgba(240,232,216,.4)', lineHeight:1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign:'center', padding:'4rem 2rem 6rem', borderTop:'1px solid rgba(201,169,110,.06)' }}>
        <h2 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'clamp(1.5rem,4vw,2.5rem)', fontWeight:300, color:'#f0e8d8', marginBottom:'1rem' }}>
          Ready to start your project?
        </h2>
        <p style={{ fontSize:'.75rem', color:'rgba(240,232,216,.4)', marginBottom:'2rem' }}>
          Browse the full catalog or contact us directly. We respond within 24 hours.
        </p>
        <Link href="/catalog" style={{ background:'#c9a96e', color:'#0a0906', padding:'.9rem 3rem', fontFamily:'Montserrat,sans-serif', fontSize:'.7rem', fontWeight:500, letterSpacing:'.14em', textTransform:'uppercase', textDecoration:'none', display:'inline-block' }}>
          Browse Services
        </Link>
      </div>

      {/* Footer */}
      <div style={{ borderTop:'1px solid rgba(201,169,110,.06)', padding:'2rem', display:'flex', justifyContent:'space-between', alignItems:'center', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ fontSize:'.58rem', color:'rgba(240,232,216,.2)' }}>OGraphy V4 · Studio Platform</div>
        <div style={{ display:'flex', gap:'1.5rem' }}>
          <Link href="/catalog" style={{ fontSize:'.58rem', color:'rgba(240,232,216,.2)', textDecoration:'none' }}>Services</Link>
          <Link href="/contact" style={{ fontSize:'.58rem', color:'rgba(240,232,216,.2)', textDecoration:'none' }}>Contact</Link>
          <Link href="/portal" style={{ fontSize:'.58rem', color:'rgba(240,232,216,.2)', textDecoration:'none' }}>Portal</Link>
        </div>
      </div>
    </div>
  )
}
`, 'utf8');
console.log('✓ Root landing page installed');
console.log('Lines:', fs.readFileSync('C:/Users/Endi Osut/ography-v4/src/app/page.tsx','utf8').split('\n').length);
