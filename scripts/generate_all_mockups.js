const fs = require('fs');
const path = require('path');

const outDir = 'c:/Endis stuff/public/catalog';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Common SVG Header Definitions
const commonDefs = `
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="#1c1811" />
      <stop offset="60%" stop-color="#0c0a07" />
      <stop offset="100%" stop-color="#050403" />
    </radialGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff5e4" />
      <stop offset="25%" stop-color="#c9a96e" />
      <stop offset="50%" stop-color="#99783d" />
      <stop offset="75%" stop-color="#eddac0" />
      <stop offset="100%" stop-color="#7a5822" />
    </linearGradient>
    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(201,169,110,0.65)" />
      <stop offset="50%" stop-color="rgba(240,232,216,0.2)" />
      <stop offset="100%" stop-color="rgba(201,169,110,0.5)" />
    </linearGradient>
    <linearGradient id="darkSurface" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#181510" />
      <stop offset="100%" stop-color="#0d0b08" />
    </linearGradient>
    <filter id="shadowHeavy" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000" flood-opacity="0.85" />
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.5" />
    </filter>
    <filter id="shadowCard" x="-15%" y="-15%" width="130%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity="0.75" />
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#c9a96e" flood-opacity="0.1" />
    </filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(201,169,110,0.03)" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="1200" height="675" fill="url(#bgGrad)" />
  <rect width="1200" height="675" fill="url(#grid)" />
  <ellipse cx="600" cy="340" rx="420" ry="240" fill="#c9a96e" opacity="0.035" filter="blur(70px)" />
`;

