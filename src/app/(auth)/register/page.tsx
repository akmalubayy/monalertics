'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      setError('Password tidak cocok')
      setIsLoading(false)
      return
    }

    const body = {
      email: formData.get('email') as string,
      password,
      name: formData.get('name') as string,
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error || 'Registrasi gagal')
        return
      }

      // Auto-login setelah register
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: body.email, password: body.password }),
      })
      const loginData = await loginRes.json()

      if (loginData.ok && loginData.token) {
        localStorage.setItem('token', loginData.token)
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm animate-fade-in-up">
      <CardHeader className="text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
          M
        </div>
        <CardTitle className="mt-3">Buat akun Monalertics</CardTitle>
        <CardDescription>Mulai pantau website kamu gratis</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nama"
            name="name"
            type="text"
            placeholder="Nama lengkap"
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="nama@email.com"
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Minimal 8 karakter"
            required
            minLength={8}
          />
          <Input
            label="Konfirmasi Password"
            name="confirmPassword"
            type="password"
            placeholder="Ulangi password"
            required
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </p>
          )}
          <Button type="submit" isLoading={isLoading} className="w-full">
            Daftar
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}