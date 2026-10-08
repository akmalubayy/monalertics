'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Loader2, BarChart3 } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Analytics {
  uptimePercent: number
  totalChecks: number
  upChecks: number
  downChecks: number
  avgResponseMs: number
  totalIncidents: number
  openIncidents: number
  series: { label: string; avgResponseMs: number; checks: number; up: number; down: number }[]
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const token = () =>
    typeof window !== 'undefined' ? localStorage.getItem('token') : null

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const profileRes = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const profileData = await profileRes.json()
        const wsId = profileData.user?.memberships?.[0]?.workspace?.id
        if (!wsId) {
          setError('Workspace tidak ditemukan')
          return
        }

        const res = await fetch(`/api/analytics?workspaceId=${wsId}&hours=${hours}`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || !data.ok) {
          setError(data.error || 'Gagal memuat analytics')
          return
        }
        setAnalytics(data.analytics)
      } catch {
        if (!cancelled) setError('Gagal memuat analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [hours])

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics &amp; Performance</h1>
          <p className="text-sm text-muted">
            Statistik response time &amp; uptime {hours} jam terakhir
          </p>
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            aria-label="Rentang waktu"
          >
            <option value={24}>24 jam</option>
            <option value={72}>3 hari</option>
            <option value={168}>7 hari</option>
            <option value={720}>30 hari</option>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-600 dark:bg-red-950 dark:border-red-900 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : !analytics || analytics.totalChecks === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-muted opacity-30" />
            <p className="mt-3 text-sm font-medium text-muted">Belum ada data</p>
            <p className="mt-1 text-xs text-muted">
              Data akan muncul setelah monitor menjalankan pemeriksaan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Uptime</CardDescription>
                <CardTitle
                  className={`text-3xl font-bold ${
                    analytics.uptimePercent >= 99
                      ? 'text-green-600'
                      : analytics.uptimePercent >= 95
                        ? 'text-amber-500'
                        : 'text-red-600'
                  }`}
                >
                  {analytics.uptimePercent.toFixed(2)}%
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Rata-rata Waktu Respon</CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {analytics.avgResponseMs} ms
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Pemeriksaan</CardDescription>
                <CardTitle className="text-3xl font-bold">{analytics.totalChecks}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Insiden</CardDescription>
                <CardTitle className="text-3xl font-bold text-amber-500">
                  {analytics.totalIncidents}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Grafik Waktu Respon</CardTitle>
              <CardDescription>
                Response time rata-rata per jam ({analytics.upChecks} up / {analytics.downChecks}{' '}
                down)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.series}>
                    <defs>
                      <linearGradient id="colorResp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" stroke="#888888" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      unit="ms"
                      width={60}
                    />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="avgResponseMs"
                      stroke="#4f46e5"
                      fillOpacity={1}
                      fill="url(#colorResp)"
                      name="Avg Response (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
