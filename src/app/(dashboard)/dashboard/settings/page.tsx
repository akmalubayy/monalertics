'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { User, Building2, CreditCard, KeyRound, Loader2, Check, X, Sparkles, Zap } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ProfileUser {
  id: string
  email: string
  name: string | null
}

interface Plan {
  id: string
  name: string
  displayName: string
  priceMonthly: number
  maxMonitors: number
  minIntervalSeconds: number
  supportsTelegram: boolean
  supportsDiscord: boolean
}

interface Workspace {
  id: string
  name: string
  slug: string
  plan: Plan | null
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileUser | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  const token = () =>
    typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const authHeaders = () => ({ Authorization: `Bearer ${token()}` })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auth/profile', { headers: authHeaders() })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setError('Gagal memuat profil')
          return
        }
        const user = data.user
        setProfile({ id: user.id, email: user.email, name: user.name })
        const ws = user.memberships?.[0]?.workspace
        if (ws) setWorkspace(ws)
      } catch {
        setError('Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleProfileSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileSaving(true)
    setError('')
    setSuccess('')
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal menyimpan profil')
        return
      }
      setProfile((prev) =>
        prev ? { ...prev, name: data.user.name } : prev
      )
      setSuccess('Profil berhasil disimpan')
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const currentPassword = (form.elements.namedItem('currentPassword') as HTMLInputElement).value
    const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value
    const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value

    if (newPassword !== confirmPassword) {
      setError('Password baru tidak cocok')
      return
    }

    setPasswordSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal mengubah password')
        return
      }
      form.reset()
      setSuccess('Password berhasil diubah')
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    )
  }

  const currentPlan = workspace?.plan
  const currentPlanName = currentPlan?.name ?? 'FREE'

  const plans: Plan[] = [
    { id: 'p1', name: 'FREE', displayName: 'Free', priceMonthly: 0, maxMonitors: 3, minIntervalSeconds: 300, supportsTelegram: false, supportsDiscord: false },
    { id: 'p2', name: 'BASIC', displayName: 'Basic', priceMonthly: 49000, maxMonitors: 10, minIntervalSeconds: 60, supportsTelegram: true, supportsDiscord: false },
    { id: 'p3', name: 'PRO', displayName: 'Pro', priceMonthly: 149000, maxMonitors: 50, minIntervalSeconds: 60, supportsTelegram: true, supportsDiscord: true },
    { id: 'p4', name: 'ENTERPRISE', displayName: 'Enterprise', priceMonthly: 499000, maxMonitors: 500, minIntervalSeconds: 60, supportsTelegram: true, supportsDiscord: true },
  ]

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted">Kelola akun, workspace, dan langganan</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950">
          <CardContent className="p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}
      {success && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950">
          <CardContent className="p-3">
            <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profil */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted" />
              <CardTitle>Profil</CardTitle>
            </div>
            <CardDescription>Nama akun kamu</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
              <Input
                label="Nama"
                name="name"
                value={profile?.name ?? ''}
                onChange={(e) => setProfile((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                placeholder="Nama lengkap"
                required
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={profile?.email ?? ''}
                disabled
                hint="Email tidak bisa diubah"
              />
              <Button type="submit" size="sm" isLoading={profileSaving} className="self-start">
                Simpan Profil
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-muted" />
              <CardTitle>Ubah Password</CardTitle>
            </div>
            <CardDescription>Minimal 8 karakter</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSave} className="flex flex-col gap-4">
              <Input
                label="Password Saat Ini"
                name="currentPassword"
                type="password"
                placeholder="••••••••"
                required
              />
              <Input
                label="Password Baru"
                name="newPassword"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
              />
              <Input
                label="Konfirmasi Password Baru"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
              />
              <Button
                type="submit"
                size="sm"
                isLoading={passwordSaving}
                variant="outline"
                className="self-start"
              >
                Ubah Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Workspace Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted" />
              <CardTitle>Workspace</CardTitle>
            </div>
            <CardDescription>Info workspace saat ini</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Nama</dt>
                <dd className="font-medium">{workspace?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Slug</dt>
                <dd className="font-mono text-sm">{workspace?.slug ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Plan Aktif</dt>
                <dd>
                  <Badge variant="brand">{currentPlan?.displayName ?? 'Free'}</Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Plans */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-brand-500" />
                Paket Langganan
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Paket aktif:{' '}
                <span className="font-semibold text-brand-600 dark:text-brand-400">
                  {currentPlan?.displayName ?? 'Free'}
                </span>
                {' '}· Hubungi admin untuk upgrade
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = plan.name === currentPlanName
              const isPro = plan.name === 'PRO'
              const isEnterprise = plan.name === 'ENTERPRISE'
              const checkItems = [
                { label: `${plan.maxMonitors} monitor`, ok: true },
                { label: `Interval ${plan.minIntervalSeconds / 60} mnt`, ok: true },
                { label: 'Telegram alert', ok: plan.supportsTelegram },
                { label: 'Discord alert', ok: plan.supportsDiscord },
              ]
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isCurrent
                      ? 'border-brand-500 shadow-lg shadow-brand-500/10 ring-2 ring-brand-500/20'
                      : isPro
                      ? 'border-violet-400/60 dark:border-violet-500/40'
                      : 'border-default'
                  }`}
                >
                  {/* Header strip */}
                  <div
                    className={`px-4 pt-5 pb-4 ${
                      isCurrent
                        ? 'bg-gradient-to-br from-brand-600 to-brand-500'
                        : isPro
                        ? 'bg-gradient-to-br from-violet-600 to-purple-500'
                        : isEnterprise
                        ? 'bg-gradient-to-br from-slate-700 to-slate-600'
                        : 'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700'
                    }`}
                  >
                    {/* Badge popular / aktif */}
                    {isCurrent && (
                      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                        <Zap className="h-2.5 w-2.5" /> Aktif
                      </span>
                    )}
                    {isPro && !isCurrent && (
                      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                        <Sparkles className="h-2.5 w-2.5" /> Popular
                      </span>
                    )}
                    {!isCurrent && !isPro && (
                      <span className="mb-2 inline-block h-4 w-1 opacity-0 select-none">·</span>
                    )}

                    <p
                      className={`text-sm font-bold tracking-wide ${
                        isCurrent || isPro || isEnterprise
                          ? 'text-white'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {plan.displayName}
                    </p>

                    <div className="mt-1 flex items-end gap-1">
                      <span
                        className={`text-2xl font-extrabold leading-none ${
                          isCurrent || isPro || isEnterprise
                            ? 'text-white'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {plan.priceMonthly === 0 ? 'Gratis' : formatCurrency(plan.priceMonthly)}
                      </span>
                      {plan.priceMonthly > 0 && (
                        <span
                          className={`mb-0.5 text-xs ${
                            isCurrent || isPro || isEnterprise
                              ? 'text-white/70'
                              : 'text-muted'
                          }`}
                        >
                          /bln
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Feature list */}
                  <div className="flex flex-col flex-1 bg-[var(--card)] px-4 py-4">
                    <ul className="space-y-2 flex-1">
                      {checkItems.map((item) => (
                        <li key={item.label} className="flex items-center gap-2 text-xs">
                          {item.ok ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 flex-shrink-0">
                              <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                            </span>
                          ) : (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                              <X className="h-2.5 w-2.5 text-slate-400" />
                            </span>
                          )}
                          <span className={item.ok ? 'text-[var(--foreground)]' : 'text-muted line-through'}>
                            {item.label}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4">
                      {isCurrent ? (
                        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/30 py-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
                          <Check className="h-3 w-3" /> Paket Anda
                        </div>
                      ) : (
                        <button
                          disabled
                          title="Hubungi admin untuk upgrade"
                          className="w-full rounded-lg border border-default py-2 text-xs font-medium text-muted cursor-not-allowed opacity-60"
                        >
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}