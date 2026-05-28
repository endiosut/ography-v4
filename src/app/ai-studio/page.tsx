'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const STYLE_KEYWORDS = [
  'Minimal', 'Bold', 'Elegant', 'Modern', 'Classic', 'Playful',
  'Luxury', 'Editorial', 'Geometric', 'Organic', 'Technical', 'Artisanal',
  'Dark & Moody', 'Clean & Bright', 'Vintage', 'Futuristic',
];

const SUGGESTED_QUESTIONS = [
  'What visual style fits a luxury skincare brand?',
  'Help me choose between two identity directions',
  'What content kit suits my stage of growth?',
  'How should I think about my brand\'s color palette?',
];

type Tab = 'brief' | 'style' | 'assistant' | 'monitor';
type Message = { role: 'user' | 'assistant'; content: string };

export default function AIStudioPage() {
  const [activeTab, setActiveTab] = useState<Tab>('brief');
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  // Brief Generator
  const [briefInput, setBriefInput] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefResult, setBriefResult] = useState<any>(null);
  const [briefError, setBriefError] = useState('');

  // Style Explorer
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleResult, setStyleResult] = useState<any>(null);
  const [styleError, setStyleError] = useState('');

  // Brand Assistant
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Usage Monitor
  const [monitorData, setMonitorData] = useState<{ activeProjects: number; completedProjects: number; servicesUsed: string[] } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(SB_URL, SB_ANON);
        const { data: { user: u } } = await sb.auth.getUser();
        if (!u) return;
        setUser({ email: u.email || '', name: u.user_metadata?.full_name });

        const { data: clientData } = await sb.from('clients').select('id').eq('email', u.email).single();
        if (clientData) {
          const { data: projectData } = await sb.from('projects').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false });
          const projs = projectData || [];
          setProjects(projs);
          setMonitorData({
            activeProjects: projs.filter((p: any) => !['completed', 'delivered'].includes(p.status || p.stage || '')).length,
            completedProjects: projs.filter((p: any) => ['completed', 'delivered'].includes(p.status || p.stage || '')).length,
            servicesUsed: [...new Set(projs.map((p: any) => p.service_name || p.name).filter(Boolean))] as string[],
          });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateBrief = async () => {
    if (!briefInput.trim()) return;
    setBriefLoading(true); setBriefError('');
    try {
      const res = await fetch('/api/ai-studio/generate-brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: briefInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBriefResult(data);
    } catch (e: any) { setBriefError(e.message || 'Generation failed'); }
    finally { setBriefLoading(false); }
  };

  const exploreStyle = async () => {
    if (!selectedKeywords.length) return;
    setStyleLoading(true); setStyleError('');
    try {
      const res = await fetch('/api/ai-studio/style-explorer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: selectedKeywords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStyleResult(data);
    } catch (e: any) { setStyleError(e.message || 'Generation failed'); }
    finally { setStyleLoading(false); }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || chatLoading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const projectContext = projects.length > 0
        ? `Client has ${projects.length} project(s). Services used: ${projects.map((p: any) => p.service_name || p.name).filter(Boolean).join(', ')}`
        : undefined;
      const res = await fetch('/api/ai-studio/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, projectContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally { setChatLoading(false); }
  };

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords(prev => prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]);
    setStyleResult(null);
  };

  const TAB_LABELS: Record<Tab, string> = {
    brief: 'Brief Generator',
    style: 'Style Explorer',
    assistant: 'Brand Assistant',
    monitor: 'Usage Monitor',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>
      <NavBar />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '7rem 3rem 5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>OGraphy Studio</div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 300, color: '#f0e8d8', marginBottom: '.4rem' }}>
            AI Studio
          </h1>
          <p style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.35)', lineHeight: 1.7 }}>
            Generate briefs, explore aesthetics, and get brand guidance — powered by Claude.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(201,169,110,.08)', marginBottom: '2.5rem', gap: 0 }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '.7rem 1.5rem', border: 'none', background: 'transparent',
              fontFamily: 'Montserrat, sans-serif', fontSize: '.58rem', letterSpacing: '.12em',
              textTransform: 'uppercase', cursor: 'pointer',
              color: activeTab === tab ? '#c9a96e' : 'rgba(232,213,183,.3)',
              borderBottom: `1px solid ${activeTab === tab ? '#c9a96e' : 'transparent'}`,
              marginBottom: -1, transition: 'color .2s',
            }}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* ── TAB 1: Brief Generator ── */}
        {activeTab === 'brief' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '.58rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '.75rem' }}>
                Describe your brand intent
              </div>
              <textarea
                value={briefInput}
                onChange={e => setBriefInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) generateBrief(); }}
                placeholder="Describe your brand, what you do, who you serve, and what kind of visual identity you need..."
                style={{
                  width: '100%', background: '#0f0d0a', border: '1px solid rgba(201,169,110,.15)',
                  color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.82rem',
                  padding: '1rem 1.25rem', outline: 'none', resize: 'vertical', minHeight: 120,
                  boxSizing: 'border-box', lineHeight: 1.7,
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(201,169,110,.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(201,169,110,.15)')}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.75rem' }}>
                <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.2)' }}>⌘↵ to generate</div>
                <button onClick={generateBrief} disabled={briefLoading || !briefInput.trim()} style={{
                  background: briefLoading ? 'rgba(201,169,110,.3)' : '#c9a96e',
                  color: '#0a0906', border: 'none', padding: '.65rem 1.75rem',
                  fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase',
                  cursor: briefLoading ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 500,
                }}>
                  {briefLoading ? 'Generating...' : 'Generate Brief →'}
                </button>
              </div>
              {briefError && <div style={{ fontSize: '.65rem', color: '#e07070', marginTop: '.5rem' }}>{briefError}</div>}
            </div>

            {briefResult && (
              <div style={{ border: '1px solid rgba(201,169,110,.12)', background: '#0f0d0a', padding: '1.75rem', borderRadius: 6, animation: 'fadeIn .4s ease' }}>
                <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '1.25rem' }}>Generated Brief</div>

                <p style={{ fontSize: '.8rem', color: '#e8d5b7', lineHeight: 1.8, marginBottom: '1.5rem' }}>{briefResult.brief}</p>

                {briefResult.services?.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '.5rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(201,169,110,.35)', marginBottom: '.6rem' }}>Recommended Services</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                      {briefResult.services.map((s: string) => (
                        <span key={s} style={{ fontSize: '.62rem', color: '#c9a96e', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.2)', padding: '.3rem .75rem', borderRadius: 20 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {briefResult.style?.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '.5rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(201,169,110,.35)', marginBottom: '.6rem' }}>Style Keywords</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                      {briefResult.style.map((k: string) => (
                        <span key={k} style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.6)', background: 'rgba(232,213,183,.04)', border: '1px solid rgba(232,213,183,.1)', padding: '.3rem .75rem', borderRadius: 20 }}>{k}</span>
                      ))}
                    </div>
                  </div>
                )}

                {briefResult.palette?.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '.5rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(201,169,110,.35)', marginBottom: '.6rem' }}>Color Palette</div>
                    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                      {briefResult.palette.map((c: any) => (
                        <div key={c.hex} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 4, background: c.hex, border: '1px solid rgba(255,255,255,.1)' }} />
                          <div>
                            <div style={{ fontSize: '.6rem', color: '#e8d5b7' }}>{c.name}</div>
                            <div style={{ fontSize: '.52rem', color: 'rgba(232,213,183,.35)', fontFamily: 'IBM Plex Mono, monospace' }}>{c.hex}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link href={`/contact?services=${encodeURIComponent(briefResult.services?.join(',') || '')}&brief=${encodeURIComponent(briefResult.brief || '')}`}
                  style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.75rem 1.75rem', fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>
                  Submit This Brief →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Style Explorer ── */}
        {activeTab === 'style' && (
          <div>
            <div style={{ fontSize: '.58rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '1rem' }}>
              Select aesthetic keywords
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '1.5rem' }}>
              {STYLE_KEYWORDS.map(kw => {
                const sel = selectedKeywords.includes(kw);
                return (
                  <button key={kw} onClick={() => toggleKeyword(kw)} style={{
                    padding: '.4rem 1rem', background: sel ? 'rgba(201,169,110,.1)' : 'transparent',
                    border: `1px solid ${sel ? '#c9a96e' : 'rgba(201,169,110,.18)'}`,
                    color: sel ? '#c9a96e' : 'rgba(232,213,183,.45)',
                    fontFamily: 'Montserrat, sans-serif', fontSize: '.6rem', letterSpacing: '.08em',
                    cursor: 'pointer', transition: 'all .2s', borderRadius: 2,
                  }}>
                    {kw}
                  </button>
                );
              })}
            </div>
            {selectedKeywords.length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button onClick={exploreStyle} disabled={styleLoading} style={{
                  background: styleLoading ? 'rgba(201,169,110,.3)' : '#c9a96e',
                  color: '#0a0906', border: 'none', padding: '.65rem 1.75rem',
                  fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase',
                  cursor: styleLoading ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 500,
                }}>
                  {styleLoading ? 'Exploring...' : `Explore ${selectedKeywords.length} Keywords →`}
                </button>
                <button onClick={() => { setSelectedKeywords([]); setStyleResult(null); }} style={{ background: 'none', border: 'none', fontSize: '.58rem', color: 'rgba(232,213,183,.3)', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                  Clear
                </button>
              </div>
            )}
            {styleError && <div style={{ fontSize: '.65rem', color: '#e07070', marginBottom: '1rem' }}>{styleError}</div>}

            {styleResult && (
              <div style={{ border: '1px solid rgba(201,169,110,.12)', background: '#0f0d0a', padding: '1.75rem', borderRadius: 6, animation: 'fadeIn .4s ease' }}>
                <p style={{ fontSize: '.82rem', color: '#e8d5b7', lineHeight: 1.8, marginBottom: '1.5rem' }}>{styleResult.description}</p>
                {styleResult.palette?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '.5rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(201,169,110,.35)', marginBottom: '.75rem' }}>Palette</div>
                    <div style={{ display: 'flex', gap: 0, height: 60, borderRadius: 6, overflow: 'hidden', marginBottom: '.75rem' }}>
                      {styleResult.palette.map((c: any) => (
                        <div key={c.hex} style={{ flex: 1, background: c.hex, position: 'relative' }} title={`${c.name}: ${c.hex}`} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {styleResult.palette.map((c: any) => (
                        <div key={c.hex} style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                          <div style={{ width: 14, height: 14, borderRadius: 2, background: c.hex, border: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }} />
                          <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.5)' }}>
                            {c.name} <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(232,213,183,.3)' }}>{c.hex}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Brand Assistant ── */}
        {activeTab === 'assistant' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 520 }}>
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '1.25rem', borderRadius: 6, marginBottom: '1rem' }}>
              {messages.length === 0 ? (
                <div>
                  <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.3)', textAlign: 'center', padding: '2rem 0 1.5rem', lineHeight: 1.8 }}>
                    OGraphy creative director, ready.<br />
                    <span style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.18)' }}>Ask about brand direction, services, or aesthetics.</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', justifyContent: 'center' }}>
                    {SUGGESTED_QUESTIONS.map(q => (
                      <button key={q} onClick={() => sendMessage(q)} style={{
                        background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.12)',
                        color: 'rgba(232,213,183,.45)', fontFamily: 'Montserrat, sans-serif',
                        fontSize: '.6rem', padding: '.45rem .9rem', cursor: 'pointer',
                        lineHeight: 1.5, textAlign: 'left', borderRadius: 4, maxWidth: 260,
                      }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, i) => (
                    <div key={i} style={{
                      marginBottom: '1rem', display: 'flex',
                      justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '78%', padding: '.75rem 1rem', borderRadius: 6,
                        background: m.role === 'user' ? 'rgba(201,169,110,.1)' : 'rgba(232,213,183,.04)',
                        border: `1px solid ${m.role === 'user' ? 'rgba(201,169,110,.25)' : 'rgba(232,213,183,.08)'}`,
                        fontSize: '.78rem', color: m.role === 'user' ? '#c9a96e' : '#e8d5b7',
                        lineHeight: 1.7,
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ padding: '.75rem 1rem', background: 'rgba(232,213,183,.04)', border: '1px solid rgba(232,213,183,.08)', borderRadius: 6 }}>
                        <span style={{ fontSize: '.65rem', color: 'rgba(232,213,183,.3)' }}>Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '.5rem' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput); } }}
                placeholder="Ask about brand direction, aesthetics, or services..."
                style={{
                  flex: 1, background: '#0f0d0a', border: '1px solid rgba(201,169,110,.15)',
                  color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.78rem',
                  padding: '.75rem 1rem', outline: 'none', borderRadius: 4,
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(201,169,110,.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(201,169,110,.15)')}
              />
              <button onClick={() => sendMessage(chatInput)} disabled={chatLoading || !chatInput.trim()} style={{
                background: '#c9a96e', color: '#0a0906', border: 'none',
                padding: '.75rem 1.5rem', fontSize: '.62rem', letterSpacing: '.1em',
                textTransform: 'uppercase', cursor: chatLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'Montserrat, sans-serif', fontWeight: 500, borderRadius: 4,
                opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
              }}>
                Send
              </button>
            </div>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} style={{ background: 'none', border: 'none', fontSize: '.55rem', color: 'rgba(232,213,183,.2)', cursor: 'pointer', marginTop: '.4rem', fontFamily: 'Montserrat, sans-serif', textAlign: 'left' }}>
                Clear conversation
              </button>
            )}
          </div>
        )}

        {/* ── TAB 4: Usage Monitor ── */}
        {activeTab === 'monitor' && (
          <div>
            {!user ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px solid rgba(201,169,110,.08)', borderRadius: 6 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0e8d8', marginBottom: '.75rem', fontWeight: 300 }}>Sign in to view your usage</div>
                <Link href="/login" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.75rem 2rem', fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>Sign In →</Link>
              </div>
            ) : !monitorData || (monitorData.activeProjects === 0 && monitorData.completedProjects === 0) ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px solid rgba(201,169,110,.08)', borderRadius: 6 }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0e8d8', marginBottom: '.75rem', fontWeight: 300 }}>Usage Monitor</div>
                <p style={{ fontSize: '.78rem', color: 'rgba(232,213,183,.35)', lineHeight: 1.8, maxWidth: 360, margin: '0 auto 1.5rem' }}>Activates after your first completed project. Your usage patterns, service history, and growth metrics will appear here.</p>
                <Link href="/catalog" style={{ display: 'inline-block', border: '1px solid rgba(201,169,110,.3)', color: '#c9a96e', padding: '.7rem 1.75rem', fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none' }}>Browse Services →</Link>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '2rem' }}>
                  {[
                    { label: 'Active Projects', value: monitorData.activeProjects },
                    { label: 'Completed', value: monitorData.completedProjects },
                    { label: 'Services Used', value: monitorData.servicesUsed.length },
                  ].map(stat => (
                    <div key={stat.label} style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '1.25rem', textAlign: 'center', borderRadius: 4 }}>
                      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', color: '#c9a96e', fontWeight: 300, lineHeight: 1 }}>{stat.value}</div>
                      <div style={{ fontSize: '.48rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(232,213,183,.3)', marginTop: '.5rem' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {monitorData.servicesUsed.length > 0 && (
                  <div style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '1.5rem', borderRadius: 6 }}>
                    <div style={{ fontSize: '.5rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '1rem' }}>Services Used</div>
                    {monitorData.servicesUsed.map((s, i) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem 0', borderBottom: '1px solid rgba(201,169,110,.05)' }}>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '.9rem', color: 'rgba(201,169,110,.3)', minWidth: 24 }}>0{i + 1}</span>
                        <span style={{ fontSize: '.72rem', color: '#e8d5b7' }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <Link href="/contact" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.75rem 1.75rem', fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>Start Next Project →</Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
