import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Monalertics — Monitor, Alert, Analytics',
    template: '%s | Monalertics',
  },
  description:
    'Website uptime, SSL expiry & domain expiry monitoring with automated alerts and analytics.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
