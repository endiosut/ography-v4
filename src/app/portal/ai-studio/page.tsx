'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const STYLE_KEYWORDS = [
  'Minimal', 'Bold', 'Elegant', 'Modern', 'Classic', 'Playful',
  'Luxury', 'Editorial', 'Geometric', 'Organic', 'Technical', 'Artisanal',
  'Dark & Moody', 'Clean & Bright', 'Vintage', 'Futuristic',
];

type Tab = 'brief' | 'style' | 'assistant' | 'monitor';

type BriefResult = {
  summary: string;
  recommendedServices: string[];
  styleKeywords: string[];
  colorPalette: { name: string; hex: string; description: string }[];
  briefSuggestions: { businessName: string; industry: string; description: string };
};

type StyleResult = {
  moodTitle: string;
  moodDescription: string;
  typographyDirection: string;
  photographyDirection: string;
  brandVoice: string;
  colorNotes: string;
};

type MonitorResult = {
  nextStep: string;
  reasoning: string;
  suggestedService: string;
  trendingForIndustry: string;
};

export default function AIStudioPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('brief');
  const [user, setUser] = useState<{ email: string; name?: string; avatar?: string } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Brief Generator state
  const [briefInput, setBriefInput] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefResult, setBriefResult] = useState<BriefResult | null>(null);
  const [briefError, setBriefError] = useState('');

  // Style Explorer state
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleResult, setStyleResult] = useState<StyleResult | null>(null);

  // Project Assistant state
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Usage Monitor state
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorResult, setMonitorResult] = useState<MonitorResult | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(SB_URL, SB_ANON);
        const { data: { user: u } } = await sb.auth.getUser();
        if (!u) { router.push('/login?next=/portal/ai-studio'); return; }
        setUser({
          email: u.email || '',
          name: u.user_metadata?.full_name,
          avatar: u.user_metadata?.avatar_url,
        });

        const { data: clientData } = await sb
          .from('clients')
          .select('id')
          .eq('email', u.email)
          .single();

        if (clientData) {
          const { data: projectData } = await sb
            .from('projects')
            .select('id, name, service, status, service_name')
            .eq('client_id', clientData.id)
            .order('created_at', { ascending: false });
          setProjects(projectData || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantMessages]);

  const callAI = async (mode: string, input: string, projectContext?: string) => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, input, projectContext }),
    });
    if (!res.ok) throw new Error('AI request failed');
    const data = await res.json();
    return data.result;
  };

  const handleBriefGenerate = async () => {
    if (!briefInput.trim()) return;
    setBriefLoading(true);
    setBriefError('');
    setBriefResult(null);
    try {
      const result = await callAI('brief_generator', briefInput);
      setBriefResult(result);
    } catch {
      setBriefError('Failed to generate. Please check your API key is configured.');
    } finally {
      setBriefLoading(false);
    }
  };

  const handleApplyToBrief = () => {
    if (!briefResult) return;
    const params = new URLSearchParams({
      service: briefResult.recommendedServices[0] || 'Brand Identity',
      prefill: JSON.stringify(briefResult.briefSuggestions),
      keywords: briefResult.styleKeywords.join(','),
    });
    router.push(`/contact?${params.toString()}`);
  };

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords(prev =>
      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
    );
    setStyleResult(null);
  };

  const handleStyleExplore = async () => {
    if (selectedKeywords.length < 2) return;
    setStyleLoading(true);
    setStyleResult(null);
    try {
      const result = await callAI('style_explorer', selectedKeywords.join(', '));
      setStyleResult(result);
    } catch {
    } finally {
      setStyleLoading(false);
    }
  };

  const handleAssistantSend = async () => {
    if (!assistantInput.trim() || assistantLoading) return;
    const question = assistantInput.trim();
    setAssistantInput('');
    setAssistantMessages(prev => [...prev, { role: 'user', text: question }]);
    setAssistantLoading(true);
    try {
      const ctx = selectedProject
        ? projects.find(p => p.id === selectedProject)
        : null;
      const projectContext = ctx
        ? `Service: ${ctx.service_name || ctx.service || ctx.name}, Status: ${ctx.status}`
        : 'General brand guidance';
      const result = await callAI('project_assistant', question, projectContext);
      setAssistantMessages(prev => [...prev, { role: 'ai', text: result }]);
    } catch {
      setAssistantMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I could not process that. Please try again.' }]);
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleMonitorAnalyze = async () => {
    setMonitorLoading(true);
    setMonitorResult(null);
    try {
      const history = projects.length > 0
        ? projects.map(p => p.service_name || p.service || p.name).join(', ')
        : 'No projects yet — new client';
      const result = await callAI('usage_monitor', `Client project history: ${history}`);
      setMonitorResult(result);
    } catch {
    } finally {
      setMonitorLoading(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0906', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/logo.svg" alt="OGraphy" style={{ width: 100, opacity: 0.4, animation: 'pulse 1.5s infinite' }} />
        <style>{`@keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:.6} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '.6rem 3rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', background: 'rgba(10,9,6,.97)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,169,110,.12)',
      }}>
        <Link href="/portal" style={{ textDecoration: 'none' }}>
          <img src="/logo.svg" alt="OGraphy" style={{ width: 148, height: 'auto' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link href="/portal" style={{ fontSize: '.6rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', textDecoration: 'none' }}>
            ← Portal
          </Link>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: user?.avatar ? 'transparent' : 'rgba(201,169,110,.12)',
            border: '1px solid rgba(201,169,110,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', fontSize: '.6rem', color: '#c9a96e',
          }}>
            {user?.avatar
              ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '7rem 2rem 5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 36, height: 36, border: '1px solid rgba(201,169,110,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-7.5-1.5 1.5M5 5l1.5 1.5M19 19l-1.5-1.5M5 19l1.5-1.5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '.5rem', letterSpacing: '.28em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)' }}>OGraphy</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 300, color: '#f0e8d8', lineHeight: 1 }}>Projects</div>
            </div>
          </div>
          <p style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.35)', lineHeight: 1.8, maxWidth: 560 }}>
            Your intelligent creative director. Generate briefs, explore visual directions, get brand guidance, and discover your next move.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(201,169,110,.08)', marginBottom: '2.5rem', overflowX: 'auto' }}>
          {[
            { key: 'brief', label: 'Brief Generator', icon: '✦' },
            { key: 'style', label: 'Style Explorer', icon: '◈' },
            { key: 'assistant', label: 'Brand Assistant', icon: '◎' },
            { key: 'monitor', label: 'Next Move', icon: '→' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as Tab)}
              style={{
                padding: '.8rem 1.5rem', border: 'none', background: 'transparent',
                fontFamily: 'Montserrat, sans-serif', fontSize: '.58rem',
                letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer',
                color: activeTab === tab.key ? '#c9a96e' : 'rgba(232,213,183,.25)',
                borderBottom: `1px solid ${activeTab === tab.key ? '#c9a96e' : 'transparent'}`,
                marginBottom: -1, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: '.4rem',
              }}
            >
              <span style={{ fontSize: '.7rem' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── BRIEF GENERATOR ── */}
        {activeTab === 'brief' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem' }}>
                Brief Generator
              </h2>
              <p style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.7 }}>
                Describe your business concept and we will generate a complete creative brief — service recommendations, style direction, and color palette.
              </p>
            </div>

            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <textarea
                value={briefInput}
                onChange={e => setBriefInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleBriefGenerate(); }}
                placeholder="e.g. I'm launching a sustainable fashion brand targeting Gen Z women in Paris. We focus on slow fashion, earthy tones, and artisanal production..."
                style={{
                  width: '100%', minHeight: 120, padding: '1rem 1.25rem',
                  background: 'rgba(15,13,10,.8)', border: '1px solid rgba(201,169,110,.2)',
                  color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif',
                  fontSize: '.8rem', fontWeight: 300, outline: 'none',
                  boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.7,
                  borderRadius: 4,
                }}
              />
            </div>

            {briefError && (
              <div style={{ fontSize: '.68rem', color: '#e07070', background: 'rgba(224,112,112,.06)', border: '1px solid rgba(224,112,112,.15)', padding: '.6rem .9rem', marginBottom: '1rem', borderRadius: 4 }}>
                {briefError}
              </div>
            )}

            <button
              onClick={handleBriefGenerate}
              disabled={briefLoading || !briefInput.trim()}
              style={{
                background: briefLoading || !briefInput.trim() ? 'rgba(201,169,110,.3)' : '#c9a96e',
                color: '#0a0906', border: 'none', padding: '.85rem 2rem',
                fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase',
                cursor: briefLoading || !briefInput.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'Montserrat, sans-serif', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '.6rem',
              }}
            >
              {briefLoading ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '.9rem' }}>◌</span>
                  Generating...
                </>
              ) : '✦ Generate Brief'}
            </button>

            {briefResult && (
              <div style={{ marginTop: '2rem', animation: 'fadeUp .4s ease forwards' }}>
                {/* Summary */}
                <div style={{ border: '1px solid rgba(201,169,110,.15)', background: '#0f0d0a', padding: '1.75rem', marginBottom: '1.25rem', borderRadius: 6 }}>
                  <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '.75rem' }}>Brand Concept</div>
                  <p style={{ fontSize: '1.05rem', color: '#f0e8d8', lineHeight: 1.8, fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
                    {briefResult.summary}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  {/* Recommended Services */}
                  <div style={{ border: '1px solid rgba(201,169,110,.15)', background: '#0f0d0a', padding: '1.5rem', borderRadius: 6 }}>
                    <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '1rem' }}>Recommended Services</div>
                    {briefResult.recommendedServices?.map((s, i) => (
                      <div key={i} style={{ fontSize: '.72rem', color: '#c9a96e', marginBottom: '.5rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                        <span style={{ width: 4, height: 4, background: '#c9a96e', borderRadius: '50%', flexShrink: 0 }} />
                        {s}
                      </div>
                    ))}
                  </div>

                  {/* Style Keywords */}
                  <div style={{ border: '1px solid rgba(201,169,110,.15)', background: '#0f0d0a', padding: '1.5rem', borderRadius: 6 }}>
                    <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '1rem' }}>Style Direction</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                      {briefResult.styleKeywords?.map(kw => (
                        <span key={kw} style={{ padding: '.3rem .75rem', border: '1px solid rgba(201,169,110,.3)', fontSize: '.6rem', color: '#c9a96e', letterSpacing: '.06em', borderRadius: 3 }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Color Palette */}
                {briefResult.colorPalette?.length > 0 && (
                  <div style={{ border: '1px solid rgba(201,169,110,.15)', background: '#0f0d0a', padding: '1.5rem', marginBottom: '1.25rem', borderRadius: 6 }}>
                    <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '1rem' }}>Suggested Color Palette</div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {briefResult.colorPalette.map(c => (
                        <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', alignItems: 'center' }}>
                          <div style={{ width: 52, height: 52, background: c.hex, borderRadius: 4, border: '1px solid rgba(255,255,255,.08)', boxShadow: `0 2px 8px ${c.hex}44` }} />
                          <div style={{ fontSize: '.55rem', color: '#c9a96e', letterSpacing: '.06em' }}>{c.name}</div>
                          <div style={{ fontSize: '.5rem', color: 'rgba(232,213,183,.3)', fontFamily: 'monospace' }}>{c.hex}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button
                    onClick={handleApplyToBrief}
                    style={{ background: '#c9a96e', color: '#0a0906', border: 'none', padding: '.85rem 2rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}
                  >
                    Start a Project →
                  </button>
                  <button
                    onClick={() => { setBriefResult(null); setBriefInput(''); }}
                    style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.3)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Generate another
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STYLE EXPLORER ── */}
        {activeTab === 'style' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem' }}>
                Style Explorer
              </h2>
              <p style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.7 }}>
                Select 2 or more style keywords. AI will generate a detailed aesthetic brief for your visual world.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '1.5rem' }}>
              {STYLE_KEYWORDS.map(kw => {
                const sel = selectedKeywords.includes(kw);
                return (
                  <button key={kw} onClick={() => toggleKeyword(kw)}
                    style={{
                      padding: '.6rem 1.2rem', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                      fontSize: '.68rem', letterSpacing: '.06em', borderRadius: 3,
                      border: `1px solid ${sel ? '#c9a96e' : 'rgba(201,169,110,.15)'}`,
                      background: sel ? 'rgba(201,169,110,.1)' : 'transparent',
                      color: sel ? '#c9a96e' : 'rgba(232,213,183,.45)',
                      transition: 'all .2s', position: 'relative',
                    }}
                  >
                    {kw}
                    {sel && <span style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, background: '#c9a96e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.4rem', color: '#0a0906' }}>✓</span>}
                  </button>
                );
              })}
            </div>

            {selectedKeywords.length > 0 && (
              <div style={{ fontSize: '.62rem', color: 'rgba(201,169,110,.5)', marginBottom: '1rem' }}>
                {selectedKeywords.length} selected: {selectedKeywords.join(', ')}
              </div>
            )}

            <button
              onClick={handleStyleExplore}
              disabled={styleLoading || selectedKeywords.length < 2}
              style={{
                background: styleLoading || selectedKeywords.length < 2 ? 'rgba(201,169,110,.3)' : '#c9a96e',
                color: '#0a0906', border: 'none', padding: '.85rem 2rem',
                fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase',
                cursor: styleLoading || selectedKeywords.length < 2 ? 'not-allowed' : 'pointer',
                fontFamily: 'Montserrat, sans-serif', fontWeight: 500, marginBottom: '2rem',
              }}
            >
              {styleLoading ? 'Exploring...' : '◈ Explore This Aesthetic'}
            </button>

            {styleResult && (
              <div style={{ animation: 'fadeUp .4s ease forwards' }}>
                <div style={{ border: '1px solid rgba(201,169,110,.2)', background: '#0f0d0a', padding: '2rem', marginBottom: '1.25rem', borderRadius: 6 }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '1.25rem', letterSpacing: '.02em' }}>
                    {styleResult.moodTitle}
                  </div>
                  <p style={{ fontSize: '.78rem', color: 'rgba(232,213,183,.6)', lineHeight: 1.9, whiteSpace: 'pre-line', marginBottom: 0 }}>
                    {styleResult.moodDescription}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'Typography', value: styleResult.typographyDirection },
                    { label: 'Photography', value: styleResult.photographyDirection },
                    { label: 'Brand Voice', value: styleResult.brandVoice },
                    { label: 'Color Direction', value: styleResult.colorNotes },
                  ].map(item => (
                    <div key={item.label} style={{ border: '1px solid rgba(201,169,110,.1)', background: 'rgba(15,13,10,.5)', padding: '1.25rem', borderRadius: 4 }}>
                      <div style={{ fontSize: '.48rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>{item.label}</div>
                      <p style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.65)', lineHeight: 1.7, margin: 0 }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => router.push('/contact')}
                    style={{ background: '#c9a96e', color: '#0a0906', border: 'none', padding: '.85rem 2rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}
                  >
                    Start a Project →
                  </button>
                  <button
                    onClick={() => setStyleResult(null)}
                    style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.3)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Try different keywords
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BRAND ASSISTANT ── */}
        {activeTab === 'assistant' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem' }}>
                Brand Assistant
              </h2>
              <p style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.7 }}>
                Ask anything about your brand — how to use your logo, Instagram strategy, brand guidelines, or what to do next.
              </p>
            </div>

            {projects.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>Context (optional)</div>
                <select
                  value={selectedProject}
                  onChange={e => setSelectedProject(e.target.value)}
                  style={{
                    background: 'rgba(15,13,10,.8)', border: '1px solid rgba(201,169,110,.2)',
                    color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.72rem',
                    padding: '.6rem 1rem', outline: 'none', cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  <option value="">General brand guidance</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.service_name || p.service || p.name} — {p.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Messages */}
            <div style={{
              minHeight: 280, maxHeight: 380, overflowY: 'auto', border: '1px solid rgba(201,169,110,.1)',
              background: '#0a0906', padding: '1.25rem', borderRadius: 6, marginBottom: '1rem',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}>
              {assistantMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(232,213,183,.2)', fontSize: '.72rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '.75rem', opacity: 0.3 }}>◎</div>
                  Ask about logo usage, social media templates, brand colors,{'\n'}typography guidelines, or any brand question.
                </div>
              ) : (
                assistantMessages.map((msg, i) => (
                  <div key={i} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}>
                    <div style={{
                      padding: '.75rem 1rem',
                      background: msg.role === 'user' ? 'rgba(201,169,110,.1)' : '#0f0d0a',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(201,169,110,.2)' : 'rgba(201,169,110,.08)'}`,
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      fontSize: '.75rem', lineHeight: 1.7,
                      color: msg.role === 'user' ? '#c9a96e' : '#e8d5b7',
                    }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize: '.5rem', color: 'rgba(232,213,183,.2)', marginTop: '.3rem', textAlign: msg.role === 'user' ? 'right' : 'left', letterSpacing: '.06em' }}>
                      {msg.role === 'ai' ? 'OGraphy AI' : 'You'}
                    </div>
                  </div>
                ))
              )}
              {assistantLoading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '.3rem', padding: '.75rem 1rem', background: '#0f0d0a', border: '1px solid rgba(201,169,110,.08)', borderRadius: '12px 12px 12px 4px' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 6, height: 6, background: 'rgba(201,169,110,.4)', borderRadius: '50%', animation: `dot 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ display: 'flex', gap: '.75rem' }}>
              <input
                value={assistantInput}
                onChange={e => setAssistantInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAssistantSend()}
                placeholder="How should I use my logo on Instagram?"
                style={{
                  flex: 1, padding: '.75rem 1rem',
                  background: 'rgba(15,13,10,.8)', border: '1px solid rgba(201,169,110,.2)',
                  color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.75rem',
                  outline: 'none', borderRadius: 4,
                }}
              />
              <button
                onClick={handleAssistantSend}
                disabled={!assistantInput.trim() || assistantLoading}
                style={{
                  background: !assistantInput.trim() || assistantLoading ? 'rgba(201,169,110,.3)' : '#c9a96e',
                  color: '#0a0906', border: 'none', padding: '.75rem 1.25rem',
                  cursor: !assistantInput.trim() || assistantLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Montserrat, sans-serif', fontSize: '.65rem',
                  letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 500,
                }}
              >
                Send
              </button>
            </div>

            <div style={{ marginTop: '.75rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {['How do I use my logo on Instagram?', 'What font pairings work with my brand?', 'How should I present my brand to partners?'].map(q => (
                <button key={q} onClick={() => setAssistantInput(q)}
                  style={{ fontSize: '.55rem', color: 'rgba(201,169,110,.4)', background: 'transparent', border: '1px solid rgba(201,169,110,.12)', padding: '.3rem .7rem', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', borderRadius: 3, letterSpacing: '.04em' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── NEXT MOVE (USAGE MONITOR) ── */}
        {activeTab === 'monitor' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem' }}>
                Your Next Move
              </h2>
              <p style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.7 }}>
                Based on your project history and industry trends, AI recommends what to commission next to grow your brand.
              </p>
            </div>

            {/* Project history */}
            {projects.length > 0 ? (
              <div style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '1.25rem', borderRadius: 6, marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.75rem' }}>Your History</div>
                {projects.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid rgba(201,169,110,.05)', fontSize: '.7rem' }}>
                    <span style={{ color: '#e8d5b7' }}>{p.service_name || p.service || p.name}</span>
                    <span style={{ color: 'rgba(232,213,183,.35)', fontSize: '.6rem', letterSpacing: '.06em' }}>{p.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px solid rgba(201,169,110,.08)', padding: '1.25rem', borderRadius: 6, marginBottom: '1.5rem', fontSize: '.72rem', color: 'rgba(232,213,183,.3)' }}>
                No projects yet — AI will recommend your best starting point.
              </div>
            )}

            <button
              onClick={handleMonitorAnalyze}
              disabled={monitorLoading}
              style={{
                background: monitorLoading ? 'rgba(201,169,110,.3)' : '#c9a96e',
                color: '#0a0906', border: 'none', padding: '.85rem 2rem',
                fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase',
                cursor: monitorLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'Montserrat, sans-serif', fontWeight: 500, marginBottom: '1.5rem',
              }}
            >
              {monitorLoading ? 'Analyzing...' : '→ Analyze My Brand'}
            </button>

            {monitorResult && (
              <div style={{ animation: 'fadeUp .4s ease forwards' }}>
                <div style={{ border: '1px solid rgba(201,169,110,.2)', background: '#0f0d0a', padding: '2rem', borderRadius: 6, marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '.75rem' }}>Recommended Next Step</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0e8d8', fontWeight: 300, marginBottom: '.75rem' }}>
                    {monitorResult.nextStep}
                  </div>
                  <p style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.5)', lineHeight: 1.7, marginBottom: '1rem' }}>
                    {monitorResult.reasoning}
                  </p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', border: '1px solid rgba(201,169,110,.2)', padding: '.4rem .85rem', borderRadius: 3 }}>
                    <span style={{ fontSize: '.55rem', color: 'rgba(201,169,110,.6)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Suggested:</span>
                    <span style={{ fontSize: '.7rem', color: '#c9a96e' }}>{monitorResult.suggestedService}</span>
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(201,169,110,.1)', background: 'rgba(15,13,10,.5)', padding: '1.5rem', borderRadius: 6, marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.35)', marginBottom: '.5rem' }}>Trending in Your Industry</div>
                  <p style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.55)', lineHeight: 1.7, margin: 0 }}>{monitorResult.trendingForIndustry}</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => router.push('/contact')}
                    style={{ background: '#c9a96e', color: '#0a0906', border: 'none', padding: '.85rem 2rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}
                  >
                    Start This Project →
                  </button>
                  <button
                    onClick={() => { setMonitorResult(null); }}
                    style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.3)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Re-analyze
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dot {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:.6} }
      `}</style>
    </div>
  );
}
