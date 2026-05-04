'use client';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Terms of Service Page
//  File: src/app/terms/page.tsx
// ─────────────────────────────────────────────────────────────────

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.35)' }}>
            Last updated: May 2, 2026
          </div>
          <p style={{ marginTop: '1rem', fontSize: '.8rem', color: 'rgba(232,213,183,.5)', lineHeight: 1.7 }}>
            By submitting a request, making a payment, or accessing the client portal, you agree to these Terms.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

          <Section title="1. Services">
            OGraphy provides managed visual identity and branding execution services including brand
            identity design, content production, print design and physical delivery, and brand audits.
            Services are described in the OGraphy Service Catalog. Scope, pricing, and turnaround time
            are specified per service at the time of purchase.
          </Section>

          <Section title="2. Ordering and Payment">
            <Subsection title="How orders work">
              You browse the catalog and submit a request. OGraphy reviews and confirms availability.
              Payment is processed via Stripe before production begins. You receive a magic link to
              your client portal. You submit your project brief. OGraphy executes and delivers files
              to your portal.
            </Subsection>
            <Subsection title="Payment terms">
              All prices are in USD unless otherwise stated. Payment is due in full before production
              begins. For projects over $500, a 50% deposit may be arranged by written agreement.
              All payments are processed securely by Stripe.
            </Subsection>
          </Section>

          <Section title="3. Revisions">
            Each service includes a specified number of revision rounds as stated in the service
            description. Revisions must be requested within 14 days of delivery, submitted through
            the client portal or via email, and within the original agreed scope. Additional revision
            rounds beyond what&apos;s included may be provided at an additional cost, quoted before
            work begins.
          </Section>

          <Section title="4. Delivery">
            <Subsection title="Digital deliverables">
              Files are delivered to your client portal within the turnaround time stated for your
              service. Turnaround begins from the date your brief is received and confirmed, not
              from the date of payment.
            </Subsection>
            <Subsection title="Physical deliverables">
              Shipping timelines are estimates and may vary based on carrier and destination. OGraphy
              is not responsible for customs delays or carrier failures beyond our control.
            </Subsection>
            <Subsection title="File retention">
              Delivered files are available in your client portal for 90 days after delivery. You are
              responsible for downloading and saving your files before that period ends.
            </Subsection>
          </Section>

          <Section title="5. Intellectual Property">
            Upon receipt of full payment, you own the final delivered files. OGraphy retains the right
            to display completed work in our portfolio unless you request otherwise in writing before
            project completion. By submitting assets as part of your brief, you confirm you have the
            right to use those assets. Source files (editable AI, Figma, or PSD) are not included
            unless explicitly specified.
          </Section>

          <Section title="6. Refunds and Cancellations">
            <Subsection title="Before production begins">
              If you cancel before submitting your project brief, you are eligible for a full refund.
            </Subsection>
            <Subsection title="After production begins">
              Once your brief has been received and production has started, if OGraphy cannot complete
              the agreed scope, a prorated refund will be issued. No refunds for completed and delivered
              work except in cases of material failure to meet the agreed scope.
            </Subsection>
            <Subsection title="Disputes">
              If you believe delivered work does not meet the agreed scope, contact{' '}
              <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e' }}>ographyy@gmail.com</a>{' '}
              within 14 days of delivery.
            </Subsection>
          </Section>

          <Section title="7. Confidentiality">
            OGraphy treats your brief contents, brand assets, and business information as confidential.
            Clients may request an NDA for sensitive projects — contact{' '}
            <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e' }}>ographyy@gmail.com</a>{' '}
            before placing your order.
          </Section>

          <Section title="8. Limitation of Liability">
            OGraphy&apos;s liability for any claim shall not exceed the total amount paid for the
            specific service giving rise to that claim. OGraphy is not liable for indirect, incidental,
            or consequential damages, or delays caused by circumstances outside our control.
          </Section>

          <Section title="9. Account Access">
            Your client portal is accessed via a magic link sent to your registered email. You are
            responsible for keeping your email account secure.
          </Section>

          <Section title="10. Contact">
            <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e' }}>ographyy@gmail.com</a>
            {' '}— Response within 3 business days.
          </Section>
        </div>

        {/* Cross-link */}
        <div style={{
          marginTop: '3rem', padding: '1.5rem',
          border: '1px solid rgba(201,169,110,.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.4)' }}>
            Also see our Privacy Policy
          </span>
          <Link href="/privacy" style={{
            fontSize: '.62rem', letterSpacing: '.1em', textTransform: 'uppercase',
            color: '#c9a96e', textDecoration: 'none',
          }}>
            Read Privacy Policy →
          </Link>
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
