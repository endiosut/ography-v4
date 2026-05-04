'use client';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Privacy Policy Page
//  File: src/app/privacy/page.tsx
// ─────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>
      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '.65rem 4rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', background: 'rgba(10,9,6,.96)',
        backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(201,169,110,.18)',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo.svg" alt="OGraphy" style={{ width: 148, height: 'auto', objectFit: 'contain' }} />
        </Link>
        <Link href="/catalog" style={{ fontSize: '.67rem', letterSpacing: '.17em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', textDecoration: 'none' }}>
          ← Browse Services
        </Link>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '7rem 2rem 5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '1rem' }}>
            Legal
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 300, color: '#f0e8d8', marginBottom: '.75rem' }}>
            Privacy Policy
          </h1>
          <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.35)' }}>
            Last updated: May 2, 2026
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

          <Section title="1. Who We Are">
            OGraphy is a managed visual identity and branding execution service operated by Endi Osut.
            For privacy inquiries, contact us at:{' '}
            <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e' }}>ographyy@gmail.com</a>
          </Section>

          <Section title="2. Data We Collect">
            <Subsection title="Information you provide directly">
              Name and email address — when you submit a contact request, create a client account,
              or sign in via magic link. Company name and phone number — when you submit a project
              request (optional). Brief content — project briefs you submit through the client portal,
              including any files uploaded. Payment information — processed by Stripe; we do not store
              card numbers or banking details.
            </Subsection>
            <Subsection title="Information collected automatically">
              Usage data — pages visited, time on site, clicks. Device and browser type — for
              compatibility. IP address — collected by Vercel&apos;s infrastructure for security and
              abuse prevention.
            </Subsection>
          </Section>

          <Section title="3. How We Use Your Data">
            <Table rows={[
              ['Name and email', 'Delivering services, sending client portal access', 'Contract performance'],
              ['Brief content and files', 'Executing the services you ordered', 'Contract performance'],
              ['Email address', 'Sending project updates and delivery notifications', 'Contract performance'],
              ['Usage analytics', 'Improving the platform experience', 'Legitimate interest'],
              ['IP address', 'Security and abuse prevention', 'Legitimate interest'],
            ]} headers={['Data', 'Purpose', 'Legal Basis']} />
            <p style={{ marginTop: '1rem', color: 'rgba(232,213,183,.6)', fontSize: '.8rem', lineHeight: 1.7 }}>
              We do not sell your personal data. We do not share it with advertisers. We do not use it for profiling.
            </p>
          </Section>

          <Section title="4. Data Retention">
            Client data is retained for 2 years after your last project, then deleted on request.
            Brief files are retained for 90 days after delivery, then purged. Payment records are
            retained for 7 years as required by financial regulations (held by Stripe). Contact form
            submissions that did not become active clients are retained for 6 months.
            <br /><br />
            To request early deletion, email{' '}
            <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e' }}>ographyy@gmail.com</a>{' '}
            with subject line &ldquo;Data Deletion Request.&rdquo;
          </Section>

          <Section title="5. Third-Party Services">
            <Table rows={[
              ['Supabase', 'Database and file storage', 'supabase.com/privacy'],
              ['Stripe', 'Payment processing', 'stripe.com/privacy'],
              ['Vercel', 'Platform hosting and CDN', 'vercel.com/legal/privacy-policy'],
              ['Google Fonts', 'Typography (no personal data sent)', 'policies.google.com/privacy'],
            ]} headers={['Service', 'Purpose', 'Privacy Policy']} />
          </Section>

          <Section title="6. Your Rights">
            Depending on your location, you may have the right to access the personal data we hold about
            you, correct inaccurate data, delete your data, export your data in a portable format,
            withdraw consent, and object to processing. To exercise any right, email{' '}
            <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e' }}>ographyy@gmail.com</a>.
            We respond within 30 days.
          </Section>

          <Section title="7. Data Security">
            Your data is stored in Supabase with Row Level Security (RLS) policies enforced — client
            data is isolated and inaccessible to other clients. Payments are processed by Stripe using
            PCI-compliant infrastructure. We never see or store full card numbers.
          </Section>

          <Section title="8. Children">
            OGraphy does not knowingly collect data from anyone under 18 years of age. Contact us
            immediately at{' '}
            <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e' }}>ographyy@gmail.com</a>{' '}
            if you believe we have collected data from a minor.
          </Section>

          <Section title="9. Contact">
            <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e' }}>ographyy@gmail.com</a>
            {' '}— Response within 5 business days.
          </Section>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(201,169,110,.06)', padding: '2rem 4rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 1100, margin: '0 auto',
      }}>
        <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.2)', letterSpacing: '.1em' }}>© 2026 OGraphy</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Services', '/catalog']].map(([label, href]) => (
            <Link key={label} href={href} style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.2)', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid rgba(201,169,110,.08)', paddingTop: '2rem' }}>
      <h2 style={{
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: '1.2rem', fontWeight: 400,
        color: '#c9a96e', marginBottom: '1rem',
      }}>{title}</h2>
      <div style={{ fontSize: '.82rem', color: 'rgba(232,213,183,.65)', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{
        fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase',
        color: 'rgba(201,169,110,.5)', marginBottom: '.4rem',
      }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: '.5rem' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontSize: '.75rem', color: 'rgba(232,213,183,.6)',
      }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '.5rem .75rem',
                borderBottom: '1px solid rgba(201,169,110,.15)',
                color: 'rgba(201,169,110,.7)',
                fontSize: '.6rem', letterSpacing: '.1em', textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(201,169,110,.06)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '.5rem .75rem', lineHeight: 1.6 }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
