'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/modal'
import {
  ArrowLeft,
  Clock,
  Activity,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Loader2,
  Bell,
  BellOff,
  Plus,
  Mail,
  MessageCircle,
  Hash,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Check {
  id: string
  status: string
  responseTimeMs: number | null
  statusCode: number | null
  errorMessage: string | null
  checkedAt: string
}

interface MonitorDetail {
  id: string
  name: string
  type: string
  target: string
  intervalSeconds: number
  isActive: boolean
  lastStatus: string
  lastCheckedAt: string | null
  checks: Check[]
}

interface NotificationAttach {
  id: string
  channelId: string
  channelType: string
  channelName: string
  isActive: boolean
  exists: boolean
}

interface Channel {
  id: string
  name: string
  type: string
  isActive: boolean
}

function statusVariant(s: string): 'up' | 'down' | 'warning' | 'unknown' {
  if (s === 'UP') return 'up'
  if (s === 'DOWN') return 'down'
  if (s === 'WARNING') return 'warning'
  return 'unknown'
}

function channelIcon(type: string) {
  if (type === 'EMAIL') return <Mail className="h-4 w-4" />
  if (type === 'TELEGRAM') return <MessageCircle className="h-4 w-4" />
  if (type === 'DISCORD') return <Hash className="h-4 w-4" />
  return <Bell className="h-4 w-4" />
}

export default function MonitorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [monitor, setMonitor] = useState<MonitorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Notification state
  const [attached, setAttached] = useState<NotificationAttach[]>([])
  const [availableChannels, setAvailableChannels] = useState<Channel[]>([])
  const [loadingNotif, setLoadingNotif] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState('')
  const [attaching, setAttaching] = useState(false)

  // Confirm modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [detachTarget, setDetachTarget] = useState<NotificationAttach | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDetaching, setIsDetaching] = useState(false)

  const token = () =>
    typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const loadMonitor = useCallback(async () => {
    try {
      const res = await fetch(`/api/monitors/${id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Monitor tidak ditemukan')
        return
      }
      setMonitor(data.monitor)
    } catch {
      setError('Gagal memuat detail monitor')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadNotifications = useCallback(async () => {
    setLoadingNotif(true)
    try {
      const [attachedRes, channelsRes] = await Promise.all([
        fetch(`/api/monitors/${id}/notifications`, {
          headers: { Authorization: `Bearer ${token()}` },
        }),
        fetch(`/api/notification-channels`, {
          headers: { Authorization: `Bearer ${token()}` },
        }).catch(() => null),
      ])
      const attachedData = await attachedRes.json()
      if (attachedRes.ok && attachedData.ok) {
        setAttached(attachedData.notifications ?? [])
      }
      if (channelsRes) {
        const channelsData = await channelsRes.json()
        if (channelsRes.ok && channelsData.ok) {
          setAvailableChannels(channelsData.channels ?? [])
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingNotif(false)
    }
  }, [id])

  useEffect(() => {
    loadMonitor()
  }, [loadMonitor])

  useEffect(() => {
    if (monitor) loadNotifications()
  }, [monitor, loadNotifications])

  async function handleCheckNow() {
    setChecking(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/monitors/${id}/check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal menjalankan pemeriksaan')
        return
      }
      setNotice('Pemeriksaan selesai')
      await loadMonitor()
    } catch {
      setError('Terjadi kesalahan saat memeriksa')
    } finally {
      setChecking(false)
    }
  }

  async function confirmDelete() {
    setIsDeleting(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/monitors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.ok) {
        router.push('/dashboard/monitors')
        return
      }
      setError('Gagal menghapus monitor')
    } catch {
      setError('Gagal menghapus monitor')
    } finally {
      setIsDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  async function handleAttach() {
    if (!selectedChannel) return
    setAttaching(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/monitors/${id}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ channelId: selectedChannel }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal memasang channel')
        return
      }
      setSelectedChannel('')
      setNotice('Channel terpasang')
      await loadNotifications()
    } catch {
      setError('Gagal memasang channel')
    } finally {
      setAttaching(false)
    }
  }

  async function confirmDetach() {
    if (!detachTarget) return
    setIsDetaching(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/monitors/${id}/notifications/${detachTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Gagal melepas channel')
        return
      }
      setNotice('Channel dilepas')
      await loadNotifications()
    } catch {
      setError('Gagal melepas channel')
    } finally {
      setIsDetaching(false)
      setDetachTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    )
  }

  if (error && !monitor) {
    return (
      <div className="animate-fade-in-up space-y-4">
        <Link href="/dashboard/monitors">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
        </Link>
        <Card className="border-red-200 bg-red-50 dark:bg-red-950">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!monitor) return null

  const checks = monitor.checks ?? []
  const avgResponse =
    checks.length > 0
      ? Math.round(
          checks.reduce((acc, c) => acc + (c.responseTimeMs ?? 0), 0) / checks.length
        )
      : 0

  // Channel yang belum terpasang
  const attachedIds = new Set(attached.map((a) => a.channelId))
  const unattachedChannels = availableChannels.filter((c) => !attachedIds.has(c.id))

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/monitors">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{monitor.name}</h1>
              <Badge variant={statusVariant(monitor.lastStatus)} dot className="shrink-0">
                {monitor.lastStatus}
              </Badge>
            </div>
            <p className="truncate text-sm text-muted">{monitor.target}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCheckNow} disabled={checking}>
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Check Now
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
            <Trash2 className="h-4 w-4" /> Hapus
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-600 dark:bg-red-950 dark:border-red-900 dark:text-red-400">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-left text-sm text-green-700 dark:bg-green-950 dark:border-green-900 dark:text-green-400">
          {notice}
        </div>
      )}

      {/* Info Overview */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30">
              <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">Tipe Monitor</p>
              <p className="text-lg font-bold">{monitor.type}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">Interval</p>
              <p className="text-lg font-bold">{monitor.intervalSeconds / 60} menit</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">Avg Response Time</p>
              <p className="text-lg font-bold">{avgResponse > 0 ? `${avgResponse} ms` : '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SSL/Domain Expiry Info */}
      {(monitor.type === 'SSL' || monitor.type === 'DOMAIN') && (
        <Card>
          <CardHeader>
            <CardTitle>
              {monitor.type === 'SSL' ? '🔒 SSL Certificate Info' : '🌐 Domain Expiry Info'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checks.length === 0 ? (
              <p className="text-sm text-muted">Belum ada data. Klik "Check Now" untuk mulai.</p>
            ) : (() => {
              const lastCheck = checks[0]
              const settings = monitor && typeof monitor === 'object' && 'settings' in monitor ? (monitor as any).settings : {}
              const info = monitor.type === 'SSL' ? settings?.ssl : settings?.domain

              if (!info) {
                return (
                  <div>
                    <p className="text-sm text-muted">Status: {lastCheck.errorMessage || lastCheck.status}</p>
                  </div>
                )
              }

              return (
                <div className="space-y-3 text-sm">
                  {monitor.type === 'SSL' ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted">Valid From:</span>
                        <span className="font-mono">{new Date(info.validFrom).toLocaleDateString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between border-t border-default pt-3">
                        <span className="text-muted">Valid Until:</span>
                        <span className="font-mono font-bold">{new Date(info.validTo).toLocaleDateString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Days Remaining:</span>
                        <span className={`font-bold ${info.daysUntilExpiry <= 7 ? 'text-red-600' : 'text-green-600'}`}>
                          {info.daysUntilExpiry} hari
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Issuer:</span>
                        <span className="font-mono text-xs">{info.issuer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Subject:</span>
                        <span className="font-mono text-xs">{info.subject}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted">Expiry Date:</span>
                        <span className="font-mono font-bold">{new Date(info.expiryDate).toLocaleDateString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Days Remaining:</span>
                        <span className={`font-bold ${info.daysUntilExpiry <= 30 ? 'text-red-600' : 'text-green-600'}`}>
                          {info.daysUntilExpiry} hari
                        </span>
                      </div>
                      {info.registrar && (
                        <div className="flex justify-between">
                          <span className="text-muted">Registrar:</span>
                          <span className="font-mono text-xs">{info.registrar}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted" />
            <CardTitle>Notification Channels</CardTitle>
          </div>
          <CardDescription>
            Pilih channel mana yang menerima alert saat status monitor berubah
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingNotif ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            </div>
          ) : attached.length === 0 ? (
            <div className="rounded-lg border border-dashed border-default p-6 text-center">
              <BellOff className="mx-auto h-8 w-8 text-muted opacity-30" />
              <p className="mt-2 text-sm font-medium text-muted">Belum ada channel terpasang</p>
              <p className="mt-1 text-xs text-muted">
                Pasang channel agar monitor ini mengirim alert saat down/up.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-default">
              {attached.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30">
                      {channelIcon(n.channelType)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.channelName}</p>
                      <p className="text-xs text-muted">{n.channelType}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={n.isActive ? 'up' : 'warning'} dot>
                      {n.isActive ? 'Aktif' : 'Non-aktif'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Lepas"
                      onClick={() => setDetachTarget(n)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form tambah */}
          {unattachedChannels.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-default p-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Select
                  label="Pasang channel baru"
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                >
                  <option value="">— Pilih channel —</option>
                  {unattachedChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                onClick={handleAttach}
                disabled={!selectedChannel || attaching}
                size="sm"
                className="w-full shrink-0 sm:w-auto"
              >
                {attaching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Pasang
              </Button>
            </div>
          ) : availableChannels.length === 0 ? (
            <p className="text-xs text-muted">
              Belum ada channel di workspace. Buat di halaman{' '}
              <Link href="/dashboard/alerts" className="text-brand-600 underline">
                Alerts
              </Link>
              .
            </p>
          ) : (
            <p className="text-xs text-muted">Semua channel sudah terpasang.</p>
          )}
        </CardContent>
      </Card>

      {/* History Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pemeriksaan Terakhir</CardTitle>
          <CardDescription>
            {checks.length} pemeriksaan terakhir
            {monitor.lastCheckedAt ? ` — terakhir ${formatDate(monitor.lastCheckedAt)}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Belum ada riwayat. Klik &quot;Check Now&quot; untuk memulai.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-default text-xs text-muted">
                  <tr>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">HTTP</th>
                    <th className="pb-3 font-medium">Response</th>
                    <th className="pb-3 font-medium">Waktu</th>
                    <th className="pb-3 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {checks.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3">
                        <Badge variant={statusVariant(c.status)} dot>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-3 font-mono text-xs">{c.statusCode ?? '—'}</td>
                      <td className="py-3">
                        {c.responseTimeMs != null ? `${c.responseTimeMs} ms` : '—'}
                      </td>
                      <td className="py-3 text-xs text-muted">{formatDate(c.checkedAt)}</td>
                      <td className="max-w-[240px] truncate py-3 text-xs text-red-500">
                        {c.errorMessage || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => !isDeleting && setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        variant="danger"
        title="Hapus Monitor?"
        description={
          monitor
            ? `Monitor "${monitor.name}" akan dihapus permanen beserta seluruh riwayat pemeriksaannya. Tindakan ini tidak dapat dibatalkan.`
            : undefined
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
      />

      {/* Confirm Detach Modal */}
      <ConfirmModal
        isOpen={!!detachTarget}
        onClose={() => !isDetaching && setDetachTarget(null)}
        onConfirm={confirmDetach}
        isLoading={isDetaching}
        variant="warning"
        title="Lepas Channel?"
        description={
          detachTarget
            ? `Channel "${detachTarget.channelName}" tidak akan lagi menerima alert dari monitor ini.`
            : undefined
        }
        confirmText="Ya, Lepas"
        cancelText="Batal"
      />
    </div>
  )
}
