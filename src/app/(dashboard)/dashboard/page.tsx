'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, ArrowUpRight, Activity, AlertTriangle, Clock, Monitor as MonitorIcon } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface Monitor {
  id: string
  name: string
  type: string
  target: string
  lastStatus: string
  lastCheckedAt: string | null
}

interface WorkspaceInfo {
  name: string
  planName: string
  planLimits: {
    maxMonitors: number
  }
}

export default function DashboardPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('token')
        if (!token) return

        const profileRes = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const profileData = await profileRes.json()

        if (!profileRes.ok || !profileData.ok) {
          setError('Gagal memuat profil')
          return
        }

        const memberships = profileData.user?.memberships
        if (memberships && memberships.length > 0) {
          const ws = memberships[0].workspace
          setWorkspace({
            name: ws.name,
            planName: ws.plan?.displayName || 'Free',
            planLimits: { maxMonitors: ws.plan?.maxMonitors || 3 },
          })

          const monitorRes = await fetch(
            `/api/monitors?workspaceId=${ws.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const monitorData = await monitorRes.json()
          if (monitorData.ok) {
            setMonitors(monitorData.monitors || [])
          }
        }
      } catch {
        setError('Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const upCount = monitors.filter((m) => m.lastStatus === 'UP').length
  const downCount = monitors.filter((m) => m.lastStatus === 'DOWN').length
  const warningCount = monitors.filter((m) => m.lastStatus === 'WARNING').length

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted">
            {workspace?.name || 'Workspace'} — {workspace?.planName || 'Free'} Plan
          </p>
        </div>
        <Link href="/dashboard/monitors" className="shrink-0">
          <Button size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Tambah Monitor
          </Button>
        </Link>
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950">
          <CardContent className="p-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards — 2x2 on mobile/tablet, 4-col on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30">
              <Activity className="h-5 w-5 text-brand-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold sm:text-2xl">{monitors.length}</p>
              <p className="text-xs text-muted">Total Monitor</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-green-600 sm:text-2xl">{upCount}</p>
              <p className="text-xs text-muted">Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-red-600 sm:text-2xl">{downCount}</p>
              <p className="text-xs text-muted">Down</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-amber-600 sm:text-2xl">{warningCount}</p>
              <p className="text-xs text-muted">Warning</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monitors Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Monitor Terbaru</CardTitle>
            <CardDescription>Daftar monitor aktif</CardDescription>
          </div>
          <Link href="/dashboard/monitors">
            <Button variant="outline" size="sm">Lihat Semua</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {monitors.length === 0 ? (
            <div className="py-12 text-center">
              <MonitorIcon className="mx-auto h-12 w-12 text-muted opacity-30" />
              <p className="mt-3 text-sm font-medium text-muted">Belum ada monitor</p>
              <p className="mt-1 text-xs text-muted">Mulai pantau website kamu sekarang</p>
              <Link href="/dashboard/monitors">
                <Button size="sm" className="mt-4">
                  <Plus className="h-4 w-4" /> Tambah Monitor Pertama
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-default">
              {monitors.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge
                      variant={
                        m.lastStatus === 'UP'
                          ? 'up'
                          : m.lastStatus === 'DOWN'
                            ? 'down'
                            : m.lastStatus === 'WARNING'
                              ? 'warning'
                              : 'unknown'
                      }
                      dot
                      className="shrink-0"
                    >
                      {m.lastStatus}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted">{m.target}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted sm:inline">{m.type}</span>
                    <span className="text-xs text-muted">
                      {formatRelativeTime(m.lastCheckedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