// Helper to wrap complete SVG
const wrapSvg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
${commonDefs}
${body}
</svg>`;

const mockups = {};

// 2. BRAND AMPLIFICATION
mockups['brand_amplification.svg'] = wrapSvg(`
  <!-- Top Spec Tag -->
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">02 // IDENTITY SYSTEMS · CHARTE GRAPHIQUE</text>
  </g>

  <!-- Open Hardcover Guidelines Manual (Center) -->
  <g transform="translate(200, 110)" filter="url(#shadowHeavy)">
    <!-- Book Left Page -->
    <path d="M 0 10 Q 200 0 400 6 L 400 460 Q 200 454 0 464 Z" fill="#14110b" stroke="url(#goldBorder)" stroke-width="1" />
    <!-- Book Right Page -->
    <path d="M 400 6 Q 600 0 800 10 L 800 464 Q 600 454 400 460 Z" fill="#16130c" stroke="url(#goldBorder)" stroke-width="1" />
    <!-- Book Spine Crease & Shadow -->
    <line x1="400" y1="5" x2="400" y2="461" stroke="#050403" stroke-width="4" />
    <line x1="400" y1="5" x2="400" y2="461" stroke="url(#goldGrad)" stroke-width="1" opacity="0.4" />

    <!-- Silk Bookmark Ribbon in Gold -->
    <path d="M 396 0 L 404 0 L 404 495 L 400 485 L 396 495 Z" fill="url(#goldGrad)" filter="url(#shadowCard)" />

    <!-- Left Page Content: Logo Architecture Grid -->
    <g transform="translate(45, 50)">
      <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="3" fill="#c9a96e" opacity="0.8">01. LOGO ANATOMY &amp; CLEARSPACE</text>
      <text x="0" y="16" font-family="'Montserrat', sans-serif" font-size="7" letter-spacing="1.5" fill="#e8d5b7" opacity="0.35">CROSS-PLATFORM RATIOS</text>
      
      <!-- Logo Grid Box -->
      <rect x="0" y="40" width="310" height="200" rx="4" fill="#090805" stroke="rgba(201,169,110,0.15)" stroke-width="1" />
      <circle cx="155" cy="140" r="60" fill="none" stroke="rgba(201,169,110,0.2)" stroke-dasharray="2,3" />
      <line x1="55" y1="140" x2="255" y2="140" stroke="rgba(201,169,110,0.15)" />
      <line x1="155" y1="60" x2="155" y2="220" stroke="rgba(201,169,110,0.15)" />

      <!-- Centered Gold Mark -->
      <g transform="translate(155, 140)">
        <polygon points="0,-40 35,20 -35,20" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" />
        <circle cx="0" cy="2" r="16" fill="none" stroke="url(#goldGrad)" stroke-width="2" />
        <circle cx="0" cy="2" r="4.5" fill="url(#goldGrad)" />
      </g>

      <!-- Brand Voice Summary -->
      <g transform="translate(0, 270)">
        <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="2" fill="#c9a96e">BRAND VOICE &amp; ESSENCE</text>
        <text x="0" y="22" font-family="'Cormorant Garamond', serif" font-size="16" font-style="italic" fill="#f0e8d8">"Quiet authority, uncompromising precision."</text>
        <text x="0" y="45" font-family="'Montserrat', sans-serif" font-size="7.5" fill="#e8d5b7" opacity="0.45">Autonomous creative infrastructure designed for market dominance.</text>
      </g>
    </g>

    <!-- Right Page Content: Typography Specimen & Color Matrix -->
    <g transform="translate(445, 50)">
      <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="3" fill="#c9a96e" opacity="0.8">02. TYPOGRAPHY &amp; ASSET LIBRARY</text>
      <text x="0" y="16" font-family="'Montserrat', sans-serif" font-size="7" letter-spacing="1.5" fill="#e8d5b7" opacity="0.35">PRIMARY &amp; EDITORIAL TYPESETTING</text>

      <text x="0" y="65" font-family="'Cormorant Garamond', serif" font-size="34" font-weight="300" fill="#f0e8d8">Typography System</text>
      <text x="0" y="90" font-family="'Montserrat', sans-serif" font-size="11" letter-spacing="2" fill="#c9a96e">ABCDEFGHIKLMNOPQRSTUVWXYZ</text>
      <text x="0" y="106" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="1" fill="#e8d5b7" opacity="0.4">1234567890 · (!@#$%&amp;*)</text>

      <line x1="0" y1="130" x2="310" y2="130" stroke="rgba(201,169,110,0.12)" />

      <!-- Asset Library Swatch Breakdown -->
      <g transform="translate(0, 155)">
        <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="2" fill="#c9a96e">COLOR SPECIFICATIONS</text>
        <g transform="translate(0, 20)">
          <rect x="0" y="0" width="70" height="42" rx="3" fill="#0a0906" stroke="rgba(201,169,110,0.3)" />
          <rect x="78" y="0" width="70" height="42" rx="3" fill="#c9a96e" />
          <rect x="156" y="0" width="70" height="42" rx="3" fill="#f0e8d8" />
          <rect x="234" y="0" width="70" height="42" rx="3" fill="#2a2318" />
          <text x="5" y="58" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">OBSIDIAN</text>
          <text x="83" y="58" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">GOLD FOIL</text>
          <text x="161" y="58" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">CHAMPAGNE</text>
          <text x="239" y="58" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">BRONZE</text>
        </g>
      </g>
    </g>
  </g>

  <!-- Floating Badge -->
  <g transform="translate(60, 560)">
    <rect width="220" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">BRAND AMPLIFICATION</text>
  </g>
`);

// 3. FRACTIONAL CREATIVE PARTNER
mockups['fractional_creative_partner.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">03 // IDENTITY SYSTEMS · MONTHLY RETAINER</text>
  </g>

  <!-- Executive Director Board -->
  <g transform="translate(180, 95)" filter="url(#shadowHeavy)">
    <rect width="840" height="470" rx="8" fill="url(#darkSurface)" stroke="url(#goldBorder)" stroke-width="1" />
    
    <!-- Top Header -->
    <g transform="translate(45, 45)">
      <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="10" letter-spacing="3" fill="#c9a96e">EXECUTIVE CREATIVE DIRECTION // PIPELINE</text>
      <text x="0" y="20" font-family="'Cormorant Garamond', serif" font-size="28" font-weight="300" fill="#f0e8d8">Monthly Asset Architecture &amp; Brand Stewardship</text>
      <line x1="0" y1="36" x2="750" y2="36" stroke="rgba(201,169,110,0.15)" />
    </g>

    <!-- 4 Pipeline Columns -->
    <g transform="translate(45, 110)">
      <!-- Col 1 -->
      <g transform="translate(0, 0)">
        <rect width="170" height="280" rx="5" fill="#0d0b08" stroke="rgba(201,169,110,0.15)" />
        <text x="15" y="28" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="2" fill="#c9a96e">01. DISCOVERY</text>
        <rect x="15" y="45" width="140" height="55" rx="3" fill="#14110b" stroke="rgba(201,169,110,0.2)" />
        <text x="25" y="70" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">Strategy Alignment</text>
        <text x="25" y="85" font-family="'Montserrat', sans-serif" font-size="6.5" fill="#c9a96e" opacity="0.6">COMPLETED</text>
        <rect x="15" y="115" width="140" height="55" rx="3" fill="#14110b" stroke="rgba(201,169,110,0.2)" />
        <text x="25" y="140" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">Competitor Audit</text>
        <text x="25" y="155" font-family="'Montserrat', sans-serif" font-size="6.5" fill="#c9a96e" opacity="0.6">COMPLETED</text>
      </g>

      <!-- Col 2 -->
      <g transform="translate(190, 0)">
        <rect width="170" height="280" rx="5" fill="#0d0b08" stroke="rgba(201,169,110,0.15)" />
        <text x="15" y="28" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="2" fill="#c9a96e">02. ASSET SPRINT</text>
        <rect x="15" y="45" width="140" height="70" rx="3" fill="#17130b" stroke="#c9a96e" />
        <text x="25" y="72" font-family="'Montserrat', sans-serif" font-size="8" font-weight="600" fill="#f0e8d8">Key Visual Evolution</text>
        <text x="25" y="88" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">IN PRODUCTION</text>
        <rect x="25" y="96" width="100" height="4" rx="2" fill="#2a2215" />
        <rect x="25" y="96" width="70" height="4" rx="2" fill="url(#goldGrad)" />
      </g>

      <!-- Col 3 -->
      <g transform="translate(380, 0)">
        <rect width="170" height="280" rx="5" fill="#0d0b08" stroke="rgba(201,169,110,0.15)" />
        <text x="15" y="28" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="2" fill="#c9a96e">03. MULTI-CHANNEL</text>
        <rect x="15" y="45" width="140" height="55" rx="3" fill="#14110b" stroke="rgba(201,169,110,0.1)" />
        <text x="25" y="70" font-family="'Montserrat', sans-serif" font-size="8" fill="#e8d5b7" opacity="0.6">Omnichannel Deck</text>
        <text x="25" y="85" font-family="'Montserrat', sans-serif" font-size="6.5" fill="rgba(201,169,110,0.4)">QUEUED</text>
      </g>

      <!-- Col 4 -->
      <g transform="translate(570, 0)">
        <rect width="180" height="280" rx="5" fill="#0d0b08" stroke="rgba(201,169,110,0.15)" />
        <text x="15" y="28" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="2" fill="#c9a96e">04. DELIVERED</text>
        <!-- Seal Stamp -->
        <g transform="translate(90, 130)">
          <circle cx="0" cy="0" r="45" fill="none" stroke="url(#goldGrad)" stroke-width="1.5" />
          <circle cx="0" cy="0" r="38" fill="none" stroke="rgba(201,169,110,0.3)" stroke-dasharray="3,3" />
          <text x="0" y="-12" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="6.5" letter-spacing="2" fill="#c9a96e">MONTHLY</text>
          <text x="0" y="8" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="16" fill="#f0e8d8">100%</text>
          <text x="0" y="24" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="6.5" letter-spacing="2" fill="#c9a96e">COMPLIANT</text>
        </g>
      </g>
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="250" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">FRACTIONAL PARTNER</text>
  </g>
`);

