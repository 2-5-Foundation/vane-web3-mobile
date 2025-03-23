import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vane Web3',
    short_name: 'Vane',
    description: 'Safety net for your crypto transfers',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1B1C',
    theme_color: '#0B1B1C',
    icons: [
      {
        src: '/vane-logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/vane-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  }
} 