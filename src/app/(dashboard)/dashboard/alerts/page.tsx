'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/modal'
import { Mail, MessageSquare, Send, Plus, Trash2, Loader2, Edit2, Wifi, WifiOff, Paperclip } from 'lucide-react'

interface Channel {
  id: string
  type: 'EMAIL' | 'TELEGRAM' | 'DISCORD'
  name: string
  config: Record<string, string>
  isActive: boolean
  isVerified: boolean
}

function channelTarget(c: Channel): string {
  if (c.type === 'EMAIL') return c.config?.address ?? '—'
  if (c.type === 'TELEGRAM') return c.config?.chatId ?? '—'
  return c.config?.webhookUrl ?? '—'
}

function channelIcon(type: Channel['type']) {
  if (type === 'EMAIL') return <Mail className="h-5 w-5 shrink-0 text-blue-500" />
  if (type === 'TELEGRAM') return <Send className="h-5 w-5 shrink-0 text-sky-500" />
  return <MessageSquare className="h-5 w-5 shrink-0 text-indigo-500" />
}

function channelTypeLabel(type: Channel['type']) {
  return type === 'EMAIL' ? 'Email' : type === 'TELEGRAM' ? 'Telegram' : 'Discord'
}

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed'

export default function AlertsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Add channel
  const [showAdd, setShowAdd] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [channelType, setChannelType] = useState<'EMAIL' | 'TELEGRAM' | 'DISCORD'>('EMAIL')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')

  // Connection status per channel
  const [connStatus, setConnStatus] = useState<Record<string, ConnectionStatus>>({})
  const [connError, setConnError] = useState<Record<string, string>>({})

  // Send message modal
  const [showSendModal, setShowSendModal] = useState(false)
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set())
  const [msgMode, setMsgMode] = useState<'default' | 'custom'>('default')
  const [customTitle, setCustomTitle] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<Record<string, { ok: boolean; error?: string }> | null>(null)

  // Edit modal
  const [editTarget, setEditTarget] = useState<Channel | null>(null)
  const [editName, setEditName] = useState('')
  const [editTarget2, setEditTarget2] = useState('')
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const token = () =>
    typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const loadChannels = useCallback(async (wsId: string) => {
    const res = await fetch(`/api/workspaces/${wsId}/channels`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      setError(data.error || 'Gagal memuat channel')
      return
    }
    setChannels(data.channels ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const data = await res.json()
        const ws = data.user?.memberships?.[0]?.workspace
        if (!ws) {
          setError('Workspace tidak ditemukan')
          return
        }
        setWorkspaceId(ws.id)
        await loadChannels(ws.id)
      } catch {
        setError('Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [loadChannels])

  /* -------- Add Channel -------- */
  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!workspaceId) return
    setIsSubmitting(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ type: channelType, name, target }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal menambah channel')
        return
      }
      setNotice('Channel berhasil ditambahkan')
      setName('')
      setTarget('')
      setShowAdd(false)
      await loadChannels(workspaceId)
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  /* -------- Test Connection (single channel) -------- */
  async function testConnection(channelId: string) {
    if (!workspaceId) return
    setConnStatus((s) => ({ ...s, [channelId]: 'testing' }))
    setConnError((s) => ({ ...s, [channelId]: '' }))
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/channels/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ channelId }),
      })
      const data = await res.json()
      if (data.ok) {
        setConnStatus((s) => ({ ...s, [channelId]: 'connected' }))
      } else {
        setConnStatus((s) => ({ ...s, [channelId]: 'failed' }))
        setConnError((s) => ({ ...s, [channelId]: data.error || 'Koneksi gagal' }))
      }
    } catch {
      setConnStatus((s) => ({ ...s, [channelId]: 'failed' }))
      setConnError((s) => ({ ...s, [channelId]: 'Tidak dapat terhubung ke server' }))
    }
  }

  /* -------- Test All Connections -------- */
  async function testAllConnections() {
    for (const c of channels) {
      await testConnection(c.id)
    }
  }

  /* -------- Send Message (multi-channel) -------- */
  function openSendModal() {
    setSelectedChannelIds(new Set())
    setMsgMode('default')
    setCustomTitle('')
    setCustomBody('')
    setSendResults(null)
    setShowSendModal(true)
  }

  function toggleChannel(id: string) {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllChannels() {
    setSelectedChannelIds(new Set(channels.map((c) => c.id)))
  }

  function clearChannelSelection() {
    setSelectedChannelIds(new Set())
  }

  async function handleSendMessage() {
    if (!workspaceId || selectedChannelIds.size === 0) return
    setIsSending(true)
    setError('')
    setNotice('')
    setSendResults(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/channels/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          channelIds: Array.from(selectedChannelIds),
          customTitle: msgMode === 'custom' && customTitle ? customTitle : undefined,
          customMessage: msgMode === 'custom' && customBody ? customBody : undefined,
        }),
      })
      const data = await res.json()
      if (data.results) {
        setSendResults(data.results)
        const results = Object.values(data.results) as { ok: boolean }[]
        const failCount = results.filter((r) => !r.ok).length
        if (failCount === 0) {
          setNotice(`Pesan berhasil dikirim ke ${selectedChannelIds.size} channel`)
        } else {
          setError(`${failCount} dari ${selectedChannelIds.size} channel gagal menerima pesan`)
        }
        // Re-load to update verified status
        await loadChannels(workspaceId)
      } else {
        setError(data.error || 'Gagal mengirim pesan')
      }
    } catch {
      setError('Terjadi kesalahan saat mengirim pesan')
    } finally {
      setIsSending(false)
    }
  }

  /* -------- Edit Channel -------- */
  function openEditModal(channel: Channel) {
    setEditTarget(channel)
    setEditName(channel.name)
    setEditTarget2(channelTarget(channel))
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!workspaceId || !editTarget) return
    setIsEditSubmitting(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/channels/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: editName || editTarget.name,
          target: editTarget2 || channelTarget(editTarget),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal update channel')
        return
      }
      setNotice('Channel berhasil diupdate')
      setEditTarget(null)
      await loadChannels(workspaceId)
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setIsEditSubmitting(false)
    }
  }

  /* -------- Delete Channel -------- */
  async function confirmDelete() {
    if (!workspaceId || !deleteTarget) return
    setIsDeleting(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/channels/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.ok) {
        setNotice('Channel dihapus')
        await loadChannels(workspaceId)
      } else {
        setError('Gagal menghapus channel')
      }
    } catch {
      setError('Terjadi kesalahan')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    )
  }

  const hasChannels = channels.length > 0

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alert Channels</h1>
          <p className="text-sm text-muted">Konfigurasi saluran notifikasi otomatis</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasChannels && (
            <>
              <Button variant="outline" size="sm" onClick={testAllConnections}>
                <Wifi className="h-4 w-4" /> Test Koneksi Semua
              </Button>
              <Button variant="outline" size="sm" onClick={openSendModal}>
                <Paperclip className="h-4 w-4" /> Kirim Pesan
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4" /> Tambah Channel
          </Button>
        </div>
      </div>

      {/* Notices */}
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

      {/* Add Channel Form */}
      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah Saluran Notifikasi</CardTitle>
            <CardDescription>Pilih platform dan masukkan kredensial</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddChannel} className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Jenis Channel"
                value={channelType}
                onChange={(e) =>
                  setChannelType(e.target.value as 'EMAIL' | 'TELEGRAM' | 'DISCORD')
                }
              >
                <option value="EMAIL">Email (SMTP)</option>
                <option value="TELEGRAM">Telegram Bot</option>
                <option value="DISCORD">Discord Webhook</option>
              </Select>
              <Input
                label="Nama Label"
                placeholder="cth: Telegram Alerts Tim Ops"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="sm:col-span-2">
                <Input
                  label={
                    channelType === 'EMAIL'
                      ? 'Alamat Email'
                      : channelType === 'TELEGRAM'
                        ? 'Chat ID Telegram'
                        : 'Discord Webhook URL'
                  }
                  placeholder={
                    channelType === 'EMAIL'
                      ? 'alert@perusahaan.com'
                      : channelType === 'TELEGRAM'
                        ? '123456789'
                        : 'https://discord.com/api/webhooks/...'
                  }
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" isLoading={isSubmitting}>
                  Simpan Channel
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Channel List */}
      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="mx-auto h-10 w-10 text-muted opacity-30" />
            <p className="mt-3 text-sm font-medium text-muted">Belum ada channel</p>
            <p className="mt-1 text-xs text-muted">
              Tambahkan channel untuk menerima notifikasi
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => {
            const status = connStatus[c.id] || 'idle'
            return (
              <Card key={c.id} className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {channelIcon(c.type)}
                    <CardTitle className="truncate text-base">{c.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={c.isVerified ? 'up' : 'unknown'} dot className="shrink-0">
                      {c.isVerified ? 'Verified' : 'Untested'}
                    </Badge>
                    {/* Connection indicator */}
                    {status === 'connected' && (
                      <Wifi className="h-4 w-4 text-green-500" />
                    )}
                    {status === 'failed' && (
                      <WifiOff className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-3">
                  <p className="truncate font-mono text-xs text-muted">{channelTarget(c)}</p>

                  {/* Connection error detail */}
                  {status === 'failed' && connError[c.id] && (
                    <p className="text-xs text-red-500 dark:text-red-400">{connError[c.id]}</p>
                  )}

                  {/* Testing indicator */}
                  {status === 'testing' && (
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Loader2 className="h-3 w-3 animate-spin" /> Menguji koneksi...
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="flex items-center gap-1">
                      {channelIcon(c.type)}
                      {channelTypeLabel(c.type)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => testConnection(c.id)}
                        disabled={status === 'testing'}
                      >
                        {status === 'testing' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wifi className="h-3 w-3" />
                        )}
                        Koneksi
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditModal(c)}
                        title="Edit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteTarget(c)}
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ---- Modals (portaled) ---- */}

      {/* Confirm Delete */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        variant="danger"
        title="Hapus Channel?"
        description={
          deleteTarget
            ? `Channel "${deleteTarget.name}" akan dihapus permanen. Semua monitor yang terhubung akan kehilangan saluran notifikasi ini.`
            : undefined
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
      />

      {/* Edit Modal */}
      {editTarget &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Edit Channel</CardTitle>
                <CardDescription>Update nama atau target channel</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEdit} className="space-y-4">
                  <Input
                    label="Nama Label"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                  <Input
                    label={
                      editTarget.type === 'EMAIL'
                        ? 'Alamat Email'
                        : editTarget.type === 'TELEGRAM'
                          ? 'Chat ID Telegram'
                          : 'Discord Webhook URL'
                    }
                    value={editTarget2}
                    onChange={(e) => setEditTarget2(e.target.value)}
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" isLoading={isEditSubmitting}>
                      Simpan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditTarget(null)}
                      disabled={isEditSubmitting}
                    >
                      Batal
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>,
          document.body
        )}

      {/* Send Message Modal */}
      {showSendModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle>Kirim Pesan Notifikasi</CardTitle>
                <CardDescription>
                  Pilih channel tujuan & kirim pesan default atau custom
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {/* Channel Selection */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium">Pilih Channel</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-brand-600 hover:underline"
                          onClick={selectAllChannels}
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted hover:underline"
                          onClick={clearChannelSelection}
                        >
                          Hapus Semua
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-input p-2">
                      {channels.map((c) => (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                            selectedChannelIds.has(c.id)
                              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedChannelIds.has(c.id)}
                            onChange={() => toggleChannel(c.id)}
                            className="accent-brand-600"
                          />
                          {channelIcon(c.type)}
                          <span className="truncate font-medium">{c.name}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted">
                            {channelTypeLabel(c.type)}
                          </span>
                        </label>
                      ))}
                    </div>
                    {selectedChannelIds.size === 0 && (
                      <p className="mt-1 text-xs text-red-500">Pilih minimal 1 channel</p>
                    )}
                  </div>

                  {/* Message Mode */}
                  <div>
                    <label className="mb-2 block text-sm font-medium">Jenis Pesan</label>
                    <div className="flex gap-3">
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                          msgMode === 'default'
                            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                            : 'border-input hover:border-brand-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="msgMode"
                          checked={msgMode === 'default'}
                          onChange={() => setMsgMode('default')}
                          className="accent-brand-600"
                        />
                        Pesan Default
                      </label>
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                          msgMode === 'custom'
                            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                            : 'border-input hover:border-brand-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="msgMode"
                          checked={msgMode === 'custom'}
                          onChange={() => setMsgMode('custom')}
                          className="accent-brand-600"
                        />
                        Custom Message
                      </label>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {msgMode === 'custom' && (
                    <div className="space-y-3 rounded-lg border border-input p-3">
                      <Input
                        label="Custom Title"
                        placeholder="cth: Server Production Down!"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                      />
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">
                          Custom Body Content
                        </label>
                        <textarea
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          rows={5}
                          placeholder="cth: Website tidak bisa diakses sejak 10 menit yang lalu. Silakan cek segera."
                          value={customBody}
                          onChange={(e) => setCustomBody(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Send Results */}
                  {sendResults && (
                    <div className="space-y-1.5 rounded-lg border border-input p-3">
                      <p className="text-sm font-medium">Hasil Pengiriman:</p>
                      {Object.entries(sendResults).map(([id, res]) => {
                        const ch = channels.find((c) => c.id === id)
                        return (
                          <div key={id} className="flex items-center gap-2 text-xs">
                            {res.ok ? (
                              <Wifi className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <WifiOff className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span className="font-medium">{ch?.name ?? id}</span>
                            {!res.ok && <span className="text-red-500">— {res.error}</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendMessage}
                      isLoading={isSending}
                      disabled={selectedChannelIds.size === 0 || (msgMode === 'custom' && !customTitle && !customBody)}
                    >
                      <Send className="h-4 w-4" /> Kirim Pesan
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowSendModal(false)}
                      disabled={isSending}
                    >
                      Tutup
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>,
          document.body
        )}
    </div>
  )
}
