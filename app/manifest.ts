import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BBCC Consecration Challenge',
    short_name: 'BBCC Challenge',
    description: 'Consecration Challenge for the Blessed Bible Church Community, Ile-Ife.',
    start_url: '/',
    display: 'standalone',
    background_color: '#111214',
    theme_color: '#C86A1D',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
