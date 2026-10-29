import type { Metadata } from 'next'
// Fonts are self-hosted from /public/fonts (29 Oct 2026): no request to Google before consent; same families.
import './fonts.css'
import './globals.css'
import { CartProvider, CartSidebar } from '@/context/CartContext'

export const metadata: Metadata = {
  title: 'OGraphy Studio',
  description: 'Visual Identity. Print. Content. Delivery.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/montserrat-normal-latin-a5ec5492.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/cormorant-garamond-normal-latin-74db058f.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <CartProvider>
          {children}
          <CartSidebar />
        </CartProvider>
      </body>
    </html>
  )
}
