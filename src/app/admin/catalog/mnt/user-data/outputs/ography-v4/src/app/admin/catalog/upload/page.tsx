'use client'
import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase, getCatalogItems, uploadCatalogImage, upsertCatalogItem, type CatalogItem } from '@/lib/supabase'

const CATEGORIES = ['identity','print','content','event','digital']
const SUBCATEGORIES: Record<string, string[]> = {
  identity: ['logo','brand_kit','typography','color_system'],
  print: ['event','framing','stationery','packaging','photo'],
  content: ['social','photo','video','ugc'],
  event: ['full_kit','signage','badges','backdrop'],
  digital: ['presentation','landing_page','email','proposal'],
}
const DELIVERIES = ['digital','physical','both']
const STYLE_TAGS = ['minimalist','bold','luxury','playful','corporate','organic','geometric','editorial']
const FORMATS = ['A4','A3','A2','A1','A0','6x4','custom','digital','any']

export default function CatalogUpload() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')

  const empty = {
    name: '', category: 'identity', subcategory: '',
    description: '', delivery: 'digital', turnaround: '',
    base_price_usd: '', price_note: '', is_featured: false,
    is_active: true, sort_order: 0, style_tags: [] as string[], format: [] as string[],
  }
  const [form, setForm] = useState<typeof empty>(empty)

  useEffect(() => {
    getCatalogItems().then(setItems)
  }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const toggleTag = (tag: string) => set('style_tags', form.style_tags.includes(tag) ? form.style_tags.filter(t => t !== tag) : [...form.style_tags, tag])
  const toggleFormat = (fmt: string) => set('format', form.format.includes(fmt) ? form.format.filter(f => f !== fmt) : [...form.format, fmt])

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.category) return
    setSaving(true)

    try {
      // First create/update the item to get an ID
      const itemPayload: any = {
        name: form.name, category: form.category,
        subcategory: form.subcategory || null,
        description: form.description || null,
        delivery: form.delivery, turnaround: form.turnaround || null,
        base_price_usd: form.base_price_usd ? parseFloat(form.base_price_usd as string) : null,
        price_note: form.price_note || null,
        is_featured: form.is_featured, is_active: form.is_active,
        sort_order: form.sort_order,
        style_tags: form.style_tags.length > 0 ? form.style_tags : null,
        format: form.format.length > 0 ? form.format : null,
      }

      const item = await upsertCatalogItem(itemPayload)

      // Upload image if provided
      if (imageFile && item) {
        setUploading(true)
        const publicUrl = await uploadCatalogImage(imageFile, item.id)
        await supabase.from('catalog_items').update({
          image_url: publicUrl,
          thumbnail_url: publicUrl
        }).eq('id', item.id)
        setUploading(false)
      }

      setSuccess(`"${form.name}" added to catalog ✓`)
      setForm(empty)
      setImageFile(null)
      setPreviewUrl('')
      const updated = await getCatalogItems()
      setItems(updated)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
    setSaving(false)
  }

  const toggleActive = async (item: CatalogItem) => {
    await supabase.from('catalog_items').update({ is_active: !item.is_active }).eq('id', item.id)
    setItems(items.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
  }

  const toggleFeatured = async (item: CatalogItem) => {
    await supabase.from('catalog_items').update({ is_featured: !item.is_featured }).eq('id', item.id)
    setItems(items.map(i => i.id === item.id ? { ...i, is_featured: !i.is_featured } : i))
  }

  const inp: React.CSSProperties = {
    background: 'var(--dark3)', border: '1px solid var(--border)', color: 'var(--cream)',
    fontFamily: 'Montserrat', fontSize: '.78rem', padding: '.6rem .9rem',
    width: '100%', outline: 'none'
  }
  const lbl: React.CSSProperties = {
    fontSize: '.55rem', letterSpacing: '.14em', textTransform: 'uppercase',
    color: 'rgba(240,232,216,.4)', marginBottom: '.35rem', display: 'block'
  }
  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: '.25rem .65rem', border: '1px solid', cursor: 'pointer',
    fontSize: '.62rem', fontFamily: 'Montserrat', transition: 'all .15s',
    borderColor: active ? 'var(--gold)' : 'var(--border)',
    background: active ? 'rgba(201,169,110,.12)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--cream-muted)',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '2.5rem', minWidth: 0 }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '.55rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.4rem' }}>Catalog Management</div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 300, color: 'var(--cream)' }}>Add Catalog Item</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }}>

          {/* FORM */}
          <form onSubmit={handleSubmit} style={{ background: 'var(--dark)', border: '1px solid var(--border)', padding: '1.75rem' }}>

            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div>
                <label style={lbl}>Item Name *</label>
                <input style={inp} required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Event Pull-Up Banner" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={lbl}>Category *</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.category} onChange={e => { set('category', e.target.value); set('subcategory', '') }}>
                    {CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Subcategory</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.subcategory} onChange={e => set('subcategory', e.target.value)}>
                    <option value="">Select...</option>
                    {(SUBCATEGORIES[form.category] || []).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl}>Description</label>
                <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What's included, what client receives..." />
              </div>

              <div>
                <label style={lbl}>Delivery Format</label>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  {DELIVERIES.map(d => (
                    <button type="button" key={d} style={toggleStyle(form.delivery === d)} onClick={() => set('delivery', d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={lbl}>Available Formats / Sizes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                  {FORMATS.map(f => (
                    <button type="button" key={f} style={toggleStyle(form.format.includes(f))} onClick={() => toggleFormat(f)}>{f}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={lbl}>Base Price (USD)</label>
                  <input type="number" step="0.01" style={inp} value={form.base_price_usd} onChange={e => set('base_price_usd', e.target.value)} placeholder="85" />
                </div>
                <div>
                  <label style={lbl}>Turnaround</label>
                  <input style={inp} value={form.turnaround} onChange={e => set('turnaround', e.target.value)} placeholder="5-7 days" />
                </div>
              </div>

              <div>
                <label style={lbl}>Price Note (shown to clients)</label>
                <input style={inp} value={form.price_note} onChange={e => set('price_note', e.target.value)} placeholder="From $85 — final quote after brief" />
              </div>

              <div>
                <label style={lbl}>Style Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                  {STYLE_TAGS.map(t => (
                    <button type="button" key={t} style={toggleStyle(form.style_tags.includes(t))} onClick={() => toggleTag(t)}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label style={lbl}>Catalog Image</label>
                <div style={{ border: '1px dashed var(--border)', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ color: 'var(--cream-dim)', fontSize: '.72rem' }}>Click to upload image</div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImage} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', fontSize: '.72rem', color: 'var(--cream-muted)' }}>
                  <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} />
                  Featured
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', fontSize: '.72rem', color: 'var(--cream-muted)' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                  Active (visible to clients)
                </label>
              </div>
            </div>

            {success && <div style={{ color: 'var(--green)', fontSize: '.75rem', marginTop: '1rem', padding: '.6rem', background: 'rgba(39,174,96,.1)', border: '1px solid rgba(39,174,96,.2)' }}>{success}</div>}

            <button type="submit" disabled={saving || uploading} style={{
              background: 'var(--gold)', color: 'var(--black)', border: 'none',
              padding: '.75rem 2rem', width: '100%', marginTop: '1.5rem',
              fontFamily: 'Montserrat', fontSize: '.72rem', fontWeight: 500,
              letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer',
              opacity: saving ? .6 : 1
            }}>
              {uploading ? 'Uploading image...' : saving ? 'Saving...' : 'Add to Catalog'}
            </button>
          </form>

          {/* EXISTING ITEMS */}
          <div>
            <div style={{ fontSize: '.6rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--cream-dim)', marginBottom: '1rem' }}>
              {items.length} items in catalog
            </div>
            {items.map(item => (
              <div key={item.id} style={{
                background: 'var(--dark)', border: '1px solid var(--border)',
                padding: '1rem 1.25rem', marginBottom: '1px',
                display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 500, color: 'var(--cream)' }}>{item.name}</div>
                  <div style={{ fontSize: '.62rem', color: 'var(--cream-muted)', marginTop: '.15rem' }}>
                    {item.category} · {item.delivery} · {item.turnaround || '—'}
                    {item.base_price_usd ? ` · $${item.base_price_usd}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <button onClick={() => toggleFeatured(item)} style={{
                    padding: '.2rem .5rem', border: '1px solid', cursor: 'pointer', fontSize: '.55rem',
                    fontFamily: 'Montserrat', letterSpacing: '.08em',
                    borderColor: item.is_featured ? 'var(--gold)' : 'var(--border)',
                    background: item.is_featured ? 'rgba(201,169,110,.1)' : 'transparent',
                    color: item.is_featured ? 'var(--gold)' : 'var(--cream-dim)',
                  }}>
                    {item.is_featured ? '★ FEATURED' : '☆ Feature'}
                  </button>
                  <button onClick={() => toggleActive(item)} style={{
                    padding: '.2rem .5rem', border: '1px solid', cursor: 'pointer', fontSize: '.55rem',
                    fontFamily: 'Montserrat', letterSpacing: '.08em',
                    borderColor: item.is_active ? 'rgba(39,174,96,.4)' : 'var(--border)',
                    background: item.is_active ? 'rgba(39,174,96,.08)' : 'transparent',
                    color: item.is_active ? '#27ae60' : 'var(--cream-dim)',
                  }}>
                    {item.is_active ? '● Live' : '○ Hidden'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
