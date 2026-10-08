'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const body = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error || 'Login gagal')
        return
      }

      // Simpan token
      localStorage.setItem('token', data.token)
      router.push('/dashboard')
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
        <CardTitle className="mt-3">Masuk ke Monalertics</CardTitle>
        <CardDescription>Pantau website & domain kamu</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </p>
          )}
          <Button type="submit" isLoading={isLoading} className="w-full">
            Masuk
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Belum punya akun?{' '}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Daftar gratis
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}