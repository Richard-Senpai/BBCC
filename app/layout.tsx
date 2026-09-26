import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Newsreader } from 'next/font/google'
import './globals.css'

const sans = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const serif = Newsreader({
  variable: '--font-serif',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'BBCCILEIFE — Consecration Challenge',
  description:
    'A spiritual growth consecration challenge for the Blessed Bible Church Community, Ileife.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('bbcc-theme');
                  if (saved === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${sans.variable} ${serif.variable} font-sans antialiased selection:bg-amber-500/20 selection:text-amber-900 dark:selection:text-amber-200`}
      >
        {children}
      </body>
    </html>
  )
}
