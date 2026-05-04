const fs = require('fs');
const base = 'C:/Users/Endi Osut/ography-v4/src';

// 1. Remove @import url() from globals.css
let css = fs.readFileSync(base + '/app/globals.css', 'utf8');
const before = css.split('\n').length;
css = css.replace(/@import\s+url\([^)]+\);\s*\n?/g, '');
const after = css.split('\n').length;
fs.writeFileSync(base + '/app/globals.css', css, 'utf8');
console.log('CSS: removed font @import. Lines: ' + before + ' -> ' + after);
console.log('First line: ' + css.split('\n')[0]);

// 2. Update layout.tsx to load fonts via <link> tags
const layout = `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OGraphy Studio',
  description: 'Visual Identity. Print. Content. Delivery.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
`;
fs.writeFileSync(base + '/app/layout.tsx', layout, 'utf8');
console.log('Layout: updated with font <link> tags');
console.log('Done. Run: Remove-Item -Recurse -Force .next && vercel --prod --yes');
