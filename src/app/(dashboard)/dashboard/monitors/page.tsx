'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/modal'
import { Plus, Trash2, RefreshCw, ExternalLink, Loader2, Monitor as MonitorIcon, Upload, FileText, Download, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface Monitor {
  id: string
  name: string
  type: string
  target: string
  intervalSeconds: number
  isActive: boolean
  lastStatus: string
  lastCheckedAt: string | null
}

function statusVariant(s: string): 'up' | 'down' | 'warning' | 'unknown' {
  if (s === 'UP') return 'up'
  if (s === 'DOWN') return 'down'
  if (s === 'WARNING') return 'warning'
  return 'unknown'
}

const GROUPS_PER_PAGE = 15

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<Monitor | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Import CSV state
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    total: number
    success: number
    failed: number
    errors: Array<{ row: number; error: string }>
  } | null>(null)

  const [form, setForm] = useState({
    name: '',
    type: 'UPTIME',
    target: '',
    intervalSeconds: 300,
  })

  const token = () =>
    typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const loadMonitors = useCallback(async () => {
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
      setWorkspaceId(wsId)

      const res = await fetch(`/api/monitors?workspaceId=${wsId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal memuat monitor')
        return
      }
      setMonitors(data.monitors ?? [])
    } catch {
      setError('Gagal memuat monitor')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMonitors()
  }, [loadMonitors])

  // Group monitors by domain
  const groups = useMemo(() => {
    return monitors.reduce<Record<string, Monitor[]>>((acc, m) => {
      const key = m.target.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
      if (!acc[key]) acc[key] = []
      acc[key].push(m)
      return acc
    }, {})
  }, [monitors])

  const groupKeys = useMemo(() => Object.keys(groups).sort(), [groups])
  const totalPages = Math.ceil(groupKeys.length / GROUPS_PER_PAGE)
  const safePage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1))
  const visibleKeys = groupKeys.slice((safePage - 1) * GROUPS_PER_PAGE, safePage * GROUPS_PER_PAGE)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setNotice('')

    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ ...form, workspaceId }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal membuat monitor')
        return
      }

      setNotice('Monitor berhasil ditambahkan')
      setShowForm(false)
      setForm({ name: '', type: 'UPTIME', target: '', intervalSeconds: 300 })
      setCurrentPage(1)
      await loadMonitors()
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/monitors/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!res.ok) {
        setError('Gagal hapus monitor')
        return
      }
      setNotice(`Monitor "${deleteTarget.name}" berhasil dihapus`)
      setDeleteTarget(null)
      setCurrentPage(1)
      await loadMonitors()
    } catch {
      setError('Gagal hapus monitor')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleImport() {
    if (!importFile || !workspaceId) return
    setIsImporting(true)
    setError('')
    setNotice('')
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('workspaceId', workspaceId)

      const res = await fetch('/api/monitors/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal import CSV')
        return
      }

      setImportResult(data.result)
      if (data.result.failed === 0) {
        setNotice(`Import berhasil: ${data.result.success} monitor ditambahkan`)
      }
      setCurrentPage(1)
      await loadMonitors()
    } catch {
      setError('Terjadi kesalahan saat import')
    } finally {
      setIsImporting(false)
    }
  }

  function downloadSampleCsv() {
    const csv = `name,target,uptime,ssl,domain_expiry,interval_minutes
Google,google.com,true,true,true,5
Facebook,facebook.com,true,false,false,5
SSL Only,sslindonesia.com,false,true,false,30
Domain Only,example.com,false,false,true,60
All Checks,mysite.com,true,true,true,15`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'monalertics-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCheck(id: string) {
    setCheckingId(id)
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
      setNotice(`Pemeriksaan selesai — status: ${data.monitor?.lastStatus ?? '?'}`)
      await loadMonitors()
    } catch {
      setError('Terjadi kesalahan saat memeriksa')
    } finally {
      setCheckingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {notice}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Monitor</h1>
          <p className="text-sm text-muted">Kelola dan pantau target website Anda</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Monitor Baru
          </Button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-md">
            <CardHeader>
              <CardTitle>Monitor Baru</CardTitle>
              <CardDescription>Tambah monitor untuk mulai memantau target</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nama</label>
                  <Input
                    type="text"
                    placeholder="Contoh: Website Utama"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Target</label>
                  <Input
                    type="text"
                    placeholder="example.com atau https://example.com"
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tipe Pemeriksaan</label>
                  <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="UPTIME">Uptime</option>
                    <option value="SSL">SSL</option>
                    <option value="DOMAIN">Domain Expiry</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Interval (detik)</label>
                  <Input
                    type="number"
                    placeholder="300"
                    value={form.intervalSeconds}
                    onChange={(e) => setForm({ ...form, intervalSeconds: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Buat Monitor
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Batal
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Monitor</CardTitle>
          <CardDescription>
            {monitors.length} monitor terdaftar ({groupKeys.length} domain)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monitors.length === 0 ? (
            <div className="py-12 text-center">
              <MonitorIcon className="mx-auto h-12 w-12 text-muted opacity-30" />
              <p className="mt-3 text-sm font-medium text-muted">Belum ada monitor</p>
              <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Tambah Monitor Pertama
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {visibleKeys.map((domain) => (
                  <details
                    key={domain}
                    className="group rounded-lg border border-default bg-card p-4 transition-all"
                  >
                    <summary className="flex cursor-pointer items-center justify-between font-medium select-none">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-base">{domain}</span>
                        <span className="text-xs text-muted">({groups[domain].length} check)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {groups[domain].map((m) => (
                          <Badge key={m.id} variant={statusVariant(m.lastStatus)} dot>
                            {m.type}: {m.lastStatus}
                          </Badge>
                        ))}
                      </div>
                    </summary>

                    <div className="mt-4 divide-y divide-default border-t border-default pt-2">
                      {groups[domain].map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-3 py-3 first:pt-2 last:pb-0"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Badge variant={statusVariant(m.lastStatus)} dot className="shrink-0">
                              {m.lastStatus}
                            </Badge>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{m.name}</p>
                              <p className="truncate text-xs text-muted">{m.target}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="hidden text-xs text-muted sm:inline">{m.type}</span>
                            <span className="hidden text-xs text-muted lg:inline">
                              {formatRelativeTime(m.lastCheckedAt)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Check Now"
                              onClick={() => handleCheck(m.id)}
                              disabled={checkingId === m.id}
                            >
                              {checkingId === m.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Link href={`/dashboard/monitors/${m.id}`}>
                              <Button variant="ghost" size="icon" title="Detail">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Hapus"
                              onClick={() => setDeleteTarget(m)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-default pt-4">
                  <p className="text-xs text-muted">
                    Halaman {safePage} dari {totalPages} • {groupKeys.length} domain
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={safePage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" /> Sebelumnya
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={safePage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Berikutnya <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        variant="danger"
        title="Hapus Monitor?"
        description={
          deleteTarget
            ? `Monitor "${deleteTarget.name}" akan dihapus permanen beserta seluruh riwayat pemeriksaannya. Tindakan ini tidak dapat dibatalkan.`
            : undefined
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
      />

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Monitor dari CSV
              </CardTitle>
              <CardDescription>
                Upload file CSV untuk membuat monitor secara batch. 1 baris = 1 domain, bisa aktifkan 3 tipe sekaligus.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sample CSV Download */}
              <div className="rounded-lg border border-dashed border-default bg-muted/30 px-4 py-3">
                <p className="mb-2 text-sm font-medium">Format CSV:</p>
                <code className="block overflow-x-auto text-xs text-muted">
                  name,target,uptime,ssl,domain_expiry,interval_minutes
                </code>
                <p className="mt-2 text-xs text-muted">
                  Setiap kolom boolean (true/false) untuk mengaktifkan tipe pemeriksaan
                </p>
                <Button size="sm" variant="ghost" onClick={downloadSampleCsv} className="mt-2 gap-2">
                  <Download className="h-4 w-4" /> Download Contoh CSV
                </Button>
              </div>

              {/* File Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih File CSV</label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </div>

              {/* Import Result */}
              {importResult && (
                <div className="rounded-lg border border-default bg-muted/50 p-3 text-sm">
                  <p className="font-medium">Hasil Import:</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>✓ Total: {importResult.total}</li>
                    <li>✓ Berhasil: {importResult.success}</li>
                    <li>✗ Gagal: {importResult.failed}</li>
                  </ul>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium">Error:</p>
                      {importResult.errors.slice(0, 3).map((err, i) => (
                        <p key={i} className="text-xs text-red-600">
                          Baris {err.row}: {err.error}
                        </p>
                      ))}
                      {importResult.errors.length > 3 && (
                        <p className="text-xs text-muted">... dan {importResult.errors.length - 3} error lainnya</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleImport}
                  disabled={!importFile || isImporting}
                  className="flex-1 gap-2"
                >
                  {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowImport(false)
                    setImportFile(null)
                    setImportResult(null)
                  }}
                  disabled={isImporting}
                  className="flex-1"
                >
                  Tutup
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
