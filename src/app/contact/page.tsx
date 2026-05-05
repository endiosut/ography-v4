'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import NavBar from '@/components/NavBar';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Contact Page (Final with validation)
//  File: src/app/contact/page.tsx
//
//  Field rules:
//  - Name: required, min 2 chars, no numbers
//  - Email: required, valid format, no fake domains blocked
//  - Phone: optional, country prefix dropdown, numbers only
//  - Company: optional, no special chars
//  - Message: optional, min 10 chars if filled
//  - Source: dropdown
//  - Services: multi-select
//  - Pay Now: appears when cart has Stripe-linked items
// ─────────────────────────────────────────────────────────────────

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const COUNTRY_PREFIXES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'USA/Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+243', flag: '🇨🇩', name: 'DR Congo' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroon' },
  { code: '+225', flag: '🇨🇮', name: 'Ivory Coast' },
  { code: '+221', flag: '🇸🇳', name: 'Senegal' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
];

const SERVICES = [
  { id: 'echo', name: 'Echo Launch Kit', price: '$180', desc: 'Visual starter identity', stripe_link: '' },
  { id: 'amplification', name: 'Brand Amplification', price: '$555', desc: 'Full creative framework', stripe_link: 'https://buy.stripe.com/test_amplification' },
  { id: 'ugc', name: 'UGC Asset Kit', price: '$145', desc: 'Branded content templates', stripe_link: '' },
  { id: 'event-banner', name: 'Event Pull-Up Banner', price: 'From $85', desc: 'Design + print + delivery', stripe_link: '' },
  { id: 'event-kit', name: 'Event Identity Kit', price: 'From $320', desc: 'Full event visual system', stripe_link: '' },
  { id: 'partner', name: 'Creative Partner', price: '$1,200/mo', desc: 'Ongoing creative direction', stripe_link: '' },
  { id: 'photo-retouch', name: 'Photo Retouch Pack', price: '$75', desc: '50 images, Lightroom graded', stripe_link: '' },
  { id: 'pitch-deck', name: 'Pitch Deck Design', price: 'From $220', desc: 'Up to 20 slides', stripe_link: '' },
  { id: 'social-starter', name: 'Social Media Starter', price: '$95', desc: '10 posts + 5 stories', stripe_link: '' },
  { id: 'event-photo', name: 'Event Photo Package', price: 'From $400', desc: 'Full event coverage', stripe_link: '' },
  { id: 'other', name: 'Other / Custom', price: "Let's talk", desc: 'Something specific', stripe_link: '' },
];

