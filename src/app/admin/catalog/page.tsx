'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type CatalogItem = {
  id: string; name: string; category: string; subcategory: string | null
  description: string | null; delivery: string; turnaround: string | null
  base_price_usd: number | null; price_note: string | null
  image_url: string | null; style_tags: string[] | null
  is_featured: boolean; is_active: boolean; sort_order: number
}

const CATEGORIES = ['identity','print','content','event','digital']
const CATEGORY_LABELS: Record<string,string> = {
  identity:'Identity', print:'Print & Physical', content:'Content', event:'Event', digital:'Digital'
}

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'compact'>('cards')
  const [search, setSearch] = useState('')
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured' | 'non_featured'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all')
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'digital' | 'physical' | 'both'>('all')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [settleWave, setSettleWave] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState('')
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'identity',
    description: '',
    delivery: 'digital',
    turnaround: '',
    base_price_usd: '',
  })

  useEffect(() => {
    supabase.from('catalog_items').select('*').order('sort_order', {ascending:true})
      .then(({data}) => { setItems(data || []); setLoading(false) })
  }, [])

  useEffect(() => {
    let scrollStopTimer: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      setScrollY(window.scrollY || 0)
      setIsScrolling(true)
      if (scrollStopTimer) clearTimeout(scrollStopTimer)
      scrollStopTimer = setTimeout(() => {
        setIsScrolling(false)
        setSettleWave(v => v + 1)
      }, 90)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollStopTimer) clearTimeout(scrollStopTimer)
    }
  }, [])

  const visible = useMemo(() => {
    return items.filter(item => {
      if (filter !== 'all' && item.category !== filter) return false
      if (statusFilter === 'active' && !item.is_active) return false
      if (statusFilter === 'hidden' && item.is_active) return false
      if (featuredFilter === 'featured' && !item.is_featured) return false
      if (featuredFilter === 'non_featured' && item.is_featured) return false
      if (deliveryFilter !== 'all' && item.delivery !== deliveryFilter) return false
      if (search.trim()) {
        const haystack = `${item.name} ${item.description || ''} ${item.category} ${item.subcategory || ''}`.toLowerCase()
        if (!haystack.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [items, filter, statusFilter, featuredFilter, deliveryFilter, search])

  const toggle = async (id: string, field: 'is_active' | 'is_featured', current: boolean) => {
    await supabase.from('catalog_items').update({[field]: !current}).eq('id', id)
    setItems(is => is.map(i => i.id === id ? {...i, [field]: !current} : i))
  }

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id)
    setEditImageFile(null)
    setEditImagePreview(item.image_url || '')
    setEditForm({
      name: item.name,
      category: item.category,
      description: item.description || '',
      delivery: item.delivery,
      turnaround: item.turnaround || '',
      base_price_usd: item.base_price_usd === null ? '' : String(item.base_price_usd),
    })
  }

  const saveEdit = async (id: string) => {
    setSavingEdit(true)
    const payload: {
      name: string
      category: string
      description: string | null
      delivery: string
      turnaround: string | null
      base_price_usd: number | null
      image_url?: string | null
      thumbnail_url?: string | null
    } = {
      name: editForm.name,
      category: editForm.category,
      description: editForm.description || null,
      delivery: editForm.delivery,
      turnaround: editForm.turnaround || null,
      base_price_usd: editForm.base_price_usd ? parseFloat(editForm.base_price_usd) : null,
    }

    if (editImageFile) {
      const ext = editImageFile.name.split('.').pop() || 'jpg'
      const path = `${id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('catalog-images')
        .upload(path, editImageFile, { upsert: true })
      if (!uploadError) {
        const { data: publicData } = supabase.storage.from('catalog-images').getPublicUrl(path)
        payload.image_url = publicData.publicUrl
        payload.thumbnail_url = publicData.publicUrl
      }
    }

    const { data, error } = await supabase
      .from('catalog_items')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
    if (!error && data) {
      setItems(is => is.map(i => (i.id === id ? (data as CatalogItem) : i)))
      setEditingId(null)
      setEditImageFile(null)
      setEditImagePreview('')
    }
    setSavingEdit(false)
  }

  const deleteItem = async (id: string) => {
    const confirmed = window.confirm('Delete this catalog item permanently?')
    if (!confirmed) return
    const { error } = await supabase.from('catalog_items').delete().eq('id', id)
    if (!error) {
      setItems(is => is.filter(i => i.id !== id))
      if (editingId === id) setEditingId(null)
    }
  }

  const cardAccent = (item: CatalogItem, idx: number) => {
    if (!item.is_active) return 'rgba(240,232,216,.42)'
    if (item.is_featured) return 'rgba(201,169,110,.78)'
    if (item.delivery === 'digital') return 'rgba(111,168,220,.72)'
    if (item.delivery === 'physical') return 'rgba(195,155,224,.7)'
    if (item.delivery === 'both') return 'rgba(39,174,96,.72)'
    if (item.category === 'identity') return 'rgba(201,169,110,.68)'
    if (item.category === 'content') return 'rgba(111,168,220,.66)'
    if (item.category === 'print') return 'rgba(195,155,224,.66)'
    if (item.category === 'event') return 'rgba(39,174,96,.66)'
    if (item.category === 'digital') return 'rgba(111,168,220,.72)'
    return idx % 2 === 0 ? 'rgba(201,169,110,.62)' : 'rgba(240,232,216,.44)'
  }

  return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      <AdminSidebar />
      <main className="catalog-admin-surface" style={{marginLeft:220, flex:1, padding:'2.5rem', minWidth:0}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'1.75rem'}}>
          <div>
            <div style={{fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'.4rem'}}>Studio</div>
            <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'1.8rem', fontWeight:300, color:'var(--cream)'}}>Catalog</h1>
          </div>
          <Link href="/admin/catalog/upload" style={{background:'var(--gold)', color:'var(--black)', border:'none', padding:'.55rem 1.25rem', fontFamily:'Montserrat,sans-serif', fontSize:'.7rem', fontWeight:500, letterSpacing:'.1em', textTransform:'uppercase', textDecoration:'none', display:'inline-block'}}>
            + Add Item
          </Link>
        </div>

        <div style={{display:'grid', gap:'.75rem', marginBottom:'1.5rem'}}>
          <div style={{display:'flex', gap:'.4rem', flexWrap:'wrap'}}>
            <div data-ui-row style={{display:'flex', alignItems:'center', gap:'.4rem', flexWrap:'wrap'}}>
              <button
                onClick={() => { setViewMenuOpen(v => !v); setFilterMenuOpen(false) }}
                style={{
                  padding:'.34rem .82rem', border:'1px solid var(--gold)', cursor:'pointer',
                  fontSize:'.58rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.1em',
                  textTransform:'uppercase', background:'var(--gold-dim2)', color:'var(--gold)',
                  borderRadius:999
                }}
              >
                View: {viewMode} {viewMenuOpen ? '▴' : '▾'}
              </button>
              {viewMenuOpen && (
                <div style={{display:'flex', gap:'.35rem', alignItems:'center'}}>
                  {([
                    { key: 'cards', label: '▥ Cards' },
                    { key: 'compact', label: '▦ Compact' },
                    { key: 'list', label: '☰ List' },
                  ] as const).map(v => (
                    <button
                      key={v.key}
                      onClick={() => { setViewMode(v.key); setViewMenuOpen(false) }}
                      style={{
                        padding:'.3rem .7rem', border:'1px solid', cursor:'pointer',
                        fontSize:'.56rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em',
                        borderColor: viewMode===v.key ? 'var(--gold)' : 'var(--border)',
                        background: viewMode===v.key ? 'var(--gold-dim2)' : 'transparent',
                        color: viewMode===v.key ? 'var(--gold)' : 'var(--cream-muted)',
                        borderRadius:999, textTransform:'uppercase'
                      }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div data-ui-row style={{display:'flex', alignItems:'center', gap:'.4rem', flexWrap:'wrap'}}>
              <button
                onClick={() => { setFilterMenuOpen(v => !v); setViewMenuOpen(false) }}
                style={{
                  padding:'.34rem .82rem', border:'1px solid var(--border)', cursor:'pointer',
                  fontSize:'.58rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.1em',
                  textTransform:'uppercase', background:'transparent', color:'var(--cream-muted)',
                  borderRadius:999
                }}
              >
                Filters {filterMenuOpen ? '▴' : '▾'}
              </button>
              {filterMenuOpen && (
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(3, minmax(150px, 1fr))',
                  gap:'1rem',
                  padding:'.55rem',
                  border:'1px solid var(--border)',
                  borderRadius:16,
                  background:'rgba(12,10,7,.65)',
                  backdropFilter:'blur(8px)',
                  boxShadow:'0 8px 20px rgba(0,0,0,.25), inset 0 0 0 1px rgba(201,169,110,.05)'
                }}>
                  <div data-ui-column style={{
                    display:'grid',
                    gap:'.35rem',
                    alignContent:'start',
                    padding:'.6rem',
                    borderRadius:14,
                    border:'1px solid rgba(39,174,96,.22)',
                    background:'linear-gradient(180deg, rgba(39,174,96,.10), rgba(39,174,96,.04))',
                    boxShadow:'0 10px 18px rgba(0,0,0,.22)'
                  }}>
                    <div style={{fontSize:'.52rem', letterSpacing:'.11em', textTransform:'uppercase', color:'var(--cream-dim)'}}>Status</div>
                    {(['all','active','hidden'] as const).map(s => (
                      <button key={s} onClick={() => setStatusFilter(s)} style={{
                        padding:'.25rem .65rem', border:'1px solid', cursor:'pointer', fontSize:'.55rem',
                        borderColor: statusFilter===s
                          ? (s === 'active' ? 'rgba(39,174,96,.45)' : s === 'hidden' ? 'var(--border2)' : 'var(--gold)')
                          : 'var(--border)',
                        background: statusFilter===s
                          ? (s === 'active' ? 'rgba(39,174,96,.09)' : s === 'hidden' ? 'rgba(240,232,216,.06)' : 'var(--gold-dim2)')
                          : 'transparent',
                        color: statusFilter===s
                          ? (s === 'active' ? '#27ae60' : s === 'hidden' ? 'var(--cream-dim)' : 'var(--gold)')
                          : 'var(--cream-muted)',
                        textTransform:'uppercase', borderRadius:999, textAlign:'left'
                      }}>S:{s}</button>
                    ))}
                  </div>

                  <div data-ui-column style={{
                    display:'grid',
                    gap:'.35rem',
                    alignContent:'start',
                    padding:'.6rem',
                    borderRadius:14,
                    border:'1px solid rgba(201,169,110,.28)',
                    background:'linear-gradient(180deg, rgba(201,169,110,.12), rgba(201,169,110,.05))',
                    boxShadow:'0 10px 18px rgba(0,0,0,.22)'
                  }}>
                    <div style={{fontSize:'.52rem', letterSpacing:'.11em', textTransform:'uppercase', color:'var(--cream-dim)'}}>Featured</div>
                    {(['all','featured','non_featured'] as const).map(s => (
                      <button key={s} onClick={() => setFeaturedFilter(s)} style={{
                        padding:'.25rem .65rem', border:'1px solid', cursor:'pointer', fontSize:'.55rem',
                        borderColor: featuredFilter===s
                          ? (s === 'non_featured' ? 'var(--border2)' : 'var(--gold)')
                          : 'var(--border)',
                        background: featuredFilter===s
                          ? (s === 'non_featured' ? 'rgba(240,232,216,.06)' : 'var(--gold-dim2)')
                          : 'transparent',
                        color: featuredFilter===s
                          ? (s === 'non_featured' ? 'var(--cream-dim)' : 'var(--gold)')
                          : 'var(--cream-muted)',
                        textTransform:'uppercase', borderRadius:999, textAlign:'left'
                      }}>F:{s.replace('_',' ')}</button>
                    ))}
                  </div>

                  <div data-ui-column style={{
                    display:'grid',
                    gap:'.35rem',
                    alignContent:'start',
                    padding:'.6rem',
                    borderRadius:14,
                    border:'1px solid rgba(111,168,220,.25)',
                    background:'linear-gradient(180deg, rgba(111,168,220,.10), rgba(111,168,220,.04))',
                    boxShadow:'0 10px 18px rgba(0,0,0,.22)'
                  }}>
                    <div style={{fontSize:'.52rem', letterSpacing:'.11em', textTransform:'uppercase', color:'var(--cream-dim)'}}>Delivery</div>
                    {(['all','digital','physical','both'] as const).map(s => (
                      <button key={s} onClick={() => setDeliveryFilter(s)} style={{
                        padding:'.25rem .65rem', border:'1px solid', cursor:'pointer', fontSize:'.55rem',
                        borderColor: deliveryFilter===s
                          ? (s === 'digital' ? 'rgba(111,168,220,.45)' : s === 'physical' ? 'rgba(155,89,182,.45)' : s === 'both' ? 'rgba(39,174,96,.4)' : 'var(--gold)')
                          : 'var(--border)',
                        background: deliveryFilter===s
                          ? (s === 'digital' ? 'rgba(111,168,220,.1)' : s === 'physical' ? 'rgba(155,89,182,.1)' : s === 'both' ? 'rgba(39,174,96,.08)' : 'var(--gold-dim2)')
                          : 'transparent',
                        color: deliveryFilter===s
                          ? (s === 'digital' ? '#6fa8dc' : s === 'physical' ? '#c39be0' : s === 'both' ? '#27ae60' : 'var(--gold)')
                          : 'var(--cream-muted)',
                        textTransform:'uppercase', borderRadius:999, textAlign:'left'
                      }}>D:{s}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, description, category..."
            style={{
              background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)',
              padding:'.55rem .8rem', fontSize:'.72rem', outline:'none', maxWidth:420
            }}
          />
        </div>

        {/* Category and filters */}
        <div data-ui-row style={{display:'flex', gap:'.4rem', marginBottom:'1rem', flexWrap:'wrap'}}>
          {(['all', ...CATEGORIES]).map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              padding:'.3rem .85rem', border:'1px solid', cursor:'pointer',
              fontSize:'.62rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em',
              borderColor: filter===c ? 'var(--gold)' : 'var(--border)',
              background: filter===c ? 'var(--gold-dim2)' : 'transparent',
              color: filter===c ? 'var(--gold)' : 'var(--cream-muted)',
              borderRadius:999
            }}>{c === 'all' ? 'All' : CATEGORY_LABELS[c]}</button>
          ))}
        </div>

        {loading ? (
          <div style={{color:'var(--cream-muted)', padding:'3rem', textAlign:'center'}}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{color:'var(--cream-muted)', padding:'3rem', textAlign:'center', fontSize:'.85rem'}}>
            No items yet. <Link href="/admin/catalog/upload" style={{color:'var(--gold)'}}>Add your first service →</Link>
          </div>
        ) : (
          <div style={{
            display:'grid',
            gridTemplateColumns: viewMode === 'cards'
              ? 'repeat(auto-fill,minmax(280px,1fr))'
              : viewMode === 'list'
              ? '1fr'
              : 'repeat(auto-fill,minmax(220px,1fr))',
            gap:'1rem',
            scrollSnapType: viewMode === 'list' ? 'y mandatory' : undefined,
            maxHeight: viewMode === 'list' ? 'calc(100vh - 220px)' : undefined,
            overflowY: viewMode === 'list' ? 'auto' : undefined,
            paddingRight: viewMode === 'list' ? '.35rem' : undefined,
          }}>
            {visible.map((item, idx) => (
              <div key={item.id} style={{
                background:'var(--dark)',
                padding: viewMode === 'compact' ? '1rem' : '1.5rem',
                position:'relative',
                border:'1px solid var(--border2)',
                borderRadius:16,
                boxShadow: hoveredId === item.id
                  ? `0 24px 46px rgba(0,0,0,.38), 0 0 0 1px ${cardAccent(item, idx)}, 0 0 22px ${cardAccent(item, idx)}, inset 0 0 0 1px rgba(255,255,255,.08)`
                  : '0 18px 34px rgba(0,0,0,.32), 0 2px 10px rgba(201,169,110,.09), inset 0 0 0 1px rgba(201,169,110,.06)',
                backdropFilter:'blur(6px)',
                transform:`translateY(${Math.sin(scrollY / 85 + idx * 0.95) * (isScrolling ? 9 : 2)}px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) scale(${isScrolling ? 1.008 : 1})`,
                transformStyle:'preserve-3d',
                transition:`transform ${isScrolling ? 80 : 320}ms ${isScrolling ? 'cubic-bezier(.18,1.45,.28,1)' : 'cubic-bezier(.2,.9,.2,1)'}, box-shadow .2s ease`,
                animation:`riseIn 620ms cubic-bezier(.2,.9,.2,1) ${idx * 70}ms both, glowPulse ${4 + (idx % 4)}s ease-in-out ${idx * 70}ms infinite, ${!isScrolling ? `settleBounce 760ms cubic-bezier(.2,1.25,.2,1) ${idx * 24 + (settleWave % 2)}ms 1` : 'none'}`,
                scrollSnapAlign: viewMode === 'list' ? 'start' : undefined,
                scrollMarginTop: viewMode === 'list' ? '1rem' : undefined,
                willChange:'transform',
                outline: hoveredId === item.id ? `1px solid ${cardAccent(item, idx)}` : '1px solid transparent',
                zIndex: hoveredId === item.id ? 3 : 1,
              }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseMove={(e) => {
                const el = e.currentTarget
                const rect = el.getBoundingClientRect()
                const px = (e.clientX - rect.left) / rect.width
                const py = (e.clientY - rect.top) / rect.height
                const rotateY = (px - 0.5) * 11
                const rotateX = (0.5 - py) * 11
                el.style.setProperty('--tilt-x', `${rotateX}deg`)
                el.style.setProperty('--tilt-y', `${rotateY}deg`)
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.setProperty('--tilt-x', '0deg')
                el.style.setProperty('--tilt-y', '0deg')
                setHoveredId(null)
              }}>
                {/* Image placeholder */}
                <div style={{width:'100%', aspectRatio:'16/9', background:'var(--dark2)', marginBottom:'1rem', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', borderRadius:12}}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  ) : (
                    <span style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--cream-dim)'}}>{item.category}</span>
                  )}
                </div>

                {editingId === item.id ? (
                  <div style={{marginBottom:'1rem', display:'grid', gap:'.55rem'}}>
                    <input value={editForm.name} onChange={e => setEditForm(f => ({...f, name:e.target.value}))} style={{background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)', padding:'.45rem .6rem', fontSize:'.72rem'}} />
                    <select value={editForm.category} onChange={e => setEditForm(f => ({...f, category:e.target.value}))} style={{background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)', padding:'.45rem .6rem', fontSize:'.72rem'}}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                    <textarea value={editForm.description} onChange={e => setEditForm(f => ({...f, description:e.target.value}))} placeholder="Description" style={{background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)', padding:'.45rem .6rem', fontSize:'.72rem', minHeight:70}} />
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.5rem'}}>
                      <input value={editForm.turnaround} onChange={e => setEditForm(f => ({...f, turnaround:e.target.value}))} placeholder="Turnaround" style={{background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)', padding:'.45rem .6rem', fontSize:'.72rem'}} />
                      <input type="number" step="0.01" value={editForm.base_price_usd} onChange={e => setEditForm(f => ({...f, base_price_usd:e.target.value}))} placeholder="Price" style={{background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)', padding:'.45rem .6rem', fontSize:'.72rem'}} />
                    </div>
                    <select value={editForm.delivery} onChange={e => setEditForm(f => ({...f, delivery:e.target.value}))} style={{background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)', padding:'.45rem .6rem', fontSize:'.72rem'}}>
                      <option value="digital">digital</option>
                      <option value="physical">physical</option>
                      <option value="both">both</option>
                    </select>
                    <div style={{border:'1px dashed var(--border)', padding:'.55rem'}}>
                      {editImagePreview ? (
                        <img src={editImagePreview} alt="Edit preview" style={{width:'100%', maxHeight:120, objectFit:'cover', marginBottom:'.45rem'}} />
                      ) : null}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setEditImageFile(file)
                          setEditImagePreview(URL.createObjectURL(file))
                        }}
                        style={{width:'100%', fontSize:'.65rem', color:'var(--cream-dim)'}}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:'.52rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--cream-dim)', marginBottom:'.35rem'}}>
                      {CATEGORY_LABELS[item.category]} {item.subcategory ? `· ${item.subcategory.replace('_',' ')}` : ''}
                    </div>
                    <div style={{fontSize:'.9rem', fontWeight:500, color:'var(--cream)', marginBottom:'.4rem'}}>{item.name}</div>
                    {item.description && <div style={{fontSize:'.72rem', color:'var(--cream-muted)', lineHeight:1.5, marginBottom:'.75rem'}}>{item.description.substring(0,80)}{item.description.length>80?'...':''}</div>}

                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.75rem'}}>
                      <div>
                        {item.base_price_usd && <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.85rem', color:'var(--gold)'}}>from ${item.base_price_usd}</span>}
                      </div>
                      <div style={{fontSize:'.62rem', color:'var(--cream-dim)'}}>{item.turnaround}</div>
                    </div>

                    {/* Delivery badge */}
                    <div style={{display:'flex', gap:'.4rem', marginBottom:'1rem', flexWrap:'wrap'}}>
                      <span style={{fontSize:'.55rem', padding:'.15rem .5rem', border:'1px solid var(--border)', color:'var(--cream-dim)', textTransform:'capitalize'}}>{item.delivery}</span>
                      {(item.style_tags||[]).slice(0,2).map(t => (
                        <span key={t} style={{fontSize:'.55rem', padding:'.15rem .5rem', border:'1px solid var(--border)', color:'var(--cream-dim)', textTransform:'capitalize'}}>{t}</span>
                      ))}
                    </div>
                  </>
                )}

                {/* Toggles */}
                <div data-ui-row style={{display:'flex', gap:'.5rem', borderTop:'1px solid var(--border)', paddingTop:'.75rem'}}>
                  <button onClick={() => toggle(item.id, 'is_featured', item.is_featured)} style={{
                    flex:1, padding:'.3rem', border:'1px solid', cursor:'pointer',
                    fontSize:'.58rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.06em',
                    borderColor: item.is_featured ? 'var(--gold)' : 'var(--border)',
                    color: item.is_featured ? 'var(--gold)' : 'var(--cream-dim)',
                    background: item.is_featured ? 'var(--gold-dim2)' : 'transparent',
                  }}>
                    {item.is_featured ? '★ Featured' : '☆ Feature'}
                  </button>
                  <button onClick={() => toggle(item.id, 'is_active', item.is_active)} style={{
                    flex:1, padding:'.3rem', border:'1px solid', cursor:'pointer',
                    fontSize:'.58rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.06em',
                    borderColor: item.is_active ? 'rgba(39,174,96,.4)' : 'var(--border)',
                    color: item.is_active ? '#27ae60' : 'var(--cream-dim)',
                    background: item.is_active ? 'rgba(39,174,96,.06)' : 'transparent',
                  }}>
                    {item.is_active ? '● Live' : '○ Hidden'}
                  </button>
                </div>
                <div data-ui-row style={{display:'flex', gap:'.5rem', marginTop:'.5rem'}}>
                  {editingId === item.id ? (
                    <>
                      <button onClick={() => saveEdit(item.id)} disabled={savingEdit} style={{flex:1, padding:'.3rem', border:'1px solid var(--gold)', background:'rgba(201,169,110,.12)', color:'var(--gold)', fontSize:'.58rem', cursor:'pointer'}}>
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => { setEditingId(null); setEditImageFile(null); setEditImagePreview('') }} style={{flex:1, padding:'.3rem', border:'1px solid var(--border)', background:'transparent', color:'var(--cream-dim)', fontSize:'.58rem', cursor:'pointer'}}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(item)} style={{flex:1, padding:'.3rem', border:'1px solid var(--border)', background:'transparent', color:'var(--cream-dim)', fontSize:'.58rem', cursor:'pointer'}}>
                        Edit
                      </button>
                      <button onClick={() => deleteItem(item.id)} style={{flex:1, padding:'.3rem', border:'1px solid rgba(231,76,60,.45)', background:'rgba(231,76,60,.08)', color:'#e74c3c', fontSize:'.58rem', cursor:'pointer'}}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <style jsx>{`
        .catalog-admin-surface :global(button),
        .catalog-admin-surface :global(a),
        .catalog-admin-surface :global([data-ui-column]),
        .catalog-admin-surface :global([data-ui-row]) {
          transition: box-shadow 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease, background 180ms ease, outline-color 180ms ease;
        }

        .catalog-admin-surface :global(button:hover),
        .catalog-admin-surface :global(a:hover) {
          box-shadow: 0 0 0 1px rgba(201,169,110,.45), 0 8px 18px rgba(0,0,0,.25), 0 0 16px rgba(201,169,110,.16);
          transform: translateY(-1px);
          outline: 1px solid rgba(201,169,110,.35);
          outline-offset: 1px;
        }

        .catalog-admin-surface :global(button:focus-visible),
        .catalog-admin-surface :global(a:focus-visible) {
          box-shadow: 0 0 0 2px rgba(201,169,110,.58), 0 10px 20px rgba(0,0,0,.3);
          outline: 1px solid rgba(201,169,110,.7);
          outline-offset: 1px;
        }

        .catalog-admin-surface :global([data-ui-column]:hover),
        .catalog-admin-surface :global([data-ui-row]:hover) {
          box-shadow: inset 0 0 0 1px rgba(201,169,110,.22), 0 10px 20px rgba(0,0,0,.18);
          border-radius: 12px;
        }

        @keyframes riseIn {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes glowPulse {
          0% { box-shadow: 0 18px 34px rgba(0,0,0,.32), 0 2px 10px rgba(201,169,110,.09), inset 0 0 0 1px rgba(201,169,110,.06); }
          50% { box-shadow: 0 20px 38px rgba(0,0,0,.35), 0 4px 14px rgba(201,169,110,.13), inset 0 0 0 1px rgba(201,169,110,.08); }
          100% { box-shadow: 0 18px 34px rgba(0,0,0,.32), 0 2px 10px rgba(201,169,110,.09), inset 0 0 0 1px rgba(201,169,110,.06); }
        }
        @keyframes settleBounce {
          0% { transform: translateY(0) scale(1.008); }
          45% { transform: translateY(-5px) scale(1.002); }
          72% { transform: translateY(2px) scale(1.001); }
          100% { transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
