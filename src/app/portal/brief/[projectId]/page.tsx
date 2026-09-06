'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const INDUSTRIES = [
  'Technology', 'Hospitality', 'Fashion & Retail', 'Real Estate',
  'Food & Beverage', 'Professional Services', 'Health & Wellness',
  'Creative & Arts', 'Finance', 'Events', 'Education',
  'Non-Profit', 'Manufacturing', 'Photography', 'Other'
];

const STYLE_KEYWORDS = [
  'Minimal', 'Bold', 'Elegant', 'Modern', 'Classic', 'Playful',
  'Luxury', 'Editorial', 'Geometric', 'Organic', 'Technical', 'Artisanal',
  'Dark & Moody', 'Clean & Bright', 'Vintage', 'Futuristic'
];

const STEPS = ['Business Info', 'Style Direction', 'Requirements'];

type BriefData = {
  businessName: string;
  industry: string;
  description: string;
  styleKeywords: string[];
  audience: string;
  notes: string;
  existingColors: string;
  competitors: string;
  files: File[];
};

function BriefPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.projectId as string;
  const serviceName = searchParams.get('service') || 'Your Service';

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const [brief, setBrief] = useState<BriefData>({
    businessName: '',
    industry: '',
    description: '',
    styleKeywords: [],
    audience: '',
    notes: '',
    existingColors: '',
    competitors: '',
    files: [],
  });

  const set = (k: keyof BriefData, v: any) => setBrief(b => ({ ...b, [k]: v }));

  const toggleStyle = (keyword: string) => {
    set('styleKeywords',
      brief.styleKeywords.includes(keyword)
        ? brief.styleKeywords.filter(k => k !== keyword)
        : [...brief.styleKeywords, keyword]
    );
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { createBrowserClient } = await import('@supabase/ssr');
        const sb = createBrowserClient(SB_URL, SB_ANON);
        const { data: { user: u } } = await sb.auth.getUser();
        if (!u) { router.push('/login?next=/portal'); return; }
        setUser({ email: u.email || '', name: u.user_metadata?.full_name });
        if (u.user_metadata?.company) set('businessName', u.user_metadata.company);
      } catch {}
    };
    init();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    set('files', files);
    setUploadedFiles(files.map(f => f.name));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      // createBrowserClient, NOT createClient. The plain client carries no
      // session, so auth.uid() is null for every request it makes. That was
      // survivable only while brief-files storage granted INSERT to `public`;
      // once that hole was closed (migration 010) an unauthenticated upload is
      // correctly refused, and this page would have silently stopped
      // accepting attachments.
      const { createBrowserClient } = await import('@supabase/ssr');
      const sb = createBrowserClient(SB_URL, SB_ANON);

      const fileUrls: string[] = [];
      for (const file of brief.files) {
        const fileName = `briefs/${projectId}/${Date.now()}-${file.name}`;
        const { data: uploadData } = await sb.storage
          .from('brief-files')
          .upload(fileName, file, { upsert: true });
        if (uploadData?.path) {
          const { data: urlData } = sb.storage.from('brief-files').getPublicUrl(uploadData.path);
          fileUrls.push(urlData.publicUrl);
        }
      }

      const briefNotes = `
BUSINESS: ${brief.businessName}
INDUSTRY: ${brief.industry}
DESCRIPTION: ${brief.description}
STYLE: ${brief.styleKeywords.join(', ')}
AUDIENCE: ${brief.audience}
EXISTING COLORS: ${brief.existingColors}
COMPETITORS: ${brief.competitors}
NOTES: ${brief.notes}
FILES: ${fileUrls.join(', ') || 'None uploaded'}
      `.trim();

      const { error } = await sb
        .from('projects')
        .update({
          brief_submitted: true,
          status: 'confirmed',
          notes: briefNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) throw error;

      await fetch('https://ographyy.app.n8n.cloud/webhook/ography-new-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user?.name || user?.email || 'Client',
          email: user?.email,
          services: serviceName,
          notes: briefNotes,
          status: 'brief_submitted',
          type: 'BRIEF_SUBMITTED',
          projectId,
        }),
      }).catch(() => {});

      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert('Something went wrong. Please try again or email ographyy@gmail.com.');
    } finally {
      setSubmitting(false);
    }
  };

  const validateStep = (s: number) => {
    if (s === 1) return brief.businessName.trim().length > 0;
    if (s === 2) return brief.styleKeywords.length > 0;
    return true;
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>✓</div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 300, color: '#f0e8d8', marginBottom: '1rem' }}>
            Brief <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>submitted.</em>
          </div>
          <p style={{ fontSize: '.82rem', color: 'rgba(232,213,183,.5)', lineHeight: 1.9, marginBottom: '2rem' }}>
            Our team reviews your brief within 24 hours. You will receive an email when your project enters production. You can track progress in your portal.
          </p>
          <Link href="/portal" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.9rem 2.2rem', fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>
            View My Portal →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '.5rem 3rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', background: 'rgba(10,9,6,.97)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,169,110,.12)',
      }}>
        <Link href="/portal" style={{ textDecoration: 'none' }}>
          <img src="/logo.svg" alt="OGraphy" style={{ width: 148, height: 'auto' }} />
        </Link>
        <Link href="/portal" style={{ fontSize: '.6rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', textDecoration: 'none' }}>
          ← Back to Portal
        </Link>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '6rem 2rem 5rem' }}>

        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.6rem', border: '1px solid rgba(201,169,110,.2)', padding: '.4rem .9rem', marginBottom: '1.25rem', borderRadius: 3 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M8 8h5M8 16h6"/>
            </svg>
            <span style={{ fontSize: '.58rem', color: '#c9a96e', letterSpacing: '.1em', textTransform: 'uppercase' }}>{serviceName}</span>
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 300, color: '#f0e8d8', lineHeight: 1.2 }}>
            Submit your brief
          </h1>
        </div>

        {/* Step progress */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2.5rem' }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < STEPS.length ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.3rem' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '.65rem',
                    background: done ? '#c9a96e' : active ? 'rgba(201,169,110,.12)' : 'transparent',
                    border: `1px solid ${done || active ? '#c9a96e' : 'rgba(201,169,110,.15)'}`,
                    color: done ? '#0a0906' : active ? '#c9a96e' : 'rgba(201,169,110,.2)',
                    transition: 'all .3s',
                  }}>
                    {done ? '✓' : n}
                  </div>
                  <div style={{ fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: active ? '#c9a96e' : 'rgba(107,99,85,.4)', whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                </div>
                {n < STEPS.length && (
                  <div style={{ flex: 1, height: 1, background: done ? '#c9a96e' : 'rgba(201,169,110,.1)', margin: '0 .5rem', marginBottom: '1.1rem', transition: 'background .3s' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ animation: 'stepIn .4s ease forwards' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem' }}>
              Tell us about your business
            </h2>
            <p style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', marginBottom: '2rem', lineHeight: 1.7 }}>
              This helps us tailor the creative direction to your brand.
            </p>

            <Field label="Business Name *">
              <input
                value={brief.businessName} onChange={e => set('businessName', e.target.value)}
                placeholder="e.g. Maison Studio"
                style={inputStyle}
              />
            </Field>

            <Field label="Industry">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.25rem' }}>
                {INDUSTRIES.map(ind => (
                  <button key={ind} onClick={() => set('industry', ind)}
                    style={{
                      padding: '.45rem .9rem', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                      fontSize: '.62rem', letterSpacing: '.06em', borderRadius: 3,
                      border: `1px solid ${brief.industry === ind ? '#c9a96e' : 'rgba(201,169,110,.15)'}`,
                      background: brief.industry === ind ? 'rgba(201,169,110,.1)' : 'transparent',
                      color: brief.industry === ind ? '#c9a96e' : 'rgba(232,213,183,.45)',
                      transition: 'all .2s',
                    }}
                  >{ind}</button>
                ))}
              </div>
            </Field>

            <Field label="Project Description">
              <textarea
                value={brief.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe what you need and any specific goals for this project..."
                style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              />
            </Field>

            <NavButtons
              onNext={() => { if (validateStep(1)) setStep(2); }}
              nextDisabled={!brief.businessName.trim()}
            />
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ animation: 'stepIn .4s ease forwards' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem' }}>
              Define your style direction
            </h2>
            <p style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', marginBottom: '2rem', lineHeight: 1.7 }}>
              Select all that apply — this guides our creative direction.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '2rem' }}>
              {STYLE_KEYWORDS.map(kw => {
                const sel = brief.styleKeywords.includes(kw);
                return (
                  <button key={kw} onClick={() => toggleStyle(kw)}
                    style={{
                      padding: '.55rem 1.1rem', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                      fontSize: '.68rem', letterSpacing: '.06em', borderRadius: 3,
                      border: `1px solid ${sel ? '#c9a96e' : 'rgba(201,169,110,.15)'}`,
                      background: sel ? 'rgba(201,169,110,.1)' : 'transparent',
                      color: sel ? '#c9a96e' : 'rgba(232,213,183,.45)',
                      transition: 'all .2s', position: 'relative',
                    }}
                  >
                    {kw}
                    {sel && <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: '#c9a96e', borderRadius: '50%' }} />}
                  </button>
                );
              })}
            </div>

            {brief.styleKeywords.length > 0 && (
              <div style={{ fontSize: '.65rem', color: 'rgba(201,169,110,.5)', marginBottom: '1.5rem' }}>
                Selected: {brief.styleKeywords.join(', ')}
              </div>
            )}

            <Field label="Existing brand colors (optional)">
              <input
                value={brief.existingColors}
                onChange={e => set('existingColors', e.target.value)}
                placeholder="e.g. Navy blue #1B2B5E, Warm white #F5F0E8"
                style={inputStyle}
              />
            </Field>

            <Field label="Competitors or references you admire (optional)">
              <input
                value={brief.competitors}
                onChange={e => set('competitors', e.target.value)}
                placeholder="e.g. Aesop, Bottega Veneta, Linear.app"
                style={inputStyle}
              />
            </Field>

            <NavButtons onNext={() => setStep(3)} onBack={() => setStep(1)} nextDisabled={brief.styleKeywords.length === 0} />
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ animation: 'stepIn .4s ease forwards' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 300, color: '#f0e8d8', marginBottom: '.5rem' }}>
              Final details
            </h2>
            <p style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', marginBottom: '2rem', lineHeight: 1.7 }}>
              Help us understand your audience and any specific requirements.
            </p>

            <Field label="Target Audience">
              <textarea
                value={brief.audience}
                onChange={e => set('audience', e.target.value)}
                placeholder="Describe your ideal customer — their demographics, preferences, and what matters to them..."
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              />
            </Field>

            <Field label="Additional Notes (optional)">
              <textarea
                value={brief.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Any specific requirements, examples you like, things to avoid, or delivery preferences..."
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              />
            </Field>

            <Field label="Upload Reference Files (optional)">
              <div style={{ border: '1px dashed rgba(201,169,110,.2)', padding: '1.5rem', textAlign: 'center', borderRadius: 4, marginTop: '.25rem', cursor: 'pointer', position: 'relative' }}>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,.svg,.ai,.psd,.zip"
                  onChange={handleFileChange}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                />
                <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.35)', lineHeight: 1.8 }}>
                  {uploadedFiles.length > 0 ? (
                    <>
                      <div style={{ color: '#c9a96e', marginBottom: '.5rem' }}>✓ {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} selected</div>
                      {uploadedFiles.map(f => <div key={f} style={{ fontSize: '.6rem', color: 'rgba(201,169,110,.4)' }}>{f}</div>)}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '1.5rem', marginBottom: '.5rem', opacity: 0.3 }}>📎</div>
                      Click or drag to upload logos, references, or brand files<br />
                      <span style={{ fontSize: '.6rem' }}>JPG, PNG, PDF, SVG, AI, PSD, ZIP — up to 50MB</span>
                    </>
                  )}
                </div>
              </div>
            </Field>

            <div style={{ border: '1px solid rgba(201,169,110,.12)', padding: '1.5rem', marginBottom: '2rem', borderRadius: 4, background: 'rgba(201,169,110,.02)' }}>
              <div style={{ fontSize: '.55rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '1rem' }}>Brief Summary</div>
              {[
                ['Service', serviceName],
                ['Business', brief.businessName || '—'],
                ['Industry', brief.industry || '—'],
                ['Style', brief.styleKeywords.join(', ') || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: '1rem', fontSize: '.72rem', marginBottom: '.5rem' }}>
                  <span style={{ color: 'rgba(232,213,183,.3)', minWidth: 70 }}>{k}</span>
                  <span style={{ color: '#e8d5b7', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  background: submitting ? 'rgba(201,169,110,.5)' : '#c9a96e',
                  color: '#0a0906', border: 'none', padding: '.9rem 2.2rem',
                  fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'Montserrat, sans-serif', fontWeight: 500,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Brief →'}
              </button>
              <button onClick={() => setStep(2)} style={{ fontSize: '.62rem', color: '#6b6355', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                ← Back
              </button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '.62rem', color: 'rgba(232,213,183,.2)', letterSpacing: '.06em' }}>
              Fixed price · No hidden fees · {serviceName}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={{ fontSize: '.55rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '.6rem' }}>{label}</div>
      {children}
    </div>
  );
}

function NavButtons({ onNext, onBack, nextDisabled }: { onNext: () => void; onBack?: () => void; nextDisabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '.5rem' }}>
      <button onClick={onNext} disabled={nextDisabled}
        style={{
          background: nextDisabled ? 'rgba(201,169,110,.3)' : '#c9a96e', color: '#0a0906',
          border: 'none', padding: '.85rem 2.2rem', fontSize: '.68rem', letterSpacing: '.14em',
          textTransform: 'uppercase', cursor: nextDisabled ? 'not-allowed' : 'pointer',
          fontFamily: 'Montserrat, sans-serif', fontWeight: 300,
        }}
      >
        Continue →
      </button>
      {onBack && (
        <button onClick={onBack} style={{ fontSize: '.62rem', color: '#6b6355', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', letterSpacing: '.08em' }}>
          ← Back
        </button>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(20,17,12,.8)', border: '1px solid rgba(201,169,110,.18)',
  color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.85rem',
  fontWeight: 300, padding: '.75rem 1rem', width: '100%', outline: 'none',
  boxSizing: 'border-box', borderRadius: 3, lineHeight: 1.6,
};

export default function BriefPage() {
  return <Suspense fallback={null}><BriefPageInner /></Suspense>;
}