// 4. SOCIAL MEDIA STARTER PACK
mockups['social_media_starter_pack.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">04 // CONTENT PRODUCTION · 10 POSTS + 5 STORIES</text>
  </g>

  <!-- 3D Layered Social Posts Floating -->
  <g transform="translate(180, 110)">
    <!-- Post 1 (Left) -->
    <g transform="translate(0, 60) rotate(-6)" filter="url(#shadowHeavy)">
      <rect width="250" height="310" rx="8" fill="#120f0b" stroke="url(#goldBorder)" stroke-width="1" />
      <rect x="15" y="15" width="220" height="180" rx="4" fill="#090805" />
      <circle cx="125" cy="105" r="35" fill="none" stroke="url(#goldGrad)" stroke-width="1" opacity="0.7" />
      <text x="125" y="110" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="18" fill="#f0e8d8">Aesthetic 01</text>
      <text x="25" y="225" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="1.5" fill="#c9a96e">HEADLINE PROOF</text>
      <text x="25" y="245" font-family="'Montserrat', sans-serif" font-size="7" fill="#e8d5b7" opacity="0.5">High-converting carousel slide framework.</text>
    </g>

    <!-- Post 2 (Center - Hero) -->
    <g transform="translate(260, 20) rotate(0)" filter="url(#shadowHeavy)">
      <rect width="280" height="350" rx="8" fill="#17140e" stroke="url(#goldGrad)" stroke-width="1.5" />
      <!-- Social Header Bar -->
      <g transform="translate(20, 20)">
        <circle cx="12" cy="12" r="12" fill="url(#goldGrad)" />
        <text x="32" y="10" font-family="'Montserrat', sans-serif" font-size="8" font-weight="600" fill="#f0e8d8">ography.studio</text>
        <text x="32" y="20" font-family="'Montserrat', sans-serif" font-size="6.5" fill="#c9a96e">Sponsored · Studio Grade</text>
      </g>
      <!-- Media Square -->
      <rect x="20" y="52" width="240" height="210" rx="4" fill="#090806" />
      <polygon points="140,110 170,165 110,165" fill="none" stroke="url(#goldGrad)" stroke-width="2" />
      <text x="140" y="195" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="20" fill="#f0e8d8">Visual Authority</text>
      
      <!-- Engagement Controls -->
      <g transform="translate(20, 280)">
        <circle cx="10" cy="10" r="6" fill="#c9a96e" opacity="0.8" />
        <circle cx="30" cy="10" r="6" fill="#c9a96e" opacity="0.4" />
        <circle cx="50" cy="10" r="6" fill="#c9a96e" opacity="0.4" />
        <text x="0" y="38" font-family="'Montserrat', sans-serif" font-size="7.5" fill="#e8d5b7" opacity="0.7">Canva-Ready Editable Templates</text>
      </g>
    </g>

    <!-- Post 3 (Right - Vertical Story) -->
    <g transform="translate(560, 40) rotate(8)" filter="url(#shadowHeavy)">
      <rect width="200" height="340" rx="10" fill="#110e0a" stroke="url(#goldBorder)" stroke-width="1" />
      <!-- Story Progress Bars -->
      <rect x="15" y="15" width="48" height="2.5" rx="1" fill="#c9a96e" />
      <rect x="68" y="15" width="48" height="2.5" rx="1" fill="#c9a96e" opacity="0.3" />
      <rect x="121" y="15" width="48" height="2.5" rx="1" fill="#c9a96e" opacity="0.3" />
      
      <text x="100" y="160" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="24" fill="#f0e8d8">9:16 Story</text>
      <text x="100" y="180" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7.5" letter-spacing="2" fill="#c9a96e">FULL BLEED</text>
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="240" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">SOCIAL STARTER PACK</text>
  </g>
`);

// 5. UGC ASSET KIT
mockups['ugc_asset_kit.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">05 // CONTENT PRODUCTION · UGC ASSETS</text>
  </g>

  <!-- Creator Phone & Floating Badges -->
  <g transform="translate(350, 90)" filter="url(#shadowHeavy)">
    <!-- Smartphone Chassis -->
    <rect width="250" height="470" rx="32" fill="#0b0a08" stroke="url(#goldGrad)" stroke-width="2" />
    <rect x="12" y="12" width="226" height="446" rx="24" fill="#14110c" />
    
    <!-- Camera Notch -->
    <rect x="85" y="20" width="80" height="18" rx="9" fill="#060504" />
    <circle cx="145" cy="29" r="4" fill="#201a11" />

    <!-- Video Reel Content Overlay -->
    <g transform="translate(30, 80)">
      <rect width="190" height="240" rx="6" fill="#080705" />
      <polygon points="90,105 115,120 90,135" fill="url(#goldGrad)" />
      <circle cx="98" cy="120" r="26" fill="none" stroke="url(#goldGrad)" stroke-width="1.5" />
      <text x="95" y="175" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="17" fill="#f0e8d8">Creator Reel Asset</text>
      <text x="95" y="195" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7" letter-spacing="2" fill="#c9a96e">HOOK FORMULA 01</text>
    </g>

    <!-- UI Overlay Tags on Video -->
    <g transform="translate(30, 340)">
      <rect width="190" height="30" rx="4" fill="rgba(201,169,110,0.1)" stroke="rgba(201,169,110,0.3)" stroke-width="1" />
      <text x="12" y="18" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">#1 High-Retention UGC Template</text>
    </g>

    <!-- Engagement Icons Right Bar -->
    <g transform="translate(195, 220)">
      <circle cx="10" cy="10" r="9" fill="#241d13" stroke="#c9a96e" stroke-width="1" />
      <circle cx="10" cy="38" r="9" fill="#241d13" stroke="#c9a96e" stroke-width="1" />
      <circle cx="10" cy="66" r="9" fill="#241d13" stroke="#c9a96e" stroke-width="1" />
    </g>
  </g>

  <!-- Floating Feature Card Left -->
  <g transform="translate(120, 200) rotate(-8)" filter="url(#shadowCard)">
    <rect width="180" height="120" rx="6" fill="#13100b" stroke="url(#goldBorder)" stroke-width="1" />
    <text x="18" y="32" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">VIRAL HOOKS</text>
    <text x="18" y="58" font-family="'Cormorant Garamond', serif" font-size="18" fill="#f0e8d8">15 Branded Assets</text>
    <text x="18" y="82" font-family="'Montserrat', sans-serif" font-size="7" fill="#e8d5b7" opacity="0.5">Posts · Stories · Reels</text>
  </g>

  <!-- Floating Feature Card Right -->
  <g transform="translate(640, 240) rotate(6)" filter="url(#shadowCard)">
    <rect width="190" height="130" rx="6" fill="#13100b" stroke="url(#goldBorder)" stroke-width="1" />
    <text x="20" y="34" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">THUMBNAIL ENGINE</text>
    <text x="20" y="62" font-family="'Cormorant Garamond', serif" font-size="20" fill="#f0e8d8">High CTR Layouts</text>
    <text x="20" y="86" font-family="'Montserrat', sans-serif" font-size="7.5" fill="#e8d5b7" opacity="0.5">Designed for Creator Scale</text>
  </g>

  <g transform="translate(60, 560)">
    <rect width="210" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">UGC ASSET KIT</text>
  </g>
`);

