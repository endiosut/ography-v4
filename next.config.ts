import type { NextConfig } from "next";

// Security headers (31 Oct 2026, same baseline as TradeLynk). The browser may load scripts only from this site, and
// images and connections only from this site, OGraphy's Supabase project and the n8n lead webhook (called from the
// project brief page). Email, WhatsApp, Telegram and exchange-rate calls run on the server, so the browser never
// needs them. A tracking pixel or a third-party script added later is refused by the browser.
const SUPABASE = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host } catch { return "" }
})() || "unzwefrtgsgmtljlbavf.supabase.co";
const N8N = (() => {
  try { return new URL(process.env.N8N_WEBHOOK_URL ?? "").host } catch { return "" }
})() || "ographyy.app.n8n.cloud";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${SUPABASE}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${SUPABASE} wss://${SUPABASE} https://${N8N}`,
  "media-src 'self' blob:",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: CSP },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      ],
    }];
  },
};

export default nextConfig;
