import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kinetic Transit — Unpad Shuttle Monitor',
  description:
    'Monitoring real-time shuttle kampus Universitas Padjadjaran. Lihat posisi bus dan estimasi waktu kedatangan (ETA) secara langsung.',
  keywords: [
    'shuttle',
    'unpad',
    'jatinangor',
    'tracking',
    'PWA',
    'real-time',
    'ETA',
  ],
  authors: [{ name: 'Rio Irawan' }],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kinetic Transit',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#006945',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body suppressHydrationWarning>
        {children}

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('SW registered:', reg.scope);
                    })
                    .catch(function(err) {
                      console.log('SW registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
