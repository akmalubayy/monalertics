import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, unauthorizedResponse } from '@/modules/auth/auth.middleware'
import { authService } from '@/modules/auth/auth.service'
import { updateProfileSchema } from '@/modules/auth/auth.types'
import { logger } from '@/shared/utils/logger'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  try {
    const profile = await authService.getProfile(auth.userId)
    if (!profile) return unauthorizedResponse()
    return NextResponse.json({ ok: true, user: profile })
  } catch {
    return NextResponse.json({ error: 'Gagal memuat profil' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return unauthorizedResponse()

  try {
    const body = await req.json()
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const user = await authService.updateProfile(auth.userId, parsed.data)
    return NextResponse.json({ ok: true, user })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal update profil'
    logger.error('Update profile failed', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