// 6. MONTHLY CONTENT BUNDLE
mockups['monthly_content_bundle.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">06 // CONTENT PRODUCTION · 30 TEMPLATES / MO</text>
  </g>

  <!-- Calendar 30-Day Grid Layout -->
  <g transform="translate(220, 105)" filter="url(#shadowHeavy)">
    <rect width="760" height="450" rx="8" fill="url(#darkSurface)" stroke="url(#goldBorder)" stroke-width="1" />
    
    <g transform="translate(45, 40)">
      <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="10" letter-spacing="3" fill="#c9a96e">MONTHLY CONTENT RECURRING CALENDAR</text>
      <text x="0" y="24" font-family="'Cormorant Garamond', serif" font-size="26" font-weight="300" fill="#f0e8d8">30 Bespoke Templates Refreshed Every 30 Days</text>
      <line x1="0" y1="40" x2="670" y2="40" stroke="rgba(201,169,110,0.15)" />
    </g>

    <!-- Calendar Matrix Grid (5 cols x 3 rows) -->
    <g transform="translate(45, 110)">
      ${Array.from({ length: 15 }).map((_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const x = col * 138;
        const y = row * 105;
        const isHighlight = i === 4 || i === 8 || i === 12;
        return `
          <g transform="translate(${x}, ${y})">
            <rect width="124" height="92" rx="4" fill="${isHighlight ? '#1c160e' : '#0e0c08'}" stroke="${isHighlight ? '#c9a96e' : 'rgba(201,169,110,0.12)'}" stroke-width="${isHighlight ? 1.2 : 1}" />
            <text x="12" y="24" font-family="'IBM Plex Mono', monospace" font-size="9" fill="#c9a96e">${String(i + 1).padStart(2, '0')}</text>
            <rect x="12" y="34" width="100" height="36" rx="2" fill="#080705" />
            <text x="20" y="55" font-family="'Montserrat', sans-serif" font-size="7" fill="${isHighlight ? '#f0e8d8' : '#e8d5b7'}" opacity="0.6">Post ${i + 1}</text>
          </g>
        `;
      }).join('')}
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="250" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">MONTHLY CONTENT BUNDLE</text>
  </g>
`);

// 7. PHOTO RETOUCH PACK
mockups['photo_retouch_pack.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">07 // CONTENT PRODUCTION · BATCH RETOUCHING</text>
  </g>

  <!-- Editorial Split Screen (Before vs After) -->
  <g transform="translate(230, 100)" filter="url(#shadowHeavy)">
    <rect width="740" height="460" rx="8" fill="#090805" stroke="url(#goldBorder)" stroke-width="1" />
    
    <!-- Left Half: "RAW" Desaturated Frame -->
    <g transform="translate(20, 20)">
      <rect width="345" height="420" rx="4" fill="#141414" />
      <circle cx="172" cy="180" r="80" fill="#202020" />
      <text x="20" y="40" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#777">RAW EXPOSURE</text>
      <text x="172" y="320" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="22" fill="#888">Original Studio Capture</text>
    </g>

    <!-- Right Half: "GRADED" Rich Gold / High Luxury Profile -->
    <g transform="translate(375, 20)">
      <rect width="345" height="420" rx="4" fill="#1e180f" stroke="url(#goldGrad)" stroke-width="1" />
      <circle cx="172" cy="180" r="80" fill="url(#goldGrad)" opacity="0.4" filter="url(#shadowCard)" />
      <circle cx="172" cy="180" r="72" fill="#100d08" />
      <polygon points="172,125 210,195 134,195" fill="none" stroke="url(#goldGrad)" stroke-width="2" />
      <text x="20" y="40" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">RETOUCHED &amp; GRADED</text>
      <text x="172" y="320" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="24" font-weight="300" fill="#f0e8d8">Editorial Master Grade</text>
      <text x="172" y="345" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7.5" fill="#c9a96e">Color Corrected · 50 Images Batch</text>
    </g>

    <!-- Split Divider Line in Gold -->
    <line x1="370" y1="10" x2="370" y2="450" stroke="url(#goldGrad)" stroke-width="2" />
    <circle cx="370" cy="230" r="14" fill="#090805" stroke="url(#goldGrad)" stroke-width="2" />
    <text x="370" y="234" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="9" fill="#c9a96e">◀ ▶</text>
  </g>

  <g transform="translate(60, 560)">
    <rect width="230" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">PHOTO RETOUCH PACK</text>
  </g>
`);

