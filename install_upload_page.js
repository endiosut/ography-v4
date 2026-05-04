const fs = require('fs');
const base = 'C:/Users/Endi Osut/ography-v4';

fs.mkdirSync(base + '/src/app/admin/catalog/upload', {recursive:true});
fs.writeFileSync(base + '/src/app/admin/catalog/upload/page.tsx', `'use client'
import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type CatalogItem = {
  id: string; name: string; category: string; base_price_usd: number | null
  is_active: boolean; is_featured: boolean; image_url: string | null
  turnaround: string | null; delivery: string | null
}

const CATEGORIES = ['identity','content','print','digital','event']
const STYLE_TAGS = ['minimalist','bold','luxury','playful','corporate','organic','geometric','editorial']
const FORMATS = ['A4','A3','A2','A1','custom','digital']
const DELIVERIES = ['digital','physical','both']

export default function CatalogUploadPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    name: '', category: 'identity', subcategory: '',
    description: '', delivery: 'digital', turnaround: '',
    base_price_usd: '', price_note: '', is_featured: false, is_active: true,
    style_tags: [] as string[], format: [] as string[]
  })

  const set = (k: string, v: any) => setForm(f => ({...f, [k]: v}))
  const toggleTag = (tag: string) => set('style_tags', form.style_tags.includes(tag) ? form.style_tags.filter(t=>t!==tag) : [...form.style_tags, tag])
  const toggleFormat = (f: string) => set('format', form.format.includes(f) ? form.format.filter(x=>x!==f) : [...form.format, f])

  useEffect(() => {
    supabase.from('catalog_items').select('id,name,category,base_price_usd,is_active,is_featured,image_url,turnaround,delivery')
      .order('sort_order', {ascending:true})
      .then(({data}) => { setItems(data||[]); setLoading(false) })
  }, [])

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    let image_url: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = \`catalog/\${Date.now()}.\${ext}\`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('catalog-images')
        .upload(path, imageFile, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        alert('Image upload error: ' + uploadError.message)
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage.from('catalog-images').getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    const payload = {
      name: form.name,
      category: form.category,
      subcategory: form.subcategory || null,
      description: form.description || null,
      delivery: form.delivery,
      turnaround: form.turnaround || null,
      base_price_usd: form.base_price_usd ? parseFloat(form.base_price_usd) : null,
      price_note: form.price_note || null,
      is_featured: form.is_featured,
      is_active: form.is_active,
      style_tags: form.style_tags.length > 0 ? form.style_tags : null,
      format: form.format.length > 0 ? form.format : null,
      image_url,
      sort_order: items.length + 1
    }

    const { data, error } = await supabase.from('catalog_items').insert(payload).select().single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    setItems(prev => [...prev, data])
    setForm({ name:'', category:'identity', subcategory:'', description:'', delivery:'digital', turnaround:'', base_price_usd:'', price_note:'', is_featured:false, is_active:true, style_tags:[], format:[] })
    setImageFile(null)
    setImagePreview(null)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    setSaving(false)
  }

  const toggleField = async (id: string, field: 'is_active'|'is_featured', current: boolean) => {
    await supabase.from('catalog_items').update({[field]: !current}).eq('id', id)
    setItems(is => is.map(i => i.id === id ? {...i, [field]: !current} : i))
  }

  const inp: React.CSSProperties = {
    background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)',
    fontFamily:'Montserrat,sans-serif', fontSize:'.78rem', padding:'.6rem .85rem',
    outline:'none', width:'100%'
  }
  const lbl: React.CSSProperties = {
    fontSize:'.55rem', letterSpacing:'.12em', textTransform:'uppercase',
    color:'rgba(240,232,216,.4)', marginBottom:'.35rem', display:'block'
  }

  return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      <AdminSidebar />
      <main style={{marginLeft:220, flex:1, padding:'2.5rem', minWidth:0}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'1.75rem'}}>
          <div>
            <div style={{fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'.4rem'}}>Catalog Management</div>
            <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'1.8rem', fontWeight:300, color:'var(--cream)'}}>Add Catalog Item</h1>
          </div>
          <Link href="/admin/catalog" style={{color:'var(--cream-muted)', fontSize:'.72rem', fontFamily:'Montserrat,sans-serif', textDecoration:'none'}}>← Back to Catalog</Link>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 340px', gap:'1.5rem', alignItems:'start'}}>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{background:'var(--dark)', border:'1px solid var(--border)', padding:'1.75rem'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem'}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Service Name *</label>
                <input style={inp} required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Echo Launch Kit" />
              </div>
              <div>
                <label style={lbl}>Category *</label>
                <select style={{...inp,cursor:'pointer'}} value={form.category} onChange={e=>set('category',e.target.value)}>
                  {CATEGORIES.map(c=><option key={c} value={c} style={{textTransform:'capitalize'}}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Subcategory</label>
                <input style={inp} value={form.subcategory} onChange={e=>set('subcategory',e.target.value)} placeholder="e.g. brand_kit, social, event" />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Description</label>
                <textarea style={{...inp, minHeight:80, resize:'vertical'}} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What does the client receive? Be specific." />
              </div>
              <div>
                <label style={lbl}>Base Price (USD)</label>
                <input style={inp} type="number" value={form.base_price_usd} onChange={e=>set('base_price_usd',e.target.value)} placeholder="180" />
              </div>
              <div>
                <label style={lbl}>Price Note</label>
                <input style={inp} value={form.price_note} onChange={e=>set('price_note',e.target.value)} placeholder="From $180 — one-time project" />
              </div>
              <div>
                <label style={lbl}>Delivery Type</label>
                <select style={{...inp,cursor:'pointer'}} value={form.delivery} onChange={e=>set('delivery',e.target.value)}>
                  {DELIVERIES.map(d=><option key={d} value={d} style={{textTransform:'capitalize'}}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Turnaround</label>
                <input style={inp} value={form.turnaround} onChange={e=>set('turnaround',e.target.value)} placeholder="5-7 days" />
              </div>
            </div>

            {/* Format toggles */}
            <div style={{marginBottom:'1rem'}}>
              <label style={lbl}>Format Options</label>
              <div style={{display:'flex', gap:'.4rem', flexWrap:'wrap'}}>
                {FORMATS.map(f=>(
                  <button key={f} type="button" onClick={()=>toggleFormat(f)} style={{
                    padding:'.25rem .65rem', border:'1px solid', cursor:'pointer',
                    fontSize:'.62rem', fontFamily:'Montserrat,sans-serif',
                    borderColor: form.format.includes(f)?'var(--gold)':'var(--border)',
                    color: form.format.includes(f)?'var(--gold)':'var(--cream-dim)',
                    background: form.format.includes(f)?'var(--gold-dim2)':'transparent',
                  }}>{f}</button>
                ))}
              </div>
            </div>

            {/* Style tags */}
            <div style={{marginBottom:'1.25rem'}}>
              <label style={lbl}>Style Tags</label>
              <div style={{display:'flex', gap:'.4rem', flexWrap:'wrap'}}>
                {STYLE_TAGS.map(tag=>(
                  <button key={tag} type="button" onClick={()=>toggleTag(tag)} style={{
                    padding:'.25rem .65rem', border:'1px solid', cursor:'pointer',
                    fontSize:'.62rem', fontFamily:'Montserrat,sans-serif',
                    borderColor: form.style_tags.includes(tag)?'var(--gold)':'var(--border)',
                    color: form.style_tags.includes(tag)?'var(--gold)':'var(--cream-dim)',
                    background: form.style_tags.includes(tag)?'var(--gold-dim2)':'transparent',
                  }}>{tag}</button>
                ))}
              </div>
            </div>

            {/* Image upload */}
            <div style={{marginBottom:'1.25rem'}}>
              <label style={lbl}>Catalog Image</label>
              <div style={{border:'1px solid var(--border)', background:'var(--dark2)', padding:'1rem', marginBottom:'.75rem'}}>
                {imagePreview ? (
                  <div style={{position:'relative'}}>
                    <img src={imagePreview} alt="Preview" style={{width:'100%', maxHeight:200, objectFit:'cover', borderRadius:4, display:'block'}} />
                    <button type="button" onClick={()=>{setImageFile(null);setImagePreview(null)}} style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,.6)',border:'none',color:'#fff',width:24,height:24,borderRadius:'50%',cursor:'pointer',fontSize:12}}>✕</button>
                  </div>
                ) : (
                  <div style={{textAlign:'center', padding:'2rem', cursor:'pointer'}} onClick={()=>document.getElementById('img-input')?.click()}>
                    <div style={{fontSize:'1.5rem', marginBottom:'.5rem', opacity:.4}}>⊕</div>
                    <div style={{fontSize:'.65rem', color:'var(--cream-dim)'}}>Click to upload image</div>
                    <div style={{fontSize:'.58rem', color:'var(--cream-dim)', marginTop:'.25rem'}}>PNG, JPG, WebP — 1200×900px recommended</div>
                  </div>
                )}
                <input id="img-input" type="file" accept="image/*" onChange={handleImage} style={{display:'none'}} />
              </div>
              {!imagePreview && (
                <button type="button" onClick={()=>document.getElementById('img-input')?.click()} style={{background:'transparent', border:'1px solid var(--border)', color:'var(--cream-muted)', padding:'.4rem 1rem', fontFamily:'Montserrat,sans-serif', fontSize:'.65rem', cursor:'pointer', width:'100%'}}>
                  Choose Image File
                </button>
              )}
            </div>

            {/* Toggles */}
            <div style={{display:'flex', gap:'2rem', marginBottom:'1.5rem'}}>
              <label style={{display:'flex', alignItems:'center', gap:'.5rem', cursor:'pointer', fontSize:'.75rem', color:'var(--cream-muted)'}}>
                <input type="checkbox" checked={form.is_featured} onChange={e=>set('is_featured',e.target.checked)} />
                Featured
              </label>
              <label style={{display:'flex', alignItems:'center', gap:'.5rem', cursor:'pointer', fontSize:'.75rem', color:'var(--cream-muted)'}}>
                <input type="checkbox" checked={form.is_active} onChange={e=>set('is_active',e.target.checked)} />
                Active (visible to clients)
              </label>
            </div>

            {success && (
              <div style={{background:'rgba(39,174,96,.1)', border:'1px solid rgba(39,174,96,.3)', color:'#27ae60', padding:'.75rem', fontSize:'.75rem', marginBottom:'1rem'}}>
                ✓ Item added successfully
              </div>
            )}

            <button type="submit" disabled={saving} style={{
              background: saving?'var(--border)':'var(--gold)', color:'var(--black)', border:'none',
              padding:'1rem', fontFamily:'Montserrat,sans-serif', fontSize:'.72rem',
              fontWeight:500, letterSpacing:'.12em', textTransform:'uppercase',
              cursor: saving?'default':'pointer', width:'100%', opacity: saving?.7:1
            }}>
              {saving ? (imageFile ? 'Uploading Image...' : 'Saving...') : 'Add to Catalog'}
            </button>
          </form>

          {/* Items list */}
          <div style={{background:'var(--dark)', border:'1px solid var(--border)', padding:'1.25rem', position:'sticky', top:'2.5rem', maxHeight:'85vh', overflowY:'auto'}}>
            <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'1rem'}}>
              {items.length} items in catalog
            </div>
            {loading ? (
              <div style={{color:'var(--cream-dim)', fontSize:'.75rem'}}>Loading...</div>
            ) : items.map(item => (
              <div key={item.id} style={{display:'flex', gap:'.75rem', padding:'.6rem 0', borderBottom:'1px solid var(--border)', alignItems:'center'}}>
                {/* Image placeholder */}
                <div style={{width:40, height:40, borderRadius:6, overflow:'hidden', flexShrink:0, background:'var(--dark2)', border:'1px solid var(--border)'}}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  ) : (
                    <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.55rem', color:'var(--cream-dim)', textAlign:'center', padding:2}}>
                      {item.category.slice(0,3).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'.72rem', fontWeight:500, color:'var(--cream)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{item.name}</div>
                  <div style={{fontSize:'.6rem', color:'var(--cream-dim)', marginTop:2}}>{item.base_price_usd ? \`$\${item.base_price_usd}\` : '—'} · {item.delivery}</div>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:3, flexShrink:0}}>
                  <button onClick={()=>toggleField(item.id,'is_featured',item.is_featured)} style={{
                    fontSize:'.5rem', padding:'2px 5px', border:'1px solid', cursor:'pointer', background:'transparent',
                    borderColor: item.is_featured?'var(--gold)':'var(--border)',
                    color: item.is_featured?'var(--gold)':'var(--cream-dim)'
                  }}>★</button>
                  <button onClick={()=>toggleField(item.id,'is_active',item.is_active)} style={{
                    fontSize:'.5rem', padding:'2px 5px', border:'1px solid', cursor:'pointer', background:'transparent',
                    borderColor: item.is_active?'rgba(39,174,96,.4)':'var(--border)',
                    color: item.is_active?'#27ae60':'var(--cream-dim)'
                  }}>●</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
`, 'utf8');
console.log('✓ catalog/upload/page.tsx written');
console.log('Lines:', fs.readFileSync(base + '/src/app/admin/catalog/upload/page.tsx','utf8').split('\n').length);