// Validation functions
const validate = {
  name: (v: string) => {
    if (!v.trim()) return 'Name is required';
    if (v.trim().length < 2) return 'Name must be at least 2 characters';
    if (/\d/.test(v)) return 'Name should not contain numbers';
    return '';
  },
  email: (v: string) => {
    if (!v.trim()) return 'Email is required';
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(v)) return 'Please enter a valid email address';
    const fakeDomains = ['test.com', 'fake.com', 'example.com', 'temp.com'];
    if (fakeDomains.some(d => v.toLowerCase().endsWith(`@${d}`))) return 'Please use a real email address';
    return '';
  },
  phone: (v: string) => {
    if (!v) return '';
    const digits = v.replace(/\D/g, '');
    if (digits.length < 6) return 'Phone number is too short';
    if (digits.length > 15) return 'Phone number is too long';
    return '';
  },
  company: (v: string) => {
    if (!v) return '';
    if (v.length < 2) return 'Company name too short';
    if (/[<>{}|\\^`]/.test(v)) return 'Company name contains invalid characters';
    return '';
  },
  message: (v: string) => {
    if (!v) return '';
    if (v.trim().length < 10) return 'Please tell us a bit more (at least 10 characters)';
    return '';
  },
};

const STEPS = ['You', 'Project', 'Services', 'Review'];

function ContactPageInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Multi-select: array of service IDs
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [phonePrefix, setPhonePrefix] = useState('+91');

  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', message: '', source: '',
  });

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    // Clear error on change
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  };

  // Validate a single field
  const validateField = (field: string, value: string) => {
    const err = (validate as any)[field]?.(value) || '';
    setErrors(e => ({ ...e, [field]: err }));
    return err;
  };

  // Validate Step 1
  const validateStep1 = () => {
    const nameErr = validate.name(form.name);
    const emailErr = validate.email(form.email);
    const phoneErr = validate.phone(form.phone);
    const companyErr = validate.company(form.company);
    setErrors({ name: nameErr, email: emailErr, phone: phoneErr, company: companyErr });
    return !nameErr && !emailErr && !phoneErr && !companyErr;
  };

  // Validate Step 2
  const validateStep2 = () => {
    const msgErr = validate.message(form.message);
    setErrors(e => ({ ...e, message: msgErr }));
    return !msgErr;
  };

  // Auto-fill from Supabase session
  useEffect(() => {
    const getSession = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(SB_URL, SB_ANON);
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          setIsLoggedIn(true);
          if (user.email) set('email', user.email);
          const name = user.user_metadata?.full_name || user.user_metadata?.name;
          if (name) set('name', name);
        }
      } catch {}
    };
    getSession();
  }, []);

  // Pre-select from URL params (cart integration)
  useEffect(() => {
    const servicesParam = searchParams.get('services');
    const serviceParam = searchParams.get('service');
    if (servicesParam) {
      const names = servicesParam.split(',').map(n => n.toLowerCase().trim());
      const ids = SERVICES
        .filter(s => names.some(n => s.name.toLowerCase().includes(n) || s.id.includes(n)))
        .map(s => s.id);
      if (ids.length) setSelectedServices(ids);
    } else if (serviceParam) {
      const match = SERVICES.find(s => s.name.toLowerCase().includes(serviceParam.toLowerCase()));
      if (match) setSelectedServices([match.id]);
    }

    // Restore from sessionStorage (navigation history)
    const savedServices = sessionStorage.getItem('og_contact_services');
    if (savedServices && !servicesParam && !serviceParam) {
      const names = savedServices.split(',').map(n => n.toLowerCase().trim());
      const ids = SERVICES
        .filter(s => names.some(n => s.name.toLowerCase().includes(n)))
        .map(s => s.id);
      if (ids.length) setSelectedServices(ids);
    }
  }, [searchParams]);

  const toggleService = (id: string) => {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const selectedItems = SERVICES.filter(s => selectedServices.includes(s.id));
  const selectedNames = selectedItems.map(s => s.name).join(', ');
  const payableItems = selectedItems.filter(s => s.stripe_link);

  const submit = async () => {
    if (!form.name || !form.email) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone ? `${phonePrefix} ${form.phone}` : null,
          company: form.company || null,
          services: selectedServices.length > 0 ? selectedNames : null,
          message: form.message || null,
          source: form.source || 'contact_form',
        }),
      });
      if (!res.ok) throw new Error('Server error');
      sessionStorage.removeItem('og_contact_services');
      setSuccess(true);
    } catch {
      alert('Network error. Please email ographyy@gmail.com directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    background: 'transparent', border: 'none',
    borderBottom: `1px solid ${hasError ? 'rgba(224,112,112,.5)' : 'rgba(201,169,110,.18)'}`,
    color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.88rem',
    fontWeight: 300, padding: '.7rem 0', width: '100%', outline: 'none',
    marginBottom: hasError ? '.4rem' : '1.75rem', boxSizing: 'border-box' as const,
    transition: 'border-color .2s',
  });

  const btnStyle: React.CSSProperties = {
    fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase',
    color: '#0a0906', background: '#c9a96e', padding: '.9rem 2.2rem',
    border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 300,
  };

  const backStyle: React.CSSProperties = {
    fontSize: '.62rem', color: '#6b6355', background: 'transparent',
    border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', letterSpacing: '.08em',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>

      <NavBar />

      {/* Main content — reduced top padding so steps are visible */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '5.5rem 2rem 5rem' }}>

        {/* Steps */}
        {!success && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: 0 }}>
            {STEPS.map((label, i) => {
              const n = i + 1;
              const active = step === n, done = step > n;
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < STEPS.length ? 1 : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.3rem' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? '#c9a96e' : active ? 'rgba(201,169,110,.1)' : 'transparent', border: `1px solid ${done || active ? '#c9a96e' : 'rgba(201,169,110,.15)'}`, color: done ? '#0a0906' : active ? '#c9a96e' : 'rgba(201,169,110,.2)', fontSize: '.6rem', transition: 'all .3s' }}>
                      {done ? '✓' : n}
                    </div>
                    <div style={{ fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: active ? '#c9a96e' : 'rgba(107,99,85,.45)' }}>{label}</div>
                  </div>
                  {n < STEPS.length && <div style={{ flex: 1, height: 1, background: done ? '#c9a96e' : 'rgba(201,169,110,.1)', margin: '0 .5rem', marginBottom: '1.1rem', transition: 'background .3s' }} />}
                </div>
              );
            })}
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 300, color: '#f5ede0', marginBottom: '1rem' }}>
              Request <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>received.</em>
            </div>
            <p style={{ fontSize: '.82rem', color: '#6b6355', lineHeight: 1.9, maxWidth: 420, margin: '0 auto 2rem' }}>
              We'll be in touch within 24 hours at <strong style={{ color: '#c9a96e' }}>{form.email}</strong>.<br />
              Check your email for a confirmation from OGraphy Studio.
            </p>
            <Link href="/portal" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.9rem 2.2rem', fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500, marginRight: '1rem' }}>
              My Portal →
            </Link>
            <Link href="/catalog" style={{ display: 'inline-block', background: 'transparent', border: '1px solid rgba(201,169,110,.3)', color: '#c9a96e', padding: '.9rem 2.2rem', fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Back to Services
            </Link>
          </div>
        )}

        {/* STEP 1 */}
        {!success && step === 1 && (
          <div style={{ animation: 'stepIn .4s ease forwards' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.5rem,3vw,2.1rem)', fontWeight: 300, color: '#f5ede0', marginBottom: '.5rem', lineHeight: 1.2 }}>
              Let's build something that <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>echoes.</em>
            </div>
            <div style={{ fontSize: '.76rem', color: '#6b6355', marginBottom: '1.75rem', lineHeight: 1.7 }}>
              Tell us who we're talking to — your name, how to reach you, and who you're building for.
              {isLoggedIn && <span style={{ color: 'rgba(201,169,110,.5)', marginLeft: '.5rem', fontSize: '.65rem' }}>✓ Auto-filled from your account</span>}
            </div>

            {/* Name */}
            <input style={inputStyle(!!errors.name)} placeholder="Your full name *" value={form.name}
              onChange={e => set('name', e.target.value)} onBlur={e => validateField('name', e.target.value)}
              onFocus={e => (e.target.style.borderBottomColor = '#c9a96e')}
            />
            {errors.name && <div style={{ fontSize: '.62rem', color: '#e07070', marginBottom: '1.25rem', marginTop: '-.5rem' }}>{errors.name}</div>}

            {/* Email */}
            <input type="email" style={inputStyle(!!errors.email)} placeholder="Email address *" value={form.email}
              onChange={e => set('email', e.target.value)} onBlur={e => validateField('email', e.target.value)}
              onFocus={e => (e.target.style.borderBottomColor = '#c9a96e')}
            />
            {errors.email && <div style={{ fontSize: '.62rem', color: '#e07070', marginBottom: '1.25rem', marginTop: '-.5rem' }}>{errors.email}</div>}

            {/* Phone — country prefix + numbers only */}
            <div style={{ marginBottom: errors.phone ? '.4rem' : '1.75rem' }}>
              <div style={{ display: 'flex', gap: '.5rem', borderBottom: `1px solid ${errors.phone ? 'rgba(224,112,112,.5)' : 'rgba(201,169,110,.18)'}`, paddingBottom: '.7rem', transition: 'border-color .2s' }}>
                <select
                  value={phonePrefix}
                  onChange={e => setPhonePrefix(e.target.value)}
                  style={{ background: '#0a0906', border: 'none', color: '#c9a96e', fontFamily: 'Montserrat, sans-serif', fontSize: '.75rem', outline: 'none', cursor: 'pointer', flexShrink: 0, appearance: 'none', paddingRight: '.5rem' }}
                >
                  {COUNTRY_PREFIXES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code} {c.name}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="Phone number (optional)"
                  value={form.phone}
                  onChange={e => {
                    // Numbers only
                    const clean = e.target.value.replace(/[^0-9\s\-()]/g, '');
                    set('phone', clean);
                  }}
                  onBlur={e => validateField('phone', e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.88rem', outline: 'none', flex: 1, fontWeight: 300 }}
                />
              </div>
            </div>
            {errors.phone && <div style={{ fontSize: '.62rem', color: '#e07070', marginBottom: '1.25rem', marginTop: '-.5rem' }}>{errors.phone}</div>}

            {/* Company */}
            <input style={inputStyle(!!errors.company)} placeholder="Company or brand name (optional)" value={form.company}
              onChange={e => set('company', e.target.value)} onBlur={e => validateField('company', e.target.value)}
              onFocus={e => (e.target.style.borderBottomColor = '#c9a96e')}
            />
            {errors.company && <div style={{ fontSize: '.62rem', color: '#e07070', marginBottom: '1.25rem', marginTop: '-.5rem' }}>{errors.company}</div>}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '.5rem' }}>
              <button onClick={() => { if (validateStep1()) setStep(2); }} style={btnStyle}>Continue →</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {!success && step === 2 && (
          <div style={{ animation: 'stepIn .4s ease forwards' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.5rem,3vw,2.1rem)', fontWeight: 300, color: '#f5ede0', marginBottom: '.5rem', lineHeight: 1.2 }}>
              What are you <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>building?</em>
            </div>
            <div style={{ fontSize: '.76rem', color: '#6b6355', marginBottom: '1.75rem', lineHeight: 1.7 }}>
              Describe your brand, project, or what needs to change. The more specific, the better.
            </div>
            <textarea placeholder="What does your brand look like today? What's the gap you want to close? Who are you trying to reach?" value={form.message}
              onChange={e => { set('message', e.target.value); }}
              onBlur={e => validateField('message', e.target.value)}
              style={{ background: 'transparent', border: `1px solid ${errors.message ? 'rgba(224,112,112,.4)' : 'rgba(201,169,110,.18)'}`, color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.85rem', padding: '.85rem 1rem', width: '100%', outline: 'none', resize: 'vertical', minHeight: 110, marginBottom: errors.message ? '.4rem' : '2rem', boxSizing: 'border-box' }}
            />
            {errors.message && <div style={{ fontSize: '.62rem', color: '#e07070', marginBottom: '1.25rem' }}>{errors.message}</div>}
            <select value={form.source} onChange={e => set('source', e.target.value)}
              style={{ background: '#0a0906', border: '1px solid rgba(201,169,110,.18)', color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.85rem', padding: '.85rem 1rem', width: '100%', outline: 'none', marginBottom: '2rem', appearance: 'none' }}
            >
              <option value="">How did you find us?</option>
              {['Instagram', 'Referral', 'LinkedIn', 'Google', 'Direct link', 'Other'].map(o => <option key={o}>{o}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => { if (validateStep2()) setStep(3); }} style={btnStyle}>Continue →</button>
              <button onClick={() => setStep(1)} style={backStyle}>← Back</button>
            </div>
          </div>
        )}

        {/* STEP 3 — Multi-select services */}
        {!success && step === 3 && (
          <div style={{ animation: 'stepIn .4s ease forwards' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.5rem,3vw,2.1rem)', fontWeight: 300, color: '#f5ede0', marginBottom: '.5rem', lineHeight: 1.2 }}>
              Which services <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>fit you?</em>
            </div>
            <div style={{ fontSize: '.76rem', color: '#6b6355', marginBottom: '1.5rem', lineHeight: 1.7 }}>
              Select one or more. Click to toggle. Combine services — we'll handle them together.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '.5rem', marginBottom: '1.5rem' }}>
              {SERVICES.map(svc => {
                const sel = selectedServices.includes(svc.id);
                return (
                  <div key={svc.id} onClick={() => toggleService(svc.id)} style={{ border: `1px solid ${sel ? '#c9a96e' : 'rgba(201,169,110,.15)'}`, padding: '.9rem .8rem', cursor: 'pointer', textAlign: 'center', background: sel ? 'rgba(201,169,110,.08)' : 'transparent', transition: 'all .2s', position: 'relative', borderRadius: 4 }}>
                    {sel && <div style={{ position: 'absolute', top: '.3rem', right: '.4rem', fontSize: '.5rem', color: '#c9a96e' }}>✓</div>}
                    <div style={{ fontSize: '.7rem', fontWeight: 500, color: '#e8d5b7', marginBottom: '.25rem', lineHeight: 1.2 }}>{svc.name}</div>
                    <div style={{ fontSize: '.72rem', color: '#c9a96e', marginBottom: '.2rem', fontFamily: 'Cormorant Garamond, serif' }}>{svc.price}</div>
                    <div style={{ fontSize: '.55rem', color: '#6b6355' }}>{svc.desc}</div>
                  </div>
                );
              })}
            </div>
            {selectedServices.length > 0 && (
              <div style={{ fontSize: '.65rem', color: 'rgba(201,169,110,.55)', marginBottom: '.75rem', lineHeight: 1.6 }}>
                Selected ({selectedServices.length}): {selectedNames}
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setStep(4)} style={btnStyle}>Review Request →</button>
              <button onClick={() => setStep(2)} style={backStyle}>← Back</button>
            </div>
          </div>
        )}

        {/* STEP 4 — Review + optional Pay Now */}
        {!success && step === 4 && (
          <div style={{ animation: 'stepIn .4s ease forwards' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.5rem,3vw,2.1rem)', fontWeight: 300, color: '#f5ede0', marginBottom: '.5rem', lineHeight: 1.2 }}>
              Ready to <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>send?</em>
            </div>
            <div style={{ fontSize: '.76rem', color: '#6b6355', marginBottom: '1.75rem', lineHeight: 1.7 }}>
              Review your request before submitting.
            </div>

            <div style={{ border: '1px solid rgba(201,169,110,.12)', padding: '1.5rem 2rem', marginBottom: '2rem', borderRadius: 4 }}>
              {([['Name', form.name], ['Email', form.email], form.company ? ['Company', form.company] : null, selectedNames ? ['Services', selectedNames] : null, form.message ? ['Notes', form.message.slice(0, 80) + (form.message.length > 80 ? '…' : '')] : null, form.source ? ['Found via', form.source] : null] as [string, string][]).filter(Boolean).map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', gap: '1rem', marginBottom: '.6rem', fontSize: '.75rem' }}>
                  <div style={{ color: '#6b6355', minWidth: 80, flexShrink: 0 }}>{label}</div>
                  <div style={{ color: '#e8d5b7' }}>{value as string}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {/* Pay Now button — only if selected services have Stripe links */}
              {payableItems.length > 0 && (
                <div>
                  <div style={{ fontSize: '.6rem', color: 'rgba(201,169,110,.45)', marginBottom: '.5rem', letterSpacing: '.08em' }}>
                    {payableItems.length} of your selected service{payableItems.length > 1 ? 's' : ''} can be paid upfront
                  </div>
                  {payableItems.map(item => (
                    <a key={item.id} href={item.stripe_link} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', textAlign: 'center', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.3)', color: '#c9a96e', padding: '.75rem', fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', marginBottom: '.4rem', borderRadius: 3 }}>
                      Pay Now — {item.name} ({item.price}) →
                    </a>
                  ))}
                  <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.2)', marginBottom: '.75rem' }}>
                    You can pay now and still submit the request below, or skip payment for now.
                  </div>
                </div>
              )}

              <button onClick={submit} disabled={submitting} style={{ ...btnStyle, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Sending...' : 'Send My Request →'}
              </button>
              <button onClick={() => setStep(3)} style={backStyle}>← Back</button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '.62rem', color: '#6b6355', letterSpacing: '.06em' }}>
              We respond within 24 hours. No spam. No newsletters.
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(201,169,110,.06)', padding: '2rem 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.2)' }}>© 2026 OGraphy</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Services', '/catalog']].map(([l, h]) => (
            <Link key={l} href={h} style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.2)', textDecoration: 'none' }}>{l}</Link>
          ))}
        </div>
      </footer>

      <style>{`@keyframes stepIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

export default function ContactPage() {
  return <Suspense fallback={null}><ContactPageInner /></Suspense>;
}


function FI({ placeholder, value, onChange, type = 'text', required }: { placeholder: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} required={required}
      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(201,169,110,.18)', color: '#e8d5b7', fontFamily: 'Montserrat, sans-serif', fontSize: '.88rem', fontWeight: 300, padding: '.7rem 0', width: '100%', outline: 'none', marginBottom: '1.75rem', boxSizing: 'border-box' }}
      onFocus={e => (e.target.style.borderBottomColor = '#c9a96e')}
      onBlur={e => (e.target.style.borderBottomColor = 'rgba(201,169,110,.18)')}
    />
  );
}

function Nav({ onNext, onBack, nextLabel = 'Continue →' }: { onNext: () => void; onBack?: () => void; nextLabel?: string }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '.5rem' }}>
      <button onClick={onNext} style={{ fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase', color: '#0a0906', background: '#c9a96e', padding: '.9rem 2.2rem', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 300 }}>{nextLabel}</button>
      {onBack && <button onClick={onBack} style={{ fontSize: '.62rem', color: '#6b6355', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', letterSpacing: '.08em' }}>← Back</button>}
    </div>
  );
}

function AutoFillNote() {
  return <div style={{ fontSize: '.62rem', color: 'rgba(201,169,110,.45)', marginBottom: '1rem', marginTop: '-1rem' }}>✓ Auto-filled from your account</div>;
}