// 8. CUSTOM LIGHTROOM PRESET PACK
mockups['custom_lightroom_preset_pack.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">08 // CONTENT PRODUCTION · 5 PRESET SUITE</text>
  </g>

  <!-- Lightroom Curve & Presets Board -->
  <g transform="translate(200, 105)" filter="url(#shadowHeavy)">
    <rect width="800" height="450" rx="8" fill="url(#darkSurface)" stroke="url(#goldBorder)" stroke-width="1" />
    
    <!-- Tone Curve Panel (Left) -->
    <g transform="translate(45, 45)">
      <rect width="290" height="290" rx="4" fill="#080705" stroke="rgba(201,169,110,0.15)" />
      <!-- Grid Lines -->
      <line x1="0" y1="72" x2="290" y2="72" stroke="rgba(201,169,110,0.1)" stroke-dasharray="2,2" />
      <line x1="0" y1="145" x2="290" y2="145" stroke="rgba(201,169,110,0.1)" stroke-dasharray="2,2" />
      <line x1="0" y1="218" x2="290" y2="218" stroke="rgba(201,169,110,0.1)" stroke-dasharray="2,2" />
      <line x1="72" y1="0" x2="72" y2="290" stroke="rgba(201,169,110,0.1)" stroke-dasharray="2,2" />
      <line x1="145" y1="0" x2="145" y2="290" stroke="rgba(201,169,110,0.1)" stroke-dasharray="2,2" />
      <line x1="218" y1="0" x2="218" y2="290" stroke="rgba(201,169,110,0.1)" stroke-dasharray="2,2" />

      <!-- S-Curve Gold Line -->
      <path d="M 0 290 C 70 270 120 180 145 145 C 170 110 220 20 290 0" fill="none" stroke="url(#goldGrad)" stroke-width="3" />
      <circle cx="75" cy="245" r="5" fill="url(#goldGrad)" />
      <circle cx="145" cy="145" r="5" fill="url(#goldGrad)" />
      <circle cx="215" cy="45" r="5" fill="url(#goldGrad)" />

      <text x="0" y="325" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">TONE CURVE PROFILE</text>
      <text x="0" y="345" font-family="'Cormorant Garamond', serif" font-size="16" fill="#f0e8d8">Warm Obsidian S-Tone (.xmp / .dng)</text>
    </g>

    <!-- 5 Preset Modules (Right) -->
    <g transform="translate(380, 45)">
      <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" fill="#c9a96e">SIGNATURE FILM PRESETS</text>
      ${[
        { name: '01. Golden Obsidian', tag: 'HIGH CONTRAST / RICH GOLD' },
        { name: '02. Velvet Editorial', tag: 'MUTED HIGHLIGHTS / MATTE' },
        { name: '03. Champagne Warmth', tag: 'WARM SKIN TONES / FILM' },
        { name: '04. Noir Minimalist', tag: 'DEEP BLACKS / MONO COLD' },
        { name: '05. Studio Daylight', tag: 'NATURAL CLEAN / BALANCED' },
      ].map((p, idx) => `
        <g transform="translate(0, ${25 + idx * 58})">
          <rect width="375" height="48" rx="4" fill="#0d0b08" stroke="rgba(201,169,110,0.18)" />
          <circle cx="24" cy="24" r="7" fill="url(#goldGrad)" opacity="${1 - idx * 0.15}" />
          <text x="44" y="24" font-family="'Cormorant Garamond', serif" font-size="17" fill="#f0e8d8">${p.name}</text>
          <text x="44" y="38" font-family="'Montserrat', sans-serif" font-size="6.5" letter-spacing="1.5" fill="#c9a96e">${p.tag}</text>
        </g>
      `).join('')}
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="250" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">LIGHTROOM PRESETS</text>
  </g>
`);

// 9. EVENT PULL-UP BANNER
mockups['event_pull_up_banner.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">09 // PRINT &amp; PHYSICAL · 85×200 CM STAND</text>
  </g>

  <!-- Architectural Pull-up Banner in Studio Perspective -->
  <g transform="translate(460, 75)" filter="url(#shadowHeavy)">
    <!-- Aluminum Heavy Base -->
    <path d="M -40 480 L 320 480 L 300 505 L -20 505 Z" fill="#1b1712" stroke="url(#goldGrad)" stroke-width="1.5" />
    <rect x="-30" y="475" width="340" height="10" rx="2" fill="#0d0b08" />

    <!-- 85x200cm Banner Screen -->
    <rect x="0" y="0" width="280" height="475" rx="3" fill="#120f0a" stroke="url(#goldBorder)" stroke-width="1.2" />

    <!-- Banner Graphic Content -->
    <g transform="translate(25, 45)">
      <!-- Top Monogram -->
      <circle cx="115" cy="50" r="32" fill="none" stroke="url(#goldGrad)" stroke-width="1.5" />
      <polygon points="115,28 135,62 95,62" fill="none" stroke="url(#goldGrad)" stroke-width="2" />
      <text x="115" y="115" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="28" font-weight="300" letter-spacing="3" fill="#f0e8d8">OG R A P H Y</text>
      <text x="115" y="132" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7" letter-spacing="3" fill="#c9a96e">STUDIO PLATFORM</text>

      <line x1="15" y1="160" x2="215" y2="160" stroke="rgba(201,169,110,0.2)" />

      <!-- Main Exhibition Message -->
      <g transform="translate(15, 195)">
        <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">VISUAL READINESS</text>
        <text x="0" y="26" font-family="'Cormorant Garamond', serif" font-size="24" font-weight="300" fill="#f0e8d8">One Contact.</text>
        <text x="0" y="52" font-family="'Cormorant Garamond', serif" font-size="24" font-weight="300" fill="#f0e8d8">One Invoice.</text>
        <text x="0" y="78" font-family="'Cormorant Garamond', serif" font-size="24" font-style="italic" fill="#c9a96e">One Result.</text>
      </g>

      <!-- Bottom Specs -->
      <g transform="translate(15, 345)">
        <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="7" fill="#e8d5b7" opacity="0.45">850 × 2000 mm Premium Vinyl</text>
        <text x="0" y="15" font-family="'Montserrat', sans-serif" font-size="7" fill="#e8d5b7" opacity="0.45">Scratch Resistant · UV Protected</text>
        <text x="0" y="30" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">Designed &amp; Printed &amp; Delivered</text>
      </g>
    </g>
  </g>

  <!-- Floating Feature Badges -->
  <g transform="translate(160, 220) rotate(-6)" filter="url(#shadowCard)">
    <rect width="190" height="110" rx="6" fill="#13100b" stroke="url(#goldBorder)" stroke-width="1" />
    <text x="18" y="32" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">EVENT READY</text>
    <text x="18" y="58" font-family="'Cormorant Garamond', serif" font-size="20" fill="#f0e8d8">Padded Carry Bag</text>
    <text x="18" y="80" font-family="'Montserrat', sans-serif" font-size="7.5" fill="#e8d5b7" opacity="0.5">Heavy Duty Cassette Included</text>
  </g>

  <g transform="translate(60, 560)">
    <rect width="240" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">EVENT PULL-UP BANNER</text>
  </g>
`);

