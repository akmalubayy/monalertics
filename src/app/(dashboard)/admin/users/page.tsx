'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Loader2, Plus, Edit2, Trash2, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface UserInfo {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'ADMIN'
  createdAt: string
}

type ModalMode = 'create' | 'edit' | 'delete' | null

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null)
  const [formData, setFormData] = useState({ email: '', name: '', password: '', role: 'USER' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
  const authHeaders = () => ({ Authorization: `Bearer ${token()}` })

  useEffect(() => {
    const tok = token()
    if (!tok) {
      router.replace('/login')
      return
    }
    try {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      if (payload.role !== 'ADMIN') {
        router.replace('/dashboard')
        return
      }
      setIsAuthorized(true)
    } catch {
      router.replace('/login')
      return
    }

    load()
    setMounted(true)
  }, [router])

  async function load() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users', { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal memuat users')
        if (res.status === 403) router.replace('/dashboard')
        return
      }
      setUsers(data.users)
    } catch (err) {
      setError('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setFormData({ email: '', name: '', password: '', role: 'USER' })
    setEditingUser(null)
    setModalMode('create')
  }

  function openEditModal(user: UserInfo) {
    setFormData({ email: user.email, name: user.name || '', password: '', role: user.role })
    setEditingUser(user)
    setModalMode('edit')
  }

  function openDeleteModal(user: UserInfo) {
    setEditingUser(user)
    setModalMode('delete')
  }

  function closeModal() {
    setModalMode(null)
    setEditingUser(null)
    setFormData({ email: '', name: '', password: '', role: 'USER' })
  }

  async function handleCreateUser() {
    if (!formData.email || !formData.password) {
      setError('Email dan password diperlukan')
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name || null,
          password: formData.password,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal membuat user')
        return
      }

      setSuccess('User berhasil dibuat')
      closeModal()
      await load()
    } catch (err) {
      setError('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateUser() {
    if (!editingUser) return

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name || null,
          role: formData.role,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal update user')
        return
      }

      setSuccess('User berhasil diupdate')
      closeModal()
      await load()
    } catch (err) {
      setError('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteUser() {
    if (!editingUser) return

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal hapus user')
        return
      }

      setSuccess('User berhasil dihapus')
      closeModal()
      await load()
    } catch (err) {
      setError('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthorized || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin - Kelola User</h1>
          <p className="text-sm text-muted">Tambah, edit, dan hapus user</p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah User
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950">
          <CardContent className="p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted" />
            <CardTitle>Daftar User</CardTitle>
          </div>
          <CardDescription>Total: {users.length} user</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default">
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Nama</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Terdaftar</th>
                  <th className="px-4 py-3 text-left font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-default hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs">{user.email}</td>
                    <td className="px-4 py-3">{user.name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === 'ADMIN' ? 'brand' : 'outline'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatDate(new Date(user.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(user)}
                          title="Edit user"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                          onClick={() => openDeleteModal(user)}
                          title="Hapus user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {modalMode === 'create' &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4 pt-20">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeModal}
            />
            <div className="relative z-10 w-full max-w-md animate-fade-in-up rounded-2xl border border-default bg-[var(--card)] p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Buat User Baru</h3>
                <button
                  onClick={closeModal}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Nama (opsional)</label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Nama pengguna"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    disabled={isSubmitting}
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleCreateUser}
                    isLoading={isSubmitting}
                    className="flex-1"
                  >
                    Buat User
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Modal */}
      {modalMode === 'edit' &&
        mounted &&
        editingUser &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4 pt-20">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeModal}
            />
            <div className="relative z-10 w-full max-w-md animate-fade-in-up rounded-2xl border border-default bg-[var(--card)] p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit User</h3>
                <button
                  onClick={closeModal}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted">{formData.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Nama</label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Nama pengguna"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as 'USER' | 'ADMIN',
                      })
                    }
                    className="w-full rounded-lg border border-default bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    disabled={isSubmitting}
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleUpdateUser}
                    isLoading={isSubmitting}
                    className="flex-1"
                  >
                    Update
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {modalMode === 'delete' &&
        mounted &&
        editingUser &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-4 pt-20">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeModal}
            />
            <div className="relative z-10 w-full max-w-md animate-fade-in-up rounded-2xl border border-default bg-[var(--card)] p-6 shadow-2xl">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Hapus User?</h3>
                <p className="mt-2 text-sm text-muted">
                  Yakin ingin menghapus <span className="font-mono">{editingUser.email}</span>?
                  Tindakan ini tidak dapat dibatalkan.
                </p>

                <div className="mt-6 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleDeleteUser}
                    isLoading={isSubmitting}
                    className="flex-1"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
