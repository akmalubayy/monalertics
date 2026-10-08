'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Monitor,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DecodedToken {
  userId: string
  email: string
  role: 'USER' | 'ADMIN'
}

const baseNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/monitors', label: 'Monitors', icon: Monitor },
  { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const adminNav = [
  { href: '/admin/users', label: 'Admin', icon: Shield },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'USER' | 'ADMIN' | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.replace('/login')
      return
    }
    // Decode JWT untuk ambil email & role dari token
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as DecodedToken
      setUserEmail(payload.email || 'User')
      // Verifikasi role terkini dari server (token bisa stale jika role diubah via DB)
      fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          // API return { ok, user: { role } } — handle kedua bentuk
          const role = data?.user?.role ?? data?.role
          if (role) setUserRole(role)
          else setUserRole(payload.role || 'USER')
        })
        .catch(() => setUserRole(payload.role || 'USER'))
    } catch {
      setUserEmail('User')
      setUserRole('USER')
    }
  }, [router])

  function logout() {
    localStorage.removeItem('token')
    router.replace('/login')
  }

  // Filter nav berdasarkan role
  const nav = [...baseNav, ...(userRole === 'ADMIN' ? adminNav : [])]

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-default bg-card md:flex sticky top-0 h-screen">
        <div className="flex h-16 items-center gap-2 border-b border-default px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            M
          </div>
          <span className="text-lg font-semibold">Monalertics</span>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'text-muted hover:bg-muted hover:text-[var(--foreground)]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="border-t border-default p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium text-[var(--foreground)]">{userEmail}</p>
              <p className="text-xs text-muted">Free Plan</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-default bg-card px-4 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </div>
            <span className="text-lg font-semibold">Monalertics</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="border-b border-default bg-card p-4 md:hidden">
            <ul className="space-y-1">
              {nav.map((item) => {
                const Icon = item.icon
                const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                          : 'text-muted hover:bg-muted'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-default pt-4">
              <div className="text-sm">
                <p className="font-medium">{userEmail}</p>
                <p className="text-xs text-muted">Free Plan</p>
              </div>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto bg-[var(--background)] p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}