// 11. FRAMED WALL PRINT
mockups['framed_wall_print.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">11 // PRINT &amp; PHYSICAL · MUSEUM-GRADE FRAMED ART</text>
  </g>

  <!-- Gallery Framed Artwork Center -->
  <g transform="translate(340, 90)" filter="url(#shadowHeavy)">
    <!-- Outer Heavy Wooden Frame -->
    <rect width="520" height="460" rx="4" fill="#0c0a07" stroke="url(#goldGrad)" stroke-width="2.5" />
    <rect x="12" y="12" width="496" height="436" rx="2" fill="#14110c" />

    <!-- Passe-Partout White/Cream Matte Border -->
    <rect x="40" y="40" width="440" height="380" rx="1" fill="#18140e" stroke="rgba(201,169,110,0.2)" stroke-width="1" />

    <!-- Architectural Art Print Core -->
    <g transform="translate(85, 75)">
      <rect width="350" height="310" fill="#070604" stroke="rgba(201,169,110,0.1)" />
      
      <!-- Minimalist Architectural Geometric Composition -->
      <polygon points="175,40 310,260 40,260" fill="none" stroke="url(#goldGrad)" stroke-width="2" />
      <circle cx="175" cy="160" r="50" fill="none" stroke="rgba(201,169,110,0.35)" stroke-dasharray="3,3" />
      <line x1="40" y1="260" x2="310" y2="40" stroke="rgba(201,169,110,0.2)" />
      
      <text x="175" y="225" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="22" font-weight="300" fill="#f0e8d8">Architectural Noir</text>
      <text x="175" y="245" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7" letter-spacing="3" fill="#c9a96e">LIMITED EDITION // 01 OF 50</text>
    </g>
  </g>

  <!-- Gallery Specification Placard (Bottom Left) -->
  <g transform="translate(130, 240) rotate(-4)" filter="url(#shadowCard)">
    <rect width="170" height="120" rx="4" fill="#0f0d09" stroke="rgba(201,169,110,0.25)" stroke-width="1" />
    <text x="16" y="30" font-family="'Montserrat', sans-serif" font-size="7.5" letter-spacing="2" fill="#c9a96e">SPECIFICATION</text>
    <text x="16" y="55" font-family="'Cormorant Garamond', serif" font-size="17" fill="#f0e8d8">Hahnemühle 310g</text>
    <text x="16" y="78" font-family="'Montserrat', sans-serif" font-size="7" fill="#e8d5b7" opacity="0.5">Custom Solid Wood Frame</text>
    <text x="16" y="94" font-family="'Montserrat', sans-serif" font-size="7" fill="#e8d5b7" opacity="0.5">Anti-Reflective Glass</text>
  </g>

  <g transform="translate(60, 560)">
    <rect width="220" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">FRAMED WALL PRINT</text>
  </g>
`);

// 12. EVENT IDENTITY KIT
mockups['event_identity_kit.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">12 // PRINT &amp; PHYSICAL · VIP EVENT COLLATERAL</text>
  </g>

  <!-- Lanyard + VIP Badge & Presentation Folder -->
  <g transform="translate(240, 95)" filter="url(#shadowHeavy)">
    <!-- Event Folder in Background -->
    <rect width="460" height="460" rx="8" fill="#120f0a" stroke="url(#goldBorder)" stroke-width="1.2" />
    <line x1="0" y1="0" x2="460" y2="0" stroke="url(#goldGrad)" stroke-width="2.5" />
    
    <g transform="translate(40, 45)">
      <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="3" fill="#c9a96e">CONFERENCE SUITE</text>
      <text x="0" y="28" font-family="'Cormorant Garamond', serif" font-size="28" font-weight="300" fill="#f0e8d8">Global Creator Summit</text>
      <line x1="0" y1="44" x2="380" y2="44" stroke="rgba(201,169,110,0.15)" />
    </g>

    <!-- Floating VIP Badge on Ribbon -->
    <g transform="translate(360, 60) rotate(8)" filter="url(#shadowCard)">
      <!-- Lanyard Strap -->
      <path d="M 90 -70 L 110 -70 L 110 30 L 90 30 Z" fill="#0d0b08" stroke="rgba(201,169,110,0.3)" />
      <!-- Metallic Lobster Clip -->
      <rect x="85" y="20" width="30" height="20" rx="4" fill="url(#goldGrad)" />
      
      <!-- VIP Badge Body -->
      <rect x="0" y="38" width="200" height="310" rx="8" fill="#080705" stroke="url(#goldGrad)" stroke-width="1.5" />
      <g transform="translate(20, 70)">
        <rect width="160" height="80" rx="4" fill="#14110c" />
        <circle cx="80" cy="40" r="22" fill="none" stroke="url(#goldGrad)" stroke-width="1" />
        <text x="80" y="44" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="14" fill="#f0e8d8">OG</text>

        <text x="80" y="115" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="20" fill="#f0e8d8">Endi Osut</text>
        <text x="80" y="132" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7.5" letter-spacing="2" fill="#c9a96e">KEYNOTE SPEAKER</text>
        
        <rect x="15" y="155" width="130" height="26" rx="13" fill="rgba(201,169,110,0.15)" stroke="#c9a96e" stroke-width="1" />
        <text x="80" y="172" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="8" font-weight="600" letter-spacing="2" fill="#c9a96e">ALL ACCESS VIP</text>
      </g>
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="230" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">EVENT IDENTITY KIT</text>
  </g>
`);

