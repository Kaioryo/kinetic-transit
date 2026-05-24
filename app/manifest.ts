import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kinetic Transit — Unpad Shuttle Monitor',
    short_name: 'Kinetic Transit',
    description:
      'Monitoring real-time shuttle kampus Universitas Padjadjaran',
    start_url: '/',
    display: 'standalone',
    background_color: '#d9ffef',
    theme_color: '#006945',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
