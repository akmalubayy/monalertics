import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-default bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </div>
            <span className="text-lg font-semibold">Monalertics</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/public/monitors">
              <Button variant="ghost" size="sm">Public Monitors</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">Masuk</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Daftar Gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        <div className="mx-auto max-w-3xl text-center animate-fade-in-up">
          <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            Monitoring + Alert + Analytics
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Pantau website, SSL & domain <span className="text-brand-600">tanpa repot</span>
          </h1>
          <p className="mt-4 text-lg text-muted">
            Notifikasi otomatis via Email, Telegram & Discord saat website down, SSL
            mau exp, atau domain hampir jatuh tempo. Semua dalam satu dashboard.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg">Mulai Gratis</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">Sudah punya akun?</Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">
            Pakai Free Forever — 3 monitor, cek tiap 5 menit
          </p>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid w-full max-w-5xl gap-5 sm:grid-cols-3">
          {[
            {
              title: 'Uptime Monitor',
              desc: 'Cek website tiap menit. Langsung dapat notifikasi saat down.',
              icon: '📡',
            },
            {
              title: 'SSL & Domain Expiry',
              desc: 'Peringatan dini 30/14/7/3/1 hari sebelum SSL atau domain expire.',
              icon: '🔐',
            },
            {
              title: 'Multi-channel Alert',
              desc: 'Email, Telegram bot, Discord webhook. Pilih sesuai kebutuhanmu.',
              icon: '🔔',
            },
          ].map((f) => (
            <Card key={f.title} className="p-5">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.desc}</p>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-default bg-card">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted">
          Monalertics — Built with Next.js + PostgreSQL + Prisma
        </div>
      </footer>
    </div>
  )
}