// 13. PITCH DECK DESIGN
mockups['pitch_deck_design.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">13 // EDITORIAL · 20 INVESTOR SLIDES</text>
  </g>

  <!-- 3 Isometric Investor Deck Slides Floating -->
  <g transform="translate(160, 115)">
    <!-- Slide 1 (Back Left) -->
    <g transform="translate(0, 70) rotate(-6)" filter="url(#shadowHeavy)">
      <rect width="360" height="202" rx="6" fill="#100e0a" stroke="url(#goldBorder)" stroke-width="1" />
      <text x="25" y="40" font-family="'Montserrat', sans-serif" font-size="7.5" letter-spacing="2" fill="#c9a96e">01. THE PROBLEM</text>
      <text x="25" y="70" font-family="'Cormorant Garamond', serif" font-size="20" fill="#f0e8d8">Fragmented Creator Economy</text>
      <rect x="25" y="95" width="310" height="60" rx="3" fill="#080705" />
    </g>

    <!-- Slide 2 (Center Hero Slide - Traction Curve) -->
    <g transform="translate(260, 30) rotate(2)" filter="url(#shadowHeavy)">
      <rect width="400" height="225" rx="6" fill="#16130d" stroke="url(#goldGrad)" stroke-width="1.5" />
      
      <!-- Slide Header -->
      <text x="30" y="40" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">TRACTION &amp; REVENUE</text>
      <text x="30" y="65" font-family="'Cormorant Garamond', serif" font-size="22" font-weight="300" fill="#f0e8d8">$1.2M ARR Run Rate</text>
      
      <!-- Growth Chart -->
      <g transform="translate(30, 85)">
        <rect width="340" height="110" rx="4" fill="#080705" />
        <path d="M 20 90 Q 120 75 200 45 T 320 15" fill="none" stroke="url(#goldGrad)" stroke-width="3" />
        <!-- Data Dots -->
        <circle cx="120" cy="72" r="4" fill="#c9a96e" />
        <circle cx="200" cy="45" r="4" fill="#c9a96e" />
        <circle cx="320" cy="15" r="5" fill="#fff" />
        <text x="260" y="38" font-family="'Montserrat', sans-serif" font-size="8" font-weight="600" fill="#c9a96e">+340% YoY</text>
      </g>
    </g>

    <!-- Slide 3 (Front Right - Market Opportunity) -->
    <g transform="translate(460, 150) rotate(8)" filter="url(#shadowHeavy)">
      <rect width="380" height="213" rx="6" fill="#120f0b" stroke="url(#goldBorder)" stroke-width="1" />
      <text x="25" y="40" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">03. MARKET OPPORTUNITY</text>
      <text x="25" y="70" font-family="'Cormorant Garamond', serif" font-size="22" fill="#f0e8d8">$250B TAM Worldwide</text>
      <!-- Circular TAM Breakdown -->
      <circle cx="100" cy="135" r="40" fill="none" stroke="url(#goldGrad)" stroke-width="6" />
      <circle cx="100" cy="135" r="40" fill="none" stroke="rgba(201,169,110,0.2)" stroke-dasharray="40,160" stroke-width="6" />
      <text x="180" y="130" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">Tier 1 Founder Ready</text>
      <text x="180" y="148" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">20 Presentation-Ready Slides</text>
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="230" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">PITCH DECK DESIGN</text>
  </g>
`);

// 14. BUSINESS PROPOSAL
mockups['business_proposal.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">14 // EDITORIAL · 15-PAGE PROPOSAL TEMPLATE</text>
  </g>

  <!-- Editorial Proposal Document Spread -->
  <g transform="translate(230, 95)" filter="url(#shadowHeavy)">
    <rect width="740" height="470" rx="8" fill="url(#darkSurface)" stroke="url(#goldBorder)" stroke-width="1" />
    
    <!-- Left Cover Page -->
    <g transform="translate(35, 35)">
      <rect width="320" height="400" rx="4" fill="#0a0805" stroke="rgba(201,169,110,0.2)" />
      <!-- Gold Foil Accent Line -->
      <line x1="0" y1="0" x2="320" y2="0" stroke="url(#goldGrad)" stroke-width="2.5" />
      
      <g transform="translate(30, 60)">
        <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="3" fill="#c9a96e">BUSINESS PROPOSAL</text>
        <text x="0" y="30" font-family="'Cormorant Garamond', serif" font-size="28" font-weight="300" fill="#f0e8d8">Strategic Scope &amp;</text>
        <text x="0" y="60" font-family="'Cormorant Garamond', serif" font-size="28" font-weight="300" fill="#f0e8d8">Commercial Agreement</text>
        
        <line x1="0" y1="85" x2="180" y2="85" stroke="#c9a96e" stroke-width="1" opacity="0.4" />
        
        <text x="0" y="125" font-family="'Montserrat', sans-serif" font-size="8" fill="#e8d5b7" opacity="0.5">PREPARED FOR: ENTERPRISE CLIENT</text>
        <text x="0" y="142" font-family="'Montserrat', sans-serif" font-size="8" fill="#e8d5b7" opacity="0.5">DATE: 2026 // CONFIDENTIAL</text>
        
        <!-- Monogram Seal -->
        <circle cx="130" cy="230" r="30" fill="none" stroke="url(#goldGrad)" stroke-width="1.2" />
        <text x="130" y="235" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="16" fill="#c9a96e">OG</text>
      </g>
    </g>

    <!-- Right Summary Page (Pricing Table & Milestones) -->
    <g transform="translate(385, 35)">
      <rect width="320" height="400" rx="4" fill="#0e0c08" stroke="rgba(201,169,110,0.15)" />
      
      <g transform="translate(25, 45)">
        <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="2" fill="#c9a96e">INVESTMENT SCHEDULE</text>
        
        <!-- Table Row 1 -->
        <g transform="translate(0, 30)">
          <rect width="270" height="40" rx="3" fill="#14110c" />
          <text x="12" y="24" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">Phase 01: Discovery &amp; Audit</text>
          <text x="210" y="24" font-family="'Cormorant Garamond', serif" font-size="15" fill="#c9a96e">$2,500</text>
        </g>
        <!-- Table Row 2 -->
        <g transform="translate(0, 80)">
          <rect width="270" height="40" rx="3" fill="#14110c" />
          <text x="12" y="24" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">Phase 02: Full Execution</text>
          <text x="210" y="24" font-family="'Cormorant Garamond', serif" font-size="15" fill="#c9a96e">$5,000</text>
        </g>
        <!-- Table Row 3 -->
        <g transform="translate(0, 130)">
          <rect width="270" height="40" rx="3" fill="#14110c" />
          <text x="12" y="24" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">Phase 03: Delivery &amp; Handover</text>
          <text x="210" y="24" font-family="'Cormorant Garamond', serif" font-size="15" fill="#c9a96e">$2,500</text>
        </g>

        <!-- Signature Block -->
        <g transform="translate(0, 210)">
          <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="7.5" letter-spacing="2" fill="#c9a96e">AUTHORIZED SIGNATURE</text>
          <line x1="0" y1="40" x2="270" y2="40" stroke="rgba(201,169,110,0.3)" />
          <text x="0" y="32" font-family="'Cormorant Garamond', serif" font-size="20" font-style="italic" fill="#f0e8d8">Endi Osut</text>
          <text x="0" y="55" font-family="'Montserrat', sans-serif" font-size="7" fill="#e8d5b7" opacity="0.4">Managing Partner · OGraphy Studio</text>
        </g>
      </g>
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="230" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">BUSINESS PROPOSAL</text>
  </g>
`);

// 15. STUDENT CV & PORTFOLIO
mockups['student_cv_portfolio.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">15 // EDITORIAL · ATS-FRIENDLY RESUME &amp; FOLIO</text>
  </g>

  <!-- Modern Swiss-Grid CV Sheet & Tablet Preview -->
  <g transform="translate(230, 95)" filter="url(#shadowHeavy)">
    <!-- CV Sheet (Left) -->
    <rect width="400" height="465" rx="6" fill="#13100b" stroke="url(#goldBorder)" stroke-width="1.2" />
    
    <g transform="translate(40, 45)">
      <text x="0" y="0" font-family="'Cormorant Garamond', serif" font-size="28" font-weight="300" fill="#f0e8d8">Alexander Vance</text>
      <text x="0" y="18" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="3" fill="#c9a96e">SENIOR DESIGN ARCHITECT</text>
      <line x1="0" y1="32" x2="320" y2="32" stroke="rgba(201,169,110,0.2)" />

      <!-- Education & Experience Columns -->
      <g transform="translate(0, 55)">
        <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">EDUCATION &amp; AWARDS</text>
        <text x="0" y="20" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">BA Graphic Architecture · 2026</text>
        <text x="0" y="34" font-family="'Montserrat', sans-serif" font-size="7" fill="#e8d5b7" opacity="0.45">First Class Honours · London College of Art</text>

        <text x="0" y="65" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">SELECT EXPERTISE</text>
        <rect x="0" y="78" width="70" height="20" rx="3" fill="rgba(201,169,110,0.12)" stroke="rgba(201,169,110,0.3)" />
        <text x="12" y="91" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">Figma OS</text>
        
        <rect x="78" y="78" width="85" height="20" rx="3" fill="rgba(201,169,110,0.12)" stroke="rgba(201,169,110,0.3)" />
        <text x="90" y="91" font-family="'Montserrat', sans-serif" font-size="7" fill="#c9a96e">Brand Systems</text>
      </g>
    </g>

    <!-- Tablet / Mobile Digital Showcase (Right Angle) -->
    <g transform="translate(430, 30) rotate(6)" filter="url(#shadowCard)">
      <rect width="280" height="390" rx="18" fill="#080705" stroke="url(#goldGrad)" stroke-width="1.5" />
      <rect x="14" y="14" width="252" height="362" rx="12" fill="#14110c" />
      
      <g transform="translate(30, 45)">
        <text x="0" y="0" font-family="'Cormorant Garamond', serif" font-size="20" fill="#f0e8d8">Digital Portfolio</text>
        <text x="0" y="16" font-family="'Montserrat', sans-serif" font-size="7" letter-spacing="2" fill="#c9a96e">LIVE CASE STUDIES</text>
        <rect x="0" y="35" width="192" height="110" rx="4" fill="#090805" />
        <circle cx="96" cy="90" r="24" fill="none" stroke="url(#goldGrad)" stroke-width="1" />
        <text x="96" y="94" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="14" fill="#f0e8d8">Work 01</text>
      </g>
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="250" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">STUDENT CV &amp; PORTFOLIO</text>
  </g>
`);

// 16. SAME-DAY EVENT EDITS
mockups['same_day_event_edits.svg'] = wrapSvg(`
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="'IBM Plex Mono', monospace" font-size="10" letter-spacing="1.5" fill="#c9a96e" opacity="0.45">16 // EVENT MEDIA · EXPRESS 6-HOUR DELIVERY</text>
  </g>

  <!-- Express Timeline & Camera Media Delivery Card -->
  <g transform="translate(200, 105)" filter="url(#shadowHeavy)">
    <rect width="800" height="450" rx="8" fill="url(#darkSurface)" stroke="url(#goldBorder)" stroke-width="1" />
    
    <g transform="translate(45, 45)">
      <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="10" letter-spacing="3" fill="#c9a96e">SAME-DAY EVENT MEDIA PIPELINE</text>
      <text x="0" y="26" font-family="'Cormorant Garamond', serif" font-size="28" font-weight="300" fill="#f0e8d8">Rapid Media Turnaround for Real-Time Press &amp; Social</text>
      <line x1="0" y1="42" x2="710" y2="42" stroke="rgba(201,169,110,0.15)" />
    </g>

    <!-- Speed Stopwatch Graphic (Left) -->
    <g transform="translate(45, 120)">
      <rect width="260" height="260" rx="6" fill="#080705" stroke="rgba(201,169,110,0.2)" />
      
      <!-- Stopwatch Dial -->
      <circle cx="130" cy="120" r="70" fill="none" stroke="rgba(201,169,110,0.15)" stroke-width="6" />
      <circle cx="130" cy="120" r="70" fill="none" stroke="url(#goldGrad)" stroke-width="6" stroke-dasharray="320,440" stroke-linecap="round" />
      <text x="130" y="115" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="34" fill="#f0e8d8">&lt; 6h</text>
      <text x="130" y="135" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="8" letter-spacing="2" fill="#c9a96e">EXPRESS DISPATCH</text>
      
      <text x="130" y="225" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7.5" fill="#e8d5b7" opacity="0.5">Keynotes · Concerts · Gala Dinners</text>
    </g>

    <!-- Live Event Gallery Reel (Right) -->
    <g transform="translate(335, 120)">
      <text x="0" y="0" font-family="'Montserrat', sans-serif" font-size="8.5" letter-spacing="2" fill="#c9a96e">CURATED HIGHLIGHT FEED</text>
      
      <!-- Film Strip / Photo Strip -->
      <g transform="translate(0, 20)">
        <rect x="0" y="0" width="125" height="160" rx="4" fill="#14110c" stroke="url(#goldGrad)" />
        <polygon points="62,60 85,95 40,95" fill="none" stroke="url(#goldGrad)" stroke-width="1.5" />
        <text x="62" y="125" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7" fill="#f0e8d8">Keynote Reel</text>
        <text x="62" y="140" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="6" fill="#c9a96e">EDITED</text>

        <rect x="140" y="0" width="125" height="160" rx="4" fill="#14110c" stroke="url(#goldGrad)" />
        <polygon points="202,60 225,95 180,95" fill="none" stroke="url(#goldGrad)" stroke-width="1.5" />
        <text x="202" y="125" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7" fill="#f0e8d8">VIP Reception</text>
        <text x="202" y="140" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="6" fill="#c9a96e">EDITED</text>

        <rect x="280" y="0" width="125" height="160" rx="4" fill="#14110c" stroke="rgba(201,169,110,0.3)" />
        <polygon points="342,60 365,95 320,95" fill="none" stroke="rgba(201,169,110,0.5)" stroke-width="1.5" />
        <text x="342" y="125" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="7" fill="#f0e8d8">Press Hall</text>
        <text x="342" y="140" text-anchor="middle" font-family="'Montserrat', sans-serif" font-size="6" fill="#c9a96e">QUEUED</text>
      </g>

      <g transform="translate(0, 205)">
        <rect width="405" height="35" rx="4" fill="rgba(201,169,110,0.1)" stroke="rgba(201,169,110,0.25)" />
        <text x="18" y="22" font-family="'Montserrat', sans-serif" font-size="8" fill="#f0e8d8">✓ Cloud Link Generated · Live Webhook to PR Team</text>
      </g>
    </g>
  </g>

  <g transform="translate(60, 560)">
    <rect width="250" height="42" rx="21" fill="rgba(15,13,10,0.85)" stroke="rgba(201,169,110,0.35)" stroke-width="1" filter="url(#shadowCard)" />
    <circle cx="24" cy="21" r="5" fill="#c9a96e" />
    <text x="40" y="25" font-family="'Montserrat', sans-serif" font-size="9" letter-spacing="2" font-weight="500" fill="#f0e8d8">SAME-DAY EVENT EDITS</text>
  </g>
`);

// Write all generated mockups to public/catalog
let count = 0;
for (const [filename, svgContent] of Object.entries(mockups)) {
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, svgContent, 'utf8');
  count++;
}
console.log(`Generated ${count} luxury SVG mockups in ${outDir}`);
